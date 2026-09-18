import React, { useState } from 'react';
import { useOpsReport } from './useOpsReport.js';
import ReportLink from '../../components/ReportLink.jsx';
import { Section, FixedRowStatusTable, RepeatableTable, LabeledInput, LabeledSelect, LabeledTextarea } from './OpsFormParts.jsx';
import { CheckCircleIcon } from '../../components/icons.jsx';

const TITLE = 'QC Visit Report';
const KIND = 'qc_visit';

// Section-level scorecard across the same 12 categories the client's own
// Daily QC Checklist is organized into (server/db/seed_qc_system.sql) —
// a visit report scores each category as a whole rather than repeating
// every individual checkpoint, which already lives in the fine-grained
// checklist library.
const QC_CATEGORIES = [
  { key: 'exterior', label: 'A. Exterior & First Impressions' },
  { key: 'foodSafety', label: 'B. Food Safety & Temperature Control' },
  { key: 'kitchenHygiene', label: 'C. Kitchen Hygiene & Organization' },
  { key: 'barStation', label: 'D. Bar & Beverage Station' },
  { key: 'diningArea', label: 'E. Dining Area & Guest Experience' },
  { key: 'staffReadiness', label: 'F. Staff Readiness & Service Quality' },
  { key: 'safetyCompliance', label: 'G. Safety, Security & Compliance' },
  { key: 'foodQuality', label: 'K. Food Quality, Taste & Consistency' },
  { key: 'presentation', label: 'L. Presentation, Plating & The Pass' },
  { key: 'serviceChoreography', label: 'M. Service Choreography & Hospitality' },
  { key: 'ingredientQuality', label: 'N. Ingredient Quality & Sourcing' },
];

const SCORE_OPTIONS = [
  { value: 'excellent', label: 'Excellent' },
  { value: 'satisfactory', label: 'Satisfactory' },
  { value: 'needs_improvement', label: 'Needs improvement' },
  { value: 'critical_fail', label: 'Critical fail' },
];

const FINDING_COLUMNS = [
  { key: 'category', label: 'Category' },
  { key: 'finding', label: 'Finding' },
  { key: 'severity', label: 'Severity' },
  { key: 'correctiveAction', label: 'Corrective action' },
  { key: 'owner', label: 'Owner' },
  { key: 'dueDate', label: 'Due date', type: 'date', width: 130 },
];

const emptyState = () => ({
  visit: { date: '', inspectorName: '', visitType: 'scheduled', timeIn: '', timeOut: '' },
  scores: {},
  findings: [{}],
  summary: { overallRating: 'satisfactory', notes: '' },
  signOff: { inspectorName: '', storeManagerName: '' },
});

export default function QcVisitForm() {
  const report = useOpsReport({ kind: KIND, title: TITLE, onResume: (saved) => setForm({ ...emptyState(), ...saved }) });
  const [form, setForm] = useState(emptyState());

  const patchNested = (section, key, value) => setForm((f) => ({ ...f, [section]: { ...f[section], [key]: value } }));
  const setScore = (key, field, value) => {
    setForm((f) => ({ ...f, scores: { ...f.scores, [key]: { ...f.scores[key], [field]: value } } }));
  };
  const editFindings = {
    rows: form.findings,
    onChangeRow: (i, field, value) => setForm((f) => {
      const rows = [...f.findings];
      rows[i] = { ...rows[i], [field]: value };
      return { ...f, findings: rows };
    }),
    onAddRow: () => setForm((f) => ({ ...f, findings: [...f.findings, {}] })),
    onRemoveRow: (i) => setForm((f) => ({ ...f, findings: f.findings.filter((_, idx) => idx !== i) })),
  };

  const hasIncident = Object.values(form.scores).some((s) => s?.status === 'critical_fail') || form.summary.overallRating === 'critical_fail';

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
        <p style={{ margin: 0 }}>QC Visit Report submitted for {form.visit.date || 'today'}.</p>
        <ReportLink submissionId={report.submissionId} />
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
          <LabeledInput label="QC Inspector name" value={form.visit.inspectorName} onChange={(v) => patchNested('visit', 'inspectorName', v)} />
          <LabeledSelect label="Visit type" value={form.visit.visitType} onChange={(v) => patchNested('visit', 'visitType', v)}
            options={[['scheduled', 'Scheduled'], ['surprise', 'Surprise'], ['follow_up', 'Follow-up']]} />
          <LabeledInput label="Time in" type="time" value={form.visit.timeIn} onChange={(v) => patchNested('visit', 'timeIn', v)} />
          <LabeledInput label="Time out" type="time" value={form.visit.timeOut} onChange={(v) => patchNested('visit', 'timeOut', v)} />
        </div>
      </Section>

      <Section title="B. Category scorecard">
        <FixedRowStatusTable rows={QC_CATEGORIES} values={form.scores} onChange={setScore} statusOptions={SCORE_OPTIONS} />
      </Section>

      <Section title="C. Findings & corrective actions">
        <RepeatableTable columns={FINDING_COLUMNS} {...editFindings} />
      </Section>

      <Section title="D. Overall visit summary">
        <LabeledSelect label="Overall rating" value={form.summary.overallRating} onChange={(v) => patchNested('summary', 'overallRating', v)} options={SCORE_OPTIONS.map((o) => [o.value, o.label])} />
        <LabeledTextarea label="Summary notes" value={form.summary.notes} onChange={(v) => patchNested('summary', 'notes', v)} />
      </Section>

      <Section title="E. Sign-off">
        <div className="form-grid-2col">
          <LabeledInput label="QC Inspector name" value={form.signOff.inspectorName} onChange={(v) => patchNested('signOff', 'inspectorName', v)} />
          <LabeledInput label="Store Manager acknowledgment" value={form.signOff.storeManagerName} onChange={(v) => patchNested('signOff', 'storeManagerName', v)} />
        </div>
      </Section>

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-secondary" onClick={() => report.save(form, hasIncident)} disabled={report.status === 'saving'}>{report.status === 'saving' ? 'Saving…' : report.justSaved ? 'Saved ✓' : 'Save progress'}</button>
        <button className="btn btn-primary" onClick={() => report.submit(form, hasIncident)} disabled={report.status === 'saving' || !form.signOff.inspectorName.trim()}>
          Submit &amp; sign off
        </button>
      </div>
      {!form.signOff.inspectorName.trim() && <p className="hint">Add the QC Inspector's name in Sign-off before submitting.</p>}
    </div>
  );
}
