import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { resetTestDb, closeDb } from '../test-utils/db.js';
import { startTestServer, makeClient } from '../test-utils/server.js';
import { pool } from '../src/db.js';
import { calculatePricing } from '../../shared/pricing.js';

// Paymob (Egypt): checkout creates an intention for the exact EGP amount,
// and only a correctly signed, fully paid result for that amount unlocks
// the business. Paymob's API is stubbed; callbacks are signed the way
// Paymob signs them.

const HMAC_SECRET = 'paymob_test_hmac_secret';
const RATE = 50; // EGP per USD
const FIELDS = ['amount_cents', 'created_at', 'currency', 'error_occured', 'has_parent_transaction', 'id', 'integration_id',
  'is_3d_secure', 'is_auth', 'is_capture', 'is_refunded', 'is_standalone_payment', 'is_voided', 'order.id', 'owner',
  'pending', 'source_data.pan', 'source_data.sub_type', 'source_data.type', 'success'];

let close, api, baseUrl, realFetch;
const intentions = [];
let txnSeq = 1000;

function transaction(intention, overrides = {}) {
  return {
    id: ++txnSeq, amount_cents: intention.amount, created_at: '2026-10-01T10:00:00.000000', currency: 'EGP',
    error_occured: false, has_parent_transaction: false, integration_id: 4242, is_3d_secure: true, is_auth: false,
    is_capture: false, is_refunded: false, is_standalone_payment: true, is_voided: false, owner: 77, pending: false,
    success: true, source_data: { pan: '2346', sub_type: 'MasterCard', type: 'card' },
    order: { id: intention.orderId, merchant_order_id: intention.special_reference },
    ...overrides,
  };
}

const sign = (get) => crypto.createHmac('sha512', HMAC_SECRET).update(FIELDS.map((f) => String(get(f) ?? '')).join('')).digest('hex');
const signNested = (obj) => sign((f) => f.split('.').reduce((v, k) => v?.[k], obj));

