#!/usr/bin/env bun
import { join } from 'path';
import { configureDataStore, packBackup } from '../lib/data_store.js';

configureDataStore({ baseDir: process.cwd() });
const out = process.argv[2] || join(process.cwd(), 'backups', `mitchpro_backup_${Date.now()}.tar.gz`);
console.log(JSON.stringify({ ok: true, ...packBackup(out) }, null, 2));
