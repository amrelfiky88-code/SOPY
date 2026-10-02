import 'dotenv/config';
import { createApp } from './app.js';
import { startReminderJob } from './reminders.js';
import { upgradeSchema, upgradeContent } from './db/upgrade.js';

// Bring the database up to schema.sql before taking requests, so a deploy
// with new columns or tables doesn't fail on a database made before them.
// A database that can't be reached is logged, not fatal: the requests will
// say so themselves.
try {
  const { failed } = await upgradeSchema();
  console.log(failed.length ? `Database checked: ${failed.length} change(s) could not be applied (see above)` : 'Database is up to date');
  await upgradeContent();
} catch (err) {
  console.error('Could not check the database schema:', err.message);
}

const app = createApp();
const port = process.env.PORT || 4000;
const server = app.listen(port, () => console.log(`SOPY API listening on :${port}`));

// Node closes idle keep-alive sockets after 5s. A proxy in front (Vite in
// dev, the host's load balancer in production) can reuse a socket at the
// moment Node closes it, and the request dies with ECONNRESET — that is
// what left the checklist library empty on phones. Outlive the proxy's
// own idle timeout instead (headersTimeout must exceed keepAliveTimeout).
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

// Checklist reminders, checked once a minute (reminders.js).
startReminderJob();
