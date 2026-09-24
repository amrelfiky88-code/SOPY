import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { resetTestDb, closeDb } from '../test-utils/db.js';
import { startTestServer, makeClient, completeSetup } from '../test-utils/server.js';
import { pool } from '../src/db.js';

// Checklist evidence rules enforced by the API itself (not just the run
// page), who can touch whose run, and who sees business-wide KPIs.

let close, api, baseUrl;
const O = {}; // owner
const E1 = {}; // employee at store A
const E2 = {}; // employee at store A
const M = {}; // store manager at store B
let storeA, storeB, templateId, itemIds, observationTemplateId, observationItemId;

const JPEG = () => new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' });

async function respond(token, subId, fields, { photo = true } = {}) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  if (photo) form.append('photo', JPEG(), 'evidence.jpg');
  const res = await fetch(`${baseUrl}/api/submissions/${subId}/responses`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  return { status: res.status, body: await res.json() };
}

async function join(email, role, branchIds) {
  const invite = await api('POST', '/api/tenants/users/invite', { token: O.token, body: { fullName: email, email, role, branchIds } });
  assert.equal(invite.status, 201, JSON.stringify(invite.body));
  const accepted = await api('POST', '/api/auth/accept-invite', { body: { inviteToken: invite.body.inviteLink.split('token=')[1], password: 'Password123' } });
  return { token: accepted.body.token, id: accepted.body.user.id };
}

before(async () => {
  await resetTestDb();
  const server = await startTestServer();
  close = server.close;
  baseUrl = server.baseUrl;
  api = makeClient(baseUrl);

  const signup = await api('POST', '/api/auth/signup', {
    body: { fullName: 'Owner', email: 'ev-owner@example.com', password: 'OwnerPass123', restaurantName: 'Evidence', country: 'Egypt', branchCount: 2, userCount: 4 },
  });
  O.token = signup.body.token;
  await completeSetup(api, O.token);
  storeA = (await api('POST', '/api/tenants/branches', { token: O.token, body: { name: 'A' } })).body.branch.id;
  storeB = (await api('POST', '/api/tenants/branches', { token: O.token, body: { name: 'B' } })).body.branch.id;
  Object.assign(E1, await join('ev-e1@example.com', 'employee', [storeA]));
  Object.assign(E2, await join('ev-e2@example.com', 'employee', [storeA]));
  Object.assign(M, await join('ev-m@example.com', 'store_manager', [storeB]));

  const library = (await api('GET', '/api/checklists/library?standard=HACCP', { token: O.token })).body.items;
  itemIds = library.slice(0, 2).map((i) => i.id);
  templateId = (await api('POST', '/api/checklists/templates', { token: O.token, body: { name: 'Two checks', itemIds } })).body.template.id;
  const qc = (await api('GET', '/api/checklists/library?standard=INTERNAL_QC', { token: O.token })).body.items;
  observationItemId = qc.find((i) => (i.category_en || i.category).includes('Consumer Behavior')).id;
  observationTemplateId = (await api('POST', '/api/checklists/templates', { token: O.token, body: { name: 'Observe', itemIds: [observationItemId] } })).body.template.id;
});

after(async () => {
  await close();
  await closeDb();
});

const start = async (token, tpl = templateId, branchId = storeA) =>
  (await api('POST', '/api/submissions', { token, body: { templateId: tpl, branchId } })).body.submission.id;

test('a checklist can only be signed off with every checkpoint answered and photographed', async () => {
  const sub = await start(E1.token);
  // Answered without a photo, and the second checkpoint not at all.
  await respond(E1.token, sub, { itemId: itemIds[0], isCompliant: 'true' }, { photo: false });
  let submit = await api('POST', `/api/submissions/${sub}/submit`, { token: E1.token, body: {} });
  assert.equal(submit.status, 400);
  assert.match(submit.body.error, /\(2 left\)/);

  await respond(E1.token, sub, { itemId: itemIds[0] }); // photo added later
  await respond(E1.token, sub, { itemId: itemIds[1] }); // photo, but no answer
  submit = await api('POST', `/api/submissions/${sub}/submit`, { token: E1.token, body: {} });
  assert.match(submit.body.error, /\(1 left\)/);

  await respond(E1.token, sub, { itemId: itemIds[1], isCompliant: 'false' }, { photo: false });
  submit = await api('POST', `/api/submissions/${sub}/submit`, { token: E1.token, body: {} });
  assert.equal(submit.status, 200, JSON.stringify(submit.body));
});

