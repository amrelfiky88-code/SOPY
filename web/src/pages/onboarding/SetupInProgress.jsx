import React from 'react';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useT } from '../../i18n/index.jsx';
import { ClipboardEmptyIcon } from '../../components/icons.jsx';

// Staff who accept an invite before the owner has finished setting the
// business up. They used to be pushed into the owner's setup wizard,
// where every action came back "Insufficient permissions".
export default function SetupInProgress() {
  const { tenant, user, logout } = useAuth();
  const t = useT();
  return (
    <div className="screen-narrow">
      <span className="auth-brand">SOPY</span>
      <div className="card empty-state">
        <ClipboardEmptyIcon size={32} />
        <h2 style={{ margin: 0 }}>{t('setup.title')}</h2>
        <p style={{ margin: 0 }}>{t('setup.body', { restaurant: tenant?.restaurant_name || 'your restaurant' })}</p>
        <p className="hint" style={{ margin: 0 }}>{t('setup.signedInAs', { name: user?.fullName || '' })}</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button type="button" className="btn btn-secondary btn-small" onClick={() => window.location.reload()}>{t('common.tryAgain')}</button>
          <button type="button" className="btn btn-secondary btn-small" onClick={logout}>{t('nav.logout')}</button>
        </div>
      </div>
    </div>
  );
}
