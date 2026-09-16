import React, { useEffect, useState } from 'react';
import { api } from '../../api.js';

const emptyForm = (openingTasks, closingTasks) => ({
  temperature_log: [{ unit: '', reading: '', time: '' }],
  receiving_log: [{ supplier: '', item: '', temp: '', conditionOk: true }],
  waste_log: [{ item: '', quantity: '', reason: '', value: '' }],
  equipment_status: [{ equipment: '', status: 'ok' }],
  opening_checklist: openingTasks.map((task) => ({ task, done: false })),
  closing_checklist: closingTasks.map((task) => ({ task, done: false })),
  notes: '',
  signOffName: '',
});

// Shared shell for the Kitchen Daily Operation Report and the Bar &
// Beverage Daily Operation Report — same structure (temperature/receiving/
// waste logs, equipment status, opening/closing checklist, sign-off),
// different default task lists and template `kind`.
export default function DailyOpsForm({ kind, title, openingTasks, closingTasks }) {
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [submissionId, setSubmissionId] = useState(null);
  const [form, setForm] = useState(emptyForm(openingTasks, closingTasks));
  const [hasIncident, setHasIncident] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | started | saving | submitted
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/tenants/branches').then((d) => {
      setBranches(d.branches);
      if (d.branches.length) setBranchId(d.branches[0].id);
    });
  }, []);

  const ensureTemplate = async () => {
    const { templates } = await api.get('/checklists/templates');
    const existing = templates.find((t) => t.kind === kind);
    if (existing) return existing.id;
    const { template } = await api.post('/checklists/templates', {
      name: title, kind, frequency: 'daily', itemIds: [],
    });
    return template.id;
  };

  const start = async () => {
    setError('');
    try {
      const templateId = await ensureTemplate();
      const { submission } = await api.post('/submissions', { templateId, branchId });
      setSubmissionId(submission.id);
      setStatus('started');
    } catch (err) {
      setError(err.message);
    }
  };

  const updateRows = (section, index, patch) => {
    setForm((f) => {
      const rows = [...f[section]];
      rows[index] = { ...rows[index], ...patch };
      return { ...f, [section]: rows };
    });
  };

  const addRow = (section, blank) => setForm((f) => ({ ...f, [section]: [...f[section], blank] }));
  const removeRow = (section, index) => setForm((f) => ({ ...f, [section]: f[section].filter((_, i) => i !== index) }));

  const toggleTask = (section, index) => {
    setForm((f) => {
      const rows = [...f[section]];
      rows[index] = { ...rows[index], done: !rows[index].done };
      return { ...f, [section]: rows };
    });
  };

  const save = async () => {
    setStatus('saving');
    try {
      await api.patch(`/submissions/${submissionId}`, { formData: form, hasIncident });
      setStatus('started');
    } catch (err) {
      setError(err.message);
      setStatus('started');
    }
  };

  const submit = async () => {
    setError('');
    if (!form.signOffName.trim()) {
      setError('Add a sign-off name before submitting.');
      return;
    }
    setStatus('saving');
    try {
      await api.patch(`/submissions/${submissionId}`, { formData: form, hasIncident });
      await new Promise((resolve) => {
        if (!navigator.geolocation) return resolve({});
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => resolve({}),
          { timeout: 4000 }
        );
      }).then(({ lat, lng }) => api.post(`/submissions/${submissionId}/submit`, { gpsLat: lat, gpsLng: lng }));
      setStatus('submitted');
    } catch (err) {
      setError(err.message);
      setStatus('started');
    }
  };

  if (status === 'idle') {
    return (
      <div>
        <h2>{title}</h2>
        {error && <div className="error-banner">{error}</div>}
        <div className="card">
          <div className="field">
            <label htmlFor="branch">Store</label>
            <select id="branch" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={start} disabled={!branchId}>Start today's report</button>
          {branches.length === 0 && <p className="hint">Add a store first, under Team &amp; stores.</p>}
        </div>
      </div>
    );
  }

  if (status === 'submitted') {
    return (
      <div className="card empty-state">
        <p style={{ margin: 0 }}>Report submitted and signed off. Thanks, {form.signOffName}.</p>
      </div>
    );
  }

  return (
    <div>
      <h2>{title}</h2>
      {error && <div className="error-banner">{error}</div>}

      <Section title="Temperature log">
        {form.temperature_log.map((row, i) => (
          <Row key={i} onRemove={() => removeRow('temperature_log', i)}>
            <input placeholder="Unit (e.g. Walk-in fridge)" value={row.unit} onChange={(e) => updateRows('temperature_log', i, { unit: e.target.value })} />
            <input placeholder="Reading °C" type="number" value={row.reading} onChange={(e) => updateRows('temperature_log', i, { reading: e.target.value })} />
            <input placeholder="Time" type="time" value={row.time} onChange={(e) => updateRows('temperature_log', i, { time: e.target.value })} />
          </Row>
        ))}
        <AddRowBtn onClick={() => addRow('temperature_log', { unit: '', reading: '', time: '' })} />
      </Section>

      <Section title="Receiving log">
        {form.receiving_log.map((row, i) => (
          <Row key={i} onRemove={() => removeRow('receiving_log', i)}>
            <input placeholder="Supplier" value={row.supplier} onChange={(e) => updateRows('receiving_log', i, { supplier: e.target.value })} />
            <input placeholder="Item" value={row.item} onChange={(e) => updateRows('receiving_log', i, { item: e.target.value })} />
            <input placeholder="Temp °C" type="number" value={row.temp} onChange={(e) => updateRows('receiving_log', i, { temp: e.target.value })} />
            <label style={{ fontWeight: 400, display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={row.conditionOk} onChange={(e) => updateRows('receiving_log', i, { conditionOk: e.target.checked })} /> OK
            </label>
          </Row>
        ))}
        <AddRowBtn onClick={() => addRow('receiving_log', { supplier: '', item: '', temp: '', conditionOk: true })} />
      </Section>

      <Section title="Waste log">
        {form.waste_log.map((row, i) => (
          <Row key={i} onRemove={() => removeRow('waste_log', i)}>
            <input placeholder="Item" value={row.item} onChange={(e) => updateRows('waste_log', i, { item: e.target.value })} />
            <input placeholder="Quantity" value={row.quantity} onChange={(e) => updateRows('waste_log', i, { quantity: e.target.value })} />
            <input placeholder="Reason" value={row.reason} onChange={(e) => updateRows('waste_log', i, { reason: e.target.value })} />
            <input placeholder="Value $" type="number" value={row.value} onChange={(e) => updateRows('waste_log', i, { value: e.target.value })} />
          </Row>
        ))}
        <AddRowBtn onClick={() => addRow('waste_log', { item: '', quantity: '', reason: '', value: '' })} />
      </Section>

      <Section title="Equipment status">
        {form.equipment_status.map((row, i) => (
          <Row key={i} onRemove={() => removeRow('equipment_status', i)}>
            <input placeholder="Equipment" value={row.equipment} onChange={(e) => updateRows('equipment_status', i, { equipment: e.target.value })} />
            <select value={row.status} onChange={(e) => updateRows('equipment_status', i, { status: e.target.value })}>
              <option value="ok">OK</option>
              <option value="needs_attention">Needs attention</option>
            </select>
          </Row>
        ))}
        <AddRowBtn onClick={() => addRow('equipment_status', { equipment: '', status: 'ok' })} />
      </Section>

      <Section title="Opening checklist">
        {form.opening_checklist.map((row, i) => (
          <label key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 400, marginBottom: 8 }}>
            <input type="checkbox" checked={row.done} onChange={() => toggleTask('opening_checklist', i)} />
            {row.task}
          </label>
        ))}
      </Section>

      <Section title="Closing checklist">
        {form.closing_checklist.map((row, i) => (
          <label key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 400, marginBottom: 8 }}>
            <input type="checkbox" checked={row.done} onChange={() => toggleTask('closing_checklist', i)} />
            {row.task}
          </label>
        ))}
      </Section>

      <Section title="Notes & incidents">
        <div className="field">
          <textarea rows={3} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Anything worth flagging for the next shift?" />
        </div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 400 }}>
          <input type="checkbox" checked={hasIncident} onChange={(e) => setHasIncident(e.target.checked)} />
          Flag this shift as having a compliance incident
        </label>
      </Section>

      <Section title="Sign-off">
        <div className="field">
          <label htmlFor="signOff">Signed off by</label>
          <input id="signOff" value={form.signOffName} onChange={(e) => setForm((f) => ({ ...f, signOffName: e.target.value }))} />
        </div>
      </Section>

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-secondary" onClick={save} disabled={status === 'saving'}>Save progress</button>
        <button className="btn btn-primary" onClick={submit} disabled={status === 'saving'}>Submit &amp; sign off</button>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="card">
      <h3 style={{ marginBottom: 12, fontSize: 16 }}>{title}</h3>
      {children}
    </div>
  );
}

function Row({ children, onRemove }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${React.Children.count(children)}, 1fr) auto`, gap: 8, marginBottom: 8, alignItems: 'center' }}>
      {children}
      <button type="button" className="btn btn-small btn-danger" onClick={onRemove}>×</button>
    </div>
  );
}

function AddRowBtn({ onClick }) {
  return <button type="button" className="btn btn-secondary btn-small" onClick={onClick}>+ Add row</button>;
}
