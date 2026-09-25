import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { resetTestDb, closeDb } from '../test-utils/db.js';
import { startTestServer, makeClient, completeSetup } from '../test-utils/server.js';
import { pool } from '../src/db.js';
import { calculatePricing } from '../../shared/pricing.js';

let close, api, token, tenantId;

before(async () => {
  await resetTestDb();
  const server = await startTestServer();
  close = server.close;
  api = makeClient(server.baseUrl);

  const signup = await api('POST', '/api/auth/signup', {
    body: { fullName: 'Amina', email: 'amina@example.com', password: 'SopyDemo123', restaurantName: 'The Nile Bistro', country: 'Egypt', branchCount: 3, userCount: 8 },
  });
  token = signup.body.token;
  tenantId = signup.body.tenant.id;
});

after(async () => {
  await close();
  await closeDb();
});

// Regression test for a real bug: calling /checkout twice (React
// StrictMode double-invoking an effect, a refresh, back/forward nav)
// used to insert a second 'pending' subscription row and leak a second
// mock Paddle transaction. It should now reuse the existing pending row.
test('calling /billing/checkout twice does not create duplicate pending subscriptions', async () => {
  const first = await api('POST', '/api/billing/checkout', { token, body: {} });
  assert.equal(first.status, 200);
  const second = await api('POST', '/api/billing/checkout', { token, body: {} });
  assert.equal(second.status, 200);

  const { rows } = await pool.query("SELECT * FROM subscriptions WHERE tenant_id = $1 AND status = 'pending'", [tenantId]);
  assert.equal(rows.length, 1, 'expected exactly one pending subscription row after two /checkout calls');
});

// Regression test for a real bug: the mock-complete handler used
// `UPDATE ... WHERE ... ORDER BY ... LIMIT 1`, which is invalid SQL and
// crashed the server (Postgres doesn't allow ORDER BY/LIMIT directly on
// an UPDATE). It must go through a subquery instead.
test('mock-complete activates the pending subscription and advances onboarding', async () => {
  const res = await api('POST', '/api/billing/mock-complete', { token, body: {} });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.subscription.status, 'active');

  const tenant = await api('GET', '/api/tenants/current', { token });
  assert.equal(tenant.body.tenant.onboarding_step, 'onboarding');
});

test('subscription quantity change recalculates monthly_total via the shared pricing formula', async () => {
  const patch = await api('PATCH', '/api/billing/subscription/quantities', { token, body: { branchCount: 5, userCount: 12 } });
  assert.equal(patch.status, 200, JSON.stringify(patch.body));

  const expected = calculatePricing({ branches: 5, users: 12 });
  assert.equal(Number(patch.body.subscription.monthly_total), expected.monthlyTotal);
  assert.equal(patch.body.subscription.branch_count, 5);
  assert.equal(patch.body.subscription.user_count, 12);

  const tenant = await api('GET', '/api/tenants/current', { token });
  assert.equal(tenant.body.tenant.branch_count, 5);
  assert.equal(tenant.body.tenant.user_count, 12);
});

// Regression test for a real bug found by walking the funnel in a
// browser: re-opening /checkout after paying (back button, bookmark,
// refresh) inserted a NEW 'pending' subscription row. Because
// GET /subscription returns the newest row, that pending row masked the
// customer's active subscription — and with real Paddle keys it would
// also mint a second transaction they could pay twice.
test('checkout on an already-active subscription does not create a second pending row', async () => {
  const before = await api('GET', '/api/billing/subscription', { token });
  assert.equal(before.body.subscription.status, 'active', 'precondition: tenant already paid');

  const res = await api('POST', '/api/billing/checkout', { token, body: {} });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.alreadyActive, true);
  assert.equal(res.body.transactionId, undefined, 'must not mint a payable transaction');

  const { rows } = await pool.query("SELECT * FROM subscriptions WHERE tenant_id = $1 AND status = 'pending'", [tenantId]);
  assert.equal(rows.length, 0, 'expected no pending rows for a tenant that already paid');

  const after = await api('GET', '/api/billing/subscription', { token });
  assert.equal(after.body.subscription.status, 'active', 'active subscription must not be masked by a pending row');
});

