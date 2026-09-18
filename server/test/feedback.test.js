import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { resetTestDb, closeDb } from '../test-utils/db.js';
import { startTestServer, makeClient } from '../test-utils/server.js';
import { pool } from '../src/db.js';

let close, api, ownerToken, tenantId, employeeToken;

before(async () => {
  await resetTestDb();
  const server = await startTestServer();
  close = server.close;
  api = makeClient(server.baseUrl);

  const signup = await api('POST', '/api/auth/signup', {
    body: { fullName: 'Amina', email: 'amina@example.com', password: 'SopyDemo123', restaurantName: 'The Nile Bistro', country: 'Egypt', branchCount: 1, userCount: 2 },
  });
  ownerToken = signup.body.token;
  tenantId = signup.body.tenant.id;

  const invite = await api('POST', '/api/tenants/users/invite', {
    token: ownerToken,
    body: { fullName: 'Omar', email: 'omar@example.com', role: 'employee' },
  });
  const accept = await api('POST', '/api/auth/accept-invite', {
    body: { inviteToken: invite.body.inviteLink.split('token=')[1], password: 'OmarPass123' },
  });
  employeeToken = accept.body.token;
});

after(async () => {
  await close();
  await closeDb();
});

test('a signed-in user can send feedback, stored against their tenant and user', async () => {
  const res = await api('POST', '/api/feedback', {
    token: ownerToken,
    body: { category: 'idea', message: '  Let me export the KPI dashboard as a PDF.  ', pagePath: '/app/kpi' },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.feedback.message, 'Let me export the KPI dashboard as a PDF.', 'message is trimmed');
  assert.equal(res.body.feedback.page_path, '/app/kpi');

  const { rows } = await pool.query('SELECT * FROM feedback WHERE id = $1', [res.body.feedback.id]);
  assert.equal(rows[0].tenant_id, tenantId);
  assert.equal(rows[0].category, 'idea');
});

// The people most likely to trip over a confusing screen are floor staff,
// so this must not be gated to managers like most write endpoints are.
test('an employee (lowest role) can send feedback too', async () => {
  const res = await api('POST', '/api/feedback', {
    token: employeeToken,
    body: { category: 'bug', message: 'Camera button does nothing on my phone.' },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.feedback.page_path, null, 'page path is optional');
});

test('feedback requires a sign-in', async () => {
  const res = await api('POST', '/api/feedback', { body: { category: 'bug', message: 'hello' } });
  assert.equal(res.status, 401);
});

test('an empty or whitespace-only message is rejected', async () => {
  for (const message of ['', '   ', undefined, 42]) {
    const res = await api('POST', '/api/feedback', { token: ownerToken, body: { category: 'bug', message } });
    assert.equal(res.status, 400, `message ${JSON.stringify(message)} should be rejected`);
  }
});

test('an unknown category is rejected', async () => {
  const res = await api('POST', '/api/feedback', { token: ownerToken, body: { category: 'rant', message: 'hello' } });
  assert.equal(res.status, 400);
});

test('an overly long message is rejected rather than truncated', async () => {
  const res = await api('POST', '/api/feedback', { token: ownerToken, body: { category: 'other', message: 'x'.repeat(2001) } });
  assert.equal(res.status, 400);

  const ok = await api('POST', '/api/feedback', { token: ownerToken, body: { category: 'other', message: 'x'.repeat(2000) } });
  assert.equal(ok.status, 201, 'exactly the limit is allowed');
});

test('a user cannot attribute feedback to another tenant', async () => {
  const res = await api('POST', '/api/feedback', {
    token: ownerToken,
    body: { category: 'bug', message: 'spoof attempt', tenantId: '00000000-0000-0000-0000-000000000000', userId: '00000000-0000-0000-0000-000000000000' },
  });
  assert.equal(res.status, 201);
  const { rows } = await pool.query('SELECT tenant_id, user_id FROM feedback WHERE id = $1', [res.body.feedback.id]);
  assert.equal(rows[0].tenant_id, tenantId, 'tenant comes from the token, not the body');
  assert.notEqual(rows[0].user_id, '00000000-0000-0000-0000-000000000000');
});
