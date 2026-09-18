import {
  canAccessVmRecord,
  validateDesktopSession,
  VmOperationGate,
  VM_MAX_CONCURRENT_RUNNING,
  VM_DAILY_MAX_SECONDS,
  VM_EXTENSION_COOLDOWN_MS,
  VM_COOLDOWN_DURATION_MS,
  VM_OFFPAGE_INACTIVITY_MS,
  VM_DEFAULT_CPU_CORES,
  VM_DEFAULT_MEMORY_MB,
  VM_DEFAULT_BALLOON_MB,
  VM_DEFAULT_DISK_GB,
  getRemainingDailyVmSeconds,
  isDailyVmLimitReached,
  getVmDayKey,
  isEligibleForFreeVm,
  canUserExtend,
  computeCooldownRemaining,
  isVmInactive,
} from '../lib/vm_security.js';
import { ProxmoxDesktopService, ProxmoxServiceError } from '../lib/proxmox_desktop.js';

function assert(condition, message) { if (!condition) throw new Error(message); }
const vmA = { id: 'vm-a', ownerEmail: 'a@example.com', vmid: 301, node: 'node-a', guestType: 'qemu' };
const vmB = { id: 'vm-b', ownerEmail: 'b@example.com', vmid: 302, node: 'node-a', guestType: 'qemu' };
const actorA = { sid: 'sid-a', email: 'a@example.com', isAdmin: false };

assert(canAccessVmRecord(vmA, actorA), 'owner must access their computer');
assert(!canAccessVmRecord(vmB, actorA), 'User A must not access User B computer');
assert(canAccessVmRecord(vmB, { ...actorA, isAdmin: true }), 'admins must be able to support assigned computers');
assert(!canAccessVmRecord(null, actorA), 'nonexistent computer must be denied');

const vmAdmin2 = { id: 'vm-c', ownerEmail: 'admin2@example.com', vmid: 303, node: 'node-a', guestType: 'qemu' };
const actorAdmin1 = { sid: 'sid-admin1', email: 'admin1@example.com', isAdmin: true };
const isTestAdmin = email => email === 'admin1@example.com' || email === 'admin2@example.com';

assert(!canAccessVmRecord(vmAdmin2, actorAdmin1, isTestAdmin), 'admin must not access another admin computer');
assert(canAccessVmRecord(vmAdmin2, { ...actorAdmin1, email: 'admin2@example.com' }, isTestAdmin), 'admin owner must access their own computer');
assert(canAccessVmRecord(vmB, actorAdmin1, isTestAdmin), 'admin must access regular user computer');

const vmAdminWithFlag = { id: 'vm-d', ownerEmail: 'admin2@example.com', ownerIsAdmin: true, vmid: 304, node: 'node-a', guestType: 'qemu' };
assert(!canAccessVmRecord(vmAdminWithFlag, actorAdmin1), 'admin must not access another admin computer with ownerIsAdmin flag');

const sessionAdminToAdmin = { sid: 'sid-admin1', actorEmail: 'admin1@example.com', recordId: 'vm-c', vmid: 303, node: 'node-a', expiresAt: 2000, used: false };
assert(validateDesktopSession(sessionAdminToAdmin, actorAdmin1, vmAdmin2, 1000, isTestAdmin).status === 403, 'session from admin to another admin computer must be forbidden');

const goodSession = { sid: 'sid-a', actorEmail: 'a@example.com', recordId: 'vm-a', vmid: 301, node: 'node-a', expiresAt: 2000, used: false };
assert(validateDesktopSession(goodSession, actorA, vmA, 1000).ok, 'valid desktop connection must be accepted');
assert(validateDesktopSession(goodSession, actorA, vmA, 2001).status === 401, 'expired desktop connection must be rejected');
assert(validateDesktopSession({ ...goodSession, used: true }, actorA, vmA, 1000).status === 401, 'reused desktop connection must be rejected');
assert(validateDesktopSession(goodSession, actorA, vmB, 1000).status === 403, 'WebSocket ownership mismatch must be rejected');

