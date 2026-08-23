// lib/jsonStore.js
//
// Thin wrappers around the data_store blob tables (json_documents / jsonl_documents).
// All read/write of files in data/ that are NOT in PRESERVED_DATA_FILES should go
// through these. See lib/data_store.js for the underlying SQLite layer.
//
// Migrated from server.js loadJson/saveJson/saveJsonSync (Pass 1, 2026-08-22).

import { readDocument, writeDocument } from './data_store.js';

export function loadJson(file, fallback) {
  return readDocument(file, fallback);
}

export async function saveJson(file, data) {
  try {
    writeDocument(file, data);
  } catch (e) {
    console.error(`[saveJson] error writing ${file}: ${e.message}`);
  }
}

export function saveJsonSync(file, data) {
  try {
    writeDocument(file, data);
  } catch (e) {
    console.error(`[saveJsonSync] error writing ${file}: ${e.message}`);
  }
}
