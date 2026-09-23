import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { resetTestDb, closeDb } from '../test-utils/db.js';
import { startTestServer, makeClient, completeSetup } from '../test-utils/server.js';

// Regressions from the "test all functions" pass: plan limits, pricing
// input bounds, login hygiene, and the dashboard numbers.

let close, api, baseUrl;
const owner = {};

before(async () => {
  await resetTestDb();
  const server = await startTestServer();
  close = server.close;
  baseUrl = server.baseUrl;
  api = makeClient(server.baseUrl);

  const signup = await api('POST', '/api/auth/signup', {
    body: { fullName: 'Owner', email: '  Hard.Owner@Example.com ', password: 'OwnerPass123', restaurantName: 'Hard Cafe', country: 'Egypt', branchCount: 2, userCount: 2 },
  });
  assert.equal(signup.status, 201, JSON.stringify(signup.body));
  owner.token = signup.body.token;
  await completeSetup(api, owner.token);
});

after(async () => {
  await close();
  await closeDb();
});

test('signup stores a trimmed, lower-case email, and login tolerates phone keyboards', async () => {
  const login = await api('POST', '/api/auth/login', { body: { email: 'HARD.owner@example.com ', password: 'OwnerPass123' } });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.email, 'hard.owner@example.com');
});

test('signup clamps branch and user counts to the plan limits', async () => {
  const res = await api('POST', '/api/auth/signup', {
    body: { fullName: 'X', email: 'clamp@example.com', password: 'OwnerPass123', restaurantName: 'Clamp', country: 'Egypt', branchCount: -5, userCount: 1e9 },
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.tenant.branch_count, 1);
  assert.equal(res.body.tenant.user_count, 2000);
});

test('an invalid email is refused at signup', async () => {
  const res = await api('POST', '/api/auth/signup', {
    body: { fullName: 'X', email: 'not-an-email', password: 'OwnerPass123', restaurantName: 'X', country: 'Egypt' },
  });
  assert.equal(res.status, 400);
});

test('repeated wrong passwords lock the account for a while, not forever', async () => {
  const email = 'hard.owner@example.com';
  for (let i = 0; i < 10; i++) {
    const r = await api('POST', '/api/auth/login', { body: { email, password: 'wrong-password' } });
    assert.equal(r.status, 401);
  }
  const locked = await api('POST', '/api/auth/login', { body: { email, password: 'OwnerPass123' } });
  assert.equal(locked.status, 429, 'even the right password waits out the lock');
});

test('the public pricing calculator caps huge counts instead of hanging', async () => {
  const t0 = Date.now();
  const res = await fetch(`${baseUrl}/api/pricing/calculate?branches=1000000000&users=1000000000`).then((r) => r.json());
  assert.ok(Date.now() - t0 < 2000);
  assert.equal(res.branchCount, 500);
  assert.equal(res.userCount, 2000);
});

test('stores and users are capped at what the plan pays for', async () => {
  const b1 = await api('POST', '/api/tenants/branches', { token: owner.token, body: { name: 'One' } });
  const b2 = await api('POST', '/api/tenants/branches', { token: owner.token, body: { name: 'Two' } });
  assert.equal(b1.status, 201);
  assert.equal(b2.status, 201);
  const b3 = await api('POST', '/api/tenants/branches', { token: owner.token, body: { name: 'Three' } });
  assert.equal(b3.status, 409);
  assert.match(b3.body.error, /plan covers 2 stores/);

  // Owner + one invite = 2 users.
  const i1 = await api('POST', '/api/tenants/users/invite', { token: owner.token, body: { fullName: 'Staff', email: 'staff1@example.com', role: 'employee' } });
  assert.equal(i1.status, 201);
  const i2 = await api('POST', '/api/tenants/users/invite', { token: owner.token, body: { fullName: 'Staff 2', email: 'staff2@example.com', role: 'employee' } });
  assert.equal(i2.status, 409);

  // Disabling frees the seat; re-enabling needs one again.
  await api('PATCH', `/api/tenants/users/${i1.body.user.id}`, { token: owner.token, body: { status: 'disabled' } });
  const i3 = await api('POST', '/api/tenants/users/invite', { token: owner.token, body: { fullName: 'Staff 3', email: 'staff3@example.com', role: 'employee' } });
  assert.equal(i3.status, 201);
  const reEnable = await api('PATCH', `/api/tenants/users/${i1.body.user.id}`, { token: owner.token, body: { status: 'active' } });
  assert.equal(reEnable.status, 409);
});

test('re-enabling someone who never accepted keeps their invite usable', async () => {
  const users = await api('GET', '/api/tenants/users', { token: owner.token });
  const pending = users.body.users.find((u) => u.email === 'staff3@example.com');
  await api('PATCH', `/api/tenants/users/${pending.id}`, { token: owner.token, body: { status: 'disabled' } });
  const back = await api('PATCH', `/api/tenants/users/${pending.id}`, { token: owner.token, body: { status: 'active' } });
  assert.equal(back.status, 200);
  assert.equal(back.body.user.status, 'invited');
});

test('the plan can\'t be lowered below what is in use, and counts must be sane', async () => {
  const lower = await api('PATCH', '/api/billing/subscription/quantities', { token: owner.token, body: { branchCount: 1, userCount: 2 } });
  assert.equal(lower.status, 409);
  const junk = await api('PATCH', '/api/billing/subscription/quantities', { token: owner.token, body: { branchCount: 'lots', userCount: 2 } });
  assert.equal(junk.status, 400);
  const fraction = await api('PATCH', '/api/billing/subscription/quantities', { token: owner.token, body: { branchCount: 2.7, userCount: 3 } });
  assert.equal(fraction.status, 200, JSON.stringify(fraction.body));
  assert.equal(fraction.body.subscription.branch_count, 2);
});

test('KPI waste comes from what the Kitchen and Bar reports record, submitted only', async () => {
  const branchId = (await api('GET', '/api/tenants/branches', { token: owner.token })).body.branches[0].id;
  const kitchen = await api('POST', '/api/checklists/templates', { token: owner.token, body: { name: 'Kitchen', kind: 'kitchen_daily', itemIds: [] } });
  const bar = await api('POST', '/api/checklists/templates', { token: owner.token, body: { name: 'Bar', kind: 'bar_daily', itemIds: [] } });

  const k = (await api('POST', '/api/submissions', { token: owner.token, body: { templateId: kitchen.body.template.id, branchId } })).body.submission.id;
  await api('PATCH', `/api/submissions/${k}`, { token: owner.token, body: { formData: { wasteTotal: { value: '12.50' }, tempDeviation: { found: true } } } });
  await api('POST', `/api/submissions/${k}/submit`, { token: owner.token, body: {} });

  const b = (await api('POST', '/api/submissions', { token: owner.token, body: { templateId: bar.body.template.id, branchId } })).body.submission.id;
  await api('PATCH', `/api/submissions/${b}`, { token: owner.token, body: { formData: { stockNotes: { wasteValue: '7.5' } } } });
  await api('POST', `/api/submissions/${b}/submit`, { token: owner.token, body: {} });

  // Not submitted: must not count.
  const draft = (await api('POST', '/api/submissions', { token: owner.token, body: { templateId: kitchen.body.template.id, branchId } })).body.submission.id;
  await api('PATCH', `/api/submissions/${draft}`, { token: owner.token, body: { formData: { wasteTotal: { value: '1000' } } } });

  const kpi = await api('GET', '/api/dashboard/kpi?period=daily', { token: owner.token });
  assert.equal(kpi.body.wasteValue, 20);
  assert.equal(kpi.body.submissionsCount, 2);
  assert.equal(kpi.body.temperatureDeviations, 1);
});

test('the dashboard\'s assigned count matches the assignments actually shown', async () => {
  const itemId = (await api('GET', '/api/checklists/library?q=fridge', { token: owner.token })).body.items[0].id;
  const tpl = (await api('POST', '/api/checklists/templates', { token: owner.token, body: { name: 'Mgr only', itemIds: [itemId] } })).body.template;
  await api('POST', '/api/checklists/assignments', { token: owner.token, body: { templateId: tpl.id, role: 'store_manager' } });

  const summary = await api('GET', '/api/dashboard/summary', { token: owner.token });
  const mine = await api('GET', '/api/checklists/my-assignments', { token: owner.token });
  assert.equal(summary.body.assignedChecklists, mine.body.assignments.length);
  assert.equal(summary.body.assignedChecklists, 0, 'a store-manager assignment is not the owner\'s');
});

test('checkpoint search also matches the translated text', async () => {
  const ar = await api('GET', `/api/checklists/library?q=${encodeURIComponent('الثلاجة')}&lang=ar`, { token: owner.token });
  assert.equal(ar.status, 200);
  assert.ok(ar.body.items.length > 0, 'an Arabic search finds checkpoints');
  const literal = await api('GET', `/api/checklists/library?q=${encodeURIComponent('%')}`, { token: owner.token });
  assert.ok(literal.body.items.length < 50, '% is a literal character, not a match-everything wildcard');
  assert.ok(literal.body.items.every((i) => i.text.includes('%')));
});

test('a pinned report gets one template per business, however often it is requested', async () => {
  const [a, b] = await Promise.all([
    api('POST', '/api/checklists/templates', { token: owner.token, body: { name: 'Opening', kind: 'opening_daily', itemIds: [] } }),
    api('POST', '/api/checklists/templates', { token: owner.token, body: { name: 'Opening', kind: 'opening_daily', itemIds: [] } }),
  ]);
  assert.equal(a.body.template.id, b.body.template.id);
  const bad = await api('POST', '/api/checklists/templates', { token: owner.token, body: { name: 'X', kind: 'made_up', itemIds: [] } });
  assert.equal(bad.status, 400);
  const empty = await api('POST', '/api/checklists/templates', { token: owner.token, body: { name: 'Empty', itemIds: [] } });
  assert.equal(empty.status, 400);
});

test('deleting a checklist that has been run is refused cleanly', async () => {
  const templates = (await api('GET', '/api/checklists/templates', { token: owner.token })).body.templates;
  const used = templates.find((t) => t.kind === 'kitchen_daily');
  const res = await api('DELETE', `/api/checklists/templates/${used.id}`, { token: owner.token });
  assert.equal(res.status, 409);
});

test('the plan page cannot drop counts below what is already in use either', async () => {
  const lowStores = await api('PATCH', '/api/tenants/current', { token: owner.token, body: { branchCount: 1 } });
  assert.equal(lowStores.status, 409);
  assert.match(lowStores.body.error, /2 active stores/);

  const lowUsers = await api('PATCH', '/api/tenants/current', { token: owner.token, body: { userCount: 1 } });
  assert.equal(lowUsers.status, 409);

  // Raising is fine.
  const up = await api('PATCH', '/api/tenants/current', { token: owner.token, body: { branchCount: 5, userCount: 6 } });
  assert.equal(up.status, 200);
  assert.equal(up.body.tenant.branch_count, 5);
});

// Evidence photos used to be world-readable at a guessable-shaped URL
// with no login and no expiry.
test('evidence photos are only served through signed, expiring links', async () => {
  const branchId = (await api('GET', '/api/tenants/branches', { token: owner.token })).body.branches[0].id;
  const itemId = (await api('GET', '/api/checklists/library?q=fridge', { token: owner.token })).body.items[0].id;
  const tpl = (await api('POST', '/api/checklists/templates', { token: owner.token, body: { name: 'Photo check', itemIds: [itemId] } })).body.template;
  const subId = (await api('POST', '/api/submissions', { token: owner.token, body: { templateId: tpl.id, branchId } })).body.submission.id;

  const form = new FormData();
  form.append('itemId', itemId);
  form.append('isCompliant', 'true');
  form.append('photo', new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }), 'e.jpg');
  await fetch(`${baseUrl}/api/submissions/${subId}/responses`, { method: 'POST', headers: { Authorization: `Bearer ${owner.token}` }, body: form });

  const detail = await api('GET', `/api/submissions/${subId}`, { token: owner.token });
  const signed = detail.body.responses[0].photo_path;
  assert.match(signed, /^\/uploads\/.+\?e=\d+&s=[A-Za-z0-9_-]+$/);

  // The signed link works without a login (so <img> and the PDF can use it).
  assert.equal((await fetch(baseUrl + signed)).status, 200);
  // The bare path, a tampered signature and an expired link do not.
  assert.equal((await fetch(baseUrl + signed.split('?')[0])).status, 403);
  assert.equal((await fetch(`${baseUrl + signed}x`)).status, 403);
  const [p, q] = signed.split('?');
  const params = new URLSearchParams(q);
  params.set('e', String(Date.now() - 1000));
  assert.equal((await fetch(`${baseUrl}${p}?${params}`)).status, 403);
});