const gate = new VmOperationGate(3000);
assert(gate.acquire('vm-a', 'restart', 1000), 'first power request must be accepted');
assert(!gate.acquire('vm-a', 'restart', 1100), 'repeated power request must be rejected');
gate.release('vm-a', 1100);
assert(!gate.acquire('vm-a', 'restart', 4000), 'request must remain blocked during cooldown');
assert(gate.acquire('vm-a', 'restart', 4101), 'request must be accepted after cooldown');

const stoppedService = new ProxmoxDesktopService({ host: 'localhost', node: 'node-a', legacyToken: 'token' });
stoppedService.getStatus = async () => ({ state: 'stopped' });
let stoppedError = null;
try { await stoppedService.createConsole(vmA); } catch (error) { stoppedError = error; }
assert(stoppedError instanceof ProxmoxServiceError && stoppedError.code === 'STOPPED', 'stopped computer must not create a console');

const failedService = new ProxmoxDesktopService({ host: 'localhost', node: 'node-a', legacyToken: 'token' });
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => new Response(JSON.stringify({ errors: { auth: 'secret upstream detail' } }), { status: 500, headers: { 'Content-Type': 'application/json' } });
let failedError = null;
try { await failedService.listGuests(); } catch (error) { failedError = error; }
finally { globalThis.fetch = originalFetch; }
assert(failedError instanceof ProxmoxServiceError && failedError.code === 'UPSTREAM_REJECTED', 'failed Proxmox API call must be normalized');
assert(!failedError.message.includes('secret upstream detail'), 'raw Proxmox errors must not escape');

for (const invalid of [null, '', 'abc', 99, -1]) {
  let error = null;
  try { failedService.assertVmid(invalid); } catch (caught) { error = caught; }
  assert(error?.code === 'INVALID_VM', `invalid VM ID ${String(invalid)} must be rejected`);
}

const guestService = new ProxmoxDesktopService({ host: 'localhost', node: 'node-a', legacyToken: 'token' });
const guestCalls = [];
guestService.request = async (method, path, params) => {
  guestCalls.push({ method, path, params });
  if (path.endsWith('/agent/exec')) return { pid: 42 };
  if (path.includes('/agent/exec-status')) return { exited: 1, exitcode: 0 };
  throw new Error(`Unexpected guest-agent request: ${method} ${path}`);
};
await guestService.guestExec(301, ['/usr/bin/id', 'desktop']);
assert(JSON.stringify(guestCalls[0].params.command) === '["/usr/bin/id","desktop"]', 'guest commands must use the Proxmox repeated-parameter array encoding');

// --- Guest Agent Ping & Provisioning Tests ---
const pingCalls = [];
const pingService = new ProxmoxDesktopService({ host: 'localhost', node: 'node-a', legacyToken: 'token' });
pingService.request = async (method, path, params) => {
  pingCalls.push({ method, path, params });
  if (method === 'POST' && path.endsWith('/agent/ping')) return {};
  throw new Error(`Unexpected request: ${method} ${path}`);
};
await pingService.waitForGuestAgent(301, 5000);
assert(pingCalls.length === 1 && pingCalls[0].method === 'POST', 'guest agent ping must use POST method (GET returns 501 on Proxmox VE)');
assert(pingCalls[0].path === '/nodes/node-a/qemu/301/agent/ping', 'guest agent ping must target the correct VM node and vmid');

let pingTimeoutError = null;
const failingPingService = new ProxmoxDesktopService({ host: 'localhost', node: 'node-a', legacyToken: 'token' });
failingPingService.request = async () => { throw new Error('Unreachable'); };
try { await failingPingService.waitForGuestAgent(301, 100); } catch (e) { pingTimeoutError = e; }
assert(pingTimeoutError instanceof ProxmoxServiceError && pingTimeoutError.code === 'GUEST_SETUP_FAILED', 'unreachable guest agent ping must time out with GUEST_SETUP_FAILED');

