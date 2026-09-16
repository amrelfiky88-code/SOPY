import React, { useState } from 'react';
import { useOpsReport } from './useOpsReport.js';
import { Section, TemperatureLogTable, OpeningClosingChecklist, FixedRowDataTable, FixedRowStatusTable, LabeledInput, LabeledSelect, LabeledTextarea } from './OpsFormParts.jsx';

const TITLE = 'Bar & Beverage Daily Operation Report';
const KIND = 'bar_daily';

const TEMP_ROWS = [
  { key: 'displayFridge', label: 'Beverage Display Fridge', safeRange: '2°C – 7°C' },
  { key: 'backBar', label: 'Back-Bar Refrigerator', safeRange: '1°C – 5°C' },
  { key: 'juiceFridge', label: 'Juice / Ingredient Fridge', safeRange: '1°C – 5°C' },
  { key: 'frozenDessert', label: 'Frozen Dessert Unit / Ice Cream', safeRange: 'Below -14°C' },
  { key: 'fountain', label: 'Fountain Machine (ambient)', safeRange: 'Ambient (18°C+)' },
  { key: 'coffeeMachine', label: 'Coffee Machine (boiler temp)', safeRange: '90°C – 95°C' },
  { key: 'boiler', label: 'Hot Water Boiler / Urn', safeRange: '95°C – 100°C' },
];

const STOCK_ITEMS = [
  'Bottled Water (500ml)', 'Bottled Water (1L)', 'Cola (can/bottle)', 'Lemon-Lime Soda',
  'Orange Juice (carton)', 'Apple Juice (carton)', 'Fresh Orange Juice (L)', 'Mango Juice (L)',
  'Milk (full cream)', 'Milk (skimmed)', 'Espresso Beans (kg)', 'Filter Coffee (kg)',
  'Tea Bags (assorted)', 'Sugar / Sweetener (kg)', 'Chocolate Powder (kg)', 'Cups (hot — S/M/L)', 'Cups (cold — S/M/L)',
].map((label, i) => ({ key: `stock${i}`, label }));

const STOCK_COLUMNS = [
  { key: 'opening', label: 'Opening', type: 'number' },
  { key: 'received', label: 'Received', type: 'number' },
  { key: 'sold', label: 'Sold / Used', type: 'number' },
  { key: 'waste', label: 'Waste / Loss', type: 'number' },
  { key: 'closing', label: 'Closing', type: 'number' },
];

const SALES_ROWS = [
  { key: 'hot', label: 'Hot Beverages (Coffee / Tea)' },
  { key: 'coldSoft', label: 'Cold Soft Drinks' },
  { key: 'juices', label: 'Fresh Juices & Smoothies' },
  { key: 'bottled', label: 'Bottled Beverages' },
  { key: 'specialty', label: 'Specialty Drinks / Promotions' },
  { key: 'addons', label: 'Add-ons (extra shots, syrups)' },
];
const SALES_COLUMNS = [
  { key: 'target', label: 'Target (EGP)', type: 'number' },
  { key: 'actual', label: 'Actual (EGP)', type: 'number' },
  { key: 'variance', label: 'Variance (EGP)', type: 'number' },
  { key: 'variancePct', label: 'Variance %', type: 'number' },
];

const CLEANING_ROWS = [
  { key: 'espresso', label: 'Espresso Machine — backflush & wipe', na: ['mid'] },
  { key: 'steamWand', label: 'Steam wand — purge & wipe after each use', na: ['start'] },
  { key: 'grinder', label: 'Coffee grinder — brush & wipe', na: ['start', 'mid'] },
  { key: 'blenderRinse', label: 'Blender / Juicer — rinse between orders' },
  { key: 'blenderSanitize', label: 'Blender / Juicer — full disassembly & sanitize', na: ['start', 'mid'] },
  { key: 'iceMachine', label: 'Ice machine bin — sanitize & air dry', na: ['mid'] },
  { key: 'counter', label: 'Bar counter & drip trays' },
  { key: 'fountainNozzles', label: 'Fountain machine nozzles — soak & rinse', na: ['mid'] },
  { key: 'fridgeShelves', label: 'Refrigerator shelves — wipe', na: ['mid'] },
  { key: 'glassware', label: 'Glassware & cup storage — wipe clean', na: ['mid'] },
  { key: 'floor', label: 'Bar floor — sweep & mop', na: ['start'] },
];
const CLEANING_COLUMNS = [
  { key: 'start', label: 'Shift start', type: 'checkbox' },
  { key: 'mid', label: 'Mid-shift', type: 'checkbox' },
  { key: 'endBy', label: 'End of shift — by' },
];

const COMPLIANCE_ROWS = [
  'All beverage ingredients labeled with date received and use-by date',
  'Allergen information board updated and visible to all bar staff',
  'Staff informed of any new allergen-containing products or changes',
  'Customer allergen inquiries logged (if any)',
  'All garnish ingredients prepared fresh today (no carry-over garnishes)',
  'Expired or near-expiry products removed from service',
  'All beverages prepared per standardized recipe card (no free-pouring)',
  'Correct cups, sizes, and lids used for each beverage category',
  'Temperature complaints or quality rejections received',
].map((label, i) => ({ key: `c${i}`, label }));
const COMPLIANCE_STATUS_OPTIONS = [{ value: 'ok', label: 'OK' }, { value: 'action_needed', label: 'Action needed' }];

