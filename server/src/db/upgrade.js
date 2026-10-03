import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../db.js';

// Brings an existing database up to schema.sql, every time the server
// starts. New columns and tables used to need hand-run SQL on the live
// database ("Existing databases need …"); when that was missed, the code
// queried a column that wasn't there and, for example, every login failed
// with "Internal server error".
//
// schema.sql stays the one place the schema is written. Each statement is
// rewritten to be safe to repeat:
//   CREATE TABLE          → CREATE TABLE IF NOT EXISTS, plus
//                           ADD COLUMN IF NOT EXISTS for each of its columns
//   CREATE [UNIQUE] INDEX → … IF NOT EXISTS
//   ALTER TABLE … ADD COLUMN → ADD COLUMN IF NOT EXISTS
//   CREATE TYPE … AS ENUM → created if missing, else ADD VALUE IF NOT EXISTS
// and run on its own, so one that can't apply (a NOT NULL column without a
// default on a table that already has rows, say) is reported without
// stopping the rest. Nothing is ever dropped or changed.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA = path.resolve(__dirname, '../../db/schema.sql');

// Statements in schema.sql, comments removed. (It has no functions or
// dollar-quoted bodies, and no "--" or ";" inside string literals.)
export function schemaStatements(sql = fs.readFileSync(SCHEMA, 'utf8')) {
  return sql
    .split(/\r?\n/).map((line) => line.replace(/--.*$/, '')).join('\n')
    .split(';').map((s) => s.trim()).filter(Boolean);
}

// The comma-separated items of a CREATE TABLE body, ignoring commas inside
// parentheses (NUMERIC(10,2), REFERENCES t(id), CHECK (…)).
function topLevelItems(body) {
  const items = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < body.length; i++) {
    if (body[i] === '(') depth++;
    else if (body[i] === ')') depth--;
    else if (body[i] === ',' && depth === 0) { items.push(body.slice(start, i)); start = i + 1; }
  }
  items.push(body.slice(start));
  return items.map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

const TABLE_CONSTRAINT = /^(PRIMARY KEY|UNIQUE|CONSTRAINT|CHECK|FOREIGN KEY|EXCLUDE)\b/i;

// The repeat-safe statements for one schema.sql statement.
export function upgradeStatements(stmt) {
  let m = stmt.match(/^CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(\w+)\s*\(([\s\S]*)\)$/i);
  if (m) {
    const [, table, body] = m;
    return [
      `CREATE TABLE IF NOT EXISTS ${table} (${body})`,
      ...topLevelItems(body).filter((item) => !TABLE_CONSTRAINT.test(item))
        .map((column) => `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column}`),
    ];
  }
  m = stmt.match(/^CREATE TYPE\s+(\w+)\s+AS ENUM\s*\(([\s\S]*)\)$/i);
  if (m) {
    const [, type, values] = m;
    return [{ type, values: values.split(',').map((v) => v.trim()).filter(Boolean) }];
  }
  if (/^CREATE (UNIQUE )?INDEX\s+(?!IF NOT EXISTS)/i.test(stmt)) {
    return [stmt.replace(/^CREATE (UNIQUE )?INDEX\s+/i, (s) => `${s}IF NOT EXISTS `)];
  }
  if (/^ALTER TABLE\s+\w+\s+ADD COLUMN\s+(?!IF NOT EXISTS)/i.test(stmt)) {
    return [stmt.replace(/ADD COLUMN\s+/i, 'ADD COLUMN IF NOT EXISTS ')];
  }
  return [stmt]; // CREATE EXTENSION IF NOT EXISTS, and anything already repeat-safe
}

// What the database already has, read from the catalogue (no table locks).
async function currentSchema(db) {
  // One after another: they share one connection, and pg is dropping
  // support for overlapping queries on a client (it warned at every start).
  const tables = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema()");
  const columns = await db.query("SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = current_schema()");
  const indexes = await db.query('SELECT indexname FROM pg_indexes WHERE schemaname = current_schema()');
  const enums = await db.query('SELECT t.typname, e.enumlabel FROM pg_type t LEFT JOIN pg_enum e ON e.enumtypid = t.oid WHERE t.typtype = $1', ['e']);
  const enumLabels = new Map();
  for (const r of enums.rows) {
    if (!enumLabels.has(r.typname)) enumLabels.set(r.typname, new Set());
    if (r.enumlabel) enumLabels.get(r.typname).add(r.enumlabel);
  }
  return {
    tables: new Set(tables.rows.map((r) => r.table_name)),
    columns: new Set(columns.rows.map((r) => `${r.table_name}.${r.column_name}`)),
    indexes: new Set(indexes.rows.map((r) => r.indexname)),
    enumLabels,
  };
}

