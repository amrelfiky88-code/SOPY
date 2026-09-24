import React from 'react';
import { useT } from '../../i18n/index.jsx';
import { ROLES, roleName, roleDescription } from './roles.js';

export default function StepRoles({ onNext }) {
  const t = useT();
  return (
    <div>
      <h2>{t('onb.roles.title')}</h2>
      <p>{t('onb.roles.intro')}</p>

      {ROLES.map((r) => (
        <div className="card" key={r.value} style={{ marginBottom: 10 }}>
          <strong>{roleName(t, r.value)}</strong>
          <p style={{ margin: '4px 0 0' }}>{roleDescription(t, r.value)}</p>
        </div>
      ))}

      <button className="btn btn-primary" onClick={onNext}>{t('common.continue')}</button>
    </div>
  );
}
