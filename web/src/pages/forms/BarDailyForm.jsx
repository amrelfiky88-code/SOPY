import React, { useEffect, useState } from 'react';
import { useOpsReport } from './useOpsReport.js';
import {
  Section, TemperatureLogTable, OpeningClosingChecklist, FixedRowDataTable, FixedRowStatusTable,
  LabeledInput, LabeledSelect, LabeledTextarea, ReportStart, ReportSubmitted, ReportActions, useFormLabels, choiceOptions,
  PersonSelect, usePeople,
} from './OpsFormParts.jsx';
import { TEMPERATURE_ROWS, temperatureDeviations } from '../../../../shared/temperatures.js';

const KIND = 'bar_daily';

// Labels live in i18n/formLabels.js under f.bar_daily.<form_data path>.
// Equipment rows and their safe ranges are shared with the server's KPIs.
const TEMP_ROWS = TEMPERATURE_ROWS[KIND];

const STOCK_ITEM_COUNT = 17;
const STOCK_COLUMNS = [
  { key: 'opening', type: 'number' },
  { key: 'received', type: 'number' },
  { key: 'sold', type: 'number' },
  { key: 'waste', type: 'number' },
  { key: 'closing', type: 'number' },
];

const SALES_KEYS = ['hot', 'coldSoft', 'juices', 'bottled', 'specialty', 'addons'];
const SALES_COLUMNS = [
  { key: 'target', type: 'number' },
  { key: 'actual', type: 'number' },
  { key: 'variance', type: 'number' },
  { key: 'variancePct', type: 'number' },
];

const CLEANING_ROWS = [
  { key: 'espresso', na: ['mid'] },
  { key: 'steamWand', na: ['start'] },
  { key: 'grinder', na: ['start', 'mid'] },
  { key: 'blenderRinse' },
  { key: 'blenderSanitize', na: ['start', 'mid'] },
  { key: 'iceMachine', na: ['mid'] },
  { key: 'counter' },
  { key: 'fountainNozzles', na: ['mid'] },
  { key: 'fridgeShelves', na: ['mid'] },
  { key: 'glassware', na: ['mid'] },
  { key: 'floor', na: ['start'] },
];
const CLEANING_COLUMNS = [
  { key: 'start', type: 'checkbox' },
  { key: 'mid', type: 'checkbox' },
  { key: 'endBy' },
];

const COMPLIANCE_ITEM_COUNT = 9;
const OPENING_TASK_COUNT = 8;
const CLOSING_TASK_COUNT = 8;

const emptyState = () => ({
  shift: { reportNo: '', shiftType: 'morning', dayOfWeek: '', barManager: '', headBartender: '', startTime: '', endTime: '', bartenders: '', support: '', reportType: 'opening' },
  temperatureLog: {},
  tempDeviation: { found: false, actionTaken: '', faultReported: false, notified: '' },
  stockLog: {},
  stockNotes: { belowPar: '', reorderPlaced: false, reorderDetails: '', wasteValue: '', wasteReason: 'expired' },
  salesPerformance: {},
  salesNotes: { bestSeller: '', slowest: '', promoActive: '', promoPerformance: 'on_target' },
  cleaningLog: {},
  complianceCheck: {},
  checklist: { opening: {}, closing: {} },
  notes: { complaints: '', equipmentFaults: '', lowStock: '', staffIssues: '', managerNotes: '' },
  signOff: { barManagerName: '', opsManagerName: '' },
});

