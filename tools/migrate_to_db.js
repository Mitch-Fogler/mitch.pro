#!/usr/bin/env bun
import { configureDataStore, migrateFilesToDb } from '../lib/data_store.js';

const baseDir = process.cwd();
configureDataStore({ baseDir });
const clean = process.argv.includes('--clean');
const result = migrateFilesToDb({ clean });
console.log(JSON.stringify({
  ok: true,
  migrated_count: result.migrated.length,
  skipped_count: result.skipped.length,
  migrated: result.migrated,
  skipped: result.skipped,
}, null, 2));
