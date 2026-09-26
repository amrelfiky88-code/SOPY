import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { resetTestDb, closeDb } from '../test-utils/db.js';
import { startTestServer, completeSetup } from '../test-utils/server.js';

// Every endpoint, sent the wrong shapes of data (numbers where text goes,
// lists, objects, null, very long strings, broken ids). A mistake by the
// client, or a crafted request, must get a 4xx answer, never a 500 crash.

// The full sweep (every field, several wrong values each) takes minutes;
// run it with FUZZ_FULL=1. The default keeps the most crash-prone shapes.
const FULL = process.env.FUZZ_FULL === '1';

let close, baseUrl, token;
const ids = {};

const FIELDS = [
  'name', 'fullName', 'email', 'password', 'role', 'status', 'branchIds', 'title', 'city', 'address',
  'templateId', 'branchId', 'assignmentId', 'userId', 'itemIds', 'kind', 'frequency', 'formData',
  'hasIncident', 'itemId', 'isCompliant', 'valueText', 'gpsLat', 'gpsLng', 'category', 'message',
  'pagePath', 'branchCount', 'userCount', 'businessType', 'onboardingStep', 'language', 'phone',
  'currentPassword', 'newPassword', 'inviteToken', 'restaurantName', 'country', 'referralCode',
  'dueTime', 'text', 'description', 'standard', 'isCritical', 'fileName', 'timezone', 'q', 'from',
  'to', 'before', 'limit', 'period', 'branches', 'users', 'critical',
];
const BAD = [null, 12345, -1, 1.5, true, [], ['x'], {}, { $gt: '' }, 'x'.repeat(5000), "' OR 1=1 --", '../../etc/passwd', '', 'NaN'];

const ROUTES = [
  ['POST', '/api/auth/signup'], ['POST', '/api/auth/login'], ['GET', '/api/auth/me'], ['PATCH', '/api/auth/me'],
  ['PATCH', '/api/auth/password'], ['POST', '/api/auth/accept-invite'], ['GET', '/api/auth/invite/:bad'],
  ['GET', '/api/billing/subscription'], ['PATCH', '/api/billing/subscription/quantities'], ['POST', '/api/billing/checkout'],
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
];
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
  await resetTestDb();
  const server = await startTestServer();
  close = server.close;
  baseUrl = server.baseUrl;
  const api = async (method, path, body) => {
    const res = await fetch(baseUrl + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) });
    return res.json();
  };
  const signup = await api('POST', '/api/auth/signup', {
    fullName: 'Fuzz', email: 'fuzz@example.com', password: 'FuzzPass123', restaurantName: 'Fuzz Cafe', country: 'Egypt', branchCount: 3, userCount: 5,
  });
  token = signup.token;
  await completeSetup((m, p, o = {}) => fetch(baseUrl + p, { method: m, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${o.token || token}` }, body: o.body && JSON.stringify(o.body) }).then(async (r) => ({ status: r.status, body: await r.json() })), token);
  ids.branch = (await api('POST', '/api/tenants/branches', { name: 'Main' })).branch.id;
  const item = (await api('GET', '/api/checklists/library?standard=HACCP')).items[0];
  ids.template = (await api('POST', '/api/checklists/templates', { name: 'One', itemIds: [item.id] })).template.id;
  ids.submission = (await api('POST', '/api/submissions', { templateId: ids.template, branchId: ids.branch })).submission.id;
  const kt = await api('POST', '/api/checklists/templates', { name: 'Kitchen Daily Report', kind: 'kitchen_daily', itemIds: [] });
  const done = (await api('POST', '/api/submissions', { templateId: kt.template.id, branchId: ids.branch })).submission.id;
  await api('POST', `/api/submissions/${done}/submit`, {});
  ids.done = done;
  const invite = await api('POST', '/api/tenants/users/invite', { fullName: 'Staff', email: 'fuzz-staff@example.com', role: 'employee' });
  ids.user = invite.user.id;
});

after(async () => {
  await close();
  await closeDb();
});

test('no endpoint crashes on malformed input', async () => {
  const crashes = [];
  const note = (status, what) => { if (typeof status !== 'number' || status >= 500) crashes.push(`${status} ${what}`); };
  for (const [method, pattern] of ROUTES) {
    const paths = pattern.includes(':bad')
      ? (FULL ? BAD_IDS : BAD_IDS.slice(0, 3)).map((b) => pattern.replace(':bad', encodeURIComponent(b)))
      : [pattern.replace(':template', ids.template).replace(':submission', ids.submission).replace(':done', ids.done).replace(':user', ids.user)];
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
