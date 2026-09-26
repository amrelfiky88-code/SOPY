// The safe ranges printed on the Kitchen and Bar daily reports, as numbers,
// so a reading outside its range is caught on the form (highlighted, and
// the report flagged as an incident) and counted on the KPI dashboard.
// Shared by the forms and the server; the printed wording stays in
// web/src/i18n/formLabels.js under range.*.

// °C. min/max are inclusive; a missing side is unbounded.
export const TEMPERATURE_RANGES = {
  kitchen_daily: {
    fridge: { min: 1, max: 5 },
    freezer: { max: -18 },
    display: { min: 3, max: 7 },
    fryerOil: { min: 170, max: 180 },
    grill: { min: 200, max: 230 },
    hotHolding: { min: 63 },
    steamTable: { min: 74 },
  },
  bar_daily: {
    display: { min: 2, max: 7 },
    fridge: { min: 1, max: 5 },
    frozenDessert: { max: -14 },
    fountain: { min: 18 },
    coffee: { min: 90, max: 95 },
    boiler: { min: 95, max: 100 },
  },
};

// Each report's equipment rows: the form_data key and which range applies.
// midNA: no mid-shift reading for that unit.
export const TEMPERATURE_ROWS = {
  kitchen_daily: [
    { key: 'fridge1', range: 'fridge' },
    { key: 'fridge2', range: 'fridge' },
    { key: 'freezer', range: 'freezer' },
    { key: 'prepFridge', range: 'fridge' },
    { key: 'displayFridge', range: 'display' },
    { key: 'fryerOil', range: 'fryerOil', midNA: true },
    { key: 'grill', range: 'grill', midNA: true },
    { key: 'hotHolding', range: 'hotHolding' },
    { key: 'steamTable', range: 'steamTable' },
  ],
  bar_daily: [
    { key: 'displayFridge', range: 'display' },
    { key: 'backBar', range: 'fridge' },
    { key: 'juiceFridge', range: 'fridge' },
    { key: 'frozenDessert', range: 'frozenDessert' },
    { key: 'fountain', range: 'fountain' },
    { key: 'coffeeMachine', range: 'coffee' },
    { key: 'boiler', range: 'boiler' },
  ],
};

export const READING_FIELDS = ['s', 'm', 'e']; // start, mid, end of shift

// A reading as a number, or null when it's blank or not a number.
export function readingValue(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return null;
  const n = Number(String(raw).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function isOutOfRange(value, range) {
  if (value === null || !range) return false;
  return (range.min !== undefined && value < range.min) || (range.max !== undefined && value > range.max);
}

// Every reading outside its safe range in a report's temperatureLog:
// [{ key, field, value, range }].
export function temperatureDeviations(kind, temperatureLog) {
  const rows = TEMPERATURE_ROWS[kind];
  const ranges = TEMPERATURE_RANGES[kind];
  if (!rows || !temperatureLog || typeof temperatureLog !== 'object') return [];
  const out = [];
  for (const row of rows) {
    const readings = temperatureLog[row.key];
    if (!readings || typeof readings !== 'object') continue;
    for (const field of READING_FIELDS) {
      if (field === 'm' && row.midNA) continue;
      const value = readingValue(readings[field]);
      if (isOutOfRange(value, ranges[row.range])) out.push({ key: row.key, field, value, range: row.range });
    }
  }
  return out;
}
