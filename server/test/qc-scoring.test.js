import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { resetTestDb, closeDb } from '../test-utils/db.js';
import { startTestServer, makeClient } from '../test-utils/server.js';

let close, api, baseUrl, token, branchId;

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
  await api('POST', '/api/onboarding/complete', { token, body: {} });

  const branch = await api('POST', '/api/tenants/branches', { token, body: { name: 'Downtown' } });
  branchId = branch.body.branch.id;
});

after(async () => {
  await close();
  await closeDb();
});

async function postResponse(subId, fields) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  return fetch(`${baseUrl}/api/submissions/${subId}/responses`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
}

// Regression test for a real bug: a multi-row INSERT doesn't guarantee
// Postgres returns rows in the order they were listed, and all rows in
// one INSERT share the same `created_at` (no tiebreaker there either) —
// so items within a section came back scrambled until an explicit
// sort_order column was added.
test('items within a section come back in the source document\'s own order', async () => {
  const res = await api('GET', '/api/checklists/library?standard=INTERNAL_QC', { token });
  const sectionA = res.body.items.filter((i) => i.category === 'Daily QC — A. Exterior & First Impressions');
  assert.deepEqual(sectionA.map((i) => i.text), [
    'Signage clean, illuminated, no dead bulbs or damage',
    'Entrance glass, doors & handles spotless — no fingerprints or smudges',
    'Walkway / parking area free of litter, cigarette butts & standing water',
    'Exterior menus / promotional displays current, clean & correctly priced',
    'Waste bins outside not overflowing; lids closed; no odor at entrance',
    'No pest activity visible around entrance, waste area or delivery door',
    'Outdoor seating (if any) clean, aligned, stable & weather-appropriate',
    'Accessibility: ramp/entrance unobstructed for wheelchairs & strollers',
  ]);
});

test('the imported QC library has exactly the expected critical-item counts per audit layer', async () => {
  const res = await api('GET', '/api/checklists/library?standard=INTERNAL_QC&critical=true', { token });
  assert.equal(res.status, 200);
  const byLayer = { daily: 0, weekly: 0, monthly: 0, quarterly: 0 };
  for (const item of res.body.items) {
    if (item.category.startsWith('Daily QC')) byLayer.daily++;
    else if (item.category.startsWith('Weekly Audit')) byLayer.weekly++;
    else if (item.category.startsWith('Monthly Audit')) byLayer.monthly++;
    else if (item.category.startsWith('Quarterly Audit')) byLayer.quarterly++;
  }
  // Counted by hand against the source Daily_QC_Checklist.docx / QC_Audit_System.docx ⚠ marks.
  assert.deepEqual(byLayer, { daily: 13, weekly: 4, monthly: 4, quarterly: 3 });
});

test('a failing response on a critical item auto-flags the submission as an incident', async () => {
  const library = await api('GET', `/api/checklists/library?q=${encodeURIComponent('Fire extinguishers')}`, { token });
  const criticalItem = library.body.items.find((i) => i.is_critical);
  assert.ok(criticalItem, 'expected the fire extinguisher item to be marked critical');

  const template = await api('POST', '/api/checklists/templates', {
    token, body: { name: 'Safety spot-check', itemIds: [criticalItem.id] },
  });
  const submission = await api('POST', '/api/submissions', { token, body: { templateId: template.body.template.id, branchId } });

  const before = await api('GET', `/api/submissions/${submission.body.submission.id}`, { token });
  assert.equal(before.body.submission.has_incident, false);

  await postResponse(submission.body.submission.id, { itemId: criticalItem.id, isCompliant: 'false' });

  const after = await api('GET', `/api/submissions/${submission.body.submission.id}`, { token });
  assert.equal(after.body.submission.has_incident, true);
});

