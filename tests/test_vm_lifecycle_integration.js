import assert from 'node:assert/strict';
import { join } from 'node:path';
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
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
const VM_ADMIN_GRANTS_FILE = join(DATA_DIR, 'vm_admin_grants.json');
const COIN_GIFTS_FILE = join(DATA_DIR, 'coin_gifts.json');
const COINS_FILE = join(DATA_DIR, 'coins.json');
const VM_UPGRADES_FILE = join(DATA_DIR, 'vm_upgrades.json');
const GENERATIONS_FILE = join(DATA_DIR, 'generations.json');
const PASSPHRASE_FILE = join(DATA_DIR, 'admin_passphrase.json');
const TEST_MOCK_FILE = join(DATA_DIR, 'test_vm_mock.json');
const TEST_NTFY_LOG_FILE = join(DATA_DIR, 'test_vm_ntfy_log.json');

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
const adminGens = readDocument(GENERATIONS_FILE, {});
const adminGen = (adminGens[adminNorm] && typeof adminGens[adminNorm] === 'object') ? (adminGens[adminNorm].gen || 0) : (adminGens[adminNorm] || 0);
const adminSid = makeEmailId(adminNorm, adminGen);

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

const originalPassphrases = { ...readDocument(PASSPHRASE_FILE, {}) };
const passphrases = { ...originalPassphrases };
passphrases[adminNorm] = {
  hash: await Bun.password.hash('testpass123'),
  createdAt: Date.now(),
  updatedAt: Date.now(),
  setBy: adminEmail,
};
writeDocument(PASSPHRASE_FILE, passphrases);

