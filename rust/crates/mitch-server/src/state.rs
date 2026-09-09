//! Shared application state for mitch-server + the prelude sets ported from
//! server.js (`PUBLIC_API_PATHS`, `CSRF_EXEMPT_PATHS`).
//!
//! Step 6 wires the real auth gate: `check_password_cookie` now runs the full
//! ported flow (mitch_session token -> auth_sessions.json -> validId HMAC ->
//! bans -> passwords.json), plus the rate limiter.

use crate::hosts::SiteConfig;
use crate::static_files::StaticCache;
use std::sync::Arc;

pub struct AppState {
    pub cfg: SiteConfig,
    pub static_cache: StaticCache,
    /// Store handle for the shared SQLite layer.
    pub store: Arc<mitch_lib::data::DataStore>,
    /// ID_SECRET — raw bytes from data/id_secret.key.
    pub id_secret: Vec<u8>,
    /// In-memory rate limiter (rlLog + timing tables).
    pub rate_limiter: mitch_lib::auth::RateLimiter,
}

impl AppState {
    pub fn new(cfg: SiteConfig, store: Arc<mitch_lib::data::DataStore>) -> Self {
        let id_secret = mitch_lib::crypto::load_id_secret(&cfg.data_dir).unwrap_or_else(|e| {
            tracing::warn!("id_secret load failed: {e}");
            vec![0u8; 32]
        });
        Self {
            cfg,
            static_cache: StaticCache::new(),
            store,
            id_secret,
            rate_limiter: mitch_lib::auth::RateLimiter::new(),
        }
    }

    /// The real `checkPasswordCookie` gate — mitch_session token -> session
    /// store -> validId HMAC -> bans -> passwords.json.
    pub fn check_password_cookie(
        &self,
        headers: &axum::http::HeaderMap,
        sid: Option<&str>,
    ) -> bool {
        let node_env_test = std::env::var("NODE_ENV").unwrap_or_default() == "test";
        let dev_test_access = mitch_lib::auth::dev_test_access_enabled();
        let cookie_header = headers
            .get(axum::http::header::COOKIE)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");
        let cookies = mitch_lib::auth::get_cookies_from_header_value(
            cookie_header,
            &self.store,
            &self.id_secret,
            node_env_test,
        );
        mitch_lib::auth::check_password_cookie(
            &self.store,
            &self.id_secret,
            &cookies,
            sid,
            node_env_test,
            dev_test_access,
        )
    }

    /// `checkRateLimit` — the per-request rate gate (returns Some when the
    /// request should be rejected with 429).
    pub fn rate_limit_check(
        &self,
        ip: &str,
        id_key: &str,
        endpoint: &str,
    ) -> Option<(u16, &'static str)> {
        mitch_lib::auth::check_rate_limit(&self.rate_limiter, ip, id_key, endpoint)
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
