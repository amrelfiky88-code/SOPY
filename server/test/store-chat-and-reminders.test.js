import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { resetTestDb, closeDb } from '../test-utils/db.js';
import { startTestServer, makeClient, completeSetup } from '../test-utils/server.js';
import { sendDueReminders } from '../src/reminders.js';
import { pool } from '../src/db.js';

// Store team chats follow who works at the store; checklist reminders go
// out once, 30 minutes before the due time in the store's time zone, to
// the people the checklist is for who haven't done it.

let close, api, baseUrl;
const owner = {};
let downtown, marina, emp, dtMgr, marinaMgr, templateId, itemId;

async function inviteAndAccept(email, role, extra = {}) {
  const invite = await api('POST', '/api/tenants/users/invite', { token: owner.token, body: { fullName: email.split('@')[0], email, role, ...extra } });
  assert.equal(invite.status, 201, JSON.stringify(invite.body));
  const accept = await api('POST', '/api/auth/accept-invite', {
    body: { inviteToken: invite.body.inviteLink.split('token=')[1], password: 'Password123' },
  });
  return { token: accept.body.token, userId: accept.body.user.id };
}

const storeChat = async (token, branchName) => (await api('GET', '/api/inbox/threads', { token })).body.threads
  .find((th) => th.kind === 'store' && th.branch_name === branchName);

before(async () => {
  await resetTestDb();
  const server = await startTestServer();
  close = server.close;
  baseUrl = server.baseUrl;
  api = makeClient(server.baseUrl);
  const signup = await api('POST', '/api/auth/signup', {
    body: { fullName: 'Layla Owner', email: 'chat-owner@example.com', password: 'OwnerPass123', restaurantName: 'Olive & Ash', country: 'United Arab Emirates', branchCount: 2, userCount: 6 },
  });
  owner.token = signup.body.token;
  owner.userId = signup.body.user.id;
  await completeSetup(api, owner.token);
  downtown = (await api('POST', '/api/tenants/branches', { token: owner.token, body: { name: 'Downtown', timezone: 'Asia/Dubai' } })).body.branch.id;
  marina = (await api('POST', '/api/tenants/branches', { token: owner.token, body: { name: 'Marina', timezone: 'Asia/Dubai' } })).body.branch.id;
  emp = await inviteAndAccept('omar@example.com', 'employee', { branchIds: [downtown] });
  dtMgr = await inviteAndAccept('karim@example.com', 'store_manager', { branchIds: [downtown] });
  marinaMgr = await inviteAndAccept('rania@example.com', 'store_manager', { branchIds: [marina] });

  const item = (await api('GET', '/api/checklists/library?standard=HACCP', { token: owner.token })).body.items.find((i) => !i.is_critical);
  itemId = item.id;
  templateId = (await api('POST', '/api/checklists/templates', { token: owner.token, body: { name: 'Line check', itemIds: [item.id] } })).body.template.id;
});

after(async () => {
  await close();
  await closeDb();
});

test('each store has a team chat for the people who work there, plus owners', async () => {
  const ownerDt = await storeChat(owner.token, 'Downtown');
  const ownerMarina = await storeChat(owner.token, 'Marina');
  assert.ok(ownerDt && ownerMarina, 'owners see every store’s chat');
  assert.equal(ownerDt.member_count, 3, 'owner, Omar and Karim');

  assert.ok(await storeChat(emp.token, 'Downtown'));
  assert.equal(await storeChat(emp.token, 'Marina'), undefined, 'not another store’s chat');

  const detail = (await api('GET', `/api/inbox/threads/${ownerDt.id}`, { token: dtMgr.token })).body;
  assert.deepEqual(detail.members.map((m) => m.id).sort(), [owner.userId, emp.userId, dtMgr.userId].sort());
  assert.equal((await api('GET', `/api/inbox/threads/${ownerDt.id}`, { token: marinaMgr.token })).status, 404);
  assert.equal((await api('GET', '/api/inbox/threads', { token: owner.token })).body.threads.filter((t) => t.kind === 'store').length, 2,
    'listing again doesn’t make a second chat per store');
});

