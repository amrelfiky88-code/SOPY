import React, { useState } from 'react';
import { useOpsReport } from './useOpsReport.js';
import { Section, TemperatureLogTable, OpeningClosingChecklist, RepeatableTable, FixedRowStatusTable, LabeledInput, LabeledSelect, LabeledTextarea } from './OpsFormParts.jsx';

const TITLE = 'Kitchen Daily Operation Report';
const KIND = 'kitchen_daily';

const TEMP_ROWS = [
  { key: 'fridge1', label: 'Walk-in Refrigerator #1', safeRange: '1°C – 5°C' },
  { key: 'fridge2', label: 'Walk-in Refrigerator #2', safeRange: '1°C – 5°C' },
  { key: 'freezer', label: 'Walk-in Freezer', safeRange: 'Below -18°C' },
  { key: 'prepFridge', label: 'Prep Fridge (Counter)', safeRange: '1°C – 5°C' },
  { key: 'displayFridge', label: 'Display Fridge', safeRange: '3°C – 7°C' },
  { key: 'fryerOil', label: 'Deep Fryer Oil Temp', safeRange: '170°C – 180°C', midNA: true },
  { key: 'grill', label: 'Grill Surface Temp', safeRange: '200°C – 230°C', midNA: true },
  { key: 'hotHolding', label: 'Hot Holding Cabinet', safeRange: 'Min 63°C' },
  { key: 'steamTable', label: 'Steam Table', safeRange: 'Min 74°C' },
];

const RECEIVING_COLUMNS = [
  { key: 'time', label: 'Delivery Time', type: 'time', width: 100 },
  { key: 'supplierItem', label: 'Supplier / Item' },
  { key: 'temp', label: 'Temp on Arrival', type: 'number', width: 70 },
  { key: 'condition', label: 'Condition' },
  { key: 'accepted', label: 'Accepted?', type: 'checkbox' },
  { key: 'receivedBy', label: 'Received By' },
];

const PRODUCTION_COLUMNS = [
  { key: 'item', label: 'Menu Item / Prep Task' },
  { key: 'planned', label: 'Planned Qty', width: 80 },
  { key: 'actual', label: 'Actual Prep', width: 80 },
  { key: 'remaining', label: 'Remaining', width: 80 },
  { key: 'notes', label: 'Notes / Issues' },
];

const WASTE_COLUMNS = [
  { key: 'item', label: 'Item Wasted' },
  { key: 'quantity', label: 'Quantity', width: 80 },
  { key: 'reason', label: 'Reason' },
  { key: 'preventiveAction', label: 'Preventive Action' },
  { key: 'staffInitials', label: 'Staff Initials', width: 80 },
];

const EQUIPMENT_ROWS = [
  { key: 'grill', label: 'Flat-top Grill' },
  { key: 'fryer1', label: 'Deep Fryer #1' },
  { key: 'fryer2', label: 'Deep Fryer #2' },
  { key: 'convectionOven', label: 'Convection Oven' },
  { key: 'combiOven', label: 'Combi Oven / Microwave' },
  { key: 'fridge1', label: 'Refrigerator #1' },
  { key: 'fridge2', label: 'Refrigerator #2' },
  { key: 'freezer', label: 'Freezer' },
  { key: 'dishwasher', label: 'Dishwasher / Glasswasher' },
  { key: 'hood', label: 'Extraction / Ventilation Hood' },
];

const EQUIPMENT_STATUS_OPTIONS = [{ value: 'ok', label: 'OK' }, { value: 'fault', label: 'Fault' }];

const OPENING_TASKS = [
  'Temperature checks completed & logged',
  'All fridges/freezers at correct temps',
  'All surfaces sanitized & stations set',
  'Mise en place prepared per prep list',
  'Equipment pre-heated & tested',
  'Stock par levels checked & shortages flagged',
  'Team briefing completed',
];

