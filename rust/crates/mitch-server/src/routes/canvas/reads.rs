//! Canvas read endpoints (server.js:21634-21749, 23725, 23851-23854) —
//! chunks, pixels, history, whoami, heatmap, admin-bans. The JS blocks check
//! the path only (no method gate) except heatmap, which sits in the GET-routes
//! region. The in-handler `checkRateLimit` calls are no-ops in JS (the
//! prelude already stamped `req._rateLimitChecked`), so the Rust prelude gate
//! covers everything here too.

use super::state_core;
use crate::routes::me::{cookies_of, json_response, me_uid};
use crate::state::AppState;
use axum::http::{HeaderMap, Method};
use axum::response::Response;
use serde_json::{json, Map, Value};
use std::sync::Arc;

/// `authSidFromCookies` (server.js:5814) — `studentId || id || ''`.
fn canvas_sid(state: &Arc<AppState>, headers: &HeaderMap) -> String {
    me_uid(&cookies_of(state, headers))
}

/// A local query parser (server.js `qs.get`).
fn qs_get(search: &str, key: &str) -> Option<String> {
    for pair in search.trim_start_matches('?').split('&') {
        if pair.is_empty() {
            continue;
        }
        let (k, v) = pair.split_once('=').unwrap_or((pair, ""));
        if percent_decode(k) == key {
            return Some(percent_decode(v));
        }
    }
    None
}

fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 3 <= bytes.len() {
            if let Some(byte) = s
                .get(i + 1..i + 3)
                .and_then(|hex| u8::from_str_radix(hex, 16).ok())
            {
                out.push(byte);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// `/api/canvas/chunks` (server.js:21634-21662).
pub fn chunks(state: &Arc<AppState>, headers: &HeaderMap, search: &str) -> Response {
    let sid = canvas_sid(state, headers);
    let email =
        mitch_lib::auth::email_from_sid(&state.store, &state.id_secret, &sid).unwrap_or_default();
    let node_env_test = std::env::var("NODE_ENV").unwrap_or_default() == "test";
    let zone_id = qs_get(search, "zoneId").filter(|z| !z.is_empty());

    let chunk_keys: Vec<String> = match &zone_id {
        Some(zone_id) => {
            if !state_core::check_zone_access(
                &state.store,
                state.data_dir(),
                &state.id_secret,
                node_env_test,
                zone_id,
                &email,
                &sid,
            ) {
                return json_response(
                    403,
                    json!({ "error": "forbidden", "reason": "No access to this zone" }),
                );
            }
            // getZonePixels(zoneId) then `zoneChunksMap.get(zoneId) || new Map()`.
            state
                .canvas
                .get_zone_pixels(&state.store, state.data_dir(), zone_id);
            let zc = state
                .canvas
                .zone_chunks
                .lock()
                .unwrap_or_else(|e| e.into_inner());
            zc.get(zone_id).map(chunk_key_list).unwrap_or_default()
        }
        None => {
            let chunks = state
                .canvas
                .chunks
                .read()
                .unwrap_or_else(|e| e.into_inner());
            chunk_key_list(&chunks)
        }
    };

    let mut min_cx = 0.0f64;
    let mut max_cx = 0.0f64;
    let mut min_cy = 0.0f64;
    let mut max_cy = 0.0f64;
    if !chunk_keys.is_empty() {
        // coords filtered to Number.isFinite(cx) && Number.isFinite(cy).
        let coords: Vec<(f64, f64)> = chunk_keys
            .iter()
            .filter_map(|k| {
                let (xs, ys) = k.split_once(',')?;
                let cx = js_num(xs);
                let cy = js_num(ys);
                (cx.is_finite() && cy.is_finite()).then_some((cx, cy))
            })
            .collect();
        if !coords.is_empty() {
            min_cx = coords.iter().map(|(c, _)| *c).fold(f64::INFINITY, f64::min);
            max_cx = coords
                .iter()
                .map(|(c, _)| *c)
                .fold(f64::NEG_INFINITY, f64::max);
            min_cy = coords.iter().map(|(_, c)| *c).fold(f64::INFINITY, f64::min);
            max_cy = coords
                .iter()
                .map(|(_, c)| *c)
                .fold(f64::NEG_INFINITY, f64::max);
        }
    }
    // JS spreads Math.min(...coords...) with zero coords → Infinity bounds,
    // but that path is guarded by `chunks.length`; the JSON numbers render
    // via the standard serializer either way.
    json_response(
        200,
        json!({
            "ok": true,
            "chunks": chunk_keys,
            "bounds": {
                "minCx": json_num(min_cx),
                "maxCx": json_num(max_cx),
                "minCy": json_num(min_cy),
                "maxCy": json_num(max_cy),
            }
        }),
    )
}

/// `[...chunkMap.entries()].filter(([, c]) => c && Object.keys(c).length > 0)`
/// (server.js:21650-21652) — insertion order preserved.
fn chunk_key_list(chunks: &Map<String, Value>) -> Vec<String> {
    chunks
        .iter()
        .filter(|(_, chunk)| chunk.as_object().map(|o| !o.is_empty()).unwrap_or(false))
        .map(|(key, _)| key.clone())
        .collect()
}

fn js_num(s: &str) -> f64 {
    s.trim().parse::<f64>().unwrap_or(f64::NAN)
}

/// serde_json renders f64 Infinity/NaN as null (matching JSON.stringify).
fn json_num(n: f64) -> Value {
    serde_json::Number::from_f64(n)
        .map(Value::Number)
        .unwrap_or(Value::Null)
}

/// `/api/canvas/pixels` (server.js:21664-21709) — GET and POST share the
/// block; POST parses `body.chunks`/`body.zoneId`, GET reads the query.
pub fn pixels(
    state: &Arc<AppState>,
    method: &Method,
    headers: &HeaderMap,
    search: &str,
    body: &Value,
) -> Response {
    let sid = canvas_sid(state, headers);
    let email =
        mitch_lib::auth::email_from_sid(&state.store, &state.id_secret, &sid).unwrap_or_default();
    let node_env_test = std::env::var("NODE_ENV").unwrap_or_default() == "test";

    // JS keeps `zoneId` untyped: a truthy non-string (e.g. 123) still takes
    // the zone path and then fails checkZoneAccess → 403.
    let (chunks_param, zone_id): (Value, Value) = if *method == Method::POST {
        // tryParseJson happened at dispatch; a bad body is 400 there.
        (
            body.get("chunks").cloned().unwrap_or(Value::Null),
            body.get("zoneId").cloned().unwrap_or(Value::Null),
        )
    } else {
        (
            qs_get(search, "chunks")
                .map(|s| json!(s))
                .unwrap_or(Value::Null),
            qs_get(search, "zoneId")
                .map(|s| json!(s))
                .unwrap_or(Value::Null),
        )
    };
    let has_zone = mitch_lib::jsval::truthy(&zone_id);

    if has_zone {
        let zone_key = mitch_lib::jsval::string(&zone_id);
        if !state_core::check_zone_access(
            &state.store,
            state.data_dir(),
            &state.id_secret,
            node_env_test,
            &zone_key,
            &email,
            &sid,
        ) {
            return json_response(
                403,
                json!({ "error": "forbidden", "reason": "No access to this zone" }),
            );
        }
        let zone_pixels = state
            .canvas
            .get_zone_pixels(&state.store, state.data_dir(), &zone_key);
        if !mitch_lib::jsval::truthy(&chunks_param) {
            return json_response(200, Value::Object(zone_pixels.unwrap_or_default()));
        }
        let zone_chunks = state
            .canvas
            .zone_chunks
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        return json_response(
            200,
            select_chunks(zone_chunks.get(&zone_key), &chunks_param),
        );
    }

    if !mitch_lib::jsval::truthy(&chunks_param) {
        let pixels = state
            .canvas
            .pixels
            .read()
            .unwrap_or_else(|e| e.into_inner());
        return json_response(200, Value::Object(pixels.clone()));
    }
    let chunks = state
        .canvas
        .chunks
        .read()
        .unwrap_or_else(|e| e.into_inner());
    json_response(200, select_chunks(Some(&chunks), &chunks_param))
}

/// `String(chunksParam || '').split(';')` / array form, then
/// `Object.assign(result, chunk)` per requested chunk (order preserved).
fn select_chunks(chunks: Option<&Map<String, Value>>, chunks_param: &Value) -> Value {
    // JS uses the array elements directly as Map keys: only strings can hit
    // a chunk map (numbers never match the string keys), so non-strings miss.
    let requested: Vec<Option<String>> = if let Some(arr) = chunks_param.as_array() {
        arr.iter().map(|v| v.as_str().map(str::to_string)).collect()
    } else {
        mitch_lib::jsval::string(chunks_param)
            .split(';')
            .map(|s| Some(s.to_string()))
            .collect()
    };
    let mut result = Map::new();
    if let Some(chunks) = chunks {
        for ck in &requested {
            let Some(key) = ck else { continue };
            if let Some(chunk) = chunks.get(key).and_then(|v| v.as_object()) {
                for (k, v) in chunk {
                    result.insert(k.clone(), v.clone());
                }
            }
        }
    }
    Value::Object(result)
}

/// `/api/canvas/history` (server.js:21711-21739) — raw-fs JSONL read (the JS
/// never routes these through the DB), last 5000 lines.
pub fn history(state: &Arc<AppState>, headers: &HeaderMap, search: &str) -> Response {
    let sid = canvas_sid(state, headers);
    let email =
        mitch_lib::auth::email_from_sid(&state.store, &state.id_secret, &sid).unwrap_or_default();
    let node_env_test = std::env::var("NODE_ENV").unwrap_or_default() == "test";
    let zone_id = qs_get(search, "zoneId").filter(|z| !z.is_empty());

    if let Some(zone_id) = &zone_id {
        if !state_core::check_zone_access(
            &state.store,
            state.data_dir(),
            &state.id_secret,
            node_env_test,
            zone_id,
            &email,
            &sid,
        ) {
            return json_response(
                403,
                json!({ "error": "forbidden", "reason": "No access to this zone" }),
            );
        }
    }

    let file = match &zone_id {
        Some(zone_id) => state_core::zone_history_file(state.data_dir(), zone_id),
        None => state_core::canvas_history_file(state.data_dir()),
    };
    let mut history: Vec<Value> = Vec::new();
    // The whole read/parse loop sits inside one try in JS: a malformed line
    // aborts with the entries parsed so far kept.
    if let Ok(content) = std::fs::read_to_string(&file) {
        let lines: Vec<&str> = content.trim().split('\n').collect();
        let start = lines.len().saturating_sub(5000);
        for line in &lines[start..] {
            if line.trim().is_empty() {
                continue;
            }
            match serde_json::from_str::<Value>(line) {
                Ok(v) => history.push(v),
                Err(_) => break,
            }
        }
    }
    json_response(200, json!({ "history": history }))
}

/// `/api/canvas/whoami` (server.js:21741-21749).
pub fn whoami(state: &Arc<AppState>, headers: &HeaderMap) -> Response {
    let sid = canvas_sid(state, headers);
    let node_env_test = std::env::var("NODE_ENV").unwrap_or_default() == "test";
    let is_admin = if sid.is_empty() {
        false
    } else {
        mitch_lib::auth::is_admin_id(&state.store, &state.id_secret, &sid, node_env_test)
    };
    let is_moderator = if sid.is_empty() {
        false
    } else {
        mitch_lib::auth::is_moderator_id(&state.store, &state.id_secret, &sid)
    };
    let email = mitch_lib::auth::email_from_sid(&state.store, &state.id_secret, &sid);
    let is_premium = email
        .as_ref()
        .map(|e| mitch_lib::auth::is_premium_email(&state.store, e))
        .unwrap_or(false);
    json_response(
        200,
        json!({
            "isAdmin": is_admin,
            "isModerator": is_moderator,
            "email": email,
            "isPremium": is_premium,
        }),
    )
}

/// `/api/canvas/heatmap` (server.js:23851-23854, GET-only block).
pub fn heatmap(state: &Arc<AppState>) -> Response {
    json_response(
        200,
        json!({ "points": Value::Object(state.canvas.heatmap_object()) }),
    )
}

/// `/api/canvas/admin-bans` (server.js:23725-23729) — fresh load per call.
pub fn admin_bans(state: &Arc<AppState>) -> Response {
    json_response(200, state_core::load_bans(&state.store, state.data_dir()))
}
