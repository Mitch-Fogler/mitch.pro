//! Canvas bookmarks + zones + the admin report-status endpoint
//! (server.js:22044-22349).
//!
//! Parity notes:
//! - Bookmarks are a JSON array, zones an object keyed by zone id; both are
//!   `loadJson`/`saveJson` files → the DB-backed document layer.
//! - Ids reuse the JS shape `'bm_'|'zone_' + Date.now().toString(36) +
//!   Math.random().toString(36).slice(2, 6)`. The random tail is 4 base36
//!   chars here (the JS shortest-digit form can occasionally emit fewer —
//!   ids are random either way, so the shape contract is what matters).
//! - zones GET reuses `check_zone_access` — the exact port of the same
//!   visibility ladder (admin → owner → friendsOnly both directions →
//!   allowedUsers).
//! - zones/delete `rmSync`s the raw zone_pixels/zone_history files only (the
//!   DB documents are not touched — JS behaves the same), and does NOT clear
//!   the in-memory zone caches (JS does not either). zones/clear removes the
//!   cache entries and rewrites the pixel file, per the JS.

use super::paint::admin_ok;
use super::reads::canvas_sid;
use super::state_core;
use crate::routes::me::{json_response, parse_body_strict};
use crate::state::AppState;
use axum::http::{HeaderMap, Method};
use axum::response::Response;
use mitch_lib::auth::{email_from_sid, normalize_email};
use mitch_lib::jsval;
use mitch_lib::school::{now_millis, utc_iso_day};
use serde_json::{json, Map, Value};
use std::sync::Arc;

const BASE36: &[u8] = b"0123456789abcdefghijklmnopqrstuvwxyz";

/// `Date.now().toString(36)` — the JS form is lowercase base36 of the
/// non-negative integer.
fn to_base36(mut n: u64) -> String {
    if n == 0 {
        return "0".to_string();
    }
    let mut buf = [0u8; 13]; // 2^64 < 36^13
    let mut i = buf.len();
    while n > 0 {
        i -= 1;
        buf[i] = BASE36[(n % 36) as usize];
        n /= 36;
    }
    String::from_utf8_lossy(&buf[i..]).into_owned()
}

/// The `Math.random().toString(36).slice(2, 6)` id suffix — 4 random base36
/// chars (see the module note).
fn random_base36_4() -> String {
    use rand::Rng;
    (0..4)
        .map(|_| BASE36[rand::rng().random_range(0..36)] as char)
        .collect()
}

/// `new Date().toISOString().split('T')[0]` — the UTC ISO day.
fn today_str() -> String {
    utc_iso_day(now_millis())
}

/// `normalizeEmail(v)` for a raw JSON value — JS `!email` short-circuits to
/// `''` before the String coercion, so null/undefined/0 → `''`, not "null".
fn norm_js(v: &Value) -> String {
    if jsval::truthy(v) {
        normalize_email(&jsval::string(v))
    } else {
        String::new()
    }
}

/// `String(v || '')` — falsy falls to the empty string.
fn string_or_empty(v: Option<&Value>) -> String {
    v.filter(|x| jsval::truthy(x))
        .map(jsval::string)
        .unwrap_or_default()
}

fn load_zones(state: &Arc<AppState>) -> Map<String, Value> {
    state
        .store
        .read_document(&state_core::zones_file(state.data_dir()), json!({}))
        .as_object()
        .cloned()
        .unwrap_or_default()
}

/// `emailFromSid(sid)` with the JS `if (!email)` gate folded in — callers
/// emit the 401 themselves (keeps `Response` out of a Result).
fn gate_email(state: &Arc<AppState>, headers: &HeaderMap) -> Option<String> {
    let sid = canvas_sid(state, headers);
    email_from_sid(&state.store, &state.id_secret, &sid).filter(|e| !e.is_empty())
}

/// True unless `normalizeEmail(zone.owner) !== normalizeEmail(email) &&
/// !isAnyAdminId(sid)` — the JS 403-forbidden condition.
fn gate_owner_or_admin(
    state: &Arc<AppState>,
    sid: &str,
    email: &str,
    zone: &Map<String, Value>,
) -> bool {
    let owner = norm_js(zone.get("owner").unwrap_or(&Value::Null));
    owner == normalize_email(email) || admin_ok(state, sid)
}

