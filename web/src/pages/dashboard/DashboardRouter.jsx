import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { api } from '../../api.js';
import MyChecklistsToday from './MyChecklistsToday.jsx';
import KpiSnapshot from './KpiSnapshot.jsx';

export default function DashboardRouter() {
  const { user, tenant } = useAuth();
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    api.get('/dashboard/summary').then(setSummary);
  }, []);

  const isManager = ['business_owner', 'operations_manager', 'area_manager'].includes(user?.role);

  return (
    <div>
      <h2>Welcome back{tenant ? `, ${tenant.restaurant_name}` : ''}</h2>

      {summary && (
        <div className="kpi-grid">
          <SummaryTile label="Assigned to you" value={summary.assignedChecklists} />
          <SummaryTile label="You submitted (24h)" value={summary.submittedLast24h} />
          {isManager && <SummaryTile label="Active stores" value={summary.branchCount} />}
          {isManager && <SummaryTile label="Team members" value={summary.userCount} />}
        </div>
      )}

      <MyChecklistsToday />

      {isManager && (
        <>
          <KpiSnapshot />
          <div className="card">
            <h3 style={{ marginBottom: 12 }}>Manage</h3>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link className="btn btn-secondary btn-small" to="/app/checklists">Checklist builder</Link>
              <Link className="btn btn-secondary btn-small" to="/app/team">Team &amp; stores</Link>
              <Link className="btn btn-secondary btn-small" to="/app/kpi">Full KPI dashboard</Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryTile({ label, value }) {
  return (
    <div className="kpi-tile">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}
