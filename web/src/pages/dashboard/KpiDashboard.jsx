import React, { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { CheckCircleIcon, ThermometerIcon, TrashIcon, AlertTriangleIcon, XCircleIcon } from '../../components/icons.jsx';
import { useT } from '../../i18n/index.jsx';

const PERIODS = ['daily', 'weekly', 'monthly', 'quarterly'];

export default function KpiDashboard() {
  const t = useT();
  const [period, setPeriod] = useState('daily');
  const [branchId, setBranchId] = useState('');
  const [branches, setBranches] = useState([]);
  const [kpi, setKpi] = useState(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    api.get('/tenants/branches').then((d) => setBranches(d.branches)).catch(() => {});
  }, []);

  useEffect(() => {
    // Ignore a slow reply for a filter the user has already changed.
    let current = true;
    const params = new URLSearchParams({ period });
    if (branchId) params.set('branchId', branchId);
    setError('');
    api.get(`/dashboard/kpi?${params.toString()}`)
      .then((d) => { if (current) setKpi(d); })
      .catch((err) => { if (current) setError(err.message); });
    return () => { current = false; };
  }, [period, branchId, reload]);

  return (
    <div>
      <h2>{t('kpi.title')}</h2>

      <div className="filter-row">
        {PERIODS.map((p) => (
          <button key={p} className={period === p ? 'active' : ''} onClick={() => setPeriod(p)}>{t(`kpi.${p}`)}</button>
        ))}
      </div>

      <div className="field" style={{ maxWidth: 260 }}>
        <label htmlFor="branchFilter">{t('common.store')}</label>
        <select id="branchFilter" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
          <option value="">{t('common.allStores')}</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      {error && (
        <div className="error-banner">
          {error}{' '}
          <button type="button" className="link-btn" onClick={() => setReload((n) => n + 1)}>{t('common.tryAgain')}</button>
        </div>
      )}
      {kpi && (
        <div className="kpi-grid">
          <Tile icon={CheckCircleIcon} tone="green" label={t('kpi.compliance')} value={kpi.compliancePct !== null ? `${kpi.compliancePct}%` : t('kpi.noData')} />
          <Tile icon={ThermometerIcon} tone="amber" label={t('kpi.tempDeviations')} value={kpi.temperatureDeviations} />
          <Tile icon={TrashIcon} tone="amber" label={t('kpi.wasteValue')} value={`$${kpi.wasteValue.toFixed(2)}`} />
          <Tile icon={AlertTriangleIcon} tone="red" label={t('kpi.incidents')} value={kpi.incidentCount} />
          <Tile icon={XCircleIcon} tone="red" label={t('kpi.criticalFails')} value={kpi.criticalFailCount} />
        </div>
      )}
      {kpi && <p className="hint">{t('kpi.basedOn', { n: kpi.submissionsCount })}</p>}
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
