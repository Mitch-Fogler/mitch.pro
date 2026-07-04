#!/usr/bin/env bun
import { configureDataStore, exportDbToFiles } from '../lib/data_store.js';

configureDataStore({ baseDir: process.cwd() });
const result = exportDbToFiles({ overwrite: !process.argv.includes('--no-overwrite') });
console.log(JSON.stringify({ ok: true, ...result }, null, 2));
