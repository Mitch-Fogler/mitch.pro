import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { Database } from 'bun:sqlite';
import webpush from 'web-push';

const root = join(import.meta.dir, '..');
const dataDir = mkdtempSync(join(tmpdir(), 'mitch-auth-session-'));
const port = 6867;
const base = `http://127.0.0.1:${port}`;
const vapid = webpush.generateVAPIDKeys();
const env = {
  ...process.env,
  NODE_ENV: 'test', PORT: String(port), DATA_DIR: dataDir,
  VAPID_PUBLIC_KEY: vapid.publicKey, VAPID_PRIVATE_KEY: vapid.privateKey,
  PVE_URL: 'https://127.0.0.1:1', PROXMOX_HOST: '127.0.0.1', PROXMOX_PORT: '1',
};
let server;

async function start() {
  server = Bun.spawn(['bun', join(root, 'server.js')], {
    cwd: root, env, stdio: ['ignore', 'ignore', 'ignore'],
  });
  for (let i = 0; i < 80; i++) {
    if (server.exitCode !== null) throw new Error(`Test server exited: ${server.exitCode}`);
    try {
      if ((await fetch(base + '/enroll/')).ok) return;
    } catch {}
    await Bun.sleep(250);
  }
  throw new Error('Test server did not start');
}

async function stop() {
  if (!server) return;
  server.kill();
  await server.exited;
  server = null;
}

function sessionCookie(response) {
  const header = response.headers.getSetCookie().find(value => value.startsWith('mitch_session='));
  assert.ok(header, 'auth response must set mitch_session');
  assert.match(header, /Max-Age=2592000/);
  assert.match(header, /HttpOnly/);
  return header.split(';', 1)[0];
}

async function post(path, payload, cookie = '') {
  return fetch(base + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(payload),
  });
}

try {
  await start();
  const email = `auth-session-${Date.now()}@example.com`;
  const password = ' padded-pass-123 ';
  const signup = await post('/api/signup', { email, password, recaptcha_token: 'test' });
  assert.equal(signup.status, 200, await signup.text());

  let signupCodes;
  const codesFile = join(dataDir, 'signup_codes.json');
  if (existsSync(codesFile)) signupCodes = JSON.parse(readFileSync(codesFile, 'utf8'));
  else {
    const db = new Database(join(dataDir, 'mitchpro.db'));
    const row = db.query("SELECT content FROM json_documents WHERE path LIKE '%signup_codes.json'").get();
    assert.ok(row, 'signup code must be persisted');
    signupCodes = JSON.parse(row.content);
    db.close();
  }
  const code = signupCodes[email].code;

  const verified = await post('/api/verify-signup', { email, code, recaptcha_token: 'test' });
  assert.equal(verified.status, 200, await verified.text());
  const signupCookie = sessionCookie(verified);
  const meAfterSignup = await fetch(base + '/api/me', { headers: { Cookie: signupCookie } });
  assert.equal(meAfterSignup.status, 200, await meAfterSignup.clone().text());
  assert.equal((await meAfterSignup.json()).rawEmail, email, 'newly verified account must resolve immediately');

  const wrongPassword = await post('/api/login', { email, password: password.trim(), recaptcha_token: 'test' });
  assert.equal(wrongPassword.status, 401, 'signup must preserve password whitespace');
  const login = await post('/api/login', { email, password, recaptcha_token: 'test' });
  assert.equal(login.status, 200, await login.text());
  const loginCookie = sessionCookie(login);
  const meAfterLogin = await fetch(base + '/api/me', { headers: { Cookie: loginCookie } });
  assert.equal(meAfterLogin.status, 200);
  assert.equal((await meAfterLogin.json()).rawEmail, email);

  const coinsFile = join(dataDir, 'coins.json');
  const coinData = JSON.stringify({ [email]: 1250 });
  if (process.platform === 'win32') writeFileSync(coinsFile, coinData);
  else {
    const coinDb = new Database(join(dataDir, 'mitchpro.db'));
    coinDb.query('INSERT OR REPLACE INTO json_documents (path, content, updated_at) VALUES (?, ?, ?)')
      .run('data/coins.json', coinData, Date.now());
    coinDb.close();
  }
  const overBalance = await post('/api/casino/coinflip', { amount: 1300, side: 'heads' }, loginCookie);
  assert.equal(overBalance.status, 400, 'bets must not exceed the wallet');
  const highBet = await post('/api/casino/coinflip', { amount: 1000, side: 'heads' }, loginCookie);
  assert.equal(highBet.status, 200, await highBet.text());

  await stop();
  await start();
  assert.equal((await fetch(base + '/api/me', { headers: { Cookie: loginCookie } })).status, 200,
    'session must survive a server restart');
  console.log('Auth and casino integration: signup, login, identity cache, high bets, balance guard, and persistent sessions passed.');
} finally {
  await stop();
  const prefix = resolve(tmpdir()) + sep;
  assert.ok(resolve(dataDir).startsWith(prefix), 'only the owned temporary data directory may be removed');
  for (let i = 0; i < 10; i++) {
    try { rmSync(dataDir, { recursive: true, force: true }); break; }
    catch (error) {
      if (error.code !== 'EBUSY' || i === 9) {
        console.warn(`Could not remove temporary test data at ${dataDir}: ${error.message}`);
        break;
      }
      await Bun.sleep(250);
    }
  }
}
