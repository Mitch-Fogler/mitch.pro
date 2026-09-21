import assert from 'node:assert/strict';
import { join } from 'node:path';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { configureDataStore, readDocument, writeDocument } from '../lib/data_store.js';

const REPO_ROOT = join(import.meta.dir, '..');
const DATA_DIR = join(REPO_ROOT, 'data');
configureDataStore({ baseDir: REPO_ROOT, dataDir: DATA_DIR });

const ID_SECRET_FILE = join(DATA_DIR, 'id_secret.key');
let ID_SECRET;
try {
  ID_SECRET = readFileSync(ID_SECRET_FILE);
} catch {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
  ID_SECRET = randomBytes(32);
  writeFileSync(ID_SECRET_FILE, ID_SECRET);
}

const NAMES_FILE = join(DATA_DIR, 'names.json');
const PROFILES_FILE = join(DATA_DIR, 'profiles.json');
const PASSWORDS_FILE = join(DATA_DIR, 'passwords.json');

function normalizeEmail(email) {
  if (!email) return '';
  let e = String(email).toLowerCase().trim();
  if (!e.includes('@')) return e;
  const at = e.lastIndexOf('@');
  const localRaw = e.slice(0, at).split('+')[0];
  const domainRaw = e.slice(at + 1);
  const local = localRaw.replace(/\./g, '');
  const domain = ((domainRaw === 'student.mitch.pro' || domainRaw === 'mitch.pro') && !['admin', 'support', 'noreply', 'mitch'].includes(local))
    ? 'student.rjuhsd.us'
    : domainRaw;
  return local + '@' + domain;
}

function makeEmailId(email, gen = 0) {
  const key = gen === 0 ? email : `${email}:v${gen}`;
  const emailHash = createHash('sha256').update(key).digest('hex').slice(0, 24);
  const raw = 'e' + emailHash;
  const sig = createHmac('sha256', ID_SECRET).update(raw).digest('hex').slice(0, 16);
  return raw + '.' + sig;
}

const authEmail = 'member@student.rjuhsd.us';
const authNorm = normalizeEmail(authEmail);
const authSid = makeEmailId(authNorm, 0);

const names = { ...readDocument(NAMES_FILE, {}) };
names[authSid] = authEmail;
writeDocument(NAMES_FILE, names);

const profiles = { ...readDocument(PROFILES_FILE, {}) };
profiles[authNorm] = { username: 'authmember', displayName: 'Auth Member' };
writeDocument(PROFILES_FILE, profiles);

const passwords = { ...readDocument(PASSWORDS_FILE, {}) };
passwords[authNorm] = await Bun.password.hash('member_pass_123');
writeDocument(PASSWORDS_FILE, passwords);

const TEST_PORT = 6889;
process.env.NODE_ENV = 'test';
process.env.SESSION_COOKIE_SECURE = '0';

console.log(`--- Starting server for landing sales & trial tests on port ${TEST_PORT} ---`);
const serverProc = Bun.spawn(['bun', 'server.js'], {
  cwd: REPO_ROOT,
  env: {
    ...process.env,
    PORT: String(TEST_PORT),
    NODE_ENV: 'test',
    SESSION_COOKIE_SECURE: '0',
    PVE_SSH_HOST: '',
    DATA_DIR: DATA_DIR,
  },
  stdout: 'inherit',
  stderr: 'inherit',
});

async function waitForServer(port, maxAttempts = 40) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/site-info`);
      if (res.ok) return;
    } catch {}
    await Bun.sleep(400);
  }
  throw new Error(`Server failed to start on port ${port}`);
}

try {
  await waitForServer(TEST_PORT);
  const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

  // 1. Initial visit to / -> shows index-sales.html, no 1-min trial timer
  console.log('--- 1. Testing first visit to / (must be index-sales.html, NO guest-preview script) ---');
  const resFirstVisit = await fetch(`${BASE_URL}/`);
  assert.equal(resFirstVisit.status, 200);
  const htmlFirstVisit = await resFirstVisit.text();
  assert(htmlFirstVisit.includes('sales-page'), 'First visit must render sales page');
  assert(htmlFirstVisit.includes('Try It Out'), 'Must include Try It Out button');
  assert(htmlFirstVisit.includes('id="hero-try-it-out"'), 'Hero must contain hero-try-it-out button');
  assert(!htmlFirstVisit.includes('guest-preview.js'), 'Must NOT inject guest-preview.js on first sales visit');
  console.log('First visit correctly served index-sales.html without guest preview script');

  // 2. Click "Try It Out" -> visits /?trial=1
  console.log('--- 2. Testing "Try It Out" click (/?trial=1) -> serves index.html with guest preview ---');
  const resTrial = await fetch(`${BASE_URL}/?trial=1`);
  assert.equal(resTrial.status, 200);
  const setCookie = resTrial.headers.get('set-cookie') || '';
  assert(setCookie.includes('mitch_trial='), 'Must set mitch_trial cookie on trial activation');
  const htmlTrial = await resTrial.text();
  assert(htmlTrial.includes('guest-preview.js'), 'Must inject guest-preview.js after starting trial');
  assert(!htmlTrial.includes('sales-page'), 'Must render main index.html during trial');
  console.log('Trial activation passed: served index.html with guest-preview.js and set mitch_trial cookie');

  // 3. Subsequent visit with mitch_trial=1 cookie -> continues serving index.html
  console.log('--- 3. Testing subsequent visit to / with mitch_trial cookie ---');
  const resSubsequent = await fetch(`${BASE_URL}/`, {
    headers: { 'Cookie': 'mitch_trial=1' },
  });
  assert.equal(resSubsequent.status, 200);
  const htmlSubsequent = await resSubsequent.text();
  assert(htmlSubsequent.includes('guest-preview.js'), 'Must continue guest trial on reload');
  assert(!htmlSubsequent.includes('sales-page'), 'Must continue serving main app');
  console.log('Subsequent trial visit passed');

  // 4. Direct visit to /index-sales.html -> always serves index-sales.html
  console.log('--- 4. Testing direct visit to /index-sales.html ---');
  const resSalesDirect = await fetch(`${BASE_URL}/index-sales.html`);
  assert.equal(resSalesDirect.status, 200);
  const htmlSalesDirect = await resSalesDirect.text();
  assert(htmlSalesDirect.includes('sales-page'), 'Direct visit to index-sales.html must render sales page');
  assert(!htmlSalesDirect.includes('guest-preview.js'), 'Must NOT inject guest-preview.js on sales page');
  console.log('Direct index-sales.html visit passed');

  // 5. Authenticated user visit to / -> serves index.html without guest-preview.js
  console.log('--- 5. Testing authenticated user visit to / ---');
  const resAuth = await fetch(`${BASE_URL}/`, {
    headers: { 'Cookie': `studentId=${authSid}` },
  });
  assert.equal(resAuth.status, 200);
  const htmlAuth = await resAuth.text();
  assert(!htmlAuth.includes('sales-page'), 'Authenticated user must see main app, not sales page');
  assert(!htmlAuth.includes('guest-preview.js'), 'Authenticated user must NOT have guest-preview.js');
  console.log('Authenticated user visit passed');

  console.log('=== ALL SALES PAGE & TRIAL ACTIVATION TESTS PASSED! ===');
} finally {
  serverProc.kill();
}
