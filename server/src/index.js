import 'dotenv/config';
import { createApp } from './app.js';
import { startReminderJob } from './reminders.js';
import { upgradeSchema, upgradeContent } from './db/upgrade.js';
import { reportDeliverySetup } from './delivery.js';
import { prepareStorage } from './storage.js';

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

// Photos and shared PDFs live outside the app folder, which each deploy replaces.
prepareStorage();

const app = createApp();
const port = process.env.PORT || 4000;
const server = app.listen(port, () => console.log(`SOPY API listening on :${port}`));
// Whether people can reset their own password (email / text service).
reportDeliverySetup().catch(() => {});

// Node closes idle keep-alive sockets after 5s. A proxy in front (Vite in
// dev, the host's load balancer in production) can reuse a socket at the
// moment Node closes it, and the request dies with ECONNRESET — that is
// what left the checklist library empty on phones. Outlive the proxy's
// own idle timeout instead (headersTimeout must exceed keepAliveTimeout).
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

// Checklist reminders, checked once a minute (reminders.js).
startReminderJob();
