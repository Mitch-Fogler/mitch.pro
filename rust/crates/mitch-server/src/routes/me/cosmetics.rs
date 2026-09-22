//! `/api/me/inventory` + `/api/me/cosmetics/equip` (server.js:11347-11355,
//! 12281-12320).

use super::{cookies_of, data_file, json_response, parse_body_strict};
use crate::state::AppState;
use axum::http::{HeaderMap, Method};
use axum::response::Response;
use mitch_lib::auth;
use serde_json::{json, Value};
use std::sync::Arc;

pub(crate) fn handle(
    state: &Arc<AppState>,
    method: &Method,
    path: &str,
    headers: &HeaderMap,
    body: &Value,
    body_bytes: &[u8],
) -> Option<Response> {
    if path == "/api/shop/items" && *method == Method::GET {
        return Some(shop_items(state, headers));
    }
    if path == "/api/me/inventory" && *method == Method::GET {
        return Some(me_inventory(state, headers));
    }
    if path == "/api/me/cosmetics/equip" && *method == Method::POST {
        return Some(me_cosmetics_equip(state, headers, body, body_bytes));
    }
    None
}

/// `GET /api/shop/items` — server.js:12018-12027.
fn shop_items(state: &Arc<AppState>, headers: &HeaderMap) -> Response {
    let cookies = cookies_of(state, headers);
    let sid = super::me_uid(&cookies);
    let email = if auth::valid_id(&sid, &state.id_secret) {
        auth::email_from_sid(&state.store, &state.id_secret, &sid).unwrap_or_default()
    } else {
        String::new()
    };
    let catalog = mitch_lib::shop::load_shop_catalog(&state.store, state.data_dir());
    let items = mitch_lib::shop::shop_items_for(&state.store, state.data_dir(), &catalog, &email);
    json_response(
        200,
        json!({
            "items": items,
            "premiumDiscountPct": 0,
            "premiumDiscountNote": "Premium discounts vary by item."
        }),
    )
}

/// `GET /api/me/inventory` — server.js:11347-11356. Note the different 401
/// wording (`not logged in`) versus equip's `unauthorized`.
fn me_inventory(state: &Arc<AppState>, headers: &HeaderMap) -> Response {
    let cookies = cookies_of(state, headers);
    let sid = cookies.auth_sid();
    if !auth::valid_id(&sid, &state.id_secret) {
        return json_response(401, json!({ "error": "not logged in" }));
    }
    let Some(email) = auth::email_from_sid(&state.store, &state.id_secret, &sid) else {
        return json_response(401, json!({ "error": "email not found" }));
    };
    let catalog = mitch_lib::shop::load_shop_catalog(&state.store, state.data_dir());
    let inventory =
        mitch_lib::shop::build_inventory(&state.store, state.data_dir(), &catalog, &email);
    json_response(200, inventory)
}

/// `POST /api/me/cosmetics/equip` — server.js:12281-12324.
fn me_cosmetics_equip(
    state: &Arc<AppState>,
    headers: &HeaderMap,
    body: &Value,
    body_bytes: &[u8],
) -> Response {
    if parse_body_strict(body_bytes).is_none() {
        return json_response(400, json!({ "error": "bad json" }));
    }
    let cookies = cookies_of(state, headers);
    let sid = cookies.auth_sid();
    if !auth::valid_id(&sid, &state.id_secret) {
        return json_response(401, json!({ "error": "unauthorized" }));
    }
    let Some(email) = auth::email_from_sid(&state.store, &state.id_secret, &sid) else {
        return json_response(401, json!({ "error": "email not found" }));
    };
    let norm = auth::normalize_email(&email);

    let item_id = body.get("itemId").cloned().unwrap_or(Value::Null);
    let equip_type = body
        .get("type")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let cosmetics_file = data_file(state, "cosmetics.json");
    let mut cosm = state.store.read_document(&cosmetics_file, json!({}));
    let entry = cosm.get(norm.as_str()).cloned().unwrap_or(json!({}));
    let mut user_cosm = mitch_lib::shop::sanitize_cosmetics_for_email(&state.store, &email, &entry);

    // `String(itemId || '')` — null/undefined/0 collapse to ''.
    let next_item_id = match &item_id {
        Value::Null => String::new(),
        Value::String(s) => s.clone(),
        Value::Bool(false) => String::new(),
        Value::Number(n) if n.as_f64() == Some(0.0) => String::new(),
        other => other.to_string(),
    };
    let catalog = mitch_lib::shop::load_shop_catalog(&state.store, state.data_dir());

    if let Some((bucket, active)) = mitch_lib::shop::shop_type_config(&equip_type) {
        let item = if next_item_id.is_empty() {
            None
        } else {
            mitch_lib::shop::shop_item_by_id(&catalog, &next_item_id)
        };
        if !next_item_id.is_empty() {
            let cost_type_matches = item
                .and_then(|i| i.get("costType"))
                .and_then(|v| v.as_str())
                .map(|ct| ct == equip_type.as_str())
                .unwrap_or(false);
            if !cost_type_matches {
                return json_response(400, json!({ "error": "invalid item" }));
            }
            let admin_only = item
                .and_then(|i| i.get("adminOnly"))
                .and_then(|v| v.as_bool())
                .unwrap_or(false);
            if admin_only && !auth::is_admin_email(&state.store, &email) {
                return json_response(403, json!({ "error": "Admins and owners only." }));
            }
            if !auth::is_admin_email(&state.store, &email)
                && !mitch_lib::shop::cosmetics_bucket_has(&user_cosm, bucket, &next_item_id)
            {
                return json_response(403, json!({ "error": "You do not own this item" }));
            }
        }
        if let Some(obj) = user_cosm.as_object_mut() {
            obj.insert(active.to_string(), json!(next_item_id));
        }
    } else if equip_type == "ai_personality" {
        let item = if next_item_id.is_empty() {
            None
        } else {
            mitch_lib::shop::shop_item_by_id(&catalog, &next_item_id)
        };
        let unlocked = state
            .store
            .read_document(&data_file(state, "unlocked_ai.json"), json!({}));
        let mine: Vec<String> = unlocked
            .get(norm.as_str())
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str())
                    .map(str::to_string)
                    .collect()
            })
            .unwrap_or_default();
        if !next_item_id.is_empty() {
            let cost_type_matches = item
                .and_then(|i| i.get("costType"))
                .and_then(|v| v.as_str())
                .map(|ct| ct == "ai_personality")
                .unwrap_or(false);
            if !cost_type_matches {
                return json_response(400, json!({ "error": "invalid item" }));
            }
            if !auth::is_admin_email(&state.store, &email)
                && !mine.iter().any(|m| m == &next_item_id)
            {
                return json_response(403, json!({ "error": "You do not own this personality" }));
            }
        }
        if let Some(obj) = user_cosm.as_object_mut() {
            obj.insert("activeAi".to_string(), json!(next_item_id));
        }
    } else {
        return json_response(400, json!({ "error": "invalid type" }));
    }

    if let Some(obj) = cosm.as_object_mut() {
        obj.insert(norm.clone(), user_cosm);
    }
    if state.store.write_document(&cosmetics_file, &cosm).is_err() {
        return json_response(400, json!({ "error": "save failed" }));
    }
    json_response(200, json!({ "ok": true }))
}
