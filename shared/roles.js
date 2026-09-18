// Role hierarchy for user management, shared by the server (which
// enforces it) and the web app (which only offers choices that will be
// accepted). Higher rank = more authority.
//
// The rule applies to both inviting and editing: you can only act on
// people ranked strictly below you, and only give out roles ranked
// strictly below yours. That stops self-promotion (an area manager
// making themselves business owner) and stops anyone demoting a peer or
// superior — including the business owner, so a business is never left
// without one.
export const ROLE_RANK = {
  employee: 1,
  store_manager: 2,
  area_manager: 3,
  operations_manager: 4,
  business_owner: 5,
};

export const ACCESS_LEVEL_VALUES = ['admin', 'manager', 'standard'];

// Statuses a manager may set by hand. 'invited' is only ever set by the
// invite flow and cleared by accepting it.
export const EDITABLE_STATUSES = ['active', 'disabled'];

export const isValidRole = (role) => Object.hasOwn(ROLE_RANK, role);

// business_owner is never assignable: there is exactly one owner per
// business, created at signup. Transferring ownership would be a
// separate, deliberate flow — not a dropdown.
export function canAssignRole(actorRole, targetRole) {
  if (!isValidRole(targetRole) || targetRole === 'business_owner') return false;
  return ROLE_RANK[targetRole] < (ROLE_RANK[actorRole] ?? 0);
}

export function canManageUser(actorRole, targetRole) {
  return (ROLE_RANK[targetRole] ?? Infinity) < (ROLE_RANK[actorRole] ?? 0);
}
