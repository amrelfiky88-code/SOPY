import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

// Hostinger puts every deploy in a fresh folder and deletes the old one, so
// in production photos and shared PDFs must be kept outside the app.

function roots(env) {
  const out = execFileSync(process.execPath, ['--input-type=module', '-e',
    "import('./src/storage.js').then((m) => console.log(JSON.stringify({ u: m.UPLOAD_ROOT, s: m.SHARE_ROOT })))"],
  { env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, ...env }, encoding: 'utf8' });
  return JSON.parse(out);
}

test('in production, files go to the home folder, which deploys leave alone', () => {
  const { u, s } = roots({ NODE_ENV: 'production' });
  assert.equal(u, path.join(os.homedir(), 'sopy-data', 'uploads'));
  assert.equal(s, path.join(os.homedir(), 'sopy-data', 'shares'));
});

test('DATA_DIR picks another place', () => {
  const dir = path.join(os.tmpdir(), 'sopy-data-test');
  const { u, s } = roots({ NODE_ENV: 'production', DATA_DIR: dir });
  assert.equal(u, path.join(dir, 'uploads'));
  assert.equal(s, path.join(dir, 'shares'));
});

test('locally, the folders stay where they were', () => {
  const { u, s } = roots({ NODE_ENV: 'test' });
  assert.equal(u, path.resolve('uploads'));
  assert.equal(s, path.resolve('storage', 'shares'));
});
