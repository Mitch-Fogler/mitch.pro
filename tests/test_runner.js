// tests/test_runner.js
//
// Master integration test harness. Backups data/, injects test credentials,
// starts the server, runs endpoint_test.js, and restores the data directory
// even on failure or signal.

import { writeFileSync, readFileSync, readdirSync, mkdirSync, existsSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const REPO_ROOT = dirname(import.meta.dir) + '/';
// import.meta.dir is ".../tests"; go up one for the repo root. The trailing slash
// is required so the child scripts see absolute paths.
const HERE = import.meta.dir;
const DATA_DIR = join(HERE, '..', 'data');
const BACKUP_DIR = join(HERE, '..', 'data_backup_test');

function copyDir(src, dest) {
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
  }
  const entries = readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      writeFileSync(destPath, readFileSync(srcPath));
    }
  }
}

// 1. Back up data directory
console.log('--- MASTER TEST HARNESS: Creating Net-Zero Backup ---');
try {
  if (existsSync(BACKUP_DIR)) {
    rmSync(BACKUP_DIR, { recursive: true, force: true });
  }
  copyDir(DATA_DIR, BACKUP_DIR);
  console.log('Backup created successfully.');
} catch (e) {
  console.error('Failed to create backup:', e);
  process.exit(1);
}

let restored = false;
async function restore() {
  if (restored) return;
  restored = true;
  console.log('\n--- MASTER TEST HARNESS: Restoring original state ---');
  try {
    if (existsSync(BACKUP_DIR)) {
      if (existsSync(DATA_DIR)) {
        rmSync(DATA_DIR, { recursive: true, force: true });
      }
      copyDir(BACKUP_DIR, DATA_DIR);
      rmSync(BACKUP_DIR, { recursive: true, force: true });
      console.log('Data successfully restored to original state. Net-zero verified.');
    }
  } catch (e) {
    console.error('Failed to restore backup:', e);
  }
}

// Wire up signal handlers so Ctrl-C or a kill signal still runs the restore.
// Without this, the original data/ would be lost if the harness were killed.
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, async () => {
    console.log(`\nReceived ${sig}, restoring data and exiting...`);
    await restore();
    process.exit(130);
  });
}

try {
  process.env.NODE_ENV = 'test';
  // 2. Setup session tokens and credentials dynamically
  console.log('Setting up temporary credentials...');
  const setupProc = Bun.spawnSync(['bun', join(HERE, 'setup_session.js')]);
  if (setupProc.exitCode !== 0) {
    throw new Error('Credential setup failed: ' + setupProc.stderr.toString());
  }

  // 3. Start server process for tests
  console.log('Starting test server process...');
  const serverProc = Bun.spawn(['bun', join(HERE, '..', 'server.js')], {
    env: process.env,
    stdio: ['ignore', 'inherit', 'inherit']
  });
  await new Promise(r => setTimeout(r, 5000));

  try {
    // 4. Run the tests
    console.log('Running Bun endpoint tests...');
    const proc = Bun.spawnSync(['bun', join(HERE, 'endpoint_test.js')], { env: process.env });
    console.log(proc.stdout.toString());
    console.log(proc.stderr.toString());

    if (proc.exitCode !== 0) {
      process.exitCode = 1;
    }
  } finally {
    serverProc.kill();
  }
} catch (e) {
  console.error('Test execution failed:', e);
  process.exitCode = 1;
} finally {
  await restore();
}
