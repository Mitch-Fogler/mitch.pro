#!/usr/bin/env bun
/**
 * Generate an argon2id password hash (same as server.js Bun.password.hash).
 *
 * Usage:
 *   bun tools/hash_password.js 'my-password'
 *   bun tools/hash_password.js              # prompt (hidden if possible)
 *   echo -n 'my-password' | bun tools/hash_password.js --stdin
 */
import { spawnSync } from 'child_process';

const args = process.argv.slice(2);
const fromStdin = args.includes('--stdin') || args.includes('-');
const positional = args.filter((a) => a !== '--stdin' && a !== '-');

async function readPassword() {
  if (fromStdin) {
    const chunks = [];
    for await (const chunk of Bun.stdin.stream()) chunks.push(chunk);
    return Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/, '');
  }
  if (positional[0] != null) return positional[0];

  if (process.stdin.isTTY) {
    // Prefer read -s via bash when available so the password isn't echoed.
    const r = spawnSync(
      'bash',
      ['-lc', 'read -r -s -p "Password: " pw; echo >&2; printf %s "$pw"'],
      { stdio: ['inherit', 'pipe', 'inherit'], encoding: 'utf8' },
    );
    if (r.status === 0 && r.stdout != null) return String(r.stdout);
  }

  process.stdout.write('Password: ');
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

const password = await readPassword();
if (!password) {
  console.error('Empty password.');
  process.exit(1);
}

// Bun.password.hash defaults to argon2id (matches server enroll/login hashes).
const hash = await Bun.password.hash(password, {
  algorithm: 'argon2id',
  memoryCost: 65536,
  timeCost: 2,
});

console.log(hash);

if (process.env.VERIFY === '1') {
  const ok = await Bun.password.verify(password, hash);
  console.error(ok ? 'verify: ok' : 'verify: FAILED');
  if (!ok) process.exit(1);
}
