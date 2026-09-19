// Which checklist assignments apply to a user. Shared by "My checklists
// today" and the dashboard's "Assigned to you" count so the two always
// agree (the count used to OR the conditions and over-count).
//
// Every condition an assignment sets must fit the user: a specific user,
// a role, and a store they belong to. Owners and operations managers
// oversee every store, so store-specific assignments reach them without a
// user_branches link. Assignments to removed stores drop out.

export const ALL_STORE_ROLES = ['business_owner', 'operations_manager'];

// Expects the query to bind $1 tenant id, $2 user id, $3 role, $4 ALL_STORE_ROLES.
export const MY_ASSIGNMENTS_FROM = `
  FROM checklist_assignments a
  JOIN checklist_templates t ON t.id = a.template_id
  LEFT JOIN branches b ON b.id = a.branch_id
  LEFT JOIN user_branches ub ON ub.branch_id = a.branch_id AND ub.user_id = $2
  WHERE a.tenant_id = $1 AND a.active
    AND (a.user_id IS NULL OR a.user_id = $2)
    AND (a.role IS NULL OR a.role::text = $3::text)
    AND (a.branch_id IS NULL OR ub.user_id IS NOT NULL OR $3::text = ANY($4::text[]))
    AND (b.id IS NULL OR b.is_active)`;

export const myAssignmentParams = (auth) => [auth.tenantId, auth.userId, auth.role, ALL_STORE_ROLES];
