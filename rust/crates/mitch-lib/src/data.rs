//! SQLite-backed JSON document store — the compatibility linchpin (plan Step 5).
//!
//! Contract (from `lib/data_store.js` + `lib/jsonStore.js`):
//! - Opens `data/mitchpro.db` (bun:sqlite, WAL). Pragmas must match exactly:
//!   `busy_timeout=15000`, `journal_mode=WAL`, `synchronous=NORMAL`,
//!   `foreign_keys=ON`.
//! - `loadJson(file)` / `saveJson(file, obj)` map to the `json_documents`
//!   table (`path` → `content` TEXT), path keys normalized posix-relative to
//!   the base dir (absolute when outside it).
//! - `PRESERVED_DATA_FILES` bypass the DB and hit real disk.
//! - Content for objects is `JSON.stringify(data, null, 2)` — serde_json's
//!   `to_string_pretty` matches (2-space indent). serde_json MUST have
//!   `preserve_order` enabled or every persisted document gets re-sorted.
//! - Untouched documents must pass through as TEXT (see Step 5); reads parse
//!   and fall back to the on-disk file when no DB row exists.
//!
//! Minimal implementation (document read/write) landed in Step 2 for the mail
//! pipeline; full parity (core-table sync, migration/backup tools) is Step 5.

use serde_json::Value;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

/// Files that never go through the DB — copied verbatim from
/// `lib/data_store.js` PRESERVED_DATA_FILES.
pub const PRESERVED_DATA_FILES: &[&str] = &[
    "admins.json",
    "bad_words.json",
    "bell_overrides.json",
    "emojis.json",
    "game_categories.json",
    "game_categories_external.json",
    "game_categories_local.json",
    "games",
    "games_external",
    "games_local",
    "logic_words.json",
    "moderators.json",
    "payloads.json",
    "prox_blocklist.json",
    "shop_catalog_overrides.json",
    "site.json",
    "sites",
    "wordle_dictionary.txt",
];

pub struct DataStore {
    base_dir: PathBuf,
    data_dir: PathBuf,
    conn: Mutex<rusqlite::Connection>,
}

fn now_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// Store error: rusqlite or filesystem. Boxed to keep the public surface
/// simple without pulling in an error-crate dependency.
pub type DataError = Box<dyn std::error::Error + Send + Sync>;

