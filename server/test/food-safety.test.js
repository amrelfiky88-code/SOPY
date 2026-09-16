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

test('SOP 3/4/5 food-safety items have the expected counts and critical counts per phase', async () => {
  const res = await api('GET', '/api/checklists/library?standard=SOP', { token });
  assert.equal(res.status, 200);

  const byPhase = (prefix) => res.body.items.filter((i) => i.category.startsWith(prefix));
  const criticalCount = (items) => items.filter((i) => i.is_critical).length;

  const receiving = byPhase('SOP 3: Receiving & Storage');
  const temperature = byPhase('SOP 4: Temperature Monitoring');
  const hygiene = byPhase('SOP 5: Handwashing & Hygiene');

  assert.equal(receiving.length, 7);
  assert.equal(temperature.length, 7);
  assert.equal(hygiene.length, 4);

  // Counted by hand against the source document's own emphasis (explicit
  // "Critical timing" / "Critical for Food Safety" / "Illness Policy
  // (Critical)" language, plus the core temperature-control CCPs).
  assert.equal(criticalCount(receiving), 2);
  assert.equal(criticalCount(temperature), 6);
  assert.equal(criticalCount(hygiene), 3);

  // Only equipment calibration is non-critical within SOP 4 — everything
  // else in temperature monitoring is a direct foodborne-illness control.
  const calibration = temperature.find((i) => i.text === 'Thermometer calibration completed');
  assert.equal(calibration.is_critical, false);
});

test('product inspection item carries the reject/photograph guidance from the source document', async () => {
  const res = await api('GET', `/api/checklists/library?q=${encodeURIComponent('Product inspection completed')}`, { token });
  const item = res.body.items.find((i) => i.text === 'Product inspection completed');
  assert.ok(item, 'expected to find the Product inspection completed item');
  assert.equal(item.requires_photo, true);
  assert.equal(item.is_critical, true);
  assert.ok(item.description.includes('photograph evidence'));
});
