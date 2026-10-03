import React, { useEffect, useState } from 'react';
import { useOpsReport } from './useOpsReport.js';
import {
  Section, TemperatureLogTable, OpeningClosingChecklist, RepeatableTable, FixedRowStatusTable,
  LabeledInput, LabeledSelect, LabeledTextarea, ReportStart, ReportSubmitted, ReportActions, useFormLabels, choiceOptions,
  PersonSelect, usePeople,
} from './OpsFormParts.jsx';
import { TEMPERATURE_ROWS, temperatureDeviations } from '../../../../shared/temperatures.js';

const KIND = 'kitchen_daily';

// Labels live in i18n/formLabels.js under f.kitchen_daily.<form_data path>.
// Equipment rows and their safe ranges are shared with the server's KPIs.
const TEMP_ROWS = TEMPERATURE_ROWS[KIND];

const RECEIVING_COLUMNS = [
  { key: 'time', type: 'time', width: 100 },
  { key: 'supplierItem' },
  { key: 'temp', type: 'number', width: 70 },
  { key: 'condition' },
  { key: 'accepted', type: 'checkbox' },
  { key: 'receivedBy' },
];

const PRODUCTION_COLUMNS = [
  { key: 'item' },
  { key: 'planned', width: 80 },
  { key: 'actual', width: 80 },
  { key: 'remaining', width: 80 },
  { key: 'notes' },
];

const WASTE_COLUMNS = [
  { key: 'item' },
  { key: 'quantity', width: 80 },
  { key: 'reason' },
  { key: 'preventiveAction' },
  { key: 'staffInitials', width: 80 },
];

const EQUIPMENT_KEYS = ['grill', 'fryer1', 'fryer2', 'convectionOven', 'combiOven', 'fridge1', 'fridge2', 'freezer', 'dishwasher', 'hood'];
const OPENING_TASK_COUNT = 7;
const CLOSING_TASK_COUNT = 7;

const emptyState = () => ({
  shift: { reportNo: '', shiftType: 'morning', dayOfWeek: '', supervisor: '', headChef: '', startTime: '', endTime: '', kitchenStaff: '', prepStaff: '', phase: 'opening' },
  temperatureLog: {},
  tempDeviation: { found: false, actionTaken: '', foodMoved: false, managerNotified: '' },
  receivingLog: [{}],
  productionLog: [{}],
  wasteLog: [{}],
  wasteTotal: { value: '', category: 'overproduction' },
  equipmentStatus: {},
  checklist: { opening: {}, closing: {} },
  notes: { incidents: '', complaints: '', equipmentIssues: '', outOfStock: '', generalNotes: '' },
  signOff: { supervisorName: '', managerName: '' },
});