impl DataStore {
    /// Opens (or creates) the store with the same pragmas as
    /// `configureDataStore()`.
    pub fn open(base_dir: &Path, data_dir: &Path) -> Result<Self, DataError> {
        std::fs::create_dir_all(data_dir)?;
        let db_path = data_dir.join("mitchpro.db");
        let conn = rusqlite::Connection::open(&db_path)?;
        conn.busy_timeout(std::time::Duration::from_millis(15_000))?;
        conn.pragma_update(None, "journal_mode", "WAL")?;
        conn.pragma_update(None, "synchronous", "NORMAL")?;
        conn.pragma_update(None, "foreign_keys", "ON")?;
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS metadata (
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
            );",
        )?;
        conn.execute(
            "INSERT OR REPLACE INTO metadata (key, value, updated_at) VALUES ('schema_version', '1', ?)",
            rusqlite::params![now_millis()],
        )?;
        Ok(Self {
            base_dir: base_dir.to_path_buf(),
            data_dir: data_dir.to_path_buf(),
            conn: Mutex::new(conn),
        })
    }

    /// Path key semantics of `relativeKey()`: posix-relative to baseDir,
    /// absolute when the file lives outside it.
    fn relative_key(&self, file: &Path) -> String {
        let rel = file.strip_prefix(&self.base_dir).ok();
        let key = match rel {
            Some(rel) => rel.to_path_buf(),
            None => file.to_path_buf(),
        };
        key.to_string_lossy().replace('\\', "/")
    }

    /// `shouldStoreInDb()`: .json/.jsonl under dataDir/ or baseDir/mail/,
    /// excluding PRESERVED_DATA_FILES and database files.
    pub fn should_store_in_db(&self, file: &Path) -> bool {
        let is_json_like = file
            .to_str()
            .is_some_and(|f| f.ends_with(".json") || f.ends_with(".jsonl"));
        if !is_json_like {
            return false;
        }
        let name = file.file_name().unwrap_or_default().to_string_lossy();
        if name.ends_with(".db")
            || name.ends_with(".db-wal")
            || name.ends_with(".db-shm")
            || name == "mitchpro.db"
        {
            return false;
        }
        if file.parent().is_some_and(|p| p == self.data_dir)
            && PRESERVED_DATA_FILES.contains(&name.as_ref())
        {
            return false;
        }
        let in_data_dir = file.starts_with(&self.data_dir);
        let in_mail_dir = file.starts_with(self.base_dir.join("mail"));
        in_data_dir || in_mail_dir
    }

    /// `readDocument(file, fallback)`: DB row first, then the on-disk file,
    /// then the fallback. .jsonl rows return the raw string.
    pub fn read_document(&self, file: &Path, fallback: Value) -> Value {
        let is_jsonl = file.to_str().is_some_and(|f| f.ends_with(".jsonl"));
        let parse = |raw: &str| -> Option<Value> {
            if is_jsonl {
                Some(Value::String(raw.to_string()))
            } else {
                serde_json::from_str(raw).ok()
            }
        };
        if !self.should_store_in_db(file) {
            return std::fs::read_to_string(file)
                .ok()
                .and_then(|raw| parse(&raw))
                .unwrap_or(fallback);
        }
        let key = self.relative_key(file);
        let table = if is_jsonl {
            "jsonl_documents"
        } else {
            "json_documents"
        };
        let conn = self.conn.lock().unwrap_or_else(|e| e.into_inner());
        let row: Option<String> = conn
            .query_row(
                &format!("SELECT content FROM {table} WHERE path = ?1"),
                rusqlite::params![key],
                |r| r.get(0),
            )
            .ok();
        if let Some(content) = row {
            return parse(&content).unwrap_or(fallback);
        }
        std::fs::read_to_string(file)
            .ok()
            .and_then(|raw| parse(&raw))
            .unwrap_or(fallback)
    }

    /// `writeDocument(file, data)`: INSERT OR REPLACE into the blob table
    /// (pretty 2-space JSON, like `JSON.stringify(data, null, 2)`), or a plain
    /// file write for non-DB paths.
    pub fn write_document(&self, file: &Path, data: &Value) -> Result<(), DataError> {
        let content = match data {
            Value::String(s) => s.clone(),
            other => serde_json::to_string_pretty(other).unwrap_or_default(),
        };
        if !self.should_store_in_db(file) {
            std::fs::write(file, content)?;
            return Ok(());
        }
        let key = self.relative_key(file);
        let table = if file.to_str().is_some_and(|f| f.ends_with(".jsonl")) {
            "jsonl_documents"
        } else {
            "json_documents"
        };
        let conn = self.conn.lock().unwrap_or_else(|e| e.into_inner());
        conn.execute(
            &format!(
                "INSERT OR REPLACE INTO {table} (path, content, updated_at) VALUES (?1, ?2, ?3)"
            ),
            rusqlite::params![key, content, now_millis()],
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn temp_base(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "mitch-lib-test-{tag}-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(dir.join("data")).unwrap();
        dir
    }

    #[test]
    fn preserved_files_bypass_db() {
        let base = temp_base("preserved");
        let store = DataStore::open(&base, &base.join("data")).unwrap();
        let site = base.join("data").join("site.json");
        assert!(!store.should_store_in_db(&site));
        let tokens = base.join("data").join("unsubscribe_tokens.json");
        assert!(store.should_store_in_db(&tokens));
        let mail_json = base.join("mail").join("check_email").join("emails.json");
        assert!(store.should_store_in_db(&mail_json));
        let txt = base.join("data").join("notes.txt");
        assert!(!store.should_store_in_db(&txt));
        std::fs::remove_dir_all(base).ok();
    }

    #[test]
    fn document_round_trips_through_db() {
        let base = temp_base("roundtrip");
        let store = DataStore::open(&base, &base.join("data")).unwrap();
        let file = base.join("data").join("unsubscribe_tokens.json");
        let value = json!({"a@b.c": "deadbeef", "z": 1});
        store.write_document(&file, &value).unwrap();
        let back = store.read_document(&file, Value::Null);
        assert_eq!(back, value);
        // Key uses posix-relative path.
        let conn = store.conn.lock().unwrap();
        let (path, content): (String, String) = conn
            .query_row(
                "SELECT path, content FROM json_documents WHERE path LIKE '%unsubscribe%'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        drop(conn);
        assert!(path.ends_with("data/unsubscribe_tokens.json"), "key={path}");
        assert!(
            content.starts_with("{\n  \"a@b.c\": \"deadbeef\""),
            "pretty 2-space: {content}"
        );
        std::fs::remove_dir_all(base).ok();
    }

    #[test]
    fn preserved_file_written_to_disk() {
        let base = temp_base("disk");
        let store = DataStore::open(&base, &base.join("data")).unwrap();
        let file = base.join("data").join("site.json");
        let value = json!({"primary": "https://mitch.pro", "alternate": "https://mitchdog.com"});
        store.write_document(&file, &value).unwrap();
        let raw = std::fs::read_to_string(&file).unwrap();
        assert!(raw.contains("\"primary\""));
        let conn = store.conn.lock().unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM json_documents", [], |r| r.get(0))
            .unwrap();
        drop(conn);
        assert_eq!(count, 0, "site.json must not land in the DB");
        std::fs::remove_dir_all(base).ok();
    }

    #[test]
    fn key_order_is_preserved_not_sorted() {
        let base = temp_base("order");
        let store = DataStore::open(&base, &base.join("data")).unwrap();
        let file = base.join("data").join("order_check.json");
        let value = json!({"zebra": 1, "apple": 2, "mango": 3});
        store.write_document(&file, &value).unwrap();
        let conn = store.conn.lock().unwrap();
        let content: String = conn
            .query_row(
                "SELECT content FROM json_documents WHERE path LIKE '%order_check%'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        drop(conn);
        let zebra_pos = content.find("\"zebra\"").unwrap();
        let apple_pos = content.find("\"apple\"").unwrap();
        assert!(zebra_pos < apple_pos, "preserve_order violated: {content}");
        std::fs::remove_dir_all(base).ok();
    }

    #[test]
    fn missing_row_falls_back_to_disk_file() {
        let base = temp_base("diskfallback");
        let store = DataStore::open(&base, &base.join("data")).unwrap();
        let file = base.join("data").join("site.json");
        std::fs::write(&file, "{\"primary\":\"https://mitch.pro\"}").unwrap();
        let back = store.read_document(&file, Value::Null);
        assert_eq!(back["primary"], "https://mitch.pro");
        std::fs::remove_dir_all(base).ok();
    }
}
