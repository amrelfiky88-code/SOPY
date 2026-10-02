// How the checkpoint library is grouped into the SOPs and audits people
// browse and run. Shared by the server ("Run now" builds a checklist from
// one group) and the web app (the Library tab lists the groups), so the
// two always agree on what a group holds.
//
// Library categories read "<group> — <section>", e.g. "SOP 1: Opening —
// 2. Kitchen Equipment Startup" or "Daily QC — B. Food Safety &
// Temperature Control". The starter HACCP / ISO 22000 / local-code items
// have bare categories ("hygiene"), so each of those standards is one group.
// Always decided from the English category (category_en once translated).

const SECTIONED = new Set(['SOP', 'INTERNAL_QC', 'NFSA', 'C_STORE']);
const SEP = ' — ';

export function libraryGroupKey(item) {
  const category = item.category_en || item.category || '';
  if (SECTIONED.has(item.standard) && category.includes(SEP)) return category.split(SEP)[0];
  return item.standard;
}

// The section part of an item's category, for headings inside a group.
// `category` here may be a translation, so split whatever is shown.
export function librarySection(item) {
  const category = item.category || '';
  const i = category.indexOf(SEP);
  return i === -1 ? category : category.slice(i + SEP.length);
}

// How often a group is meant to be run, from its name.
export function libraryGroupFrequency(key) {
  // A self-inspection before an NFSA visit: monthly, like the QC audits.
  if (/^NFSA/.test(key)) return 'monthly';
  if (/^Weekly/i.test(key)) return 'weekly';
  if (/^Monthly/i.test(key)) return 'monthly';
  if (/^Quarterly/i.test(key)) return 'quarterly';
  return 'daily';
}

// Library order: the client's own QC audits first, then the NFSA site
// visit, SOPs in number order, the starter standards and the
// convenience-store section.
const STANDARD_ORDER = ['INTERNAL_QC', 'NFSA', 'SOP', 'HACCP', 'ISO_22000', 'LOCAL_CODE', 'C_STORE', 'CUSTOM'];
const QC_ORDER = ['Daily QC', 'Weekly Audit', 'Monthly Audit', 'Quarterly Audit'];

function sortKey(group) {
  const std = STANDARD_ORDER.indexOf(group.standard);
  const qc = QC_ORDER.indexOf(group.key);
  const sop = /^SOP (\d+):/.exec(group.key);
  return [std === -1 ? 99 : std, qc === -1 ? 99 : qc, sop ? Number(sop[1]) : 999, group.key];
}

// items → [{ key, standard, items }], in library order, keeping each
// group's items in the order they came in.
export function groupLibrary(items) {
  const groups = new Map();
  for (const item of items) {
    const key = libraryGroupKey(item);
    if (!groups.has(key)) groups.set(key, { key, standard: item.standard, items: [] });
    groups.get(key).items.push(item);
  }
  return [...groups.values()].sort((a, b) => {
    const ka = sortKey(a), kb = sortKey(b);
    for (let i = 0; i < ka.length; i += 1) {
      if (ka[i] < kb[i]) return -1;
      if (ka[i] > kb[i]) return 1;
    }
    return 0;
  });
}