function callback(obj, hmac = signNested(obj)) {
  return realFetch(`${baseUrl}/api/billing/paymob/webhook?hmac=${hmac}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'TRANSACTION', obj }),
  });
}

// The browser redirect: the same fields, flat, as Paymob puts them in the address.
function redirectParams(obj) {
  const q = {};
  for (const f of FIELDS) q[f === 'order.id' ? 'order' : f] = String(f.split('.').reduce((v, k) => v?.[k], obj) ?? '');
  q.merchant_order_id = obj.order.merchant_order_id;
  q.hmac = sign((f) => (f === 'order.id' ? q.order : q[f]));
  return q;
}

async function signup(email, extra = {}) {
  const res = await api('POST', '/api/auth/signup', {
    body: { fullName: 'Hoda Kamel', email, password: 'SopyDemo123', restaurantName: 'Koshary Corner', country: 'Egypt', branchCount: 2, userCount: 3, ...extra },
  });
  return { token: res.body.token, tenantId: res.body.tenant.id };
}

before(async () => {
  await resetTestDb();
  const server = await startTestServer();
  close = server.close;
  baseUrl = server.baseUrl;
  api = makeClient(server.baseUrl);
  Object.assign(process.env, {
    PAYMOB_SECRET_KEY: 'egy_sk_test', PAYMOB_PUBLIC_KEY: 'egy_pk_test', PAYMOB_INTEGRATION_IDS: '4242, 5353',
    PAYMOB_HMAC_SECRET: HMAC_SECRET, PAYMOB_EGP_PER_USD: String(RATE),
  });
  realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).startsWith('https://accept.paymob.com/v1/intention/')) {
      const body = JSON.parse(init.body);
      const intention = { ...body, auth: init.headers.Authorization, orderId: 900 + intentions.length, clientSecret: `egy_csk_${intentions.length}` };
      intentions.push(intention);
      return new Response(JSON.stringify({ id: `pi_${intentions.length}`, client_secret: intention.clientSecret, intention_order_id: intention.orderId }), { status: 201 });
    }
    return realFetch(url, init);
  };
});

after(async () => {
  globalThis.fetch = realFetch;
  for (const k of ['PAYMOB_SECRET_KEY', 'PAYMOB_PUBLIC_KEY', 'PAYMOB_INTEGRATION_IDS', 'PAYMOB_HMAC_SECRET', 'PAYMOB_EGP_PER_USD']) delete process.env[k];
  await close();
  await closeDb();
});

let A; // the business paying through Paymob

test('checkout in Egypt asks Paymob for the exact plan price in EGP', async () => {
  A = await signup('hoda@example.com');
  const res = await api('POST', '/api/billing/checkout', { token: A.token, body: { method: 'paymob' } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.provider, 'paymob');
  const total = calculatePricing({ branches: 2, users: 3 }).monthlyTotal;
  const cents = Math.round(total * RATE * 100);
  assert.equal(res.body.paymob.amountEgp, cents / 100);

  const sent = intentions.at(-1);
  assert.equal(sent.amount, cents);
  assert.equal(sent.currency, 'EGP');
  assert.deepEqual(sent.payment_methods, [4242, 5353]);
  assert.equal(sent.items.reduce((s, i) => s + i.amount * i.quantity, 0), cents, 'items add up to the amount');
  assert.equal(sent.auth, 'Token egy_sk_test');
  assert.equal(sent.billing_data.email, 'hoda@example.com');
  assert.equal(sent.billing_data.first_name, 'Hoda');
  assert.match(sent.notification_url, /\/api\/billing\/paymob\/webhook$/);
  assert.match(sent.redirection_url, /\/checkout$/);
  assert.equal(res.body.paymob.checkoutUrl, `https://accept.paymob.com/unifiedcheckout/?publicKey=egy_pk_test&clientSecret=${sent.clientSecret}`);

  // Reopening checkout reuses the same payment rather than starting another.
  const again = await api('POST', '/api/billing/checkout', { token: A.token, body: { method: 'paymob' } });
  assert.equal(again.body.paymob.checkoutUrl, res.body.paymob.checkoutUrl);
  assert.equal(intentions.length, 1);
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM subscriptions WHERE tenant_id = $1 AND status = 'pending'", [A.tenantId]);
  assert.equal(rows[0].n, 1);
});

test('an old unpaid Paymob payment is replaced rather than reused', async () => {
  await pool.query("UPDATE paymob_payments SET created_at = now() - interval '1 hour' WHERE tenant_id = $1", [A.tenantId]);
  const res = await api('POST', '/api/billing/checkout', { token: A.token, body: { method: 'paymob' } });
  assert.equal(intentions.length, 2, 'a fresh payment');
  assert.match(res.body.paymob.checkoutUrl, new RegExp(`clientSecret=${intentions[1].clientSecret}$`));
  // Paying the old one later (its Paymob page was still open) still counts:
  // checked in the next tests through the newest payment, and here by its row.
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM paymob_payments WHERE tenant_id = $1 AND status = 'pending'", [A.tenantId]);
  assert.equal(rows[0].n, 2);
});

test('a forged, failed, wrong-amount or unknown result unlocks nothing', async () => {
  const intention = intentions.at(-1);
  const obj = transaction(intention);
  assert.equal((await callback(obj, 'f'.repeat(128))).status, 401, 'bad signature');
  assert.equal((await callback({ ...obj, amount_cents: 100 }, signNested(obj))).status, 401, 'changed after signing');
  assert.equal((await callback(transaction(intention, { success: false }))).status, 200);
  assert.equal((await callback(transaction(intention, { pending: true }))).status, 200);
  assert.equal((await callback(transaction(intention, { amount_cents: 100 }))).status, 200);
  assert.equal((await callback(transaction(intention, { currency: 'USD' }))).status, 200);
  assert.equal((await callback(transaction(intention, { order: { id: 1, merchant_order_id: 'nope' } }))).status, 200);
  const { rows } = await pool.query("SELECT status FROM subscriptions WHERE tenant_id = $1", [A.tenantId]);
  assert.deepEqual(rows.map((r) => r.status), ['pending']);
  const me = await api('GET', '/api/tenants/current', { token: A.token });
  assert.equal(me.body.tenant.onboarding_step, 'configure_data');
});

