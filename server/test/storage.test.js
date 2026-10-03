import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { defaultDataDir } from '../src/storage.js';

// Hostinger puts every deploy in a fresh folder and deletes the old one, so
// in production photos and shared PDFs must be kept outside the app.

function run(env, code) {
  return execFileSync(process.execPath, ['--input-type=module', '-e', code],
    { env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, ...env }, encoding: 'utf8' });
}
const roots = (env) => JSON.parse(run(env,
  "import('./src/storage.js').then((m) => console.log(JSON.stringify({ u: m.UPLOAD_ROOT, s: m.SHARE_ROOT })))"));
const homeEnv = (home) => ({ HOME: home, USERPROFILE: home });

test('in production, files go to the account home, which deploys leave alone', () => {
  const { u, s } = roots({ NODE_ENV: 'production' });
  assert.equal(u, path.join(os.homedir(), 'sopy-data', 'uploads'));
  assert.equal(s, path.join(os.homedir(), 'sopy-data', 'shares'));
});

test('on Hostinger (HOME is the site folder) the account home above it is used', () => {
  assert.equal(defaultDataDir('/home/u1/domains/app.example.com'), path.join('/home/u1', 'sopy-data'));
  assert.equal(defaultDataDir('/home/u1/domains/app.example.com/'), path.join('/home/u1', 'sopy-data'));
  assert.equal(defaultDataDir('/home/u1'), path.join('/home/u1', 'sopy-data'));
  const site = path.join(os.tmpdir(), 'acct', 'domains', 'app.example.com');
  assert.equal(roots({ NODE_ENV: 'production', ...homeEnv(site) }).u, path.join(os.tmpdir(), 'acct', 'sopy-data', 'uploads'));
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

test('start-up brings files from the earlier site-folder location and notes since when', () => {
  const acct = fs.mkdtempSync(path.join(os.tmpdir(), 'sopy-acct-'));
  const site = path.join(acct, 'domains', 'app.example.com');
  fs.mkdirSync(path.join(site, 'sopy-data', 'uploads', 't1'), { recursive: true });
  fs.writeFileSync(path.join(site, 'sopy-data', 'uploads', 't1', 'a.jpg'), 'photo');
  const start = "import('./src/storage.js').then((m) => m.prepareStorage())";
  const first = run({ NODE_ENV: 'production', ...homeEnv(site) }, start);
  const data = path.join(acct, 'sopy-data');
  assert.equal(fs.readFileSync(path.join(data, 'uploads', 't1', 'a.jpg'), 'utf8'), 'photo');
  assert.equal(fs.existsSync(path.join(site, 'sopy-data')), false);
  assert.ok(fs.existsSync(path.join(data, 'shares')));
  const since = fs.readFileSync(path.join(data, '.created'), 'utf8');
  assert.match(first, new RegExp(`\(since ${since}\)`));
  // A later start keeps the same date.
  assert.match(run({ NODE_ENV: 'production', ...homeEnv(site) }, start), new RegExp(`\(since ${since}\)`));
  fs.rmSync(acct, { recursive: true, force: true });
});
