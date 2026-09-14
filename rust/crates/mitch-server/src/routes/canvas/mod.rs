//! `/api/canvas/*` route group (plan Step 10) — the r/place clone.
//!
//! Batch 1: the state core (`state_core.rs`) and the read endpoints
//! (`reads.rs`) plus the disabled moderate/report stubs. Painting
//! (pixel/bulk/erase + admin-erase/ban/unban) lands in batch 2; the
//! bookmarks + zones families and `/api/admin/canvas-report-status` in
//! batch 3. The `broadcastCanvasDelta` WS fan-outs land with Step 11.

mod paint;
mod reads;
pub mod state_core;

pub use state_core::CanvasState;

use crate::routes::me::json_response;
use crate::state::AppState;
use axum::http::{HeaderMap, Method};
use axum::response::Response;
use serde_json::{json, Value};
use std::sync::Arc;

/// API route dispatch — called from handler.rs after the auth gates.
/// Returns `Some(Response)` for a matched route, `None` for fallthrough.
pub async fn handle(
    state: &Arc<AppState>,
    method: &Method,
    path: &str,
    headers: &HeaderMap,
    search: &str,
    body: &Value,
    body_bytes: &[u8],
) -> Option<Response> {
    match (method, path) {
        // The JS blocks check the path only — every method lands here.
        (_, "/api/canvas/chunks") => Some(reads::chunks(state, headers, search)),
        (_, "/api/canvas/pixels") => {
            if *method == Method::POST {
                let Some(body) = super::me::parse_body_strict(body_bytes) else {
                    return Some(json_response(400, json!({ "error": "bad json" })));
                };
                return Some(reads::pixels(state, method, headers, search, &body));
            }
            Some(reads::pixels(state, method, headers, search, body))
        }
        (_, "/api/canvas/history") => Some(reads::history(state, headers, search)),
        // Batch 2: the painting family. Non-POST falls through to the 404
        // ladder exactly like the JS `&& method === 'POST'` guards.
        (_, "/api/canvas/pixel")
        | (_, "/api/canvas/pixels/bulk")
        | (_, "/api/canvas/erase")
        | (_, "/api/canvas/admin-erase")
        | (_, "/api/canvas/admin-ban")
        | (_, "/api/canvas/admin-unban") => {
            paint::dispatch(state, method, path, headers, body_bytes)
        }
        (_, "/api/canvas/whoami") => Some(reads::whoami(state, headers)),
        (_, "/api/canvas/admin-bans") => Some(reads::admin_bans(state)),
        // heatmap sits inside the JS GET-routes region: other methods fall
        // through to the static 405/404 ladder.
        (m, "/api/canvas/heatmap") if *m == Method::GET => Some(reads::heatmap(state)),
        (m, "/api/canvas/moderate") if *m == Method::POST => {
            // server.js:22036-22038 — the detector is disabled.
            Some(json_response(
                200,
                json!({ "ok": true, "flagged": false, "disabled": true }),
            ))
        }
        (m, "/api/canvas/report") if *m == Method::POST => {
            // server.js:22040-22042.
            Some(json_response(
                410,
                json!({ "error": "Canvas review queue is disabled." }),
            ))
        }
        _ => None,
    }
}
