import { query } from '../db.js';
import { DEFAULT_LANGUAGE } from '../../../shared/languages.js';

// Library content (checkpoint text, descriptions, category headings) is
// stored in English — that's the client's own transcribed SOP wording and
// stays the source of truth. Translations live alongside it in
// content_translations, keyed by the exact English string, and are
// applied on the way out.
//
// Anything without a translation falls through as English rather than
// rendering blank, so a partially-translated library degrades into a
// mixed-language list instead of a broken one.
export async function translateRows(rows, lang, fields) {
  if (!lang || lang === DEFAULT_LANGUAGE || !rows.length) return rows;

  const sources = new Set();
  for (const row of rows) {
    for (const f of fields) if (row[f]) sources.add(row[f]);
  }
  if (!sources.size) return rows;

  const { rows: translations } = await query(
    'SELECT source_text, translated FROM content_translations WHERE lang = $1 AND source_text = ANY($2::text[])',
    [lang, [...sources]]
  );
  if (!translations.length) return rows;

  // The English original stays alongside as <field>_en: screens show the
  // translation, but code that decides how to treat an item (say, the
  // "Consumer Behavior" observation points) must not depend on the language.
  const map = new Map(translations.map((t) => [t.source_text, t.translated]));
  return rows.map((row) => {
    const out = { ...row };
    for (const f of fields) {
      if (out[f] && map.has(out[f])) {
        out[`${f}_en`] = out[f];
        out[f] = map.get(out[f]);
      }
    }
    return out;
  });
}

// The language to render content in for this request: an explicit ?lang
// wins (so a manager can preview another language), otherwise the
// signed-in user's saved preference.
export async function requestLanguage(req) {
  if (req.query?.lang) return req.query.lang;
  if (!req.auth?.userId) return DEFAULT_LANGUAGE;
  const { rows } = await query('SELECT language FROM users WHERE id = $1', [req.auth.userId]);
  return rows[0]?.language || DEFAULT_LANGUAGE;
}
