import { api } from '../../api.js';
import { groupLibrary, libraryGroupFrequency } from '../../../../shared/libraryGroups.js';

// The whole checkpoint library, grouped into SOPs and audits, shared by the
// Library list and an SOP's page so opening one doesn't fetch ~200KB again.
// Kept per language: the server translates the wording.
let cache = { lang: null, promise: null };

export function loadLibrary(lang) {
  if (cache.lang !== lang || !cache.promise) {
    cache = {
      lang,
      promise: api.get('/checklists/library').then(({ items }) => groupLibrary(items).map(describeGroup)),
    };
    cache.promise.catch(() => { cache = { lang: null, promise: null }; }); // try again next time
  }
  return cache.promise;
}

const SEP = ' — ';

// The short code shown above a group's name, from its English key.
function groupCode(key, standard) {
  const sop = /^SOP (\d+):/.exec(key);
  if (sop) return `SOP-${sop[1].padStart(2, '0')}`;
  const qc = { 'Daily QC': 'QC-D', 'Weekly Audit': 'QC-W', 'Monthly Audit': 'QC-M', 'Quarterly Audit': 'QC-Q' }[key];
  if (qc) return qc;
  if (key === 'Health Code Compliance') return 'HEALTH';
  return { HACCP: 'HACCP', ISO_22000: 'ISO 22000', LOCAL_CODE: 'LOCAL', C_STORE: 'C-STORE', CUSTOM: 'CUSTOM' }[standard] || standard;
}

// Library filter a group belongs to.
function groupFilter(key, standard) {
  if (standard === 'INTERNAL_QC') return 'qc';
  if (key === 'Health Code Compliance') return 'health';
  if (standard === 'SOP') return 'sop';
  if (standard === 'C_STORE') return 'cstore';
  if (standard === 'CUSTOM') return 'custom';
  return 'starter';
}

// SOP 12–20 and the convenience-store section were researched from public
// sources at the client's request; everything else came from their own
// documents (see the seed files' headers).
function isResearched(key, standard) {
  const sop = /^SOP (\d+):/.exec(key);
  return standard === 'C_STORE' || (!!sop && Number(sop[1]) >= 12);
}

function describeGroup(group) {
  const first = group.items[0];
  const shown = first.category || '';
  const sectioned = (first.category_en || first.category || '').includes(SEP);
  return {
    ...group,
    code: groupCode(group.key, group.standard),
    // The group's own name in the reader's language: the part of the
    // (translated) category before the section; starter sets use the
    // standard's name.
    title: sectioned && shown.includes(SEP) ? shown.split(SEP)[0] : null,
    filter: groupFilter(group.key, group.standard),
    researched: isResearched(group.key, group.standard),
    clientOwn: group.standard !== 'CUSTOM' && !isResearched(group.key, group.standard),
    frequency: libraryGroupFrequency(group.key),
    critical: group.items.filter((i) => i.is_critical).length,
  };
}

export function groupTitle(t, group) {
  return group.title || t(`std.${group.standard}`);
}
