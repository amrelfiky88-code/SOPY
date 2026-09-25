import React from 'react';
import { useT } from '../i18n/index.jsx';

// The job titles people choose from at sign-up and in their profile.
// Saved as the English value (users.title) and shown via jobTitle.* labels.
export const JOB_TITLES = ['Business Owner', 'Operations Manager', 'QAQC', 'Area Manager', 'Store Manager', 'Employee'];

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