/// `/api/canvas/bookmarks` POST (server.js:22064-22095).
pub fn bookmarks_post(state: &Arc<AppState>, headers: &HeaderMap, body: &Value) -> Response {
    let Some(email) = gate_email(state, headers) else {
        return json_response(401, json!({ "error": "Unauthorized" }));
    };
    let x = body.get("x").and_then(|v| v.as_f64());
    let y = body.get("y").and_then(|v| v.as_f64());
    let name = body.get("name");
    let is_public = jsval::truthy(body.get("isPublic").unwrap_or(&Value::Null));
    if x.is_none() || y.is_none() || !jsval::truthy(name.unwrap_or(&Value::Null)) {
        return json_response(400, json!({ "error": "missing fields" }));
    }

    let today = today_str();
    let mut bookmarks: Vec<Value> = state
        .store
        .read_document(
            &state_core::canvas_bookmarks_file(state.data_dir()),
            json!([]),
        )
        .as_array()
        .cloned()
        .unwrap_or_default();
    let user_today = bookmarks.iter().filter(|b| {
        b.get("creator").and_then(|v| v.as_str()) == Some(email.as_str())
            && b.get("date").and_then(|v| v.as_str()) == Some(today.as_str())
    });
    if is_public {
        let public_today = user_today
            .clone()
            .filter(|b| jsval::truthy(b.get("isPublic").unwrap_or(&Value::Null)))
            .count();
        if public_today >= 1 {
            return json_response(
                429,
                json!({ "error": "You can only create 1 public bookmark per day." }),
            );
        }
    } else {
        let private_today = user_today
            .filter(|b| !jsval::truthy(b.get("isPublic").unwrap_or(&Value::Null)))
            .count();
        if private_today >= 10 {
            return json_response(
                429,
                json!({ "error": "You can only create 10 private bookmarks per day." }),
            );
        }
    }

    let id = format!(
        "bm_{}{}",
        to_base36(now_millis().max(0) as u64),
        random_base36_4()
    );
    let bm = json!({
        "id": id,
        "x": body.get("x").cloned().unwrap_or(Value::Null),
        "y": body.get("y").cloned().unwrap_or(Value::Null),
        "name": jsval::js_slice_utf16(&string_or_empty(name), 60),
        "creator": email,
        "isPublic": is_public,
        "approved": !is_public,
        "date": today,
    });
    bookmarks.push(bm.clone());
    let _ = state.store.write_document(
        &state_core::canvas_bookmarks_file(state.data_dir()),
        &Value::Array(bookmarks),
    );
    json_response(200, json!({ "ok": true, "bookmark": bm }))
}

/// `/api/canvas/bookmarks` GET (server.js:22097-22112).
pub fn bookmarks_get(state: &Arc<AppState>, headers: &HeaderMap) -> Response {
    let Some(email) = gate_email(state, headers) else {
        return json_response(401, json!({ "error": "Unauthorized" }));
    };
    let sid = canvas_sid(state, headers);
    let admin = admin_ok(state, &sid);
    let bookmarks: Vec<Value> = state
        .store
        .read_document(
            &state_core::canvas_bookmarks_file(state.data_dir()),
            json!([]),
        )
        .as_array()
        .cloned()
        .unwrap_or_default();
    let visible: Vec<Value> = bookmarks
        .into_iter()
        .filter(|b| {
            if admin {
                return true;
            }
            if b.get("creator").and_then(|v| v.as_str()) == Some(email.as_str()) {
                return true;
            }
            jsval::truthy(b.get("isPublic").unwrap_or(&Value::Null))
                && jsval::truthy(b.get("approved").unwrap_or(&Value::Null))
        })
        .collect();
    json_response(200, json!({ "ok": true, "bookmarks": visible }))
}

