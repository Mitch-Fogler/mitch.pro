#!/usr/bin/env bun
/**
 * List JSON documents stored in data/mitchpro.db, then edit one in nano.
 *
 * Usage:
 *   bun tools/edit_db_json.js              # list, pick by number or path
 *   bun tools/edit_db_json.js --list       # list only
 *   bun tools/edit_db_json.js data/coins.json
 *   bun tools/edit_db_json.js coins.json   # fuzzy basename match
 *
 * Editor defaults to nano; override with EDITOR=vim bun tools/edit_db_json.js ...
 */
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'fs';
import { join, basename } from 'path';
import { tmpdir } from 'os';
import { spawnSync } from 'child_process';
import {
  configureDataStore,
  getDataStore,
  dataStorePaths,
  writeDocument,
} from '../lib/data_store.js';

const args = process.argv.slice(2).filter((a) => a !== '--');
const listOnly = args.includes('--list') || args.includes('-l');
const want = args.find((a) => !a.startsWith('-')) || '';

configureDataStore({ baseDir: process.cwd() });
const { baseDir } = dataStorePaths();
const store = getDataStore();

function listDocs() {
  const json = store.query('SELECT path, updated_at, length(content) AS bytes FROM json_documents ORDER BY path').all();
  const jsonl = store.query('SELECT path, updated_at, length(content) AS bytes FROM jsonl_documents ORDER BY path').all();
  return [
    ...json.map((r) => ({ ...r, kind: 'json' })),
    ...jsonl.map((r) => ({ ...r, kind: 'jsonl' })),
  ];
}

function printList(docs) {
  if (!docs.length) {
    console.log('(no documents in json_documents / jsonl_documents)');
    return;
  }
  const width = String(docs.length).length;
  for (let i = 0; i < docs.length; i++) {
    const d = docs[i];
    const n = String(i + 1).padStart(width, ' ');
    const when = d.updated_at ? new Date(d.updated_at).toISOString() : '-';
    console.log(`${n}.  [${d.kind}]  ${d.path}  (${d.bytes} bytes, ${when})`);
  }
}

function resolveDoc(docs, query) {
  if (!query) return null;
  if (/^\d+$/.test(query)) {
    const idx = Number(query) - 1;
    return docs[idx] || null;
  }
  const exact = docs.find((d) => d.path === query || d.path === `data/${query}`);
  if (exact) return exact;
  const base = basename(query);
  const hits = docs.filter((d) => d.path === query || basename(d.path) === base || d.path.endsWith('/' + query));
  if (hits.length === 1) return hits[0];
  if (hits.length > 1) {
    console.error(`Ambiguous match for "${query}":`);
    for (const h of hits) console.error(`  - ${h.path}`);
    process.exit(2);
  }
  return null;
}

async function ask(question) {
  process.stdout.write(question);
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
  return line.split('\n')[0].trim();
}

const docs = listDocs();
printList(docs);

if (listOnly) process.exit(0);
if (!docs.length) process.exit(1);

let chosen = resolveDoc(docs, want);
if (!chosen) {
  const answer = await ask('\nEdit which document? (number or path): ');
  if (!answer) {
    console.error('Cancelled.');
    process.exit(1);
  }
  chosen = resolveDoc(docs, answer);
}
if (!chosen) {
  console.error(`No document matched.`);
  process.exit(2);
}

const table = chosen.kind === 'jsonl' ? 'jsonl_documents' : 'json_documents';
const row = store.query(`SELECT content FROM ${table} WHERE path = ?`).get(chosen.path);
if (!row) {
  console.error(`Missing content for ${chosen.path}`);
  process.exit(1);
}

let pretty = row.content;
if (chosen.kind === 'json') {
  try {
    pretty = JSON.stringify(JSON.parse(row.content), null, 2) + '\n';
  } catch {
    pretty = String(row.content);
    if (!pretty.endsWith('\n')) pretty += '\n';
  }
} else if (!pretty.endsWith('\n')) {
  pretty += '\n';
}

const dir = mkdtempSync(join(tmpdir(), 'mitch-db-edit-'));
const safeName = basename(chosen.path).replace(/[^\w.\-]+/g, '_') || 'doc.json';
const tmpFile = join(dir, safeName);
writeFileSync(tmpFile, pretty, 'utf8');

const editor = (process.env.EDITOR || 'nano').trim() || 'nano';
console.log(`\nOpening ${chosen.path} in ${editor}…`);
console.log(`Temp file: ${tmpFile}`);

const edit = spawnSync(editor, [tmpFile], { stdio: 'inherit', env: process.env });
if (edit.error) {
  console.error(`Failed to launch ${editor}:`, edit.error.message);
  rmSync(dir, { recursive: true, force: true });
  process.exit(1);
}
if ((edit.status ?? 1) !== 0) {
  console.error(`Editor exited with status ${edit.status}; not saving.`);
  rmSync(dir, { recursive: true, force: true });
  process.exit(edit.status ?? 1);
}

const edited = readFileSync(tmpFile, 'utf8');
let toStore = edited;
if (chosen.kind === 'json') {
  try {
    const parsed = JSON.parse(edited);
    toStore = JSON.stringify(parsed, null, 2) + '\n';
  } catch (e) {
    console.error(`Invalid JSON — not writing back to DB.\n${e.message}`);
    console.error(`Broken file kept at: ${tmpFile}`);
    process.exit(1);
  }
}

const absPath = chosen.path.startsWith('/') ? chosen.path : join(baseDir, chosen.path);
writeDocument(absPath, chosen.kind === 'jsonl' ? toStore : JSON.parse(toStore));
rmSync(dir, { recursive: true, force: true });
console.log(`Saved ${chosen.path} to DB.`);
