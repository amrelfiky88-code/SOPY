// Turns GET /submissions/:id/report into a list of layout-free blocks.
// Both the on-screen report and the PDF are drawn from the same blocks,
// so what someone shares is exactly what they looked at.

const SHORT_KEYS = { s: 'Start', m: 'Mid', e: 'End' };

// "foodSafety" → "Food safety", "3" → "#4" (row/task indexes are 0-based).
export function humanizeKey(key) {
  if (SHORT_KEYS[key]) return SHORT_KEYS[key];
  if (/^\d+$/.test(key)) return `#${Number(key) + 1}`;
  const words = String(key)
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const isEmpty = (v) => v === undefined || v === null || (typeof v === 'string' && !v.trim());

function formatValue(v, t) {
  if (typeof v === 'boolean') return v ? t('common.yes') : t('common.no');
  return String(v).trim();
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

// Object.entries in the order the form had them (see useOpsReport's
// withFieldOrder), falling back to the ranks above.
function orderedEntries(obj, prefix, order) {
  const depth = prefix ? prefix.split('.').length - 1 : 0;
  return Object.entries(obj)
    .filter(([k]) => k !== '_fieldOrder')
    .map(([k, v], i) => [k, v, order.get(prefix + k) ?? 10_000 + fallbackRank(k, depth) * 100 + i])
    .sort((a, b) => a[2] - b[2])
    .map(([k, v]) => [k, v]);
}

// One line summarising a nested object: "Start: 3 · Mid: 4 · End: 5".
function inline(obj, t, prefix, order) {
  if (!obj || typeof obj !== 'object') return isEmpty(obj) ? '' : formatValue(obj, t);
  return orderedEntries(obj, prefix, order)
    .filter(([, v]) => !isEmpty(v) && typeof v !== 'object')
    .map(([k, v]) => `${humanizeKey(k)}: ${formatValue(v, t)}`)
    .join(' · ');
}

// Pinned reports store free-form form_data; lay each top-level section
// out as label/value rows, skipping anything left blank.
export function formDataSections(formData, t) {
  const order = new Map((formData?._fieldOrder || []).map((path, i) => [path, i]));
  const sections = [];
  for (const [key, value] of orderedEntries(formData || {}, '', order)) {
    if (isEmpty(value)) continue;
    const rows = [];
    if (Array.isArray(value)) {
      value.forEach((row, i) => {
        const text = inline(row, t, `${key}[].`, order);
        if (text) rows.push({ label: `#${i + 1}`, value: text });
      });
    } else if (typeof value === 'object') {
      for (const [k, v] of orderedEntries(value, `${key}.`, order)) {
        if (isEmpty(v)) continue;
        const text = typeof v === 'object' ? inline(v, t, `${key}.${k}.`, order) : formatValue(v, t);
        if (text) rows.push({ label: humanizeKey(k), value: text });
      }
    } else {
      rows.push({ label: humanizeKey(key), value: formatValue(value, t) });
    }
    if (rows.length) sections.push({ title: humanizeKey(key), rows });
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
  const when = s.submitted_at || s.started_at;
  const blocks = [];

  blocks.push({ type: 'title', text: s.template_name, subtitle: s.restaurant_name });
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

  const sections = formDataSections(s.form_data, t);
  if (sections.length) {
    blocks.push({ type: 'heading', text: t('report.details') });
    sections.forEach((sec) => {
      blocks.push({ type: 'subheading', text: sec.title });
      sec.rows.forEach((row) => blocks.push({ type: 'row', label: row.label, value: row.value }));
    });
  }

  const dateForName = when ? new Date(when).toISOString().slice(0, 10) : '';
  const fileName = `${s.template_name} - ${s.branch_name}${dateForName ? ` - ${dateForName}` : ''}.pdf`.replace(/[\\/:*?"<>|]/g, '-');
  const score = scorecard && scorecard.totalScored ? ` · ${t('report.score')} ${scorecard.percentage}%` : '';
  const shareText = `${s.template_name} — ${s.branch_name}, ${formatDateTime(when, lang)}${score}`;

  return { title: s.template_name, fileName, shareText, blocks };
}