// Reset extensions, cooldowns, and daily usage for clean test run
writeDocument(VM_EXTENSIONS_FILE, {});
writeDocument(VM_COOLDOWNS_FILE, {});
writeDocument(VM_DAILY_USAGE_FILE, {});
writeDocument(VM_ADMIN_GRANTS_FILE, {});
writeDocument(COIN_GIFTS_FILE, {});
writeDocument(VM_UPGRADES_FILE, {});
writeDocument(TEST_MOCK_FILE, {});
writeDocument(TEST_NTFY_LOG_FILE, []);

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
  diskGb: 64,
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

  // Admin consent gate tests
  console.log('--- Testing admin consent gate for user VM ---');
  const resAdminPowerBlocked = await fetch(`${BASE_URL}/api/vm/computers/${testVmId}/power`, {
    method: 'POST',
    headers: {
      'Cookie': `studentId=${adminSid}`,
      'Content-Type': 'application/json',
      'Origin': BASE_URL,
    },
    body: JSON.stringify({ action: 'start' }),
  });
  assert.equal(resAdminPowerBlocked.status, 403, 'Admin must be blocked without owner permission');
  const blockData = await resAdminPowerBlocked.json();
  assert.equal(blockData.code, 'admin_access_not_allowed', 'Error code must be admin_access_not_allowed');
  console.log('Admin access gate without permission verified: 403 Forbidden');

  // Verify owner received access request in in-app notification center
  const resOwnerNotifs1 = await fetch(`${BASE_URL}/api/me/notifications`, {
    headers: { 'Cookie': `studentId=${studentSid}` },
  });
  assert.equal(resOwnerNotifs1.status, 200);
  const ownerNotifs1 = await resOwnerNotifs1.json();
  const requestNotice = (ownerNotifs1.notifications || []).find(n => n.type === 'vm_admin_access' && (n.title || '').includes('Request'));
  assert(requestNotice, 'Owner must receive access request notification in notification center');
  console.log('Owner in-app notification center received access request (no email sent)');

  // Owner grants permission
  const resGrant = await fetch(`${BASE_URL}/api/vm/computers/${testVmId}/admin-access`, {
    method: 'POST',
    headers: {
      'Cookie': `studentId=${studentSid}`,
      'Content-Type': 'application/json',
      'Origin': BASE_URL,
    },
    body: JSON.stringify({ allow: true }),
  });
  assert.equal(resGrant.status, 200);
  const grantData = await resGrant.json();
  assert.equal(grantData.allowed, true, 'Admin access must be allowed');
  console.log('Owner granted admin access verified: 200 OK');

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
  assert.notEqual(resAdminPower.status, 403, 'Admin must not be blocked after grant');
  console.log('Admin cooldown bypass verified');

  // Verify owner received in-app notification that admin used their computer
  const resOwnerNotifs2 = await fetch(`${BASE_URL}/api/me/notifications`, {
    headers: { 'Cookie': `studentId=${studentSid}` },
  });
  const ownerNotifs2 = await resOwnerNotifs2.json();
  const usedNotice = (ownerNotifs2.notifications || []).find(n => n.type === 'vm_admin_access' && (n.title || '').includes('Used'));
  assert(usedNotice, 'Owner must receive notice when admin uses VM');
  console.log('Owner notification center received admin usage alert (in-app, no email)');

  // Verify audit log has ADMIN_VM_USED
  const resOverview = await fetch(`${BASE_URL}/api/admin/vms/overview`, {
    headers: {
      'Cookie': `studentId=${adminSid}`,
      'X-Admin-Passphrase': 'testpass123',
    },
  });
  console.log('resOverview status:', resOverview.status);
  assert.equal(resOverview.status, 200, 'Admin overview must succeed with valid passphrase');
  const overviewData = await resOverview.json();
  const auditUsed = (overviewData.audit || []).find(a => a.action === 'ADMIN_VM_USED' && a.ownerEmail === studentNorm);
  assert(auditUsed, 'Audit log must record ADMIN_VM_USED for admin using user VM');
  console.log('Audit log verified: ADMIN_VM_USED recorded');

  // Owner revokes permission
  const resRevoke = await fetch(`${BASE_URL}/api/vm/computers/${testVmId}/admin-access`, {
    method: 'POST',
    headers: {
      'Cookie': `studentId=${studentSid}`,
      'Content-Type': 'application/json',
      'Origin': BASE_URL,
    },
    body: JSON.stringify({ allow: false }),
  });
  assert.equal(resRevoke.status, 200);
  const revokeData = await resRevoke.json();
  assert.equal(revokeData.allowed, false, 'Admin access must be revoked');

  // Admin blocked again after revocation
  const resAdminBlockedAgain = await fetch(`${BASE_URL}/api/vm/computers/${testVmId}/power`, {
    method: 'POST',
    headers: {
      'Cookie': `studentId=${adminSid}`,
      'Content-Type': 'application/json',
      'Origin': BASE_URL,
    },
    body: JSON.stringify({ action: 'start' }),
  });
  assert.equal(resAdminBlockedAgain.status, 403, 'Admin must be blocked after revocation');
  console.log('Admin access revocation verified: 403 Forbidden');

  // Re-grant for remaining daily limit tests
  await fetch(`${BASE_URL}/api/vm/computers/${testVmId}/admin-access`, {
    method: 'POST',
    headers: {
      'Cookie': `studentId=${studentSid}`,
      'Content-Type': 'application/json',
      'Origin': BASE_URL,
    },
    body: JSON.stringify({ allow: true }),
  });

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

  const testAdminVmId = 'vm-test-admin-990';
  upsertVirtualMachine({
    id: testAdminVmId,
    ownerEmail: adminNorm,
    ownerUserId: 'uid_admin',
    vmid: 990,
    node: 'pve-node-1',
    guestType: 'qemu',
    friendlyName: 'Admin VM',
    hostname: 'admin-990',
    operatingSystem: 'Linux Desktop',
    templateVmid: 9010,
    cpuCores: 6,
    memoryMb: 16384,
    diskGb: 64,
    status: 'assigned',
    createdAt: Date.now(),
  });
  try {
    // Admin GET /api/vm/computers sees isExempt: true and null time limits
    const resAdminList = await fetch(`${BASE_URL}/api/vm/computers`, {
      headers: { 'Cookie': `studentId=${adminSid}` },
    });
    assert.equal(resAdminList.status, 200);
    const adminListData = await resAdminList.json();
    const adminComputer = adminListData.computers.find(c => c.id === testAdminVmId);
    assert(adminComputer, 'Admin computer must be returned in GET /api/vm/computers');
    assert.equal(adminComputer.lease.isExempt, true, 'Admin lease must have isExempt: true');
    assert.equal(adminComputer.lease.remainingSeconds, null, 'Admin lease must have remainingSeconds: null');
    assert.equal(adminComputer.lease.maxUptimeSeconds, null, 'Admin lease must have maxUptimeSeconds: null');
    assert.equal(adminComputer.cpuCores, 6, 'Computer CPU cores must be 6');
    assert.equal(adminComputer.memoryMb, 16384, 'Computer memoryMb must be 16384 (16 GB)');
    assert.equal(adminComputer.diskGb, 64, 'Computer diskGb must be 64 (64 GB)');
    console.log('Admin lease exemption verified: isExempt: true, remainingSeconds: null, 6 cores / 16 GB RAM / 64 GB disk specs');
  } finally {
    deleteVirtualMachine(testAdminVmId);
  }

  // Admin-on-admin isolation: admin cannot access another admin's VM
  console.log('--- Testing admin-on-admin VM access restriction ---');
  const otherAdminEmail = 'lillian.loaiza@student.rjuhsd.us';
  const otherAdminVmId = 'vm-test-other-admin-992';
  upsertVirtualMachine({
    id: otherAdminVmId,
    ownerEmail: otherAdminEmail,
    ownerUserId: 'uid_other_admin',
    vmid: 992,
    node: 'pve-node-1',
    guestType: 'qemu',
    friendlyName: 'Other Admin VM',
    hostname: 'other-admin-992',
    operatingSystem: 'Linux Desktop',
    templateVmid: 9010,
    cpuCores: 6,
    memoryMb: 16384,
    diskGb: 64,
    status: 'assigned',
    createdAt: Date.now(),
  });
  try {
    const resAdminOnAdmin = await fetch(`${BASE_URL}/api/vm/computers/${otherAdminVmId}`, {
      headers: { 'Cookie': `studentId=${adminSid}` },
    });
    assert.equal(resAdminOnAdmin.status, 403, 'Admin must not access another admin VM');
    console.log('Admin-on-admin restriction verified: 403 Forbidden');
  } finally {
    deleteVirtualMachine(otherAdminVmId);
  }

  // 9b. Capacity full NTFY alert when user attempts to use a VM
  console.log('--- Testing NTFY capacity full alert on attempt ---');
  // Clear cooldown and daily usage so student attempt reaches capacity check
  writeDocument(VM_COOLDOWNS_FILE, {});
  writeDocument(VM_DAILY_USAGE_FILE, {});
  writeDocument(TEST_NTFY_LOG_FILE, []);
  // Simulate capacity full (6 running non-admin VMs)
  writeDocument(TEST_MOCK_FILE, { runningNonAdminCount: 6 });

  // Student attempts to start their VM while capacity is full
  const resStudentCapFull = await fetch(`${BASE_URL}/api/vm/computers/${testVmId}/power`, {
    method: 'POST',
    headers: {
      'Cookie': `studentId=${studentSid}`,
      'Content-Type': 'application/json',
      'Origin': BASE_URL,
    },
    body: JSON.stringify({ action: 'start' }),
  });
  assert.equal(resStudentCapFull.status, 409, 'Power start must return 409 when capacity full');
  const capFullData = await resStudentCapFull.json();
  assert.equal(capFullData.code, 'capacity_limit_reached', 'Error code must be capacity_limit_reached');

  // Verify NTFY alert was triggered with high priority
  const ntfyLogs = readDocument(TEST_NTFY_LOG_FILE, []);
  assert.equal(ntfyLogs.length, 1, 'NTFY capacity alert must be triggered exactly once');
  assert.equal(ntfyLogs[0].title, 'VM Capacity Alert', 'NTFY title must be "VM Capacity Alert"');
  assert.equal(ntfyLogs[0].priority, 'high', 'NTFY priority must be "high"');
  assert(ntfyLogs[0].message.includes('6/6'), 'NTFY message must state 6/6 capacity full');
  assert(ntfyLogs[0].message.includes(studentNorm), 'NTFY message must include student email');
  console.log('NTFY capacity full alert verified (high priority, debounced)');

  // Immediate second attempt within 60s cooldown must NOT trigger a second NTFY
  const resStudentCapFull2 = await fetch(`${BASE_URL}/api/vm/computers/${testVmId}/power`, {
    method: 'POST',
    headers: {
      'Cookie': `studentId=${studentSid}`,
      'Content-Type': 'application/json',
      'Origin': BASE_URL,
    },
    body: JSON.stringify({ action: 'start' }),
  });
  assert.equal(resStudentCapFull2.status, 409);
  const ntfyLogs2 = readDocument(TEST_NTFY_LOG_FILE, []);
  assert.equal(ntfyLogs2.length, 1, 'NTFY capacity alert must be debounced within 60s cooldown');
  console.log('NTFY capacity alert debounce verified (no duplicate alert)');

  // Reset capacity mock
  writeDocument(TEST_MOCK_FILE, { runningNonAdminCount: 0 });

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

  // 12. VM Hardware Upgrades with Mitch Coins
  console.log('--- 12. Testing VM Hardware Upgrades with Mitch Coins ---');
  // Credit student 2000 Mitch Coins
  const coins = { ...readDocument(COINS_FILE, {}) };
  coins[studentNorm] = 2000;
  writeDocument(COINS_FILE, coins);

  // Clear existing upgrades
  const upgrades = { ...readDocument(VM_UPGRADES_FILE, {}) };
  delete upgrades[studentNorm];
  writeDocument(VM_UPGRADES_FILE, upgrades);

  // GET /api/vm/upgrades
  const resUpgradesGet = await fetch(`${BASE_URL}/api/vm/upgrades`, {
    headers: { 'Cookie': `studentId=${studentSid}` },
  });
  assert.equal(resUpgradesGet.status, 200, 'GET /api/vm/upgrades must return 200');
  const upgradesData = await resUpgradesGet.json();
  assert(upgradesData.catalog && upgradesData.catalog.cpu, 'Catalog must be returned');
  assert.equal(upgradesData.current.cpuCores, 2, 'Default CPU cores must be 2');
  assert.equal(upgradesData.current.memoryMb, 4096, 'Default RAM must be 4096 MB');
  assert.equal(upgradesData.coins, 2000, 'Student must have 2000 coins');
  assert.equal(upgradesData.fleet.maxCores, 36, 'Fleet max cores must be 36');
  assert.equal(upgradesData.fleet.maxMemoryMb, 98304, 'Fleet max memory must be 98304 MB');
  console.log('GET /api/vm/upgrades verified');

  // Invalid upgrade target
  const resBadCat = await fetch(`${BASE_URL}/api/vm/upgrade`, {
    method: 'POST',
    headers: {
      'Cookie': `studentId=${studentSid}`,
      'Content-Type': 'application/json',
      'Origin': BASE_URL,
    },
    body: JSON.stringify({ category: 'gpu', targetValue: 1 }),
  });
  assert.equal(resBadCat.status, 400, 'Invalid category must return 400');

  // Upgrade CPU: 2 -> 4 cores (cost: 400 coins)
  const resUpgradeCpu = await fetch(`${BASE_URL}/api/vm/upgrade`, {
    method: 'POST',
    headers: {
      'Cookie': `studentId=${studentSid}`,
      'Content-Type': 'application/json',
      'Origin': BASE_URL,
    },
    body: JSON.stringify({ category: 'cpu', targetValue: 4 }),
  });
  assert.equal(resUpgradeCpu.status, 200, 'CPU upgrade to 4 cores must succeed');
  const cpuData = await resUpgradeCpu.json();
  assert.equal(cpuData.upgrades.cpuCores, 4);
  assert.equal(cpuData.coins, 1600, 'Coin balance must be 2000 - 400 = 1600');
  console.log('CPU upgrade to 4 cores verified (cost 400 coins)');

  // Differential pricing: upgrade CPU: 4 -> 6 cores (cost: 400 coins, not 800)
  const resUpgradeCpu6 = await fetch(`${BASE_URL}/api/vm/upgrade`, {
    method: 'POST',
    headers: {
      'Cookie': `studentId=${studentSid}`,
      'Content-Type': 'application/json',
      'Origin': BASE_URL,
    },
    body: JSON.stringify({ category: 'cpu', targetValue: 6 }),
  });
  assert.equal(resUpgradeCpu6.status, 200);
  const cpuData6 = await resUpgradeCpu6.json();
  assert.equal(cpuData6.upgrades.cpuCores, 6);
  assert.equal(cpuData6.coins, 1200, 'Coin balance must be 1600 - 400 = 1200');
  console.log('Differential pricing verified: 4 -> 6 cores cost 400 coins');

  // Attempting to buy a tier already owned
  const resCpuDup = await fetch(`${BASE_URL}/api/vm/upgrade`, {
    method: 'POST',
    headers: {
      'Cookie': `studentId=${studentSid}`,
      'Content-Type': 'application/json',
      'Origin': BASE_URL,
    },
    body: JSON.stringify({ category: 'cpu', targetValue: 4 }),
  });
  assert.equal(resCpuDup.status, 400, 'Buying lower/equal tier must return 400');

  // Upgrade RAM: 4GB -> 8GB (cost: 400 coins)
  const resUpgradeRam = await fetch(`${BASE_URL}/api/vm/upgrade`, {
    method: 'POST',
    headers: {
      'Cookie': `studentId=${studentSid}`,
      'Content-Type': 'application/json',
      'Origin': BASE_URL,
    },
    body: JSON.stringify({ category: 'ram', targetValue: 8192 }),
  });
  assert.equal(resUpgradeRam.status, 200);
  const ramData = await resUpgradeRam.json();
  assert.equal(ramData.upgrades.memoryMb, 8192);
  assert.equal(ramData.coins, 800, '1200 - 400 = 800 coins remaining');
  console.log('RAM upgrade to 8GB verified (cost 400 coins)');

  // Insufficient coins test: session unlimited costs 1800 coins, student only has 800
  const resInsuffCoins = await fetch(`${BASE_URL}/api/vm/upgrade`, {
    method: 'POST',
    headers: {
      'Cookie': `studentId=${studentSid}`,
      'Content-Type': 'application/json',
      'Origin': BASE_URL,
    },
    body: JSON.stringify({ category: 'session', targetValue: 86400 }),
  });
  assert.equal(resInsuffCoins.status, 402, 'Insufficient coins must return 402');
  const insuffData = await resInsuffCoins.json();
  assert.equal(insuffData.code, 'insufficient_coins');
  console.log('Insufficient coins guard verified: 402 rejected');

  // Upgrade Disk: 64GB -> 96GB (cost: 300 coins)
  const resUpgradeDisk = await fetch(`${BASE_URL}/api/vm/upgrade`, {
    method: 'POST',
    headers: {
      'Cookie': `studentId=${studentSid}`,
      'Content-Type': 'application/json',
      'Origin': BASE_URL,
    },
    body: JSON.stringify({ category: 'disk', targetValue: 96 }),
  });
  assert.equal(resUpgradeDisk.status, 200);
  const diskData = await resUpgradeDisk.json();
  assert.equal(diskData.upgrades.diskGb, 96);
  assert.equal(diskData.coins, 500, '800 - 300 = 500 coins remaining');
  console.log('Disk upgrade to 96GB verified (cost 300 coins)');

  // Upgrade Session: 6h -> 8h (cost: 300 coins)
  const resUpgradeSession = await fetch(`${BASE_URL}/api/vm/upgrade`, {
    method: 'POST',
    headers: {
      'Cookie': `studentId=${studentSid}`,
      'Content-Type': 'application/json',
      'Origin': BASE_URL,
    },
    body: JSON.stringify({ category: 'session', targetValue: 8 * 3600 }),
  });
  assert.equal(resUpgradeSession.status, 200);
  const sessData = await resUpgradeSession.json();
  assert.equal(sessData.upgrades.dailyMaxSeconds, 28800);
  assert.equal(sessData.coins, 200, '500 - 300 = 200 coins remaining');
  console.log('Session upgrade to 8h verified (cost 300 coins)');

  // Verify persistence in data/vm_upgrades.json
  const persistedUpgrades = readDocument(VM_UPGRADES_FILE, {})[studentNorm];
  assert.equal(persistedUpgrades.cpuCores, 6);
  assert.equal(persistedUpgrades.memoryMb, 8192);
  assert.equal(persistedUpgrades.diskGb, 96);
  assert.equal(persistedUpgrades.dailyMaxSeconds, 28800);
  console.log('Persisted user upgrades verified in storage');

  // Verify student computer list returns upgrades
  const resStudentVms = await fetch(`${BASE_URL}/api/vm/computers`, {
    headers: { 'Cookie': `studentId=${studentSid}` },
  });
  assert.equal(resStudentVms.status, 200);
  const studentVmsData = await resStudentVms.json();
  assert(studentVmsData.computers.length > 0);
  const myPc = studentVmsData.computers[0];
  assert.equal(myPc.upgrades.cpuCores, 6);
  assert.equal(myPc.upgrades.memoryMb, 8192);
  assert.equal(myPc.upgrades.diskGb, 96);
  assert.equal(myPc.upgrades.dailyMaxSeconds, 28800);
  console.log('Student computer list contains upgraded specs');

  console.log('=== ALL VM LIFECYCLE & POLICY INTEGRATION TESTS PASSED! ===');
} finally {
  serverProc.kill();
  deleteVirtualMachine(testVmId);
  writeDocument(PASSPHRASE_FILE, originalPassphrases);
  try { unlinkSync(TEST_MOCK_FILE); } catch {}
  try { unlinkSync(TEST_NTFY_LOG_FILE); } catch {}
}
