//! `/api/dm/*` — 13 endpoints + `/ws` presence/chat (plan Step 11).
//! sealAtRest/openAtRest, allSockets/userPresence, same-origin upgrade check,
//! identical JSON message shapes. Ported before games: per-conversation state
//! is bounded and proves the WS + at-rest + presence stack. Wired into
//! handler.rs BEFORE canvas (JS order: dm at 19452, canvas at 21634+).

mod notif;
mod send;

use crate::state::AppState;
use axum::http::{HeaderMap, Method};
use axum::response::Response;
use std::sync::Arc;

/// Dispatches `/api/dm/*` requests; `None` falls through to the next group.
pub(crate) async fn handle(
    state: &Arc<AppState>,
    method: &Method,
    path: &str,
    headers: &HeaderMap,
    body_bytes: &[u8],
) -> Option<Response> {
    // /api/dm/send has no explicit method check in the JS (any verb that
    // carries a body reaches the ladder).
    if path == "/api/dm/send" {
        return send::handle(state, headers, body_bytes).await;
    }
    let _ = method;
    None
}