let setupCommand = null;
guestService.waitForGuestAgent = async () => {};
guestService.guestExec = async (_vmid, command, inputData) => { setupCommand = { command, inputData }; };
await guestService.enableFriendlyDesktopLogin(301, 'desktop');
assert(setupCommand.command.join(' ') === '/bin/sh -s', 'desktop setup must run through a fixed shell entrypoint');
assert(setupCommand.inputData.includes('user=desktop') && setupCommand.inputData.includes('AutomaticLogin=$user'), 'desktop setup must enable automatic graphical login for the validated user');
assert(setupCommand.inputData.includes('idle-delay 0'), 'desktop setup must keep browser desktops awake');
assert(setupCommand.inputData.includes('lock-enabled false'), 'desktop setup must not strand users at an idle lock screen');
assert(setupCommand.inputData.includes('getent group "$user"'), 'desktop setup must check for existing groups before useradd');

// Test password provisioning in enableFriendlyDesktopLogin
await guestService.enableFriendlyDesktopLogin(301, 'studentuser', 'SuperSecret123!');
assert(setupCommand.inputData.includes('chpasswd'), 'desktop setup must set user password when provided');
const expectedB64 = Buffer.from('SuperSecret123!', 'utf8').toString('base64');
assert(setupCommand.inputData.includes(`pass_b64="${expectedB64}"`), 'desktop setup must safely base64 encode the user password');

let unsafeLoginError = null;
try { await guestService.enableFriendlyDesktopLogin(301, 'desktop\nroot'); } catch (error) { unsafeLoginError = error; }
assert(unsafeLoginError?.code === 'INVALID_DESKTOP_LOGIN', 'desktop login setup must reject unsafe usernames');

// --- Desktop Password Validation (min 8 chars, max 128 chars) ---
const login8 = guestService.validateDesktopLogin('studentuser', '12345678');
assert(login8.username === 'studentuser' && login8.password === '12345678', '8-character password must be accepted');
const login128 = guestService.validateDesktopLogin('studentuser', 'A'.repeat(128));
assert(login128.password.length === 128, '128-character password must be accepted');

let shortPassError = null;
try { guestService.validateDesktopLogin('studentuser', '1234567'); } catch (e) { shortPassError = e; }
assert(shortPassError?.code === 'INVALID_DESKTOP_LOGIN', '7-character password must be rejected');

let longPassError = null;
try { guestService.validateDesktopLogin('studentuser', 'A'.repeat(129)); } catch (e) { longPassError = e; }
assert(longPassError?.code === 'INVALID_DESKTOP_LOGIN', '129-character password must be rejected');

let badCharError = null;
try { guestService.validateDesktopLogin('studentuser', 'password\n123'); } catch (e) { badCharError = e; }
assert(badCharError?.code === 'INVALID_DESKTOP_LOGIN', 'password with newline must be rejected');

// --- Free VM Eligibility Policy ---
assert(isEligibleForFreeVm('john.doe@student.rjuhsd.us'), '@student.rjuhsd.us email must be eligible for free VM');
assert(isEligibleForFreeVm('student@student.mitch.pro'), '@student.mitch.pro email must be eligible for free VM');
assert(!isEligibleForFreeVm('user@gmail.com'), 'normal public email must not be eligible by default');
assert(!isEligibleForFreeVm('teacher@rjuhsd.us'), 'staff @rjuhsd.us email must not be eligible unless premium or admin');
assert(isEligibleForFreeVm('user@gmail.com', { isPremium: true }), 'premium users must be eligible for free VM');
assert(isEligibleForFreeVm('admin@mitch.pro', { isAdmin: true }), 'admins must always be eligible for free VM');
assert(!isEligibleForFreeVm(''), 'empty email must not be eligible');
assert(!isEligibleForFreeVm(null), 'null email must not be eligible');

// --- 24-hour Extension Limit (1 extension per day) ---
const now = Date.now();
assert(canUserExtend(null, { isAdmin: false, now }), 'user with no prior extension must be allowed to extend');
assert(!canUserExtend(now - (60 * 1000), { isAdmin: false, now }), 'user with extension 1 minute ago must be denied');
assert(!canUserExtend(now - (23 * 60 * 60 * 1000), { isAdmin: false, now }), 'user with extension 23 hours ago must be denied');
assert(canUserExtend(now - (24 * 60 * 60 * 1000), { isAdmin: false, now }), 'user with extension 24 hours ago must be allowed');
assert(canUserExtend(now - (25 * 60 * 60 * 1000), { isAdmin: false, now }), 'user with extension 25 hours ago must be allowed');
assert(canUserExtend(now - 1000, { isAdmin: true, now }), 'admin can always extend regardless of cooldown');

