import assert from 'node:assert/strict';
import { join } from 'node:path';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
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

function normalizeEmail(email) {
  if (!email) return '';
  let e = String(email).toLowerCase().trim();
  if (!e.includes('@')) return e;
  const at = e.lastIndexOf('@');
  const localRaw = e.slice(0, at).split('+')[0];
  const domainRaw = e.slice(at + 1);
  const local = localRaw.replace(/\./g, '');
  const reservedMitchPro = new Set(['admin', 'support', 'noreply', 'mitch']);
  const domain = ((domainRaw === 'student.mitch.pro' || domainRaw === 'mitch.pro') && !reservedMitchPro.has(local))
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

const testEmail = 'matrix_test_user@student.rjuhsd.us';
const testNormEmail = normalizeEmail(testEmail);
const testSid = makeEmailId(testNormEmail, 0);

// Ensure test user exists in names.json and profiles.json
const names = { ...readDocument(NAMES_FILE, {}) };
names[testSid] = testEmail;
writeDocument(NAMES_FILE, names);

const profiles = { ...readDocument(PROFILES_FILE, {}) };
profiles[testNormEmail] = {
  username: 'matrixtestuser',
  displayName: 'Matrix Test User'
};
writeDocument(PROFILES_FILE, profiles);

// Start a test server instance
const TEST_PORT = 6855;
process.env.PORT = String(TEST_PORT);
process.env.NODE_ENV = 'test';
process.env.SESSION_COOKIE_SECURE = '0';

console.log(`--- Starting server for Matrix SSO unit tests on port ${TEST_PORT} ---`);
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
  stderr: 'inherit'
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

  // 1. Unauthenticated SSO status
  console.log('--- 1. Testing unauthenticated /api/matrix/sso-status ---');
  const resAnonStatus = await fetch(`${BASE_URL}/api/matrix/sso-status`);
  assert.equal(resAnonStatus.status, 200);
  const dataAnonStatus = await resAnonStatus.json();
  assert.equal(dataAnonStatus.authenticated, false, 'Unauthenticated user should report authenticated: false');
  console.log('Unauthenticated status passed');

  // 2. Unauthenticated SSO login
  console.log('--- 2. Testing unauthenticated /api/matrix/sso-login ---');
  const resAnonLogin = await fetch(`${BASE_URL}/api/matrix/sso-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  assert.equal(resAnonLogin.status, 401, 'Unauthenticated request to sso-login must return 401');
  const dataAnonLogin = await resAnonLogin.json();
  assert.equal(dataAnonLogin.ok, false);
  console.log('Unauthenticated login rejected with 401 as expected');

  // 3. Authenticated SSO status
  console.log('--- 3. Testing authenticated /api/matrix/sso-status ---');
  const resAuthStatus = await fetch(`${BASE_URL}/api/matrix/sso-status`, {
    headers: {
      'Cookie': `studentId=${testSid}`
    }
  });
  assert.equal(resAuthStatus.status, 200);
  const dataAuthStatus = await resAuthStatus.json();
  assert.equal(dataAuthStatus.authenticated, true);
  assert.equal(dataAuthStatus.username, 'matrixtestuser');
  assert.equal(dataAuthStatus.displayName, 'Matrix Test User');
  console.log('Authenticated SSO status passed:', dataAuthStatus);

  // 4. Matrix config check
  console.log('--- 4. Testing /matrix/config.json ---');
  const resConfig = await fetch(`${BASE_URL}/matrix/config.json`);
  assert.equal(resConfig.status, 200);
  const configData = await resConfig.json();
  assert.equal(configData.defaultHomeserver, 0);
  assert(Array.isArray(configData.homeserverList));
  console.log('/matrix/config.json passed');

  console.log('=== ALL MATRIX SSO UNIT TESTS PASSED SUCCESSFULLY! ===');
} finally {
  serverProc.kill();
}
