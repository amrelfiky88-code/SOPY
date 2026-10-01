import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { requireAuth } from '../auth/middleware.js';
import { ALL_STORE_ROLES } from '../assignments.js';
import { pushToUsers } from '../push.js';

// Inbox: incident threads (opened by inbox.js when a report with an
// incident is submitted) and direct conversations between two people in
// the same business. Only a thread's members can read or write in it.
export const inboxRouter = Router();

export const MESSAGE_MAX_LENGTH = 2000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Every query binds $1 tenant, $2 user, $3 role, $4 ALL_STORE_ROLES.
const viewer = (req) => [req.auth.tenantId, req.auth.userId, req.auth.role, ALL_STORE_ROLES];

// Unread: messages from someone else since the person last opened it.
const UNREAD = `(SELECT count(*)::int FROM messages um
   WHERE um.thread_id = t.id AND um.sender_id IS DISTINCT FROM $2
     AND um.created_at > coalesce(me.last_read_at, '-infinity'::timestamptz))`;

// Who can see a thread. Incident and direct threads: their members.
// A store's team chat: everyone linked to that open store, plus the
// owners and operations managers — decided now, so it follows the team.
const VISIBLE = `((t.kind <> 'store' AND me.user_id IS NOT NULL)
  OR (t.kind = 'store' AND sb.is_active AND ($3::text = ANY($4::text[])
      OR EXISTS (SELECT 1 FROM user_branches eu WHERE eu.user_id = $2 AND eu.branch_id = t.branch_id))))`;

// The same rule for anyone (alias su): who's in a store chat.
export const STORE_MEMBER = `su.tenant_id = t.tenant_id AND su.status = 'active'
  AND (su.role::text = ANY($4::text[]) OR EXISTS (SELECT 1 FROM user_branches sub WHERE sub.user_id = su.id AND sub.branch_id = t.branch_id))`;

const THREAD_COLUMNS = `t.id, t.kind, t.submission_id, t.branch_id, t.last_message_at, ${UNREAD} AS unread,
  rt.name AS template_name, rt.kind AS report_kind, coalesce(rb.name, sb.name) AS branch_name,
  other.id AS other_id, other.full_name AS other_name, other.role AS other_role, other.title AS other_title,
  CASE WHEN t.kind = 'store' THEN (SELECT count(*)::int FROM users su WHERE ${STORE_MEMBER})
       ELSE (SELECT count(*)::int FROM message_thread_members mc WHERE mc.thread_id = t.id) END AS member_count`;

const THREAD_JOINS = `
  FROM message_threads t
  LEFT JOIN message_thread_members me ON me.thread_id = t.id AND me.user_id = $2
  LEFT JOIN branches sb ON sb.id = t.branch_id
  LEFT JOIN checklist_submissions rs ON rs.id = t.submission_id
  LEFT JOIN checklist_templates rt ON rt.id = rs.template_id
  LEFT JOIN branches rb ON rb.id = rs.branch_id
  LEFT JOIN LATERAL (
    SELECT u.id, u.full_name, u.role, u.title FROM message_thread_members om JOIN users u ON u.id = om.user_id
    WHERE om.thread_id = t.id AND om.user_id <> $2 AND t.kind = 'direct' LIMIT 1
  ) other ON true`;

inboxRouter.get('/threads', requireAuth, async (req, res) => {
  // Each open store has its team chat; made here the first time it's needed.
  await query(
    `INSERT INTO message_threads (tenant_id, kind, branch_id)
     SELECT $1, 'store', b.id FROM branches b WHERE b.tenant_id = $1 AND b.is_active
     ON CONFLICT (branch_id) DO NOTHING`,
    [req.auth.tenantId]
  );
  const { rows } = await query(
    `SELECT ${THREAD_COLUMNS},
            last.kind AS last_kind, last.body AS last_body, last.data AS last_data,
            last.sender_id AS last_sender_id, ls.full_name AS last_sender_name, last.created_at AS last_at
     ${THREAD_JOINS}
     LEFT JOIN LATERAL (
       SELECT kind, body, data, sender_id, created_at FROM messages WHERE thread_id = t.id ORDER BY created_at DESC LIMIT 1
     ) last ON true
     LEFT JOIN users ls ON ls.id = last.sender_id
     WHERE t.tenant_id = $1 AND ${VISIBLE}
     ORDER BY (last.created_at IS NULL), t.last_message_at DESC
     LIMIT 100`,
    viewer(req)
  );
  res.json({ threads: rows });
});

