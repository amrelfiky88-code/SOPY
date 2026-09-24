// Role and access-level values, in the order they're offered. Their names
// and descriptions are translated: role.* / roleDesc.* in the main
// dictionary, access.* / accessDesc.* in i18n/pageLabels.js.
export const ROLES = [
  { value: 'business_owner' },
  { value: 'operations_manager' },
  { value: 'area_manager' },
  { value: 'store_manager' },
  { value: 'employee' },
];

export const ACCESS_LEVELS = [
  { value: 'admin' },
  { value: 'manager' },
  { value: 'standard' },
];

export const roleName = (t, role) => (role ? t(`role.${role}`) : '');
export const roleDescription = (t, role) => t(`roleDesc.${role}`);
export const accessName = (t, level) => (level ? t(`access.${level}`) : '');
export const accessWithDescription = (t, level) => `${t(`access.${level}`)} — ${t(`accessDesc.${level}`)}`;
