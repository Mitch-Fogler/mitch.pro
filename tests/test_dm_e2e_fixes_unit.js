import assert from 'node:assert/strict';
import { join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { createHash, createHmac } from 'node:crypto';
import { configureDataStore, readDocument, writeDocument } from '../lib/data_store.js';

const REPO_ROOT = join(import.meta.dir, '..');
const DATA_DIR = join(REPO_ROOT, 'data');
configureDataStore({ baseDir: REPO_ROOT, dataDir: DATA_DIR });

const ID_SECRET_FILE = join(DATA_DIR, 'id_secret.key');
assert(existsSync(ID_SECRET_FILE), 'id_secret.key must exist');
const ID_SECRET = readFileSync(ID_SECRET_FILE);
const NAMES_FILE = join(DATA_DIR, 'names.json');
const PROFILES_FILE = join(DATA_DIR, 'profiles.json');
const DMS_FILE = join(DATA_DIR, 'dms.json');

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

const aliceEmail = 'alice_test_e2e@student.rjuhsd.us';
const aliceNorm = normalizeEmail(aliceEmail);
const aliceSid = makeEmailId(aliceNorm, 0);
const aliceUsername = 'aliceteste2e';

const bobEmail = 'bob_test_e2e@student.rjuhsd.us';
const bobNorm = normalizeEmail(bobEmail);
const bobSid = makeEmailId(bobNorm, 0);
const bobUsername = 'bobteste2e';

// Setup test users in names and profiles
const origNames = readDocument(NAMES_FILE, {});
const origProfiles = readDocument(PROFILES_FILE, {});
const origDms = readDocument(DMS_FILE, []);

const names = { ...origNames };
names[aliceSid] = aliceEmail;
names[bobSid] = bobEmail;
writeDocument(NAMES_FILE, names);

const profiles = { ...origProfiles };
profiles[aliceNorm] = {
  username: aliceUsername,
  displayName: 'Alice E2E'
};
profiles[bobNorm] = {
  username: bobUsername,
  displayName: 'Bob E2E'
};
writeDocument(PROFILES_FILE, profiles);

const PORT = 6854;
process.env.PORT = String(PORT);
process.env.NODE_ENV = 'test';
process.env.DEV_TEST_ACCESS = '0';

console.log('--- Starting server for DM & E2E fixes unit tests on port ' + PORT + ' ---');
const serverProc = Bun.spawn(['bun', join(REPO_ROOT, 'server.js')], {
  env: { ...process.env, PORT: String(PORT), NODE_ENV: 'test' },
  stdio: ['ignore', 'inherit', 'inherit']
});

const BASE_URL = `http://localhost:${PORT}`;
for (let i = 0; i < 30; i++) {
  try {
    await fetch(`${BASE_URL}/api/site-info`);
    break;
  } catch {
    await new Promise(r => setTimeout(r, 400));
  }
}

try {
  console.log('\n--- 1. Testing /api/me returns identity fields ---');
  const meRes = await fetch(`${BASE_URL}/api/me`, {
    headers: { 'Cookie': `studentId=${aliceSid}` }
  });
  assert.equal(meRes.status, 200, '/api/me status must be 200');
  const meData = await meRes.json();
  assert.equal(meData.rawEmail, aliceEmail, 'rawEmail must match');
  assert.equal(meData.normEmail, aliceNorm, 'normEmail must match');
  assert.equal(meData.username, aliceUsername, 'username must match');
  assert.equal(meData.displayName, 'Alice E2E', 'displayName must match');
  assert(typeof meData.displayEmail === 'string' && meData.displayEmail.length > 0, 'displayEmail must exist');
  console.log('GET /api/me passed with identity fields:', {
    rawEmail: meData.rawEmail,
    normEmail: meData.normEmail,
    username: meData.username,
    displayName: meData.displayName
  });

  console.log('\n--- 2. Testing /api/dm/send to a username with fallback (plaintext) ---');
  const sendFallbackRes = await fetch(`${BASE_URL}/api/dm/send`, {
    method: 'POST',
    headers: {
      'Cookie': `studentId=${aliceSid}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      to: bobUsername,
      text: 'Hello Bob! This is a fallback unencrypted message.'
    })
  });
  assert.equal(sendFallbackRes.status, 200, '/api/dm/send status must be 200');
  const sendFallbackData = await sendFallbackRes.json();
  assert.equal(sendFallbackData.success, true, 'send response success must be true');
  console.log('Alice sent fallback plaintext DM to bob via username');

  console.log('\n--- 3. Testing /api/dm/send to a username with E2E envelope ---');
  const fakePub1 = '04' + 'ab'.repeat(64);
  const fakePub2 = '04' + 'cd'.repeat(64);
  const fakeIv = '0123456789abcdef01234567';
  const fakeCipher = 'cafebabe12345678';
  const sendE2eRes = await fetch(`${BASE_URL}/api/dm/send`, {
    method: 'POST',
    headers: {
      'Cookie': `studentId=${aliceSid}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      to: bobUsername,
      text: JSON.stringify({
        e2e: true,
        version: 3,
        senderPubKey: fakePub1,
        recipientPubKey: fakePub2,
        iv: fakeIv,
        ciphertext: fakeCipher
      })
    })
  });
  assert.equal(sendE2eRes.status, 200, '/api/dm/send status must be 200');
  const sendE2eData = await sendE2eRes.json();
  assert.equal(sendE2eData.success, true, 'send response success must be true');
  console.log('Alice sent E2E encrypted envelope DM to bob via username');

  console.log('\n--- 4. Testing Bob inbox retrieval with Alice username & full email ---');
  // Bob retrieves with Alice username
  const bobInboxByUsernameRes = await fetch(`${BASE_URL}/api/dm/inbox?with=${aliceUsername}`, {
    headers: { 'Cookie': `studentId=${bobSid}` }
  });
  assert.equal(bobInboxByUsernameRes.status, 200);
  const bobInboxData = await bobInboxByUsernameRes.json();
  assert(Array.isArray(bobInboxData.messages), 'messages must be an array');
  assert.equal(bobInboxData.messages.length, 2, 'Bob must receive both fallback and E2E messages');
  assert(bobInboxData.messages[0].text.includes('Hello Bob!'), 'First message must be fallback');
  assert(bobInboxData.messages[1].text.includes('"e2e":true'), 'Second message must be E2E envelope');
  console.log('Bob retrieved both messages querying with=aliceteste2e');

  // Bob retrieves with Alice full email
  const bobInboxByEmailRes = await fetch(`${BASE_URL}/api/dm/inbox?with=${encodeURIComponent(aliceEmail)}`, {
    headers: { 'Cookie': `studentId=${bobSid}` }
  });
  assert.equal(bobInboxByEmailRes.status, 200);
  const bobInboxByEmailData = await bobInboxByEmailRes.json();
  assert.equal(bobInboxByEmailData.messages.length, 2, 'Bob must receive both messages querying with full email');
  console.log('Bob retrieved both messages querying with full email');

  console.log('\n--- 5. Testing Alice inbox retrieval with Bob username & full email ---');
  const aliceInboxByUsernameRes = await fetch(`${BASE_URL}/api/dm/inbox?with=${bobUsername}`, {
    headers: { 'Cookie': `studentId=${aliceSid}` }
  });
  assert.equal(aliceInboxByUsernameRes.status, 200);
  const aliceInboxData = await aliceInboxByUsernameRes.json();
  assert.equal(aliceInboxData.messages.length, 2, 'Alice must receive both sent messages querying with=bobteste2e');
  console.log('Alice retrieved both messages querying with=bobteste2e');

  console.log('\n--- 6. Testing /api/dm/mark-read with username ---');
  const markReadRes = await fetch(`${BASE_URL}/api/dm/mark-read`, {
    method: 'POST',
    headers: {
      'Cookie': `studentId=${bobSid}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from: aliceUsername })
  });
  assert.equal(markReadRes.status, 200);
  const markReadData = await markReadRes.json();
  assert.equal(markReadData.success, true);

  const bobInboxAfterReadRes = await fetch(`${BASE_URL}/api/dm/inbox?with=${aliceUsername}`, {
    headers: { 'Cookie': `studentId=${bobSid}` }
  });
  const bobInboxAfterReadData = await bobInboxAfterReadRes.json();
  for (const m of bobInboxAfterReadData.messages) {
    assert.equal(m.read, true, 'Messages should be marked as read');
  }
  console.log('/api/dm/mark-read with username passed: messages marked read');

  console.log('\n--- 7. Testing /api/dm/clear with username ---');
  const clearRes = await fetch(`${BASE_URL}/api/dm/clear`, {
    method: 'POST',
    headers: {
      'Cookie': `studentId=${aliceSid}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ with: bobUsername })
  });
  assert.equal(clearRes.status, 200);
  const clearData = await clearRes.json();
  assert.equal(clearData.success, true);

  // Alice inbox should be empty
  const aliceInboxAfterClearRes = await fetch(`${BASE_URL}/api/dm/inbox?with=${bobUsername}`, {
    headers: { 'Cookie': `studentId=${aliceSid}` }
  });
  const aliceInboxAfterClearData = await aliceInboxAfterClearRes.json();
  assert.equal(aliceInboxAfterClearData.messages.length, 0, 'Alice cleared messages, should see 0');

  // Bob inbox should still retain messages
  const bobInboxAfterAliceClearRes = await fetch(`${BASE_URL}/api/dm/inbox?with=${aliceUsername}`, {
    headers: { 'Cookie': `studentId=${bobSid}` }
  });
  const bobInboxAfterAliceClearData = await bobInboxAfterAliceClearRes.json();
  assert.equal(bobInboxAfterAliceClearData.messages.length, 2, 'Bob did not clear messages, should still see 2');
  console.log('/api/dm/clear with username passed: Alice sees 0, Bob still sees 2');

  console.log('\n--- 8. Testing notification body security for fallback & E2E ---');
  // Check that server code never emits raw message text in push notifications
  const serverCode = readFileSync(join(REPO_ROOT, 'server.js'), 'utf8');
  assert(
    serverCode.includes("const getNotificationBody = (t, img) => encryptedEnvelope\n        ? '[Secure Message]'\n        : (img ? '[Secure Message: Attachment]' : '[Secure Message]');") ||
    serverCode.includes("(img ? '[Secure Message: Attachment]' : '[Secure Message]')"),
    'Server notification body must never leak plaintext in notifications'
  );
  console.log('Notification body security check passed: notifications always sanitized');

  console.log('\n=== ALL ENCRYPT / E2E FIXES UNIT TESTS PASSED SUCCESSFULLY! ===\n');
} finally {
  serverProc.kill();
  // Restore names and profiles
  try {
    writeDocument(NAMES_FILE, origNames);
    writeDocument(PROFILES_FILE, origProfiles);
    writeDocument(DMS_FILE, origDms);
  } catch (err) {
    console.error('Failed restoring test data files:', err);
  }
}
