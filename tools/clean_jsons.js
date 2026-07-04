#!/usr/bin/env bun
import { configureDataStore, cleanMigratedFiles } from '../lib/data_store.js';

configureDataStore({ baseDir: process.cwd() });
if (!process.argv.includes('--yes')) {
  console.error('Refusing to remove migrated JSON files without --yes.');
  process.exit(2);
}
console.log(JSON.stringify({ ok: true, ...cleanMigratedFiles() }, null, 2));
