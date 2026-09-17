// Coverage report for content_translations: which library strings still
// render in English. content_translations is keyed by exact source text,
// so a single stray character means a silent fallback — this makes that
// visible instead of leaving it to be spotted in the UI.
import { pool } from '../src/db.js';
import ar from '../db/translations/ar.js';
import fr from '../db/translations/fr.js';

const BUNDLES = { ar, fr };

const { rows } = await pool.query(
  `SELECT text, description, category, standard FROM checklist_items WHERE tenant_id IS NULL`
);

const buckets = {
  text: new Set(rows.map((r) => r.text).filter(Boolean)),
  description: new Set(rows.map((r) => r.description).filter(Boolean)),
  category: new Set(rows.map((r) => r.category).filter(Boolean)),
};

for (const [lang, bundle] of Object.entries(BUNDLES)) {
  console.log(`\n=== ${lang.toUpperCase()} ===`);
  for (const [field, values] of Object.entries(buckets)) {
    const missing = [...values].filter((v) => !bundle[v]);
    const pct = Math.round(((values.size - missing.length) / values.size) * 100);
    console.log(`${field.padEnd(12)}: ${values.size - missing.length}/${values.size} (${pct}%)`);
    if (process.argv.includes('--list')) missing.slice(0, 15).forEach((m) => console.log(`   missing: ${m.slice(0, 90)}`));
  }
  const unused = Object.keys(bundle).filter(
    (k) => !buckets.text.has(k) && !buckets.description.has(k) && !buckets.category.has(k)
  );
  if (unused.length) {
    console.log(`orphaned keys (no matching English row): ${unused.length}`);
    unused.slice(0, 10).forEach((u) => console.log(`   orphan: ${u.slice(0, 90)}`));
  }
}

await pool.end();
