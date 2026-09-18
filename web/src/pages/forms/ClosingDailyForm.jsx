import React, { useState } from 'react';
import { useOpsReport } from './useOpsReport.js';
import ReportLink from '../../components/ReportLink.jsx';
import { Section, FixedRowStatusTable, LabeledInput, LabeledTextarea } from './OpsFormParts.jsx';
import { CheckCircleIcon } from '../../components/icons.jsx';

const TITLE = 'Daily Closing Report';
const KIND = 'closing_daily';

// Mirrors SOP 2: Restaurant Closing Procedures (server/db/seed_opening_closing.sql)
// phase-for-phase, so this report tracks the same 7 phases a manager can
// also assign as individual checkpoints via the Checklist Builder.
const CLOSING_PHASES = [
  { key: 'kitchenBreakdown', label: '1. Kitchen Breakdown & Cleaning' },
  { key: 'diningRoomClosing', label: '2. Dining Room Closing' },
  { key: 'equipmentShutdown', label: '3. Equipment Shutdown' },
  { key: 'cashHandling', label: '4. Cash Handling & POS Closing' },
  { key: 'foodStorage', label: '5. Food Storage Final Check' },
  { key: 'nextDayPrep', label: '6. Prep for Next Day' },
  { key: 'securityWalkthrough', label: '7. Security & Final Walkthrough' },
];

const STATUS_OPTIONS = [
  { value: 'done', label: 'Done' },
  { value: 'issue', label: 'Issue found' },
  { value: 'skipped', label: 'Skipped' },
];

const emptyState = () => ({
  shift: { date: '', closingManager: '', staffOnDuty: '', endTime: '' },
  phases: {},
  cashReconciliation: { drawerVariance: '', depositAmount: '' },
  notes: { issuesFound: '', correctiveAction: '', managerNotified: '' },
  signOff: { closerName: '' },
});

export default function ClosingDailyForm() {
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
        <p style={{ margin: 0 }}>Daily Closing Report submitted for {form.shift.date || 'today'}.</p>
        <ReportLink submissionId={report.submissionId} />
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
          <LabeledInput label="Closing Manager / Supervisor" value={form.shift.closingManager} onChange={(v) => patchNested('shift', 'closingManager', v)} />
          <LabeledInput label="Staff on duty" type="number" value={form.shift.staffOnDuty} onChange={(v) => patchNested('shift', 'staffOnDuty', v)} />
          <LabeledInput label="End time" type="time" value={form.shift.endTime} onChange={(v) => patchNested('shift', 'endTime', v)} />
        </div>
      </Section>

      <Section title="B. Closing checklist (SOP 2)">
        <FixedRowStatusTable rows={CLOSING_PHASES} values={form.phases} onChange={setPhaseStatus} statusOptions={STATUS_OPTIONS} />
      </Section>

      <Section title="C. Cash reconciliation">
        <div className="form-grid-2col">
          <LabeledInput label="Drawer variance (if any)" type="number" value={form.cashReconciliation.drawerVariance} onChange={(v) => patchNested('cashReconciliation', 'drawerVariance', v)} />
          <LabeledInput label="Deposit amount" type="number" value={form.cashReconciliation.depositAmount} onChange={(v) => patchNested('cashReconciliation', 'depositAmount', v)} />
        </div>
      </Section>

      <Section title="D. Notes & escalations">
        <LabeledTextarea label="Issues found" value={form.notes.issuesFound} onChange={(v) => patchNested('notes', 'issuesFound', v)} />
        <LabeledTextarea label="Corrective action taken" value={form.notes.correctiveAction} onChange={(v) => patchNested('notes', 'correctiveAction', v)} />
        <LabeledInput label="Manager notified (name & time)" value={form.notes.managerNotified} onChange={(v) => patchNested('notes', 'managerNotified', v)} />
      </Section>

      <Section title="E. Sign-off">
        <LabeledInput label="Closer name" value={form.signOff.closerName} onChange={(v) => patchNested('signOff', 'closerName', v)} />
      </Section>

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-secondary" onClick={() => report.save(form, hasIncident)} disabled={report.status === 'saving'}>{report.status === 'saving' ? 'Saving…' : report.justSaved ? 'Saved ✓' : 'Save progress'}</button>
        <button className="btn btn-primary" onClick={() => report.submit(form, hasIncident)} disabled={report.status === 'saving' || !form.signOff.closerName.trim()}>
          Submit &amp; sign off
        </button>
      </div>
      {!form.signOff.closerName.trim() && <p className="hint">Add the closer's name in Sign-off before submitting.</p>}
    </div>
  );
}
