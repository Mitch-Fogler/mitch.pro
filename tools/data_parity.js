#!/usr/bin/env bun
// data_parity.js — Step 5 verification (with
// `rust/crates/mitch-lib/examples/data_parity.rs`).
//
// 1. Fresh temp DB (configureDataStore({ baseDir: TMP })).
// 2. Write N docs via writeDocument (mixed shapes: strings, numbers, nested
//    objects, unicode, empty object/array, null, booleans, key ordering).
// 3. Record expected content strings (JSON.stringify(data, null, 2)).
// 4. Spawn the Rust parity example (`data_parity -- <base> <mode>`):
//      - passthrough: Rust reads the stored TEXT and writes it back verbatim
//        (exercises write_document_raw's string branch)
//      - reserialize: Rust parses + re-emits via js_stringify_pretty
//        (exercises the JSON.stringify parity port)
// 5. Byte-compare the `content` column against the recorded strings.
//
// Usage: bun tools/data_parity.js [--body-only]
//   RUST_EXAMPLE overrides the cargo command.

import { configureDataStore, writeDocument } from '../lib/data_store.js';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.argv[2] || '/tmp/data-parity-test';
const RUST_EXAMPLE =
  process.env.RUST_EXAMPLE ||
  'cargo run -q -p mitch-lib --example data_parity --';

// Mixed-shape docs, keyed by the JS relativeKey convention
// (posix-relative to BASE, e.g. `data/parity/alpha.json`).
const DOCS = {
  'data/parity/alpha.json': {
    string: 'hello world',
    integer: 42,
    negative: -7,
    float: 1.5,
    tiny: 0.000001,
    big: 9007199254740992,
    bool_true: true,
    bool_false: false,
    null_value: null,
    unicode: 'héllo ✅ 日本語',
    escaped: 'quote " backslash \\ newline \n tab \t',
  },
  'data/parity/beta.json': {
    nested: { deep: { deeper: ['array', 2, 3.25, null] } },
    empty_object: {},
    empty_array: [],
    unicode_keys: { 'ключ': 'значение', '鍵': '値' },
  },
  'data/parity/gamma.json': 'a plain string document',
  'data/parity/delta.json': 42,
  'data/parity/epsilon.json': true,
  'data/parity/zeta.json': null,
  'data/parity/eta.json': [],
  'data/parity/theta.json': {},
};

let failures = 0;
let checked = 0;

function ok(label, cond, detail = '') {
  if (cond) console.log(`  ok  ${label}`);
  else {
    failures++;
    console.error(`FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

// 1. Fresh store.
fs.rmSync(BASE, { recursive: true, force: true });
fs.mkdirSync(path.join(BASE, 'data'), { recursive: true });
configureDataStore({ baseDir: BASE });

// 2. Write the docs, recording expected content per path.
const expected = {};
for (const [file_path, data] of Object.entries(DOCS)) {
  writeDocument(path.join(BASE, file_path), data);
  // JS writeDocument: strings verbatim, everything else pretty-printed.
  expected[file_path] = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
}

// 3. Rust side: passthrough (stored TEXT back verbatim), then reserialize
//    (parse + js_stringify_pretty). After both, the stored content must
//    equal the JS-produced strings.
const rust_bin = path.join(import.meta.dir, '../rust/target/debug/mitch-server');
const _ = rust_bin; // unused; the spawn below targets the example

for (const mode of ['passthrough', 'reserialize']) {
  const res = spawnSync(
    'cargo',
    ['run', '-q', '-p', 'mitch-lib', '--example', 'data_parity', '--', BASE, mode],
    { cwd: path.join(import.meta.dir, '..', 'rust'), encoding: 'utf8' },
  );
  if (res.status !== 0) {
    console.error(`FAIL  rust example (${mode}) exited ${res.status}`);
    console.error(res.stderr || '');
    failures++;
  }
}

// 4. Byte-compare the content column against the recorded expectations.
console.log('byte-comparing stored content vs JS JSON.stringify…');
let store;
try {
  store = configureDataStore({ baseDir: BASE });
} catch (err) {
  console.error('FAIL  reopen store:', err.message);
  process.exit(1);
}
const conn = store; // getDataStore returns the Database.
for (const [file_path, expected_content] of Object.entries(expected)) {
  const key = file_path;
  let actual = null;
  try {
    const row = conn.query('SELECT content FROM json_documents WHERE path = ?').get(key);
    actual = row ? row.content : null;
  } catch (err) {
    console.error(`FAIL  ${file_path}: ${err.message}`);
    failures++;
    continue;
  }
  if (actual === null) {
    console.error(`FAIL  ${file_path}: no row`);
    failures++;
    continue;
  }
  checked++;
  if (actual === expected_content) {
    console.log(`  ok  ${file_path} (${actual.length}b)`);
  } else {
    failures++;
    console.error(`FAIL  ${file_path}`);
    console.error(`  expected: ${JSON.stringify(String(expected_content).slice(0, 300))}`);
    console.error(`  actual:   ${JSON.stringify(String(actual).slice(0, 300))}`);
  }
}

console.log(`\nchecked ${checked} paths, ${failures} failures`);
process.exit(failures === 0 ? 0 : 1);