export default function KitchenDailyForm() {
  const { t, L } = useFormLabels(KIND);
  const report = useOpsReport({ kind: KIND, onResume: (saved) => setForm({ ...emptyState(), ...saved }) });
  const [form, setForm] = useState(emptyState());

  const patch = (section, value) => setForm((f) => ({ ...f, [section]: typeof value === 'function' ? value(f[section]) : { ...f[section], ...value } }));
  const patchNested = (section, key, value) => setForm((f) => ({ ...f, [section]: { ...f[section], [key]: value } }));

  const setTempReading = (key, field, value) => {
    setForm((f) => ({ ...f, temperatureLog: { ...f.temperatureLog, [key]: { ...f.temperatureLog[key], [field]: value } } }));
  };
  const setEquipmentStatus = (key, field, value) => {
    setForm((f) => ({ ...f, equipmentStatus: { ...f.equipmentStatus, [key]: { ...f.equipmentStatus[key], [field]: value } } }));
  };
  const toggleTask = (which, i) => {
    setForm((f) => ({ ...f, checklist: { ...f.checklist, [which]: { ...f.checklist[which], [i]: !f.checklist[which]?.[i] } } }));
  };

  const editRepeatable = (key) => ({
    rows: form[key],
    onChangeRow: (i, field, value) => setForm((f) => {
      const rows = [...f[key]];
      rows[i] = { ...rows[i], [field]: value };
      return { ...f, [key]: rows };
    }),
    onAddRow: () => setForm((f) => ({ ...f, [key]: [...f[key], {}] })),
    onRemoveRow: (i) => setForm((f) => ({ ...f, [key]: f[key].filter((_, idx) => idx !== i) })),
  });
  const columns = (section, cols) => cols.map((c) => ({ ...c, label: L(`${section}[].${c.key}`) }));
  const tasks = (which, n) => Array.from({ length: n }, (_, i) => L(`checklist.${which}.${i}`));

  // A reading outside its safe range is an incident too.
  const hasIncident = !!(form.notes.incidents?.trim() || form.tempDeviation.found || temperatureDeviations(KIND, form.temperatureLog).length > 0);
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
          <LabeledSelect label={L('shift.phase')} value={form.shift.phase} onChange={(v) => patchNested('shift', 'phase', v)}
            options={['opening', 'mid', 'closing'].map((v) => [v, t(`f.v.${v}`)])} />
          {shiftInput('supervisor')}
          {shiftInput('headChef')}
          {shiftInput('startTime', 'time')}
          {shiftInput('endTime', 'time')}
          {shiftInput('kitchenStaff', 'number')}
          {shiftInput('prepStaff', 'number')}
        </div>
      </Section>

      <Section title={L('sec.B')}>
        <TemperatureLogTable
          rows={TEMP_ROWS.map((r) => ({ ...r, label: L(`temperatureLog.${r.key}`), safeRange: L(`range.${r.range}`) }))}
          values={form.temperatureLog}
          kind={KIND}
          onChange={setTempReading}
        />
        <div className="form-grid-2col" style={{ marginTop: 12 }}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 400 }}>
            <input type="checkbox" checked={form.tempDeviation.found} onChange={(e) => patch('tempDeviation', { found: e.target.checked })} />
            {L('tempDeviation.found')}
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 400 }}>
            <input type="checkbox" checked={form.tempDeviation.foodMoved} onChange={(e) => patch('tempDeviation', { foodMoved: e.target.checked })} />
            {L('tempDeviation.foodMoved')}
          </label>
          <input placeholder={L('tempDeviation.actionTaken')} aria-label={L('tempDeviation.actionTaken')} value={form.tempDeviation.actionTaken} onChange={(e) => patch('tempDeviation', { actionTaken: e.target.value })} />
          <input placeholder={L('tempDeviation.managerNotified')} aria-label={L('tempDeviation.managerNotified')} value={form.tempDeviation.managerNotified} onChange={(e) => patch('tempDeviation', { managerNotified: e.target.value })} />
        </div>
      </Section>

      <Section title={L('sec.C')}>
        <RepeatableTable columns={columns('receivingLog', RECEIVING_COLUMNS)} {...editRepeatable('receivingLog')} />
      </Section>

      <Section title={L('sec.D')}>
        <RepeatableTable columns={columns('productionLog', PRODUCTION_COLUMNS)} {...editRepeatable('productionLog')} />
      </Section>

      <Section title={L('sec.E')}>
        <RepeatableTable columns={columns('wasteLog', WASTE_COLUMNS)} {...editRepeatable('wasteLog')} />
        <div style={{ marginTop: 12, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <input placeholder={L('wasteTotal.value')} aria-label={L('wasteTotal.value')} type="number" step="any" min="0" inputMode="decimal" style={{ maxWidth: 200 }} value={form.wasteTotal.value} onChange={(e) => patch('wasteTotal', { value: e.target.value })} />
          <select aria-label={L('wasteTotal.category')} value={form.wasteTotal.category} onChange={(e) => patch('wasteTotal', { category: e.target.value })}>
            {['overproduction', 'spoilage', 'error'].map((v) => <option key={v} value={v}>{t(`f.v.${v}`)}</option>)}
          </select>
        </div>
      </Section>

      <Section title={L('sec.F')}>
        <FixedRowStatusTable
          rows={EQUIPMENT_KEYS.map((key) => ({ key, label: L(`equipmentStatus.${key}`) }))}
          values={form.equipmentStatus}
          onChange={setEquipmentStatus}
          statusOptions={choiceOptions(t, ['ok', 'fault'])}
        />
      </Section>

      <Section title={L('sec.G')}>
        <OpeningClosingChecklist opening={tasks('opening', OPENING_TASK_COUNT)} closing={tasks('closing', CLOSING_TASK_COUNT)} values={form.checklist} onToggle={toggleTask} />
      </Section>

      <Section title={L('sec.H')}>
        {noteArea('incidents')}
        {noteArea('complaints')}
        {noteArea('equipmentIssues')}
        {noteArea('outOfStock')}
        {noteArea('generalNotes')}
      </Section>

      <Section title={L('sec.I')}>
        <div className="form-grid-2col">
          <PersonSelect label={L('signOff.supervisorName')} value={form.signOff.supervisorName} onChange={(v) => patchNested('signOff', 'supervisorName', v)} people={team} match="store_team" branchId={report.branchId} />
          <PersonSelect label={L('signOff.managerName')} value={form.signOff.managerName} onChange={(v) => patchNested('signOff', 'managerName', v)} people={team} match="operations_manager" branchId={report.branchId} />
        </div>
      </Section>

      <ReportActions report={report} form={form} hasIncident={hasIncident} signerName={form.signOff.supervisorName} needNameHint={L('needName')} />
    </div>
  );
}
