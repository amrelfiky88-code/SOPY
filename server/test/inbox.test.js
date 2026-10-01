import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { resetTestDb, closeDb } from '../test-utils/db.js';
import { startTestServer, makeClient, completeSetup } from '../test-utils/server.js';

// Inbox and notifications: an incident report opens a thread with the
// store's managers and notifies them; people message each other directly;
// nobody reads a thread they're not in.

let close, api, baseUrl;
const owner = {};
let branchId, otherBranchId, emp, storeMgr, otherMgr, criticalTemplateId, criticalItemId, plainTemplateId, plainItemId;

async function inviteAndAccept(email, role, extra = {}) {
  const invite = await api('POST', '/api/tenants/users/invite', { token: owner.token, body: { fullName: email.split('@')[0], email, role, ...extra } });
  assert.equal(invite.status, 201, JSON.stringify(invite.body));
  const accept = await api('POST', '/api/auth/accept-invite', {
    body: { inviteToken: invite.body.inviteLink.split('token=')[1], password: 'Password123' },
  });
  return { token: accept.body.token, userId: accept.body.user.id };
}

async function answer(token, subId, itemId, compliant) {
  const form = new FormData();
  form.append('itemId', itemId);
  form.append('isCompliant', String(compliant));
  form.append('photo', new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }), 'evidence.jpg');
  const res = await fetch(`${baseUrl}/api/submissions/${subId}/responses`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  assert.equal(res.status, 201);
}

async function runAndSubmit(token, templateId, itemId, compliant) {
  const sub = await api('POST', '/api/submissions', { token, body: { templateId, branchId } });
  assert.equal(sub.status, 201, JSON.stringify(sub.body));
  await answer(token, sub.body.submission.id, itemId, compliant);
  const done = await api('POST', `/api/submissions/${sub.body.submission.id}/submit`, { token, body: {} });
  assert.equal(done.status, 200, JSON.stringify(done.body));
  return done.body.submission;
}

before(async () => {
  await resetTestDb();
  const server = await startTestServer();
  close = server.close;
  baseUrl = server.baseUrl;
  api = makeClient(server.baseUrl);

  const signup = await api('POST', '/api/auth/signup', {
    body: { fullName: 'Layla Owner', email: 'inbox-owner@example.com', password: 'OwnerPass123', restaurantName: 'Olive & Ash', country: 'Egypt', branchCount: 2, userCount: 6 },
  });
  owner.token = signup.body.token;
  owner.userId = signup.body.user.id;
  await completeSetup(api, owner.token);
  branchId = (await api('POST', '/api/tenants/branches', { token: owner.token, body: { name: 'Downtown' } })).body.branch.id;
  otherBranchId = (await api('POST', '/api/tenants/branches', { token: owner.token, body: { name: 'Marina' } })).body.branch.id;

  emp = await inviteAndAccept('omar@example.com', 'employee', { branchIds: [branchId] });
  storeMgr = await inviteAndAccept('karim@example.com', 'store_manager', { branchIds: [branchId] });
  otherMgr = await inviteAndAccept('rania@example.com', 'store_manager', { branchIds: [otherBranchId] });

  const critical = (await api('GET', '/api/checklists/library?critical=true', { token: owner.token })).body.items[0];
  criticalItemId = critical.id;
  criticalTemplateId = (await api('POST', '/api/checklists/templates', { token: owner.token, body: { name: 'Critical check', itemIds: [critical.id] } })).body.template.id;
  const plain = (await api('GET', '/api/checklists/library?standard=HACCP', { token: owner.token })).body.items.find((i) => !i.is_critical);
  plainItemId = plain.id;
  plainTemplateId = (await api('POST', '/api/checklists/templates', { token: owner.token, body: { name: 'Plain check', itemIds: [plain.id] } })).body.template.id;
});

after(async () => {
  await close();
  await closeDb();
});

let incidentThreadId;

