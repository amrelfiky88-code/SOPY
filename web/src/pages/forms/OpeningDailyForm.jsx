import React, { useEffect, useState } from 'react';
import { useOpsReport } from './useOpsReport.js';
import { Section, FixedRowStatusTable, LabeledInput, LabeledTextarea, ReportStart, ReportSubmitted, ReportActions, useFormLabels, choiceOptions, PersonSelect, usePeople } from './OpsFormParts.jsx';

const KIND = 'opening_daily';

// Mirrors SOP 1: Restaurant Opening Procedures (server/db/seed_opening_closing.sql)
// phase-for-phase, so this report tracks the same 8 phases a manager can
// also assign as individual checkpoints via the Checklist Builder.
// Labels live in i18n/formLabels.js under f.opening_daily.phases.<key>.
const OPENING_PHASES = ['arrival', 'equipment', 'foodSafety', 'stationPrep', 'diningRoom', 'preService', 'finalChecklist', 'openForService'];
const STATUS_VALUES = ['done', 'issue', 'skipped'];

const emptyState = () => ({
  shift: { date: '', openingManager: '', staffOnDuty: '', startTime: '' },
  phases: {},
  notes: { issuesFound: '', correctiveAction: '', managerNotified: '' },
  signOff: { openerName: '' },
});

export default function OpeningDailyForm() {
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
          {field('shift', 'openingManager')}
          {field('shift', 'staffOnDuty', 'number')}
          {field('shift', 'startTime', 'time')}
        </div>
      </Section>

      <Section title={L('sec.B')}>
        <FixedRowStatusTable
          rows={OPENING_PHASES.map((key) => ({ key, label: L(`phases.${key}`) }))}
          values={form.phases}
          onChange={setPhaseStatus}
          statusOptions={choiceOptions(t, STATUS_VALUES)}
        />
      </Section>

      <Section title={L('sec.C')}>
        <LabeledTextarea label={L('notes.issuesFound')} value={form.notes.issuesFound} onChange={(v) => patchNested('notes', 'issuesFound', v)} />
        <LabeledTextarea label={L('notes.correctiveAction')} value={form.notes.correctiveAction} onChange={(v) => patchNested('notes', 'correctiveAction', v)} />
        {field('notes', 'managerNotified')}
      </Section>

      <Section title={L('sec.D')}>
        <PersonSelect label={L('signOff.openerName')} value={form.signOff.openerName} onChange={(v) => patchNested('signOff', 'openerName', v)} people={team} match="store_team" branchId={report.branchId} />
      </Section>

      <ReportActions report={report} form={form} hasIncident={hasIncident} signerName={form.signOff.openerName} needNameHint={L('needName')} />
    </div>
  );
}
