import React, { useState } from 'react';
import { useOpsReport } from './useOpsReport.js';
import { Section, FixedRowStatusTable, RepeatableTable, LabeledInput, LabeledSelect, LabeledTextarea } from './OpsFormParts.jsx';
import { CheckCircleIcon } from '../../components/icons.jsx';

const TITLE = 'Operations Manager Visit Report';
const KIND = 'ops_manager_visit';

// No client-supplied template exists for this report (unlike Kitchen/Bar
// and the Opening/Closing/QC reports, which mirror real source documents)
// — this is a reasonable, industry-standard site-visit structure geared
// toward a multi-store operations review, not a client-verified form.
const STANDARDS_ROWS = [
  { key: 'brandStandards', label: 'Brand standards adherence' },
  { key: 'sopCompliance', label: 'SOP / checklist compliance' },
  { key: 'healthSafety', label: 'Health & safety compliance' },
  { key: 'equipmentCondition', label: 'Equipment condition' },
  { key: 'facilityCondition', label: 'Facility condition' },
  { key: 'localManagement', label: 'Local management effectiveness' },
];

const RATING_OPTIONS = [
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Poor' },
];

const ACTION_COLUMNS = [
  { key: 'item', label: 'Action item' },
  { key: 'owner', label: 'Owner' },
  { key: 'dueDate', label: 'Due date', type: 'date', width: 130 },
  { key: 'status', label: 'Status' },
];

const emptyState = () => ({
  visit: { date: '', opsManagerName: '', timeIn: '', timeOut: '' },
  financials: { salesVsTargetPct: '', foodCostPct: '', laborCostPct: '', primeCostPct: '', varianceNotes: '' },
  standards: {},
  leadership: { storeManagerNotes: '', successionNotes: '' },
  actionItems: [{}],
  summary: { overallRating: 'good', notes: '' },
  signOff: { opsManagerName: '', storeManagerName: '' },
});

