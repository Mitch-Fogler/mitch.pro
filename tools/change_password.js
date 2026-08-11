#!/usr/bin/env bun
/**
 * Set / change a user's password hash in data/passwords.json (via mitchpro.db).
 *
 * Usage:
 *   bun tools/change_password.js user@student.rjuhsd.us 'new-password'
 *   bun tools/change_password.js user@student.rjuhsd.us          # prompt for password
 *   echo -n 'new-password' | bun tools/change_password.js user@student.rjuhsd.us --stdin
 *
 * Requires --yes to overwrite an existing hash (safety).
 * Creates the email key if missing (use carefully).
 */
import { spawnSync } from 'child_process';
import { join } from 'path';
import {
  configureDataStore,
  dataStorePaths,
  readDocument,
  writeDocument,
} from '../lib/data_store.js';

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

async function readPassword(args) {
  const fromStdin = args.includes('--stdin') || args.includes('-');
  const positional = args.filter((a) => !a.startsWith('-'));
  // positional[0] = email, positional[1] = optional password
  if (fromStdin) {
    const chunks = [];
    for await (const chunk of Bun.stdin.stream()) chunks.push(chunk);
    return Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/, '');
  }
  if (positional[1] != null) return positional[1];

  if (process.stdin.isTTY) {
    const r = spawnSync(
      'bash',
      ['-lc', 'read -r -s -p "New password: " pw; echo >&2; printf %s "$pw"'],
      { stdio: ['inherit', 'pipe', 'inherit'], encoding: 'utf8' },
    );
    if (r.status === 0 && r.stdout != null) return String(r.stdout);
  }

  process.stdout.write('New password: ');
  const reader = Bun.stdin.stream().getReader();
  const decoder = new TextDecoder();
  let line = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    line += decoder.decode(value, { stream: true });
    if (line.includes('\n')) break;
  }
  try { reader.releaseLock(); } catch {}
  return line.split('\n')[0].replace(/\r$/, '');
}

const args = process.argv.slice(2);
const force = args.includes('--yes') || args.includes('-y');
const create = args.includes('--create');
const positional = args.filter((a) => !a.startsWith('-'));
const emailRaw = positional[0];

if (!emailRaw) {
  console.error(`Usage: bun tools/change_password.js <email> [password] [--yes] [--create] [--stdin]`);
  process.exit(2);
}

const email = normalizeEmail(emailRaw);
if (!email.includes('@')) {
  console.error('Email looks invalid.');
  process.exit(2);
}

const password = await readPassword(args);
if (!password || password.length < 8) {
  console.error('Password must be at least 8 characters.');
  process.exit(1);
}

configureDataStore({ baseDir: process.cwd() });
const { dataDir } = dataStorePaths();
const passwordsFile = join(dataDir, 'passwords.json');
const passwords = readDocument(passwordsFile, {}) || {};

const existed = Object.prototype.hasOwnProperty.call(passwords, email);
if (existed && !force) {
  console.error(`Password already set for ${email}. Re-run with --yes to overwrite.`);
  process.exit(2);
}
if (!existed && !create && !force) {
  console.error(`No password entry for ${email}. Re-run with --create (or --yes) to add one.`);
  process.exit(2);
}

const hash = await Bun.password.hash(password, {
  algorithm: 'argon2id',
  memoryCost: 65536,
  timeCost: 2,
});

passwords[email] = hash;
writeDocument(passwordsFile, passwords);

const ok = await Bun.password.verify(password, hash);
console.log(JSON.stringify({
  ok: true,
  email,
  created: !existed,
  updated: existed,
  verify: ok,
  hash,
}, null, 2));
if (!ok) process.exit(1);
