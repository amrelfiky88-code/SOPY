import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../db');

async function run() {
  const schema = fs.readFileSync(path.join(root, 'schema.sql'), 'utf8');
  console.log('Applying schema.sql ...');
  await pool.query(schema);

  for (const seedFile of ['seed_library.sql', 'seed_qc_system.sql', 'seed_opening_closing.sql', 'seed_food_safety.sql', 'seed_front_of_house.sql', 'seed_cash_handling.sql', 'seed_health_inspection.sql', 'seed_additional_sops.sql', 'seed_health_code_reference.sql']) {
    const seedPath = path.join(root, seedFile);
    if (fs.existsSync(seedPath)) {
      console.log(`Applying ${seedFile} ...`);
      await pool.query(fs.readFileSync(seedPath, 'utf8'));
    }
  }

  // Photo evidence is now mandatory for every checkpoint (not just the
  // subset the source documents originally flagged) — the checklist-run
  // page already enforces this regardless of this column, but keeping
  // the column itself universally true too so the library/builder UI
  // ("photo required" pill) stays consistent with actual behavior.
  console.log('Setting requires_photo = true on all checklist items ...');
  await pool.query('UPDATE checklist_items SET requires_photo = true WHERE requires_photo IS DISTINCT FROM true');

  console.log('Done.');
  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
