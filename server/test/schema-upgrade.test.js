import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { resetTestDb, closeDb } from '../test-utils/db.js';
import { startTestServer, makeClient, completeSetup } from '../test-utils/server.js';
import { pool } from '../src/db.js';
import { upgradeSchema } from '../src/db/upgrade.js';

// A live database made before the newest columns and tables. The code
// asked for subscriptions.provider at login, so with it missing every
// login failed with "Internal server error". The server now brings the
// database up to schema.sql when it starts (src/db/upgrade.js).

let close, api;
const quiet = { warn: () => {} };

before(async () => {
  await resetTestDb();
  const server = await startTestServer();
  close = server.close;
  api = makeClient(server.baseUrl);
});

after(async () => {
  await close();
  await closeDb();
});

const columnExists = async (table, column) =>
  (await pool.query('SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2', [table, column])).rows.length === 1;
const tableExists = async (table) => (await pool.query('SELECT to_regclass($1) AS t', [table])).rows[0].t !== null;

test('on an up-to-date database the upgrade changes nothing and reports nothing', async () => {
  const { failed, applied } = await upgradeSchema({ log: quiet });
  assert.deepEqual(failed, []);
  assert.equal(applied, 0);
});

test('an up-to-date database is checked without locking its tables, so a busy live database never stalls start-up', async () => {
  // Another connection mid-query holds an ordinary lock on users. An
  // ALTER TABLE, even ADD COLUMN IF NOT EXISTS for a column that's there,
  // waits for an exclusive lock and makes every later query queue behind it.
  const busy = await pool.connect();
  try {
    await busy.query('BEGIN');
    await busy.query('LOCK TABLE users IN ACCESS SHARE MODE');
    const started = Date.now();
    const result = await Promise.race([
      upgradeSchema({ log: quiet }),
      new Promise((resolve) => setTimeout(() => resolve('stalled'), 5000)),
    ]);
    assert.notEqual(result, 'stalled', 'the upgrade waited on a table lock');
    assert.deepEqual(result.failed, []);
    assert.ok(Date.now() - started < 5000);
  } finally {
    await busy.query('ROLLBACK');
    busy.release();
  }
});

test('a database missing newer columns and tables is brought up to date, and login works again', async () => {
  const signup = await api('POST', '/api/auth/signup', {
    body: { fullName: 'Mona', email: 'mona.old@example.com', password: 'OldDbPass123', restaurantName: 'Old Cafe', country: 'Egypt' },
  });
  await completeSetup(api, signup.body.token);

  // What a database from before Paymob, the inbox and phone notifications looks like.
  await pool.query(`
    DROP TABLE paymob_payments; DROP TABLE push_subscriptions;
    DROP TABLE notifications; DROP TABLE messages; DROP TABLE message_thread_members; DROP TABLE message_threads;
    ALTER TABLE subscriptions DROP COLUMN provider;
    ALTER TABLE users DROP COLUMN notify_incidents, DROP COLUMN notify_reminders, DROP COLUMN invite_expires_at;
    ALTER TABLE checklist_templates DROP COLUMN library_group;
  `);
  const broken = await api('POST', '/api/auth/login', { body: { email: 'mona.old@example.com', password: 'OldDbPass123' } });
  assert.equal(broken.status, 500, 'the bug: login fails on the old database');

  const { failed } = await upgradeSchema({ log: quiet });
  assert.deepEqual(failed, []);
  for (const t of ['paymob_payments', 'push_subscriptions', 'notifications', 'messages', 'message_thread_members', 'message_threads']) {
    assert.ok(await tableExists(t), `${t} is back`);
  }
  assert.ok(await columnExists('subscriptions', 'provider'));
  assert.ok(await columnExists('users', 'notify_incidents'));
  assert.ok(await columnExists('message_threads', 'branch_id'));
  assert.ok(await columnExists('checklist_templates', 'library_group'));
  const { rows } = await pool.query("SELECT provider FROM subscriptions s JOIN users u ON u.tenant_id = s.tenant_id WHERE u.email = 'mona.old@example.com'");
  assert.equal(rows[0].provider, 'paddle', 'existing rows get the default');
  const idx = await pool.query("SELECT 1 FROM pg_indexes WHERE indexname = 'idx_notifications_one_reminder'");
  assert.equal(idx.rows.length, 1, 'indexes on new tables are made too');

  const login = await api('POST', '/api/auth/login', { body: { email: 'mona.old@example.com', password: 'OldDbPass123' } });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  assert.equal(login.body.tenant.plan_ended, false);
  const inbox = await api('GET', '/api/inbox/summary', { token: login.body.token });
  assert.equal(inbox.status, 200, 'the inbox works on the upgraded database');

  // Every start runs it again: still nothing to report.
  assert.deepEqual((await upgradeSchema({ log: quiet })).failed, []);
});

test('a missing role value is added to the role list', async () => {
  // Rebuild user_role without 'area_manager', as an early database might have it.
  await pool.query(`
    ALTER TABLE users ALTER COLUMN role DROP DEFAULT;
    ALTER TABLE users ALTER COLUMN role TYPE TEXT;
    ALTER TABLE checklist_assignments ALTER COLUMN role TYPE TEXT;
    DROP TYPE user_role;
    CREATE TYPE user_role AS ENUM ('business_owner', 'operations_manager', 'store_manager', 'employee');
    ALTER TABLE users ALTER COLUMN role TYPE user_role USING role::user_role;
    ALTER TABLE users ALTER COLUMN role SET DEFAULT 'employee';
    ALTER TABLE checklist_assignments ALTER COLUMN role TYPE user_role USING role::user_role;
  `);
  assert.deepEqual((await upgradeSchema({ log: quiet })).failed, []);
  const { rows } = await pool.query("SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'user_role'");
  assert.ok(rows.some((r) => r.enumlabel === 'area_manager'));
});
