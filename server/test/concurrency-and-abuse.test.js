import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { resetTestDb, closeDb } from '../test-utils/db.js';
import { startTestServer, makeClient, completeSetup } from '../test-utils/server.js';
import { pool } from '../src/db.js';
import { isEmail } from '../src/validation.js';

// Requests a phone (or an attacker) can send at the same moment, and inputs
// built to be slow. Found in the QA audit of October 2026; each test here
// failed before its fix.

let close, api, baseUrl;
const burst = (n, fn) => Promise.all(Array.from({ length: n }, (_, i) => fn(i)));

async function business(email, { branchCount = 1, userCount = 3 } = {}) {
  const res = await api('POST', '/api/auth/signup', {
    body: { fullName: 'Owner', email, password: 'OwnerPass123', restaurantName: `R ${email}`, country: 'Egypt', branchCount, userCount },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  await completeSetup(api, res.body.token);
  return res.body.token;
}

before(async () => {
  await resetTestDb();
  const server = await startTestServer();
  close = server.close;
  baseUrl = server.baseUrl;
  api = makeClient(baseUrl);
});

after(async () => {
  await close();
  await closeDb();
});

test('a crafted email cannot stall the server (the old check took seconds)', async () => {
  const crafted = `a@${'a.'.repeat(400_000)}@`; // ~800 KB, under the 1 MB body limit
  const started = Date.now();
  const res = await api('POST', '/api/auth/signup', {
    body: { fullName: 'X', email: crafted, password: 'Password123', restaurantName: 'R', country: 'Egypt' },
  });
  assert.equal(res.status, 400);
  assert.ok(Date.now() - started < 2000, `answered in ${Date.now() - started}ms`);

  // The same addresses pass and fail as with the old regular expression.
  const OLD = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  for (const e of ['a@b.c', 'a@.b.c', 'a@b.', 'a@.b', '@b.c', 'a@b', 'a b@c.d', 'a@b@c.d', 'x.y+z@sub.d.co', 'a@b..c', 'a@b.c.', 'é@ü.de']) {
    assert.equal(isEmail(e), OLD.test(e), e);
  }
  assert.equal(isEmail(`${'a'.repeat(195)}@b.co`), true, 'exactly 200 characters is allowed');
  assert.equal(isEmail(`${'a'.repeat(196)}@b.co`), false, 'longer than an email can be');
});

test('invites sent at once cannot go past the plan', async () => {
  const token = await business('plan-users@example.com', { userCount: 3 }); // owner + 2
  const res = await burst(6, (i) => api('POST', '/api/tenants/users/invite', { token, body: { fullName: `P${i}`, email: `plan-p${i}@example.com`, role: 'employee' } }));
  assert.equal(res.filter((r) => r.status === 201).length, 2, res.map((r) => r.status).join(','));
  assert.ok(res.filter((r) => r.status !== 201).every((r) => r.status === 409));
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM users WHERE email LIKE 'plan-%' AND status != 'disabled'");
  assert.equal(rows[0].n, 3);
});

test('the same person invited twice at once gets one invite', async () => {
  const token = await business('dup-owner@example.com', { userCount: 10 });
  const res = await burst(3, () => api('POST', '/api/tenants/users/invite', { token, body: { fullName: 'Dup', email: 'dup-person@example.com', role: 'employee' } }));
  assert.deepEqual(res.map((r) => r.status).sort(), [201, 409, 409]);
});

test('stores added at once cannot go past the plan', async () => {
  const token = await business('plan-stores@example.com', { branchCount: 2 });
  const res = await burst(6, (i) => api('POST', '/api/tenants/branches', { token, body: { name: `S${i}` } }));
  assert.equal(res.filter((r) => r.status === 201).length, 2, res.map((r) => r.status).join(','));
  const { body } = await api('GET', '/api/tenants/branches', { token });
  assert.equal(body.branches.length, 2);
});

test('a report submitted several times at once counts once', async () => {
  const token = await business('submit-owner@example.com');
  const branch = (await api('POST', '/api/tenants/branches', { token, body: { name: 'Main' } })).body.branch;
  const tpl = (await api('POST', '/api/checklists/templates', { token, body: { name: 'Kitchen Daily Report', kind: 'kitchen_daily', itemIds: [] } })).body.template;
  const sub = (await api('POST', '/api/submissions', { token, body: { templateId: tpl.id, branchId: branch.id } })).body.submission;
  // A freezer at -5 °C: out of range, so the report is an incident.
  await api('PATCH', `/api/submissions/${sub.id}`, { token, body: { formData: { temperatureLog: { freezer: { s: '-5' } } } } });
  const res = await burst(3, () => api('POST', `/api/submissions/${sub.id}/submit`, { token, body: {} }));
  assert.deepEqual(res.map((r) => r.status).sort(), [200, 409, 409]);
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM message_threads WHERE submission_id = $1 AND kind = 'incident'", [sub.id]);
  assert.equal(rows[0].n, 1);
});

test('Start tapped several times at once on one assignment opens one run', async () => {
  const token = await business('start-owner@example.com');
  const branch = (await api('POST', '/api/tenants/branches', { token, body: { name: 'Main' } })).body.branch;
  const item = (await api('GET', '/api/checklists/library?standard=HACCP', { token })).body.items[0];
  const tpl = (await api('POST', '/api/checklists/templates', { token, body: { name: 'Mine', itemIds: [item.id] } })).body.template;
  const asg = (await api('POST', '/api/checklists/assignments', { token, body: { templateId: tpl.id, branchId: branch.id } })).body.assignment;
  const res = await burst(4, () => api('POST', '/api/submissions', { token, body: { templateId: tpl.id, branchId: branch.id, assignmentId: asg.id } }));
  assert.equal(new Set(res.map((r) => r.body.submission.id)).size, 1, res.map((r) => r.status).join(','));
  assert.equal(res.filter((r) => r.status === 201).length, 1);
});

test('pages carry a content security policy', async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  const csp = res.headers.get('content-security-policy') || '';
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-ancestors 'self'/);
  assert.doesNotMatch(csp, /script-src[^;]*'unsafe-inline'/);
});
