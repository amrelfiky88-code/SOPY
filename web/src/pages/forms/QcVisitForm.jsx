import React, { useEffect, useState } from 'react';
import { useOpsReport } from './useOpsReport.js';
import {
  Section, FixedRowStatusTable, RepeatableTable, LabeledInput, LabeledSelect, LabeledTextarea,
  ReportStart, ReportSubmitted, ReportActions, useFormLabels, choiceOptions,
} from './OpsFormParts.jsx';

const KIND = 'qc_visit';

// Section-level scorecard across the same 12 categories the client's own
// Daily QC Checklist is organized into (server/db/seed_qc_system.sql) —
// a visit report scores each category as a whole rather than repeating
// every individual checkpoint, which already lives in the fine-grained
// checklist library. Labels live in i18n/formLabels.js under f.qc_visit.
const QC_CATEGORIES = [
  'exterior', 'foodSafety', 'kitchenHygiene', 'barStation', 'diningArea', 'staffReadiness',
  'safetyCompliance', 'foodQuality', 'presentation', 'serviceChoreography', 'ingredientQuality',
];
const SCORE_VALUES = ['excellent', 'satisfactory', 'needs_improvement', 'critical_fail'];

const FINDING_COLUMNS = [
  { key: 'category' },
  { key: 'finding' },
  { key: 'severity' },
  { key: 'correctiveAction' },
  { key: 'owner' },
  { key: 'dueDate', type: 'date', width: 130 },
];

const emptyState = () => ({
  visit: { date: '', inspectorName: '', visitType: 'scheduled', timeIn: '', timeOut: '' },
  scores: {},
  findings: [{}],
  summary: { overallRating: 'satisfactory', notes: '' },
  signOff: { inspectorName: '', storeManagerName: '' },
});

export default function QcVisitForm() {
  const { t, L } = useFormLabels(KIND);
  const report = useOpsReport({ kind: KIND, onResume: (saved) => setForm({ ...emptyState(), ...saved }) });
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
  // Saves quietly a moment after each change (see useOpsReport).
  useEffect(() => { report.autosave(form, hasIncident); }, [form]); // eslint-disable-line react-hooks/exhaustive-deps
  const title = L('title');

  if (report.status === 'idle') return <ReportStart report={report} title={title} startLabel={t('f.startVisit')} />;
  if (report.status === 'submitted') {
    return <ReportSubmitted report={report} message={L('submitted', { date: form.visit.date || t('f.today') })} />;
  }

  const field = (section, key, type) => (
    <LabeledInput label={L(`${section}.${key}`)} type={type} value={form[section][key]} onChange={(v) => patchNested(section, key, v)} />
  );
  const scoreOptions = choiceOptions(t, SCORE_VALUES);

  return (
    <div>
      <h2>{title}</h2>
      {report.error && <div className="error-banner">{report.error}</div>}

      <Section title={L('sec.A')}>
        <div className="form-grid-2col">
          {field('visit', 'date', 'date')}
          {field('visit', 'inspectorName')}
          <LabeledSelect label={L('visit.visitType')} value={form.visit.visitType} onChange={(v) => patchNested('visit', 'visitType', v)}
            options={['scheduled', 'surprise', 'follow_up'].map((v) => [v, t(`f.v.${v}`)])} />
          {field('visit', 'timeIn', 'time')}
          {field('visit', 'timeOut', 'time')}
        </div>
      </Section>

      <Section title={L('sec.B')}>
        <FixedRowStatusTable
          rows={QC_CATEGORIES.map((key) => ({ key, label: L(`scores.${key}`) }))}
          values={form.scores}
          onChange={setScore}
          statusOptions={scoreOptions}
          statusLabel={L('scores.*.status')}
        />
      </Section>

      <Section title={L('sec.C')}>
        <RepeatableTable columns={FINDING_COLUMNS.map((c) => ({ ...c, label: L(`findings[].${c.key}`) }))} {...editFindings} />
      </Section>

      <Section title={L('sec.D')}>
        <LabeledSelect label={L('summary.overallRating')} value={form.summary.overallRating} onChange={(v) => patchNested('summary', 'overallRating', v)} options={scoreOptions.map((o) => [o.value, o.label])} />
        <LabeledTextarea label={L('summary.notes')} value={form.summary.notes} onChange={(v) => patchNested('summary', 'notes', v)} />
      </Section>

      <Section title={L('sec.E')}>
        <div className="form-grid-2col">
          {field('signOff', 'inspectorName')}
          {field('signOff', 'storeManagerName')}
        </div>
      </Section>

      <ReportActions report={report} form={form} hasIncident={hasIncident} signerName={form.signOff.inspectorName} needNameHint={L('needName')} />
    </div>
  );
}
