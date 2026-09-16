export const ROLES = [
  { value: 'business_owner', label: 'Business Owner', description: 'Full access across all branches: billing, users, and every checklist.' },
  { value: 'operations_manager', label: 'Operations Manager', description: 'Manages checklists, users, and stores across the whole business.' },
  { value: 'area_manager', label: 'Area Manager', description: 'Oversees a group of branches and the staff assigned to them.' },
  { value: 'store_manager', label: 'Store Manager', description: 'Runs day-to-day compliance for a single branch.' },
  { value: 'employee', label: 'Employee', description: 'Completes assigned checklists and daily operation reports.' },
];

export const ACCESS_LEVELS = [
  { value: 'admin', label: 'Admin — can manage users, stores, and checklists' },
  { value: 'manager', label: 'Manager — can assign checklists and review submissions' },
  { value: 'standard', label: 'Standard — can complete assigned checklists only' },
];