// A plan of 0 branches and 0 users prices out at $0.00 on the tapered
// schedule, so checkout has to refuse it rather than provision a free
// account. The Pricing page clamps too, but the server owns this rule.
test('checkout refuses a plan with no branches or no users', async () => {
  const signup = await api('POST', '/api/auth/signup', {
    body: { fullName: 'Zero', email: 'zero@example.com', password: 'ZeroPlan123', restaurantName: 'Zero Cafe', country: 'Egypt', branchCount: 1, userCount: 1 },
  });
  const zeroToken = signup.body.token;

  await pool.query('UPDATE tenants SET branch_count = 0, user_count = 0 WHERE id = $1', [signup.body.tenant.id]);

  const res = await api('POST', '/api/billing/checkout', { token: zeroToken, body: {} });
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.match(res.body.error, /at least 1 branch and 1 user/);
});

// PATCH /tenants/current used to store whatever Number() produced, so a
// hand-rolled request could set a negative count (priced as $0.00) or
// NaN (which the integer column rejects with a 500).
test('tenant PATCH clamps out-of-range plan counts instead of storing them', async () => {
  const res = await api('PATCH', '/api/tenants/current', { token, body: { branchCount: -5, userCount: 99999 } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.tenant.branch_count, 1, 'negative branch count should clamp up to the minimum');
  assert.equal(res.body.tenant.user_count, 2000, 'oversized user count should clamp down to the maximum');

  const bad = await api('PATCH', '/api/tenants/current', { token, body: { branchCount: 'abc' } });
  assert.equal(bad.status, 400);
});

test('only a business_owner can start checkout', async () => {
  const invite = await api('POST', '/api/tenants/users/invite', {
    token,
    body: { fullName: 'Karim Adel', email: 'karim@example.com', role: 'store_manager' },
  });
  assert.equal(invite.status, 201);

  const accept = await api('POST', '/api/auth/accept-invite', {
    body: { inviteToken: invite.body.inviteLink.split('token=')[1], password: 'KarimPass123' },
  });
  const karimToken = accept.body.token;

  const res = await api('POST', '/api/billing/checkout', { token: karimToken, body: {} });
  assert.equal(res.status, 403);
});

// Regression: completing a payment always set onboarding_step back to
// 'onboarding', so a business that had finished setup and subscribed
// (again) from the Account page was thrown back into the setup wizard.
test('subscribing again after cancelling keeps the business out of the wizard', async () => {
  const other = await api('POST', '/api/auth/signup', {
    body: { fullName: 'Resub', email: 'resub@example.com', password: 'SopyDemo123', restaurantName: 'Resub Cafe', country: 'Egypt', branchCount: 1, userCount: 1 },
  });
  const t = other.body.token;
  await completeSetup(api, t);
  assert.equal((await api('POST', '/api/billing/subscription/cancel', { token: t, body: {} })).status, 204);

  // "Change plan" from the Pricing page must not push a paid business back into checkout.
  const repriced = await api('PATCH', '/api/tenants/current', { token: t, body: { branchCount: 2, userCount: 3, onboardingStep: 'checkout' } });
  assert.equal(repriced.status, 200);
  assert.equal(repriced.body.tenant.onboarding_step, 'complete');
  assert.equal(repriced.body.tenant.branch_count, 2);

  // The paid month has run out, so it's a new checkout rather than a resume.
  await pool.query("UPDATE subscriptions SET current_period_end = now() - interval '1 day' WHERE tenant_id = $1", [other.body.tenant.id]);
  const checkout = await api('POST', '/api/billing/checkout', { token: t, body: {} });
  assert.equal(checkout.status, 200);
  assert.ok(checkout.body.transactionId);
  const done = await api('POST', '/api/billing/mock-complete', { token: t, body: {} });
  assert.equal(done.status, 200);
  assert.equal(done.body.subscription.status, 'active');

  const { rows } = await pool.query('SELECT onboarding_step FROM tenants WHERE id = $1', [other.body.tenant.id]);
  assert.equal(rows[0].onboarding_step, 'complete');

  // Nothing pending any more: a stray second call is refused, not a silent no-op.
  const again = await api('POST', '/api/billing/mock-complete', { token: t, body: {} });
  assert.equal(again.status, 409);
});

// Security: both of these used to let a brand-new signup into the app
// without paying.
test('an unpaid signup cannot skip checkout', async () => {
  const fresh = await api('POST', '/api/auth/signup', {
    body: { fullName: 'Free', email: 'free-rider@example.com', password: 'SopyDemo123', restaurantName: 'Free Cafe', country: 'Egypt', branchCount: 1, userCount: 1 },
  });
  const t = fresh.body.token;

  const complete = await api('POST', '/api/onboarding/complete', { token: t, body: {} });
  assert.equal(complete.status, 403);

  const patched = await api('PATCH', '/api/tenants/current', { token: t, body: { onboardingStep: 'complete' } });
  assert.equal(patched.status, 400);

  const { rows } = await pool.query('SELECT onboarding_step FROM tenants WHERE id = $1', [fresh.body.tenant.id]);
  assert.equal(rows[0].onboarding_step, 'configure_data');

  // The normal forward steps still work.
  const toPricing = await api('PATCH', '/api/tenants/current', { token: t, body: { onboardingStep: 'pricing' } });
  assert.equal(toPricing.body.tenant.onboarding_step, 'pricing');
});

// Regression: after canceling, "Subscribe again" went through checkout and
// charged a whole new month while the paid one still had weeks to run.
test('changing your mind before the paid period ends resumes the plan without a new charge', async () => {
  const other = await api('POST', '/api/auth/signup', {
    body: { fullName: 'Undo', email: 'undo-cancel@example.com', password: 'SopyDemo123', restaurantName: 'Undo Cafe', country: 'Egypt', branchCount: 1, userCount: 2 },
  });
  const t = other.body.token;
  const tid = other.body.tenant.id;
  await completeSetup(api, t);
  assert.equal((await api('POST', '/api/billing/subscription/cancel', { token: t, body: {} })).status, 204);

  // Opening checkout offers to keep the plan and starts no new payment...
  const checkout = await api('POST', '/api/billing/checkout', { token: t, body: {} });
  assert.equal(checkout.body.canResume, true);
  assert.equal(checkout.body.transactionId, undefined);
  // ...and a stray unpaid checkout doesn't hide the paid plan on Account.
  await pool.query(
    "INSERT INTO subscriptions (tenant_id, branch_count, user_count, branch_rate, user_rate, monthly_total, status) VALUES ($1, 1, 2, 10, 9, 28, 'pending')",
    [tid]
  );
  assert.equal((await api('GET', '/api/billing/subscription', { token: t })).body.subscription.status, 'canceled');

  const resumed = await api('POST', '/api/billing/subscription/resume', { token: t, body: {} });
  assert.equal(resumed.status, 200, JSON.stringify(resumed.body));
  assert.equal(resumed.body.subscription.status, 'active');
  const { rows } = await pool.query('SELECT status FROM subscriptions WHERE tenant_id = $1', [tid]);
  assert.deepEqual(rows.map((r) => r.status), ['active'], 'no second subscription was started');

  // Nothing to resume while it's active; once the period is over, it's checkout.
  assert.equal((await api('POST', '/api/billing/subscription/resume', { token: t, body: {} })).status, 409);
  await pool.query("UPDATE subscriptions SET status = 'canceled', current_period_end = now() - interval '1 day' WHERE tenant_id = $1", [tid]);
  const late = await api('POST', '/api/billing/subscription/resume', { token: t, body: {}, headers: { 'Accept-Language': 'fr' } });
  assert.equal(late.status, 409);
  assert.match(late.body.error, /abonnez-vous/);
});