test('a message in the store chat is unread for everyone else there, until they open it', async () => {
  const chat = await storeChat(emp.token, 'Downtown');
  const sent = await api('POST', `/api/inbox/threads/${chat.id}/messages`, { token: emp.token, body: { body: 'Fresh Co. delivery moved to 14:00' } });
  assert.equal(sent.status, 201, JSON.stringify(sent.body));

  assert.equal((await api('GET', '/api/inbox/summary', { token: dtMgr.token })).body.unreadMessages, 1);
  assert.equal((await api('GET', '/api/inbox/summary', { token: owner.token })).body.unreadMessages, 1);
  assert.equal((await api('GET', '/api/inbox/summary', { token: emp.token })).body.unreadMessages, 0);
  assert.equal((await api('GET', '/api/inbox/summary', { token: marinaMgr.token })).body.unreadMessages, 0);
  assert.equal((await api('POST', `/api/inbox/threads/${chat.id}/messages`, { token: marinaMgr.token, body: { body: 'hi' } })).status, 404);

  await api('POST', `/api/inbox/threads/${chat.id}/read`, { token: dtMgr.token });
  assert.equal((await api('GET', '/api/inbox/summary', { token: dtMgr.token })).body.unreadMessages, 0);
});

test('the chat follows the team: moving someone to a store adds them, moving them away removes them', async () => {
  const chat = await storeChat(owner.token, 'Downtown');
  await api('PATCH', `/api/tenants/users/${marinaMgr.userId}`, { token: owner.token, body: { branchIds: [marina, downtown] } });
  assert.ok(await storeChat(marinaMgr.token, 'Downtown'));
  assert.equal((await storeChat(owner.token, 'Downtown')).member_count, 4);

  await api('PATCH', `/api/tenants/users/${marinaMgr.userId}`, { token: owner.token, body: { branchIds: [marina] } });
  assert.equal((await api('GET', `/api/inbox/threads/${chat.id}`, { token: marinaMgr.token })).status, 404);
});

test('incident alerts can be turned off; the manager stays in the incident thread', async () => {
  const off = await api('PATCH', '/api/auth/me', { token: dtMgr.token, body: { notifyIncidents: false } });
  assert.equal(off.status, 200);
  assert.equal(off.body.user.notifyIncidents, false);
  assert.equal((await api('PATCH', '/api/auth/me', { token: dtMgr.token, body: { notifyIncidents: 'no' } })).status, 400);

  const critical = (await api('GET', '/api/checklists/library?critical=true', { token: owner.token })).body.items[0];
  const tpl = (await api('POST', '/api/checklists/templates', { token: owner.token, body: { name: 'Critical', itemIds: [critical.id] } })).body.template.id;
  const sub = (await api('POST', '/api/submissions', { token: emp.token, body: { templateId: tpl, branchId: downtown } })).body.submission.id;
  const form = new FormData();
  form.append('itemId', critical.id);
  form.append('isCompliant', 'false');
  form.append('photo', new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }), 'e.jpg');
  await fetch(`${baseUrl}/api/submissions/${sub}/responses`, { method: 'POST', headers: { Authorization: `Bearer ${emp.token}` }, body: form });
  await api('POST', `/api/submissions/${sub}/submit`, { token: emp.token, body: {} });

  const incident = (await api('GET', '/api/inbox/threads', { token: dtMgr.token })).body.threads.find((t) => t.kind === 'incident');
  assert.ok(incident, 'still in the thread');
  assert.equal((await api('GET', '/api/notifications', { token: dtMgr.token })).body.notifications.filter((n) => n.kind === 'incident').length, 0);
  assert.equal((await api('GET', '/api/notifications', { token: owner.token })).body.notifications.filter((n) => n.kind === 'incident').length, 1);
  await api('PATCH', '/api/auth/me', { token: dtMgr.token, body: { notifyIncidents: true } });
});

