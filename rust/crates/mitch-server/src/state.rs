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
    /// `globalCoinMultiplier` (server.js:1159) — admin-settable process state.
    /// f64 stored bit-exact via AtomicU64.
    pub coin_multiplier: std::sync::atomic::AtomicU64,
    /// `casinoEnabled` (server.js:1162) — admin-settable process state.
    pub casino_enabled: std::sync::atomic::AtomicBool,
    /// `casinoRigChance` (server.js:1177) — admin-settable process state.
    pub casino_rig_chance: std::sync::atomic::AtomicU64,
    /// `casinoIntake`/`casinoPayout` — read from data/casino_stats.json at
    /// boot (server.js:1165-1169); casino games update them in Step 12.
    pub casino_intake: std::sync::atomic::AtomicU64,
    pub casino_payout: std::sync::atomic::AtomicU64,
    /// `shadowBans` (server.js:1174) — loaded from data/shadow_bans.json.
    pub shadow_bans: std::sync::RwLock<std::collections::HashSet<String>>,
    /// `proxBlocklist` (server.js:1179).
    pub prox_blocklist: std::sync::RwLock<std::collections::HashSet<String>>,
    /// `featuredGameHref` (server.js:1181).
    pub featured_game_href: std::sync::RwLock<String>,
}

impl AppState {
    pub fn new(cfg: SiteConfig, store: Arc<mitch_lib::data::DataStore>) -> Self {
        let id_secret = mitch_lib::crypto::load_id_secret(&cfg.data_dir).unwrap_or_else(|e| {
            tracing::warn!("id_secret load failed: {e}");
            vec![0u8; 32]
        });
        let casino = store.read_document(
            &cfg.base_dir.join("data/casino_stats.json"),
            serde_json::json!({}),
        );
        let shadow_bans: std::collections::HashSet<String> = store
            .read_document(
                &cfg.base_dir.join("data/shadow_bans.json"),
                serde_json::json!([]),
            )
            .as_array()
            .map(|a| {
                a.iter()
                    .filter_map(|v| v.as_str().map(str::to_string))
                    .collect()
            })
            .unwrap_or_default();
        let prox_blocklist: std::collections::HashSet<String> = store
            .read_document(
                &cfg.base_dir.join("data/prox_blocklist.json"),
                serde_json::json!([]),
            )
            .as_array()
            .map(|a| {
                a.iter()
                    .filter_map(|v| v.as_str().map(str::to_string))
                    .collect()
            })
            .unwrap_or_default();
        Self {
            cfg,
            static_cache: StaticCache::new(),
            store,
            id_secret,
            rate_limiter: mitch_lib::auth::RateLimiter::new(),
            coin_multiplier: std::sync::atomic::AtomicU64::new(
                mitch_lib::coins::DEFAULT_COIN_MULTIPLIER.to_bits(),
            ),
            casino_enabled: std::sync::atomic::AtomicBool::new(true),
            casino_rig_chance: std::sync::atomic::AtomicU64::new(0f64.to_bits()),
            casino_intake: std::sync::atomic::AtomicU64::new(
                casino
                    .get("intake")
                    .and_then(|v| v.as_f64())
                    .unwrap_or(0.0)
                    .to_bits(),
            ),
            casino_payout: std::sync::atomic::AtomicU64::new(
                casino
                    .get("payout")
                    .and_then(|v| v.as_f64())
                    .unwrap_or(0.0)
                    .to_bits(),
            ),
            shadow_bans: std::sync::RwLock::new(shadow_bans),
            prox_blocklist: std::sync::RwLock::new(prox_blocklist),
            featured_game_href: std::sync::RwLock::new(String::new()),
        }
    }

    /// `globalCoinMultiplier` as f64.
    pub fn coin_multiplier(&self) -> f64 {
        f64::from_bits(std::sync::atomic::AtomicU64::load(
            &self.coin_multiplier,
            std::sync::atomic::Ordering::Relaxed,
        ))
    }

    pub fn set_coin_multiplier(&self, mult: f64) {
        std::sync::atomic::AtomicU64::store(
            &self.coin_multiplier,
            mult.to_bits(),
            std::sync::atomic::Ordering::Relaxed,
        );
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
