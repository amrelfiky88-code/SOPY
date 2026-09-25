import { reportTitle, FORM_LABELS } from '../i18n/formLabels.js';

// Turns GET /submissions/:id/report into a list of layout-free blocks.
// Both the on-screen report and the PDF are drawn from the same blocks,
// so what someone shares is exactly what they looked at.

// Last-resort label for a form_data key nobody wrote a label for:
// "foodSafety" → "Food safety", "3" → "#4" (row/task indexes are 0-based).
export function humanizeKey(key) {
  if (/^\d+$/.test(key)) return `#${Number(key) + 1}`;
  const words = String(key)
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const isEmpty = (v) => v === undefined || v === null || (typeof v === 'string' && !v.trim());

// t() returns the key itself when no dictionary has it.
const lookup = (t, key) => {
  const out = t(key);
  return out === key ? null : out;
};

// Pinned-report labels come from i18n/formLabels.js, keyed by form_data
// path: the specific path first, then a column shared by every row of the
// table (path with "*"), then a column name every form shares.
function labeler(t, kind) {
  return (paths, key) => {
    if (kind) {
      for (const path of paths) {
        const hit = lookup(t, `f.${kind}.${path}`);
        if (hit) return hit;
      }
    }
    return lookup(t, `f.col.${key}`) || humanizeKey(key);
  };
}

function formatValue(v, t) {
  if (typeof v === 'boolean') return v ? t('common.yes') : t('common.no');
  const text = String(v).trim();
  // Dropdown choices are saved as codes ("needs_improvement").
  return (/^[a-z_]+$/.test(text) && lookup(t, `f.v.${text}`)) || text;
}

// Reports saved before _fieldOrder existed come back in jsonb's key
// order; these put them back in a sensible one: who/when first, the
// sign-off last, readings as Start → Mid → End.
const TOP_LEVEL_ORDER = ['shift', 'visit', 'details', 'header'];
const TOP_LEVEL_LAST = ['notes', 'signOff'];
const SUB_ORDER = ['s', 'm', 'e', 'status', 'note'];

function fallbackRank(key, depth) {
  if (depth === 0) {
    const first = TOP_LEVEL_ORDER.indexOf(key);
    if (first >= 0) return first;
    const last = TOP_LEVEL_LAST.indexOf(key);
    return last >= 0 ? 1000 + last : 100;
  }
  const i = SUB_ORDER.indexOf(key);
  return i >= 0 ? i : 100;
}

// The form's own field order, from its label list (formLabels.js is
// written in form order). The saved _fieldOrder records the order of the
// data in memory, which after resuming a draft is jsonb's shuffled key
// order, and for table rows is whatever order people happened to fill
// them in — so it only decides fields the form doesn't define.
function formOrder(kind) {
  const prefix = `f.${kind}.`;
  const map = new Map();
  if (!kind) return map;
  Object.keys(FORM_LABELS.en).forEach((key, i) => {
    if (key.startsWith(prefix)) map.set(key.slice(prefix.length), i);
  });
  return map;
}

function orderedEntries(obj, prefix, order) {
  const depth = prefix ? prefix.split('.').length - 1 : 0;
  const rank = (k, i) => {
    const path = prefix + k;
    if (order.form.has(path)) return order.form.get(path);
    if (SUB_ORDER.includes(k)) return 500_000 + SUB_ORDER.indexOf(k); // Start → Mid → End
    if (order.saved.has(path)) return 1_000_000 + order.saved.get(path);
    return 2_000_000 + fallbackRank(k, depth) * 100 + i;
  };
  return Object.entries(obj)
    .filter(([k]) => k !== '_fieldOrder')
    .map(([k, v], i) => [k, v, rank(k, i)])
    .sort((a, b) => a[2] - b[2])
    .map(([k, v]) => [k, v]);
}

// One line summarising a nested object: "Start: 3 · Mid: 4 · End: 5".
// labelPaths(k) lists the label keys to try for sub-key k.
function inline(obj, t, prefix, order, label, labelPaths) {
  if (!obj || typeof obj !== 'object') return isEmpty(obj) ? '' : formatValue(obj, t);
  return orderedEntries(obj, prefix, order)
    .filter(([, v]) => !isEmpty(v) && typeof v !== 'object')
    .map(([k, v]) => `${label(labelPaths(k), k)}: ${formatValue(v, t)}`)
    .join(' · ');
}

// Pinned reports store free-form form_data; lay each top-level section
// out as label/value rows, skipping anything left blank.
export function formDataSections(formData, t, kind) {
  const label = labeler(t, kind);
  const order = { form: formOrder(kind), saved: new Map((formData?._fieldOrder || []).map((path, i) => [path, i])) };
  const sections = [];
  for (const [key, value] of orderedEntries(formData || {}, '', order)) {
    if (isEmpty(value)) continue;
    const rows = [];
    if (Array.isArray(value)) {
      value.forEach((row, i) => {
        const text = inline(row, t, `${key}[].`, order, label, (k) => [`${key}[].${k}`]);
        if (text) rows.push({ label: `#${i + 1}`, value: text });
      });
    } else if (typeof value === 'object') {
      for (const [k, v] of orderedEntries(value, `${key}.`, order)) {
        if (isEmpty(v)) continue;
        const text = typeof v === 'object'
          ? inline(v, t, `${key}.${k}.`, order, label, (sub) => [`${key}.${k}.${sub}`, `${key}.*.${sub}`])
          : formatValue(v, t);
        if (text) rows.push({ label: label([`${key}.${k}`], k), value: text });
      }
    } else {
      rows.push({ label: label([key], key), value: formatValue(value, t) });
    }
    if (rows.length) sections.push({ title: label([key], key), rows });
  }
  return sections;
}

export const RAG_TONE = { green: 'good', amber: 'warn', red: 'bad' };

export function formatDateTime(value, lang) {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat(lang || undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  } catch {
    return new Date(value).toLocaleString();
  }
}

/**
 * @returns {{ title: string, fileName: string, shareText: string, blocks: object[] }}
 */
export function buildReportModel(report, t, lang) {
  const { submission: s, items = [], scorecard } = report;
  const title = reportTitle(t, s.kind, s.template_name);
  const when = s.submitted_at || s.started_at;
  const blocks = [];

  blocks.push({ type: 'title', text: title, subtitle: s.restaurant_name });
  blocks.push({
    type: 'meta',
    rows: [
      [t('report.store'), [s.branch_name, s.branch_city].filter(Boolean).join(', ')],
      [t('report.submittedBy'), s.submitted_by_name],
      [s.submitted_at ? t('report.submittedAt') : t('report.startedAt'), formatDateTime(when, lang)],
      s.gps_lat && s.gps_lng ? [t('report.location'), `${Number(s.gps_lat).toFixed(5)}, ${Number(s.gps_lng).toFixed(5)}`] : null,
    ].filter(Boolean),
  });
  if (s.has_incident) blocks.push({ type: 'alert', text: t('report.incident') });

  if (scorecard && scorecard.totalScored) {
    blocks.push({
      type: 'score',
      value: `${scorecard.percentage}%`,
      detail: t('report.checkpointsCompliant', { n: scorecard.totalCompliant, total: scorecard.totalScored }),
      badge: t(`report.rag.${scorecard.ragStatus}`),
      tone: RAG_TONE[scorecard.ragStatus],
      extra: scorecard.criticalFails ? t('report.criticalFails', { n: scorecard.criticalFails }) : '',
    });
    if (scorecard.sections.length > 1) {
      blocks.push({ type: 'heading', text: t('report.sections') });
      scorecard.sections.forEach((sec) => {
        blocks.push({
          type: 'row',
          label: sec.category,
          value: sec.total ? `${sec.compliant} / ${sec.total} (${sec.percentage}%)` : '—',
          tone: sec.criticalFails ? 'bad' : undefined,
        });
      });
    }
  }

  if (items.length) {
    blocks.push({ type: 'heading', text: t('report.checkpoints') });
    let lastCategory = null;
    items.forEach((item) => {
      if (item.category && item.category !== lastCategory) {
        blocks.push({ type: 'subheading', text: item.category });
        lastCategory = item.category;
      }
      const answered = item.is_compliant !== null && item.is_compliant !== undefined;
      blocks.push({
        type: 'item',
        text: item.text,
        critical: item.is_critical,
        result: answered ? (item.is_compliant ? t('report.compliant') : t('report.notCompliant')) : (item.value_text ? '' : t('report.notAnswered')),
        tone: answered ? (item.is_compliant ? 'good' : 'bad') : 'muted',
        note: item.value_text ? `${answered ? t('report.reading') : t('report.finding')}: ${item.value_text}` : '',
        photo: item.photo_path || null,
      });
    });
  }

  const sections = formDataSections(s.form_data, t, s.kind);
  if (sections.length) {
    blocks.push({ type: 'heading', text: t('report.details') });
    sections.forEach((sec) => {
      blocks.push({ type: 'subheading', text: sec.title });
      sec.rows.forEach((row) => blocks.push({ type: 'row', label: row.label, value: row.value }));
    });
  }

  const dateForName = when ? new Date(when).toISOString().slice(0, 10) : '';
  const fileName = `${title} - ${s.branch_name}${dateForName ? ` - ${dateForName}` : ''}.pdf`.replace(/[\\/:*?"<>|]/g, '-');
  const score = scorecard && scorecard.totalScored ? ` · ${t('report.score')} ${scorecard.percentage}%` : '';
  const shareText = `${title} — ${s.branch_name}, ${formatDateTime(when, lang)}${score}`;

  return { title, fileName, shareText, blocks };
}
