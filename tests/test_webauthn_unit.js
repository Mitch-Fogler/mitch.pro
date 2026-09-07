import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rpForHost, makeChallengeStore, publicCredentialView, guessCredentialName } from '../lib/webauthn.js';

// ── RP ID derivation ─────────────────────────────────────────────────────────
const ORIGINS = ['https://mitch.pro', 'https://mitchdog.com'];
assert.deepEqual(rpForHost('mitch.pro', ORIGINS), { rpId: 'mitch.pro', origin: 'https://mitch.pro' });
assert.deepEqual(rpForHost('www.mitch.pro', ORIGINS), null, 'subdomains are not passkey origins unless the RP ID is the registrable suffix');
assert.deepEqual(rpForHost('mitchdog.com', ORIGINS), { rpId: 'mitchdog.com', origin: 'https://mitchdog.com' });
assert.deepEqual(rpForHost('mitch.pro:443', ORIGINS), { rpId: 'mitch.pro', origin: 'https://mitch.pro' }, 'port stripped');
assert.equal(rpForHost('rjuhsd.school', ORIGINS), null, 'school site keeps password/SSO sign-in only');
assert.equal(rpForHost('sexypickleclub.com', ORIGINS), null);
assert.equal(rpForHost('', ORIGINS), null);
assert.equal(rpForHost('evil-mitch.pro', ORIGINS), null);
assert.equal(rpForHost('mitch.pro', []), null);

// ── Challenge store: issued hash-only, single-use, kind-scoped, expiring ─────
const store = makeChallengeStore();
const challenge = store.issue('login', 'a@b.co', 'mitch.pro');
assert.match(challenge, /^[A-Za-z0-9_-]+$/);
assert.equal(store.size(), 1);

const taken = store.take(challenge, 'login');
assert.equal(taken.kind, 'login');
assert.equal(taken.email, 'a@b.co');
assert.equal(taken.rpId, 'mitch.pro');
assert.equal(store.take(challenge, 'login'), null, 'challenge must be single-use');

const c2 = store.issue('register', 'x@y.z', 'mitch.pro');
assert.equal(store.take(c2, 'login'), null, 'register challenge must not satisfy a login take');
const c3 = store.issue('login', '', 'mitchdog.com');
assert.notEqual(c2, c3, 'challenges must be unique');

const expiredStore = makeChallengeStore(1);
const expired = expiredStore.issue('login');
await new Promise(r => setTimeout(r, 10));
assert.equal(expiredStore.take(expired, 'login'), null, 'expired challenges must be rejected');

// ── Client view never leaks key material ─────────────────────────────────────
const view = publicCredentialView({
  id: 'abc', publicKey: 'SECRET-MATERIAL', counter: 5, name: 'YubiKey', rpId: 'mitch.pro',
  deviceType: 'singleDevice', backedUp: false, transports: ['usb'], createdAt: 123, lastUsedAt: 456,
});
assert.equal(JSON.stringify(view).includes('SECRET-MATERIAL'), false);
assert.equal(view.publicKey, undefined, 'public key must not ship to the list view');
assert.equal(view.counter, undefined);
assert.deepEqual(Object.keys(view).sort(), ['backedUp', 'createdAt', 'deviceType', 'id', 'lastUsedAt', 'name', 'rpId', 'transports']);

// ── Default labels ────────────────────────────────────────────────────────────
assert.equal(guessCredentialName('Mozilla/5.0 (Windows NT 10.0) Chrome/126.0'), 'Passkey — Windows · Chrome');
assert.equal(guessCredentialName('Mozilla/5.0 (Macintosh) Safari/605'), 'Passkey — macOS · Safari');
assert.equal(guessCredentialName('curl/8.0'), 'Passkey');

// ── Server wiring ─────────────────────────────────────────────────────────────
const server = readFileSync('server.js', 'utf8');
const publicPaths = server.slice(server.indexOf('const PUBLIC_API_PATHS = new Set(['), server.indexOf(']);', server.indexOf('const PUBLIC_API_PATHS = new Set([')));
assert(publicPaths.includes("'/api/webauthn/login/options'"), 'login/options must be reachable pre-login');
assert(publicPaths.includes("'/api/webauthn/login/verify'"), 'login/verify must be reachable pre-login');
assert(!publicPaths.includes('register'), 'registration must stay behind the auth gate');
for (const endpoint of ['login/options', 'login/verify', 'register/options', 'register/verify', 'credentials']) {
  assert(server.includes(`'/api/webauthn/${endpoint}'`), `endpoint ${endpoint} must exist`);
}
assert(server.includes("PASSKEYS_FILE          = join(DATA_DIR, 'passkeys.json')") || server.includes("join(DATA_DIR, 'passkeys.json')"), 'passkey storage path must be defined');

const dataStore = readFileSync('lib/data_store.js', 'utf8');
assert(!dataStore.includes("passkeys.json"), 'passkeys.json must live in the DB store, not the preserved plaintext list');

// ── Storage round-trip against a real DATA_DIR ───────────────────────────────
const { writeDocument, readDocument, configureDataStore } = await import('../lib/data_store.js');
configureDataStore(join(mkdtempSync(join(tmpdir(), 'webauthn-test-')), 'mitchpro.db'));
const passkeyRecord = {
  id: 'cred-1', publicKey: 'cHVibGljS2V5', counter: 0, transports: ['internal'],
  deviceType: 'multiDevice', backedUp: true, name: 'Passkey — Chrome · Linux',
  rpId: 'mitch.pro', aaguid: '00000000-0000-0000-0000-000000000000', createdAt: 1, lastUsedAt: null,
};
writeDocument('passkeys.json', { 'alice@mitch.pro': [passkeyRecord] });
const loaded = readDocument('passkeys.json', {});
assert.deepEqual(loaded['alice@mitch.pro'], [passkeyRecord], 'credential must survive the JSON store round-trip');

// ── Client pages ─────────────────────────────────────────────────────────────
const enroll = readFileSync('webserver/enroll/index.html', 'utf8');
assert(enroll.includes('/vendor/simplewebauthn.browser.min.js'), 'enroll page must load the vendored WebAuthn bundle');
assert(enroll.includes('loginWithPasskey'), 'enroll page must expose the passkey sign-in entry point');
assert(enroll.includes('/api/webauthn/login/verify'), 'enroll page must verify against the passkey endpoint');

const prefs = readFileSync('webserver/preferences/index.html', 'utf8');
assert(prefs.includes('/vendor/simplewebauthn.browser.min.js'), 'settings page must load the vendored bundle');
assert(prefs.includes('/api/webauthn/register/verify'), 'settings page must enroll against the passkey endpoint');
assert(prefs.includes('Passkeys &amp; Security Keys'), 'settings page must show the management section');

console.log('WebAuthn RP mapping, challenge store, credential view, storage, and page wiring passed.');