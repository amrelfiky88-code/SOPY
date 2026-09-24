import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { resetTestDb, closeDb } from '../test-utils/db.js';
import { startTestServer, makeClient, completeSetup } from '../test-utils/server.js';

let close, api, baseUrl, token, branchId, templateId, itemId, submissionId;

before(async () => {
  await resetTestDb();
  const server = await startTestServer();
  close = server.close;
  baseUrl = server.baseUrl;
  api = makeClient(server.baseUrl);

  const signup = await api('POST', '/api/auth/signup', {
    body: { fullName: 'Amina', email: 'amina@example.com', password: 'SopyDemo123', restaurantName: 'The Nile Bistro', country: 'Egypt', branchCount: 1, userCount: 1 },
  });
  token = signup.body.token;

  // Onboarding must be complete before templates can be created.
  await completeSetup(api, token);

  const branch = await api('POST', '/api/tenants/branches', { token, body: { name: 'Downtown' } });
  branchId = branch.body.branch.id;

  const library = await api('GET', '/api/checklists/library?q=fridge', { token });
  itemId = library.body.items[0].id;

  const template = await api('POST', '/api/checklists/templates', {
    token,
    body: { name: 'Opening Checklist', frequency: 'daily', itemIds: [itemId] },
  });
  templateId = template.body.template.id;
});

after(async () => {
  await close();
  await closeDb();
});

// The response endpoint is parsed by multer, which only understands
// multipart/form-data (not urlencoded or JSON) — even for fields with no
// file attached — so it can't go through the plain-JSON test client.
// Every checkpoint needs photo evidence before a run can be submitted,
// so answers carry one unless a test says { photo: false }.
async function postResponse(subId, { photo = true, ...fields }) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  if (photo) form.append('photo', new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }), 'evidence.jpg');
  return fetch(`${baseUrl}/api/submissions/${subId}/responses`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
}

test('starting a checklist run creates an in_progress submission', async () => {
  const res = await api('POST', '/api/submissions', { token, body: { templateId, branchId } });
  assert.equal(res.status, 201);
  assert.equal(res.body.submission.status, 'in_progress');
  submissionId = res.body.submission.id;
});

test('recording a compliant response with a temperature reading', async () => {
  const res = await postResponse(submissionId, { itemId, isCompliant: 'true', valueText: '3' });
  assert.equal(res.status, 201);
});

// Regression test for a real bug: `signed_off_at = CASE WHEN $3 IS NOT
// NULL THEN now() ELSE NULL END` left Postgres unable to infer $3's type
// (error 42P08) and crashed the server on every submit. signed_off_by is
// never actually null in practice, so the CASE was removed entirely.
test('submitting a checklist run signs it off without crashing', async () => {
  const res = await api('POST', `/api/submissions/${submissionId}/submit`, { token, body: { gpsLat: 30.05, gpsLng: 31.23 } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.submission.status, 'submitted');
  assert.ok(res.body.submission.signed_off_by);
  assert.ok(res.body.submission.signed_off_at);
});

test('KPI dashboard reflects the submitted, fully-compliant run', async () => {
  const res = await api('GET', '/api/dashboard/kpi?period=daily', { token });
  assert.equal(res.status, 200);
  assert.equal(res.body.compliancePct, 100);
  assert.equal(res.body.temperatureDeviations, 0);
  assert.equal(res.body.submissionsCount, 1);
});

test('a submitted report can no longer be edited, answered or re-submitted', async () => {
  const patch = await api('PATCH', `/api/submissions/${submissionId}`, { token, body: { formData: { notes: 'late edit' } } });
  assert.equal(patch.status, 409);
  const response = await postResponse(submissionId, { itemId, isCompliant: 'false' });
  assert.equal(response.status, 409);
  const resubmit = await api('POST', `/api/submissions/${submissionId}/submit`, { token, body: {} });
  assert.equal(resubmit.status, 409);
});

test('the submissions list works with filters (columns were ambiguous across the joins)', async () => {
  const res = await api('GET', `/api/submissions?branchId=${branchId}&status=submitted`, { token });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.submissions.length, 1);
});

test('a malformed id is a 400, not a server crash', async () => {
  const res = await api('GET', '/api/submissions/not-a-uuid', { token });
  assert.equal(res.status, 400);
  // …and the server is still up afterwards.
  const again = await api('GET', `/api/submissions/${submissionId}`, { token });
  assert.equal(again.status, 200);
});

test('a checklist run cannot be started against another tenant\'s store or checklist', async () => {
  const other = await api('POST', '/api/auth/signup', {
    body: { fullName: 'Omar', email: 'omar-sub@example.com', password: 'SopyDemo123', restaurantName: 'Other Place', country: 'Egypt', branchCount: 1, userCount: 1 },
  });
  const res = await api('POST', '/api/submissions', { token: other.body.token, body: { templateId, branchId } });
  assert.equal(res.status, 404);
  const answer = await fetch(`${baseUrl}/api/submissions/${submissionId}/responses`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${other.body.token}` },
    body: (() => { const f = new FormData(); f.append('itemId', itemId); f.append('isCompliant', 'true'); return f; })(),
  });
  assert.equal(answer.status, 404);
});

// Regression: "Save progress" on a daily report stored form_data, but
// after a reload nothing looked it up again, so the draft was orphaned
// and starting over created a second submission.
test('a saved daily-report draft can be found again and resumed', async () => {
  const tpl = await api('POST', '/api/checklists/templates', {
    token, body: { name: 'Kitchen Daily Operation Report', kind: 'kitchen_daily', frequency: 'daily', itemIds: [] },
  });
  assert.equal(tpl.status, 201, JSON.stringify(tpl.body));

  const none = await api('GET', `/api/submissions/draft?kind=kitchen_daily&branchId=${branchId}`, { token });
  assert.equal(none.status, 200);
  assert.equal(none.body.submission, null);

  const start = await api('POST', '/api/submissions', { token, body: { templateId: tpl.body.template.id, branchId } });
  const draftId = start.body.submission.id;
  await api('PATCH', `/api/submissions/${draftId}`, { token, body: { formData: { shift: { reportNo: '0042' } } } });

  const found = await api('GET', `/api/submissions/draft?kind=kitchen_daily&branchId=${branchId}`, { token });
  assert.equal(found.body.submission.id, draftId);
  assert.equal(found.body.submission.form_data.shift.reportNo, '0042');

  // Once submitted it is no longer a draft.
  await api('POST', `/api/submissions/${draftId}/submit`, { token, body: {} });
  const after = await api('GET', `/api/submissions/draft?kind=kitchen_daily&branchId=${branchId}`, { token });
  assert.equal(after.body.submission, null);
});

test('a non-compliant temperature response counts as a deviation', async () => {
  const start = await api('POST', '/api/submissions', { token, body: { templateId, branchId } });
  const sub2 = start.body.submission.id;

  await postResponse(sub2, { itemId, isCompliant: 'false', valueText: '9' });
  await api('POST', `/api/submissions/${sub2}/submit`, { token, body: {} });

  const kpi = await api('GET', '/api/dashboard/kpi?period=daily', { token });
  assert.equal(kpi.body.temperatureDeviations, 1);
  assert.equal(kpi.body.compliancePct, 50); // 1 of 2 responses compliant overall
});
