import fs from 'node:fs';
import path from 'node:path';
import { query } from './db.js';

// Shared report PDFs (WhatsApp / email links). A link stops working after
// SHARE_DAYS, but the file used to stay on disk for ever — a full report,
// photos included, long after anyone was meant to be able to read it.
export const SHARE_ROOT = path.resolve('storage', 'shares');
export const SHARE_DAYS = 30;

// The expired link keeps saying "expired" (not "not valid") for this long
// after the file is gone; then the row goes too.
const KEEP_ROW_DAYS = 60;
const SWEEP_EVERY_MS = 60 * 60 * 1000;
let lastSweep = 0;

export async function sweepExpiredShares({ force = false } = {}) {
  if (!force && Date.now() - lastSweep < SWEEP_EVERY_MS) return 0;
  lastSweep = Date.now();
  const { rows } = await query('SELECT token FROM report_shares WHERE expires_at < now()');
  let removed = 0;
  for (const { token } of rows) {
    const file = path.join(SHARE_ROOT, `${token}.pdf`);
    try {
      fs.rmSync(file);
      removed++;
    } catch (err) {
      if (err.code !== 'ENOENT') console.error('Could not remove expired share', token, err.message);
    }
  }
  await query(`DELETE FROM report_shares WHERE expires_at < now() - ($1 || ' days')::interval`, [String(KEEP_ROW_DAYS)]);
  return removed;
}

// Best effort, never in the way of the request that triggered it.
export function sweepSoon() {
  sweepExpiredShares().catch((err) => console.error('Share sweep failed:', err.message));
}
