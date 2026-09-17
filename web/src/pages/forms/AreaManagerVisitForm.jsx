import React, { useState } from 'react';
import { useOpsReport } from './useOpsReport.js';
import { Section, FixedRowStatusTable, RepeatableTable, LabeledInput, LabeledSelect, LabeledTextarea } from './OpsFormParts.jsx';
import { CheckCircleIcon } from '../../components/icons.jsx';

const TITLE = 'Area Manager Visit Report';
const KIND = 'area_manager_visit';

// No client-supplied template exists for this report (unlike Kitchen/Bar
// and the Opening/Closing/QC reports, which mirror real source documents)
// — this is a reasonable, industry-standard site-visit structure, not a
// client-verified form. Treat it as a reviewable starting point.
const SPOT_CHECK_ROWS = [
  { key: 'foodSafety', label: 'Food safety & compliance' },
  { key: 'cleanliness', label: 'Cleanliness & maintenance' },
  { key: 'staffConduct', label: 'Staff conduct & grooming' },
  { key: 'customerService', label: 'Customer service quality' },
  { key: 'cashHandling', label: 'Cash handling & POS integrity' },
  { key: 'inventory', label: 'Inventory & stock levels' },
  { key: 'brandCompliance', label: 'Marketing & brand compliance' },
  { key: 'healthSafety', label: 'Health & safety' },
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
  visit: { date: '', areaManagerName: '', visitType: 'routine', timeIn: '', timeOut: '' },
  spotCheck: {},
  team: { staffingAdequate: '', trainingGaps: '', moraleNotes: '' },
  actionItems: [{}],
  summary: { overallRating: 'good', notes: '' },
  signOff: { areaManagerName: '', storeManagerName: '' },
});

export default function AreaManagerVisitForm() {
  const report = useOpsReport({ kind: KIND, title: TITLE });
  const [form, setForm] = useState(emptyState());

  const patchNested = (section, key, value) => setForm((f) => ({ ...f, [section]: { ...f[section], [key]: value } }));
  const setSpotCheck = (key, field, value) => {
    setForm((f) => ({ ...f, spotCheck: { ...f.spotCheck, [key]: { ...f.spotCheck[key], [field]: value } } }));
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

  const hasIncident = Object.values(form.spotCheck).some((s) => s?.status === 'poor') || form.summary.overallRating === 'poor';

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
          <button className="btn btn-primary" onClick={report.start} disabled={!report.branchId}>Start visit report</button>
          {report.branches.length === 0 && <p className="hint">Add a store first, under Team &amp; stores.</p>}
        </div>
      </div>
    );
  }

  if (report.status === 'submitted') {
    return (
      <div className="card empty-state">
        <CheckCircleIcon size={32} style={{ color: 'var(--green)', opacity: 1 }} />
        <p style={{ margin: 0 }}>Area Manager Visit Report submitted for {form.visit.date || 'today'}.</p>
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
          <LabeledInput label="Area Manager name" value={form.visit.areaManagerName} onChange={(v) => patchNested('visit', 'areaManagerName', v)} />
          <LabeledSelect label="Visit type" value={form.visit.visitType} onChange={(v) => patchNested('visit', 'visitType', v)}
            options={[['routine', 'Routine'], ['follow_up', 'Follow-up'], ['incident_response', 'Incident response']]} />
          <LabeledInput label="Time in" type="time" value={form.visit.timeIn} onChange={(v) => patchNested('visit', 'timeIn', v)} />
          <LabeledInput label="Time out" type="time" value={form.visit.timeOut} onChange={(v) => patchNested('visit', 'timeOut', v)} />
        </div>
      </Section>

      <Section title="B. Operational spot-check">
        <FixedRowStatusTable rows={SPOT_CHECK_ROWS} values={form.spotCheck} onChange={setSpotCheck} statusOptions={RATING_OPTIONS} />
      </Section>

      <Section title="C. Staffing & team observations">
        <LabeledTextarea label="Are staffing levels adequate for demand?" value={form.team.staffingAdequate} onChange={(v) => patchNested('team', 'staffingAdequate', v)} />
        <LabeledTextarea label="Training gaps observed" value={form.team.trainingGaps} onChange={(v) => patchNested('team', 'trainingGaps', v)} />
        <LabeledTextarea label="Team morale notes" value={form.team.moraleNotes} onChange={(v) => patchNested('team', 'moraleNotes', v)} />
      </Section>

      <Section title="D. Action items">
        <RepeatableTable columns={ACTION_COLUMNS} {...editActionItems} />
      </Section>

      <Section title="E. Overall store rating & summary">
        <LabeledSelect label="Overall rating" value={form.summary.overallRating} onChange={(v) => patchNested('summary', 'overallRating', v)} options={RATING_OPTIONS.map((o) => [o.value, o.label])} />
        <LabeledTextarea label="Summary notes" value={form.summary.notes} onChange={(v) => patchNested('summary', 'notes', v)} />
      </Section>

      <Section title="F. Sign-off">
        <div className="form-grid-2col">
          <LabeledInput label="Area Manager name" value={form.signOff.areaManagerName} onChange={(v) => patchNested('signOff', 'areaManagerName', v)} />
          <LabeledInput label="Store Manager acknowledgment" value={form.signOff.storeManagerName} onChange={(v) => patchNested('signOff', 'storeManagerName', v)} />
        </div>
      </Section>

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-secondary" onClick={() => report.save(form, hasIncident)} disabled={report.status === 'saving'}>Save progress</button>
        <button className="btn btn-primary" onClick={() => report.submit(form, hasIncident)} disabled={report.status === 'saving' || !form.signOff.areaManagerName.trim()}>
          Submit &amp; sign off
        </button>
      </div>
      {!form.signOff.areaManagerName.trim() && <p className="hint">Add the Area Manager's name in Sign-off before submitting.</p>}
    </div>
  );
}