/// `/api/canvas/bookmarks/approve` POST (server.js:22114-22126).
pub fn bookmarks_approve(state: &Arc<AppState>, headers: &HeaderMap, body: &Value) -> Response {
    let sid = canvas_sid(state, headers);
    if !admin_ok(state, &sid) {
        return json_response(403, json!({ "error": "forbidden" }));
    }
    let Some(id) = body.get("id").filter(|v| jsval::truthy(v)) else {
        return json_response(400, json!({ "error": "missing id" }));
    };
    let mut bookmarks: Vec<Value> = state
        .store
        .read_document(
            &state_core::canvas_bookmarks_file(state.data_dir()),
            json!([]),
        )
        .as_array()
        .cloned()
        .unwrap_or_default();
    let Some(bm) = bookmarks.iter_mut().find(|b| b.get("id") == Some(id)) else {
        return json_response(404, json!({ "error": "bookmark not found" }));
    };
    if let Some(obj) = bm.as_object_mut() {
        obj.insert("approved".into(), json!(true));
    }
    let _ = state.store.write_document(
        &state_core::canvas_bookmarks_file(state.data_dir()),
        &Value::Array(bookmarks),
    );
    json_response(200, json!({ "ok": true }))
}

/// `/api/canvas/zones` POST (server.js:22128-22155).
pub async fn zones_post(state: &Arc<AppState>, headers: &HeaderMap, body: &Value) -> Response {
    let Some(email) = gate_email(state, headers) else {
        return json_response(401, json!({ "error": "Unauthorized" }));
    };
    let ip = crate::handler::get_real_ip(headers, None);
    let token = jsval::string(&jsval::or(body.get("recaptcha_token"), json!("")));
    if !crate::routes::push::verify_recaptcha(state, &token, &ip, "").await {
        return json_response(
            400,
            json!({ "error": "reCAPTCHA failed. Please try again." }),
        );
    }
    let name = body.get("name");
    if !jsval::truthy(name.unwrap_or(&Value::Null)) {
        return json_response(400, json!({ "error": "missing fields" }));
    }

    let mut zones = load_zones(state);
    let norm_email = normalize_email(&email);
    let user_zones = zones
        .values()
        .filter(|z| norm_js(z.get("owner").unwrap_or(&Value::Null)) == norm_email)
        .count();
    if user_zones >= 10 {
        return json_response(
            400,
            json!({ "error": "You can only create up to 10 zones." }),
        );
    }

    let zone_id = format!(
        "zone_{}{}",
        to_base36(now_millis().max(0) as u64),
        random_base36_4()
    );
    let zone = json!({
        "id": zone_id,
        "name": jsval::js_slice_utf16(&string_or_empty(name), 60),
        "description": jsval::js_slice_utf16(&string_or_empty(body.get("description")), 120),
        "owner": email,
        "friendsOnly": jsval::truthy(body.get("friendsOnly").unwrap_or(&Value::Null)),
        "allowedUsers": [],
        "createdAt": now_millis(),
    });
    zones.insert(zone_id.clone(), zone.clone());
    let _ = state.store.write_document(
        &state_core::zones_file(state.data_dir()),
        &Value::Object(zones),
    );
    // JS responds with `zones[zoneId]` — the object it just stored.
    json_response(200, json!({ "ok": true, "zone": zone }))
}

/// `/api/canvas/zones` GET (server.js:22157-22203).
pub fn zones_get(state: &Arc<AppState>, headers: &HeaderMap) -> Response {
    let Some(email) = gate_email(state, headers) else {
        return json_response(401, json!({ "error": "Unauthorized" }));
    };
    let sid = canvas_sid(state, headers);
    let node_env_test = std::env::var("NODE_ENV").unwrap_or_default() == "test";
    let zones = load_zones(state);
    let list: Vec<Value> = zones
        .keys()
        .filter(|id| {
            state_core::check_zone_access(
                &state.store,
                state.data_dir(),
                &state.id_secret,
                node_env_test,
                id,
                &email,
                &sid,
            )
        })
        .filter_map(|id| zones.get(id).cloned())
        .collect();
    json_response(200, json!({ "ok": true, "zones": list }))
}

