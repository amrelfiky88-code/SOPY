import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { resetTestDb, closeDb } from '../test-utils/db.js';
import { startTestServer, makeClient, completeSetup } from '../test-utils/server.js';
import { pool } from '../src/db.js';
import { buildLineItems } from '../src/paddle/client.js';
import { calculatePricing } from '../../shared/pricing.js';

// The real-Paddle code paths (never exercised by the mock-mode tests):
// what we send Paddle, and how signed webhooks update subscriptions.

const SECRET = 'whsec_test_secret_for_signatures';
let close, api, baseUrl, realFetch;
const sentToPaddle = [];

function sign(body, ts = Math.floor(Date.now() / 1000)) {
  const h1 = crypto.createHmac('sha256', SECRET).update(`${ts}:${body}`).digest('hex');
  return `ts=${ts};h1=${h1}`;
}

function webhook(event, { signature, raw } = {}) {
  const body = raw ?? JSON.stringify(event);
  return realFetch(`${baseUrl}/api/billing/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Paddle-Signature': signature ?? sign(body) },
    body,
  });
}

before(async () => {
  await resetTestDb();
  const server = await startTestServer();
  close = server.close;
  baseUrl = server.baseUrl;
  api = makeClient(server.baseUrl);
  process.env.PADDLE_WEBHOOK_SECRET = SECRET;

  // Stub only Paddle's API; everything else (the test client) goes through.
  realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes('api.paddle.com')) {
      sentToPaddle.push({ url: String(url), method: init?.method, body: init?.body ? JSON.parse(init.body) : null });
      return new Response(JSON.stringify({ data: { id: `txn_${sentToPaddle.length}` } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return realFetch(url, init);
  };
});

after(async () => {
  globalThis.fetch = realFetch;
  delete process.env.PADDLE_API_KEY;
  delete process.env.PADDLE_WEBHOOK_SECRET;
  await close();
  await closeDb();
});

test('what Paddle bills adds up to exactly the total the pricing page shows', () => {
  for (const branches of [1, 2, 3, 7, 13, 50]) {
    for (const users of [1, 2, 3, 9, 21, 150]) {
      const pricing = calculatePricing({ branches, users });
      const billedCents = buildLineItems(pricing).reduce((sum, i) => sum + i.quantity * Number(i.price.unit_price.amount), 0);
      assert.equal(billedCents, Math.round(pricing.monthlyTotal * 100), `${branches} branches / ${users} users`);
    }
  }
});

test('every price carries a product, as Paddle requires for custom prices', () => {
  delete process.env.PADDLE_PRODUCT_ID;
  const inline = buildLineItems(calculatePricing({ branches: 1, users: 1 }));
  assert.ok(inline.every((i) => i.price.product?.name && i.price.product?.tax_category));
  process.env.PADDLE_PRODUCT_ID = 'pro_123';
  const catalog = buildLineItems(calculatePricing({ branches: 1, users: 1 }));
  assert.ok(catalog.every((i) => i.price.product_id === 'pro_123' && !i.price.product));
  delete process.env.PADDLE_PRODUCT_ID;
});

let tenantId, token;

test('real-mode checkout sends Paddle the exact plan and records the transaction', async () => {
  const signup = await api('POST', '/api/auth/signup', {
    body: { fullName: 'Pay', email: 'paddle-owner@example.com', password: 'OwnerPass123', restaurantName: 'Paddle Cafe', country: 'Egypt', branchCount: 2, userCount: 3 },
  });
  token = signup.body.token;
  tenantId = signup.body.tenant.id;

  process.env.PADDLE_API_KEY = 'test_key';
  const res = await api('POST', '/api/billing/checkout', { token, body: {} });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.mock, false);

  const sent = sentToPaddle.at(-1);
  assert.match(sent.url, /\/transactions$/);
  assert.equal(sent.body.custom_data.tenantId, tenantId);
  const cents = sent.body.items.reduce((s, i) => s + Number(i.price.unit_price.amount), 0);
  assert.equal(cents, 4888, '$48.88 for 2 branches + 3 users');

  const { rows } = await pool.query("SELECT paddle_transaction_id, status FROM subscriptions WHERE tenant_id = $1", [tenantId]);
  assert.equal(rows[0].status, 'pending');
  assert.equal(rows[0].paddle_transaction_id, res.body.transactionId);
});

test('webhooks with a bad, missing or stale signature are refused', async () => {
  const event = { event_type: 'transaction.completed', data: { id: 'txn_1', custom_data: { tenantId } } };
  const body = JSON.stringify(event);
  assert.equal((await webhook(event, { signature: 'ts=1;h1=deadbeef' })).status, 401);
  assert.equal((await webhook(event, { signature: '' })).status, 401);
  const tenMinutesAgo = Math.floor(Date.now() / 1000) - 600;
  assert.equal((await webhook(event, { signature: sign(body, tenMinutesAgo) })).status, 401, 'replayed old webhook');
  assert.equal((await webhook(null, { raw: '{not json', signature: sign('{not json') })).status, 400);

  const { rows } = await pool.query('SELECT status FROM subscriptions WHERE tenant_id = $1', [tenantId]);
  assert.equal(rows[0].status, 'pending', 'nothing was activated');
});

test('a paid transaction activates the plan; the subscription attaches to that checkout', async () => {
  const txn = (await pool.query('SELECT paddle_transaction_id FROM subscriptions WHERE tenant_id = $1', [tenantId])).rows[0].paddle_transaction_id;
  assert.equal((await webhook({ event_type: 'transaction.completed', data: { id: txn, customer_id: 'ctm_1', custom_data: { tenantId } } })).status, 200);
  assert.equal((await webhook({
    event_type: 'subscription.created',
    data: { id: 'sub_old', status: 'active', transaction_id: txn, custom_data: { tenantId }, current_billing_period: { ends_at: '2030-01-01T00:00:00Z' } },
  })).status, 200);

  const { rows } = await pool.query('SELECT status, paddle_subscription_id, current_period_end FROM subscriptions WHERE tenant_id = $1', [tenantId]);
  assert.equal(rows[0].status, 'active');
  assert.equal(rows[0].paddle_subscription_id, 'sub_old');
  const step = (await pool.query('SELECT onboarding_step FROM tenants WHERE id = $1', [tenantId])).rows[0].onboarding_step;
  assert.equal(step, 'onboarding');
});

test('a cancel scheduled for period end stays "canceled" instead of flipping back to active', async () => {
  await webhook({
    event_type: 'subscription.updated',
    data: { id: 'sub_old', status: 'active', custom_data: { tenantId }, scheduled_change: { action: 'cancel', effective_at: '2030-01-01T00:00:00Z' } },
  });
  const { rows } = await pool.query("SELECT status FROM subscriptions WHERE paddle_subscription_id = 'sub_old'");
  assert.equal(rows[0].status, 'canceled');
});

test('events about an old subscription never touch a newer one', async () => {
  // The business resubscribes: a new pending checkout row appears.
  await completeSetupIfNeeded();
  // (after its paid period is over — before that, checkout offers to resume)
  await pool.query("UPDATE subscriptions SET current_period_end = now() - interval '1 day' WHERE paddle_subscription_id = 'sub_old'");
  const checkout = await api('POST', '/api/billing/checkout', { token, body: {} });
  assert.equal(checkout.status, 200, JSON.stringify(checkout.body));
  const newTxn = checkout.body.transactionId;
  await webhook({ event_type: 'transaction.completed', data: { id: newTxn, custom_data: { tenantId } } });
  await webhook({ event_type: 'subscription.created', data: { id: 'sub_new', status: 'active', transaction_id: newTxn, custom_data: { tenantId } } });

  // A late update and the final cancel for the OLD subscription arrive.
  await webhook({ event_type: 'subscription.updated', data: { id: 'sub_old', status: 'active', custom_data: { tenantId }, scheduled_change: { action: 'cancel' } } });
  await webhook({ event_type: 'subscription.canceled', data: { id: 'sub_old', status: 'canceled', custom_data: { tenantId } } });

  const { rows } = await pool.query('SELECT paddle_subscription_id AS id, status FROM subscriptions WHERE tenant_id = $1 ORDER BY created_at', [tenantId]);
  assert.deepEqual(rows.map((r) => [r.id, r.status]), [['sub_old', 'canceled'], ['sub_new', 'active']]);
});

async function completeSetupIfNeeded() {
  const step = (await pool.query('SELECT onboarding_step FROM tenants WHERE id = $1', [tenantId])).rows[0].onboarding_step;
  if (step !== 'complete') {
    const done = await api('POST', '/api/onboarding/complete', { token, body: {} });
    assert.equal(done.status, 200, JSON.stringify(done.body));
  }
}

test('once a canceled plan runs out, new work is blocked but history stays open', async () => {
  // The business from the tests above: its newest live row is active.
  // Cancel it and move the paid period into the past.
  await pool.query("UPDATE subscriptions SET status = 'canceled', current_period_end = now() - interval '1 day' WHERE tenant_id = $1", [tenantId]);
  await completeSetupIfNeeded();

  const me = await api('GET', '/api/auth/me', { token });
  assert.equal(me.body.tenant.plan_ended, true);

  const addStore = await api('POST', '/api/tenants/branches', { token, body: { name: 'New' } });
  assert.equal(addStore.status, 402);
  assert.equal(addStore.body.code, 'plan_ended');
  const newChecklist = await api('POST', '/api/checklists/templates', { token, body: { name: 'X', kind: 'kitchen_daily', itemIds: [] } });
  assert.equal(newChecklist.status, 402);

  // Reading, and shrinking the plan, still work.
  assert.equal((await api('GET', '/api/submissions', { token })).status, 200);
  assert.equal((await api('GET', '/api/tenants/branches', { token })).status, 200);
  assert.equal((await api('PATCH', '/api/tenants/current', { token, body: { branchCount: 2 } })).status, 200);

  // Still inside the paid period: nothing is blocked.
  await pool.query("UPDATE subscriptions SET current_period_end = now() + interval '5 days' WHERE tenant_id = $1", [tenantId]);
  const again = await api('POST', '/api/checklists/templates', { token, body: { name: 'Kitchen', kind: 'kitchen_daily', itemIds: [] } });
  assert.ok([200, 201].includes(again.status), JSON.stringify(again.body));
  assert.equal((await api('GET', '/api/auth/me', { token })).body.tenant.plan_ended, false);
});

test('reopening checkout while a payment is confirming keeps the same transaction, and a paid old one still activates', async () => {
  process.env.PADDLE_API_KEY = 'test_key';
  const s = await api('POST', '/api/auth/signup', {
    body: { fullName: 'R', email: 'race@example.com', password: 'OwnerPass123', restaurantName: 'Race', country: 'Egypt', branchCount: 1, userCount: 1 },
  });
  const t = s.body.token;
  const tid = s.body.tenant.id;

  const first = await api('POST', '/api/billing/checkout', { token: t, body: {} });
  const calls = sentToPaddle.length;
  const again = await api('POST', '/api/billing/checkout', { token: t, body: {} });
  assert.equal(again.body.transactionId, first.body.transactionId, 'same order, same transaction');
  assert.equal(sentToPaddle.length, calls, 'no second transaction was created at Paddle');

  // The plan changes after the first transaction was opened, so the
  // pending row now points at a newer one — but the customer paid the first.
  await pool.query('UPDATE tenants SET user_count = 2 WHERE id = $1', [tid]);
  const repriced = await api('POST', '/api/billing/checkout', { token: t, body: {} });
  assert.notEqual(repriced.body.transactionId, first.body.transactionId);

  const paid = await webhook({ event_type: 'transaction.completed', data: { id: first.body.transactionId, customer_id: 'ctm_r', origin: 'web', custom_data: { tenantId: tid } } });
  assert.equal(paid.status, 200);
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM subscriptions WHERE tenant_id = $1 AND status = 'active'", [tid]);
  assert.equal(rows[0].n, 1, 'the paying customer is active, not stuck pending');
  delete process.env.PADDLE_API_KEY;
});

test('resuming a canceled plan removes the scheduled cancel in Paddle', async () => {
  const signup = await api('POST', '/api/auth/signup', {
    body: { fullName: 'Back', email: 'paddle-resume@example.com', password: 'OwnerPass123', restaurantName: 'Resume Cafe', country: 'Egypt', branchCount: 1, userCount: 1 },
  });
  const tid = signup.body.tenant.id;
  await pool.query(
    `INSERT INTO subscriptions (tenant_id, branch_count, user_count, branch_rate, user_rate, monthly_total, status, paddle_subscription_id, current_period_end)
     VALUES ($1, 1, 1, 10, 10, 20, 'canceled', 'sub_resume', now() + interval '10 days')`,
    [tid]
  );
  process.env.PADDLE_API_KEY = 'test_key';
  const res = await api('POST', '/api/billing/subscription/resume', { token: signup.body.token, body: {} });
  assert.equal(res.status, 200, JSON.stringify(res.body));

  const sent = sentToPaddle.at(-1);
  assert.match(sent.url, /\/subscriptions\/sub_resume$/);
  assert.equal(sent.method, 'PATCH');
  assert.deepEqual(sent.body, { scheduled_change: null });
  assert.equal(res.body.subscription.status, 'active');
});