test('oversized reports, notes and names are refused', async () => {
  const branchId = (await api('GET', '/api/tenants/branches', { token: owner.token })).body.branches[0].id;
  const tpl = (await api('GET', '/api/checklists/templates', { token: owner.token })).body.templates.find((t) => t.kind === 'kitchen_daily');
  const subId = (await api('POST', '/api/submissions', { token: owner.token, body: { templateId: tpl.id, branchId } })).body.submission.id;

  const huge = await api('PATCH', `/api/submissions/${subId}`, { token: owner.token, body: { formData: { notes: 'x'.repeat(600_000) } } });
  assert.equal(huge.status, 413);
  const notAnObject = await api('PATCH', `/api/submissions/${subId}`, { token: owner.token, body: { formData: 'nope' } });
  assert.equal(notAnObject.status, 400);

  const longStore = await api('POST', '/api/tenants/branches', { token: owner.token, body: { name: 'S'.repeat(200) } });
  assert.equal(longStore.status, 400);
  const longChecklist = await api('POST', '/api/checklists/templates', { token: owner.token, body: { name: 'C'.repeat(250), itemIds: [] } });
  assert.equal(longChecklist.status, 400);
  const badStandard = await api('POST', '/api/checklists/library', { token: owner.token, body: { text: 'Custom point', standard: 'MADE_UP' } });
  assert.equal(badStandard.status, 400);
});
