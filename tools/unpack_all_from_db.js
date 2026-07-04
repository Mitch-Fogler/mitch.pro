#!/usr/bin/env bun
import { configureDataStore, unpackBackup } from '../lib/data_store.js';

const input = process.argv[2];
if (!input) {
  console.error('Usage: bun tools/unpack_all_from_db.js <backup.tar.gz>');
  process.exit(2);
}
configureDataStore({ baseDir: process.cwd() });
console.log(JSON.stringify({ ok: true, ...unpackBackup(input) }, null, 2));