const OPENING_TASKS = [
  'Bar area fully sanitized before service',
  'All equipment temperature checks logged',
  'Ice machine sanitized; ice bin filled',
  'Garnish prep completed (fresh only)',
  'Glassware & cups stocked & inspected',
  'Syrup & ingredient levels checked',
  'Bar stock par levels verified',
  'Team briefed on specials & out-of-stocks',
];
const CLOSING_TASKS = [
  'All perishable garnishes disposed of & fridged items covered',
  'Juice machines emptied, disassembled & sanitized',
  'Blenders & all equipment cleaned, dried & stored',
  'Fountain nozzles removed & soaked in sanitizer',
  'Coffee machine fully cleaned & back-flushed',
  'Ice bin drained, sanitized & left to air dry',
  'End-of-shift stock count completed & logged',
  'Closing checklist signed & submitted to supervisor',
];

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
  const report = useOpsReport({ kind: KIND, title: TITLE });
  const [form, setForm] = useState(emptyState());

  const patch = (section, value) => setForm((f) => ({ ...f, [section]: { ...f[section], ...value } }));
  const patchNested = (section, key, value) => setForm((f) => ({ ...f, [section]: { ...f[section], [key]: value } }));
  const setFixedRow = (section) => (key, field, value) =>
    setForm((f) => ({ ...f, [section]: { ...f[section], [key]: { ...f[section][key], [field]: value } } }));
  const toggleTask = (which, i) =>
    setForm((f) => ({ ...f, checklist: { ...f.checklist, [which]: { ...f.checklist[which], [i]: !f.checklist[which]?.[i] } } }));

  const hasIncident = !!(form.notes.staffIssues?.trim() || form.tempDeviation.found || form.tempDeviation.faultReported);

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
    return <div className="card empty-state"><p style={{ margin: 0 }}>Bar & Beverage Daily Report submitted (BDR-{form.shift.reportNo || '—'}). Retain per policy for 90 days.</p></div>;
  }

  return (
    <div>
      <h2>{TITLE}</h2>
      {report.error && <div className="error-banner">{report.error}</div>}

      <Section title="A. Shift identification">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <LabeledInput label="Report No. (BDR-)" value={form.shift.reportNo} onChange={(v) => patchNested('shift', 'reportNo', v)} />
          <LabeledSelect label="Shift" value={form.shift.shiftType} onChange={(v) => patchNested('shift', 'shiftType', v)}
            options={[['morning', 'Morning (Open)'], ['afternoon', 'Afternoon'], ['evening', 'Evening (Close)']]} />
          <LabeledInput label="Day of week" value={form.shift.dayOfWeek} onChange={(v) => patchNested('shift', 'dayOfWeek', v)} />
          <LabeledSelect label="Report type" value={form.shift.reportType} onChange={(v) => patchNested('shift', 'reportType', v)}
            options={[['opening', 'Opening'], ['mid', 'Mid'], ['closing', 'Closing']]} />
          <LabeledInput label="Bar Manager / Lead" value={form.shift.barManager} onChange={(v) => patchNested('shift', 'barManager', v)} />
          <LabeledInput label="Head Bartender" value={form.shift.headBartender} onChange={(v) => patchNested('shift', 'headBartender', v)} />
          <LabeledInput label="Shift start (hrs)" type="time" value={form.shift.startTime} onChange={(v) => patchNested('shift', 'startTime', v)} />
          <LabeledInput label="Shift end (hrs)" type="time" value={form.shift.endTime} onChange={(v) => patchNested('shift', 'endTime', v)} />
          <LabeledInput label="Bartenders on duty" type="number" value={form.shift.bartenders} onChange={(v) => patchNested('shift', 'bartenders', v)} />
          <LabeledInput label="Support staff on duty" type="number" value={form.shift.support} onChange={(v) => patchNested('shift', 'support', v)} />
        </div>
      </Section>

      <Section title="B. Equipment & temperature monitoring">
        <TemperatureLogTable rows={TEMP_ROWS} values={form.temperatureLog} onChange={setFixedRow('temperatureLog')} />
        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 400 }}>
            <input type="checkbox" checked={form.tempDeviation.found} onChange={(e) => patch('tempDeviation', { found: e.target.checked })} />
            Temperature deviation noted
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 400 }}>
            <input type="checkbox" checked={form.tempDeviation.faultReported} onChange={(e) => patch('tempDeviation', { faultReported: e.target.checked })} />
            Equipment fault reported
          </label>
          <input placeholder="Action taken" value={form.tempDeviation.actionTaken} onChange={(e) => patch('tempDeviation', { actionTaken: e.target.value })} />
          <input placeholder="Manager / maintenance notified" value={form.tempDeviation.notified} onChange={(e) => patch('tempDeviation', { notified: e.target.value })} />
        </div>
      </Section>

      <Section title="C. Beverage stock & inventory log">
        <div style={{ overflowX: 'auto' }}>
          <FixedRowDataTable rows={STOCK_ITEMS} columns={STOCK_COLUMNS} values={form.stockLog} onChange={setFixedRow('stockLog')} />
        </div>
        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <input placeholder="Items below par level" value={form.stockNotes.belowPar} onChange={(e) => patch('stockNotes', { belowPar: e.target.value })} />
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 400 }}>
            <input type="checkbox" checked={form.stockNotes.reorderPlaced} onChange={(e) => patch('stockNotes', { reorderPlaced: e.target.checked })} />
            Reorder placed
          </label>
          <input placeholder="Reorder details" value={form.stockNotes.reorderDetails} onChange={(e) => patch('stockNotes', { reorderDetails: e.target.value })} />
          <input placeholder="Total beverage waste value" type="number" value={form.stockNotes.wasteValue} onChange={(e) => patch('stockNotes', { wasteValue: e.target.value })} />
          <select value={form.stockNotes.wasteReason} onChange={(e) => patch('stockNotes', { wasteReason: e.target.value })}>
            <option value="expired">Expired</option>
            <option value="spillage">Spillage</option>
            <option value="quality">Quality</option>
          </select>
        </div>
      </Section>

      <Section title="D. Beverage sales performance">
        <FixedRowDataTable rows={SALES_ROWS} columns={SALES_COLUMNS} values={form.salesPerformance} onChange={setFixedRow('salesPerformance')} />
        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <input placeholder="Best-selling item today" value={form.salesNotes.bestSeller} onChange={(e) => patch('salesNotes', { bestSeller: e.target.value })} />
          <input placeholder="Slowest-moving item" value={form.salesNotes.slowest} onChange={(e) => patch('salesNotes', { slowest: e.target.value })} />
          <input placeholder="Promotion / offer active" value={form.salesNotes.promoActive} onChange={(e) => patch('salesNotes', { promoActive: e.target.value })} />
          <select value={form.salesNotes.promoPerformance} onChange={(e) => patch('salesNotes', { promoPerformance: e.target.value })}>
            <option value="above">Above target</option>
            <option value="on_target">On target</option>
            <option value="below">Below target</option>
          </select>
        </div>
      </Section>

      <Section title="E. Equipment cleaning & sanitation log">
        <FixedRowDataTable rows={CLEANING_ROWS} columns={CLEANING_COLUMNS} values={form.cleaningLog} onChange={setFixedRow('cleaningLog')} />
      </Section>

      <Section title="F. Quality, allergen & compliance check">
        <FixedRowStatusTable rows={COMPLIANCE_ROWS} values={form.complianceCheck} onChange={setFixedRow('complianceCheck')} statusOptions={COMPLIANCE_STATUS_OPTIONS} />
      </Section>

      <Section title="G. Opening & closing checklist">
        <OpeningClosingChecklist opening={OPENING_TASKS} closing={CLOSING_TASKS} values={form.checklist} onToggle={toggleTask} />
      </Section>

      <Section title="H. Incidents, complaints & shift notes">
        <LabeledTextarea label="Customer complaints or quality issues received" value={form.notes.complaints} onChange={(v) => patchNested('notes', 'complaints', v)} />
        <LabeledTextarea label="Equipment faults / maintenance required" value={form.notes.equipmentFaults} onChange={(v) => patchNested('notes', 'equipmentFaults', v)} />
        <LabeledTextarea label="Out-of-stock or low-stock items" value={form.notes.lowStock} onChange={(v) => patchNested('notes', 'lowStock', v)} />
        <LabeledTextarea label="Staff issues or incidents during shift" value={form.notes.staffIssues} onChange={(v) => patchNested('notes', 'staffIssues', v)} />
        <LabeledTextarea label="General bar manager notes & recommendations" value={form.notes.managerNotes} onChange={(v) => patchNested('notes', 'managerNotes', v)} />
      </Section>

      <Section title="I. Sign-off & authorization">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <LabeledInput label="Bar Manager / Shift Lead name" value={form.signOff.barManagerName} onChange={(v) => patchNested('signOff', 'barManagerName', v)} />
          <LabeledInput label="Operations Manager name" value={form.signOff.opsManagerName} onChange={(v) => patchNested('signOff', 'opsManagerName', v)} />
        </div>
      </Section>

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-secondary" onClick={() => report.save(form, hasIncident)} disabled={report.status === 'saving'}>Save progress</button>
        <button className="btn btn-primary" onClick={() => report.submit(form, hasIncident)} disabled={report.status === 'saving' || !form.signOff.barManagerName.trim()}>
          Submit &amp; sign off
        </button>
      </div>
      {!form.signOff.barManagerName.trim() && <p className="hint">Add the Bar Manager's name in Sign-off before submitting.</p>}
    </div>
  );
}

