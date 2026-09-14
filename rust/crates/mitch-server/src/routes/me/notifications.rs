//! `/api/me/coin-gifts*`, `/api/me/notif-prefs`, `/api/me/notifications*`,
//! `/api/me/complete-tutorial` — ported in Step 9 batch 2.

#![allow(dead_code)]

use crate::state::AppState;
use axum::http::{HeaderMap, Method};
use axum::response::Response;
use serde_json::Value;
use std::sync::Arc;

pub(crate) fn handle(
    _state: &Arc<AppState>,
    _method: &Method,
    _path: &str,
    _headers: &HeaderMap,
    _body: &Value,
    _body_bytes: &[u8],
) -> Option<Response> {
    None
}