/// `/api/canvas/zones/add-user` POST (server.js:22205-22228). A missing
/// `allowedUsers` array throws in JS inside the resolve try/catch → the
/// catch's `User not found`; the None arm below mirrors that.
pub fn zones_add_user(state: &Arc<AppState>, headers: &HeaderMap, body: &Value) -> Response {
    let Some(email) = gate_email(state, headers) else {
        return json_response(401, json!({ "error": "Unauthorized" }));
    };
    let sid = canvas_sid(state, headers);
    let Some(zone_id) = body
        .get("zoneId")
        .filter(|v| jsval::truthy(v))
        .map(jsval::string)
    else {
        return json_response(400, json!({ "error": "missing fields" }));
    };
    let Some(user) = body.get("user").filter(|v| jsval::truthy(v)) else {
        return json_response(400, json!({ "error": "missing fields" }));
    };
    let mut zones = load_zones(state);
    let Some(zone) = zones
        .get_mut(zone_id.as_str())
        .and_then(|z| z.as_object_mut())
    else {
        return json_response(404, json!({ "error": "zone not found" }));
    };
    if !gate_owner_or_admin(state, &sid, &email, zone) {
        return json_response(403, json!({ "error": "forbidden" }));
    }

    let target = mitch_lib::profile::resolve_target_email(
        &state.store,
        state.data_dir(),
        &state.id_secret,
        &jsval::string(user),
    );
    let Some(target_email) = target.filter(|t| !t.is_empty()) else {
        return json_response(404, json!({ "error": "User not found" }));
    };
    let Some(allowed) = zone.get_mut("allowedUsers").and_then(|v| v.as_array_mut()) else {
        // JS `zone.allowedUsers.map` on undefined → caught → 404.
        return json_response(404, json!({ "error": "User not found" }));
    };
    let norm_target = normalize_email(&target_email);
    let already = allowed.iter().any(|e| norm_js(e) == norm_target);
    if already {
        return json_response(400, json!({ "error": "User already added" }));
    }
    allowed.push(json!(target_email));
    let allowed_out = allowed.clone();
    let _ = state.store.write_document(
        &state_core::zones_file(state.data_dir()),
        &Value::Object(zones),
    );
    json_response(200, json!({ "ok": true, "allowedUsers": allowed_out }))
}

/// `/api/canvas/zones/remove-user` POST (server.js:22230-22248).
pub fn zones_remove_user(state: &Arc<AppState>, headers: &HeaderMap, body: &Value) -> Response {
    let Some(email) = gate_email(state, headers) else {
        return json_response(401, json!({ "error": "Unauthorized" }));
    };
    let sid = canvas_sid(state, headers);
    let Some(zone_id) = body
        .get("zoneId")
        .filter(|v| jsval::truthy(v))
        .map(jsval::string)
    else {
        return json_response(400, json!({ "error": "missing fields" }));
    };
    let Some(user) = body.get("user").filter(|v| jsval::truthy(v)) else {
        return json_response(400, json!({ "error": "missing fields" }));
    };
    let mut zones = load_zones(state);
    let Some(zone) = zones
        .get_mut(zone_id.as_str())
        .and_then(|z| z.as_object_mut())
    else {
        return json_response(404, json!({ "error": "zone not found" }));
    };
    if !gate_owner_or_admin(state, &sid, &email, zone) {
        return json_response(403, json!({ "error": "forbidden" }));
    }
    let norm_target = norm_js(user);
    let Some(allowed) = zone.get_mut("allowedUsers").and_then(|v| v.as_array_mut()) else {
        // JS `findIndex` on undefined → TypeError → uncaught 500; treat the
        // same way as add-user's crash-path instead (caught → 404). Real
        // zones always carry the array, so this arm is theoretical.
        return json_response(404, json!({ "error": "User not allowed" }));
    };
    let Some(idx) = allowed.iter().position(|e| norm_js(e) == norm_target) else {
        return json_response(404, json!({ "error": "User not allowed" }));
    };
    allowed.remove(idx);
    let allowed_out = allowed.clone();
    let _ = state.store.write_document(
        &state_core::zones_file(state.data_dir()),
        &Value::Object(zones),
    );
    json_response(200, json!({ "ok": true, "allowedUsers": allowed_out }))
}

