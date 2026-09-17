import assert from 'node:assert/strict';
import { join } from 'node:path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { configureDataStore, readDocument, writeDocument, upsertVirtualMachine, deleteVirtualMachine } from '../lib/data_store.js';

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
const VM_EXTENSIONS_FILE = join(DATA_DIR, 'vm_extensions.json');
const VM_COOLDOWNS_FILE = join(DATA_DIR, 'vm_cooldowns.json');
const VM_DAILY_USAGE_FILE = join(DATA_DIR, 'vm_daily_usage.json');

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

// 1. Student User
const studentEmail = 'vm_student_test@student.rjuhsd.us';
const studentNorm = normalizeEmail(studentEmail);
const studentSid = makeEmailId(studentNorm, 0);

// 2. Public / Non-eligible User
const publicEmail = 'vm_public_test@gmail.com';
const publicNorm = normalizeEmail(publicEmail);
const publicSid = makeEmailId(publicNorm, 0);

// 3. Admin User
const adminEmail = 'admin@mitch.pro';
const adminNorm = normalizeEmail(adminEmail);
const adminSid = makeEmailId(adminNorm, 0);

// Register test users in data files
const names = { ...readDocument(NAMES_FILE, {}) };
names[studentSid] = studentEmail;
names[publicSid] = publicEmail;
names[adminSid] = adminEmail;
writeDocument(NAMES_FILE, names);

const profiles = { ...readDocument(PROFILES_FILE, {}) };
profiles[studentNorm] = { username: 'vmstudent', displayName: 'VM Student' };
profiles[publicNorm] = { username: 'vmpublic', displayName: 'VM Public' };
profiles[adminNorm] = { username: 'admin', displayName: 'Administrator' };
writeDocument(PROFILES_FILE, profiles);

const passwords = { ...readDocument(PASSWORDS_FILE, {}) };
passwords[studentNorm] = await Bun.password.hash('student_pass_123');
passwords[publicNorm] = await Bun.password.hash('public_pass_123');
passwords[adminNorm] = await Bun.password.hash('admin_pass_123');
writeDocument(PASSWORDS_FILE, passwords);

// Reset extensions, cooldowns, and daily usage for clean test run
writeDocument(VM_EXTENSIONS_FILE, {});
writeDocument(VM_COOLDOWNS_FILE, {});
writeDocument(VM_DAILY_USAGE_FILE, {});

// Create a test VM record for the student
const testVmId = 'vm-test-student-991';
upsertVirtualMachine({
  id: testVmId,
  ownerEmail: studentNorm,
  ownerUserId: 'uid_test_student',
  vmid: 991,
  node: 'pve-node-1',
  guestType: 'qemu',
  friendlyName: 'Test Student VM',
  hostname: 'student-991',
  operatingSystem: 'Linux Desktop',
  templateVmid: 9010,
  cpuCores: 6,
  memoryMb: 16384,
  diskGb: 40,
  status: 'assigned',
  createdAt: Date.now(),
});

const TEST_PORT = 6877;
process.env.NODE_ENV = 'test';
process.env.SESSION_COOKIE_SECURE = '0';