test("Paymob's signed result unlocks the business, once", async () => {
  const intention = intentions.at(-1);
  const obj = transaction(intention);
  assert.equal((await callback(obj)).status, 200);
  assert.equal((await callback(obj)).status, 200, 'Paymob retrying is harmless');

  const { rows } = await pool.query('SELECT status, provider, current_period_end, branch_count, user_count FROM subscriptions WHERE tenant_id = $1', [A.tenantId]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'active');
  assert.equal(rows[0].provider, 'paymob');
  const days = (new Date(rows[0].current_period_end) - Date.now()) / 86_400_000;
  assert.ok(days > 29.9 && days < 30.1, `a month paid (${days} days)`);
  const me = await api('GET', '/api/tenants/current', { token: A.token });
  assert.equal(me.body.tenant.onboarding_step, 'onboarding', 'on to setup');
  const paid = await pool.query("SELECT status, paymob_transaction_id FROM paymob_payments WHERE tenant_id = $1 ORDER BY created_at", [A.tenantId]);
  assert.deepEqual(paid.rows, [
    { status: 'pending', paymob_transaction_id: null }, // the one it replaced
    { status: 'paid', paymob_transaction_id: String(obj.id) },
  ]);

  const check = await api('POST', '/api/billing/checkout', { token: A.token, body: { method: 'paymob' } });
  assert.equal(check.body.alreadyActive, true, 'no second checkout');
  assert.equal((await api('POST', '/api/onboarding/complete', { token: A.token, body: {} })).status, 200);
});

test('the result the browser brings back also counts, for its own business only', async () => {
  const B = await signup('nour@example.com');
  await api('POST', '/api/billing/checkout', { token: B.token, body: { method: 'paymob' } });
  const params = redirectParams(transaction(intentions.at(-1)));

  const forged = await api('POST', '/api/billing/paymob/return', { token: B.token, body: { ...params, amount_cents: '1' } });
  assert.equal(forged.status, 400);
  const other = await api('POST', '/api/billing/paymob/return', { token: A.token, body: params });
  assert.equal(other.body.applied, false, "another business can't claim it");

  const ok = await api('POST', '/api/billing/paymob/return', { token: B.token, body: params });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.deepEqual(ok.body, { paid: true, applied: true });
  const { rows } = await pool.query("SELECT status FROM subscriptions WHERE tenant_id = $1", [B.tenantId]);
  assert.deepEqual(rows.map((r) => r.status), ['active']);

  const failed = redirectParams(transaction(intentions.at(-1), { success: false }));
  assert.deepEqual((await api('POST', '/api/billing/paymob/return', { token: B.token, body: failed })).body, { paid: false, applied: false });
});

test('paying for the next month adds a month after the one already paid', async () => {
  const before = (await pool.query("SELECT id, current_period_end, monthly_total FROM subscriptions WHERE tenant_id = $1", [A.tenantId])).rows[0];
  const sub = await api('GET', '/api/billing/subscription', { token: A.token });
  assert.equal(sub.body.subscription.paymob.renewalEgp, Math.round(Number(before.monthly_total) * RATE * 100) / 100);

  const renew = await api('POST', '/api/billing/paymob/renew', { token: A.token, body: {} });
  assert.equal(renew.status, 200, JSON.stringify(renew.body));
  const intention = intentions.at(-1);
  assert.equal(intention.amount, Math.round(Number(before.monthly_total) * RATE * 100));
  assert.match(intention.redirection_url, /\/app\/account$/);
  await callback(transaction(intention));
  await callback(transaction(intention));

  const afterRow = (await pool.query('SELECT current_period_end FROM subscriptions WHERE id = $1', [before.id])).rows[0];
  const added = (new Date(afterRow.current_period_end) - new Date(before.current_period_end)) / 86_400_000;
  assert.ok(Math.abs(added - 30) < 0.1, `30 days added once (${added})`);
});

