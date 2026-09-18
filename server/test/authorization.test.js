import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { resetTestDb, closeDb } from '../test-utils/db.js';
import { startTestServer, makeClient, completeSetup } from '../test-utils/server.js';

let close, api, ownerToken, storeManagerToken;

before(async () => {
  await resetTestDb();
  const server = await startTestServer();
  close = server.close;
  api = makeClient(server.baseUrl);

  const signup = await api('POST', '/api/auth/signup', {
    body: { fullName: 'Amina', email: 'amina@example.com', password: 'SopyDemo123', restaurantName: 'The Nile Bistro', country: 'Egypt', branchCount: 1, userCount: 2 },
  });
  ownerToken = signup.body.token;
  await completeSetup(api, ownerToken);

  const invite = await api('POST', '/api/tenants/users/invite', {
    token: ownerToken,
    body: { fullName: 'Karim Adel', email: 'karim@example.com', role: 'store_manager' },
  });
  const accept = await api('POST', '/api/auth/accept-invite', {
    body: { inviteToken: invite.body.inviteLink.split('token=')[1], password: 'KarimPass123' },
  });
  storeManagerToken = accept.body.token;
});

after(async () => {
  await close();
  await closeDb();
});

test('a store manager cannot create an arbitrary custom checklist template', async () => {
  const res = await api('POST', '/api/checklists/templates', {
    token: storeManagerToken,
    body: { name: 'Should be blocked', itemIds: [] },
  });
  assert.equal(res.status, 403);
});

// Regression test for a real bug: the Kitchen/Bar daily report pages
// auto-create their template on first use via this same endpoint. The
// original code gated ALL template creation behind requireRole(owner,
// ops_manager), which meant a store manager or employee got a 403 the
// very first time they ever opened a daily report — before a manager had
// happened to open it first. Built-in kinds are now exempt from the role
// gate; only genuinely custom checklists require manager access.
test('a store manager CAN auto-provision the built-in kitchen_daily template', async () => {
  const res = await api('POST', '/api/checklists/templates', {
    token: storeManagerToken,
    body: { name: 'Kitchen Daily Operation Report', kind: 'kitchen_daily', frequency: 'daily', itemIds: [] },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.template.kind, 'kitchen_daily');
});

test('a store manager CAN auto-provision the built-in bar_daily template', async () => {
  const res = await api('POST', '/api/checklists/templates', {
    token: storeManagerToken,
    body: { name: 'Bar & Beverage Daily Operation Report', kind: 'bar_daily', frequency: 'daily', itemIds: [] },
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.template.kind, 'bar_daily');
});

test('an owner CAN create an arbitrary custom checklist template', async () => {
  const res = await api('POST', '/api/checklists/templates', {
    token: ownerToken,
    body: { name: 'Opening Checklist', itemIds: [] },
  });
  assert.equal(res.status, 201);
});

test('the checklist builder library is only reachable after onboarding completes', async () => {
  // Second tenant that has NOT completed onboarding yet.
  const signup2 = await api('POST', '/api/auth/signup', {
    body: { fullName: 'Owner B', email: 'ownerb@example.com', password: 'PasswordB123', restaurantName: 'Cafe B', country: 'United States', branchCount: 1, userCount: 1 },
  });
  const res = await api('GET', '/api/checklists/library', { token: signup2.body.token });
  assert.equal(res.status, 403);
});