// Badges for the tab bar and the bell, in one cheap call.
inboxRouter.get('/summary', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT
       (SELECT coalesce(sum(${UNREAD}), 0)::int
          FROM message_threads t
          LEFT JOIN message_thread_members me ON me.thread_id = t.id AND me.user_id = $2
          LEFT JOIN branches sb ON sb.id = t.branch_id
          WHERE t.tenant_id = $1 AND ${VISIBLE}) AS unread_messages,
       (SELECT count(*)::int FROM notifications WHERE tenant_id = $1 AND user_id = $2 AND read_at IS NULL) AS unread_notifications`,
    viewer(req)
  );
  res.json({ unreadMessages: rows[0].unread_messages, unreadNotifications: rows[0].unread_notifications });
});

// Start (or reopen) a direct conversation with someone in the business.
inboxRouter.post('/threads', requireAuth, async (req, res) => {
  const { userId } = req.body;
  if (typeof userId !== 'string' || !UUID_RE.test(userId)) return res.status(400).json({ error: 'Choose who to message' });
  if (userId === req.auth.userId) return res.status(400).json({ error: "You can't message yourself" });
  const { rows: target } = await query(
    "SELECT id FROM users WHERE id = $1 AND tenant_id = $2 AND status = 'active'",
    [userId, req.auth.tenantId]
  );
  if (!target[0]) return res.status(404).json({ error: 'User not found' });

  const key = [req.auth.userId, userId].sort().join(':');
  const threadId = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO message_threads (tenant_id, kind, direct_key) VALUES ($1, 'direct', $2)
       ON CONFLICT (direct_key) DO UPDATE SET direct_key = EXCLUDED.direct_key RETURNING id`,
      [req.auth.tenantId, key]
    );
    for (const id of [req.auth.userId, userId]) {
      await client.query(
        'INSERT INTO message_thread_members (thread_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [rows[0].id, id]
      );
    }
    return rows[0].id;
  });
  res.status(201).json({ threadId });
});

async function memberThread(req, res) {
  if (!UUID_RE.test(req.params.id)) { res.status(404).json({ error: 'Not found' }); return null; }
  const { rows } = await query(`SELECT ${THREAD_COLUMNS} ${THREAD_JOINS} WHERE t.id = $5 AND t.tenant_id = $1 AND ${VISIBLE}`,
    [...viewer(req), req.params.id]);
  if (!rows[0]) { res.status(404).json({ error: 'Not found' }); return null; }
  return rows[0];
}

// Store chats get a member row the first time someone reads or writes there.
function markRead(client, threadId, userId, at) {
  return client.query(
    `INSERT INTO message_thread_members (thread_id, user_id, last_read_at) VALUES ($1, $2, $3)
     ON CONFLICT (thread_id, user_id) DO UPDATE SET last_read_at = GREATEST(message_thread_members.last_read_at, EXCLUDED.last_read_at)`,
    [threadId, userId, at]
  );
}

inboxRouter.get('/threads/:id', requireAuth, async (req, res) => {
  const thread = await memberThread(req, res);
  if (!thread) return;
  // The latest 200, oldest first.
  const { rows: messages } = await query(
    `SELECT * FROM (
       SELECT m.id, m.kind, m.body, m.data, m.sender_id, u.full_name AS sender_name, m.created_at
       FROM messages m LEFT JOIN users u ON u.id = m.sender_id
       WHERE m.thread_id = $1 ORDER BY m.created_at DESC LIMIT 200
     ) x ORDER BY created_at`,
    [thread.id]
  );
  const { rows: members } = thread.kind === 'store'
    ? await query(
      `SELECT su.id, su.full_name, su.role, su.title FROM message_threads t JOIN users su ON ${STORE_MEMBER.replaceAll('$4', '$2')}
       WHERE t.id = $1 ORDER BY su.full_name`,
      [thread.id, ALL_STORE_ROLES]
    )
    : await query(
      `SELECT u.id, u.full_name, u.role, u.title FROM message_thread_members mm JOIN users u ON u.id = mm.user_id
       WHERE mm.thread_id = $1 ORDER BY u.full_name`,
      [thread.id]
    );
  res.json({ thread, messages, members });
});

