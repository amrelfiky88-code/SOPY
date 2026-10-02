import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { resetTestDb, closeDb } from '../test-utils/db.js';
import { startTestServer, completeSetup } from '../test-utils/server.js';
import webpush from 'web-push';
import { setPushSender } from '../src/push.js';

// Every endpoint, sent the wrong shapes of data (numbers where text goes,
// lists, objects, null, very long strings, broken ids). A mistake by the
// client, or a crafted request, must get a 4xx answer, never a 500 crash.

// The full sweep (every field, several wrong values each) takes minutes;
// run it with FUZZ_FULL=1. The default keeps the most crash-prone shapes.
const FULL = process.env.FUZZ_FULL === '1';

let close, baseUrl, token, realFetch;
const ids = {};

const FIELDS = [
  'name', 'fullName', 'email', 'password', 'role', 'status', 'branchIds', 'title', 'city', 'address',
  'templateId', 'branchId', 'assignmentId', 'userId', 'itemIds', 'kind', 'frequency', 'formData',
  'hasIncident', 'itemId', 'isCompliant', 'valueText', 'gpsLat', 'gpsLng', 'category', 'message',
  'pagePath', 'branchCount', 'userCount', 'businessType', 'onboardingStep', 'language', 'phone',
  'currentPassword', 'newPassword', 'inviteToken', 'restaurantName', 'country', 'referralCode',
  'dueTime', 'text', 'description', 'standard', 'isCritical', 'fileName', 'timezone', 'q', 'from',
  'to', 'before', 'limit', 'libraryGroup', 'period', 'branches', 'users', 'critical', 'group', 'body', 'notifyIncidents', 'notifyReminders', 'endpoint', 'keys',
];
const BAD = [null, 12345, -1, 1.5, true, [], ['x'], {}, { $gt: '' }, 'x'.repeat(5000), "' OR 1=1 --", '../../etc/passwd', '', 'NaN'];

