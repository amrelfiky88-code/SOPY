import React, { useEffect, useState } from 'react';
import { useOpsReport } from './useOpsReport.js';
import {
  Section, FixedRowStatusTable, RepeatableTable, LabeledInput, LabeledSelect, LabeledTextarea,
  ReportStart, ReportSubmitted, ReportActions, useFormLabels, choiceOptions,
} from './OpsFormParts.jsx';

const KIND = 'area_manager_visit';

// No client-supplied template exists for this report (unlike Kitchen/Bar
// and the Opening/Closing/QC reports, which mirror real source documents)
// — this is a reasonable, industry-standard site-visit structure, not a
// client-verified form. Treat it as a reviewable starting point.
// Labels live in i18n/formLabels.js under f.area_manager_visit.
const SPOT_CHECK_KEYS = ['foodSafety', 'cleanliness', 'staffConduct', 'customerService', 'cashHandling', 'inventory', 'brandCompliance', 'healthSafety'];
const RATING_VALUES = ['good', 'fair', 'poor'];

const ACTION_COLUMNS = [
  { key: 'item' },
  { key: 'owner' },
  { key: 'dueDate', type: 'date', width: 130 },
  { key: 'status' },
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
  const { t, L } = useFormLabels(KIND);
  const report = useOpsReport({ kind: KIND, onResume: (saved) => setForm({ ...emptyState(), ...saved }) });
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
          {field('visit', 'areaManagerName')}
          <LabeledSelect label={L('visit.visitType')} value={form.visit.visitType} onChange={(v) => patchNested('visit', 'visitType', v)}
            options={['routine', 'follow_up', 'incident_response'].map((v) => [v, t(`f.v.${v}`)])} />
          {field('visit', 'timeIn', 'time')}
          {field('visit', 'timeOut', 'time')}
        </div>
      </Section>

      <Section title={L('sec.B')}>
        <FixedRowStatusTable
          rows={SPOT_CHECK_KEYS.map((key) => ({ key, label: L(`spotCheck.${key}`) }))}
          values={form.spotCheck}
          onChange={setSpotCheck}
          statusOptions={ratingOptions}
          statusLabel={L('spotCheck.*.status')}
        />
      </Section>

      <Section title={L('sec.C')}>
        {area('team', 'staffingAdequate')}
        {area('team', 'trainingGaps')}
        {area('team', 'moraleNotes')}
      </Section>

      <Section title={L('sec.D')}>
        <RepeatableTable columns={ACTION_COLUMNS.map((c) => ({ ...c, label: L(`actionItems[].${c.key}`) }))} {...editActionItems} />
      </Section>

      <Section title={L('sec.E')}>
        <LabeledSelect label={L('summary.overallRating')} value={form.summary.overallRating} onChange={(v) => patchNested('summary', 'overallRating', v)} options={ratingOptions.map((o) => [o.value, o.label])} />
        {area('summary', 'notes')}
      </Section>

      <Section title={L('sec.F')}>
        <div className="form-grid-2col">
          {field('signOff', 'areaManagerName')}
          {field('signOff', 'storeManagerName')}
        </div>
      </Section>

      <ReportActions report={report} form={form} hasIncident={hasIncident} signerName={form.signOff.areaManagerName} needNameHint={L('needName')} />
    </div>
  );
}
