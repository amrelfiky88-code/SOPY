import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { resetTestDb, closeDb } from '../test-utils/db.js';
import { startTestServer, makeClient, completeSetup } from '../test-utils/server.js';
import { pool } from '../src/db.js';
import { REFERRAL_REWARD_USD } from '../../shared/referrals.js';

// Referral links and cash-back credit: attribution at signup, reward on
// the referred business's first payment (once), and credit coming off the
// referrer's next payment — in demo mode and through Paddle.

let close, api, realFetch;
const sentToPaddle = [];
const A = {}; // the referrer

async function signup(email, body = {}) {
  const res = await api('POST', '/api/auth/signup', {
    body: { fullName: 'Owner', email, password: 'OwnerPass123', restaurantName: email.split('@')[0], country: 'Egypt', branchCount: 1, userCount: 1, ...body },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return { token: res.body.token, tenantId: res.body.tenant.id };
}

async function pay(token) {
  const checkout = await api('POST', '/api/billing/checkout', { token, body: {} });
  assert.equal(checkout.status, 200, JSON.stringify(checkout.body));
  if (!process.env.PADDLE_API_KEY) {
    const done = await api('POST', '/api/billing/mock-complete', { token, body: {} });
    assert.equal(done.status, 200, JSON.stringify(done.body));
  }
  return checkout.body;
}

const credit = async (token) => (await api('GET', '/api/referrals', { token })).body;

before(async () => {
  await resetTestDb();
  const server = await startTestServer();
  close = server.close;
  api = makeClient(server.baseUrl);
  realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes('api.paddle.com')) {
      const body = init?.body ? JSON.parse(init.body) : null;
      sentToPaddle.push({ url: String(url), method: init?.method, body });
      const id = String(url).endsWith('/discounts') ? `dsc_${sentToPaddle.length}` : `txn_${sentToPaddle.length}`;
      return new Response(JSON.stringify({ data: { id } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return realFetch(url, init);
  };

  Object.assign(A, await signup('ref-a@example.com'));
  await completeSetup(api, A.token);
});

after(async () => {
  globalThis.fetch = realFetch;
  delete process.env.PADDLE_API_KEY;
  await close();
  await closeDb();
});

test('the owner gets a stable, shareable link', async () => {
  const r = await credit(A.token);
  assert.match(r.code, /^[A-HJ-NP-Z2-9]{8}$/);
  assert.equal(r.path, `/get-started?ref=${r.code}`);
  assert.equal(r.rewardAmount, REFERRAL_REWARD_USD);
  assert.equal((await credit(A.token)).code, r.code, 'stable across visits');
  A.code = r.code;
});

test('signing up with the link is remembered, but pays nothing until the business pays', async () => {
  const B = await signup('ref-b@example.com', { referralCode: A.code.toLowerCase() });
  const { rows } = await pool.query('SELECT referred_by_tenant_id FROM tenants WHERE id = $1', [B.tenantId]);
  assert.equal(rows[0].referred_by_tenant_id, A.tenantId, 'case-insensitive code');

  let r = await credit(A.token);
  assert.equal(r.signedUp, 1);
  assert.equal(r.paid, 0);
  assert.equal(r.credit.available, 0);

  await pay(B.token);
  r = await credit(A.token);
  assert.equal(r.paid, 1);
  assert.equal(r.credit.available, REFERRAL_REWARD_USD);
  assert.equal(r.rewards[0].referred_restaurant, 'ref-b');

  // Paying again later (cancel + resubscribe) is not a new referral.
  await completeSetup(api, B.token);
  await api('POST', '/api/billing/subscription/cancel', { token: B.token, body: {} });
  await pay(B.token);
  assert.equal((await credit(A.token)).credit.available, REFERRAL_REWARD_USD, 'rewarded once');
});

test('unknown, malformed or missing codes are ignored, never blocking signup', async () => {
  for (const code of ['NOPENOPE', 'x', '', null, 12345, '<script>']) {
    const res = await api('POST', '/api/auth/signup', {
      body: { fullName: 'X', email: `junk-${Math.random()}@example.com`, password: 'OwnerPass123', restaurantName: 'X', country: 'Egypt', referralCode: code },
    });
    assert.equal(res.status, 201, `code ${JSON.stringify(code)}`);
    const { rows } = await pool.query('SELECT referred_by_tenant_id FROM tenants WHERE id = $1', [res.body.tenant.id]);
    assert.equal(rows[0].referred_by_tenant_id, null);
  }
});

test('credit comes off the next payment, and is only spent once that payment is made', async () => {
  // A's plan is $19/month; give A two more paid referrals → $30 of credit.
  for (const email of ['ref-c@example.com', 'ref-d@example.com']) {
    const t = await signup(email, { referralCode: A.code });
    await pay(t.token);
  }
  assert.equal((await credit(A.token)).credit.available, 3 * REFERRAL_REWARD_USD);

  // A cancels and resubscribes: checkout takes off up to the whole $19.
  await api('POST', '/api/billing/subscription/cancel', { token: A.token, body: {} });
  const checkout = await api('POST', '/api/billing/checkout', { token: A.token, body: {} });
  assert.equal(checkout.body.creditApplied, 19);
  assert.equal(checkout.body.dueToday, 0);
  assert.equal((await credit(A.token)).credit.available, 30, 'not spent until paid');

  await api('POST', '/api/billing/mock-complete', { token: A.token, body: {} });
  const after = (await credit(A.token)).credit;
  assert.equal(after.used, 19);
  assert.equal(after.available, 11, 'the rest carries over');
});

test('only the owner can see the referral section', async () => {
  const signupOwner = await signup('ref-e@example.com', { userCount: 2 });
  await completeSetup(api, signupOwner.token);
  const invite = await api('POST', '/api/tenants/users/invite', { token: signupOwner.token, body: { fullName: 'M', email: 'ref-mgr@example.com', role: 'operations_manager' } });
  const accept = await api('POST', '/api/auth/accept-invite', { body: { inviteToken: invite.body.inviteLink.split('token=')[1], password: 'Password123' } });
  assert.equal((await api('GET', '/api/referrals', { token: accept.body.token })).status, 403);
});

test('with Paddle: credit becomes a one-time discount on the checkout, or on the next renewal', async () => {
  process.env.PADDLE_API_KEY = 'test_key';

  // Checkout with credit: a single-use flat discount is attached.
  const F = await signup('ref-f@example.com');
  await pool.query("INSERT INTO account_credits (tenant_id, amount) VALUES ($1, 5)", [F.tenantId]);
  sentToPaddle.length = 0;
  const co = await api('POST', '/api/billing/checkout', { token: F.token, body: {} });
  assert.equal(co.body.creditApplied, 5);
  const discount = sentToPaddle.find((r) => r.url.endsWith('/discounts'));
  assert.equal(discount.body.amount, '500');
  assert.equal(discount.body.type, 'flat');
  assert.equal(discount.body.usage_limit, 1);
  const txn = sentToPaddle.find((r) => r.url.endsWith('/transactions'));
  assert.match(txn.body.discount_id, /^dsc_/, 'the checkout transaction carries that discount');

  // An active Paddle subscriber whose referral pays: the reward is put on
  // their next renewal straight away.
  const { rows } = await pool.query(
    `INSERT INTO subscriptions (tenant_id, branch_count, user_count, branch_rate, user_rate, monthly_total, status, paddle_subscription_id)
     VALUES ($1, 1, 1, 10, 9, 19, 'active', 'sub_ref') RETURNING id`,
    [F.tenantId]
  );
  await pool.query("UPDATE subscriptions SET status = 'canceled' WHERE tenant_id = $1 AND id <> $2", [F.tenantId, rows[0].id]);
  await pool.query("UPDATE account_credits SET status = 'used' WHERE tenant_id = $1", [F.tenantId]);
  const fCode = (await credit(F.token)).code;
  const G = await signup('ref-g@example.com', { referralCode: fCode });
  const gCheckout = await api('POST', '/api/billing/checkout', { token: G.token, body: {} });
  sentToPaddle.length = 0;
  // Paddle reports G's payment.
  const { grantReferralReward } = await import('../src/credits.js');
  await pool.query("UPDATE subscriptions SET status = 'active' WHERE paddle_transaction_id = $1", [gCheckout.body.transactionId]);
  await grantReferralReward(G.tenantId);

  const patch = sentToPaddle.find((r) => r.url.endsWith('/subscriptions/sub_ref'));
  assert.ok(patch, 'discount attached to the renewal');
  assert.equal(patch.body.discount.effective_from, 'next_billing_period');
  const fCredit = (await credit(F.token)).credit;
  assert.equal(fCredit.scheduled, REFERRAL_REWARD_USD);
  assert.equal(fCredit.available, 0);

  const { renewalPaid } = await import('../src/credits.js');
  await renewalPaid(F.tenantId);
  assert.equal((await credit(F.token)).credit.used, 5 + REFERRAL_REWARD_USD);
  delete process.env.PADDLE_API_KEY;
});

test('the new restaurant gets a welcome discount off its first payment; the referrer is still rewarded', async () => {
  const { REFERRAL_WELCOME_USD } = await import('../../shared/referrals.js');
  const before = (await credit(A.token)).credit.earned;

  const H = await signup('ref-h@example.com', { referralCode: A.code });
  const checkout = await api('POST', '/api/billing/checkout', { token: H.token, body: {} });
  assert.equal(checkout.body.creditApplied, REFERRAL_WELCOME_USD);
  assert.equal(checkout.body.creditKind, 'welcome');
  assert.equal(checkout.body.dueToday, 19 - REFERRAL_WELCOME_USD);

  await api('POST', '/api/billing/mock-complete', { token: H.token, body: {} });
  const hCredit = (await credit(H.token)).credit;
  assert.equal(hCredit.used, REFERRAL_WELCOME_USD);
  assert.equal(hCredit.available, 0, 'the welcome discount is used once');
  assert.equal((await credit(A.token)).credit.earned, before + REFERRAL_REWARD_USD, 'referrer rewarded as before');

  // Resubscribing later: no second welcome discount.
  await completeSetup(api, H.token);
  await api('POST', '/api/billing/subscription/cancel', { token: H.token, body: {} });
  const again = await api('POST', '/api/billing/checkout', { token: H.token, body: {} });
  assert.equal(again.body.creditApplied, 0);
});

test('no referral link, no welcome discount', async () => {
  const plain = await signup('ref-plain@example.com');
  const checkout = await api('POST', '/api/billing/checkout', { token: plain.token, body: {} });
  assert.equal(checkout.body.creditApplied, 0);
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM account_credits WHERE tenant_id = $1', [plain.tenantId]);
  assert.equal(rows[0].n, 0);
});