// --- 30-minute Cooldown After Session End ---
assert(computeCooldownRemaining(now + 1800 * 1000, { isAdmin: false, now }) === 1800, 'cooldown should report 1800 seconds remaining');
assert(computeCooldownRemaining(now + 60 * 1000, { isAdmin: false, now }) === 60, 'cooldown should report 60 seconds remaining');
assert(computeCooldownRemaining(now - 1000, { isAdmin: false, now }) === 0, 'expired cooldown should report 0 seconds remaining');
assert(computeCooldownRemaining(null, { isAdmin: false, now }) === 0, 'no cooldown should report 0 seconds remaining');
assert(computeCooldownRemaining(now + 1800 * 1000, { isAdmin: true, now }) === 0, 'admin should have 0 cooldown remaining');

// --- 10-minute Off-Page Inactivity Detection ---
assert(!isVmInactive(now - (9 * 60 * 1000), { now }), 'activity 9 minutes ago must not be considered inactive');
assert(isVmInactive(now - (10 * 60 * 1000), { now }), 'activity 10 minutes ago must be considered inactive');
assert(isVmInactive(now - (15 * 60 * 1000), { now }), 'activity 15 minutes ago must be considered inactive');
assert(!isVmInactive(null, { now }), 'null presence must not be marked inactive');

// --- Capacity Limit ---
assert(VM_MAX_CONCURRENT_RUNNING === 6, 'max concurrent running VMs must be 6');
assert(VM_COOLDOWN_DURATION_MS === 30 * 60 * 1000, 'cooldown duration must be 30 minutes');
assert(VM_EXTENSION_COOLDOWN_MS === 24 * 60 * 60 * 1000, 'extension cooldown must be 24 hours');
assert(VM_OFFPAGE_INACTIVITY_MS === 10 * 60 * 1000, 'offpage inactivity timeout must be 10 minutes');

// --- 6-Hour Daily Max and Admin Exemption ---
assert(VM_DAILY_MAX_SECONDS === 6 * 3600, 'daily max VM seconds must be 6 hours (21600 seconds)');
assert(VM_DEFAULT_CPU_CORES === 6, 'default CPU cores must be 6');
assert(VM_DEFAULT_MEMORY_MB === 16384, 'default memory must be 16384 MB (16 GB)');
assert(VM_DEFAULT_BALLOON_MB === 4096, 'default balloon memory must be 4096 MB (4 GB)');
assert(VM_DEFAULT_DISK_GB === 64, 'default disk must be 64 GB');

assert(getRemainingDailyVmSeconds(0) === 21600, '0 used seconds must leave 21600 seconds remaining');
assert(getRemainingDailyVmSeconds(3600) === 18000, '1 hour used must leave 5 hours remaining');
assert(getRemainingDailyVmSeconds(21600) === 0, '6 hours used must leave 0 seconds remaining');
assert(getRemainingDailyVmSeconds(25000) === 0, 'over 6 hours used must leave 0 seconds remaining');
assert(getRemainingDailyVmSeconds(21600, { isAdmin: true }) === Infinity, 'admin must have Infinity remaining seconds');
assert(getRemainingDailyVmSeconds(50000, { isAdmin: true }) === Infinity, 'admin must have Infinity remaining seconds regardless of usage');

assert(!isDailyVmLimitReached(0), '0 used must not reach daily limit');
assert(!isDailyVmLimitReached(21599), '21599s used must not reach daily limit');
assert(isDailyVmLimitReached(21600), '21600s used must reach daily limit');
assert(isDailyVmLimitReached(30000), '30000s used must reach daily limit');
assert(!isDailyVmLimitReached(21600, { isAdmin: true }), 'admin must not be subject to daily limit');
assert(!isDailyVmLimitReached(99999, { isAdmin: true }), 'admin must not be subject to daily limit even with high usage');

assert(getVmDayKey(new Date('2026-09-17T12:00:00Z').getTime()) === '2026-09-17', 'getVmDayKey must return YYYY-MM-DD');

console.log('VM portal security, policy, and failure tests passed.');