test('a bigger Paymob plan is paid for before it applies; a smaller one applies at once', async () => {
  await pool.query("UPDATE subscriptions SET current_period_end = now() + interval '15 days' WHERE tenant_id = $1", [A.tenantId]);
  const before = (await pool.query("SELECT monthly_total FROM subscriptions WHERE tenant_id = $1", [A.tenantId])).rows[0];
  const bigger = calculatePricing({ branches: 4, users: 3 });

  const up = await api('PATCH', '/api/billing/subscription/quantities', { token: A.token, body: { branchCount: 4, userCount: 3 } });
  assert.equal(up.status, 200, JSON.stringify(up.body));
  assert.equal(up.body.paymentRequired, true);
  const expectedUsd = Math.round((bigger.monthlyTotal - Number(before.monthly_total)) * 0.5 * 100) / 100;
  const intention = intentions.at(-1);
  assert.ok(Math.abs(intention.amount - Math.round(expectedUsd * RATE * 100)) <= RATE, `about half a month's difference (${intention.amount})`);
  let { rows } = await pool.query('SELECT t.branch_count AS t, s.branch_count AS s FROM tenants t JOIN subscriptions s ON s.tenant_id = t.id WHERE t.id = $1', [A.tenantId]);
  assert.deepEqual(rows[0], { t: 2, s: 2 }, 'not before it is paid');
  assert.equal((await api('POST', '/api/tenants/branches', { token: A.token, body: { name: 'One' } })).status, 201);
  assert.equal((await api('POST', '/api/tenants/branches', { token: A.token, body: { name: 'Two' } })).status, 201);
  assert.equal((await api('POST', '/api/tenants/branches', { token: A.token, body: { name: 'Three' } })).status, 409);

  await callback(transaction(intention));
  ({ rows } = await pool.query('SELECT t.branch_count AS t, s.branch_count AS s, s.monthly_total FROM tenants t JOIN subscriptions s ON s.tenant_id = t.id WHERE t.id = $1', [A.tenantId]));
  assert.equal(rows[0].t, 4);
  assert.equal(rows[0].s, 4);
  assert.equal(Number(rows[0].monthly_total), bigger.monthlyTotal);
  assert.equal((await api('POST', '/api/tenants/branches', { token: A.token, body: { name: 'Three' } })).status, 201);

  const down = await api('PATCH', '/api/billing/subscription/quantities', { token: A.token, body: { branchCount: 3, userCount: 3 } });
  assert.equal(down.status, 200);
  assert.equal(down.body.subscription.branch_count, 3);
  assert.equal(down.body.paymentRequired, undefined);
});

test('growing a plan paid months ahead charges the difference for all of that time', async () => {
  await pool.query("UPDATE subscriptions SET current_period_end = now() + interval '75 days' WHERE tenant_id = $1", [A.tenantId]);
  const now = (await pool.query('SELECT branch_count, user_count, monthly_total FROM subscriptions WHERE tenant_id = $1', [A.tenantId])).rows[0];
  const bigger = calculatePricing({ branches: now.branch_count + 2, users: now.user_count });
  const up = await api('PATCH', '/api/billing/subscription/quantities', { token: A.token, body: { branchCount: now.branch_count + 2, userCount: now.user_count } });
  assert.equal(up.body.paymentRequired, true);
  const expected = Math.round((bigger.monthlyTotal - Number(now.monthly_total)) * 2.5 * RATE * 100);
  assert.ok(Math.abs(intentions.at(-1).amount - expected) <= expected * 0.01, `two and a half months' difference (${intentions.at(-1).amount} vs ${expected})`);
});

