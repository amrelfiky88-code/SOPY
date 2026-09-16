import React, { useEffect, useState } from 'react';
import { api } from '../../api.js';

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
        <Tile label="Compliance" value={kpi.compliancePct !== null ? `${kpi.compliancePct}%` : '—'} />
        <Tile label="Temp. deviations" value={kpi.temperatureDeviations} />
        <Tile label="Waste value" value={`$${kpi.wasteValue.toFixed(2)}`} />
        <Tile label="Incidents" value={kpi.incidentCount} />
      </div>
    </div>
  );
}

function Tile({ label, value }) {
  return (
    <div className="kpi-tile">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}
