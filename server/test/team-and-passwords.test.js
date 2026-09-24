import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { resetTestDb, closeDb } from '../test-utils/db.js';
import { startTestServer, makeClient, completeSetup } from '../test-utils/server.js';

// Daily-use behaviour: duplicate assignments, what "My checklists today"
// shows after a run, which store an "All stores" checklist is filed
// under, and getting back in after forgetting a password.

let close, api, baseUrl;
const owner = {};
let emp, mainId, maadiId, templateId, itemId;

async function inviteAndAccept(email, role, extra = {}) {
  const invite = await api('POST', '/api/tenants/users/invite', { token: owner.token, body: { fullName: email, email, role, ...extra } });
  assert.equal(invite.status, 201, JSON.stringify(invite.body));
  const accept = await api('POST', '/api/auth/accept-invite', {
    body: { inviteToken: invite.body.inviteLink.split('token=')[1], password: 'Password123' },
  });
  return { token: accept.body.token, userId: accept.body.user.id, email };
}

before(async () => {
  await resetTestDb();
  const server = await startTestServer();
  close = server.close;
  baseUrl = server.baseUrl;
  api = makeClient(server.baseUrl);

  const signup = await api('POST', '/api/auth/signup', {
    body: { fullName: 'Owner', email: 'tp-owner@example.com', password: 'OwnerPass123', restaurantName: 'TP Cafe', country: 'Egypt', branchCount: 2, userCount: 4 },
  });
  owner.token = signup.body.token;
  await completeSetup(api, owner.token);
  mainId = (await api('POST', '/api/tenants/branches', { token: owner.token, body: { name: 'Main' } })).body.branch.id;
  maadiId = (await api('POST', '/api/tenants/branches', { token: owner.token, body: { name: 'Maadi' } })).body.branch.id;
  emp = await inviteAndAccept('tp-emp@example.com', 'employee', { branchIds: [maadiId] });

  itemId = (await api('GET', '/api/checklists/library?q=fridge', { token: owner.token })).body.items[0].id;
  templateId = (await api('POST', '/api/checklists/templates', { token: owner.token, body: { name: 'Daily fridge', itemIds: [itemId] } })).body.template.id;
});

after(async () => {
  await close();
  await closeDb();
});

test('assigning the same checklist the same way twice does not duplicate it', async () => {
  const body = { templateId, role: 'employee' };
  const [a, b] = await Promise.all([
    api('POST', '/api/checklists/assignments', { token: owner.token, body }),
    api('POST', '/api/checklists/assignments', { token: owner.token, body }),
  ]);
  const again = await api('POST', '/api/checklists/assignments', { token: owner.token, body });
  assert.equal(again.status, 200);
  assert.equal(again.body.existing, true);
  const mine = await api('GET', '/api/checklists/my-assignments', { token: emp.token });
  assert.equal(mine.body.assignments.length, 1, 'shows once on the dashboard');
  assert.ok([a.status, b.status].includes(201));
});

test('My checklists today shows in progress, then done, with the person\'s own stores', async () => {
  let mine = await api('GET', '/api/checklists/my-assignments', { token: emp.token });
  const a = mine.body.assignments[0];
  assert.equal(a.done, false);
  assert.equal(a.open_submission_id, null);
  assert.deepEqual(mine.body.myBranchIds, [maadiId], 'the employee works at Maadi, not the first store');

  const sub = (await api('POST', '/api/submissions', { token: emp.token, body: { templateId, branchId: maadiId, assignmentId: a.id } })).body.submission;
  mine = await api('GET', '/api/checklists/my-assignments', { token: emp.token });
  assert.equal(mine.body.assignments[0].open_submission_id, sub.id);

  const form = new FormData();
  form.append('itemId', itemId);
  form.append('isCompliant', 'true');
  await fetch(`${baseUrl}/api/submissions/${sub.id}/responses`, { method: 'POST', headers: { Authorization: `Bearer ${emp.token}` }, body: form });
  await api('POST', `/api/submissions/${sub.id}/submit`, { token: emp.token, body: {} });

  mine = await api('GET', '/api/checklists/my-assignments', { token: emp.token });
  assert.equal(mine.body.assignments[0].done, true);
  assert.equal(mine.body.assignments[0].last_submission_id, sub.id);
});