/// `/api/canvas/zones/delete` POST (server.js:22250-22276).
pub fn zones_delete(state: &Arc<AppState>, headers: &HeaderMap, body: &Value) -> Response {
    let Some(email) = gate_email(state, headers) else {
        return json_response(401, json!({ "error": "Unauthorized" }));
    };
    let sid = canvas_sid(state, headers);
    let Some(zone_id) = body
        .get("zoneId")
        .filter(|v| jsval::truthy(v))
        .map(jsval::string)
    else {
        return json_response(400, json!({ "error": "missing zoneId" }));
    };
    let mut zones = load_zones(state);
    let Some(zone) = zones.get(zone_id.as_str()).and_then(|z| z.as_object()) else {
        return json_response(404, json!({ "error": "zone not found" }));
    };
    if !gate_owner_or_admin(state, &sid, &email, zone) {
        return json_response(403, json!({ "error": "forbidden" }));
    }
    zones.remove(zone_id.as_str());
    let _ = state.store.write_document(
        &state_core::zones_file(state.data_dir()),
        &Value::Object(zones),
    );

    // JS `if (existsSync(pFile)) rmSync(pFile)` inside a swallowed try —
    // raw-fs deletes only; the DB documents stay (JS is the same).
    let _ = std::fs::remove_file(state_core::zone_pixels_file(
        state.data_dir(),
        zone_id.as_str(),
    ));
    let _ = std::fs::remove_file(state_core::zone_history_file(
        state.data_dir(),
        zone_id.as_str(),
    ));
    json_response(200, json!({ "ok": true }))
}

/// `/api/canvas/zones/update` POST (server.js:22278-22298). The
/// `!== undefined` guards mean an explicit `null` still applies
/// (`String(null || '')` = ''), so key presence is what matters.
pub fn zones_update(state: &Arc<AppState>, headers: &HeaderMap, body: &Value) -> Response {
    let Some(email) = gate_email(state, headers) else {
        return json_response(401, json!({ "error": "Unauthorized" }));
    };
    let sid = canvas_sid(state, headers);
    let Some(zone_id) = body
        .get("zoneId")
        .filter(|v| jsval::truthy(v))
        .map(jsval::string)
    else {
        return json_response(400, json!({ "error": "missing zoneId" }));
    };
    let mut zones = load_zones(state);
    let Some(zone) = zones
        .get_mut(zone_id.as_str())
        .and_then(|z| z.as_object_mut())
    else {
        return json_response(404, json!({ "error": "zone not found" }));
    };
    if !gate_owner_or_admin(state, &sid, &email, zone) {
        return json_response(403, json!({ "error": "forbidden" }));
    }
    if let Some(name) = body.get("name") {
        zone.insert(
            "name".into(),
            json!(jsval::js_slice_utf16(&string_or_empty(Some(name)), 60)),
        );
    }
    if let Some(description) = body.get("description") {
        zone.insert(
            "description".into(),
            json!(jsval::js_slice_utf16(
                &string_or_empty(Some(description)),
                120
            )),
        );
    }
    if let Some(friends_only) = body.get("friendsOnly") {
        zone.insert("friendsOnly".into(), json!(jsval::truthy(friends_only)));
    }
    let zone_out = zones.get(zone_id.as_str()).cloned().unwrap_or(json!({}));
    let _ = state.store.write_document(
        &state_core::zones_file(state.data_dir()),
        &Value::Object(zones),
    );
    json_response(200, json!({ "ok": true, "zone": zone_out }))
}

/// `/api/canvas/zones/clear` POST (server.js:22300-22327).
pub fn zones_clear(state: &Arc<AppState>, headers: &HeaderMap, body: &Value) -> Response {
    let Some(email) = gate_email(state, headers) else {
        return json_response(401, json!({ "error": "Unauthorized" }));
    };
    let sid = canvas_sid(state, headers);
    let Some(zone_id) = body
        .get("zoneId")
        .filter(|v| jsval::truthy(v))
        .map(jsval::string)
    else {
        return json_response(400, json!({ "error": "missing zoneId" }));
    };
    let zones = load_zones(state);
    let Some(zone) = zones.get(zone_id.as_str()).and_then(|z| z.as_object()) else {
        return json_response(404, json!({ "error": "zone not found" }));
    };
    if !gate_owner_or_admin(state, &sid, &email, zone) {
        return json_response(403, json!({ "error": "forbidden" }));
    }

    // Clear caches.
    {
        let mut zp = state
            .canvas
            .zone_pixels
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        zp.remove(zone_id.as_str());
    }
    {
        let mut zc = state
            .canvas
            .zone_chunks
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        zc.remove(zone_id.as_str());
    }
    // saveJson(zone_pixels_<id>.json, {}).
    let _ = state.store.write_document(
        &state_core::zone_pixels_file(state.data_dir(), zone_id.as_str()),
        &json!({}),
    );
    // Truncate the raw history file if it exists.
    let history = state_core::zone_history_file(state.data_dir(), zone_id.as_str());
    if history.exists() {
        let _ = std::fs::write(&history, b"");
    }
    // broadcastCanvasDelta({ action: 'clear', zoneId }) lands with Step 11.
    json_response(200, json!({ "ok": true }))
}

