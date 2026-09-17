import { query } from '../db.js';
import ar from '../../db/translations/ar.js';
import fr from '../../db/translations/fr.js';

const BUNDLES = { ar, fr };

// Upserts the content dictionaries into content_translations. Kept
// separate from the seed SQL files because these are plain JS maps —
// Arabic and French are full of apostrophes and quotes that are a
// nuisance to escape safely in hand-written SQL.
//
// Entries already marked 'reviewed' in the database are left alone, so a
// human correction is never clobbered by a re-run of the machine set.
export async function loadTranslations() {
  let written = 0;
  for (const [lang, bundle] of Object.entries(BUNDLES)) {
    const entries = Object.entries(bundle).filter(([source, translated]) => source && translated);
    if (!entries.length) continue;

    const sources = entries.map(([s]) => s);
    const translated = entries.map(([, v]) => v);

    const { rowCount } = await query(
      `INSERT INTO content_translations (lang, source_text, translated, source)
       SELECT $1, s, t, 'machine'
       FROM unnest($2::text[], $3::text[]) AS x(s, t)
       ON CONFLICT (lang, source_text) DO UPDATE
         SET translated = EXCLUDED.translated
         WHERE content_translations.source <> 'reviewed'`,
      [lang, sources, translated]
    );
    written += rowCount;
  }
  return written;
}
