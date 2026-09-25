import React from 'react';
import { useT } from '../i18n/index.jsx';

// The job titles people choose from at sign-up and in their profile.
// Saved as the English value (users.title) and shown via jobTitle.* labels.
export const JOB_TITLES = ['Business Owner', 'Operations Manager', 'QAQC', 'Area Manager', 'Store Manager', 'Employee'];

const ROLE_TITLE = {
  business_owner: 'Business Owner',
  operations_manager: 'Operations Manager',
  area_manager: 'Area Manager',
  store_manager: 'Store Manager',
  employee: 'Employee',
};
export const titleForRole = (role) => ROLE_TITLE[role] || '';

// On an invite form the title follows the role as it changes, until the
// manager picks a different one (say, an Employee titled QAQC).
export function withRole(form, role) {
  const follows = !form.title || form.title === titleForRole(form.role);
  return { ...form, role, title: follows ? titleForRole(role) : form.title };
}

export default function JobTitleSelect({ id, value, onChange }) {
  const t = useT();
  // A title typed before this was a dropdown stays selectable.
  const legacy = value && !JOB_TITLES.includes(value) ? value : null;
  return (
    <select id={id} value={value || ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">{t('jobTitle.choose')}</option>
      {JOB_TITLES.map((v) => <option key={v} value={v}>{t(`jobTitle.${v}`)}</option>)}
      {legacy && <option value={legacy}>{legacy}</option>}
    </select>
  );
}