/// `/api/admin/canvas-report-status` POST (server.js:22044-22062) — lives
/// here because unmatched `/api/admin/*` paths fall through to this module.
pub fn admin_report_status(state: &Arc<AppState>, headers: &HeaderMap, body: &Value) -> Response {
    let sid = canvas_sid(state, headers);
    if !admin_ok(state, &sid) {
        return json_response(403, json!({ "error": "forbidden" }));
    }
    let id = jsval::string_of(Some(&jsval::or(body.get("id"), json!(""))));
    let status_raw = jsval::string_of(Some(&jsval::or(body.get("status"), json!(""))));
    let status = jsval::js_slice_utf16(&status_raw, 40);
    if id.is_empty()
        || !matches!(
            status.as_str(),
            "Needs review" | "Reviewing" | "Resolved" | "Dismissed"
        )
    {
        return json_response(400, json!({ "error": "invalid status" }));
    }
    let mut reports: Vec<Value> = state
        .store
        .read_document(
            &state_core::canvas_reports_file(state.data_dir()),
            json!([]),
        )
        .as_array()
        .cloned()
        .unwrap_or_default();
    let Some(report) = reports
        .iter_mut()
        .find(|r| r.get("id").and_then(|v| v.as_str()) == Some(id.as_str()))
    else {
        return json_response(404, json!({ "error": "report found" }));
    };
    if let Some(obj) = report.as_object_mut() {
        obj.insert("status".into(), json!(status));
        obj.insert("reviewedAt".into(), json!(now_millis()));
        obj.insert(
            "reviewedBy".into(),
            json!(email_from_sid(&state.store, &state.id_secret, &sid)
                .unwrap_or_else(|| "admin".to_string())),
        );
    }
    let reviewed_by = report
        .get("reviewedBy")
        .and_then(|v| v.as_str())
        .unwrap_or("admin")
        .to_string();
    let _ = state.store.write_document(
        &state_core::canvas_reports_file(state.data_dir()),
        &Value::Array(reports),
    );
    mitch_lib::admin::log_admin_action(
        &state.store,
        state.data_dir(),
        &reviewed_by,
        "canvas_report_status",
        json!({ "id": id, "status": status }),
    );
    json_response(200, json!({ "ok": true }))
}