test('a failed critical checkpoint opens an incident thread with the store’s managers and notifies them', async () => {
  const sub = await runAndSubmit(emp.token, criticalTemplateId, criticalItemId, false);
  assert.equal(sub.has_incident, true);

  const threads = (await api('GET', '/api/inbox/threads', { token: owner.token })).body.threads.filter((t) => t.kind === 'incident');
  assert.equal(threads.length, 1);
  assert.equal(threads[0].kind, 'incident');
  assert.equal(threads[0].submission_id, sub.id);
  assert.equal(threads[0].branch_name, 'Downtown');
  assert.equal(threads[0].template_name, 'Critical check');
  assert.equal(threads[0].unread, 1, 'SOPY’s summary is unread for the owner');
  assert.equal(threads[0].last_kind, 'incident');
  assert.equal(threads[0].last_data.criticalFails, 1);
  incidentThreadId = threads[0].id;

  const detail = (await api('GET', `/api/inbox/threads/${incidentThreadId}`, { token: storeMgr.token })).body;
  assert.deepEqual(detail.members.map((m) => m.id).sort(), [owner.userId, emp.userId, storeMgr.userId].sort(),
    'the person who filed it, the owner and that store’s manager — not another store’s manager');
  assert.equal(detail.messages[0].sender_id, null);
  assert.equal(detail.messages[0].data.notified, 2);

  assert.equal((await api('GET', `/api/inbox/threads/${incidentThreadId}`, { token: otherMgr.token })).status, 404);
  assert.equal((await api('GET', '/api/inbox/threads', { token: otherMgr.token })).body.threads.filter((t) => t.kind === 'incident').length, 0);

  const ownerNotifs = (await api('GET', '/api/notifications', { token: owner.token })).body.notifications;
  assert.equal(ownerNotifs.length, 1);
  assert.equal(ownerNotifs[0].kind, 'incident');
  assert.equal(ownerNotifs[0].thread_id, incidentThreadId);
  assert.equal(ownerNotifs[0].data.submittedByName, 'omar');
  assert.equal((await api('GET', '/api/notifications', { token: emp.token })).body.notifications.length, 0,
    'the person who filed it isn’t notified about their own report');
  assert.equal((await api('GET', '/api/inbox/summary', { token: emp.token })).body.unreadMessages, 0,
    'nor is the summary unread for them');
});

test('replies reach the other members as unread, and reading clears it', async () => {
  const sent = await api('POST', `/api/inbox/threads/${incidentThreadId}/messages`, { token: storeMgr.token, body: { body: '  Move the dairy to the reach-in.  ' } });
  assert.equal(sent.status, 201, JSON.stringify(sent.body));
  assert.equal(sent.body.message.body, 'Move the dairy to the reach-in.');

  let summary = (await api('GET', '/api/inbox/summary', { token: emp.token })).body;
  assert.equal(summary.unreadMessages, 1);
  summary = (await api('GET', '/api/inbox/summary', { token: storeMgr.token })).body;
  assert.equal(summary.unreadMessages, 0, 'your own message isn’t unread, and sending marks the thread read');

  assert.equal((await api('POST', `/api/inbox/threads/${incidentThreadId}/read`, { token: emp.token })).status, 204);
  assert.equal((await api('GET', '/api/inbox/summary', { token: emp.token })).body.unreadMessages, 0);

  assert.equal((await api('POST', `/api/inbox/threads/${incidentThreadId}/messages`, { token: otherMgr.token, body: { body: 'hi' } })).status, 404,
    'non-members can’t post');
  assert.equal((await api('POST', `/api/inbox/threads/${incidentThreadId}/messages`, { token: emp.token, body: { body: '   ' } })).status, 400);
  assert.equal((await api('POST', `/api/inbox/threads/${incidentThreadId}/messages`, { token: emp.token, body: { body: 'x'.repeat(2001) } })).status, 400);
});

test('direct conversations are one per pair, inside the business only', async () => {
  const first = await api('POST', '/api/inbox/threads', { token: emp.token, body: { userId: otherMgr.userId } });
  assert.equal(first.status, 201, JSON.stringify(first.body));
  const again = await api('POST', '/api/inbox/threads', { token: otherMgr.token, body: { userId: emp.userId } });
  assert.equal(again.body.threadId, first.body.threadId, 'either person reopens the same conversation');

  await api('POST', `/api/inbox/threads/${first.body.threadId}/messages`, { token: emp.token, body: { body: 'Delivery moved to 14:00' } });
  const list = (await api('GET', '/api/inbox/threads', { token: otherMgr.token })).body.threads.filter((t) => t.kind === 'direct');
  assert.equal(list[0].kind, 'direct');
  assert.equal(list[0].other_id, emp.userId);
  assert.equal(list[0].last_body, 'Delivery moved to 14:00');
  assert.equal(list[0].unread, 1);

  assert.equal((await api('POST', '/api/inbox/threads', { token: emp.token, body: { userId: emp.userId } })).status, 400);
  assert.equal((await api('POST', '/api/inbox/threads', { token: emp.token, body: { userId: 'nope' } })).status, 400);

  const outsider = await api('POST', '/api/auth/signup', {
    body: { fullName: 'Other', email: 'inbox-other@example.com', password: 'OtherPass123', restaurantName: 'Elsewhere', country: 'Egypt', branchCount: 1, userCount: 1 },
  });
  assert.equal((await api('POST', '/api/inbox/threads', { token: emp.token, body: { userId: outsider.body.user.id } })).status, 404);
  assert.equal((await api('GET', `/api/inbox/threads/${first.body.threadId}`, { token: outsider.body.token })).status, 404);
});

