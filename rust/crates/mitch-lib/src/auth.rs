//! Sessions, cookies, CSRF, and rate-limit tables (plan Step 6).
//!
//! Contract (from `server.js`):
//! - Cookie `mitch_session` with exact attributes:
//!   `Path=/; Max-Age=2592000; SameSite=Lax; Secure; HttpOnly`
//!   (`Secure` driven by `SESSION_COOKIE_SECURE`/NODE_ENV, never by
//!   `X-Forwarded-Proto`). Drift logs out every user at cutover.
//! - Mutating `/api/*` requires same-origin Origin/Referer +
//!   `X-Mitch-Requested-With: 1` unless in `PUBLIC_API_PATHS`.
//! - Rate-limit tables: in-memory maps with periodic sweepers.
//!
//! Status: scaffold stub — implemented in plan Step 6.

#![allow(dead_code)]

/// Auth provider, not yet wired.
pub struct Auth;

impl Auth {
    /// Placeholder so the module compiles; replaced in Step 6.
    pub fn placeholder() -> Self {
        Self
    }
}
