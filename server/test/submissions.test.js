import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { resetTestDb, closeDb } from '../test-utils/db.js';
import { startTestServer, makeClient } from '../test-utils/server.js';

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
  await api('POST', '/api/onboarding/complete', { token, body: {} });

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
async function postResponse(subId, fields) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
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

test('a non-compliant temperature response counts as a deviation', async () => {
  const start = await api('POST', '/api/submissions', { token, body: { templateId, branchId } });
  const sub2 = start.body.submission.id;

  await postResponse(sub2, { itemId, isCompliant: 'false', valueText: '9' });
  await api('POST', `/api/submissions/${sub2}/submit`, { token, body: {} });

  const kpi = await api('GET', '/api/dashboard/kpi?period=daily', { token });
  assert.equal(kpi.body.temperatureDeviations, 1);
  assert.equal(kpi.body.compliancePct, 50); // 1 of 2 responses compliant overall
});
