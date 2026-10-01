import { query, withTransaction } from './db.js';
import { ALL_STORE_ROLES } from './assignments.js';
import { pushToUsers } from './push.js';

// Who acts on a store's problems: owners and operations managers (every
// store), plus the area and store managers assigned to that store. The same
// people who can see its reports (auth/scope.js).
const STORE_MANAGER_ROLES = ['area_manager', 'store_manager'];

async function storeManagers(client, tenantId, branchId) {
  const { rows } = await client.query(
    `SELECT DISTINCT u.id, u.notify_incidents FROM users u
     LEFT JOIN user_branches ub ON ub.user_id = u.id AND ub.branch_id = $2
     WHERE u.tenant_id = $1 AND u.status = 'active'
       AND (u.role::text = ANY($3::text[]) OR (u.role::text = ANY($4::text[]) AND ub.user_id IS NOT NULL))`,
    [tenantId, branchId, ALL_STORE_ROLES, STORE_MANAGER_ROLES]
  );
  return rows;
}

async function reportSummary(client, submissionId) {
  const { rows } = await client.query(
    `SELECT s.id, s.tenant_id, s.branch_id, s.submitted_by, s.has_incident, s.template_id,
            t.name AS template_name, t.kind, b.name AS branch_name, u.full_name AS submitted_by_name,
            (SELECT count(*)::int FROM checklist_template_items ti
               JOIN checklist_items ci ON ci.id = ti.item_id AND ci.is_critical
               JOIN LATERAL (
                 SELECT is_compliant FROM checklist_submission_responses
                 WHERE submission_id = s.id AND item_id = ci.id ORDER BY created_at DESC LIMIT 1
               ) r ON r.is_compliant = false
             WHERE ti.template_id = s.template_id) AS critical_fails
     FROM checklist_submissions s
     JOIN checklist_templates t ON t.id = s.template_id
     JOIN branches b ON b.id = s.branch_id
     JOIN users u ON u.id = s.submitted_by
     WHERE s.id = $1`,
    [submissionId]
  );
  return rows[0];
}

// Called once a report is signed off. An incident opens a thread with the
// store's managers and the person who filed it, starts it with SOPY's
// summary, and notifies the managers. Any other report lets the store's
// own managers know it's in. Never throws: a report is already submitted
// by the time this runs, and a failure here mustn't turn that into an error.
export async function onReportSubmitted(submissionId, { temperatureIssues = 0 } = {}) {
  // Phone pushes go out once the transaction has committed.
  let push = null;
  try {
    await withTransaction(async (client) => {
      const r = await reportSummary(client, submissionId);
      if (!r) return;
      const managerRows = await storeManagers(client, r.tenant_id, r.branch_id);
      const managers = managerRows.map((m) => m.id);
      // Managers who turned incident alerts off in Profile are still in the
      // thread; they just aren't sent a notification.
      const alerted = managerRows.filter((m) => m.id !== r.submitted_by && m.notify_incidents).map((m) => m.id);
      const data = {
        templateName: r.template_name,
        kind: r.kind,
        branchName: r.branch_name,
        submittedByName: r.submitted_by_name,
        criticalFails: r.critical_fails,
        temperatureIssues,
      };

      if (!r.has_incident) {
        // Store managers only: owners and operations managers would hear
        // about every report in the business.
        const { rows } = await client.query(
          `SELECT u.id FROM users u JOIN user_branches ub ON ub.user_id = u.id AND ub.branch_id = $2
           WHERE u.tenant_id = $1 AND u.status = 'active' AND u.role = 'store_manager' AND u.id <> $3`,
          [r.tenant_id, r.branch_id, r.submitted_by]
        );
        for (const { id } of rows) {
          await client.query(
            `INSERT INTO notifications (tenant_id, user_id, kind, data, submission_id) VALUES ($1, $2, 'report_submitted', $3, $4)`,
            [r.tenant_id, id, data, r.id]
          );
        }
        push = () => pushToUsers(rows.map((x) => x.id), 'report_submitted', data, { url: `/app/reports/${r.id}`, tag: `report-${r.id}` });
        return;
      }

      const { rows: threadRows } = await client.query(
        `INSERT INTO message_threads (tenant_id, kind, submission_id) VALUES ($1, 'incident', $2)
         ON CONFLICT (submission_id) DO NOTHING RETURNING id`,
        [r.tenant_id, r.id]
      );
      const threadId = threadRows[0]?.id;
      if (!threadId) return; // already opened for this report
      for (const id of new Set([r.submitted_by, ...managers])) {
        // The person who filed it has seen what they filed.
        await client.query(
          `INSERT INTO message_thread_members (thread_id, user_id, last_read_at) VALUES ($1, $2, $3)`,
          [threadId, id, id === r.submitted_by ? new Date() : null]
        );
      }
      await client.query(
        `INSERT INTO messages (thread_id, sender_id, kind, data) VALUES ($1, NULL, 'incident', $2)`,
        [threadId, { ...data, notified: alerted.length }]
      );
      for (const id of alerted) {
        await client.query(
          `INSERT INTO notifications (tenant_id, user_id, kind, data, submission_id, thread_id) VALUES ($1, $2, 'incident', $3, $4, $5)`,
          [r.tenant_id, id, data, r.id, threadId]
        );
      }
      push = () => pushToUsers(alerted, 'incident', data, { url: `/app/inbox/${threadId}`, tag: `thread-${threadId}` });
    });
    push?.();
  } catch (err) {
    console.error('Could not post the report to the inbox:', err);
  }
}

// The referrer's owners hear that they earned credit.
export async function notifyReferralCredit(tenantId, amount, refereeTenantId) {
  try {
    const { rows } = await query('SELECT restaurant_name FROM tenants WHERE id = $1', [refereeTenantId]);
    const data = { amount: Number(amount), restaurantName: rows[0]?.restaurant_name || '' };
    const { rows: owners } = await query(
      `INSERT INTO notifications (tenant_id, user_id, kind, data)
       SELECT $1, u.id, 'referral_credit', $2 FROM users u
       WHERE u.tenant_id = $1 AND u.role = 'business_owner' AND u.status = 'active'
       RETURNING user_id`,
      [tenantId, data]
    );
    pushToUsers(owners.map((o) => o.user_id), 'referral_credit', data, { url: '/app/account' });
  } catch (err) {
    console.error('Could not post the referral notification:', err);
  }
}
