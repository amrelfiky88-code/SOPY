import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbRoot = path.resolve(__dirname, '../db');

// Wipes and rebuilds the test database from scratch. Safe to call between
// test files since each one gets a clean slate — tests should not depend
// on ordering or on data left behind by another file.
export async function resetTestDb() {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await pool.query(fs.readFileSync(path.join(dbRoot, 'schema.sql'), 'utf8'));
  await pool.query(fs.readFileSync(path.join(dbRoot, 'seed_library.sql'), 'utf8'));
  await pool.query(fs.readFileSync(path.join(dbRoot, 'seed_qc_system.sql'), 'utf8'));
  await pool.query(fs.readFileSync(path.join(dbRoot, 'seed_opening_closing.sql'), 'utf8'));
  await pool.query(fs.readFileSync(path.join(dbRoot, 'seed_food_safety.sql'), 'utf8'));
  await pool.query(fs.readFileSync(path.join(dbRoot, 'seed_front_of_house.sql'), 'utf8'));
}

export async function closeDb() {
  await pool.end();
}
