import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { resetTestDb, closeDb } from '../test-utils/db.js';
import { startTestServer, makeClient, completeSetup } from '../test-utils/server.js';

// End-to-end behaviour of running an assigned checklist: who sees which
// assignment, how answers/photos merge into one response per checkpoint,
// and resuming a run instead of opening duplicates.

let close, api, baseUrl;
const owner = {};
let branchId, otherBranchId, templateId, itemIds, emp, manager;

async function inviteAndAccept(email, role, extra = {}) {
  const invite = await api('POST', '/api/tenants/users/invite', { token: owner.token, body: { fullName: email, email, role, ...extra } });
  assert.equal(invite.status, 201, JSON.stringify(invite.body));
  const accept = await api('POST', '/api/auth/accept-invite', {
    body: { inviteToken: invite.body.inviteLink.split('token=')[1], password: 'Password123' },
  });
  return { token: accept.body.token, userId: accept.body.user.id };
}

async function postResponse(token, subId, fields, photo) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  if (photo) form.append('photo', new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }), 'evidence.jpg');
  return fetch(`${baseUrl}/api/submissions/${subId}/responses`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
}

before(async () => {
  await resetTestDb();
  const server = await startTestServer();
  close = server.close;
  baseUrl = server.baseUrl;
  api = makeClient(server.baseUrl);

  const signup = await api('POST', '/api/auth/signup', {
    body: { fullName: 'Owner', email: 'runs-owner@example.com', password: 'OwnerPass123', restaurantName: 'Runs Cafe', country: 'Egypt', branchCount: 2, userCount: 5 },
  });
  owner.token = signup.body.token;
  await completeSetup(api, owner.token);
  branchId = (await api('POST', '/api/tenants/branches', { token: owner.token, body: { name: 'Main' } })).body.branch.id;
  otherBranchId = (await api('POST', '/api/tenants/branches', { token: owner.token, body: { name: 'Second' } })).body.branch.id;

  emp = await inviteAndAccept('runs-emp@example.com', 'employee', { branchIds: [branchId] });
  manager = await inviteAndAccept('runs-mgr@example.com', 'store_manager', { branchIds: [branchId] });

  const library = await api('GET', '/api/checklists/library?q=fridge', { token: owner.token });
  itemIds = library.body.items.slice(0, 2).map((i) => i.id);
  const tpl = await api('POST', '/api/checklists/templates', { token: owner.token, body: { name: 'Fridge checks', itemIds } });
  templateId = tpl.body.template.id;
});

after(async () => {
  await close();
  await closeDb();
});

test('a role-scoped assignment only reaches that role (conditions were OR\'d)', async () => {
  const a = await api('POST', '/api/checklists/assignments', { token: owner.token, body: { templateId, role: 'store_manager' } });
  assert.equal(a.status, 201, JSON.stringify(a.body));

  const forEmp = await api('GET', '/api/checklists/my-assignments', { token: emp.token });
  assert.equal(forEmp.body.assignments.length, 0);
  const forMgr = await api('GET', '/api/checklists/my-assignments', { token: manager.token });
  assert.equal(forMgr.body.assignments.length, 1);

  await api('DELETE', `/api/checklists/assignments/${a.body.assignment.id}`, { token: owner.token });
});

test('a store-scoped assignment reaches that store\'s staff only', async () => {
  const a = await api('POST', '/api/checklists/assignments', { token: owner.token, body: { templateId, branchId: otherBranchId } });
  assert.equal(a.status, 201);
  const forEmp = await api('GET', '/api/checklists/my-assignments', { token: emp.token });
  assert.equal(forEmp.body.assignments.length, 0);
  const forOwner = await api('GET', '/api/checklists/my-assignments', { token: owner.token });
  assert.equal(forOwner.body.assignments.length, 1, 'owners oversee every store');
  await api('DELETE', `/api/checklists/assignments/${a.body.assignment.id}`, { token: owner.token });
});

test('assignments reject another tenant\'s checklist and unknown roles', async () => {
  const other = await api('POST', '/api/auth/signup', {
    body: { fullName: 'X', email: 'runs-other@example.com', password: 'OwnerPass123', restaurantName: 'Other', country: 'Egypt', branchCount: 1, userCount: 1 },
  });
  const cross = await api('POST', '/api/checklists/assignments', { token: other.body.token, body: { templateId } });
  assert.equal(cross.status, 404);
  const badRole = await api('POST', '/api/checklists/assignments', { token: owner.token, body: { templateId, role: 'wizard' } });
  assert.equal(badRole.status, 400);
});

test('answer, reading and photo merge into one response per checkpoint, in any order', async () => {
  const assignment = (await api('POST', '/api/checklists/assignments', { token: owner.token, body: { templateId, branchId } })).body.assignment;
  const start = await api('POST', '/api/submissions', { token: emp.token, body: { templateId, branchId, assignmentId: assignment.id } });
  assert.equal(start.status, 201);
  const subId = start.body.submission.id;

  // Photo first, then the answer — the order that used to lose the answer.
  assert.equal((await postResponse(emp.token, subId, { itemId: itemIds[0] }, true)).status, 201);
  assert.equal((await postResponse(emp.token, subId, { itemId: itemIds[0], isCompliant: 'true' })).status, 201);
  assert.equal((await postResponse(emp.token, subId, { itemId: itemIds[0], valueText: '3' })).status, 201);
  assert.equal((await postResponse(emp.token, subId, { itemId: itemIds[1], isCompliant: 'false' }, true)).status, 201);

  const detail = await api('GET', `/api/submissions/${subId}`, { token: emp.token });
  const first = detail.body.responses.filter((r) => r.item_id === itemIds[0]);
  assert.equal(first.length, 1, 'one row per checkpoint');
  assert.equal(first[0].is_compliant, true);
  assert.equal(first[0].value_text, '3');
  assert.ok(first[0].photo_path, 'the photo survives later answer-only saves');

  // Starting the same assignment again resumes this run.
  const again = await api('POST', '/api/submissions', { token: emp.token, body: { templateId, branchId, assignmentId: assignment.id } });
  assert.equal(again.body.submission.id, subId);

  await api('POST', `/api/submissions/${subId}/submit`, { token: emp.token, body: {} });
  const card = await api('GET', `/api/submissions/${subId}/scorecard`, { token: emp.token });
  assert.equal(card.body.totalScored, 2);
  assert.equal(card.body.totalCompliant, 1);
  assert.equal(card.body.percentage, 50);
});

test('a response for a checkpoint outside the checklist is rejected', async () => {
  const start = await api('POST', '/api/submissions', { token: emp.token, body: { templateId, branchId } });
  const library = await api('GET', '/api/checklists/library?q=hand', { token: owner.token });
  const outsider = library.body.items.find((i) => !itemIds.includes(i.id));
  const res = await postResponse(emp.token, start.body.submission.id, { itemId: outsider.id, isCompliant: 'true' });
  assert.equal(res.status, 400);
});