test('a failing response on a NON-critical item does not flag an incident', async () => {
  const library = await api('GET', `/api/checklists/library?q=${encodeURIComponent('Wi-Fi working')}`, { token });
  const item = library.body.items[0];
  assert.equal(item.is_critical, false);

  const template = await api('POST', '/api/checklists/templates', { token, body: { name: 'Dining spot-check', itemIds: [item.id] } });
  const submission = await api('POST', '/api/submissions', { token, body: { templateId: template.body.template.id, branchId } });

  await postResponse(submission.body.submission.id, { itemId: item.id, isCompliant: 'false' });

  const after = await api('GET', `/api/submissions/${submission.body.submission.id}`, { token });
  assert.equal(after.body.submission.has_incident, false);
});

test('scorecard computes percentage, RAG status, and critical-fail count correctly', async () => {
  // 3 items: 2 compliant, 1 non-compliant AND critical -> 2/3 = 66.7%, but
  // the critical fail must force Red regardless of the percentage.
  const fridgeLib = await api('GET', `/api/checklists/library?q=${encodeURIComponent('Refrigerators at 1')}`, { token });
  const critical = fridgeLib.body.items[0];
  assert.equal(critical.is_critical, true);

  const wifiLib = await api('GET', `/api/checklists/library?q=${encodeURIComponent('Wi-Fi working')}`, { token });
  const nonCritical1 = wifiLib.body.items[0];

  const musicLib = await api('GET', `/api/checklists/library?q=${encodeURIComponent('Music: volume')}`, { token });
  const nonCritical2 = musicLib.body.items[0];

  const template = await api('POST', '/api/checklists/templates', {
    token, body: { name: 'Scorecard test', itemIds: [critical.id, nonCritical1.id, nonCritical2.id] },
  });
  const submission = await api('POST', '/api/submissions', { token, body: { templateId: template.body.template.id, branchId } });
  const subId = submission.body.submission.id;

  await postResponse(subId, { itemId: critical.id, isCompliant: 'false' });
  await postResponse(subId, { itemId: nonCritical1.id, isCompliant: 'true' });
  await postResponse(subId, { itemId: nonCritical2.id, isCompliant: 'true' });
  await api('POST', `/api/submissions/${subId}/submit`, { token, body: {} });

  const scorecard = await api('GET', `/api/submissions/${subId}/scorecard`, { token });
  assert.equal(scorecard.status, 200, JSON.stringify(scorecard.body));
  assert.equal(scorecard.body.totalScored, 3);
  assert.equal(scorecard.body.totalCompliant, 2);
  assert.equal(scorecard.body.criticalFails, 1);
  assert.equal(scorecard.body.percentage, 66.7);
  // Any critical fail forces Red even though 66.7% alone would just be "Red" anyway here,
  // so also check the case where percentage ALONE would be Green/Amber but a critical fail overrides it.
  assert.equal(scorecard.body.ragStatus, 'red');
});

test('critical fail forces Red status even when the percentage alone would be Green', async () => {
  // 19 compliant + 1 critical fail = 95% (Green territory by percentage alone), but must be Red.
  const items = [];
  const criticalLib = await api('GET', `/api/checklists/library?q=${encodeURIComponent('Fire extinguishers')}`, { token });
  items.push(criticalLib.body.items.find((i) => i.is_critical));

  const pool = await api('GET', '/api/checklists/library?standard=INTERNAL_QC', { token });
  for (const item of pool.body.items) {
    if (items.length >= 20) break;
    if (!item.is_critical) items.push(item);
  }
  assert.equal(items.length, 20);

  const template = await api('POST', '/api/checklists/templates', {
    token, body: { name: 'Near-green test', itemIds: items.map((i) => i.id) },
  });
  const submission = await api('POST', '/api/submissions', { token, body: { templateId: template.body.template.id, branchId } });
  const subId = submission.body.submission.id;

  await postResponse(subId, { itemId: items[0].id, isCompliant: 'false' }); // the critical one fails
  for (const item of items.slice(1)) {
    await postResponse(subId, { itemId: item.id, isCompliant: 'true' });
  }
  await api('POST', `/api/submissions/${subId}/submit`, { token, body: {} });

  const scorecard = await api('GET', `/api/submissions/${subId}/scorecard`, { token });
  assert.equal(scorecard.body.percentage, 95);
  assert.equal(scorecard.body.criticalFails, 1);
  assert.equal(scorecard.body.ragStatus, 'red');
});
