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

  for (const seedFile of ['seed_library.sql', 'seed_qc_system.sql', 'seed_opening_closing.sql', 'seed_food_safety.sql', 'seed_front_of_house.sql']) {
    const seedPath = path.join(root, seedFile);
    if (fs.existsSync(seedPath)) {
      console.log(`Applying ${seedFile} ...`);
      await pool.query(fs.readFileSync(seedPath, 'utf8'));
    }
  }

  console.log('Done.');
  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