test('notifications can be marked read one by one or all at once, only your own', async () => {
  await runAndSubmit(emp.token, criticalTemplateId, criticalItemId, false);
  const notifs = (await api('GET', '/api/notifications', { token: owner.token })).body.notifications;
  assert.equal(notifs.length, 2);
  assert.equal((await api('GET', '/api/inbox/summary', { token: owner.token })).body.unreadNotifications, 2);

  assert.equal((await api('POST', `/api/notifications/${notifs[0].id}/read`, { token: storeMgr.token })).status, 404, 'not someone else’s');
  assert.equal((await api('POST', `/api/notifications/${notifs[0].id}/read`, { token: owner.token })).status, 204);
  assert.equal((await api('GET', '/api/inbox/summary', { token: owner.token })).body.unreadNotifications, 1);
  assert.equal((await api('POST', '/api/notifications/read-all', { token: owner.token })).status, 204);
  assert.equal((await api('GET', '/api/inbox/summary', { token: owner.token })).body.unreadNotifications, 0);
});

test('a report without an incident lets that store’s manager know, and opens no thread', async () => {
  const incidents = async () => (await api('GET', '/api/inbox/threads', { token: owner.token })).body.threads.filter((t) => t.kind === 'incident').length;
  const before = await incidents();
  const sub = await runAndSubmit(emp.token, plainTemplateId, plainItemId, true);
  assert.equal(sub.has_incident, false);
  assert.equal(await incidents(), before);
  const mgr = (await api('GET', '/api/notifications', { token: storeMgr.token })).body.notifications;
  assert.equal(mgr[0].kind, 'report_submitted');
  assert.equal(mgr[0].submission_id, sub.id);
  assert.equal((await api('GET', '/api/notifications', { token: otherMgr.token })).body.notifications.length, 0);
});

test('Library “Run now” starts a run of one SOP for anyone, at their own store', async () => {
  const run = await api('POST', '/api/checklists/library/run', { token: emp.token, body: { group: 'SOP 1: Opening', branchId } });
  assert.equal(run.status, 201, JSON.stringify(run.body));
  const sub = run.body.submission;
  assert.equal(sub.submitted_by, emp.userId);
  assert.equal(sub.branch_id, branchId);

  const tpl = (await api('GET', `/api/checklists/templates/${sub.template_id}`, { token: emp.token })).body;
  assert.equal(tpl.template.name, 'SOP 1: Opening');
  assert.equal(tpl.template.library_group, 'SOP 1: Opening');
  assert.ok(tpl.items.length >= 8, 'every checkpoint of SOP 1');
  assert.ok(tpl.items.every((i) => (i.category || '').startsWith('SOP 1: Opening')), 'and nothing from other SOPs');

  const again = await api('POST', '/api/checklists/library/run', { token: emp.token, body: { group: 'SOP 1: Opening', branchId } });
  assert.equal(again.status, 200);
  assert.equal(again.body.resumed, true);
  assert.equal(again.body.submission.id, sub.id, 'tapping it again carries on the same run');

  const mgrRun = await api('POST', '/api/checklists/library/run', { token: storeMgr.token, body: { group: 'SOP 1: Opening', branchId } });
  assert.equal(mgrRun.body.submission.template_id, sub.template_id, 'one checklist per SOP, shared by the team');

  assert.equal((await api('POST', '/api/checklists/library/run', { token: emp.token, body: { group: 'SOP 1: Opening', branchId: otherBranchId } })).status, 404,
    'not at a store they don’t work at');
  assert.equal((await api('POST', '/api/checklists/library/run', { token: owner.token, body: { group: 'SOP 1: Opening', branchId: otherBranchId } })).status, 201,
    'owners run anywhere');
  assert.equal((await api('POST', '/api/checklists/library/run', { token: emp.token, body: { group: 'SOP 99: Nothing', branchId } })).status, 404);
  assert.equal((await api('POST', '/api/checklists/library/run', { token: emp.token, body: { group: '', branchId } })).status, 400);

  const daily = await api('POST', '/api/checklists/library/run', { token: owner.token, body: { group: 'Weekly Audit', branchId } });
  const weekly = (await api('GET', `/api/checklists/templates/${daily.body.submission.template_id}`, { token: owner.token })).body.template;
  assert.equal(weekly.frequency, 'weekly');
});
