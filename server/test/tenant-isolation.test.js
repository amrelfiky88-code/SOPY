import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { resetTestDb, closeDb } from '../test-utils/db.js';
import { startTestServer, makeClient } from '../test-utils/server.js';

let close, api;
let tenantAToken, tenantBToken;

before(async () => {
  await resetTestDb();
  const server = await startTestServer();
  close = server.close;
  api = makeClient(server.baseUrl);

  const a = await api('POST', '/api/auth/signup', {
    body: { fullName: 'Owner A', email: 'ownera@example.com', password: 'PasswordA123', restaurantName: 'Cafe A', country: 'Egypt', branchCount: 1, userCount: 1 },
  });
  tenantAToken = a.body.token;

  const b = await api('POST', '/api/auth/signup', {
    body: { fullName: 'Owner B', email: 'ownerb@example.com', password: 'PasswordB123', restaurantName: 'Cafe B', country: 'United States', branchCount: 1, userCount: 1 },
  });
  tenantBToken = b.body.token;

  // Give tenant A a branch and a checklist template so we have something
  // for tenant B to (fail to) see.
  await api('POST', '/api/tenants/branches', { token: tenantAToken, body: { name: 'A Downtown' } });
});

after(async () => {
  await close();
  await closeDb();
});

test("tenant B cannot see tenant A's branches", async () => {
  const res = await api('GET', '/api/tenants/branches', { token: tenantBToken });
  assert.equal(res.status, 200);
  assert.equal(res.body.branches.length, 0);
});

test("tenant A sees exactly its own branch", async () => {
  const res = await api('GET', '/api/tenants/branches', { token: tenantAToken });
  assert.equal(res.status, 200);
  assert.equal(res.body.branches.length, 1);
  assert.equal(res.body.branches[0].name, 'A Downtown');
});

test("tenant B's user list contains only its own owner", async () => {
  const res = await api('GET', '/api/tenants/users', { token: tenantBToken });
  assert.equal(res.status, 200);
  assert.equal(res.body.users.length, 1);
  assert.equal(res.body.users[0].email, 'ownerb@example.com');
});

test('a tenant cannot patch another tenant\'s branch by guessing its id', async () => {
  const listA = await api('GET', '/api/tenants/branches', { token: tenantAToken });
  const branchId = listA.body.branches[0].id;

  // Tenant B tries to delete tenant A's branch by id.
  const del = await api('DELETE', `/api/tenants/branches/${branchId}`, { token: tenantBToken });
  assert.equal(del.status, 204); // route responds 204 regardless (no row matched tenant_id scope)

  // Tenant A's branch must still be active/untouched.
  const listAAfter = await api('GET', '/api/tenants/branches', { token: tenantAToken });
  assert.equal(listAAfter.body.branches.length, 1);
  assert.equal(listAAfter.body.branches[0].is_active, true);
});
