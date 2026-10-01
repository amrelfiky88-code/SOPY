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
    body: { fullName: 'Owner', email: 'ev-owner@example.com', password: 'OwnerPass123', restaurantName: 'Evidence', country: 'Egypt', branchCount: 2, userCount: 5 },
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

// Regression: a store manager's KPIs covered only their store, but they
// could list and open every store's reports.
test('store managers see the reports of their own stores only', async () => {
  const list = await api('GET', '/api/submissions', { token: M.token });
  assert.equal(list.status, 200);
  assert.ok(list.body.submissions.every((s) => s.branch_id === storeB || s.submitted_by === M.id), 'nothing from store A');

  const ownerList = await api('GET', `/api/submissions?branchId=${storeA}&status=submitted`, { token: O.token });
  const fromA = ownerList.body.submissions[0];
  assert.ok(fromA, 'store A has a submitted report to test with');
  for (const path of [`/api/submissions/${fromA.id}`, `/api/submissions/${fromA.id}/report`, `/api/submissions/${fromA.id}/scorecard`]) {
    assert.equal((await api('GET', path, { token: M.token })).status, 404, path);
  }
  assert.equal((await api('GET', `/api/submissions/${fromA.id}/report`, { token: O.token })).status, 200);
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

test('invite and password-reset links expire; a manager can issue a fresh invite', async () => {
  const invite = await api('POST', '/api/tenants/users/invite', { token: O.token, body: { fullName: 'Late', email: 'ev-late@example.com', role: 'employee', branchIds: [storeA] } });
  const lateId = invite.body.user.id;
  const oldToken = invite.body.inviteLink.split('token=')[1];
  // Two weeks pass without the invite being used.
  await pool.query("UPDATE users SET invite_expires_at = now() - interval '1 minute' WHERE id = $1", [lateId]);
  const stale = await api('POST', '/api/auth/accept-invite', { body: { inviteToken: oldToken, password: 'Password123' } });
  assert.equal(stale.status, 410);
  assert.match(stale.body.error, /expired/);

  const fresh = await api('POST', `/api/tenants/users/${lateId}/reset-link`, { token: O.token, body: {} });
  assert.equal(fresh.status, 201);
  assert.equal(fresh.body.kind, 'invite');
  assert.ok(new Date(fresh.body.expiresAt) - Date.now() > 13 * 24 * 3600 * 1000, 'a new invite lasts 14 days');
  const joined = await api('POST', '/api/auth/accept-invite', { body: { inviteToken: fresh.body.resetLink.split('token=')[1], password: 'Password123' } });
  assert.equal(joined.status, 200);

  const reset = await api('POST', `/api/tenants/users/${lateId}/reset-link`, { token: O.token, body: {} });
  assert.equal(reset.body.kind, 'reset');
  const hours = (new Date(reset.body.expiresAt) - Date.now()) / 3600e3;
  assert.ok(hours > 47 && hours <= 48, 'a password reset lasts 48 hours');
});

test('expired shared PDFs are deleted from disk, and the link still says expired', async () => {
  const fsMod = await import('node:fs');
  const pathMod = await import('node:path');
  const { SHARE_ROOT, sweepExpiredShares } = await import('../src/shares.js');
  const sub = await start(E1.token);
  await respond(E1.token, sub, { itemId: itemIds[0], isCompliant: 'true' });
  await respond(E1.token, sub, { itemId: itemIds[1], isCompliant: 'true' });
  assert.equal((await api('POST', `/api/submissions/${sub}/submit`, { token: E1.token, body: {} })).status, 200);
  const form = new FormData();
  form.append('pdf', new Blob([Buffer.from('%PDF-1.4 test')], { type: 'application/pdf' }), 'r.pdf');
  const share = await fetch(`${baseUrl}/api/submissions/${sub}/share`, { method: 'POST', headers: { Authorization: `Bearer ${E1.token}` }, body: form }).then((r) => r.json());
  const token = share.path.split('/').pop();
  const file = pathMod.join(SHARE_ROOT, `${token}.pdf`);
  assert.ok(fsMod.existsSync(file));

  await pool.query("UPDATE report_shares SET expires_at = now() - interval '1 day' WHERE token = $1", [token]);
  assert.ok((await sweepExpiredShares({ force: true })) >= 1);
  assert.equal(fsMod.existsSync(file), false, 'the report is gone from disk');
  const res = await fetch(`${baseUrl}${share.path}`, { headers: { Accept: 'application/json' } });
  assert.equal(res.status, 410);
});

test("staff can't read a colleague's run, its score, the staff list or the assignment setup", async () => {
  const sub = await start(E1.token);
  await respond(E1.token, sub, { itemId: itemIds[0], isCompliant: 'true' });
  assert.equal((await api('GET', `/api/submissions/${sub}`, { token: E2.token })).status, 404);
  assert.equal((await api('GET', `/api/submissions/${sub}/scorecard`, { token: E2.token })).status, 404);
  assert.equal((await api('GET', `/api/submissions/${sub}`, { token: E1.token })).status, 200, 'their own is fine');
  assert.equal((await api('GET', `/api/submissions/${sub}`, { token: O.token })).status, 200, 'the owner sees every store’s');
  assert.equal((await api('GET', `/api/submissions/${sub}`, { token: M.token })).status, 404, 'a store manager sees only their own stores’');
  assert.equal((await api('GET', '/api/tenants/users', { token: E1.token })).status, 403);
  assert.equal((await api('GET', '/api/checklists/assignments', { token: E1.token })).status, 403);
  assert.equal((await api('GET', '/api/tenants/users', { token: O.token })).status, 200);
});

test('the reports list pages through every report, newest submitted first, without form data', async () => {
  // Several finished runs for E1.
  for (let n = 0; n < 3; n++) {
    const sub = await start(E1.token);
    await respond(E1.token, sub, { itemId: itemIds[0], isCompliant: 'true' });
    await respond(E1.token, sub, { itemId: itemIds[1], isCompliant: 'true' });
    await api('POST', `/api/submissions/${sub}/submit`, { token: E1.token, body: {} });
  }
  const seen = [];
  let before = null;
  do {
    const q = new URLSearchParams({ status: 'submitted', limit: '2', ...(before ? { before } : {}) });
    const page = await api('GET', `/api/submissions?${q}`, { token: O.token });
    assert.equal(page.status, 200, JSON.stringify(page.body));
    assert.ok(page.body.submissions.length <= 2);
    assert.ok(page.body.submissions.every((s) => !('form_data' in s)));
    seen.push(...page.body.submissions);
    before = page.body.nextBefore;
  } while (before);
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM checklist_submissions s JOIN users u ON u.id = s.submitted_by WHERE u.tenant_id = (SELECT tenant_id FROM users WHERE email = 'ev-owner@example.com') AND s.status = 'submitted'");
  assert.equal(seen.length, rows[0].n, 'every report is reachable');
  assert.equal(new Set(seen.map((s) => s.id)).size, seen.length, 'no duplicates across pages');
  const times = seen.map((s) => new Date(s.submitted_at).getTime());
  assert.deepEqual(times, [...times].sort((a, b) => b - a), 'newest submitted first');
  assert.equal((await api('GET', '/api/submissions?status=bogus', { token: O.token })).status, 400);
});

test('reports filed within the same millisecond all show up when paging', async () => {
  // Postgres keeps microseconds; a cursor rounded to milliseconds skipped
  // the reports that fell between the rounded and the real time.
  await pool.query(
    `UPDATE checklist_submissions s SET submitted_at = timestamptz '2026-01-01 10:00:00.123' + (n.rn * interval '100 microseconds')
     FROM (SELECT id, row_number() OVER (ORDER BY id) AS rn FROM checklist_submissions WHERE status = 'submitted') n
     WHERE s.id = n.id`
  );
  const seen = [];
  let before = null;
  do {
    const q = new URLSearchParams({ status: 'submitted', limit: '1', ...(before ? { before } : {}) });
    const page = await api('GET', `/api/submissions?${q}`, { token: O.token });
    assert.equal(page.status, 200, JSON.stringify(page.body));
    assert.ok(page.body.submissions.every((s) => !('cursor_at' in s)));
    seen.push(...page.body.submissions);
    before = page.body.nextBefore;
  } while (before && seen.length < 100);
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM checklist_submissions s JOIN users u ON u.id = s.submitted_by WHERE u.tenant_id = (SELECT tenant_id FROM users WHERE email = 'ev-owner@example.com') AND s.status = 'submitted'");
  assert.ok(rows[0].n >= 3);
  assert.equal(seen.length, rows[0].n, 'every report is reachable');
  assert.equal(new Set(seen.map((s) => s.id)).size, seen.length, 'no duplicates across pages');
});

test('names and details have sensible length limits', async () => {
  const long = 'x'.repeat(500);
  const signup = await api('POST', '/api/auth/signup', { body: { fullName: long, email: 'long@example.com', password: 'OwnerPass123', restaurantName: 'L', country: 'Egypt' } });
  assert.equal(signup.status, 400);
  assert.equal((await api('PATCH', '/api/auth/me', { token: E1.token, body: { fullName: long } })).status, 400);
  assert.equal((await api('PATCH', '/api/auth/me', { token: E1.token, body: { phone: '1'.repeat(60) } })).status, 400);
  assert.equal((await api('PATCH', '/api/auth/me', { token: E1.token, body: { title: 'Line cook' } })).status, 200);
});

test('correcting a mis-tapped critical failure clears the incident flag', async () => {
  const critical = (await api('GET', '/api/checklists/library?critical=true', { token: O.token })).body.items[0];
  const tpl = (await api('POST', '/api/checklists/templates', { token: O.token, body: { name: 'Critical one', itemIds: [critical.id] } })).body.template.id;
  const sub = await start(E1.token, tpl);
  const incident = async () => (await pool.query('SELECT has_incident FROM checklist_submissions WHERE id = $1', [sub])).rows[0].has_incident;
  await respond(E1.token, sub, { itemId: critical.id, isCompliant: 'false' });
  assert.equal(await incident(), true, 'a critical failure flags the run');
  await respond(E1.token, sub, { itemId: critical.id, isCompliant: 'true' }, { photo: false });
  assert.equal(await incident(), false, 'corrected, it is no longer an incident');
  await respond(E1.token, sub, { itemId: critical.id, valueText: 'note only' }, { photo: false });
  assert.equal(await incident(), false, 'a note-only save leaves it alone');
});

test("a daily report can't be assigned as a checklist (it has no checkpoints to run)", async () => {
  const kitchen = (await api('POST', '/api/checklists/templates', { token: O.token, body: { name: 'Kitchen', kind: 'kitchen_daily', itemIds: [] } })).body.template.id;
  const res = await api('POST', '/api/checklists/assignments', { token: O.token, body: { templateId: kitchen } });
  assert.equal(res.status, 400);
  assert.equal((await api('POST', '/api/checklists/assignments', { token: O.token, body: { templateId } })).status, 201);
});

// Regression: sorted by name, the convenience-store section (C_STORE)
// opened every restaurant's Checklist Builder.
test('the library lists standards in the Builder filter order', async () => {
  const { items } = (await api('GET', '/api/checklists/library', { token: O.token })).body;
  const order = [...new Set(items.map((i) => i.standard))];
  assert.equal(order[0], 'HACCP');
  assert.ok(order.indexOf('C_STORE') > order.indexOf('SOP'), order.join(','));
});

// Regression: any assignment id was accepted when starting a run, so a
// short checklist could be submitted against a long one's assignment and
// show it "Done". The run must match the assignment's checklist and store.
test('a run only counts toward a live assignment of the same checklist and store', async () => {
  const assigned = await api('POST', '/api/checklists/assignments', { token: O.token, body: { templateId, branchId: storeA } });
  const assignmentId = assigned.body.assignment.id;
  const startWith = (body) => api('POST', '/api/submissions', { token: E1.token, body: { assignmentId, ...body } });

  assert.equal((await startWith({ templateId: observationTemplateId, branchId: storeA })).status, 404, 'another checklist');
  assert.equal((await startWith({ templateId, branchId: storeB })).status, 404, 'another store');
  assert.equal((await startWith({ templateId, branchId: storeA })).status, 201);

  await api('DELETE', `/api/checklists/assignments/${assignmentId}`, { token: O.token });
  assert.equal((await api('POST', '/api/submissions', { token: E2.token, body: { assignmentId, templateId, branchId: storeA } })).status, 404, 'a removed assignment');
});

// Shared phones: nothing from the API may sit in the browser's cache for
// the next account signed in.
test('API responses are never cached by the browser', async () => {
  const res = await fetch(`${baseUrl}/api/tenants/branches`, { headers: { Authorization: `Bearer ${O.token}` } });
  assert.equal(res.headers.get('cache-control'), 'no-store');
});

// Regression: area managers have the Checklist Builder (and can assign
// checklists) but were refused when they saved one.
test('area managers can build checklists; staff and store managers cannot', async () => {
  await api('PATCH', '/api/billing/subscription/quantities', { token: O.token, body: { branchCount: 2, userCount: 10 } });
  const area = await join('ev-area@example.com', 'area_manager', [storeA, storeB]);
  const body = { name: 'Area checks', itemIds };
  const made = await api('POST', '/api/checklists/templates', { token: area.token, body });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  assert.equal((await api('POST', '/api/checklists/templates', { token: M.token, body })).status, 403);
  assert.equal((await api('POST', '/api/checklists/templates', { token: E1.token, body })).status, 403);
});

// The declared file type is the client's word: a web page labelled
// image/jpeg was stored as evidence. The file itself must be a photo.
test('only real JPEG or PNG files count as evidence photos', async () => {
  const sub = await start(E1.token);
  const form = new FormData();
  form.append('itemId', itemIds[0]);
  form.append('isCompliant', 'true');
  form.append('photo', new Blob(['<html><script>alert(1)</script></html>'], { type: 'image/jpeg' }), 'evidence.jpg');
  const fake = await fetch(`${baseUrl}/api/submissions/${sub}/responses`, { method: 'POST', headers: { Authorization: `Bearer ${E1.token}` }, body: form });
  assert.equal(fake.status, 400);
  const png = new Blob([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], { type: 'image/jpeg' });
  const real = new FormData();
  real.append('itemId', itemIds[0]);
  real.append('photo', png, 'evidence.jpg');
  const ok = await fetch(`${baseUrl}/api/submissions/${sub}/responses`, { method: 'POST', headers: { Authorization: `Bearer ${E1.token}` }, body: real });
  assert.equal(ok.status, 201);
  assert.match((await ok.json()).response.photo_path, /\.png(\?|$)/, 'named by what it is, not by its label');
});

// Logged temperatures are checked against the safe ranges printed on the
// Kitchen and Bar reports. Before, only a ticked "deviation found" box
// counted, so a freezer logged at -10 °C went unnoticed.
test('a temperature outside its safe range flags the report and shows on the KPIs', async () => {
  const { temperatureDeviations } = await import('../../shared/temperatures.js');
  assert.deepEqual(temperatureDeviations('kitchen_daily', { freezer: { s: '-20', e: '-10' }, fridge1: { s: '3', m: '', e: 'x' } }),
    [{ key: 'freezer', field: 'e', value: -10, range: 'freezer' }]);
  assert.equal(temperatureDeviations('kitchen_daily', { fryerOil: { m: '20' } }).length, 0, 'no mid reading for the fryer');
  assert.equal(temperatureDeviations('bar_daily', { boiler: { s: '96' }, fountain: { s: '17' } }).length, 1);
  assert.equal(temperatureDeviations('opening_daily', { freezer: { s: '40' } }).length, 0, 'only reports with a temperature log');

  const before = (await api('GET', '/api/dashboard/kpi?period=monthly', { token: O.token })).body.temperatureDeviations;
  const tpl = (await api('POST', '/api/checklists/templates', { token: O.token, body: { name: 'Kitchen Daily Report', kind: 'kitchen_daily', itemIds: [] } })).body.template;
  const sub = (await api('POST', '/api/submissions', { token: O.token, body: { templateId: tpl.id, branchId: storeA } })).body.submission;
  await api('PATCH', `/api/submissions/${sub.id}`, { token: O.token, body: { formData: { temperatureLog: { freezer: { s: '-10', e: '-9' }, fridge1: { s: '3' } } }, hasIncident: false } });
  const done = await api('POST', `/api/submissions/${sub.id}/submit`, { token: O.token, body: {} });
  assert.equal(done.status, 200, JSON.stringify(done.body));
  assert.equal(done.body.submission.has_incident, true);
  const after = (await api('GET', '/api/dashboard/kpi?period=monthly', { token: O.token })).body.temperatureDeviations;
  assert.equal(after - before, 2, 'both freezer readings count');
});