inboxRouter.post('/threads/:id/messages', requireAuth, async (req, res) => {
  const text = typeof req.body.body === 'string' ? req.body.body.trim() : '';
  if (!text) return res.status(400).json({ error: 'Write a message before sending.' });
  if (text.length > MESSAGE_MAX_LENGTH) return res.status(400).json({ error: `Keep it under ${MESSAGE_MAX_LENGTH} characters.` });
  const thread = await memberThread(req, res);
  if (!thread) return;
  const message = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO messages (thread_id, sender_id, kind, body) VALUES ($1, $2, 'text', $3)
       RETURNING id, kind, body, data, sender_id, created_at`,
      [thread.id, req.auth.userId, text]
    );
    await client.query('UPDATE message_threads SET last_message_at = $2 WHERE id = $1', [thread.id, rows[0].created_at]);
    await markRead(client, thread.id, req.auth.userId, rows[0].created_at);
    return rows[0];
  });
  // A phone push for the other people in the conversation. Pushes share a
  // tag per conversation, so a busy store chat replaces its last alert on
  // the phone rather than stacking one per message. Incident pushes follow
  // the incident-alerts setting.
  const { rows: others } = thread.kind === 'store'
    ? await query(
      `SELECT su.id AS user_id FROM message_threads t JOIN users su ON ${STORE_MEMBER.replaceAll('$4', '$3')}
       WHERE t.id = $1 AND su.id <> $2`,
      [thread.id, req.auth.userId, ALL_STORE_ROLES]
    )
    : await query(
      `SELECT m.user_id FROM message_thread_members m JOIN users u ON u.id = m.user_id
       WHERE m.thread_id = $1 AND m.user_id <> $2 AND ($3 = 'direct' OR u.notify_incidents)`,
      [thread.id, req.auth.userId, thread.kind]
    );
  const { rows: me } = await query('SELECT full_name FROM users WHERE id = $1', [req.auth.userId]);
  pushToUsers(others.map((o) => o.user_id), 'message', {
    senderName: me[0]?.full_name || '', body: message.body, incident: thread.kind === 'incident',
    store: thread.kind === 'store' ? thread.branch_name : null,
    kind: thread.report_kind, templateName: thread.template_name,
  }, { url: `/app/inbox/${thread.id}`, tag: `thread-${thread.id}` });
  res.status(201).json({ message });
});

inboxRouter.post('/threads/:id/read', requireAuth, async (req, res) => {
  const thread = await memberThread(req, res);
  if (!thread) return;
  await markRead({ query }, thread.id, req.auth.userId, new Date());
  res.status(204).end();
});

// --- Notifications ---
export const notificationsRouter = Router();

notificationsRouter.get('/', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT id, kind, data, submission_id, thread_id, read_at, created_at FROM notifications
     WHERE tenant_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 100`,
    [req.auth.tenantId, req.auth.userId]
  );
  res.json({ notifications: rows });
});

notificationsRouter.post('/read-all', requireAuth, async (req, res) => {
  await query('UPDATE notifications SET read_at = now() WHERE tenant_id = $1 AND user_id = $2 AND read_at IS NULL',
    [req.auth.tenantId, req.auth.userId]);
  res.status(204).end();
});

notificationsRouter.post('/:id/read', requireAuth, async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(404).json({ error: 'Not found' });
  const { rowCount } = await query(
    'UPDATE notifications SET read_at = coalesce(read_at, now()) WHERE id = $1 AND tenant_id = $2 AND user_id = $3',
    [req.params.id, req.auth.tenantId, req.auth.userId]
  );
  if (!rowCount) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});
