//! SQLite-backed JSON document store — the compatibility linchpin (plan Step 5).
//!
//! Contract (from `lib/data_store.js` + `lib/jsonStore.js`):
//! - Opens `data/mitchpro.db` (bun:sqlite, WAL). Pragmas must match exactly:
//!   `busy_timeout=15000`, `journal_mode=WAL`, `synchronous=NORMAL`,
//!   `foreign_keys=ON`.
//! - `loadJson(file)` / `saveJson(file, obj)` map to the `json_documents`
//!   table (`path` → `content` TEXT), path keys normalized posix-relative.
//! - `PRESERVED_DATA_FILES` (admins.json, site.json, moderators.json, …)
//!   bypass the DB and hit real disk.
//! - Writes are atomic (temp + rename) for disk paths; serde_json must use
//!   `preserve_order` and untouched documents must pass through as TEXT.
//!
//! Status: scaffold stub — implemented in plan Step 5.

#![allow(dead_code)]

/// Store handle, not yet wired.
pub struct DataStore;

impl DataStore {
    /// Placeholder so the module compiles; replaced in Step 5.
    pub fn placeholder() -> Self {
        Self
    }
}