// 09:00 in Dubai (UTC+4) is 05:00Z.
const at = (iso) => new Date(iso);
const reminders = async (token) => (await api('GET', '/api/notifications', { token })).body.notifications.filter((n) => n.kind === 'checklist_due');

test('a checklist due at 09:00 reminds its people once, from 08:30 store time', async () => {
  assert.equal((await api('POST', '/api/checklists/assignments', { token: owner.token, body: { templateId, branchId: downtown, dueTime: '9am' } })).status, 400);
  const res = await api('POST', '/api/checklists/assignments', { token: owner.token, body: { templateId, branchId: downtown, role: 'employee', dueTime: '09:00' } });
  assert.equal(res.status, 201, JSON.stringify(res.body));

  assert.equal(await sendDueReminders(at('2030-01-15T04:20:00Z')), 0, '08:20 is too early');
  assert.equal(await sendDueReminders(at('2030-01-15T04:40:00Z')), 1, '08:40: Omar is reminded');
  assert.equal(await sendDueReminders(at('2030-01-15T04:50:00Z')), 0, 'only once');
  assert.equal(await sendDueReminders(at('2030-01-15T05:05:00Z')), 0, 'not after it’s due');

  const mine = await reminders(emp.token);
  assert.equal(mine.length, 1);
  assert.equal(mine[0].data.dueTime, '09:00');
  assert.equal(mine[0].data.dueDate, '2030-01-15');
  assert.equal(mine[0].data.branchName, 'Downtown');
  assert.equal(mine[0].data.templateName, 'Line check');
  assert.equal((await reminders(dtMgr.token)).length, 0, 'it’s for employees only');

  assert.equal(await sendDueReminders(at('2030-01-16T04:40:00Z')), 1, 'and again the next day');
});

test('no reminder once it’s done, or for someone who turned reminders off', async () => {
  const res = await api('POST', '/api/checklists/assignments', { token: owner.token, body: { templateId, branchId: downtown, role: 'store_manager', dueTime: '14:00' } });
  const assignmentId = res.body.assignment.id;
  const sub = (await api('POST', '/api/submissions', { token: dtMgr.token, body: { templateId, branchId: downtown, assignmentId } })).body.submission.id;
  const form = new FormData();
  form.append('itemId', itemId);
  form.append('isCompliant', 'true');
  form.append('photo', new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }), 'e.jpg');
  await fetch(`${baseUrl}/api/submissions/${sub}/responses`, { method: 'POST', headers: { Authorization: `Bearer ${dtMgr.token}` }, body: form });
  await api('POST', `/api/submissions/${sub}/submit`, { token: dtMgr.token, body: {} });

  // Due 14:00 Dubai today; check 13:40 Dubai today.
  const { rows } = await pool.query("SELECT to_char(now() AT TIME ZONE 'Asia/Dubai', 'YYYY-MM-DD') AS d");
  const check = new Date(`${rows[0].d}T09:40:00Z`);
  await sendDueReminders(check);
  assert.equal((await reminders(dtMgr.token)).filter((n) => n.data.assignmentId === assignmentId).length, 0, 'already done today');

  await api('PATCH', '/api/auth/me', { token: emp.token, body: { notifyReminders: false } });
  const before = (await reminders(emp.token)).length;
  await sendDueReminders(at('2030-01-17T04:40:00Z'));
  assert.equal((await reminders(emp.token)).length, before, 'reminders off');
});

test('someone who joins a store later doesn’t find its whole chat history unread', async () => {
  const newcomer = await inviteAndAccept('newcomer@example.com', 'employee', { branchIds: [downtown] });
  assert.ok(await storeChat(newcomer.token, 'Downtown'));
  assert.equal((await api('GET', '/api/inbox/summary', { token: newcomer.token })).body.unreadMessages, 0);
  const chat = await storeChat(emp.token, 'Downtown');
  await api('POST', `/api/inbox/threads/${chat.id}/messages`, { token: emp.token, body: { body: 'Welcome aboard' } });
  assert.equal((await api('GET', '/api/inbox/summary', { token: newcomer.token })).body.unreadMessages, 1, 'new messages still count');
});
