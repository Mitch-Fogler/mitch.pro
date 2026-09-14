//! `/api/me/*` route group (plan Step 9) — account surface: inventory,
//! cosmetics, coin gifts, notifications, 2FA, email/password changes.
//!
//! Auth patterns mirror server.js exactly:
//! - most endpoints: `validId(sid)` → 401 `{error:'unauthorized'}` (or
//!   `'not logged in'` on the read endpoints), then `emailFromSid` → 401
//!   `{error:'email not found'}`;
//! - `complete-tutorial` + the 2fa/change-email family skip `validId` and
//!   resolve the email from the raw sid only;
//! - `change-password` + `logout-other` sit behind `checkPasswordCookie`.
//!
//! Rate limiting: JS calls `checkRateLimit(req, path)` inside handlers, but
//! that call is a no-op after the prelude's (server.js:5987 sets
//! `req._rateLimitChecked`), so the Rust prelude gate covers everything here.

mod cosmetics;
mod notifications;
mod security;

use crate::state::AppState;
use axum::http::{HeaderMap, Method};
use axum::response::Response;
use serde_json::Value;

/// API route dispatch — called from handler.rs after the auth gates.
/// Returns `Some(Response)` for a matched route, `None` for fallthrough.
pub async fn handle(
    state: &std::sync::Arc<AppState>,
    method: &Method,
    path: &str,
    headers: &HeaderMap,
    body: &serde_json::Value,
    body_bytes: &[u8],
) -> Option<Response> {
    cosmetics::handle(state, method, path, headers, body, body_bytes)
        .or_else(|| notifications::handle(state, method, path, headers, body, body_bytes))
        .or_else(|| security::handle(state, method, path, headers, body, body_bytes))
}

/// `tryParseJson()` (server.js:10514): empty body → `{}`; unparseable →
/// `None` (caller returns 400 `{error:'bad json'}`).
pub(crate) fn parse_body_strict(body_bytes: &[u8]) -> Option<Value> {
    if body_bytes.is_empty() {
        return Some(serde_json::json!({}));
    }
    serde_json::from_slice(body_bytes).ok()
}

/// The shared `jsonResp` wrapper.
pub(crate) fn json_response(code: u16, obj: serde_json::Value) -> Response {
    crate::errors::json_resp(code, obj)
}

/// Cookie extraction shared by every me/* endpoint (misc.rs pattern).
pub(crate) fn cookies_of(state: &AppState, headers: &HeaderMap) -> mitch_lib::auth::Cookies {
    let node_env_test = std::env::var("NODE_ENV").unwrap_or_default() == "test";
    let cookie_header = headers
        .get(axum::http::header::COOKIE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    mitch_lib::auth::get_cookies_from_header_value(
        cookie_header,
        &state.store,
        &state.id_secret,
        node_env_test,
    )
}

/// The `data/<file>` path helper used across the group.
pub(crate) fn data_file(state: &AppState, name: &str) -> std::path::PathBuf {
    state.data_dir().join(name)
}
