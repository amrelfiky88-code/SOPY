import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { resetTestDb, closeDb } from '../test-utils/db.js';
import { startTestServer, makeClient, completeSetup } from '../test-utils/server.js';
import { refreshReminderSchedule, inReminderWindow, sendDueReminders, REMINDER_MINUTES } from '../src/reminders.js';

// The reminder job only asks the database inside a reminder window, so a
// database that sleeps when idle (Neon) isn't kept awake by a query a
// minute. The window must match the one the reminders are sent in.

let close, api, token, branchId, templateId;

before(async () => {
  await resetTestDb();
  const server = await startTestServer();
  close = server.close;
  api = makeClient(server.baseUrl);
  const signup = await api('POST', '/api/auth/signup', {
    body: { fullName: 'Owner', email: 'sched-owner@example.com', password: 'OwnerPass123', restaurantName: 'Sched', country: 'Egypt' },
  });
  token = signup.body.token;
  await completeSetup(api, token);
  branchId = (await api('POST', '/api/tenants/branches', { token, body: { name: 'Cairo store', timezone: 'Africa/Cairo' } })).body.branch.id;
  const item = (await api('GET', '/api/checklists/library?standard=HACCP', { token })).body.items[0];
  templateId = (await api('POST', '/api/checklists/templates', { token, body: { name: 'Opening', itemIds: [item.id] } })).body.template.id;
});

after(async () => {
  await close();
  await closeDb();
});

// Cairo is UTC+3 in October 2026 (summer time until the last Friday of October).
const cairo = (hhmm) => new Date(`2026-10-05T${hhmm}:00+03:00`);

test('the job knows when a reminder is near, in the store’s own time zone', async () => {
  await refreshReminderSchedule();
  assert.equal(inReminderWindow(cairo('08:45')), false, 'nothing is due yet');

  await api('POST', '/api/checklists/assignments', { token, body: { templateId, branchId, dueTime: '09:00' } });
  await refreshReminderSchedule();
  assert.equal(inReminderWindow(cairo('08:29')), false, 'more than 30 minutes before');
  assert.equal(inReminderWindow(cairo('08:30')), true, 'exactly 30 minutes before');
  assert.equal(inReminderWindow(cairo('08:59')), true);
  assert.equal(inReminderWindow(cairo('09:00')), false, 'due now: past the window, as in the SQL');
  assert.equal(REMINDER_MINUTES, 30);

  // Inside the window the reminder really is sent (the gate matches the query).
  assert.equal(await sendDueReminders(cairo('08:45')), 1);
});

test('a due time just after midnight is caught the evening before', async () => {
  await api('POST', '/api/checklists/assignments', { token, body: { templateId, branchId, dueTime: '00:15', role: 'business_owner' } });
  await refreshReminderSchedule();
  assert.equal(inReminderWindow(cairo('23:50')), true);
  assert.equal(inReminderWindow(cairo('23:40')), false);
});

test('creating or removing an assignment refreshes the list without waiting', async () => {
  const res = await api('POST', '/api/checklists/assignments', { token, body: { templateId, branchId, dueTime: '14:00', role: 'employee' } });
  await new Promise((r) => setTimeout(r, 300)); // the refresh runs after the response
  assert.equal(inReminderWindow(cairo('13:45')), true);
  await api('DELETE', `/api/checklists/assignments/${res.body.assignment.id}`, { token });
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(inReminderWindow(cairo('13:45')), false);
});
