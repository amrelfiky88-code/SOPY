import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { resetTestDb, closeDb } from '../test-utils/db.js';
import { startTestServer, makeClient } from '../test-utils/server.js';

let close, api, token;

before(async () => {
  await resetTestDb();
  const server = await startTestServer();
  close = server.close;
  api = makeClient(server.baseUrl);

  const signup = await api('POST', '/api/auth/signup', {
    body: { fullName: 'Amina', email: 'amina@example.com', password: 'SopyDemo123', restaurantName: 'The Nile Bistro', country: 'Egypt', branchCount: 1, userCount: 1 },
  });
  token = signup.body.token;
  await api('POST', '/api/onboarding/complete', { token, body: {} });
});

after(async () => {
  await close();
  await closeDb();
});

test('SOP 11 daily checklist has 7 categories atomized into 38 individual items, each with the expected critical count', async () => {
  const res = await api('GET', '/api/checklists/library?standard=SOP', { token });
  const byCategory = (prefix) => res.body.items.filter((i) => i.category.startsWith(prefix));
  const criticalCount = (items) => items.filter((i) => i.is_critical).length;

  const expected = {
    '1. Temperature Monitoring': [4, 3],
    '2. Food Storage': [6, 4],
    '3. Personal Hygiene': [6, 2],
    '4. Cleaning & Sanitation': [6, 1],
    '5. Equipment Maintenance': [5, 0],
    '6. Facility Conditions': [6, 1],
    '7. Documentation': [5, 2],
    '8. When Inspector Arrives': [6, 3],
  };

  for (const [phase, [count, critical]] of Object.entries(expected)) {
    const items = byCategory(`SOP 11: Health Inspection Readiness — ${phase}`);
    assert.equal(items.length, count, `${phase} item count`);
    assert.equal(criticalCount(items), critical, `${phase} critical count`);
  }
});

test('daily checklist items have no description (the item text is the complete checkpoint), but inspector-arrival items do', async () => {
  const res = await api('GET', '/api/checklists/library?standard=SOP', { token });
  const tempCheck = res.body.items.find((i) => i.text === 'All refrigerator/freezer temps recorded and within range');
  assert.equal(tempCheck.description, null);

  const managerNotify = res.body.items.find((i) => i.text === 'Manager notified immediately of inspector arrival');
  assert.equal(managerNotify.is_critical, true);
  assert.ok(managerNotify.description.includes('middle of a rush'));
});
