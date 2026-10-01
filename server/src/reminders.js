import { query } from './db.js';
import { ALL_STORE_ROLES } from './assignments.js';
import { planEnded } from './auth/plan.js';
import { pushToUsers } from './push.js';

// Checklist reminders. An assignment with a due time ("Due by" in the
// Checklist Builder) reminds each person it applies to REMINDER_MINUTES
// before that time, in the store's own time zone, unless they've already
// done it within the checklist's frequency (the same "Done" rule as My
// checklists today) or turned reminders off in Profile. Sent once per
// person, assignment and day (a unique index on notifications), so the
// job can run every minute, on several servers, and after a restart.
export const REMINDER_MINUTES = 30;

// Bound: $1 the moment to check, $2 ALL_STORE_ROLES, $3 REMINDER_MINUTES.
const DUE_SQL = `
WITH targets AS (
  SELECT a.id AS assignment_id, a.tenant_id, a.due_time, t.name AS template_name, t.kind, t.frequency,
         b.name AS branch_name, u.id AS user_id,
         -- A store's time zone; for an "All stores" checklist, the person's first store's.
         coalesce(b.timezone, (SELECT ob.timezone FROM user_branches oub JOIN branches ob ON ob.id = oub.branch_id AND ob.is_active
                               WHERE oub.user_id = u.id ORDER BY ob.created_at LIMIT 1), 'UTC') AS tz_raw
  FROM checklist_assignments a
  JOIN checklist_templates t ON t.id = a.template_id
  JOIN tenants tn ON tn.id = a.tenant_id AND tn.onboarding_step = 'complete'
  LEFT JOIN branches b ON b.id = a.branch_id
  JOIN users u ON u.tenant_id = a.tenant_id AND u.status = 'active' AND u.notify_reminders
  WHERE a.active AND a.due_time IS NOT NULL
    AND (b.id IS NULL OR b.is_active)
    AND (a.user_id IS NULL OR a.user_id = u.id)
    AND (a.role IS NULL OR a.role = u.role)
    AND (a.branch_id IS NULL OR u.role::text = ANY($2::text[])
         OR EXISTS (SELECT 1 FROM user_branches ub WHERE ub.user_id = u.id AND ub.branch_id = a.branch_id))
),
zoned AS (
  -- A time zone Postgres doesn't know (typed in by hand) counts as UTC.
  SELECT x.*, CASE WHEN EXISTS (SELECT 1 FROM pg_timezone_names z WHERE z.name = x.tz_raw) THEN x.tz_raw ELSE 'UTC' END AS tz
  FROM targets x
),
due AS (
  -- Today's and tomorrow's due time, so a 00:15 deadline is caught at 23:45.
  SELECT z.*, d.due_date, (d.due_date + z.due_time) AT TIME ZONE z.tz AS due_at
  FROM zoned z
  CROSS JOIN LATERAL (
    SELECT ((($1::timestamptz) AT TIME ZONE z.tz)::date + k) AS due_date FROM generate_series(0, 1) AS k
  ) d
)
SELECT due.*, to_char(due.due_time, 'HH24:MI') AS due_hm, to_char(due.due_date, 'YYYY-MM-DD') AS due_ymd,
       EXISTS (SELECT 1 FROM checklist_submissions s
               WHERE s.assignment_id = due.assignment_id AND s.submitted_by = due.user_id AND s.status = 'in_progress'
                 AND s.started_at >= $1::timestamptz - interval '16 hours') AS started
FROM due
WHERE $1::timestamptz >= due.due_at - make_interval(mins => $3) AND $1::timestamptz < due.due_at
  AND NOT EXISTS (
    SELECT 1 FROM checklist_submissions s
    WHERE s.assignment_id = due.assignment_id AND s.submitted_by = due.user_id AND s.status = 'submitted'
      AND s.submitted_at >= $1::timestamptz - (CASE due.frequency
        WHEN 'weekly' THEN interval '7 days'
        WHEN 'monthly' THEN interval '30 days'
        WHEN 'quarterly' THEN interval '90 days'
        ELSE interval '16 hours' END))`;

export async function sendDueReminders(at = new Date()) {
  const { rows } = await query(DUE_SQL, [at, ALL_STORE_ROLES, REMINDER_MINUTES]);
  // A business whose plan has ended can't start checklists; don't nag it.
  const ended = new Map();
  let sent = 0;
  for (const r of rows) {
    if (!ended.has(r.tenant_id)) ended.set(r.tenant_id, await planEnded(r.tenant_id));
    if (ended.get(r.tenant_id)) continue;
    const data = {
      assignmentId: r.assignment_id,
      dueDate: r.due_ymd,
      dueTime: r.due_hm,
      templateName: r.template_name,
      kind: r.kind,
      branchName: r.branch_name,
      started: r.started,
    };
    const { rowCount } = await query(
      `INSERT INTO notifications (tenant_id, user_id, kind, data)
       VALUES ($1, $2, 'checklist_due', $3)
       ON CONFLICT (user_id, (data->>'assignmentId'), (data->>'dueDate')) WHERE kind = 'checklist_due' DO NOTHING`,
      [r.tenant_id, r.user_id, data]
    );
    if (rowCount) pushToUsers([r.user_id], 'checklist_due', data, { url: '/app/dashboard', tag: `due-${r.assignment_id}` });
    sent += rowCount;
  }
  return sent;
}

// Started by index.js (not by createApp, so tests run it by hand).
export function startReminderJob(everyMs = 60_000) {
  const run = () => sendDueReminders().catch((err) => console.error('Checklist reminders failed:', err.message));
  const first = setTimeout(run, 10_000);
  const timer = setInterval(run, everyMs);
  first.unref();
  timer.unref();
  return () => { clearTimeout(first); clearInterval(timer); };
}