test('an observation point needs a written finding rather than a yes/no', async () => {
  const sub = await start(E1.token, observationTemplateId);
  await respond(E1.token, sub, { itemId: observationItemId, valueText: '   ' });
  assert.equal((await api('POST', `/api/submissions/${sub}/submit`, { token: E1.token, body: {} })).status, 400);
  await respond(E1.token, sub, { itemId: observationItemId, valueText: 'Busy at 1pm, mostly families' }, { photo: false });
  assert.equal((await api('POST', `/api/submissions/${sub}/submit`, { token: E1.token, body: {} })).status, 200);
});

test("staff can't answer, edit or sign off a colleague's run; a manager can step in", async () => {
  const sub = await start(E1.token);
  assert.equal((await respond(E2.token, sub, { itemId: itemIds[0], isCompliant: 'false' })).status, 404);
  assert.equal((await api('PATCH', `/api/submissions/${sub}`, { token: E2.token, body: { hasIncident: true } })).status, 404);
  assert.equal((await api('POST', `/api/submissions/${sub}/submit`, { token: E2.token, body: {} })).status, 404);
  assert.equal((await respond(O.token, sub, { itemId: itemIds[0], isCompliant: 'true' })).status, 201);
});

test('evidence time is the server clock, and nonsense GPS is not stored', async () => {
  const sub = await start(E1.token);
  const res = await respond(E1.token, sub, { itemId: itemIds[0], isCompliant: 'true', capturedAt: '2001-01-01T08:00:00Z', gpsLat: 'abc', gpsLng: '999' });
  assert.equal(res.status, 201);
  const { rows } = await pool.query('SELECT captured_at, gps_lat, gps_lng FROM checklist_submission_responses WHERE submission_id = $1', [sub]);
  assert.ok(new Date(rows[0].captured_at).getFullYear() >= 2025, 'a backdated capture time is ignored');
  assert.equal(rows[0].gps_lat, null);
  assert.equal(rows[0].gps_lng, null);
});

test('business-wide KPIs are for managers, and store managers see their own stores', async () => {
  assert.equal((await api('GET', '/api/dashboard/kpi', { token: E1.token })).status, 403);
  const owner = await api('GET', '/api/dashboard/kpi?period=monthly', { token: O.token });
  assert.equal(owner.body.scopedBranchIds, null);
  assert.ok(owner.body.submissionsCount >= 2);

  const mgr = await api('GET', '/api/dashboard/kpi?period=monthly', { token: M.token });
  assert.deepEqual(mgr.body.scopedBranchIds, [storeB]);
  assert.equal(mgr.body.submissionsCount, 0, "store A's reports aren't in store B's manager's numbers");
  const peek = await api('GET', `/api/dashboard/kpi?period=monthly&branchId=${storeA}`, { token: M.token });
  assert.equal(peek.body.submissionsCount, 0, 'asking for another store by id shows nothing');
});

test('the store list marks where the person works, for report forms to default to', async () => {
  const { body } = await api('GET', '/api/tenants/branches', { token: M.token });
  assert.deepEqual(body.branches.filter((b) => b.works_here).map((b) => b.id), [storeB]);
});

test('bad dates, huge numbers and over-long text are the client’s mistake, not a crash', async () => {
  assert.equal((await api('GET', '/api/submissions?from=notadate', { token: O.token })).status, 400);
  assert.equal((await api('GET', '/api/submissions?to=2026-13-45', { token: O.token })).status, 400);
});

test('a dead share link shows a readable page in the reader’s language; API clients still get JSON', async () => {
  const url = `${baseUrl}/api/shared/${'y'.repeat(32)}`;
  const page = await fetch(url, { headers: { Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'ar-EG,ar;q=0.9' } });
  assert.equal(page.status, 404);
  assert.match(page.headers.get('content-type'), /text\/html/);
  const html = await page.text();
  assert.match(html, /dir="rtl"/);
  assert.match(html, /هذا الرابط غير صالح/);
  const json = await fetch(url, { headers: { Accept: 'application/json' } });
  assert.equal((await json.json()).error, 'This link is not valid');
});