// Whether a step is already in place. Only missing things are run: even
// ADD COLUMN IF NOT EXISTS for a column that's there takes an exclusive
// lock on the table first, so on a busy database every start-up queued
// behind running queries, and every later query queued behind it.
function alreadyThere(step, have) {
  let m = step.match(/^CREATE TABLE IF NOT EXISTS (\w+)/i);
  if (m) return have.tables.has(m[1]);
  m = step.match(/^ALTER TABLE (\w+) ADD COLUMN IF NOT EXISTS (\w+)/i);
  if (m) return have.columns.has(`${m[1]}.${m[2]}`);
  m = step.match(/^CREATE (?:UNIQUE )?INDEX IF NOT EXISTS (\w+)/i);
  if (m) return have.indexes.has(m[1]);
  return false; // CREATE EXTENSION IF NOT EXISTS: cheap, and no table lock
}

export async function upgradeSchema({ db = pool, log = console } = {}) {
  const failed = [];
  let applied = 0;
  // One connection, so the lock timeout holds for every statement: a change
  // that does need a lock gives up after 10s (logged) rather than hanging.
  const client = db.connect ? await db.connect() : db;
  try {
    await client.query("SET lock_timeout = '10s'");
    const have = await currentSchema(client);
    for (const stmt of schemaStatements()) {
      for (const step of upgradeStatements(stmt)) {
        try {
          if (typeof step === 'string') {
            if (alreadyThere(step, have)) continue;
            await client.query(step);
            if (!/^CREATE EXTENSION/i.test(step)) applied++;
            // A table just made has the columns its CREATE lists (not ones a
            // later ALTER in schema.sql adds): note them, so they aren't re-added.
            const created = step.match(/^CREATE TABLE IF NOT EXISTS (\w+)/i);
            const added = step.match(/^ALTER TABLE (\w+) ADD COLUMN IF NOT EXISTS (\w+)/i);
            if (created) {
              have.tables.add(created[1]);
              const { rows } = await client.query(
                'SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1', [created[1]]);
              for (const r of rows) have.columns.add(`${created[1]}.${r.column_name}`);
            } else if (added) {
              have.columns.add(`${added[1]}.${added[2]}`);
            }
          } else {
            const labels = have.enumLabels.get(step.type);
            if (!labels) {
              await client.query(`CREATE TYPE ${step.type} AS ENUM (${step.values.join(', ')})`);
              applied++;
            } else {
              for (const value of step.values) {
                if (labels.has(value.replace(/^'|'$/g, ''))) continue;
                await client.query(`ALTER TYPE ${step.type} ADD VALUE IF NOT EXISTS ${value}`);
                applied++;
              }
            }
          }
        } catch (err) {
          failed.push({ statement: typeof step === 'string' ? step : `enum ${step.type}`, error: err.message });
        }
      }
    }
  } finally {
    if (client !== db) {
      await client.query('RESET lock_timeout').catch(() => {});
      client.release();
    }
  }
  for (const f of failed) log.warn(`Schema upgrade: could not apply "${f.statement.slice(0, 120)}": ${f.error}`);
  return { failed, applied };
}

// Library content added after launch, in seed files written to be safe to
// run again (each inserts only if its rows aren't there yet), plus the
// Arabic and French for all of it. Without this a live database only got
// new library sections from a hand-run seed, and new translations never.
const REPEATABLE_SEEDS = ['seed_nfsa.sql'];

export async function upgradeContent({ db = pool } = {}) {
  for (const file of REPEATABLE_SEEDS) {
    await db.query(fs.readFileSync(path.resolve(__dirname, '../../db', file), 'utf8'));
  }
  const { loadTranslations } = await import('./loadTranslations.js');
  return loadTranslations();
}