const ROUTES = [
  ['POST', '/api/auth/signup'], ['POST', '/api/auth/login'], ['GET', '/api/auth/me'], ['PATCH', '/api/auth/me'],
  ['PATCH', '/api/auth/password'], ['POST', '/api/auth/accept-invite'], ['GET', '/api/auth/invite/:bad'],
  ['GET', '/api/billing/subscription'], ['PATCH', '/api/billing/subscription/quantities'], ['POST', '/api/billing/checkout'],
  ['POST', '/api/billing/paymob/webhook'], ['POST', '/api/billing/paymob/return'], ['POST', '/api/billing/paymob/renew'],
  ['GET', '/api/checklists/library'], ['POST', '/api/checklists/library'], ['GET', '/api/checklists/templates'],
  ['GET', '/api/checklists/templates/:bad'], ['GET', '/api/checklists/templates/:template'], ['POST', '/api/checklists/templates'],
  ['GET', '/api/checklists/assignments'], ['POST', '/api/checklists/assignments'], ['GET', '/api/checklists/my-assignments'],
  ['DELETE', '/api/checklists/assignments/:bad'], ['DELETE', '/api/checklists/templates/:bad'],
  ['GET', '/api/dashboard/kpi'], ['GET', '/api/dashboard/summary'], ['POST', '/api/feedback'],
  ['GET', '/api/onboarding/status'], ['GET', '/api/pricing/calculate'], ['GET', '/api/referrals'], ['GET', '/api/shared/:bad'],
  ['GET', '/api/submissions'], ['GET', '/api/submissions/draft'], ['POST', '/api/submissions'],
  ['GET', '/api/submissions/:bad'], ['GET', '/api/submissions/:bad/report'], ['GET', '/api/submissions/:bad/scorecard'],
  ['PATCH', '/api/submissions/:submission'], ['POST', '/api/submissions/:submission/responses'],
  ['POST', '/api/submissions/:submission/submit'], ['POST', '/api/submissions/:done/share'],
  ['GET', '/api/tenants/branches'], ['GET', '/api/tenants/cities'], ['GET', '/api/tenants/current'], ['GET', '/api/tenants/people'],
  ['GET', '/api/tenants/users'], ['PATCH', '/api/tenants/current'], ['PATCH', '/api/tenants/users/:bad'],
  ['PATCH', '/api/tenants/users/:user'], ['POST', '/api/tenants/branches'], ['POST', '/api/tenants/users/:bad/reset-link'],
  ['POST', '/api/tenants/users/invite'], ['DELETE', '/api/tenants/branches/:bad'],
  ['POST', '/api/checklists/library/run'], ['GET', '/api/checklists/library/groups'], ['GET', '/api/inbox/threads'], ['GET', '/api/inbox/summary'], ['POST', '/api/inbox/threads'],
  ['GET', '/api/inbox/threads/:bad'], ['GET', '/api/inbox/threads/:thread'], ['POST', '/api/inbox/threads/:bad/messages'],
  ['POST', '/api/inbox/threads/:thread/messages'], ['POST', '/api/inbox/threads/:bad/read'], ['GET', '/api/notifications'],
  ['POST', '/api/notifications/read-all'], ['POST', '/api/notifications/:bad/read'],
  ['GET', '/api/push/config'], ['POST', '/api/push/subscribe'], ['POST', '/api/push/unsubscribe'],
  ['PATCH', '/api/tenants/branches/:bad'], ['PATCH', '/api/tenants/branches/:branch'],
];
// A valid body for each write endpoint. The deep pass below swaps one of
// its fields at a time for a wrong shape, so the bad value gets past the
// "missing fields" checks and into the code that uses it. (A store list
// sent as text used to crash an invite this way.)
const VALID = {
  'PATCH /api/auth/me': () => ({ fullName: 'A', title: 'Chef', phone: '123', language: 'en', notifyIncidents: true, notifyReminders: true }),
  'PATCH /api/billing/subscription/quantities': () => ({ branchCount: 50, userCount: 200 }),
  'POST /api/billing/checkout': () => ({ method: 'paymob' }),
  'POST /api/billing/paymob/webhook': () => ({ type: 'TRANSACTION', hmac: 'a'.repeat(128), obj: { id: 1, amount_cents: 100, currency: 'EGP', success: true, order: { id: 1, merchant_order_id: 'x' }, source_data: { pan: '1' } } }),
  'POST /api/billing/paymob/return': () => ({ id: '1', success: 'true', amount_cents: '100', currency: 'EGP', order: '1', merchant_order_id: 'x', hmac: 'a'.repeat(128) }),
  'POST /api/checklists/library': () => ({ text: 'T', description: 'D', category: 'C', standard: 'CUSTOM', requiresPhoto: true, isCritical: false }),
  'POST /api/checklists/templates': () => ({ name: 'N', itemIds: [ids.item], frequency: 'daily', kind: 'custom' }),
  'POST /api/checklists/assignments': () => ({ templateId: ids.template, branchId: ids.branch, role: 'employee', dueTime: '09:00' }),
  'POST /api/feedback': () => ({ category: 'bug', message: 'm', pagePath: '/app' }),
  'POST /api/submissions': () => ({ templateId: ids.template, branchId: ids.branch }),
  'PATCH /api/submissions/:submission': () => ({ formData: { a: '1' }, hasIncident: false }),
  'POST /api/submissions/:submission/responses': () => ({ itemId: ids.item, isCompliant: 'true', valueText: 'x', gpsLat: 1, gpsLng: 1 }),
  'POST /api/submissions/:submission/submit': () => ({ gpsLat: 1, gpsLng: 1 }),
  'PATCH /api/tenants/current': () => ({ branchCount: 50, userCount: 200, businessType: 'restaurant' }),
  'PATCH /api/tenants/users/:user': () => ({ role: 'employee', status: 'active', branchIds: [ids.branch], title: 'Chef' }),
  'POST /api/tenants/branches': () => ({ name: 'S', address: 'a', city: 'c', timezone: 'UTC' }),
  'POST /api/checklists/library/run': () => ({ group: 'SOP 1: Opening', branchId: ids.branch }),
  'POST /api/push/subscribe': () => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA', auth: 'tBHItJI5svbpez7KI4CCXg' } }),
  'POST /api/push/unsubscribe': () => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/abc' }),
  'PATCH /api/tenants/branches/:branch': () => ({ name: 'Main', city: 'Cairo', timezone: 'Africa/Cairo' }),
  'POST /api/inbox/threads': () => ({ userId: ids.user }),
  'POST /api/inbox/threads/:thread/messages': () => ({ body: 'Hello' }),
  'POST /api/tenants/users/invite': () => ({ fullName: 'I', email: `deep${++deepInvites}@example.com`, role: 'employee', branchIds: [ids.branch], title: 'Chef' }),
};
let deepInvites = 0;
const DEEP_BAD = FULL ? BAD : ['x', 12345, {}, null, ['x'], [12345]];

