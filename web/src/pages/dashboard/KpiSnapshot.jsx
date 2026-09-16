import React, { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { CheckCircleIcon, ThermometerIcon, TrashIcon, AlertTriangleIcon } from '../../components/icons.jsx';

export default function KpiSnapshot() {
  const [kpi, setKpi] = useState(null);

  useEffect(() => {
    api.get('/dashboard/kpi?period=daily').then(setKpi);
  }, []);

  if (!kpi) return null;

  return (
    <div className="card">
      <h3 style={{ marginBottom: 12 }}>Today at a glance</h3>
      <div className="kpi-grid">
        <Tile icon={CheckCircleIcon} tone="green" label="Compliance" value={kpi.compliancePct !== null ? `${kpi.compliancePct}%` : '—'} />
        <Tile icon={ThermometerIcon} tone="amber" label="Temp. deviations" value={kpi.temperatureDeviations} />
        <Tile icon={TrashIcon} tone="amber" label="Waste value" value={`$${kpi.wasteValue.toFixed(2)}`} />
        <Tile icon={AlertTriangleIcon} tone="red" label="Incidents" value={kpi.incidentCount} />
      </div>
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