test('store membership can be changed after the invite', async () => {
  const res = await api('PATCH', `/api/tenants/users/${emp.userId}`, { token: owner.token, body: { branchIds: [mainId, maadiId] } });
  assert.equal(res.status, 200);
  const users = (await api('GET', '/api/tenants/users', { token: owner.token })).body.users;
  assert.deepEqual(users.find((u) => u.id === emp.userId).branch_ids.sort(), [mainId, maadiId].sort());
});

test('changing your password needs the old one and signs out other devices', async () => {
  const otherDevice = (await api('POST', '/api/auth/login', { body: { email: emp.email, password: 'Password123' } })).body.token;
  // Tokens carry second-resolution timestamps; let a second pass so the
  // "other device" session is strictly older than the change.
  await new Promise((r) => setTimeout(r, 1100));

  const wrong = await api('PATCH', '/api/auth/password', { token: emp.token, body: { currentPassword: 'nope', newPassword: 'NewPassword123' } });
  assert.equal(wrong.status, 400);
  const short = await api('PATCH', '/api/auth/password', { token: emp.token, body: { currentPassword: 'Password123', newPassword: 'short' } });
  assert.equal(short.status, 400);

  const ok = await api('PATCH', '/api/auth/password', { token: emp.token, body: { currentPassword: 'Password123', newPassword: 'NewPassword123' } });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.token, 'this device gets a fresh session');

  assert.equal((await api('GET', '/api/auth/me', { token: otherDevice })).status, 401, 'the other device is signed out');
  assert.equal((await api('GET', '/api/auth/me', { token: ok.body.token })).status, 200);
  emp.token = ok.body.token;

  assert.equal((await api('POST', '/api/auth/login', { body: { email: emp.email, password: 'Password123' } })).status, 401);
  assert.equal((await api('POST', '/api/auth/login', { body: { email: emp.email, password: 'NewPassword123' } })).status, 200);
});

test('a manager can issue a one-time reset link for someone who forgot', async () => {
  const oldSession = emp.token;
  await new Promise((r) => setTimeout(r, 1100));

  const link = await api('POST', `/api/tenants/users/${emp.userId}/reset-link`, { token: owner.token, body: {} });
  assert.equal(link.status, 201, JSON.stringify(link.body));
  const token = link.body.resetLink.split('token=')[1];

  // Staff can't issue links for their managers or themselves.
  const up = await api('POST', `/api/tenants/users/${emp.userId}/reset-link`, { token: emp.token, body: {} });
  assert.equal(up.status, 403);

  const set = await api('POST', '/api/auth/accept-invite', { body: { inviteToken: token, password: 'ResetPass123' } });
  assert.equal(set.status, 200);
  assert.equal(set.body.user.status, 'active');
  assert.equal((await api('GET', '/api/auth/me', { token: oldSession })).status, 401, 'old sessions end');
  assert.equal((await api('POST', '/api/auth/login', { body: { email: emp.email, password: 'ResetPass123' } })).status, 200);

  const reused = await api('POST', '/api/auth/accept-invite', { body: { inviteToken: token, password: 'AnotherPass123' } });
  assert.equal(reused.status, 404, 'single use');
});

test('disabling someone drops a pending reset link, and re-enabling keeps them active', async () => {
  const link = await api('POST', `/api/tenants/users/${emp.userId}/reset-link`, { token: owner.token, body: {} });
  const token = link.body.resetLink.split('token=')[1];
  await api('PATCH', `/api/tenants/users/${emp.userId}`, { token: owner.token, body: { status: 'disabled' } });
  assert.equal((await api('POST', '/api/auth/accept-invite', { body: { inviteToken: token, password: 'Sneaky12345' } })).status, 404);
  const back = await api('PATCH', `/api/tenants/users/${emp.userId}`, { token: owner.token, body: { status: 'active' } });
  assert.equal(back.body.user.status, 'active', 'not bounced back to "invited"');
});