const BAD_IDS = ['not-a-uuid', '00000000-0000-0000-0000-000000000000', "1' OR '1'='1", '%00', 'x'.repeat(300)];

async function call(method, path, { body, query, raw } = {}) {
  const url = new URL(baseUrl + path);
  for (const [k, v] of Object.entries(query || {})) url.searchParams.set(k, typeof v === 'string' ? v : JSON.stringify(v));
  let res;
  try {
    res = await fetch(url, {
    signal: AbortSignal.timeout(5000),
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body !== undefined || raw !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined,
    });
    await res.text();
  } catch (err) {
    return err.name === 'TimeoutError' ? 'HANG' : 'RESET';
  }
  return res.status;
}

before(async () => {
  // Paymob on, with its API stubbed, so its routes run past the set-up check.
  // Phone notifications on too, with a fake push service.
  const vapid = webpush.generateVAPIDKeys();
  Object.assign(process.env, { VAPID_PUBLIC_KEY: vapid.publicKey, VAPID_PRIVATE_KEY: vapid.privateKey });
  setPushSender(async () => {});
  Object.assign(process.env, { PAYMOB_SECRET_KEY: 'sk', PAYMOB_PUBLIC_KEY: 'pk', PAYMOB_INTEGRATION_IDS: '1', PAYMOB_HMAC_SECRET: 'h', PAYMOB_EGP_PER_USD: '50' });
  realFetch = globalThis.fetch;
  let n = 0;
  globalThis.fetch = (url, init) => (String(url).includes('paymob.com')
    ? Promise.resolve(new Response(JSON.stringify({ client_secret: `cs_${++n}`, intention_order_id: n }), { status: 201 }))
    : realFetch(url, init));
  await resetTestDb();
  const server = await startTestServer();
  close = server.close;
  baseUrl = server.baseUrl;
  const api = async (method, path, body) => {
    const res = await fetch(baseUrl + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) });
    return res.json();
  };
  const signup = await api('POST', '/api/auth/signup', {
    fullName: 'Fuzz', email: 'fuzz@example.com', password: 'FuzzPass123', restaurantName: 'Fuzz Cafe', country: 'Egypt', branchCount: 50, userCount: 200,
  });
  token = signup.token;
  await completeSetup((m, p, o = {}) => fetch(baseUrl + p, { method: m, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${o.token || token}` }, body: o.body && JSON.stringify(o.body) }).then(async (r) => ({ status: r.status, body: await r.json() })), token);
  ids.branch = (await api('POST', '/api/tenants/branches', { name: 'Main' })).branch.id;
  const item = (await api('GET', '/api/checklists/library?standard=HACCP')).items[0];
  ids.item = item.id;
  ids.template = (await api('POST', '/api/checklists/templates', { name: 'One', itemIds: [item.id] })).template.id;
  ids.submission = (await api('POST', '/api/submissions', { templateId: ids.template, branchId: ids.branch })).submission.id;
  const kt = await api('POST', '/api/checklists/templates', { name: 'Kitchen Daily Report', kind: 'kitchen_daily', itemIds: [] });
  const done = (await api('POST', '/api/submissions', { templateId: kt.template.id, branchId: ids.branch })).submission.id;
  await api('POST', `/api/submissions/${done}/submit`, {});
  ids.done = done;
  const invite = await api('POST', '/api/tenants/users/invite', { fullName: 'Staff', email: 'fuzz-staff@example.com', role: 'employee' });
  ids.user = invite.user.id;
  // An active teammate to message, for the inbox routes.
  const accepted = await api('POST', '/api/auth/accept-invite', { inviteToken: invite.inviteLink.split('token=')[1], password: 'StaffPass123' });
  ids.thread = (await fetch(baseUrl + '/api/inbox/threads', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accepted.token}` }, body: JSON.stringify({ userId: signup.user.id }) }).then((r) => r.json())).threadId;
});

