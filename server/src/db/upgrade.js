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

export async function upgradeSchema({ db = pool, log = console } = {}) {
  const failed = [];
  for (const stmt of schemaStatements()) {
    for (const step of upgradeStatements(stmt)) {
      try {
        if (typeof step === 'string') {
          await db.query(step);
        } else {
          const { rows } = await db.query('SELECT 1 FROM pg_type WHERE typname = $1', [step.type]);
          if (!rows[0]) await db.query(`CREATE TYPE ${step.type} AS ENUM (${step.values.join(', ')})`);
          else for (const value of step.values) await db.query(`ALTER TYPE ${step.type} ADD VALUE IF NOT EXISTS ${value}`);
        }
      } catch (err) {
        failed.push({ statement: typeof step === 'string' ? step : `enum ${step.type}`, error: err.message });
      }
    }
  }
  for (const f of failed) log.warn(`Schema upgrade: could not apply "${f.statement.slice(0, 120)}": ${f.error}`);
  return { failed };
}
