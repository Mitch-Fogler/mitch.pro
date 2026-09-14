// tests/setup_session.js
//
// Generate valid session tokens for the admin and a normal user, and inject them
// (plus a temporary admin passphrase, a known invite code, and matching password
// hashes) into the data store so the integration tests can authenticate.
//
// Idempotent: re-running just overwrites the test entries.

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createHash, createHmac, randomBytes } from 'crypto';
import { configureDataStore, readDocument, writeDocument, upsertVirtualMachine } from '../lib/data_store.js';

const REPO_ROOT = import.meta.dir + '/..';
const DATA_DIR = join(REPO_ROOT, 'data');

configureDataStore({ baseDir: REPO_ROOT, dataDir: DATA_DIR });
const ID_SECRET_FILE = join(DATA_DIR, 'id_secret.key');
const NAMES_FILE = join(DATA_DIR, 'names.json');
const PASSPHRASE_FILE = join(DATA_DIR, 'admin_passphrase.json');
const PASSWORDS_FILE = join(DATA_DIR, 'passwords.json');
const INVITE_CODES_FILE = join(DATA_DIR, 'invite_codes.json');
const ADMINS_FILE = join(DATA_DIR, 'admins.json');

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

// Generate valid session tokens
const adminEmail = 'admin@mitch.pro';
const userEmail = 'test_normal_user@student.rjuhsd.us';
const secondUserEmail = 'test_vm_owner_b@student.rjuhsd.us';

const adminSid = makeEmailId(normalizeEmail(adminEmail), 0);
const userSid = makeEmailId(normalizeEmail(userEmail), 0);
const secondUserSid = makeEmailId(normalizeEmail(secondUserEmail), 0);

console.log('Generated Admin SID:', adminSid);
console.log('Generated User SID:', userSid);

// Inject them into names.json
const names = readDocument(NAMES_FILE, {});
names[adminSid] = adminEmail;
names[userSid] = userEmail;
names[secondUserSid] = secondUserEmail;
writeDocument(NAMES_FILE, names);

// Generate and write temporary admin passphrase
const tempPass = 'testpass123';
const passHash = await Bun.password.hash(tempPass);
const passphrases = readDocument(PASSPHRASE_FILE, {});
passphrases[normalizeEmail(adminEmail)] = {
  hash: passHash,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  setBy: adminEmail
};
writeDocument(PASSPHRASE_FILE, passphrases);

const adminsConfig = existsSync(ADMINS_FILE) ? readDocument(ADMINS_FILE, {}) : {};
adminsConfig.owners = ['admin@mitch.pro'];
adminsConfig.admins = ['admin2@mitch.pro'];
writeDocument(ADMINS_FILE, adminsConfig);

// Inject password hashes into passwords.json
const passwords = readDocument(PASSWORDS_FILE, {});
passwords[normalizeEmail(adminEmail)] = passHash;
passwords[normalizeEmail(userEmail)] = passHash;
passwords[normalizeEmail(secondUserEmail)] = passHash;
writeDocument(PASSWORDS_FILE, passwords);

upsertVirtualMachine({
  id: 'vm-auth-user-b', ownerEmail: normalizeEmail(secondUserEmail), ownerUserId: secondUserSid,
  vmid: 302, node: 'tartarus', guestType: 'qemu', friendlyName: 'User B Computer',
  hostname: 'user-b-computer', operatingSystem: 'Linux Mint Cinnamon', templateVmid: 9000,
  cpuCores: 4, memoryMb: 4096, diskGb: 40, status: 'assigned', createdAt: Date.now(),
});

for (const [id, vmid] of [['vm-auth-user-a', 303], ['vm-auth-stopped', 304], ['vm-auth-unreachable', 305]]) {
  upsertVirtualMachine({
    id, ownerEmail: normalizeEmail(userEmail), ownerUserId: userSid, vmid, node: 'tartarus',
    guestType: 'qemu', friendlyName: 'Integration Computer', hostname: 'integration-computer',
    operatingSystem: 'Ubuntu Desktop 24.04 LTS', templateVmid: 9010,
    cpuCores: 4, memoryMb: 4096, diskGb: 40, status: 'assigned', createdAt: Date.now(),
  });
}

// Inject referral invite code for the test user
const inviteCodes = existsSync(INVITE_CODES_FILE) ? readDocument(INVITE_CODES_FILE, {}) : {};
for (const k of Object.keys(inviteCodes)) {
  if (inviteCodes[k] === 'TESTINVITE123') {
    delete inviteCodes[k];
  }
}
inviteCodes[normalizeEmail(userEmail)] = 'TESTINVITE123';
writeDocument(INVITE_CODES_FILE, inviteCodes);

console.log('Session tokens, temporary admin passphrase, referral invite code, and password hashes successfully injected.');
