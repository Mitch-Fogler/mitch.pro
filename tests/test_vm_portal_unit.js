import { canAccessVmRecord, validateDesktopSession, VmOperationGate } from '../lib/vm_security.js';
import { ProxmoxDesktopService, ProxmoxServiceError } from '../lib/proxmox_desktop.js';

function assert(condition, message) { if (!condition) throw new Error(message); }
const vmA = { id: 'vm-a', ownerEmail: 'a@example.com', vmid: 301, node: 'node-a', guestType: 'qemu' };
const vmB = { id: 'vm-b', ownerEmail: 'b@example.com', vmid: 302, node: 'node-a', guestType: 'qemu' };
const actorA = { sid: 'sid-a', email: 'a@example.com', isAdmin: false };

assert(canAccessVmRecord(vmA, actorA), 'owner must access their computer');
assert(!canAccessVmRecord(vmB, actorA), 'User A must not access User B computer');
assert(canAccessVmRecord(vmB, { ...actorA, isAdmin: true }), 'admins must be able to support assigned computers');
assert(!canAccessVmRecord(null, actorA), 'nonexistent computer must be denied');

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

let setupCommand = null;
guestService.waitForGuestAgent = async () => {};
guestService.guestExec = async (_vmid, command, inputData) => { setupCommand = { command, inputData }; };
await guestService.enableFriendlyDesktopLogin(301, 'desktop');
assert(setupCommand.command.join(' ') === '/bin/sh -s', 'desktop setup must run through a fixed shell entrypoint');
assert(setupCommand.inputData.includes('user=desktop') && setupCommand.inputData.includes('AutomaticLogin=$user'), 'desktop setup must enable automatic graphical login for the validated user');
assert(setupCommand.inputData.includes('idle-delay 0'), 'desktop setup must keep browser desktops awake');
assert(setupCommand.inputData.includes('lock-enabled false'), 'desktop setup must not strand users at an idle lock screen');
let unsafeLoginError = null;
try { await guestService.enableFriendlyDesktopLogin(301, 'desktop\nroot'); } catch (error) { unsafeLoginError = error; }
assert(unsafeLoginError?.code === 'INVALID_DESKTOP_LOGIN', 'desktop login setup must reject unsafe usernames');

console.log('VM portal security and failure tests passed.');
