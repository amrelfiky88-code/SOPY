import { query } from '../db.js';
import { ALL_STORE_ROLES } from '../assignments.js';

// Which stores' reports and KPIs someone may see. Owners and operations
// managers see every store (null). Area and store managers see the stores
// they're assigned to. Staff see only what they filed themselves, which
// callers handle through SEES_OWN_ONLY.
export async function visibleBranchIds(auth) {
  if (ALL_STORE_ROLES.includes(auth.role)) return null;
  const { rows } = await query(
    `SELECT ub.branch_id FROM user_branches ub JOIN branches b ON b.id = ub.branch_id
     WHERE ub.user_id = $1 AND b.tenant_id = $2 AND b.is_active`,
    [auth.userId, auth.tenantId]
  );
  return rows.map((r) => r.branch_id);
}

export const SEES_OWN_ONLY = ['employee'];

// One report: always your own; otherwise a store in your scope. A store
// manager used to be able to open every store's reports although their
// KPIs covered only their own store.
export async function canSeeSubmission(auth, submission) {
  if (!submission) return false;
  if (submission.submitted_by === auth.userId) return true;
  if (SEES_OWN_ONLY.includes(auth.role)) return false;
  const stores = await visibleBranchIds(auth);
  return stores === null || stores.includes(submission.branch_id);
}
