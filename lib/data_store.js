import { Database } from 'bun:sqlite';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, rmSync } from 'fs';
import { basename, dirname, join, relative, resolve } from 'path';
import { spawnSync } from 'child_process';

export const PRESERVED_DATA_FILES = new Set([
  'admins.json',
  'bad_words.json',
  'bell_overrides.json',
  'emojis.json',
  'game_categories.json',
  'game_categories_external.json',
  'game_categories_local.json',
  'logic_words.json',
  'moderators.json',
  'payloads.json',
  'prox_blocklist.json',
  'rainbow_refunds.json',
  'shop_catalog_overrides.json',
  'site.json',
  'sites',
  'unlimited_ids.json',
  'wordle_dictionary.txt',
]);

export const PRESERVED_ROOT_FILES = new Set(['games', 'games_local', 'games_external']);

let db = null;
let paths = null;

function normalizePath(file) {
  return resolve(file);
}

function relativeKey(file) {
  const abs = normalizePath(file);
  const base = paths ? paths.baseDir : process.cwd();
  let rel = relative(base, abs);
  if (rel.startsWith('..')) rel = abs;
  return rel.split('\\').join('/');
}

function isJsonLike(file) {
  return file.endsWith('.json') || file.endsWith('.jsonl');
}

export function configureDataStore({ baseDir = process.cwd(), dataDir = join(baseDir, 'data'), dbPath = join(dataDir, 'mitchpro.db') } = {}) {
  paths = {
    baseDir: resolve(baseDir),
    dataDir: resolve(dataDir),
    dbPath: resolve(dbPath),
  };
  mkdirSync(paths.dataDir, { recursive: true });
  db = new Database(paths.dbPath);
  db.exec(`
    PRAGMA busy_timeout = 5000;
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS json_documents (
      path TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS jsonl_documents (
      path TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY,
      username TEXT UNIQUE,
      nickname TEXT DEFAULT '',
      display_name TEXT DEFAULT '',
      password_hash TEXT DEFAULT '',
      coins REAL DEFAULT 0,
      twofa_enabled INTEGER DEFAULT 0,
      twofa_type TEXT DEFAULT '',
      totp_secret TEXT DEFAULT '',
      grad_year TEXT DEFAULT '',
      gender TEXT DEFAULT '',
      has_completed_tutorial INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS friends (
      user_email TEXT NOT NULL,
      friend_email TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (user_email, friend_email, status)
    );

    CREATE TABLE IF NOT EXISTS referrals (
      email TEXT NOT NULL,
      source TEXT DEFAULT '',
      details TEXT DEFAULT '',
      timestamp INTEGER NOT NULL
    );
  `);
  db.query('INSERT OR REPLACE INTO metadata (key, value, updated_at) VALUES (?, ?, ?)').run('schema_version', '1', Date.now());
  return db;
}

export function getDataStore() {
  if (!db) configureDataStore();
  return db;
}

export function dataStorePaths() {
  if (!paths) configureDataStore();
  return paths;
}

export function isPreservedFile(file) {
  const abs = normalizePath(file);
  const p = dataStorePaths();
  const name = basename(abs);
  const parent = dirname(abs);
  if (parent === p.dataDir && PRESERVED_DATA_FILES.has(name)) return true;
  if (dirname(abs) === p.baseDir && PRESERVED_ROOT_FILES.has(name)) return true;
  if (name === 'mitchpro.db' || name.endsWith('.db') || name.endsWith('.db-wal') || name.endsWith('.db-shm')) return true;
  return false;
}

export function shouldStoreInDb(file) {
  const abs = normalizePath(file);
  const p = dataStorePaths();
  if (!isJsonLike(abs)) return false;
  if (isPreservedFile(abs)) return false;
  return abs.startsWith(p.dataDir + '/') || abs.startsWith(join(p.baseDir, 'mail') + '/');
}

