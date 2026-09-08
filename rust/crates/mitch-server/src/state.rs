//! Shared application state for mitch-server + the prelude sets ported from
//! server.js (`PUBLIC_API_PATHS`, `CSRF_EXEMPT_PATHS`).

use crate::hosts::SiteConfig;
use crate::static_files::StaticCache;
use std::sync::Arc;

pub struct AppState {
    pub cfg: SiteConfig,
    pub static_cache: StaticCache,
    /// Store handle for the shared SQLite layer (Step 5+; used by API routes
    /// and the rewrite logger from Step 6 onward).
    #[allow(dead_code)]
    pub store: Arc<mitch_lib::data::DataStore>,
}

impl AppState {
    pub fn new(cfg: SiteConfig, store: Arc<mitch_lib::data::DataStore>) -> Self {
        Self {
            cfg,
            static_cache: StaticCache::new(),
            store,
        }
    }

    /// `checkPasswordCookie` stub — always false until Step 6 wires the real
    /// session store. Parity tests run unauthenticated, which matches bun.
    pub fn check_password_cookie(
        &self,
        _headers: &axum::http::HeaderMap,
        _sid: Option<&str>,
    ) -> bool {
        false
    }

    /// `softMaintenanceActive` — reads data/soft_maintenance.json each time
    /// (the JS caches it at boot; the file only changes via admin actions).
    pub fn soft_maintenance_active(&self) -> bool {
        std::fs::read_to_string(self.cfg.data_dir.join("soft_maintenance.json"))
            .ok()
            .and_then(|raw| serde_json::from_str::<serde_json::Value>(&raw).ok())
            .and_then(|v| v.get("active").and_then(|a| a.as_bool()))
            .unwrap_or(false)
    }
}

/// `PUBLIC_API_PATHS` — verbatim.
pub const PUBLIC_API_PATHS: &[&str] = &[
    "/api/webauthn/login/options",
    "/api/webauthn/login/verify",
    "/api/signup",
    "/api/bad-passwords",
    "/api/verify-signup",
    "/api/claim-token",
    "/api/login",
    "/api/dev/test-access",
    "/api/verify-2fa",
    "/api/request-access",
    "/api/newid",
    "/api/pass",
    "/api/games",
    "/api/log-click",
    "/api/newsletter/unsubscribe-direct",
    "/api/token",
    "/api/solve",
    "/api/submit",
    "/api/stats",
    "/api/next",
    "/api/sso/bridge",
    "/api/sso/exchange",
    "/api/weather",
    "/api/school-calendar",
    "/api/school-info",
    "/api/site-info",
    "/api/backgrounds/list",
];

/// `CSRF_EXEMPT_PATHS` — verbatim.
pub const CSRF_EXEMPT_PATHS: &[&str] = &["/api/sso/exchange", "/api/dm/attachment/upload"];
