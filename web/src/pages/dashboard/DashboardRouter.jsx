import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { api } from '../../api.js';
import MyChecklistsToday from './MyChecklistsToday.jsx';
import KpiSnapshot from './KpiSnapshot.jsx';
import { ClipboardCheckIcon, CheckCircleIcon, StorefrontIcon, UserIcon } from '../../components/icons.jsx';
import { useT } from '../../i18n/index.jsx';

export default function DashboardRouter() {
  const { user, tenant } = useAuth();
  const t = useT();
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    api.get('/dashboard/summary').then(setSummary);
  }, []);

  const isManager = ['business_owner', 'operations_manager', 'area_manager'].includes(user?.role);

  return (
    <div>
      <h2>{t('dashboard.welcome')}{tenant ? `, ${tenant.restaurant_name}` : ''}</h2>

      {summary && (
        <div className="kpi-grid">
          <SummaryTile icon={ClipboardCheckIcon} tone="green" label={t('dashboard.assigned')} value={summary.assignedChecklists} />
          <SummaryTile icon={CheckCircleIcon} tone="green" label={t('dashboard.submitted24h')} value={summary.submittedLast24h} />
          {isManager && <SummaryTile icon={StorefrontIcon} tone="amber" label={t('dashboard.activeStores')} value={summary.branchCount} />}
          {isManager && <SummaryTile icon={UserIcon} tone="amber" label={t('dashboard.teamMembers')} value={summary.userCount} />}
        </div>
      )}

      <MyChecklistsToday />

      {isManager && (
        <>
          <KpiSnapshot />
          <div className="card">
            <h3 style={{ marginBottom: 12 }}>{t('dashboard.manage')}</h3>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link className="btn btn-secondary btn-small" to="/app/checklists">{t('nav.builder')}</Link>
              <Link className="btn btn-secondary btn-small" to="/app/team">{t('nav.team')}</Link>
              <Link className="btn btn-secondary btn-small" to="/app/kpi">{t('dashboard.fullKpi')}</Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryTile({ icon: Icon, tone, label, value }) {
  return (
    <div className="kpi-tile">
      <div className={`icon-circle icon-circle-${tone}`}><Icon size={18} /></div>
      <div>
        <div className="label">{label}</div>
        <div className="value">{value}</div>
      </div>
    </div>
  );
}