test('a Paymob month left unpaid ends the plan after a few days of grace', async () => {
  await pool.query("UPDATE subscriptions SET current_period_end = now() - interval '2 days' WHERE tenant_id = $1", [A.tenantId]);
  assert.equal((await api('GET', '/api/auth/me', { token: A.token })).body.tenant.plan_ended, false, 'still in the grace days');
  await pool.query("UPDATE subscriptions SET current_period_end = now() - interval '4 days' WHERE tenant_id = $1", [A.tenantId]);
  assert.equal((await api('GET', '/api/auth/me', { token: A.token })).body.tenant.plan_ended, true);
  assert.equal((await api('POST', '/api/tenants/branches', { token: A.token, body: { name: 'Four' } })).status, 402);

  // Paying for a month brings it back, counted from today.
  const renew = await api('POST', '/api/billing/paymob/renew', { token: A.token, body: {} });
  assert.equal(renew.status, 200);
  await callback(transaction(intentions.at(-1)));
  assert.equal((await api('GET', '/api/auth/me', { token: A.token })).body.tenant.plan_ended, false);
  const { rows } = await pool.query('SELECT current_period_end FROM subscriptions WHERE tenant_id = $1', [A.tenantId]);
  const days = (new Date(rows[0].current_period_end) - Date.now()) / 86_400_000;
  assert.ok(days > 29.9 && days < 30.1, `a month from today (${days})`);
});

test('a referral discount comes off the Paymob payment and is spent only when paid', async () => {
  const code = (await api('GET', '/api/referrals', { token: A.token })).body.code;
  const C = await signup('salma@example.com', { referralCode: code });
  const res = await api('POST', '/api/billing/checkout', { token: C.token, body: { method: 'paymob' } });
  assert.ok(res.body.creditApplied > 0);
  assert.equal(intentions.at(-1).amount, Math.round(res.body.dueToday * RATE * 100));
  let credit = await pool.query("SELECT status FROM account_credits WHERE tenant_id = $1", [C.tenantId]);
  assert.deepEqual(credit.rows.map((r) => r.status), ['available'], 'not spent on an unpaid checkout');
  await callback(transaction(intentions.at(-1)));
  credit = await pool.query("SELECT status FROM account_credits WHERE tenant_id = $1", [C.tenantId]);
  assert.deepEqual(credit.rows.map((r) => r.status), ['used']);
  const reward = await pool.query("SELECT count(*)::int AS n FROM account_credits WHERE tenant_id = $1 AND source = 'referral'", [A.tenantId]);
  assert.equal(reward.rows[0].n, 1, 'the referrer is rewarded');
});

test('outside Egypt, or without Paymob set up, checkout is the card checkout', async () => {
  const D = await signup('dina@example.com');
  const card = await api('POST', '/api/billing/checkout', { token: D.token, body: { method: 'card' } });
  assert.equal(card.status, 200);
  assert.equal(card.body.provider, undefined);
  assert.ok(card.body.transactionId);

  const saved = process.env.PAYMOB_SECRET_KEY;
  delete process.env.PAYMOB_SECRET_KEY;
  try {
    const noPaymob = await api('POST', '/api/billing/checkout', { token: D.token, body: { method: 'paymob' } });
    assert.equal(noPaymob.status, 200);
    assert.ok(noPaymob.body.transactionId);
    assert.equal((await callback(transaction(intentions.at(-1)))).status, 503);
  } finally {
    process.env.PAYMOB_SECRET_KEY = saved;
  }

  // Switching an unpaid Paymob checkout to card: the row is a Paddle one again.
  await api('POST', '/api/billing/checkout', { token: D.token, body: { method: 'paymob' } });
  await api('POST', '/api/billing/checkout', { token: D.token, body: { method: 'card' } });
  const { rows } = await pool.query("SELECT provider FROM subscriptions WHERE tenant_id = $1 AND status = 'pending'", [D.tenantId]);
  assert.deepEqual(rows.map((r) => r.provider), ['paddle']);
});