export function readDocument(file, fallback) {
  if (!shouldStoreInDb(file)) {
    try { return JSON.parse(readFileSync(file, 'utf8')); }
    catch { return fallback; }
  }

  const key = relativeKey(file);
  const table = file.endsWith('.jsonl') ? 'jsonl_documents' : 'json_documents';
  const row = getDataStore().query(`SELECT content FROM ${table} WHERE path = ?`).get(key);
  if (row) {
    try {
      return file.endsWith('.jsonl') ? row.content : JSON.parse(row.content);
    } catch {
      return fallback;
    }
  }
  try {
    const raw = readFileSync(file, 'utf8');
    return file.endsWith('.jsonl') ? raw : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeDocument(file, data) {
  if (!shouldStoreInDb(file)) {
    const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    writeFileSync(file, content, 'utf8');
    return;
  }
  const key = relativeKey(file);
  const table = file.endsWith('.jsonl') ? 'jsonl_documents' : 'json_documents';
  const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  getDataStore().query(`INSERT OR REPLACE INTO ${table} (path, content, updated_at) VALUES (?, ?, ?)`).run(key, content, Date.now());
  if (process.env.DB_DISABLE_FILE_MIRROR !== '1') {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content, 'utf8');
  }
  syncCoreTablesForPath(key, data);
}

function usernameFromEmail(email, used) {
  const baseRaw = String(email || '').split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '-').replace(/-+/g, '-').replace(/^[._-]+|[._-]+$/g, '');
  const base = baseRaw || 'user';
  let candidate = base;
  let i = 2;
  while (used.has(candidate)) {
    candidate = `${base}-${i++}`;
  }
  used.add(candidate);
  return candidate;
}

