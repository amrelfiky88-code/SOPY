import React, { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { ROLES } from '../onboarding/roles.js';

const STANDARDS = [
  { value: '', label: 'All standards' },
  { value: 'HACCP', label: 'HACCP' },
  { value: 'ISO_22000', label: 'ISO 22000' },
  { value: 'LOCAL_CODE', label: 'Local code' },
  { value: 'INTERNAL_QC', label: 'Internal QC' },
  { value: 'SOP', label: 'SOP procedures' },
  { value: 'CUSTOM', label: 'Custom' },
];

export default function ChecklistBuilder() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [standard, setStandard] = useState('');
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [selected, setSelected] = useState([]);
  const [expanded, setExpanded] = useState(new Set());
  const [templates, setTemplates] = useState([]);
  const [templateName, setTemplateName] = useState('');
  const [frequency, setFrequency] = useState('daily');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [assignTemplateId, setAssignTemplateId] = useState('');
  const [assignBranchId, setAssignBranchId] = useState('');
  const [assignRole, setAssignRole] = useState('');
  const [branches, setBranches] = useState([]);
  const [assignments, setAssignments] = useState([]);

  const loadItems = async () => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (standard) params.set('standard', standard);
    if (criticalOnly) params.set('critical', 'true');
    const { items } = await api.get(`/checklists/library?${params.toString()}`);
    setItems(items);
  };

  const loadTemplates = async () => {
    const { templates } = await api.get('/checklists/templates');
    setTemplates(templates);
  };

  const loadAssignments = async () => {
    const { assignments } = await api.get('/checklists/assignments');
    setAssignments(assignments);
  };

  useEffect(() => { loadItems(); }, [q, standard, criticalOnly]);
  useEffect(() => {
    loadTemplates();
    loadAssignments();
    api.get('/tenants/branches').then((d) => setBranches(d.branches)).catch(() => {});
  }, []);

  const toggleItem = (id) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  const toggleExpanded = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllShown = () => {
    setSelected((s) => Array.from(new Set([...s, ...items.map((i) => i.id)])));
  };

  const clearSelection = () => setSelected([]);

  const createTemplate = async (e) => {
    e.preventDefault();
    setError('');
    if (!templateName || selected.length === 0) {
      setError('Give the checklist a name and pick at least one checkpoint.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/checklists/templates', { name: templateName, frequency, itemIds: selected });
      setTemplateName('');
      setSelected([]);
      await loadTemplates();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const assign = async (e) => {
    e.preventDefault();
    if (!assignTemplateId) return;
    await api.post('/checklists/assignments', {
      templateId: assignTemplateId,
      branchId: assignBranchId || null,
      role: assignRole || null,
    });
    setAssignBranchId('');
    setAssignRole('');
    await loadAssignments();
  };

  return (
    <div>
      <h2>Checklist builder</h2>
      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        <h3 style={{ marginBottom: 12 }}>1. Pick checkpoints from the master library</h3>
        <div className="field">
          <input placeholder="Search checkpoints…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="filter-row">
          {STANDARDS.map((s) => (
            <button key={s.value} className={standard === s.value ? 'active' : ''} onClick={() => setStandard(s.value)}>
              {s.label}
            </button>
          ))}
          <button className={criticalOnly ? 'active' : ''} onClick={() => setCriticalOnly((c) => !c)}>
            Critical only
          </button>
        </div>

        {items.length > 0 && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <button type="button" className="btn btn-secondary btn-small" onClick={selectAllShown}>
              Select all shown ({items.length})
            </button>
            {selected.length > 0 && (
              <button type="button" className="btn btn-secondary btn-small" onClick={clearSelection}>
                Clear selection ({selected.length})
              </button>
            )}
          </div>
        )}

        <div style={{ maxHeight: 380, overflowY: 'auto' }}>
          {items.map((item, idx) => {
            const showHeader = item.category && item.category !== items[idx - 1]?.category;
            return (
              <React.Fragment key={item.id}>
                {showHeader && (
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink-soft)', marginTop: 12, marginBottom: 4 }}>
                    {item.category}
                  </div>
                )}
                <label className="checklist-row" style={{ cursor: 'pointer' }}>
                  <div>
                    <div>{item.text}</div>
                    <div className="hint">
                      <span className="pill">{item.standard}</span>{' '}
                      {item.requires_photo && <span className="pill pill-amber">photo required</span>}{' '}
                      {item.is_critical && <span className="pill pill-red">critical</span>}
                      {item.description && (
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleExpanded(item.id); }}
                          style={{ background: 'none', border: 'none', padding: 0, marginLeft: 8, color: 'var(--green)', cursor: 'pointer', font: 'inherit', textDecoration: 'underline' }}
                        >
                          {expanded.has(item.id) ? 'Hide detail' : 'Show detail'}
                        </button>
                      )}
                    </div>
                    {item.description && expanded.has(item.id) && (
                      <p style={{ marginTop: 6, marginBottom: 0 }}>{item.description}</p>
                    )}
                  </div>
                  <input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggleItem(item.id)} />
                </label>
              </React.Fragment>
            );
          })}
          {items.length === 0 && <div className="empty-state">No checkpoints match your filters.</div>}
        </div>
      </div>

      <form onSubmit={createTemplate} className="card">
        <h3 style={{ marginBottom: 12 }}>2. Save as a checklist ({selected.length} selected)</h3>
        <div className="field">
          <label htmlFor="tname">Checklist name</label>
          <input id="tname" value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="e.g. Opening Checklist" />
        </div>
        <div className="field">
          <label htmlFor="freq">Frequency</label>
          <select id="freq" value={frequency} onChange={(e) => setFrequency(e.target.value)}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
          </select>
        </div>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save checklist'}</button>
      </form>

      <div className="card">
        <h3 style={{ marginBottom: 12 }}>3. Assign checklists</h3>
        <form onSubmit={assign}>
          <div className="field">
            <label htmlFor="atpl">Checklist</label>
            <select id="atpl" value={assignTemplateId} onChange={(e) => setAssignTemplateId(e.target.value)} required>
              <option value="" disabled>Select a checklist</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="abranch">Store</label>
            <select id="abranch" value={assignBranchId} onChange={(e) => setAssignBranchId(e.target.value)}>
              <option value="">All stores</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="arole">Role</label>
            <select id="arole" value={assignRole} onChange={(e) => setAssignRole(e.target.value)}>
              <option value="">Any role</option>
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <button className="btn btn-secondary" type="submit">Assign</button>
        </form>

        <table style={{ marginTop: 16 }}>
          <thead><tr><th>Checklist</th><th>Store</th><th>Role</th></tr></thead>
          <tbody>
            {assignments.map((a) => (
              <tr key={a.id}>
                <td>{a.template_name}</td>
                <td>{a.branch_name || 'All stores'}</td>
                <td>{a.role ? ROLES.find((r) => r.value === a.role)?.label : 'Any role'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