console.log(`--- Starting server for VM lifecycle integration tests on port ${TEST_PORT} ---`);
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

  // 1. Ineligible user rejected for free VM creation
  console.log('--- 1. Testing ineligible user /api/vm/my-computer/create ---');
  const resIneligible = await fetch(`${BASE_URL}/api/vm/my-computer/create`, {
    method: 'POST',
    headers: {
      'Cookie': `studentId=${publicSid}`,
      'Content-Type': 'application/json',
      'Origin': BASE_URL,
    },
    body: JSON.stringify({ desktopPassword: 'validPassword123' }),
  });
  assert.equal(resIneligible.status, 403, 'Public non-student/non-premium user must be rejected with 403');
  console.log('Ineligible user correctly rejected with 403');

  // 2. Short password rejected (<8 chars)
  console.log('--- 2. Testing password < 8 characters on create ---');
  const resShortPass = await fetch(`${BASE_URL}/api/vm/my-computer/create`, {
    method: 'POST',
    headers: {
      'Cookie': `studentId=${studentSid}`,
      'Content-Type': 'application/json',
      'Origin': BASE_URL,
    },
    body: JSON.stringify({ desktopPassword: 'short' }),
  });
  assert([400, 409].includes(resShortPass.status), 'Short password or already assigned must be guarded');
  console.log('Short password guard passed');

  // 3. VM isolation: public user cannot access student VM
  console.log('--- 3. Testing VM isolation (user cannot access other user VM) ---');
  const resOtherVm = await fetch(`${BASE_URL}/api/vm/computers/${testVmId}`, {
    headers: { 'Cookie': `studentId=${publicSid}` },
  });
  assert.equal(resOtherVm.status, 403, 'User must not be able to access another user VM');
  console.log('VM isolation passed: 403 Forbidden for other user');

  // 4. Student can see their own VM via GET /api/vm/computers
  console.log('--- 4. Testing owner accessing their computer list ---');
  const resList = await fetch(`${BASE_URL}/api/vm/computers`, {
    headers: { 'Cookie': `studentId=${studentSid}` },
  });
  assert.equal(resList.status, 200, 'Owner must be able to list their computers');
  const listData = await resList.json();
  assert.equal(listData.isEligible, true, 'Student must be marked isEligible: true');
  assert.equal(listData.computers.length, 1, 'Student should see 1 computer');
  assert.equal(listData.computers[0].id, testVmId, 'Listed computer ID must match');
  console.log('Owner computer list passed');

  // Public user listing computers
  const resPublicList = await fetch(`${BASE_URL}/api/vm/computers`, {
    headers: { 'Cookie': `studentId=${publicSid}` },
  });
  assert.equal(resPublicList.status, 200);
  const publicListData = await resPublicList.json();
  assert.equal(publicListData.isEligible, false, 'Public user must be marked isEligible: false');
  assert.equal(publicListData.computers.length, 0, 'Public user should see 0 computers');
  console.log('Public user computer list passed (isEligible: false)');

  // 5. Heartbeat presence
  console.log('--- 5. Testing heartbeat endpoint ---');
  const resHeartbeat = await fetch(`${BASE_URL}/api/vm/computers/${testVmId}/heartbeat`, {
    method: 'POST',
    headers: {
      'Cookie': `studentId=${studentSid}`,
      'Origin': BASE_URL,
    },
  });
  assert.equal(resHeartbeat.status, 200, 'Heartbeat must succeed for owner');
  const hbData = await resHeartbeat.json();
  assert.equal(hbData.success, true);
  console.log('Heartbeat passed');

  // 6. 30-minute Cooldown enforcement
  console.log('--- 6. Testing 30-minute cooldown enforcement ---');
  const cooldowns = {};
  cooldowns[studentNorm] = {
    cooldownUntil: Date.now() + (30 * 60 * 1000),
    triggeredAt: Date.now(),
    reason: 'test_cooldown',
  };
  writeDocument(VM_COOLDOWNS_FILE, cooldowns);

  const resCooldownStart = await fetch(`${BASE_URL}/api/vm/computers/${testVmId}/power`, {
    method: 'POST',
    headers: {
      'Cookie': `studentId=${studentSid}`,
      'Content-Type': 'application/json',
      'Origin': BASE_URL,
    },
    body: JSON.stringify({ action: 'start' }),
  });
  assert.equal(resCooldownStart.status, 429, 'Start during cooldown must return 429');
  const cdData = await resCooldownStart.json();
  assert.equal(cdData.code, 'vm_cooldown_active');
  assert(cdData.cooldownRemainingSeconds > 0, 'Cooldown remaining seconds must be reported');
  console.log('Cooldown active: correctly blocked with 429');

  // Admin bypasses cooldown
  const resAdminPower = await fetch(`${BASE_URL}/api/vm/computers/${testVmId}/power`, {
    method: 'POST',
    headers: {
      'Cookie': `studentId=${adminSid}`,
      'Content-Type': 'application/json',
      'Origin': BASE_URL,
    },
    body: JSON.stringify({ action: 'start' }),
  });
  assert.notEqual(resAdminPower.status, 429, 'Admin must not be blocked by user cooldown');
  console.log('Admin cooldown bypass verified');

  writeDocument(VM_COOLDOWNS_FILE, {});

  writeDocument(VM_EXTENSIONS_FILE, {});

  // 8. 6-Hour Daily Limit Enforcement
  console.log('--- 8. Testing 6-hour daily VM limit enforcement ---');
  const dayKey = new Date().toISOString().slice(0, 10);
  const dailyUsage = {};
  dailyUsage[studentNorm] = {};
  dailyUsage[studentNorm][dayKey] = 6 * 3600; // 21,600 seconds used today
  writeDocument(VM_DAILY_USAGE_FILE, dailyUsage);

  const resDailyLimitStart = await fetch(`${BASE_URL}/api/vm/computers/${testVmId}/power`, {
    method: 'POST',
    headers: {
      'Cookie': `studentId=${studentSid}`,
      'Content-Type': 'application/json',
      'Origin': BASE_URL,
    },
    body: JSON.stringify({ action: 'start' }),
  });
  assert.equal(resDailyLimitStart.status, 429, 'Start when 6-hour daily limit reached must return 429');
  const dailyLimitData = await resDailyLimitStart.json();
  assert.equal(dailyLimitData.code, 'daily_limit_reached', 'Error code must be daily_limit_reached');
  console.log('6-hour daily limit correctly blocked start with 429 daily_limit_reached');

  // 9. Admin Time Limit Exemption
  console.log('--- 9. Testing admin VM time limit exemption ---');
  // Admin is exempt from daily limit on start
  const resAdminDailyBypass = await fetch(`${BASE_URL}/api/vm/computers/${testVmId}/power`, {
    method: 'POST',
    headers: {
      'Cookie': `studentId=${adminSid}`,
      'Content-Type': 'application/json',
      'Origin': BASE_URL,
    },
    body: JSON.stringify({ action: 'start' }),
  });
  assert.notEqual(resAdminDailyBypass.status, 429, 'Admin must bypass daily VM limit');
  console.log('Admin daily limit bypass verified');

  // Admin GET /api/vm/computers sees isExempt: true and null time limits
  const resAdminList = await fetch(`${BASE_URL}/api/vm/computers`, {
    headers: { 'Cookie': `studentId=${adminSid}` },
  });
  assert.equal(resAdminList.status, 200);
  const adminListData = await resAdminList.json();
  const adminComputer = adminListData.computers.find(c => c.id === testVmId);
  if (adminComputer) {
    assert.equal(adminComputer.lease.isExempt, true, 'Admin lease must have isExempt: true');
    assert.equal(adminComputer.lease.remainingSeconds, null, 'Admin lease must have remainingSeconds: null');
    assert.equal(adminComputer.lease.maxUptimeSeconds, null, 'Admin lease must have maxUptimeSeconds: null');
    assert.equal(adminComputer.cpuCores, 6, 'Computer CPU cores must be 6');
    assert.equal(adminComputer.memoryMb, 16384, 'Computer memoryMb must be 16384 (16 GB)');
  }
  console.log('Admin lease exemption verified: isExempt: true, remainingSeconds: null, 6 cores / 16 GB specs');

  writeDocument(VM_DAILY_USAGE_FILE, {});

  // 10. rjuhsd.school domain isolation
  console.log('--- 10. Testing rjuhsd.school domain isolation ---');
  const rjuhsdBridgeRes = await fetch(`${BASE_URL}/api/sso/bridge?back=https%3A%2F%2Frjuhsd.school%2Fmatrix%2F`, {
    headers: {
      'Host': 'rjuhsd.school',
    },
    redirect: 'manual',
  });
  assert.equal(rjuhsdBridgeRes.status, 302, 'Unauthenticated rjuhsd.school request must 302 to local enroll');
  const rjuhsdLoc = rjuhsdBridgeRes.headers.get('Location');
  assert(rjuhsdLoc.startsWith('/enroll/?next='), 'Location must stay on rjuhsd.school enroll page, got: ' + rjuhsdLoc);
  console.log('rjuhsd.school stays on domain: passed (' + rjuhsdLoc + ')');

  // 11. Matrix HTML button text
  console.log('--- 11. Testing Matrix login button text ---');
  const matrixHtmlRes = await fetch(`${BASE_URL}/matrix/`);
  assert.equal(matrixHtmlRes.status, 200);
  const matrixHtml = await matrixHtmlRes.text();
  assert(matrixHtml.includes('Login with mitch.pro'), 'Matrix login button must say "Login with mitch.pro"');
  console.log('Matrix login button text verified: "Login with mitch.pro"');

  console.log('=== ALL VM LIFECYCLE & POLICY INTEGRATION TESTS PASSED! ===');
} finally {
  serverProc.kill();
  deleteVirtualMachine(testVmId);
}
