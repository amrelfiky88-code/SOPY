import React, { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { CheckCircleIcon, ThermometerIcon, TrashIcon, AlertTriangleIcon, XCircleIcon } from '../../components/icons.jsx';

const PERIODS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
];

export default function KpiDashboard() {
  const [period, setPeriod] = useState('daily');
  const [branchId, setBranchId] = useState('');
  const [branches, setBranches] = useState([]);
  const [kpi, setKpi] = useState(null);

  useEffect(() => { api.get('/tenants/branches').then((d) => setBranches(d.branches)); }, []);

  useEffect(() => {
    const params = new URLSearchParams({ period });
    if (branchId) params.set('branchId', branchId);
    api.get(`/dashboard/kpi?${params.toString()}`).then(setKpi);
  }, [period, branchId]);

  return (
    <div>
      <h2>KPI dashboard</h2>

      <div className="filter-row">
        {PERIODS.map((p) => (
          <button key={p.value} className={period === p.value ? 'active' : ''} onClick={() => setPeriod(p.value)}>{p.label}</button>
        ))}
      </div>

      <div className="field" style={{ maxWidth: 260 }}>
        <label htmlFor="branchFilter">Store</label>
        <select id="branchFilter" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
          <option value="">All stores</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      {kpi && (
        <div className="kpi-grid">
          <Tile icon={CheckCircleIcon} tone="green" label="Compliance %" value={kpi.compliancePct !== null ? `${kpi.compliancePct}%` : 'No data yet'} />
          <Tile icon={ThermometerIcon} tone="amber" label="Temperature deviations" value={kpi.temperatureDeviations} />
          <Tile icon={TrashIcon} tone="amber" label="Waste value" value={`$${kpi.wasteValue.toFixed(2)}`} />
          <Tile icon={AlertTriangleIcon} tone="red" label="Incident count" value={kpi.incidentCount} />
          <Tile icon={XCircleIcon} tone="red" label="Critical fails" value={kpi.criticalFailCount} />
        </div>
      )}
      {kpi && <p className="hint">Based on {kpi.submissionsCount} checklist run{kpi.submissionsCount === 1 ? '' : 's'} in this period.</p>}
    </div>
  );
}

function Tile({ icon: Icon, tone, label, value }) {
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
