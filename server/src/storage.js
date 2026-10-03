import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Where evidence photos and shared report PDFs are kept: somewhere that
// outlives a deploy. Hostinger's Node.js web app puts each push in a fresh
// version folder (domains/<site>/hbuilds/versions/<id>) and deletes the old
// ones, so files kept inside the app (server/uploads, server/storage)
// vanished at every deploy: photos stopped loading and shared links broke.
// In production they live in the account's home folder, or under DATA_DIR
// when that's set. Locally (and in tests) they stay where they always were.
export function defaultDataDir(home = os.homedir()) {
  // Hostinger runs the app with HOME set to the site's folder
  // (/home/<user>/domains/<site>), which the host manages (it holds a
  // DO_NOT_UPLOAD_HERE notice). The account's own home above it is never
  // touched by a deploy or by rebuilding the site.
  const site = home.match(/^(.+?)[\\/]domains[\\/][^\\/]+[\\/]?$/);
  return path.join(site ? site[1] : home, 'sopy-data');
}

const dataDir = process.env.DATA_DIR?.trim()
  || (process.env.NODE_ENV === 'production' ? defaultDataDir() : null);

export const UPLOAD_ROOT = dataDir ? path.join(dataDir, 'uploads') : path.resolve('uploads');
export const SHARE_ROOT = dataDir ? path.join(dataDir, 'shares') : path.resolve('storage', 'shares');

// At start-up: make the folders and say where they are and since when, so
// the log shows whether files survive deploys (a "since" that moves with
// every deploy means the folder is being wiped).
export function prepareStorage(log = console) {
  try {
    // The first version of this kept files in the site's folder; bring
    // anything saved there along.
    const earlier = path.join(os.homedir(), 'sopy-data');
    if (dataDir && earlier !== dataDir && fs.existsSync(earlier) && !fs.existsSync(dataDir)) {
      fs.mkdirSync(path.dirname(dataDir), { recursive: true });
      fs.renameSync(earlier, dataDir);
    }
    fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
    fs.mkdirSync(SHARE_ROOT, { recursive: true });
    fs.accessSync(UPLOAD_ROOT, fs.constants.W_OK);
    if (!dataDir) return;
    const marker = path.join(dataDir, '.created');
    let since;
    try {
      since = fs.readFileSync(marker, 'utf8').trim();
    } catch {
      since = new Date().toISOString();
      fs.writeFileSync(marker, since);
    }
    log.log(`Photos and shared reports are kept in ${dataDir} (since ${since})`);
  } catch (err) {
    log.warn(`Photos and shared reports: cannot use ${UPLOAD_ROOT}: ${err.message}`);
  }
}
