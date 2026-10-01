import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import webpush from 'web-push';
import { resetTestDb, closeDb } from '../test-utils/db.js';
import { startTestServer, makeClient, completeSetup } from '../test-utils/server.js';
import { setPushSender, pushesSettled } from '../src/push.js';
import { sendDueReminders } from '../src/reminders.js';
import { pool } from '../src/db.js';

// Phone notifications: who gets a push, in which language, that dead
// subscriptions are dropped and signing out stops them. Plus store time
// zones, which decide when reminders go out.

let close, api, baseUrl;
const owner = {};
let downtown, emp, mgr;
const sent = []; // { endpoint, payload }
let failWith = null;

const endpoint = (name) => `https://fcm.googleapis.com/fcm/send/${name}`;
const keys = { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA', auth: 'tBHItJI5svbpez7KI4CCXg' };
const pushesTo = (name) => sent.filter((p) => p.endpoint === endpoint(name)).map((p) => p.payload);

async function inviteAndAccept(email, role, extra = {}) {
  const invite = await api('POST', '/api/tenants/users/invite', { token: owner.token, body: { fullName: email.split('@')[0], email, role, ...extra } });
  const accept = await api('POST', '/api/auth/accept-invite', { body: { inviteToken: invite.body.inviteLink.split('token=')[1], password: 'Password123' } });
  return { token: accept.body.token, userId: accept.body.user.id };
}

before(async () => {
  const vapid = webpush.generateVAPIDKeys();
  Object.assign(process.env, { VAPID_PUBLIC_KEY: vapid.publicKey, VAPID_PRIVATE_KEY: vapid.privateKey, VAPID_SUBJECT: 'mailto:test@example.com' });
  setPushSender(async (subscription, payload) => {
    if (failWith) throw Object.assign(new Error('push service says no'), { statusCode: failWith });
    sent.push({ endpoint: subscription.endpoint, payload: JSON.parse(payload) });
  });
  await resetTestDb();
  const server = await startTestServer();
  close = server.close;
  baseUrl = server.baseUrl;
  api = makeClient(server.baseUrl);
  const signup = await api('POST', '/api/auth/signup', {
    body: { fullName: 'Layla Owner', email: 'push-owner@example.com', password: 'OwnerPass123', restaurantName: 'Olive & Ash', country: 'Egypt', branchCount: 2, userCount: 5, language: 'ar' },
  });
  owner.token = signup.body.token;
  owner.userId = signup.body.user.id;
  await completeSetup(api, owner.token);
  downtown = (await api('POST', '/api/tenants/branches', { token: owner.token, body: { name: 'Downtown', timezone: 'Africa/Cairo' } })).body.branch.id;
  emp = await inviteAndAccept('omar@example.com', 'employee', { branchIds: [downtown] });
  mgr = await inviteAndAccept('karim@example.com', 'store_manager', { branchIds: [downtown] });
});

after(async () => {
  for (const k of ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT']) delete process.env[k];
  await close();
  await closeDb();
});

test('a browser subscribes with a real push service address only', async () => {
  const config = await api('GET', '/api/push/config', { token: emp.token });
  assert.equal(config.body.publicKey, process.env.VAPID_PUBLIC_KEY);

  for (const bad of ['http://fcm.googleapis.com/x', 'https://evil.example.com/fcm.googleapis.com', 'https://169.254.169.254/latest', 'nope']) {
    assert.equal((await api('POST', '/api/push/subscribe', { token: emp.token, body: { endpoint: bad, keys } })).status, 400, bad);
  }
  assert.equal((await api('POST', '/api/push/subscribe', { token: emp.token, body: { endpoint: endpoint('omar'), keys: { p256dh: '<script>', auth: 'x' } } })).status, 400);

  for (const [who, name] of [[emp, 'omar'], [mgr, 'karim'], [owner, 'layla']]) {
    const res = await api('POST', '/api/push/subscribe', { token: who.token, body: { endpoint: endpoint(name), keys } });
    assert.equal(res.status, 201, JSON.stringify(res.body));
  }
});

test('an incident is pushed to the store’s managers in their own language, not to whoever filed it', async () => {
  const critical = (await api('GET', '/api/checklists/library?critical=true', { token: owner.token })).body.items[0];
  const tpl = (await api('POST', '/api/checklists/templates', { token: owner.token, body: { name: 'Critical', itemIds: [critical.id] } })).body.template.id;
  const sub = (await api('POST', '/api/submissions', { token: emp.token, body: { templateId: tpl, branchId: downtown } })).body.submission.id;
  const form = new FormData();
  form.append('itemId', critical.id);
  form.append('isCompliant', 'false');
  form.append('photo', new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }), 'e.jpg');
  await fetch(`${baseUrl}/api/submissions/${sub}/responses`, { method: 'POST', headers: { Authorization: `Bearer ${emp.token}` }, body: form });
  await api('POST', `/api/submissions/${sub}/submit`, { token: emp.token, body: {} });
  await pushesSettled();

  const [layla] = pushesTo('layla');
  assert.equal(layla.title, 'رُصد إخفاق حرج', 'the owner uses the app in Arabic');
  assert.equal(layla.dir, 'rtl');
  assert.match(layla.url, /^\/app\/inbox\//);
  assert.equal(pushesTo('karim')[0].title, 'Critical fail flagged');
  assert.equal(pushesTo('omar').length, 0);
});

test('messages push to the others in the conversation, store chats included', async () => {
  sent.length = 0;
  const dm = (await api('POST', '/api/inbox/threads', { token: mgr.token, body: { userId: emp.userId } })).body.threadId;
  await api('POST', `/api/inbox/threads/${dm}/messages`, { token: mgr.token, body: { body: 'Log a second reading at 11:00 please' } });
  await pushesSettled();
  assert.deepEqual(pushesTo('omar').map((p) => [p.title, p.body]), [['karim', 'Log a second reading at 11:00 please']]);
  assert.equal(pushesTo('karim').length, 0, 'not to the sender');

  sent.length = 0;
  const store = (await api('GET', '/api/inbox/threads', { token: emp.token })).body.threads.find((t) => t.kind === 'store');
  await api('POST', `/api/inbox/threads/${store.id}/messages`, { token: emp.token, body: { body: 'Delivery is here' } });
  await pushesSettled();
  assert.equal(pushesTo('karim')[0].title, 'omar · Downtown team');
  assert.equal(pushesTo('layla')[0].title, 'omar · فريق Downtown');
  assert.equal(pushesTo('karim')[0].tag, `thread-${store.id}`, 'one alert per conversation, replaced by the next');
});

test('a reminder is pushed too', async () => {
  sent.length = 0;
  const item = (await api('GET', '/api/checklists/library?standard=HACCP', { token: owner.token })).body.items[0];
  const tpl = (await api('POST', '/api/checklists/templates', { token: owner.token, body: { name: 'Line check', itemIds: [item.id] } })).body.template.id;
  await api('POST', '/api/checklists/assignments', { token: owner.token, body: { templateId: tpl, branchId: downtown, role: 'employee', dueTime: '09:00' } });
  // 09:00 in Cairo (UTC+2 in January) is 07:00Z.
  await sendDueReminders(new Date('2030-01-15T06:40:00Z'));
  await pushesSettled();
  assert.equal(pushesTo('omar')[0].title, 'Line check due at 09:00');
});

test('a subscription the push service has dropped is removed; signing out removes this browser’s', async () => {
  failWith = 410;
  const dm = (await api('POST', '/api/inbox/threads', { token: emp.token, body: { userId: mgr.userId } })).body.threadId;
  await api('POST', `/api/inbox/threads/${dm}/messages`, { token: emp.token, body: { body: 'hello' } });
  await pushesSettled();
  failWith = null;
  const { rows } = await pool.query('SELECT 1 FROM push_subscriptions WHERE endpoint = $1', [endpoint('karim')]);
  assert.equal(rows.length, 0);

  assert.equal((await api('POST', '/api/push/unsubscribe', { token: mgr.token, body: { endpoint: endpoint('omar') } })).status, 204);
  assert.equal((await pool.query('SELECT 1 FROM push_subscriptions WHERE endpoint = $1', [endpoint('omar')])).rows.length, 1,
    'only your own browser');
  await api('POST', '/api/push/unsubscribe', { token: emp.token, body: { endpoint: endpoint('omar') } });
  assert.equal((await pool.query('SELECT 1 FROM push_subscriptions WHERE endpoint = $1', [endpoint('omar')])).rows.length, 0);
});

test('without VAPID keys the option is off', async () => {
  const saved = process.env.VAPID_PRIVATE_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
  assert.equal((await api('GET', '/api/push/config', { token: emp.token })).body.publicKey, null);
  assert.equal((await api('POST', '/api/push/subscribe', { token: emp.token, body: { endpoint: endpoint('omar'), keys } })).status, 503);
  process.env.VAPID_PRIVATE_KEY = saved;
});

test('stores take a real time zone, which owners can change later', async () => {
  assert.equal((await api('POST', '/api/tenants/branches', { token: owner.token, body: { name: 'Moon', timezone: 'Mars/Olympus' } })).status, 400);
  const res = await api('PATCH', `/api/tenants/branches/${downtown}`, { token: owner.token, body: { timezone: 'Asia/Dubai', city: 'Dubai' } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.branch.timezone, 'Asia/Dubai');
  assert.equal((await api('PATCH', `/api/tenants/branches/${downtown}`, { token: owner.token, body: { timezone: 'Nowhere/Land' } })).status, 400);
  assert.equal((await api('PATCH', `/api/tenants/branches/${downtown}`, { token: mgr.token, body: { timezone: 'UTC' } })).status, 403);
  assert.equal((await api('PATCH', `/api/tenants/branches/${downtown}`, { token: owner.token, body: {} })).status, 400);

  const other = await api('POST', '/api/auth/signup', {
    body: { fullName: 'Other', email: 'push-other@example.com', password: 'OtherPass123', restaurantName: 'Elsewhere', country: 'Egypt', branchCount: 1, userCount: 1 },
  });
  assert.equal((await api('PATCH', `/api/tenants/branches/${downtown}`, { token: other.body.token, body: { timezone: 'UTC' } })).status, 404);
});