/// Route dispatch — returns `None` for non-matching methods so the caller
/// falls through to the 404/405 ladder like the JS `&& method ===` guards.
pub async fn dispatch(
    state: &Arc<AppState>,
    method: &Method,
    path: &str,
    headers: &HeaderMap,
    body_bytes: &[u8],
) -> Option<Response> {
    match path {
        "/api/canvas/bookmarks" => {
            if *method == Method::POST {
                let body = parse_body_strict(body_bytes)?;
                return Some(bookmarks_post(state, headers, &body));
            }
            if *method == Method::GET {
                return Some(bookmarks_get(state, headers));
            }
            None
        }
        "/api/canvas/bookmarks/approve" => {
            if *method != Method::POST {
                return None;
            }
            let body = parse_body_strict(body_bytes)?;
            Some(bookmarks_approve(state, headers, &body))
        }
        "/api/canvas/zones" => {
            if *method == Method::POST {
                let body = parse_body_strict(body_bytes)?;
                return Some(zones_post(state, headers, &body).await);
            }
            if *method == Method::GET {
                return Some(zones_get(state, headers));
            }
            None
        }
        "/api/canvas/zones/add-user" => {
            if *method != Method::POST {
                return None;
            }
            let body = parse_body_strict(body_bytes)?;
            Some(zones_add_user(state, headers, &body))
        }
        "/api/canvas/zones/remove-user" => {
            if *method != Method::POST {
                return None;
            }
            let body = parse_body_strict(body_bytes)?;
            Some(zones_remove_user(state, headers, &body))
        }
        "/api/canvas/zones/delete" => {
            if *method != Method::POST {
                return None;
            }
            let body = parse_body_strict(body_bytes)?;
            Some(zones_delete(state, headers, &body))
        }
        "/api/canvas/zones/update" => {
            if *method != Method::POST {
                return None;
            }
            let body = parse_body_strict(body_bytes)?;
            Some(zones_update(state, headers, &body))
        }
        "/api/canvas/zones/clear" => {
            if *method != Method::POST {
                return None;
            }
            let body = parse_body_strict(body_bytes)?;
            Some(zones_clear(state, headers, &body))
        }
        "/api/admin/canvas-report-status" => {
            if *method != Method::POST {
                return None;
            }
            let body = parse_body_strict(body_bytes)?;
            Some(admin_report_status(state, headers, &body))
        }
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    #![cfg_attr(test, allow(clippy::unwrap_used, clippy::expect_used))]
    use super::*;

    /// `Date.now().toString(36)` goldens from bun (2026-09-14).
    #[test]
    fn base36_matches_js_tostring36() {
        assert_eq!(to_base36(0), "0");
        assert_eq!(to_base36(36), "10");
        assert_eq!(to_base36(100), "2s");
        assert_eq!(to_base36(1_736_900_000_000), "m5x5exa8");
        assert_eq!(to_base36(1_789_371_028_843), "mu0xb697");
        assert_eq!(to_base36(4_294_967_296), "1z141z4");
        assert_eq!(to_base36(9_007_199_254_740_991), "2gosa7pa2gv");
    }

    /// The id suffix: 4 lowercase base36 chars — the JS
    /// `Math.random().toString(36).slice(2, 6)` shape.
    #[test]
    fn random_id_suffix_shape() {
        for _ in 0..64 {
            let s = random_base36_4();
            assert_eq!(s.len(), 4);
            assert!(s
                .bytes()
                .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit()));
        }
        assert_eq!(random_base36_4().len(), 4);
    }

    /// Bookmark/zone id shapes: `bm_`/`zone_` + base36 timestamp + 4 chars.
    #[test]
    fn generated_ids_match_js_shape() {
        let bm_id = format!(
            "bm_{}{}",
            to_base36(now_millis().max(0) as u64),
            random_base36_4()
        );
        let zone_id = format!(
            "zone_{}{}",
            to_base36(now_millis().max(0) as u64),
            random_base36_4()
        );
        let js_shape = |id: &str, prefix: &str| {
            id.starts_with(prefix)
                && id[prefix.len()..]
                    .chars()
                    .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit())
        };
        assert!(js_shape(&bm_id, "bm_"));
        assert!(js_shape(&zone_id, "zone_"));
        // Date.now() is always positive — never the bare "0" form.
        assert_ne!(to_base36(now_millis().max(0) as u64), "0");
    }

    /// `normalizeEmail` on raw JSON values: JS `!email` short-circuits to ''
    /// BEFORE String coercion — null/undefined/0/false → '', not "null".
    #[test]
    fn norm_js_matches_normalize_email_falsy_gate() {
        assert_eq!(norm_js(&Value::Null), "");
        assert_eq!(norm_js(&json!(0)), "");
        assert_eq!(norm_js(&json!(false)), "");
        assert_eq!(norm_js(&json!(" A@B.C ")), "a@b.c");
        assert_eq!(norm_js(&json!(123)), "123");
        assert_eq!(norm_js(&json!({})), "[object object]"); // String({}).toLowerCase()
        assert_eq!(string_or_empty(Some(&Value::Null)), "");
        assert_eq!(string_or_empty(Some(&json!("Hi "))), "Hi ");
        assert_eq!(string_or_empty(None), "");
        assert_eq!(string_or_empty(Some(&json!(0))), "");
    }
}
