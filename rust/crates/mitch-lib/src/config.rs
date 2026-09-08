//! Env/`.env` loading, path resolution, and the multi-tenant host→webroot map.
//!
//! Contract (from `server.js`):
//! - `BASE` is derived from `import.meta.dir` in JS; here from build/runtime paths.
//! - `DATA_DIR` = `process.env.DATA_DIR` or `<BASE>/data`.
//! - `WEBROOT` = `<BASE>/webserver`.
//! - Hosts: `mitch.pro` → `webserver/`, `rjuhsd.school` → `webserver/rjuhsd/`,
//!   `sexypickleclub.com` → `webserver/sexypickleclub/`.
//! - Bun's import-time `.env` writing (e.g. VAPID keys) must NOT be replicated
//!   at import time; it becomes an explicit startup step.
//!
//! Status: scaffold stub — implemented in plan Step 4.

#![allow(dead_code)]

/// Root directory resolution, not yet wired.
pub struct Config;

impl Config {
    /// Placeholder so the module compiles; replaced in Step 4.
    pub fn placeholder() -> Self {
        Self
    }
}