export default function BarDailyForm() {
  const { t, L } = useFormLabels(KIND);
  const report = useOpsReport({ kind: KIND, onResume: (saved) => setForm({ ...emptyState(), ...saved }) });
  const [form, setForm] = useState(emptyState());

  const patch = (section, value) => setForm((f) => ({ ...f, [section]: { ...f[section], ...value } }));
  const patchNested = (section, key, value) => setForm((f) => ({ ...f, [section]: { ...f[section], [key]: value } }));
  const setFixedRow = (section) => (key, field, value) =>
    setForm((f) => ({ ...f, [section]: { ...f[section], [key]: { ...f[section][key], [field]: value } } }));
  const toggleTask = (which, i) =>
    setForm((f) => ({ ...f, checklist: { ...f.checklist, [which]: { ...f.checklist[which], [i]: !f.checklist[which]?.[i] } } }));

  const rows = (section, list) => list.map((r) => ({ ...(typeof r === 'string' ? { key: r } : r), label: L(`${section}.${typeof r === 'string' ? r : r.key}`) }));
  const columns = (section, cols) => cols.map((c) => ({ ...c, label: L(`${section}.*.${c.key}`) }));
  const numbered = (prefix, n) => Array.from({ length: n }, (_, i) => `${prefix}${i}`);
  const tasks = (which, n) => Array.from({ length: n }, (_, i) => L(`checklist.${which}.${i}`));

  // A reading outside its safe range is an incident too.
  const hasIncident = !!(form.notes.staffIssues?.trim() || form.tempDeviation.found || form.tempDeviation.faultReported || temperatureDeviations(KIND, form.temperatureLog).length > 0);
  // Saves quietly a moment after each change (see useOpsReport).
  useEffect(() => { report.autosave(form, hasIncident); }, [form]); // eslint-disable-line react-hooks/exhaustive-deps
  // Sign-off names are picked from the team instead of typed.
  const team = usePeople();
  const title = L('title');

  if (report.status === 'idle') return <ReportStart report={report} title={title} />;
  if (report.status === 'submitted') {
    return <ReportSubmitted report={report} message={L('submitted', { no: form.shift.reportNo || '—' })} />;
  }

  const shiftInput = (key, type) => (
    <LabeledInput label={L(`shift.${key}`)} type={type} value={form.shift[key]} onChange={(v) => patchNested('shift', key, v)} />
  );
  const noteArea = (key) => (
    <LabeledTextarea label={L(`notes.${key}`)} value={form.notes[key]} onChange={(v) => patchNested('notes', key, v)} />
  );
  const textInput = (section, key, type) => (
    <input placeholder={L(`${section}.${key}`)} aria-label={L(`${section}.${key}`)} type={type} value={form[section][key]} onChange={(e) => patch(section, { [key]: e.target.value })} />
  );
  const checkbox = (section, key) => (
    <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 400 }}>
      <input type="checkbox" checked={form[section][key]} onChange={(e) => patch(section, { [key]: e.target.checked })} />
      {L(`${section}.${key}`)}
    </label>
  );
  const choice = (section, key, values) => (
    <select aria-label={L(`${section}.${key}`)} value={form[section][key]} onChange={(e) => patch(section, { [key]: e.target.value })}>
      {values.map((v) => <option key={v} value={v}>{t(`f.v.${v}`)}</option>)}
    </select>
  );

  return (
    <div>
      <h2>{title}</h2>
      {report.error && <div className="error-banner">{report.error}</div>}

      <Section title={L('sec.A')}>
        <div className="form-grid-2col">
          {shiftInput('reportNo')}
          <LabeledSelect label={L('shift.shiftType')} value={form.shift.shiftType} onChange={(v) => patchNested('shift', 'shiftType', v)}
            options={['morning', 'afternoon', 'evening'].map((v) => [v, t(`f.v.${v}`)])} />
          {shiftInput('dayOfWeek')}
          <LabeledSelect label={L('shift.reportType')} value={form.shift.reportType} onChange={(v) => patchNested('shift', 'reportType', v)}
            options={['opening', 'mid', 'closing'].map((v) => [v, t(`f.v.${v}`)])} />
          {shiftInput('barManager')}
          {shiftInput('headBartender')}
          {shiftInput('startTime', 'time')}
          {shiftInput('endTime', 'time')}
          {shiftInput('bartenders', 'number')}
          {shiftInput('support', 'number')}
        </div>
      </Section>

      <Section title={L('sec.B')}>
        <TemperatureLogTable
          rows={TEMP_ROWS.map((r) => ({ ...r, label: L(`temperatureLog.${r.key}`), safeRange: L(`range.${r.range}`) }))}
          values={form.temperatureLog}
          kind={KIND}
          onChange={setFixedRow('temperatureLog')}
        />
        <div className="form-grid-2col" style={{ marginTop: 12 }}>
          {checkbox('tempDeviation', 'found')}
          {checkbox('tempDeviation', 'faultReported')}
          {textInput('tempDeviation', 'actionTaken')}
          {textInput('tempDeviation', 'notified')}
        </div>
      </Section>

      <Section title={L('sec.C')}>
        <FixedRowDataTable rows={rows('stockLog', numbered('stock', STOCK_ITEM_COUNT))} columns={columns('stockLog', STOCK_COLUMNS)} values={form.stockLog} onChange={setFixedRow('stockLog')} />
        <div className="form-grid-2col" style={{ marginTop: 12 }}>
          {textInput('stockNotes', 'belowPar')}
          {checkbox('stockNotes', 'reorderPlaced')}
          {textInput('stockNotes', 'reorderDetails')}
          {textInput('stockNotes', 'wasteValue', 'number')}
          {choice('stockNotes', 'wasteReason', ['expired', 'spillage', 'quality'])}
        </div>
      </Section>

      <Section title={L('sec.D')}>
        <FixedRowDataTable rows={rows('salesPerformance', SALES_KEYS)} columns={columns('salesPerformance', SALES_COLUMNS)} values={form.salesPerformance} onChange={setFixedRow('salesPerformance')} />
        <div className="form-grid-2col" style={{ marginTop: 12 }}>
          {textInput('salesNotes', 'bestSeller')}
          {textInput('salesNotes', 'slowest')}
          {textInput('salesNotes', 'promoActive')}
          {choice('salesNotes', 'promoPerformance', ['above', 'on_target', 'below'])}
        </div>
      </Section>

      <Section title={L('sec.E')}>
        <FixedRowDataTable rows={rows('cleaningLog', CLEANING_ROWS)} columns={columns('cleaningLog', CLEANING_COLUMNS)} values={form.cleaningLog} onChange={setFixedRow('cleaningLog')} />
      </Section>

      <Section title={L('sec.F')}>
        <FixedRowStatusTable rows={rows('complianceCheck', numbered('c', COMPLIANCE_ITEM_COUNT))} values={form.complianceCheck} onChange={setFixedRow('complianceCheck')} statusOptions={choiceOptions(t, ['ok', 'action_needed'])} />
      </Section>

      <Section title={L('sec.G')}>
        <OpeningClosingChecklist opening={tasks('opening', OPENING_TASK_COUNT)} closing={tasks('closing', CLOSING_TASK_COUNT)} values={form.checklist} onToggle={toggleTask} />
      </Section>

      <Section title={L('sec.H')}>
        {noteArea('complaints')}
        {noteArea('equipmentFaults')}
        {noteArea('lowStock')}
        {noteArea('staffIssues')}
        {noteArea('managerNotes')}
      </Section>

      <Section title={L('sec.I')}>
        <div className="form-grid-2col">
          <PersonSelect label={L('signOff.barManagerName')} value={form.signOff.barManagerName} onChange={(v) => patchNested('signOff', 'barManagerName', v)} people={team} match="store_team" branchId={report.branchId} />
          <PersonSelect label={L('signOff.opsManagerName')} value={form.signOff.opsManagerName} onChange={(v) => patchNested('signOff', 'opsManagerName', v)} people={team} match="operations_manager" branchId={report.branchId} />
        </div>
      </Section>

      <ReportActions report={report} form={form} hasIncident={hasIncident} signerName={form.signOff.barManagerName} needNameHint={L('needName')} />
    </div>
  );
}