export function rebuildCoreTablesFromDocuments() {
  const store = getDataStore();
  const docs = Object.fromEntries(
    store.query('SELECT path, content FROM json_documents').all()
      .map(row => {
        try { return [row.path, JSON.parse(row.content)]; }
        catch { return [row.path, null]; }
      })
      .filter(([, value]) => value !== null)
  );

  const passwords = docs['data/passwords.json'] || {};
  const profiles = docs['data/profiles.json'] || {};
  const coins = docs['data/coins.json'] || {};
  const friends = docs['data/friends.json'] || {};
  const referralSources = docs['data/referral_sources.json'] || {};
  const used = new Set();
  const now = Date.now();

  const insertUser = store.query(`
    INSERT OR REPLACE INTO users (
      email, username, nickname, display_name, password_hash, coins, twofa_enabled, twofa_type,
      totp_secret, grad_year, gender, has_completed_tutorial, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertFriend = store.query('INSERT OR REPLACE INTO friends (user_email, friend_email, status, created_at) VALUES (?, ?, ?, ?)');
  const insertReferral = store.query('INSERT INTO referrals (email, source, details, timestamp) VALUES (?, ?, ?, ?)');

  store.exec('DELETE FROM users; DELETE FROM friends; DELETE FROM referrals;');
  const emails = new Set([...Object.keys(passwords), ...Object.keys(profiles), ...Object.keys(coins)]);
  store.transaction(() => {
    for (const email of emails) {
      const p = profiles[email] || {};
      const username = String(p.username || '').match(/^[a-z0-9._-]+$/) && !String(p.username).includes('@')
        ? usernameFromEmail(p.username, used)
        : usernameFromEmail(email, used);
      insertUser.run(
        email,
        username,
        p.nickname || p.displayName || '',
        p.displayName || p.nickname || '',
        passwords[email] || '',
        Number(coins[email] || 0),
        p.twofa_enabled ? 1 : 0,
        p.twofa_type || '',
        p.totp_secret || '',
        p.grad_year || '',
        p.gender || '',
        p.hasCompletedTutorial || p.has_completed_tutorial ? 1 : 0,
        p.createdAt || now,
        p.updatedAt || now
      );
    }
    for (const [email, list] of Object.entries(friends)) {
      if (!Array.isArray(list)) continue;
      for (const friend of list) insertFriend.run(email, String(friend || '').toLowerCase().trim(), 'accepted', now);
    }
    for (const [email, info] of Object.entries(referralSources)) {
      if (info && typeof info === 'object') insertReferral.run(email, info.source || '', info.details || '', info.timestamp || now);
      else insertReferral.run(email, String(info || ''), '', now);
    }
  })();
}

function syncCoreTablesForPath(key) {
  if (['data/passwords.json', 'data/profiles.json', 'data/coins.json', 'data/friends.json', 'data/referral_sources.json'].includes(key)) {
    try { rebuildCoreTablesFromDocuments(); } catch (e) { console.error('[data-store] core table sync failed:', e); }
  }
}

export function migrateFilesToDb({ clean = false } = {}) {
  const p = dataStorePaths();
  const migrated = [];
  const skipped = [];
  const visit = (dir) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(file);
        continue;
      }
      if (!shouldStoreInDb(file)) {
        skipped.push(relativeKey(file));
        continue;
      }
      const raw = readFileSync(file, 'utf8');
      if (file.endsWith('.json')) {
        JSON.parse(raw || 'null');
        writeDocument(file, JSON.parse(raw || 'null'));
      } else {
        writeDocument(file, raw);
      }
      migrated.push(relativeKey(file));
      if (clean) rmSync(file);
    }
  };
  visit(p.dataDir);
  rebuildCoreTablesFromDocuments();
  return { migrated, skipped };
}

export function exportDbToFiles({ overwrite = true } = {}) {
  const p = dataStorePaths();
  const rows = [
    ...getDataStore().query('SELECT path, content FROM json_documents').all(),
    ...getDataStore().query('SELECT path, content FROM jsonl_documents').all(),
  ];
  const written = [];
  for (const row of rows) {
    const out = join(p.baseDir, row.path);
    if (!overwrite && existsSync(out)) continue;
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, row.content, 'utf8');
    written.push(row.path);
  }
  return { written };
}

export function cleanMigratedFiles() {
  const p = dataStorePaths();
  const paths = [
    ...getDataStore().query('SELECT path FROM json_documents').all(),
    ...getDataStore().query('SELECT path FROM jsonl_documents').all(),
  ].map(row => join(p.baseDir, row.path));
  const removed = [];
  for (const file of paths) {
    if (existsSync(file) && shouldStoreInDb(file)) {
      rmSync(file);
      removed.push(relativeKey(file));
    }
  }
  return { removed };
}

export function packBackup(outPath) {
  const p = dataStorePaths();
  mkdirSync(dirname(outPath), { recursive: true });
  try { getDataStore().exec('PRAGMA wal_checkpoint(TRUNCATE);'); } catch {}
  const staging = join(dirname(outPath), `.pack-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(join(staging, 'data'), { recursive: true });
  const entries = [];
  if (existsSync(p.dbPath)) {
    copyFileSync(p.dbPath, join(staging, 'data', 'mitchpro.db'));
    entries.push('data/mitchpro.db');
  }
  for (const name of PRESERVED_DATA_FILES) {
    const file = join(p.dataDir, name);
    if (existsSync(file) && statSync(file).isFile()) {
      copyFileSync(file, join(staging, 'data', name));
      entries.push(`data/${name}`);
    }
  }
  for (const name of PRESERVED_ROOT_FILES) {
    const file = join(p.baseDir, name);
    if (existsSync(file) && statSync(file).isFile()) {
      copyFileSync(file, join(staging, name));
      entries.push(name);
    }
  }
  try {
    const tar = spawnSync('tar', ['-czf', outPath, '-C', staging, ...entries], { encoding: 'utf8' });
    if (tar.status !== 0) throw new Error(tar.stderr || 'tar failed');
    return { outPath, fileCount: entries.length, format: 'tar.gz' };
  } finally {
    try { rmSync(staging, { recursive: true, force: true }); } catch {}
  }
}

export function unpackBackup(inPath) {
  const p = dataStorePaths();
  const tar = spawnSync('tar', ['-xzf', inPath, '-C', p.baseDir], { encoding: 'utf8' });
  if (tar.status !== 0) throw new Error(tar.stderr || 'tar extract failed');
  return { dbPath: p.dbPath, format: 'tar.gz' };
}
