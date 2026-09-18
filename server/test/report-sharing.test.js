import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { resetTestDb, closeDb } from '../test-utils/db.js';
import { startTestServer, makeClient, completeSetup } from '../test-utils/server.js';
import { pool } from '../src/db.js';

// Finished reports can be opened as a full report and shared as a PDF
// link (WhatsApp/email). Links work without logging in, but only for
// submitted reports, only within the tenant (and, for staff, only their
// own reports), and only until they expire.

let close, api, baseUrl;
const owner = {};
let emp, otherEmp, branchId, templateId, itemId, submissionId;

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');

async function inviteAndAccept(email, role, extra = {}) {
  const invite = await api('POST', '/api/tenants/users/invite', { token: owner.token, body: { fullName: email, email, role, ...extra } });
  const accept = await api('POST', '/api/auth/accept-invite', {
    body: { inviteToken: invite.body.inviteLink.split('token=')[1], password: 'Password123' },
  });
  return { token: accept.body.token, userId: accept.body.user.id };
}

function share(token, id, { body = PDF, type = 'application/pdf', fileName = 'Fridge check.pdf' } = {}) {
  const form = new FormData();
  form.append('pdf', new Blob([body], { type }), 'report.pdf');
  form.append('fileName', fileName);
  return fetch(`${baseUrl}/api/submissions/${id}/share`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form })
    .then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
}

before(async () => {
  await resetTestDb();
  const server = await startTestServer();
  close = server.close;
  baseUrl = server.baseUrl;
  api = makeClient(server.baseUrl);

  const signup = await api('POST', '/api/auth/signup', {
    body: { fullName: 'Owner', email: 'share-owner@example.com', password: 'OwnerPass123', restaurantName: 'Share Cafe', country: 'Egypt', branchCount: 1, userCount: 5 },
  });
  owner.token = signup.body.token;
  await completeSetup(api, owner.token);
  branchId = (await api('POST', '/api/tenants/branches', { token: owner.token, body: { name: 'Main' } })).body.branch.id;
  emp = await inviteAndAccept('share-emp@example.com', 'employee', { branchIds: [branchId] });
  otherEmp = await inviteAndAccept('share-emp2@example.com', 'employee', { branchIds: [branchId] });

  itemId = (await api('GET', '/api/checklists/library?q=fridge', { token: owner.token })).body.items[0].id;
  templateId = (await api('POST', '/api/checklists/templates', { token: owner.token, body: { name: 'Fridge check', itemIds: [itemId] } })).body.template.id;

  submissionId = (await api('POST', '/api/submissions', { token: emp.token, body: { templateId, branchId } })).body.submission.id;
  const form = new FormData();
  form.append('itemId', itemId);
  form.append('isCompliant', 'true');
  form.append('valueText', '3');
  await fetch(`${baseUrl}/api/submissions/${submissionId}/responses`, { method: 'POST', headers: { Authorization: `Bearer ${emp.token}` }, body: form });
});

after(async () => {
  await close();
  await closeDb();
});

test('a report can only be shared once it is submitted', async () => {
  const res = await share(emp.token, submissionId);
  assert.equal(res.status, 409);
  await api('POST', `/api/submissions/${submissionId}/submit`, { token: emp.token, body: {} });
});

test('the full report has header details, answers and the score', async () => {
  const res = await api('GET', `/api/submissions/${submissionId}/report`, { token: emp.token });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.submission.template_name, 'Fridge check');
  assert.equal(res.body.submission.branch_name, 'Main');
  assert.equal(res.body.submission.restaurant_name, 'Share Cafe');
  assert.equal(res.body.items.length, 1);
  assert.equal(res.body.items[0].is_compliant, true);
  assert.equal(res.body.items[0].value_text, '3');
  assert.equal(res.body.scorecard.percentage, 100);
});

test('staff only see their own reports; managers see everyone\'s', async () => {
  assert.equal((await api('GET', `/api/submissions/${submissionId}/report`, { token: otherEmp.token })).status, 404);
  assert.equal((await api('GET', `/api/submissions/${submissionId}/report`, { token: owner.token })).status, 200);

  const mine = await api('GET', '/api/submissions?status=submitted', { token: otherEmp.token });
  assert.equal(mine.body.submissions.length, 0);
  const all = await api('GET', '/api/submissions?status=submitted', { token: owner.token });
  assert.equal(all.body.submissions.length, 1);
});

test('sharing returns a link anyone can open, serving the PDF', async () => {
  const res = await share(emp.token, submissionId);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.match(res.body.path, /^\/api\/shared\/[A-Za-z0-9_-]{32}$/);

  const pdf = await fetch(baseUrl + res.body.path); // no Authorization header
  assert.equal(pdf.status, 200);
  assert.equal(pdf.headers.get('content-type'), 'application/pdf');
  assert.match(pdf.headers.get('content-disposition'), /Fridge%20check\.pdf/);
  assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString(), '%PDF-');
});

test('only real PDFs are accepted, and only by people who can see the report', async () => {
  assert.equal((await share(emp.token, submissionId, { body: Buffer.from('<html>not a pdf'), type: 'application/pdf' })).status, 400);
  assert.equal((await share(emp.token, submissionId, { type: 'image/png' })).status, 400);
  assert.equal((await share(otherEmp.token, submissionId)).status, 404);
});

test('expired and made-up links are refused', async () => {
  const res = await share(emp.token, submissionId);
  const token = res.body.path.split('/').pop();
  await pool.query("UPDATE report_shares SET expires_at = now() - interval '1 minute' WHERE token = $1", [token]);
  assert.equal((await fetch(baseUrl + res.body.path)).status, 410);
  assert.equal((await fetch(`${baseUrl}/api/shared/${'x'.repeat(32)}`)).status, 404);
  assert.equal((await fetch(`${baseUrl}/api/shared/../../etc/passwd`)).status, 404);
});