const CLOSING_TASKS = [
  'All food cooled, labeled & stored correctly',
  'Fryer oil filtered & level checked',
  'All surfaces & equipment cleaned & sanitized',
  'Waste bins emptied; new liners fitted',
  'All equipment turned off & secured',
  'End-of-day stock count completed',
  'Closing checklist signed & submitted',
];

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
  const report = useOpsReport({ kind: KIND, title: TITLE });
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

  const hasIncident = !!(form.notes.incidents?.trim() || form.tempDeviation.found);

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
          <button className="btn btn-primary" onClick={report.start} disabled={!report.branchId}>Start today's report</button>
          {report.branches.length === 0 && <p className="hint">Add a store first, under Team &amp; stores.</p>}
        </div>
      </div>
    );
  }

  if (report.status === 'submitted') {
    return <div className="card empty-state"><p style={{ margin: 0 }}>Kitchen Daily Report submitted (KDR-{form.shift.reportNo || '—'}). Retain per policy for 90 days.</p></div>;
  }

  return (
    <div>
      <h2>{TITLE}</h2>
      {report.error && <div className="error-banner">{report.error}</div>}

      <Section title="A. Shift identification">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <LabeledInput label="Report No. (KDR-)" value={form.shift.reportNo} onChange={(v) => patchNested('shift', 'reportNo', v)} />
          <LabeledSelect label="Shift" value={form.shift.shiftType} onChange={(v) => patchNested('shift', 'shiftType', v)}
            options={[['morning', 'Morning (Open)'], ['afternoon', 'Afternoon'], ['evening', 'Evening (Close)']]} />
          <LabeledInput label="Day of week" value={form.shift.dayOfWeek} onChange={(v) => patchNested('shift', 'dayOfWeek', v)} />
          <LabeledSelect label="Opening / Mid / Closing" value={form.shift.phase} onChange={(v) => patchNested('shift', 'phase', v)}
            options={[['opening', 'Opening'], ['mid', 'Mid'], ['closing', 'Closing']]} />
          <LabeledInput label="Kitchen Supervisor" value={form.shift.supervisor} onChange={(v) => patchNested('shift', 'supervisor', v)} />
          <LabeledInput label="Head Chef" value={form.shift.headChef} onChange={(v) => patchNested('shift', 'headChef', v)} />
          <LabeledInput label="Shift start (hrs)" type="time" value={form.shift.startTime} onChange={(v) => patchNested('shift', 'startTime', v)} />
          <LabeledInput label="Shift end (hrs)" type="time" value={form.shift.endTime} onChange={(v) => patchNested('shift', 'endTime', v)} />
          <LabeledInput label="Kitchen staff on duty" type="number" value={form.shift.kitchenStaff} onChange={(v) => patchNested('shift', 'kitchenStaff', v)} />
          <LabeledInput label="Prep staff on duty" type="number" value={form.shift.prepStaff} onChange={(v) => patchNested('shift', 'prepStaff', v)} />
        </div>
      </Section>

      <Section title="B. Temperature monitoring log">
        <TemperatureLogTable rows={TEMP_ROWS} values={form.temperatureLog} onChange={setTempReading} />
        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 400 }}>
            <input type="checkbox" checked={form.tempDeviation.found} onChange={(e) => patch('tempDeviation', { found: e.target.checked })} />
            Deviation found
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 400 }}>
            <input type="checkbox" checked={form.tempDeviation.foodMoved} onChange={(e) => patch('tempDeviation', { foodMoved: e.target.checked })} />
            Food moved / discarded
          </label>
          <input placeholder="Action taken" value={form.tempDeviation.actionTaken} onChange={(e) => patch('tempDeviation', { actionTaken: e.target.value })} />
          <input placeholder="Manager notified (name & time)" value={form.tempDeviation.managerNotified} onChange={(e) => patch('tempDeviation', { managerNotified: e.target.value })} />
        </div>
      </Section>

      <Section title="C. Delivery & receiving log">
        <RepeatableTable columns={RECEIVING_COLUMNS} {...editRepeatable('receivingLog')} />
      </Section>

      <Section title="D. Production & food preparation">
        <RepeatableTable columns={PRODUCTION_COLUMNS} {...editRepeatable('productionLog')} />
      </Section>

      <Section title="E. Food waste log">
        <RepeatableTable columns={WASTE_COLUMNS} {...editRepeatable('wasteLog')} />
        <div style={{ marginTop: 12, display: 'flex', gap: 12 }}>
          <input placeholder="Total waste value" type="number" style={{ maxWidth: 160 }} value={form.wasteTotal.value} onChange={(e) => patch('wasteTotal', { value: e.target.value })} />
          <select value={form.wasteTotal.category} onChange={(e) => patch('wasteTotal', { category: e.target.value })}>
            <option value="overproduction">Overproduction</option>
            <option value="spoilage">Spoilage</option>
            <option value="error">Error</option>
          </select>
        </div>
      </Section>

      <Section title="F. Equipment status log">
        <FixedRowStatusTable rows={EQUIPMENT_ROWS} values={form.equipmentStatus} onChange={setEquipmentStatus} statusOptions={EQUIPMENT_STATUS_OPTIONS} />
      </Section>

      <Section title="G. Opening & closing checklist">
        <OpeningClosingChecklist opening={OPENING_TASKS} closing={CLOSING_TASKS} values={form.checklist} onToggle={toggleTask} />
      </Section>

      <Section title="H. Incidents, complaints & shift notes">
        <LabeledTextarea label="Incidents / accidents" value={form.notes.incidents} onChange={(v) => patchNested('notes', 'incidents', v)} />
        <LabeledTextarea label="Customer complaints received" value={form.notes.complaints} onChange={(v) => patchNested('notes', 'complaints', v)} />
        <LabeledTextarea label="Equipment issues flagged to maintenance" value={form.notes.equipmentIssues} onChange={(v) => patchNested('notes', 'equipmentIssues', v)} />
        <LabeledTextarea label="Out-of-stock items / shortages" value={form.notes.outOfStock} onChange={(v) => patchNested('notes', 'outOfStock', v)} />
        <LabeledTextarea label="General shift notes / recommendations" value={form.notes.generalNotes} onChange={(v) => patchNested('notes', 'generalNotes', v)} />
      </Section>

      <Section title="I. Sign-off & authorization">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <LabeledInput label="Kitchen Supervisor name" value={form.signOff.supervisorName} onChange={(v) => patchNested('signOff', 'supervisorName', v)} />
          <LabeledInput label="Operations Manager name" value={form.signOff.managerName} onChange={(v) => patchNested('signOff', 'managerName', v)} />
        </div>
      </Section>

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-secondary" onClick={() => report.save(form, hasIncident)} disabled={report.status === 'saving'}>Save progress</button>
        <button className="btn btn-primary" onClick={() => report.submit(form, hasIncident)} disabled={report.status === 'saving' || !form.signOff.supervisorName.trim()}>
          Submit &amp; sign off
        </button>
      </div>
      {!form.signOff.supervisorName.trim() && <p className="hint">Add the Kitchen Supervisor's name in Sign-off before submitting.</p>}
    </div>
  );
}

