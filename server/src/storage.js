import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Where evidence photos and shared report PDFs are kept: somewhere that
// outlives a deploy. Hostinger's Node.js web app puts each push in a fresh
// version folder (domains/<site>/hbuilds/versions/<id>) and deletes the old
// ones, so files kept inside the app (server/uploads, server/storage)
// vanished at every deploy: photos stopped loading and shared links broke.
// In production they live under the account's home folder, which deploys
// don't touch, or under DATA_DIR when that's set. Locally (and in tests)
// they stay where they always were.
const dataDir = process.env.DATA_DIR?.trim()
  || (process.env.NODE_ENV === 'production' ? path.join(os.homedir(), 'sopy-data') : null);

export const UPLOAD_ROOT = dataDir ? path.join(dataDir, 'uploads') : path.resolve('uploads');
export const SHARE_ROOT = dataDir ? path.join(dataDir, 'shares') : path.resolve('storage', 'shares');

// At start-up: make the folders and say where they are, so the log shows
// whether files will survive the next deploy.
export function prepareStorage(log = console) {
  try {
    fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
    fs.mkdirSync(SHARE_ROOT, { recursive: true });
    fs.accessSync(UPLOAD_ROOT, fs.constants.W_OK);
    if (process.env.NODE_ENV === 'production') log.log(`Photos and shared reports are kept in ${dataDir}`);
  } catch (err) {
    log.warn(`Photos and shared reports: cannot use ${UPLOAD_ROOT}: ${err.message}`);
  }
}