after(async () => {
  globalThis.fetch = realFetch;
  for (const k of ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY']) delete process.env[k];
  for (const k of ['PAYMOB_SECRET_KEY', 'PAYMOB_PUBLIC_KEY', 'PAYMOB_INTEGRATION_IDS', 'PAYMOB_HMAC_SECRET', 'PAYMOB_EGP_PER_USD']) delete process.env[k];
  await close();
  await closeDb();
});

test('no endpoint crashes on malformed input', async () => {
  const crashes = [];
  const note = (status, what) => { if (typeof status !== 'number' || status >= 500) crashes.push(`${status} ${what}`); };
  for (const [method, pattern] of ROUTES) {
    const paths = pattern.includes(':bad')
      ? (FULL ? BAD_IDS : BAD_IDS.slice(0, 3)).map((b) => pattern.replace(':bad', encodeURIComponent(b)))
      : [pattern.replace(':template', ids.template).replace(':submission', ids.submission).replace(':done', ids.done).replace(':user', ids.user).replace(':thread', ids.thread).replace(':branch', ids.branch)];
    for (const path of paths) {
      const label = `${method} ${path.slice(0, 80)}`;
      if (method === 'GET' || method === 'DELETE') {
        // (A long value in every field at once is past the web server's URL size limit.)
        for (const v of BAD.filter((b) => !(typeof b === 'string' && b.length > 100))) note(await call(method, path, { query: Object.fromEntries(FIELDS.map((f) => [f, v])) }), `${label} ?all=${JSON.stringify(v).slice(0, 20)}`);
        if (FULL && !pattern.includes(':bad')) for (const f of FIELDS) note(await call(method, path, { query: { [f]: 'x'.repeat(2000) } }), `${label} ?${f}=long`);
        note(await call(method, path), label);
        continue;
      }
      note(await call(method, path, { body: {} }), `${label} {}`);
      note(await call(method, path, { raw: '{not json' }), `${label} broken JSON`);
      note(await call(method, path, { raw: '[1,2]' }), `${label} array body`);
      note(await call(method, path, { raw: '"text"' }), `${label} string body`);
      for (const v of FULL ? BAD : BAD.filter((b, i) => i % 2 === 0 || typeof b === 'string')) {
        note(await call(method, path, { body: Object.fromEntries(FIELDS.map((f) => [f, v])) }), `${label} all=${JSON.stringify(v).slice(0, 20)}`);
      }
      const valid = VALID[`${method} ${pattern}`];
      if (valid) {
        for (const f of Object.keys(valid())) {
          for (const v of DEEP_BAD) note(await call(method, path, { body: { ...valid(), [f]: v } }), `${label} valid but ${f}=${JSON.stringify(v).slice(0, 20)}`);
        }
      }
      // One field wrong at a time, next to otherwise plausible values.
      // (Sign-up and login hash the password on every call, so they only
      // get this in the full run.)
      if (!FULL && (pattern.includes(':bad') || /auth\/(signup|login|accept-invite|password)/.test(path))) continue;
      for (const f of FIELDS) {
        for (const v of FULL ? [null, 12345, [], {}, 'x'.repeat(5000)] : [{}]) {
          note(await call(method, path, { body: { name: 'A', fullName: 'A', email: 'a@example.com', password: 'Password123', templateId: ids.template, branchId: ids.branch, itemId: 'x', [f]: v } }), `${label} ${f}=${JSON.stringify(v).slice(0, 20)}`);
        }
      }
    }
  }
  assert.deepEqual(crashes.slice(0, 40), [], `${crashes.length} crashes`);
});
