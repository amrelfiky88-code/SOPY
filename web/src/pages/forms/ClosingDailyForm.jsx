import React, { useEffect, useState } from 'react';
import { useOpsReport } from './useOpsReport.js';
import { Section, FixedRowStatusTable, LabeledInput, LabeledTextarea, ReportStart, ReportSubmitted, ReportActions, useFormLabels, choiceOptions, PersonSelect, usePeople } from './OpsFormParts.jsx';

const KIND = 'closing_daily';

// Mirrors SOP 2: Restaurant Closing Procedures (server/db/seed_opening_closing.sql)
// phase-for-phase, so this report tracks the same 7 phases a manager can
// also assign as individual checkpoints via the Checklist Builder.
// Labels live in i18n/formLabels.js under f.closing_daily.phases.<key>.
const CLOSING_PHASES = ['kitchenBreakdown', 'diningRoomClosing', 'equipmentShutdown', 'cashHandling', 'foodStorage', 'nextDayPrep', 'securityWalkthrough'];
const STATUS_VALUES = ['done', 'issue', 'skipped'];

const emptyState = () => ({
  shift: { date: '', closingManager: '', staffOnDuty: '', endTime: '' },
  phases: {},
  cashReconciliation: { drawerVariance: '', depositAmount: '' },
  notes: { issuesFound: '', correctiveAction: '', managerNotified: '' },
  signOff: { closerName: '' },
});

export default function ClosingDailyForm() {
  const { t, L } = useFormLabels(KIND);
  const report = useOpsReport({ kind: KIND, onResume: (saved) => setForm({ ...emptyState(), ...saved }) });
  const [form, setForm] = useState(emptyState());

  const patchNested = (section, key, value) => setForm((f) => ({ ...f, [section]: { ...f[section], [key]: value } }));
  const setPhaseStatus = (key, field, value) => {
    setForm((f) => ({ ...f, phases: { ...f.phases, [key]: { ...f.phases[key], [field]: value } } }));
  };

  const hasIncident = Object.values(form.phases).some((p) => p?.status === 'issue') || !!form.notes.issuesFound.trim();
  // Saves quietly a moment after each change (see useOpsReport).
  useEffect(() => { report.autosave(form, hasIncident); }, [form]); // eslint-disable-line react-hooks/exhaustive-deps
  // Sign-off names are picked from the team instead of typed.
  const team = usePeople();
  const title = L('title');

  if (report.status === 'idle') return <ReportStart report={report} title={title} />;
  if (report.status === 'submitted') {
    return <ReportSubmitted report={report} message={L('submitted', { date: form.shift.date || t('f.today') })} />;
  }

  const field = (section, key, type) => (
    <LabeledInput label={L(`${section}.${key}`)} type={type} value={form[section][key]} onChange={(v) => patchNested(section, key, v)} />
  );

  return (
    <div>
      <h2>{title}</h2>
      {report.error && <div className="error-banner">{report.error}</div>}

      <Section title={L('sec.A')}>
        <div className="form-grid-2col">
          {field('shift', 'date', 'date')}
          {field('shift', 'closingManager')}
          {field('shift', 'staffOnDuty', 'number')}
          {field('shift', 'endTime', 'time')}
        </div>
      </Section>

      <Section title={L('sec.B')}>
        <FixedRowStatusTable
          rows={CLOSING_PHASES.map((key) => ({ key, label: L(`phases.${key}`) }))}
          values={form.phases}
          onChange={setPhaseStatus}
          statusOptions={choiceOptions(t, STATUS_VALUES)}
        />
      </Section>

      <Section title={L('sec.C')}>
        <div className="form-grid-2col">
          {field('cashReconciliation', 'drawerVariance', 'number')}
          {field('cashReconciliation', 'depositAmount', 'number')}
        </div>
      </Section>

      <Section title={L('sec.D')}>
        <LabeledTextarea label={L('notes.issuesFound')} value={form.notes.issuesFound} onChange={(v) => patchNested('notes', 'issuesFound', v)} />
        <LabeledTextarea label={L('notes.correctiveAction')} value={form.notes.correctiveAction} onChange={(v) => patchNested('notes', 'correctiveAction', v)} />
        {field('notes', 'managerNotified')}
      </Section>

      <Section title={L('sec.E')}>
        <PersonSelect label={L('signOff.closerName')} value={form.signOff.closerName} onChange={(v) => patchNested('signOff', 'closerName', v)} people={team} match="store_team" branchId={report.branchId} />
      </Section>

      <ReportActions report={report} form={form} hasIncident={hasIncident} signerName={form.signOff.closerName} needNameHint={L('needName')} />
    </div>
  );
}
