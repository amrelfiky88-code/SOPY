import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { resetTestDb, closeDb } from '../test-utils/db.js';
import { startTestServer, makeClient } from '../test-utils/server.js';
import { pool } from '../src/db.js';

let close, api;
const A = {}; // tenant A: owner + ops manager + area manager + employee
const B = {}; // tenant B: owner + employee

async function signup(email, restaurantName) {
  const res = await api('POST', '/api/auth/signup', {
    body: { fullName: 'Owner', email, password: 'OwnerPass123', restaurantName, country: 'Egypt', branchCount: 1, userCount: 5 },
  });
  return { token: res.body.token, userId: res.body.user.id, tenantId: res.body.tenant.id };
}

async function inviteAndAccept(ownerToken, email, role, extra = {}) {
  const invite = await api('POST', '/api/tenants/users/invite', { token: ownerToken, body: { fullName: email, email, role, ...extra } });
  assert.equal(invite.status, 201, JSON.stringify(invite.body));
  const accept = await api('POST', '/api/auth/accept-invite', {
    body: { inviteToken: invite.body.inviteLink.split('token=')[1], password: 'Password123' },
  });
  return { token: accept.body.token, userId: accept.body.user.id };
}

before(async () => {
  await resetTestDb();
  const server = await startTestServer();
  close = server.close;
  api = makeClient(server.baseUrl);

  Object.assign(A, await signup('owner-a@example.com', 'Tenant A'));
  A.ops = await inviteAndAccept(A.token, 'ops-a@example.com', 'operations_manager');
  A.area = await inviteAndAccept(A.token, 'area-a@example.com', 'area_manager');
  A.emp = await inviteAndAccept(A.token, 'emp-a@example.com', 'employee');

  Object.assign(B, await signup('owner-b@example.com', 'Tenant B'));
  B.branch = (await api('POST', '/api/tenants/branches', { token: B.token, body: { name: 'B Store' } })).body.branch;
  B.emp = await inviteAndAccept(B.token, 'emp-b@example.com', 'employee', { branchIds: [B.branch.id] });
});

after(async () => {
  await close();
  await closeDb();
});

// --- Privilege escalation -------------------------------------------

test('an area manager cannot promote themselves', async () => {
  const res = await api('PATCH', `/api/tenants/users/${A.area.userId}`, { token: A.area.token, body: { role: 'business_owner' } });
  assert.equal(res.status, 403);
  const { rows } = await pool.query('SELECT role FROM users WHERE id = $1', [A.area.userId]);
  assert.equal(rows[0].role, 'area_manager');
});

test('an area manager cannot promote someone above their own role', async () => {
  for (const role of ['business_owner', 'operations_manager', 'area_manager']) {
    const res = await api('PATCH', `/api/tenants/users/${A.emp.userId}`, { token: A.area.token, body: { role } });
    assert.equal(res.status, 403, `area manager assigning ${role} should be refused`);
  }
  const ok = await api('PATCH', `/api/tenants/users/${A.emp.userId}`, { token: A.area.token, body: { role: 'store_manager' } });
  assert.equal(ok.status, 200, 'a role below their own is fine');
  await api('PATCH', `/api/tenants/users/${A.emp.userId}`, { token: A.token, body: { role: 'employee' } });
});

test('nobody can demote the business owner, including the owner themselves', async () => {
  const byOps = await api('PATCH', `/api/tenants/users/${A.userId}`, { token: A.ops.token, body: { role: 'employee' } });
  assert.equal(byOps.status, 403);
  const bySelf = await api('PATCH', `/api/tenants/users/${A.userId}`, { token: A.token, body: { role: 'employee' } });
  assert.equal(bySelf.status, 403);
  const { rows } = await pool.query('SELECT role FROM users WHERE id = $1', [A.userId]);
  assert.equal(rows[0].role, 'business_owner', 'the business must never be left without an owner');
});

test('no one can make a second business owner, by edit or by invite', async () => {
  const edit = await api('PATCH', `/api/tenants/users/${A.ops.userId}`, { token: A.token, body: { role: 'business_owner' } });
  assert.equal(edit.status, 403);
  const invite = await api('POST', '/api/tenants/users/invite', { token: A.token, body: { fullName: 'X', email: 'x-owner@example.com', role: 'business_owner' } });
  assert.equal(invite.status, 403);
});

test('an area manager cannot invite someone to a role at or above their own', async () => {
  const res = await api('POST', '/api/tenants/users/invite', {
    token: A.area.token, body: { fullName: 'Y', email: 'y@example.com', role: 'operations_manager' },
  });
  assert.equal(res.status, 403);
});

