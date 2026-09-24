import React, { useEffect, useState } from 'react';
import { useOpsReport } from './useOpsReport.js';
import {
  Section, FixedRowStatusTable, RepeatableTable, LabeledInput, LabeledSelect, LabeledTextarea,
  ReportStart, ReportSubmitted, ReportActions, useFormLabels, choiceOptions,
} from './OpsFormParts.jsx';

const KIND = 'ops_manager_visit';

// No client-supplied template exists for this report (unlike Kitchen/Bar
// and the Opening/Closing/QC reports, which mirror real source documents)
// — this is a reasonable, industry-standard site-visit structure geared
// toward a multi-store operations review, not a client-verified form.
// Labels live in i18n/formLabels.js under f.ops_manager_visit.
const STANDARDS_KEYS = ['brandStandards', 'sopCompliance', 'healthSafety', 'equipmentCondition', 'facilityCondition', 'localManagement'];
const RATING_VALUES = ['good', 'fair', 'poor'];

const ACTION_COLUMNS = [
  { key: 'item' },
  { key: 'owner' },
  { key: 'dueDate', type: 'date', width: 130 },
  { key: 'status' },
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
  const { t, L } = useFormLabels(KIND);
  const report = useOpsReport({ kind: KIND, onResume: (saved) => setForm({ ...emptyState(), ...saved }) });
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
  const area = (section, key) => (
    <LabeledTextarea label={L(`${section}.${key}`)} value={form[section][key]} onChange={(v) => patchNested(section, key, v)} />
  );
  const ratingOptions = choiceOptions(t, RATING_VALUES);

  return (
    <div>
      <h2>{title}</h2>
      {report.error && <div className="error-banner">{report.error}</div>}

      <Section title={L('sec.A')}>
        <div className="form-grid-2col">
          {field('visit', 'date', 'date')}
          {field('visit', 'opsManagerName')}
          {field('visit', 'timeIn', 'time')}
          {field('visit', 'timeOut', 'time')}
        </div>
      </Section>

      <Section title={L('sec.B')}>
        <div className="form-grid-2col">
          {field('financials', 'salesVsTargetPct', 'number')}
          {field('financials', 'foodCostPct', 'number')}
          {field('financials', 'laborCostPct', 'number')}
          {field('financials', 'primeCostPct', 'number')}
        </div>
        {area('financials', 'varianceNotes')}
      </Section>

      <Section title={L('sec.C')}>
        <FixedRowStatusTable
          rows={STANDARDS_KEYS.map((key) => ({ key, label: L(`standards.${key}`) }))}
          values={form.standards}
          onChange={setStandard}
          statusOptions={ratingOptions}
          statusLabel={L('standards.*.status')}
        />
      </Section>

      <Section title={L('sec.D')}>
        {area('leadership', 'storeManagerNotes')}
        {area('leadership', 'successionNotes')}
      </Section>

      <Section title={L('sec.E')}>
        <RepeatableTable columns={ACTION_COLUMNS.map((c) => ({ ...c, label: L(`actionItems[].${c.key}`) }))} {...editActionItems} />
      </Section>

      <Section title={L('sec.F')}>
        <LabeledSelect label={L('summary.overallRating')} value={form.summary.overallRating} onChange={(v) => patchNested('summary', 'overallRating', v)} options={ratingOptions.map((o) => [o.value, o.label])} />
        {area('summary', 'notes')}
      </Section>

      <Section title={L('sec.G')}>
        <div className="form-grid-2col">
          {field('signOff', 'opsManagerName')}
          {field('signOff', 'storeManagerName')}
        </div>
      </Section>

      <ReportActions report={report} form={form} hasIncident={hasIncident} signerName={form.signOff.opsManagerName} needNameHint={L('needName')} />
    </div>
  );
}
