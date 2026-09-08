//! Shared layer for the mitch.pro Rust services.
//!
//! Module layout is fixed by the rewrite plan — one concern per module, no
//! catch-all files. Any function approaching ~300 lines gets split.
//!
//! - [`config`]: env/`.env` loading, path resolution, host→webroot map
//! - [`data`]: SQLite `json_documents` store, `PRESERVED_DATA_FILES`, atomic writes
//! - [`crypto`]: ID_SECRET, `enc1:` at-rest seal/open, HMAC ids, argon2
//! - [`auth`]: sessions, cookies, CSRF, rate-limit tables
//! - [`state`]: shared in-memory State (tokens/coins/presence caches) + flushers
//! - [`email`]: shared email template + delivery helpers
//!
//! Compatibility contract: these modules must stay byte-compatible with the
//! Bun implementation (`server.js`, `lib/data_store.js`, `lib/jsonStore.js`).

pub mod auth;
pub mod config;
pub mod crypto;
pub mod data;
pub mod email;
pub mod state;

/// Library version, matching the workspace version.
pub fn version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

#[cfg(test)]
mod tests {
    #[test]
    fn version_is_reported() {
        assert!(!super::version().is_empty());
    }
}