// --- Input validation (these used to 500) ----------------------------

test('an unknown role or status is a 400, not a server error', async () => {
  const badRole = await api('PATCH', `/api/tenants/users/${A.emp.userId}`, { token: A.token, body: { role: 'superuser' } });
  assert.equal(badRole.status, 400);
  const badStatus = await api('PATCH', `/api/tenants/users/${A.emp.userId}`, { token: A.token, body: { status: 'invited' } });
  assert.equal(badStatus.status, 400, "'invited' is only set by the invite flow");
  const badInvite = await api('POST', '/api/tenants/users/invite', { token: A.token, body: { fullName: 'Z', email: 'z@example.com', role: 'superuser' } });
  assert.equal(badInvite.status, 400);
});

// --- Data exposure --------------------------------------------------

test('editing a user never returns their password hash or invite token', async () => {
  const res = await api('PATCH', `/api/tenants/users/${A.emp.userId}`, { token: A.token, body: { role: 'store_manager' } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.user.role, 'store_manager');
  assert.equal(res.body.user.access_level, undefined, 'access levels are gone; roles decide');
  assert.equal(res.body.user.password_hash, undefined);
  assert.equal(res.body.user.invite_token, undefined);
});

// --- Tenant isolation ------------------------------------------------

test("a manager cannot touch another tenant's user, including their store assignments", async () => {
  const res = await api('PATCH', `/api/tenants/users/${B.emp.userId}`, {
    token: A.token, body: { role: 'store_manager', branchIds: [] },
  });
  assert.equal(res.status, 404);

  const { rows: user } = await pool.query('SELECT role FROM users WHERE id = $1', [B.emp.userId]);
  assert.equal(user[0].role, 'employee');
  const { rows: links } = await pool.query('SELECT branch_id FROM user_branches WHERE user_id = $1', [B.emp.userId]);
  assert.equal(links.length, 1, "tenant B's store assignment must survive the attempt");
});

test("a user cannot be linked to another tenant's store", async () => {
  const edit = await api('PATCH', `/api/tenants/users/${A.emp.userId}`, { token: A.token, body: { branchIds: [B.branch.id] } });
  assert.equal(edit.status, 400);
  const invite = await api('POST', '/api/tenants/users/invite', {
    token: A.token, body: { fullName: 'W', email: 'w@example.com', role: 'employee', branchIds: [B.branch.id] },
  });
  assert.equal(invite.status, 400);
});

test('a store list that is not a list is refused, not a server error', async () => {
  for (const branchIds of ['x', 7, { a: 1 }, true]) {
    const invite = await api('POST', '/api/tenants/users/invite', {
      token: A.token, body: { fullName: 'Shape', email: 'shape@example.com', role: 'employee', branchIds },
    });
    assert.equal(invite.status, 400, `invite with branchIds ${JSON.stringify(branchIds)}: ${JSON.stringify(invite.body)}`);
    const edit = await api('PATCH', `/api/tenants/users/${A.emp.userId}`, { token: A.token, body: { branchIds } });
    assert.equal(edit.status, 400, `edit with branchIds ${JSON.stringify(branchIds)}: ${JSON.stringify(edit.body)}`);
  }
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM users WHERE email = 'shape@example.com'");
  assert.equal(rows[0].n, 0);
});

// --- Branch removal --------------------------------------------------

test('a removed store disappears from the store list', async () => {
  const created = await api('POST', '/api/tenants/branches', { token: A.token, body: { name: 'Temporary' } });
  const before = await api('GET', '/api/tenants/branches', { token: A.token });
  assert.ok(before.body.branches.some((b) => b.id === created.body.branch.id));

  const del = await api('DELETE', `/api/tenants/branches/${created.body.branch.id}`, { token: A.token });
  assert.equal(del.status, 204);

  const after = await api('GET', '/api/tenants/branches', { token: A.token });
  assert.ok(!after.body.branches.some((b) => b.id === created.body.branch.id), 'soft-deleted store must not be listed');

  // The row is kept (soft delete) so historical submissions keep their store.
  const { rows } = await pool.query('SELECT is_active FROM branches WHERE id = $1', [created.body.branch.id]);
  assert.equal(rows[0].is_active, false);
});

// The manager sets a job title when inviting (QC visit reports find
// inspectors by the QAQC title); before, only the person could set it.
test('an invite can carry a job title', async () => {
  const tooLong = await api('POST', '/api/tenants/users/invite', {
    token: B.token, body: { fullName: 'Q', email: 'q-long@example.com', role: 'employee', title: 'x'.repeat(121) },
  });
  assert.equal(tooLong.status, 400);

  const invite = await api('POST', '/api/tenants/users/invite', {
    token: B.token, body: { fullName: 'Quality Person', email: 'qaqc-b@example.com', role: 'employee', title: '  QAQC ' },
  });
  assert.equal(invite.status, 201, JSON.stringify(invite.body));
  assert.equal(invite.body.user.title, 'QAQC');
  const { users } = (await api('GET', '/api/tenants/users', { token: B.token })).body;
  assert.equal(users.find((u) => u.email === 'qaqc-b@example.com').title, 'QAQC');
});

// Staff fill in the daily reports and pick names from the team, but the
// full staff list (emails, phones) stays with managers.
test('staff can list their colleagues\' names, and nothing more', async () => {
  const res = await api('GET', '/api/tenants/people', { token: A.emp.token });
  assert.equal(res.status, 200);
  const names = res.body.people.map((p) => p.full_name);
  assert.ok(names.includes('ops-a@example.com') && names.includes('Owner'));
  assert.ok(!names.includes('emp-b@example.com'), "another business's staff never show up");
  for (const p of res.body.people) {
    assert.deepEqual(Object.keys(p).sort(), ['branch_ids', 'full_name', 'id', 'role', 'title']);
  }
  assert.equal((await api('GET', '/api/tenants/users', { token: A.emp.token })).status, 403);
});

// The store City box suggests the cities of the country chosen at sign-up.
test("the city list follows the business's country", async () => {
  const egypt = await api('GET', '/api/tenants/cities', { token: A.emp.token });
  assert.equal(egypt.status, 200);
  assert.equal(egypt.body.country, 'Egypt');
  assert.deepEqual(egypt.body.cities[0], ['Cairo', 'القاهرة'], 'biggest first, with its Arabic name');
  assert.ok(egypt.body.cities.length > 100);
  // Every Egyptian city reads in Arabic on an Arabic page (40 used to show
  // their Latin GeoNames spelling, such as "Madīnat an Naşr" for مدينة نصر).
  assert.deepEqual(egypt.body.cities.filter((c) => !c[1]).map((c) => c[0]), []);
  assert.ok(egypt.body.cities.some(([en, ar]) => en === 'Madīnat an Naşr' && ar === 'مدينة نصر'));

  const other = await api('POST', '/api/auth/signup', {
    body: { fullName: 'Elsewhere', email: 'other-country@example.com', password: 'OwnerPass123', restaurantName: 'Elsewhere', country: 'Other', branchCount: 1, userCount: 1 },
  });
  const none = await api('GET', '/api/tenants/cities', { token: other.body.token });
  assert.deepEqual(none.body.cities, [], '"Other" has no list; the box still takes a typed city');
  assert.equal((await api('GET', '/api/tenants/cities')).status, 401);
});

// A manager can change someone's job title after the invite (e.g. an
// employee who becomes the QAQC person); before, only the person could.
test("a manager can change a team member's job title", async () => {
  const set = await api('PATCH', `/api/tenants/users/${A.emp.userId}`, { token: A.token, body: { title: 'QAQC' } });
  assert.equal(set.status, 200, JSON.stringify(set.body));
  assert.equal(set.body.user.title, 'QAQC');
  assert.equal((await api('PATCH', `/api/tenants/users/${A.emp.userId}`, { token: A.token, body: { title: 'x'.repeat(121) } })).status, 400);
  assert.equal((await api('PATCH', `/api/tenants/users/${A.area.userId}`, { token: A.emp.token, body: { title: 'Business Owner' } })).status, 403);
  const cleared = await api('PATCH', `/api/tenants/users/${A.emp.userId}`, { token: A.token, body: { title: '' } });
  assert.equal(cleared.body.user.title, null);
});

test('profile details must be text', async () => {
  for (const body of [{ fullName: {} }, { fullName: ['x'.repeat(500)] }, { fullName: 12345 }, { title: {} }, { phone: ['1'] }]) {
    const res = await api('PATCH', '/api/auth/me', { token: A.emp.token, body });
    assert.equal(res.status, 400, `${JSON.stringify(body).slice(0, 40)}: ${JSON.stringify(res.body)}`);
  }
  const me = await api('GET', '/api/auth/me', { token: A.emp.token });
  assert.notEqual(me.body.user.fullName, '[object Object]');
  const ok = await api('PATCH', '/api/auth/me', { token: A.emp.token, body: { fullName: ' Emp A ', title: null, phone: '' } });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.user.fullName, 'Emp A');
  assert.equal(ok.body.user.title, null);
  assert.equal(ok.body.user.phone, null);
});
