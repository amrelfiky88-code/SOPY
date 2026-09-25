// Role values, in the order they're offered. Names and descriptions are
// translated: role.* / roleDesc.* in the i18n dictionaries. What someone
// can do is decided by their role alone (see shared/roles.js).
export const ROLES = [
  { value: 'business_owner' },
  { value: 'operations_manager' },
  { value: 'area_manager' },
  { value: 'store_manager' },
  { value: 'employee' },
];

export const roleName = (t, role) => (role ? t(`role.${role}`) : '');
export const roleDescription = (t, role) => t(`roleDesc.${role}`);
