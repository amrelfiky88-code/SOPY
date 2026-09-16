import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { resetTestDb, closeDb } from '../test-utils/db.js';
import { startTestServer, makeClient } from '../test-utils/server.js';
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