export default function OpsManagerVisitForm() {
  const report = useOpsReport({ kind: KIND, title: TITLE, onResume: (saved) => setForm({ ...emptyState(), ...saved }) });
  const [form, setForm] = useState(emptyState());

  const patchNested = (section, key, value) => setForm((f) => ({ ...f, [section]: { ...f[section], [key]: value } }));
  const setStandard = (key, field, value) => {
    setForm((f) => ({ ...f, standards: { ...f.standards, [key]: { ...f.standards[key], [field]: value } } }));
  };
  const editActionItems = {
    rows: form.actionItems,
    onChangeRow: (i, field, value) => setForm((f) => {
      const rows = [...f.actionItems];
      rows[i] = { ...rows[i], [field]: value };
      return { ...f, actionItems: rows };
    }),
    onAddRow: () => setForm((f) => ({ ...f, actionItems: [...f.actionItems, {}] })),
    onRemoveRow: (i) => setForm((f) => ({ ...f, actionItems: f.actionItems.filter((_, idx) => idx !== i) })),
  };

  const hasIncident = Object.values(form.standards).some((s) => s?.status === 'poor') || form.summary.overallRating === 'poor';

  if (report.status === 'idle') {
    return (
      <div>
        <h2>{TITLE}</h2>
        {report.error && <div className="error-banner">{report.error}</div>}
        <div className="card">
          <div className="field">
            <label htmlFor="branch">Store</label>
            <select id="branch" value={report.branchId} onChange={(e) => report.setBranchId(e.target.value)}>
              {report.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={report.start} disabled={!report.branchId}>{report.hasDraft ? 'Continue saved draft' : "Start visit report"}</button>
          {report.branches.length === 0 && <p className="hint">Add a store first, under Team &amp; stores.</p>}
        </div>
      </div>
    );
  }

  if (report.status === 'submitted') {
    return (
      <div className="card empty-state">
        <CheckCircleIcon size={32} style={{ color: 'var(--green)', opacity: 1 }} />
        <p style={{ margin: 0 }}>Operations Manager Visit Report submitted for {form.visit.date || 'today'}.</p>
      </div>
    );
  }

  return (
    <div>
      <h2>{TITLE}</h2>
      {report.error && <div className="error-banner">{report.error}</div>}

      <Section title="A. Visit information">
        <div className="form-grid-2col">
          <LabeledInput label="Date" type="date" value={form.visit.date} onChange={(v) => patchNested('visit', 'date', v)} />
          <LabeledInput label="Operations Manager name" value={form.visit.opsManagerName} onChange={(v) => patchNested('visit', 'opsManagerName', v)} />
          <LabeledInput label="Time in" type="time" value={form.visit.timeIn} onChange={(v) => patchNested('visit', 'timeIn', v)} />
          <LabeledInput label="Time out" type="time" value={form.visit.timeOut} onChange={(v) => patchNested('visit', 'timeOut', v)} />
        </div>
      </Section>

      <Section title="B. Financial & performance snapshot">
        <div className="form-grid-2col">
          <LabeledInput label="Sales vs. target (%)" type="number" value={form.financials.salesVsTargetPct} onChange={(v) => patchNested('financials', 'salesVsTargetPct', v)} />
          <LabeledInput label="Food cost (%)" type="number" value={form.financials.foodCostPct} onChange={(v) => patchNested('financials', 'foodCostPct', v)} />
          <LabeledInput label="Labor cost (%)" type="number" value={form.financials.laborCostPct} onChange={(v) => patchNested('financials', 'laborCostPct', v)} />
          <LabeledInput label="Prime cost (%)" type="number" value={form.financials.primeCostPct} onChange={(v) => patchNested('financials', 'primeCostPct', v)} />
        </div>
        <LabeledTextarea label="Variance explanation" value={form.financials.varianceNotes} onChange={(v) => patchNested('financials', 'varianceNotes', v)} />
      </Section>

      <Section title="C. Standards & compliance spot-check">
        <FixedRowStatusTable rows={STANDARDS_ROWS} values={form.standards} onChange={setStandard} statusOptions={RATING_OPTIONS} />
      </Section>

      <Section title="D. Leadership & succession notes">
        <LabeledTextarea label="Store Manager performance notes" value={form.leadership.storeManagerNotes} onChange={(v) => patchNested('leadership', 'storeManagerNotes', v)} />
        <LabeledTextarea label="Training / succession needs" value={form.leadership.successionNotes} onChange={(v) => patchNested('leadership', 'successionNotes', v)} />
      </Section>

      <Section title="E. Action items">
        <RepeatableTable columns={ACTION_COLUMNS} {...editActionItems} />
      </Section>

      <Section title="F. Overall assessment">
        <LabeledSelect label="Overall rating" value={form.summary.overallRating} onChange={(v) => patchNested('summary', 'overallRating', v)} options={RATING_OPTIONS.map((o) => [o.value, o.label])} />
        <LabeledTextarea label="Summary notes" value={form.summary.notes} onChange={(v) => patchNested('summary', 'notes', v)} />
      </Section>

      <Section title="G. Sign-off">
        <div className="form-grid-2col">
          <LabeledInput label="Operations Manager name" value={form.signOff.opsManagerName} onChange={(v) => patchNested('signOff', 'opsManagerName', v)} />
          <LabeledInput label="Store Manager acknowledgment" value={form.signOff.storeManagerName} onChange={(v) => patchNested('signOff', 'storeManagerName', v)} />
        </div>
      </Section>

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-secondary" onClick={() => report.save(form, hasIncident)} disabled={report.status === 'saving'}>{report.status === 'saving' ? 'Saving…' : report.justSaved ? 'Saved ✓' : 'Save progress'}</button>
        <button className="btn btn-primary" onClick={() => report.submit(form, hasIncident)} disabled={report.status === 'saving' || !form.signOff.opsManagerName.trim()}>
          Submit &amp; sign off
        </button>
      </div>
      {!form.signOff.opsManagerName.trim() && <p className="hint">Add the Operations Manager's name in Sign-off before submitting.</p>}
    </div>
  );
}
