import React, { useState } from 'react';
import { useOpsReport } from './useOpsReport.js';
import { Section, FixedRowStatusTable, LabeledInput, LabeledTextarea } from './OpsFormParts.jsx';
import { CheckCircleIcon } from '../../components/icons.jsx';

const TITLE = 'Daily Opening Report';
const KIND = 'opening_daily';

// Mirrors SOP 1: Restaurant Opening Procedures (server/db/seed_opening_closing.sql)
// phase-for-phase, so this report tracks the same 8 phases a manager can
// also assign as individual checkpoints via the Checklist Builder.
const OPENING_PHASES = [
  { key: 'arrival', label: '1. Arrival & Security Check' },
  { key: 'equipment', label: '2. Kitchen Equipment Startup' },
  { key: 'foodSafety', label: '3. Food Safety Checks' },
  { key: 'stationPrep', label: '4. Station Prep & Mise en Place' },
  { key: 'diningRoom', label: '5. Dining Room Setup' },
  { key: 'preService', label: '6. Pre-Service Meeting' },
  { key: 'finalChecklist', label: '7. Final Checklist' },
  { key: 'openForService', label: '8. Open for Service' },
];

const STATUS_OPTIONS = [
  { value: 'done', label: 'Done' },
  { value: 'issue', label: 'Issue found' },
  { value: 'skipped', label: 'Skipped' },
];

const emptyState = () => ({
  shift: { date: '', openingManager: '', staffOnDuty: '', startTime: '' },
  phases: {},
  notes: { issuesFound: '', correctiveAction: '', managerNotified: '' },
  signOff: { openerName: '' },
});

export default function OpeningDailyForm() {
  const report = useOpsReport({ kind: KIND, title: TITLE, onResume: (saved) => setForm({ ...emptyState(), ...saved }) });
  const [form, setForm] = useState(emptyState());

  const patchNested = (section, key, value) => setForm((f) => ({ ...f, [section]: { ...f[section], [key]: value } }));
  const setPhaseStatus = (key, field, value) => {
    setForm((f) => ({ ...f, phases: { ...f.phases, [key]: { ...f.phases[key], [field]: value } } }));
  };

  const hasIncident = Object.values(form.phases).some((p) => p?.status === 'issue') || !!form.notes.issuesFound.trim();

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
          <button className="btn btn-primary" onClick={report.start} disabled={!report.branchId}>{report.hasDraft ? 'Continue saved draft' : "Start today's report"}</button>
          {report.branches.length === 0 && <p className="hint">Add a store first, under Team &amp; stores.</p>}
        </div>
      </div>
    );
  }

  if (report.status === 'submitted') {
    return (
      <div className="card empty-state">
        <CheckCircleIcon size={32} style={{ color: 'var(--green)', opacity: 1 }} />
        <p style={{ margin: 0 }}>Daily Opening Report submitted for {form.shift.date || 'today'}.</p>
      </div>
    );
  }

  return (
    <div>
      <h2>{TITLE}</h2>
      {report.error && <div className="error-banner">{report.error}</div>}

      <Section title="A. Shift identification">
        <div className="form-grid-2col">
          <LabeledInput label="Date" type="date" value={form.shift.date} onChange={(v) => patchNested('shift', 'date', v)} />
          <LabeledInput label="Opening Manager / Supervisor" value={form.shift.openingManager} onChange={(v) => patchNested('shift', 'openingManager', v)} />
          <LabeledInput label="Staff on duty" type="number" value={form.shift.staffOnDuty} onChange={(v) => patchNested('shift', 'staffOnDuty', v)} />
          <LabeledInput label="Start time" type="time" value={form.shift.startTime} onChange={(v) => patchNested('shift', 'startTime', v)} />
        </div>
      </Section>

      <Section title="B. Opening checklist (SOP 1)">
        <FixedRowStatusTable rows={OPENING_PHASES} values={form.phases} onChange={setPhaseStatus} statusOptions={STATUS_OPTIONS} />
      </Section>

      <Section title="C. Notes & escalations">
        <LabeledTextarea label="Issues found" value={form.notes.issuesFound} onChange={(v) => patchNested('notes', 'issuesFound', v)} />
        <LabeledTextarea label="Corrective action taken" value={form.notes.correctiveAction} onChange={(v) => patchNested('notes', 'correctiveAction', v)} />
        <LabeledInput label="Manager notified (name & time)" value={form.notes.managerNotified} onChange={(v) => patchNested('notes', 'managerNotified', v)} />
      </Section>

      <Section title="D. Sign-off">
        <LabeledInput label="Opener name" value={form.signOff.openerName} onChange={(v) => patchNested('signOff', 'openerName', v)} />
      </Section>

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-secondary" onClick={() => report.save(form, hasIncident)} disabled={report.status === 'saving'}>{report.status === 'saving' ? 'Saving…' : report.justSaved ? 'Saved ✓' : 'Save progress'}</button>
        <button className="btn btn-primary" onClick={() => report.submit(form, hasIncident)} disabled={report.status === 'saving' || !form.signOff.openerName.trim()}>
          Submit &amp; sign off
        </button>
      </div>
      {!form.signOff.openerName.trim() && <p className="hint">Add the opener's name in Sign-off before submitting.</p>}
    </div>
  );
}
