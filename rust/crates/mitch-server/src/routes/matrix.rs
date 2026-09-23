//! Matrix Conduit & Mitch.pro SSO Integration, Moderation, and Reverse Proxy.
//!
//! Ports:
//! - server.js:8006-8705 (Conduit call, SSO, room sync, moderation helpers, outbound push)
//! - server.js:9574-10021 (Well-known discovery, VOIP discovery, and /_matrix/* reverse proxy)
//! - server.js:10002-10227 (Cinny config, SSO login/status, notifications read, report room)
//! - server.js:14228-14690 (Matrix moderation API suite: overview, set-role, kick, ban, redact, slowmode, mute-user, unmute-user, mute-room, prune-stale)

#![allow(clippy::expect_used)]

use axum::body::Bytes;
use axum::http::{HeaderMap, HeaderValue, Method, StatusCode};
use axum::response::Response;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::{Arc, Mutex, OnceLock};

use crate::hosts::request_host;
use crate::state::AppState;

pub const OFFICIAL_ROOMS: &[(&str, &str, &str)] = &[
    (
        "general",
        "General",
        "Welcome to Mitch.pro Official Matrix Chat!",
    ),
    (
        "tech",
        "Tech",
        "Technology, software development, coding, and projects",
    ),
    (
        "biking",
        "Biking",
        "Cycling, bikes, trails, maintenance, and gear",
    ),
    (
        "gaming",
        "Gaming",
        "Video games, arcade high scores, speedruns, and tips",
    ),
    (
        "computers",
        "Computers",
        "PC hardware, Linux, VMs, custom builds, and setups",
    ),
    (
        "random",
        "Random",
        "Off-topic discussions, casual chat, and memes",
    ),
];

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MatrixAccount {
    pub uid: String,
    pub norm_email: String,
    pub user_id: String,
}

static TOKEN_TO_ACCOUNT: OnceLock<Mutex<HashMap<String, MatrixAccount>>> = OnceLock::new();
static ROOM_LAST_MESSAGE_TIMES: OnceLock<Mutex<HashMap<String, i64>>> = OnceLock::new();
static OFFICIAL_ROOM_IDS: OnceLock<Mutex<HashMap<String, String>>> = OnceLock::new();
static SYSTEM_ADMIN_TOKEN: OnceLock<Mutex<Option<String>>> = OnceLock::new();

fn token_to_account_map() -> &'static Mutex<HashMap<String, MatrixAccount>> {
    TOKEN_TO_ACCOUNT.get_or_init(|| Mutex::new(HashMap::new()))
}

fn room_last_message_map() -> &'static Mutex<HashMap<String, i64>> {
    ROOM_LAST_MESSAGE_TIMES.get_or_init(|| Mutex::new(HashMap::new()))
}

fn official_room_id_map() -> &'static Mutex<HashMap<String, String>> {
    OFFICIAL_ROOM_IDS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn system_admin_token_cell() -> &'static Mutex<Option<String>> {
    SYSTEM_ADMIN_TOKEN.get_or_init(|| Mutex::new(None))
}

fn now_millis() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn cors_response(status: StatusCode, body: Bytes, content_type: Option<&str>) -> Response {
    let mut builder = Response::builder()
        .status(status)
        .header("Access-Control-Allow-Origin", "*")
        .header(
            "Access-Control-Allow-Methods",
            "GET, POST, PUT, DELETE, OPTIONS",
        )
        .header(
            "Access-Control-Allow-Headers",
            "Origin, X-Requested-With, Content-Type, Accept, Authorization",
        )
        .header("Access-Control-Max-Age", "86400");
    if let Some(ct) = content_type {
        builder = builder.header("Content-Type", ct);
    }
    builder
        .body(axum::body::Body::from(body))
        .unwrap_or_else(|_| {
            Response::builder()
                .status(StatusCode::INTERNAL_SERVER_ERROR)
                .body(axum::body::Body::empty())
                .expect("static empty response")
        })
}

fn cors_json_response(status: u16, val: Value) -> Response {
    let body = serde_json::to_vec(&val).unwrap_or_default();
    cors_response(
        StatusCode::from_u16(status).unwrap_or(StatusCode::OK),
        Bytes::from(body),
        Some("application/json; charset=utf-8"),
    )
}

fn unreachable_regex() -> regex::Regex {
    regex::Regex::new("a^").unwrap_or_else(|_| match regex::Regex::new("") {
        Ok(r) => r,
        Err(_) => unreachable!(),
    })
}

pub fn get_matrix_password_for_uid(uid: &str, secret: &[u8]) -> String {
    mitch_lib::crypto::hmac_sha256_hex(secret, format!("matrix-account:{uid}").as_bytes())
}

pub fn sanitize_matrix_device_id(value: &str) -> String {
    let trimmed = value.trim();
    static DEVICE_RE: OnceLock<regex::Regex> = OnceLock::new();
    let re = DEVICE_RE.get_or_init(|| {
        regex::Regex::new(r"^[A-Za-z0-9._~-]{1,255}$").unwrap_or_else(|_| unreachable_regex())
    });
    if re.is_match(trimmed) {
        trimmed.to_string()
    } else {
        String::new()
    }
}

pub fn get_matrix_power_level_for_sid(state: &AppState, sid: &str) -> i64 {
    if sid.is_empty() {
        return 0;
    }
    if let Some(email) = mitch_lib::auth::email_from_sid(&state.store, &state.id_secret, sid) {
        if mitch_lib::auth::is_owner_email(&state.store, &email) {
            return 100;
        }
        if mitch_lib::auth::is_admin_id(&state.store, &state.id_secret, sid, false) {
            return 100;
        }
        if mitch_lib::auth::is_moderator_email(&state.store, &email) {
            return 50;
        }
    }
    0
}

fn conduit_candidate_hosts() -> Vec<String> {
    let conduit_host = std::env::var("CONDUIT_HOST").unwrap_or_else(|_| {
        if std::env::var("DOCKER_ENV").unwrap_or_default() == "1"
            || std::path::Path::new("/.dockerenv").exists()
        {
            "conduit".to_string()
        } else {
            "127.0.0.1".to_string()
        }
    });

    let mut hosts = vec![conduit_host.clone()];
    if conduit_host == "127.0.0.1" {
        hosts.push("conduit".to_string());
    } else {
        hosts.push("127.0.0.1".to_string());
    }
    hosts.push("mitch-matrix-conduit".to_string());
    hosts.dedup();
    hosts
}

fn conduit_port() -> String {
    std::env::var("CONDUIT_PORT").unwrap_or_else(|_| "6167".to_string())
}

pub async fn call_conduit(
    subpath: &str,
    method: Method,
    headers: Option<HeaderMap>,
    body: Option<Bytes>,
) -> Result<(StatusCode, HeaderMap, Bytes), String> {
    let port = conduit_port();
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let req_method = match method {
        Method::POST => reqwest::Method::POST,
        Method::PUT => reqwest::Method::PUT,
        Method::DELETE => reqwest::Method::DELETE,
        _ => reqwest::Method::GET,
    };

    let mut last_err = String::from("No candidate hosts reachable");
    for host in conduit_candidate_hosts() {
        let url = format!("http://{host}:{port}{subpath}");
        let mut rb = client.request(req_method.clone(), &url);
        rb = rb.header("Host", "mitch.pro");

        if let Some(ref h) = headers {
            for (k, v) in h.iter() {
                let name = k.as_str().to_lowercase();
                if name != "host" && name != "content-length" {
                    rb = rb.header(k.as_str(), v.as_bytes());
                }
            }
        }

        if let Some(ref b) = body {
            rb = rb.body(b.clone());
        }

        match rb.send().await {
            Ok(resp) => {
                let status =
                    StatusCode::from_u16(resp.status().as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);
                let mut out_headers = HeaderMap::new();
                for (k, v) in resp.headers().iter() {
                    if let (Ok(name), Ok(val)) = (
                        axum::http::HeaderName::from_bytes(k.as_str().as_bytes()),
                        HeaderValue::from_bytes(v.as_bytes()),
                    ) {
                        out_headers.insert(name, val);
                    }
                }
                let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
                return Ok((status, out_headers, bytes));
            }
            Err(e) => {
                last_err = e.to_string();
            }
        }
    }

    Err(last_err)
}

pub async fn get_system_admin_matrix_token(secret: &[u8]) -> Result<String, String> {
    {
        let cell = system_admin_token_cell()
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        if let Some(ref tok) = *cell {
            return Ok(tok.clone());
        }
    }

    let admin_username = "mitch_admin";
    let admin_password = mitch_lib::crypto::hmac_sha256_hex(secret, b"matrix-sysadmin-2026");

    let login_payload = json!({
        "type": "m.login.password",
        "identifier": { "type": "m.id.user", "user": admin_username },
        "password": admin_password,
        "initial_device_display_name": "Mitch.pro System Admin"
    });

    let mut headers = HeaderMap::new();
    headers.insert("Content-Type", HeaderValue::from_static("application/json"));

    let res = call_conduit(
        "/_matrix/client/v3/login",
        Method::POST,
        Some(headers.clone()),
        Some(Bytes::from(
            serde_json::to_vec(&login_payload).unwrap_or_default(),
        )),
    )
    .await;

    let token = match res {
        Ok((status, _, bytes)) if status.is_success() => {
            let data: Value = serde_json::from_slice(&bytes).unwrap_or(json!({}));
            data.get("access_token")
                .and_then(|v| v.as_str())
                .map(str::to_string)
        }
        _ => None,
    };

    if let Some(t) = token {
        let mut cell = system_admin_token_cell()
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        *cell = Some(t.clone());
        return Ok(t);
    }

    // Attempt to register system admin if login failed
    let reg_payload = json!({
        "username": admin_username,
        "password": admin_password,
        "auth": { "type": "m.login.dummy" }
    });
    let reg_res = call_conduit(
        "/_matrix/client/v3/register",
        Method::POST,
        Some(headers),
        Some(Bytes::from(
            serde_json::to_vec(&reg_payload).unwrap_or_default(),
        )),
    )
    .await?;

    if reg_res.0.is_success() {
        let data: Value = serde_json::from_slice(&reg_res.2).unwrap_or(json!({}));
        if let Some(t) = data.get("access_token").and_then(|v| v.as_str()) {
            let mut cell = system_admin_token_cell()
                .lock()
                .unwrap_or_else(|e| e.into_inner());
            *cell = Some(t.to_string());
            return Ok(t.to_string());
        }
    }

    Err("Failed to acquire system admin Matrix token".to_string())
}

pub async fn ensure_official_room(
    secret: &[u8],
    alias: &str,
    name: &str,
    topic: &str,
) -> Result<String, String> {
    {
        let cache = official_room_id_map()
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        if let Some(id) = cache.get(alias) {
            return Ok(id.clone());
        }
    }

    let full_alias = format!("#{alias}:mitch.pro");

    // 1. Check directory
    if let Ok((status, _, bytes)) = call_conduit(
        &format!(
            "/_matrix/client/v3/directory/room/{}",
            url::form_urlencoded::byte_serialize(full_alias.as_bytes()).collect::<String>()
        ),
        Method::GET,
        None,
        None,
    )
    .await
    {
        if status.is_success() {
            let data: Value = serde_json::from_slice(&bytes).unwrap_or(json!({}));
            if let Some(room_id) = data.get("room_id").and_then(|v| v.as_str()) {
                let mut cache = official_room_id_map()
                    .lock()
                    .unwrap_or_else(|e| e.into_inner());
                cache.insert(alias.to_string(), room_id.to_string());
                return Ok(room_id.to_string());
            }
        }
    }

    // 2. Create room
    let admin_tok = get_system_admin_matrix_token(secret).await?;
    let mut headers = HeaderMap::new();
    headers.insert("Content-Type", HeaderValue::from_static("application/json"));
    if let Ok(hv) = HeaderValue::from_str(&format!("Bearer {admin_tok}")) {
        headers.insert("Authorization", hv);
    }

    let create_payload = json!({
        "room_version": "10",
        "name": name,
        "topic": topic,
        "room_alias_name": alias,
        "visibility": "public",
        "preset": "public_chat",
        "initial_state": [
            {
                "type": "m.room.history_visibility",
                "state_key": "",
                "content": { "history_visibility": "world_readable" }
            },
            {
                "type": "m.room.guest_access",
                "state_key": "",
                "content": { "guest_access": "can_join" }
            }
        ]
    });

    if let Ok((status, _, bytes)) = call_conduit(
        "/_matrix/client/v3/createRoom",
        Method::POST,
        Some(headers),
        Some(Bytes::from(
            serde_json::to_vec(&create_payload).unwrap_or_default(),
        )),
    )
    .await
    {
        if status.is_success() {
            let data: Value = serde_json::from_slice(&bytes).unwrap_or(json!({}));
            if let Some(room_id) = data.get("room_id").and_then(|v| v.as_str()) {
                let mut cache = official_room_id_map()
                    .lock()
                    .unwrap_or_else(|e| e.into_inner());
                cache.insert(alias.to_string(), room_id.to_string());
                return Ok(room_id.to_string());
            }
        }
    }

    // 3. Fallback directory query
    if let Ok((status, _, bytes)) = call_conduit(
        &format!(
            "/_matrix/client/v3/directory/room/{}",
            url::form_urlencoded::byte_serialize(full_alias.as_bytes()).collect::<String>()
        ),
        Method::GET,
        None,
        None,
    )
    .await
    {
        if status.is_success() {
            let data: Value = serde_json::from_slice(&bytes).unwrap_or(json!({}));
            if let Some(room_id) = data.get("room_id").and_then(|v| v.as_str()) {
                let mut cache = official_room_id_map()
                    .lock()
                    .unwrap_or_else(|e| e.into_inner());
                cache.insert(alias.to_string(), room_id.to_string());
                return Ok(room_id.to_string());
            }
        }
    }

    Err(format!("Could not ensure official room {alias}"))
}

pub async fn ensure_official_general_room(secret: &[u8]) -> Result<String, String> {
    ensure_official_room(
        secret,
        "general",
        "General",
        "Welcome to Mitch.pro Official Matrix Chat!",
    )
    .await
}

pub fn check_matrix_slowmode(room_id: &str, sender_key: &str, slowmode_seconds: i64) -> i64 {
    if slowmode_seconds <= 0 {
        return 0;
    }
    let key = format!("{room_id}:{sender_key}");
    let map = room_last_message_map()
        .lock()
        .unwrap_or_else(|e| e.into_inner());
    let last = map.get(&key).copied().unwrap_or(0);
    let elapsed = (now_millis() - last) / 1000;
    if elapsed < slowmode_seconds {
        std::cmp::max(1, slowmode_seconds - elapsed)
    } else {
        0
    }
}

pub fn record_matrix_message_sent(room_id: &str, sender_key: &str) {
    if room_id.is_empty() || sender_key.is_empty() {
        return;
    }
    let key = format!("{room_id}:{sender_key}");
    let mut map = room_last_message_map()
        .lock()
        .unwrap_or_else(|e| e.into_inner());
    map.insert(key, now_millis());
    if map.len() > 20000 {
        if let Some(oldest) = map.keys().next().cloned() {
            map.remove(&oldest);
        }
    }
}

pub fn load_matrix_room_settings(state: &AppState, room_id: &str) -> Value {
    let settings_file = state.data_dir().join("matrix_room_settings.json");
    let all = state.store.read_document(&settings_file, json!({}));
    all.get(room_id).cloned().unwrap_or_else(|| {
        json!({
            "slowmodeSeconds": 0,
            "roomMuted": false,
            "mutedUsers": {}
        })
    })
}

pub fn is_user_muted_in_matrix_room(
    state: &AppState,
    room_id: &str,
    user_identifiers: &[String],
) -> Option<Value> {
    let settings_file = state.data_dir().join("matrix_room_settings.json");
    let mut all = state.store.read_document(&settings_file, json!({}));
    let room = all.get(room_id).cloned().unwrap_or(json!({}));
    let muted_users = room.get("mutedUsers").and_then(|v| v.as_object())?;

    let now = now_millis();
    let mut changed = false;

    for raw_id in user_identifiers {
        if raw_id.is_empty() {
            continue;
        }
        let lower = raw_id.to_lowercase().trim().to_string();
        let clean_user = if lower.starts_with('@') {
            lower.clone()
        } else {
            format!("@{lower}:mitch.pro")
        };

        let hit = muted_users
            .get(&clean_user)
            .or_else(|| muted_users.get(&lower));
        if let Some(entry) = hit {
            if let Some(exp) = entry.get("expiresAt").and_then(|v| v.as_i64()) {
                if exp <= now {
                    if let Some(map) = all
                        .get_mut(room_id)
                        .and_then(|r| r.get_mut("mutedUsers"))
                        .and_then(|m| m.as_object_mut())
                    {
                        map.remove(&clean_user);
                        map.remove(&lower);
                        changed = true;
                    }
                    continue;
                }
            }
            if changed {
                let _ = state.store.write_document(&settings_file, &all);
            }
            return Some(entry.clone());
        }
    }

    if changed {
        let _ = state.store.write_document(&settings_file, &all);
    }
    None
}

pub fn is_matrix_staff_member(
    state: &AppState,
    headers: &HeaderMap,
    account: Option<&MatrixAccount>,
) -> bool {
    let cookies = crate::routes::me::cookies_of(state, headers);
    let sid = cookies
        .get("studentId")
        .filter(|s| !s.is_empty())
        .or_else(|| cookies.get("id"))
        .unwrap_or("");
    if !sid.is_empty()
        && mitch_lib::auth::is_any_admin_id(&state.store, &state.id_secret, sid, false)
    {
        return true;
    }
    if let Some(acc) = account {
        if !acc.uid.is_empty()
            && mitch_lib::auth::is_any_admin_id(&state.store, &state.id_secret, &acc.uid, false)
        {
            return true;
        }
        if !acc.norm_email.is_empty()
            && (mitch_lib::auth::is_admin_email(&state.store, &acc.norm_email)
                || mitch_lib::auth::is_moderator_email(&state.store, &acc.norm_email))
        {
            return true;
        }
    }
    false
}

pub async fn resolve_matrix_account(
    state: &AppState,
    headers: &HeaderMap,
    parsed_body: Option<&Value>,
) -> Option<MatrixAccount> {
    let mut user_candidates = Vec::new();
    if let Some(body) = parsed_body {
        if let Some(auth) = body.get("auth") {
            if let Some(id) = auth.get("identifier") {
                if let Some(u) = id.get("user").and_then(|v| v.as_str()) {
                    user_candidates.push(u.to_string());
                }
                if let Some(a) = id.get("address").and_then(|v| v.as_str()) {
                    user_candidates.push(a.to_string());
                }
            }
            if let Some(u) = auth.get("user").and_then(|v| v.as_str()) {
                user_candidates.push(u.to_string());
            }
        }
        if let Some(id) = body.get("identifier") {
            if let Some(u) = id.get("user").and_then(|v| v.as_str()) {
                user_candidates.push(u.to_string());
            }
            if let Some(a) = id.get("address").and_then(|v| v.as_str()) {
                user_candidates.push(a.to_string());
            }
        }
        if let Some(u) = body.get("user").and_then(|v| v.as_str()) {
            user_candidates.push(u.to_string());
        }
    }

    let matrix_users_file = state.data_dir().join("matrix_users.json");
    let matrix_users = state.store.read_document(&matrix_users_file, json!({}));

    for cand in user_candidates {
        let raw = cand.trim();
        if raw.is_empty() {
            continue;
        }
        let local_part = if raw.starts_with('@') {
            raw.trim_start_matches('@').split(':').next().unwrap_or(raw)
        } else {
            raw
        };

        if let Some(norm) = crate::routes::auth::resolve_login_identifier(state, local_part)
            .or_else(|| crate::routes::auth::resolve_login_identifier(state, raw))
        {
            if let Some(uid) =
                mitch_lib::profile::get_uid_for_email(&state.store, &state.id_secret, &norm)
            {
                let assigned = matrix_users.get(&uid).and_then(|v| v.as_str());
                let user_id = match assigned {
                    Some(a) => format!("@{a}:mitch.pro"),
                    None => format!("@{local_part}:mitch.pro"),
                };
                return Some(MatrixAccount {
                    uid,
                    norm_email: norm,
                    user_id,
                });
            }
        }

        if let Some(obj) = matrix_users.as_object() {
            for (u, name) in obj.iter() {
                let name_str = name.as_str().unwrap_or("");
                if name_str.eq_ignore_ascii_case(local_part)
                    || format!("@{name_str}:mitch.pro").eq_ignore_ascii_case(raw)
                {
                    if let Some(email) =
                        mitch_lib::auth::email_from_sid(&state.store, &state.id_secret, u)
                    {
                        return Some(MatrixAccount {
                            uid: u.clone(),
                            norm_email: mitch_lib::auth::normalize_email(&email),
                            user_id: format!("@{name_str}:mitch.pro"),
                        });
                    }
                }
            }
        }
    }

    // Check Authorization: Bearer <token>
    if let Some(auth_hdr) = headers.get("authorization").and_then(|v| v.to_str().ok()) {
        if auth_hdr.to_ascii_lowercase().starts_with("bearer ") {
            let tok = auth_hdr[7..].trim();
            let cached = {
                let map = token_to_account_map()
                    .lock()
                    .unwrap_or_else(|e| e.into_inner());
                map.get(tok).cloned()
            };
            if let Some(acc) = cached {
                return Some(acc);
            }

            let mut who_headers = HeaderMap::new();
            if let Ok(hv) = HeaderValue::from_str(&format!("Bearer {tok}")) {
                who_headers.insert("Authorization", hv);
            }
            if let Ok((status, _, bytes)) = call_conduit(
                "/_matrix/client/v3/account/whoami",
                Method::GET,
                Some(who_headers),
                None,
            )
            .await
            {
                if status.is_success() {
                    let who_data: Value = serde_json::from_slice(&bytes).unwrap_or(json!({}));
                    if let Some(matrix_user_id) = who_data.get("user_id").and_then(|v| v.as_str()) {
                        let uname = matrix_user_id
                            .trim_start_matches('@')
                            .split(':')
                            .next()
                            .unwrap_or("");
                        let mut matched_uid = String::new();
                        if let Some(obj) = matrix_users.as_object() {
                            for (u, name) in obj.iter() {
                                let name_str = name.as_str().unwrap_or("");
                                if name_str.eq_ignore_ascii_case(uname)
                                    || format!("@{name_str}:mitch.pro")
                                        .eq_ignore_ascii_case(matrix_user_id)
                                {
                                    matched_uid = u.clone();
                                    break;
                                }
                            }
                        }
                        let mut norm = String::new();
                        if !matched_uid.is_empty() {
                            if let Some(em) = mitch_lib::auth::email_from_sid(
                                &state.store,
                                &state.id_secret,
                                &matched_uid,
                            ) {
                                norm = mitch_lib::auth::normalize_email(&em);
                            }
                        }
                        if norm.is_empty() && !uname.is_empty() {
                            if let Some(res) =
                                crate::routes::auth::resolve_login_identifier(state, uname)
                            {
                                norm = res;
                                if matched_uid.is_empty() {
                                    if let Some(u) = mitch_lib::profile::get_uid_for_email(
                                        &state.store,
                                        &state.id_secret,
                                        &norm,
                                    ) {
                                        matched_uid = u;
                                    }
                                }
                            }
                        }
                        let account = MatrixAccount {
                            uid: matched_uid,
                            norm_email: norm,
                            user_id: matrix_user_id.to_string(),
                        };
                        let mut map = token_to_account_map()
                            .lock()
                            .unwrap_or_else(|e| e.into_inner());
                        map.insert(tok.to_string(), account.clone());
                        if map.len() > 5000 {
                            if let Some(first) = map.keys().next().cloned() {
                                map.remove(&first);
                            }
                        }
                        return Some(account);
                    }
                }
            }
        }
    }

    // Session cookie
    let cookies = crate::routes::me::cookies_of(state, headers);
    let sid = cookies
        .get("studentId")
        .filter(|s| !s.is_empty())
        .or_else(|| cookies.get("id"))
        .unwrap_or("");
    if !sid.is_empty() && mitch_lib::auth::valid_id(sid, &state.id_secret) {
        if let Some(em) = mitch_lib::auth::email_from_sid(&state.store, &state.id_secret, sid) {
            let assigned = matrix_users.get(sid).and_then(|v| v.as_str());
            return Some(MatrixAccount {
                uid: sid.to_string(),
                norm_email: mitch_lib::auth::normalize_email(&em),
                user_id: assigned
                    .map(|a| format!("@{a}:mitch.pro"))
                    .unwrap_or_default(),
            });
        }
    }

    None
}

/// Dynamic Cinny configuration for Mitch.pro.
pub fn handle_cinny_config() -> Response {
    cors_json_response(
        200,
        json!({
            "defaultHomeserver": 0,
            "homeserverList": ["mitchdog.com"],
            "allowCustomHomeservers": false,
            "featuredCommunities": {
                "openAsDefault": true,
                "servers": ["mitch.pro"],
                "rooms": ["#general:mitch.pro"],
                "spaces": []
            },
            "hashRouter": {
                "enabled": false,
                "basename": "/matrix"
            }
        }),
    )
}

/// Matrix discovery endpoints (`/.well-known/matrix/client` and `server`).
pub fn handle_well_known(method: &Method, path: &str, headers: &HeaderMap) -> Option<Response> {
    if method == Method::OPTIONS {
        return Some(cors_response(StatusCode::NO_CONTENT, Bytes::new(), None));
    }
    if path == "/.well-known/matrix/client" && method == Method::GET {
        let host = request_host(headers);
        let proto = if host.starts_with("localhost") || host.starts_with("127.0.0.1") {
            "http://"
        } else {
            "https://"
        };
        return Some(cors_json_response(
            200,
            json!({
                "m.homeserver": {
                    "base_url": format!("{proto}{host}")
                },
                "org.matrix.msc4143.rtc_foci": [
                    {
                        "type": "livekit",
                        "livekit_service_url": format!("{proto}{host}/livekit")
                    }
                ]
            }),
        ));
    }
    if path == "/.well-known/matrix/server" && method == Method::GET {
        let mut resp = cors_json_response(200, json!({ "m.server": "mitch.pro:443" }));
        resp.headers_mut().insert(
            "Cache-Control",
            HeaderValue::from_static("public, max-age=300"),
        );
        return Some(resp);
    }
    None
}

/// Matrix API handler (`/api/matrix/*`).
pub async fn handle_api(
    state: &Arc<AppState>,
    method: &Method,
    path: &str,
    headers: &HeaderMap,
    search: &str,
    body_bytes: &[u8],
) -> Option<Response> {
    if method == Method::OPTIONS {
        return Some(cors_response(StatusCode::NO_CONTENT, Bytes::new(), None));
    }

    if path == "/api/matrix/sso-status" && method == Method::GET {
        return Some(api_sso_status(state, headers));
    }
    if path == "/api/matrix/sso-login" && method == Method::POST {
        return Some(api_sso_login(state, headers, body_bytes).await);
    }
    if path == "/api/matrix/notifications/read" && method == Method::POST {
        return Some(api_notifications_read(state, headers, body_bytes));
    }
    if path == "/api/matrix/report-room" && method == Method::POST {
        return Some(api_report_room(state, headers, body_bytes));
    }

    // Moderation endpoints
    if path == "/api/matrix/moderation/overview" && method == Method::GET {
        return Some(mod_overview(state, headers).await);
    }
    if path == "/api/matrix/moderation/set-role" && method == Method::POST {
        return Some(mod_set_role(state, headers, body_bytes).await);
    }
    if path == "/api/matrix/moderation/kick" && method == Method::POST {
        return Some(mod_kick(state, headers, body_bytes).await);
    }
    if path == "/api/matrix/moderation/ban" && method == Method::POST {
        return Some(mod_ban(state, headers, body_bytes).await);
    }
    if path == "/api/matrix/moderation/redact" && method == Method::POST {
        return Some(mod_redact(state, headers, body_bytes).await);
    }
    if path == "/api/matrix/moderation/slowmode" && method == Method::POST {
        return Some(mod_slowmode(state, headers, body_bytes).await);
    }
    if path == "/api/matrix/moderation/mute-user" && method == Method::POST {
        return Some(mod_mute_user(state, headers, body_bytes).await);
    }
    if path == "/api/matrix/moderation/unmute-user" && method == Method::POST {
        return Some(mod_unmute_user(state, headers, body_bytes).await);
    }
    if path == "/api/matrix/moderation/mute-room" && method == Method::POST {
        return Some(mod_mute_room(state, headers, body_bytes).await);
    }
    if path == "/api/matrix/devices/prune-stale" && method == Method::POST {
        return Some(mod_prune_stale(state, headers, body_bytes).await);
    }

    let _ = search;
    None
}

fn api_sso_status(state: &AppState, headers: &HeaderMap) -> Response {
    let cookies = crate::routes::me::cookies_of(state, headers);
    let uid = cookies
        .get("studentId")
        .filter(|s| !s.is_empty())
        .or_else(|| cookies.get("id"))
        .unwrap_or("");
    if uid.is_empty()
        || !mitch_lib::auth::valid_id(uid, &state.id_secret)
        || mitch_lib::auth::banned_info_for_sid(&state.store, &state.id_secret, uid).is_some()
    {
        return cors_json_response(200, json!({ "authenticated": false }));
    }

    let email =
        mitch_lib::auth::email_from_sid(&state.store, &state.id_secret, uid).unwrap_or_default();
    let norm = mitch_lib::auth::normalize_email(&email);
    let profiles_file = state.data_dir().join("profiles.json");
    let profiles = state.store.read_document(&profiles_file, json!({}));
    let prof = profiles.get(&norm).cloned().unwrap_or(json!({}));
    let username = prof
        .get("username")
        .and_then(|v| v.as_str())
        .unwrap_or_else(|| {
            if !email.is_empty() {
                email.split('@').next().unwrap_or("user")
            } else {
                "user"
            }
        });

    let matrix_users_file = state.data_dir().join("matrix_users.json");
    let matrix_users = state.store.read_document(&matrix_users_file, json!({}));
    let assigned_username = matrix_users
        .get(uid)
        .and_then(|v| v.as_str())
        .unwrap_or(username);
    let display_name = prof
        .get("displayName")
        .or_else(|| prof.get("nickname"))
        .and_then(|v| v.as_str())
        .unwrap_or(username);

    cors_json_response(
        200,
        json!({
            "authenticated": true,
            "username": username,
            "user_id": format!("@{assigned_username}:mitch.pro"),
            "displayName": display_name
        }),
    )
}

async fn api_sso_login(state: &AppState, headers: &HeaderMap, body_bytes: &[u8]) -> Response {
    let cookies = crate::routes::me::cookies_of(state, headers);
    let uid = cookies
        .get("studentId")
        .filter(|s| !s.is_empty())
        .or_else(|| cookies.get("id"))
        .unwrap_or("");
    if uid.is_empty() || !mitch_lib::auth::valid_id(uid, &state.id_secret) {
        return cors_json_response(
            401,
            json!({ "ok": false, "error": "Not authenticated on Mitch.pro" }),
        );
    }
    if mitch_lib::auth::banned_info_for_sid(&state.store, &state.id_secret, uid).is_some() {
        return cors_json_response(
            403,
            json!({ "ok": false, "error": "Account is banned", "banned": true }),
        );
    }

    let email =
        mitch_lib::auth::email_from_sid(&state.store, &state.id_secret, uid).unwrap_or_default();
    let norm = mitch_lib::auth::normalize_email(&email);
    let profiles_file = state.data_dir().join("profiles.json");
    let profiles = state.store.read_document(&profiles_file, json!({}));
    let prof = profiles.get(&norm).cloned().unwrap_or(json!({}));
    let username = prof
        .get("username")
        .and_then(|v| v.as_str())
        .unwrap_or_else(|| {
            if !email.is_empty() {
                email.split('@').next().unwrap_or("user")
            } else {
                "user"
            }
        });
    let display_name = prof
        .get("displayName")
        .or_else(|| prof.get("nickname"))
        .and_then(|v| v.as_str())
        .unwrap_or(username);

    let body_json: Value = serde_json::from_slice(body_bytes).unwrap_or(json!({}));
    let requested_device_id = sanitize_matrix_device_id(
        body_json
            .get("device_id")
            .and_then(|v| v.as_str())
            .unwrap_or(""),
    );

    let matrix_users_file = state.data_dir().join("matrix_users.json");
    let mut matrix_users = state.store.read_document(&matrix_users_file, json!({}));
    let assigned_user = matrix_users
        .get(uid)
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .unwrap_or_else(|| {
            let u = mitch_lib::profile::normalize_username(username);
            if u.len() < 2 {
                format!("user_{}", &uid[..std::cmp::min(6, uid.len())])
            } else {
                u
            }
        });

    let password = get_matrix_password_for_uid(uid, &state.id_secret);

    // 1. Login attempt
    let mut login_payload = json!({
        "type": "m.login.password",
        "identifier": { "type": "m.id.user", "user": assigned_user },
        "password": password,
        "initial_device_display_name": "Mitch.pro Web"
    });
    if !requested_device_id.is_empty() {
        login_payload["device_id"] = json!(requested_device_id);
    }

    let mut req_headers = HeaderMap::new();
    req_headers.insert("Content-Type", HeaderValue::from_static("application/json"));

    let login_res = call_conduit(
        "/_matrix/client/v3/login",
        Method::POST,
        Some(req_headers.clone()),
        Some(Bytes::from(
            serde_json::to_vec(&login_payload).unwrap_or_default(),
        )),
    )
    .await;

    let mut auth_result: Option<Value> = match login_res {
        Ok((status, _, bytes)) if status.is_success() => serde_json::from_slice(&bytes).ok(),
        _ => None,
    };

    let mut final_user = assigned_user.clone();

    // 2. Register attempt if login fails
    if auth_result.is_none() {
        let mut candidate_name = assigned_user.clone();
        for attempt in 0..5 {
            let mut reg_payload = json!({
                "username": candidate_name,
                "password": password,
                "auth": { "type": "m.login.dummy" }
            });
            if !requested_device_id.is_empty() {
                reg_payload["device_id"] = json!(requested_device_id);
            }
            let reg_res = call_conduit(
                "/_matrix/client/v3/register",
                Method::POST,
                Some(req_headers.clone()),
                Some(Bytes::from(
                    serde_json::to_vec(&reg_payload).unwrap_or_default(),
                )),
            )
            .await;

            if let Ok((status, _, bytes)) = reg_res {
                let data: Value = serde_json::from_slice(&bytes).unwrap_or(json!({}));
                if status.is_success() && data.get("access_token").is_some() {
                    auth_result = Some(data);
                    final_user = candidate_name;
                    break;
                } else if data.get("errcode").and_then(|v| v.as_str()) == Some("M_USER_IN_USE") {
                    candidate_name = format!("{assigned_user}-{}", attempt + 2);
                } else {
                    break;
                }
            }
        }
    }

    let Some(auth_data) = auth_result else {
        return cors_json_response(
            500,
            json!({ "ok": false, "error": "Matrix SSO authentication failed" }),
        );
    };

    if matrix_users.get(uid).and_then(|v| v.as_str()) != Some(&final_user) {
        if let Some(map) = matrix_users.as_object_mut() {
            map.insert(uid.to_string(), json!(final_user));
            let _ = state
                .store
                .write_document(&matrix_users_file, &matrix_users);
        }
    }

    let user_id = auth_data
        .get("user_id")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let access_token = auth_data
        .get("access_token")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let device_id = auth_data
        .get("device_id")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    if !access_token.is_empty() {
        let mut map = token_to_account_map()
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        map.insert(
            access_token.to_string(),
            MatrixAccount {
                uid: uid.to_string(),
                norm_email: norm.clone(),
                user_id: user_id.to_string(),
            },
        );
    }

    let target_power_level = get_matrix_power_level_for_sid(state, uid);
    let role = if target_power_level >= 100 {
        "admin"
    } else if target_power_level >= 50 {
        "moderator"
    } else {
        "member"
    };

    cors_json_response(
        200,
        json!({
            "ok": true,
            "user_id": user_id,
            "access_token": access_token,
            "device_id": device_id,
            "home_server": "mitch.pro",
            "base_url": "https://mitchdog.com",
            "username": final_user,
            "displayName": display_name,
            "role": role,
            "powerLevel": target_power_level,
            "officialRoom": "#general:mitch.pro",
            "officialRooms": OFFICIAL_ROOMS.iter().map(|(alias, _, _)| format!("#{alias}:mitch.pro")).collect::<Vec<_>>()
        }),
    )
}

fn api_notifications_read(state: &AppState, headers: &HeaderMap, body_bytes: &[u8]) -> Response {
    let cookies = crate::routes::me::cookies_of(state, headers);
    let sid = cookies
        .get("studentId")
        .filter(|s| !s.is_empty())
        .or_else(|| cookies.get("id"))
        .unwrap_or("");
    let mut norm = String::new();
    if !sid.is_empty() && mitch_lib::auth::valid_id(sid, &state.id_secret) {
        if let Some(em) = mitch_lib::auth::email_from_sid(&state.store, &state.id_secret, sid) {
            norm = mitch_lib::auth::normalize_email(&em);
        }
    }
    if norm.is_empty() {
        if let Some(auth_hdr) = headers.get("authorization").and_then(|v| v.to_str().ok()) {
            let tok = auth_hdr.trim_start_matches("Bearer ").trim();
            let map = token_to_account_map()
                .lock()
                .unwrap_or_else(|e| e.into_inner());
            if let Some(acc) = map.get(tok) {
                norm = acc.norm_email.clone();
            }
        }
    }
    if norm.is_empty() {
        return cors_json_response(401, json!({ "error": "unauthorized" }));
    }

    let body_json: Value = serde_json::from_slice(body_bytes).unwrap_or(json!({}));
    let room_id = body_json
        .get("roomId")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    let notif_file = state.data_dir().join("matrix_notifications.json");
    let mut all = state.store.read_document(&notif_file, json!({}));
    let mut changed = false;

    if let Some(list) = all.get_mut(&norm).and_then(|v| v.as_array_mut()) {
        for n in list.iter_mut() {
            let n_room = n.get("roomId").and_then(|v| v.as_str()).unwrap_or("");
            if (room_id.is_empty() || n_room == room_id) && n.get("read") != Some(&json!(true)) {
                changed = true;
                n["read"] = json!(true);
            }
        }
    }

    if changed {
        let _ = state.store.write_document(&notif_file, &all);
        crate::ws::trigger_notification_refresh(state);
    }

    cors_json_response(200, json!({ "ok": true }))
}

fn api_report_room(state: &AppState, headers: &HeaderMap, body_bytes: &[u8]) -> Response {
    let body_json: Value = serde_json::from_slice(body_bytes).unwrap_or(json!({}));
    let room_id = body_json
        .get("roomId")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim();
    if room_id.is_empty() {
        return cors_json_response(400, json!({ "error": "Room ID required" }));
    }

    let reason = body_json
        .get("reason")
        .and_then(|v| v.as_str())
        .unwrap_or("Reported chat without entering");
    let room_name = body_json
        .get("roomName")
        .and_then(|v| v.as_str())
        .unwrap_or(room_id);

    let cookies = crate::routes::me::cookies_of(state, headers);
    let sid = cookies
        .get("studentId")
        .filter(|s| !s.is_empty())
        .or_else(|| cookies.get("id"))
        .unwrap_or("");
    let mut reporter = if !sid.is_empty() {
        mitch_lib::auth::email_from_sid(&state.store, &state.id_secret, sid)
            .unwrap_or_else(|| sid.to_string())
    } else {
        String::new()
    };

    if reporter.is_empty() {
        if let Some(auth_hdr) = headers.get("authorization").and_then(|v| v.to_str().ok()) {
            let tok = auth_hdr.trim_start_matches("Bearer ").trim();
            let map = token_to_account_map()
                .lock()
                .unwrap_or_else(|e| e.into_inner());
            if let Some(acc) = map.get(tok) {
                reporter = acc.norm_email.clone();
            }
        }
    }
    if reporter.is_empty() {
        reporter = body_json
            .get("reporter")
            .and_then(|v| v.as_str())
            .unwrap_or("matrix-user")
            .to_string();
    }

    let clean_id = format!("room-{}-{}", now_millis(), rand::random::<u16>());
    let report_entry = json!({
        "id": clean_id,
        "reason": format!("[Matrix Room {room_name} ({room_id})] {reason}"),
        "reportedBy": reporter,
        "ts": now_millis(),
        "status": "Needs review",
        "matrixRoomId": room_id,
        "matrixRoomName": room_name,
        "reportedWithoutEntering": true,
        "context": [
            {
                "from": "system",
                "to": room_id,
                "text": format!("Chat reported without opening: {reason} (Room: {room_name})"),
                "ts": now_millis(),
                "reported": true
            }
        ]
    });

    let reports_file = state.data_dir().join("chat_reports.json");
    let mut reports = state.store.read_document(&reports_file, json!([]));
    if let Some(arr) = reports.as_array_mut() {
        arr.push(report_entry);
        if arr.len() > 5000 {
            let excess = arr.len() - 5000;
            arr.drain(0..excess);
        }
        let _ = state.store.write_document(&reports_file, &reports);
    }

    cors_json_response(
        200,
        json!({ "success": true, "message": "Chat reported successfully" }),
    )
}

// ── Moderation endpoints ──

async fn mod_overview(state: &AppState, headers: &HeaderMap) -> Response {
    let cookies = crate::routes::me::cookies_of(state, headers);
    let sid = cookies
        .get("studentId")
        .filter(|s| !s.is_empty())
        .or_else(|| cookies.get("id"))
        .unwrap_or("");
    if !mitch_lib::auth::is_any_admin_id(&state.store, &state.id_secret, sid, false) {
        return cors_json_response(403, json!({ "error": "forbidden" }));
    }

    let room_id = match ensure_official_general_room(&state.id_secret).await {
        Ok(id) => id,
        Err(e) => return cors_json_response(500, json!({ "ok": false, "error": e })),
    };

    let admin_tok = match get_system_admin_matrix_token(&state.id_secret).await {
        Ok(t) => t,
        Err(e) => return cors_json_response(500, json!({ "ok": false, "error": e })),
    };

    let mut req_headers = HeaderMap::new();
    if let Ok(hv) = HeaderValue::from_str(&format!("Bearer {admin_tok}")) {
        req_headers.insert("Authorization", hv);
    }

    let pl_res = call_conduit(
        &format!(
            "/_matrix/client/v3/rooms/{}/state/m.room.power_levels",
            url::form_urlencoded::byte_serialize(room_id.as_bytes()).collect::<String>()
        ),
        Method::GET,
        Some(req_headers),
        None,
    )
    .await;

    let pl_data: Value = match pl_res {
        Ok((status, _, bytes)) if status.is_success() => {
            serde_json::from_slice(&bytes).unwrap_or(json!({}))
        }
        _ => json!({ "users": {} }),
    };

    let mut staff = Vec::new();
    if let Some(users) = pl_data.get("users").and_then(|v| v.as_object()) {
        for (m_user_id, pl_val) in users.iter() {
            let pl = pl_val.as_i64().unwrap_or(0);
            if pl >= 50 {
                staff.push(json!({
                    "userId": m_user_id,
                    "powerLevel": pl,
                    "role": if pl >= 100 { "Admin" } else { "Moderator" }
                }));
            }
        }
    }
    staff.sort_by(|a, b| {
        let b_pl = b.get("powerLevel").and_then(|v| v.as_i64()).unwrap_or(0);
        let a_pl = a.get("powerLevel").and_then(|v| v.as_i64()).unwrap_or(0);
        b_pl.cmp(&a_pl)
    });

    let reports_file = state.data_dir().join("chat_reports.json");
    let all_reports = state.store.read_document(&reports_file, json!([]));
    let mut matrix_reports = Vec::new();
    if let Some(arr) = all_reports.as_array() {
        for r in arr.iter().rev() {
            let is_matrix = r.get("matrixRoomId").is_some()
                || r.get("id")
                    .and_then(|v| v.as_str())
                    .map(|s| s.starts_with("matrix-"))
                    .unwrap_or(false);
            if is_matrix {
                matrix_reports.push(r.clone());
                if matrix_reports.len() >= 50 {
                    break;
                }
            }
        }
    }

    let room_settings = load_matrix_room_settings(state, &room_id);
    let slowmode_seconds = room_settings
        .get("slowmodeSeconds")
        .and_then(|v| v.as_i64())
        .unwrap_or(0);
    let room_muted = room_settings
        .get("roomMuted")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    let mut active_muted_users = Vec::new();
    if let Some(obj) = room_settings.get("mutedUsers").and_then(|v| v.as_object()) {
        let now = now_millis();
        for (m_id, entry) in obj.iter() {
            let exp = entry.get("expiresAt").and_then(|v| v.as_i64());
            if exp.is_none() || exp > Some(now) {
                active_muted_users.push(json!({
                    "userId": entry.get("userId").and_then(|v| v.as_str()).unwrap_or(m_id),
                    "reason": entry.get("reason").and_then(|v| v.as_str()).unwrap_or(""),
                    "mutedBy": entry.get("mutedBy").and_then(|v| v.as_str()).unwrap_or(""),
                    "mutedAt": entry.get("mutedAt").and_then(|v| v.as_i64()).unwrap_or(0),
                    "expiresAt": entry.get("expiresAt").and_then(|v| v.as_i64())
                }));
            }
        }
    }

    cors_json_response(
        200,
        json!({
            "ok": true,
            "officialRoom": "#general:mitch.pro",
            "roomId": room_id,
            "staff": staff,
            "slowmodeSeconds": slowmode_seconds,
            "roomMuted": room_muted,
            "mutedUsers": active_muted_users,
            "recentReports": matrix_reports
        }),
    )
}

async fn mod_set_role(state: &AppState, headers: &HeaderMap, body_bytes: &[u8]) -> Response {
    let cookies = crate::routes::me::cookies_of(state, headers);
    let sid = cookies
        .get("studentId")
        .filter(|s| !s.is_empty())
        .or_else(|| cookies.get("id"))
        .unwrap_or("");
    if !mitch_lib::auth::is_admin_id(&state.store, &state.id_secret, sid, false) {
        return cors_json_response(403, json!({ "error": "Admin access required" }));
    }

    let body_json: Value = serde_json::from_slice(body_bytes).unwrap_or(json!({}));
    let mut target_user_id = body_json
        .get("userId")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    if target_user_id.is_empty() {
        return cors_json_response(400, json!({ "error": "userId is required" }));
    }
    if !target_user_id.starts_with('@') {
        target_user_id = format!("@{target_user_id}:mitch.pro");
    }
    let target_pl = body_json
        .get("powerLevel")
        .and_then(|v| v.as_i64())
        .unwrap_or(-1);
    if !(0..=100).contains(&target_pl) {
        return cors_json_response(
            400,
            json!({ "error": "powerLevel must be between 0 and 100" }),
        );
    }

    let room_id = match body_json.get("roomId").and_then(|v| v.as_str()) {
        Some(r) if !r.is_empty() => r.to_string(),
        _ => match ensure_official_general_room(&state.id_secret).await {
            Ok(id) => id,
            Err(e) => return cors_json_response(500, json!({ "ok": false, "error": e })),
        },
    };

    let admin_tok = match get_system_admin_matrix_token(&state.id_secret).await {
        Ok(t) => t,
        Err(e) => return cors_json_response(500, json!({ "ok": false, "error": e })),
    };

    let mut req_headers = HeaderMap::new();
    if let Ok(hv) = HeaderValue::from_str(&format!("Bearer {admin_tok}")) {
        req_headers.insert("Authorization", hv);
    }

    let pl_res = call_conduit(
        &format!(
            "/_matrix/client/v3/rooms/{}/state/m.room.power_levels",
            url::form_urlencoded::byte_serialize(room_id.as_bytes()).collect::<String>()
        ),
        Method::GET,
        Some(req_headers.clone()),
        None,
    )
    .await;

    let mut pl_data: Value = match pl_res {
        Ok((status, _, bytes)) if status.is_success() => {
            serde_json::from_slice(&bytes).unwrap_or(json!({}))
        }
        _ => {
            return cors_json_response(
                500,
                json!({ "ok": false, "error": "Failed to fetch room power levels" }),
            )
        }
    };

    if let Some(users) = pl_data.get_mut("users").and_then(|v| v.as_object_mut()) {
        if target_pl > 0 {
            users.insert(target_user_id.clone(), json!(target_pl));
        } else {
            users.remove(&target_user_id);
        }
    }

    req_headers.insert("Content-Type", HeaderValue::from_static("application/json"));
    let put_res = call_conduit(
        &format!(
            "/_matrix/client/v3/rooms/{}/state/m.room.power_levels",
            url::form_urlencoded::byte_serialize(room_id.as_bytes()).collect::<String>()
        ),
        Method::PUT,
        Some(req_headers),
        Some(Bytes::from(
            serde_json::to_vec(&pl_data).unwrap_or_default(),
        )),
    )
    .await;

    match put_res {
        Ok((status, _, _)) if status.is_success() => {
            let admin_actor = mitch_lib::auth::email_from_sid(&state.store, &state.id_secret, sid)
                .unwrap_or_else(|| "admin".to_string());
            mitch_lib::admin::log_admin_action(
                &state.store,
                &state.cfg.data_dir,
                &admin_actor,
                "matrix_set_role",
                json!({
                    "userId": target_user_id,
                    "powerLevel": target_pl,
                    "roomId": room_id
                }),
            );
            cors_json_response(
                200,
                json!({ "ok": true, "userId": target_user_id, "powerLevel": target_pl }),
            )
        }
        _ => cors_json_response(
            500,
            json!({ "ok": false, "error": "Failed to update power level state" }),
        ),
    }
}

async fn mod_kick(state: &AppState, headers: &HeaderMap, body_bytes: &[u8]) -> Response {
    let cookies = crate::routes::me::cookies_of(state, headers);
    let sid = cookies
        .get("studentId")
        .filter(|s| !s.is_empty())
        .or_else(|| cookies.get("id"))
        .unwrap_or("");
    if !mitch_lib::auth::is_any_admin_id(&state.store, &state.id_secret, sid, false) {
        return cors_json_response(403, json!({ "error": "Staff access required" }));
    }

    let body_json: Value = serde_json::from_slice(body_bytes).unwrap_or(json!({}));
    let mut target_user_id = body_json
        .get("userId")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    if target_user_id.is_empty() {
        return cors_json_response(400, json!({ "error": "userId is required" }));
    }
    if !target_user_id.starts_with('@') {
        target_user_id = format!("@{target_user_id}:mitch.pro");
    }
    let reason = body_json
        .get("reason")
        .and_then(|v| v.as_str())
        .unwrap_or("Kicked by Mitch.pro staff");

    let room_id = match body_json.get("roomId").and_then(|v| v.as_str()) {
        Some(r) if !r.is_empty() => r.to_string(),
        _ => match ensure_official_general_room(&state.id_secret).await {
            Ok(id) => id,
            Err(e) => return cors_json_response(500, json!({ "ok": false, "error": e })),
        },
    };

    let admin_tok = match get_system_admin_matrix_token(&state.id_secret).await {
        Ok(t) => t,
        Err(e) => return cors_json_response(500, json!({ "ok": false, "error": e })),
    };

    let mut req_headers = HeaderMap::new();
    req_headers.insert("Content-Type", HeaderValue::from_static("application/json"));
    if let Ok(hv) = HeaderValue::from_str(&format!("Bearer {admin_tok}")) {
        req_headers.insert("Authorization", hv);
    }

    let kick_payload = json!({ "user_id": target_user_id, "reason": reason });
    let res = call_conduit(
        &format!(
            "/_matrix/client/v3/rooms/{}/kick",
            url::form_urlencoded::byte_serialize(room_id.as_bytes()).collect::<String>()
        ),
        Method::POST,
        Some(req_headers),
        Some(Bytes::from(
            serde_json::to_vec(&kick_payload).unwrap_or_default(),
        )),
    )
    .await;

    match res {
        Ok((status, _, _)) if status.is_success() => {
            let admin_actor = mitch_lib::auth::email_from_sid(&state.store, &state.id_secret, sid)
                .unwrap_or_else(|| "admin".to_string());
            mitch_lib::admin::log_admin_action(
                &state.store,
                &state.cfg.data_dir,
                &admin_actor,
                "matrix_kick_user",
                json!({
                    "userId": target_user_id,
                    "roomId": room_id,
                    "reason": reason
                }),
            );
            cors_json_response(
                200,
                json!({ "ok": true, "userId": target_user_id, "kicked": true }),
            )
        }
        _ => cors_json_response(500, json!({ "ok": false, "error": "Failed to kick user" })),
    }
}

async fn mod_ban(state: &AppState, headers: &HeaderMap, body_bytes: &[u8]) -> Response {
    let cookies = crate::routes::me::cookies_of(state, headers);
    let sid = cookies
        .get("studentId")
        .filter(|s| !s.is_empty())
        .or_else(|| cookies.get("id"))
        .unwrap_or("");
    if !mitch_lib::auth::is_any_admin_id(&state.store, &state.id_secret, sid, false) {
        return cors_json_response(403, json!({ "error": "Staff access required" }));
    }

    let body_json: Value = serde_json::from_slice(body_bytes).unwrap_or(json!({}));
    let mut target_user_id = body_json
        .get("userId")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    if target_user_id.is_empty() {
        return cors_json_response(400, json!({ "error": "userId is required" }));
    }
    if !target_user_id.starts_with('@') {
        target_user_id = format!("@{target_user_id}:mitch.pro");
    }
    let reason = body_json
        .get("reason")
        .and_then(|v| v.as_str())
        .unwrap_or("Banned by Mitch.pro staff");

    let room_id = match body_json.get("roomId").and_then(|v| v.as_str()) {
        Some(r) if !r.is_empty() => r.to_string(),
        _ => match ensure_official_general_room(&state.id_secret).await {
            Ok(id) => id,
            Err(e) => return cors_json_response(500, json!({ "ok": false, "error": e })),
        },
    };

    let admin_tok = match get_system_admin_matrix_token(&state.id_secret).await {
        Ok(t) => t,
        Err(e) => return cors_json_response(500, json!({ "ok": false, "error": e })),
    };

    let mut req_headers = HeaderMap::new();
    req_headers.insert("Content-Type", HeaderValue::from_static("application/json"));
    if let Ok(hv) = HeaderValue::from_str(&format!("Bearer {admin_tok}")) {
        req_headers.insert("Authorization", hv);
    }

    let ban_payload = json!({ "user_id": target_user_id, "reason": reason });
    let res = call_conduit(
        &format!(
            "/_matrix/client/v3/rooms/{}/ban",
            url::form_urlencoded::byte_serialize(room_id.as_bytes()).collect::<String>()
        ),
        Method::POST,
        Some(req_headers),
        Some(Bytes::from(
            serde_json::to_vec(&ban_payload).unwrap_or_default(),
        )),
    )
    .await;

    match res {
        Ok((status, _, _)) if status.is_success() => {
            let admin_actor = mitch_lib::auth::email_from_sid(&state.store, &state.id_secret, sid)
                .unwrap_or_else(|| "admin".to_string());
            mitch_lib::admin::log_admin_action(
                &state.store,
                &state.cfg.data_dir,
                &admin_actor,
                "matrix_ban_user",
                json!({
                    "userId": target_user_id,
                    "roomId": room_id,
                    "reason": reason
                }),
            );
            cors_json_response(
                200,
                json!({ "ok": true, "userId": target_user_id, "banned": true }),
            )
        }
        _ => cors_json_response(500, json!({ "ok": false, "error": "Failed to ban user" })),
    }
}

async fn mod_redact(state: &AppState, headers: &HeaderMap, body_bytes: &[u8]) -> Response {
    let cookies = crate::routes::me::cookies_of(state, headers);
    let sid = cookies
        .get("studentId")
        .filter(|s| !s.is_empty())
        .or_else(|| cookies.get("id"))
        .unwrap_or("");
    if !mitch_lib::auth::is_any_admin_id(&state.store, &state.id_secret, sid, false) {
        return cors_json_response(403, json!({ "error": "Staff access required" }));
    }

    let body_json: Value = serde_json::from_slice(body_bytes).unwrap_or(json!({}));
    let event_id = body_json
        .get("eventId")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim();
    if event_id.is_empty() {
        return cors_json_response(400, json!({ "error": "eventId is required" }));
    }
    let reason = body_json
        .get("reason")
        .and_then(|v| v.as_str())
        .unwrap_or("Redacted by staff");

    let room_id = match body_json.get("roomId").and_then(|v| v.as_str()) {
        Some(r) if !r.is_empty() => r.to_string(),
        _ => match ensure_official_general_room(&state.id_secret).await {
            Ok(id) => id,
            Err(e) => return cors_json_response(500, json!({ "ok": false, "error": e })),
        },
    };

    let admin_tok = match get_system_admin_matrix_token(&state.id_secret).await {
        Ok(t) => t,
        Err(e) => return cors_json_response(500, json!({ "ok": false, "error": e })),
    };

    let mut req_headers = HeaderMap::new();
    req_headers.insert("Content-Type", HeaderValue::from_static("application/json"));
    if let Ok(hv) = HeaderValue::from_str(&format!("Bearer {admin_tok}")) {
        req_headers.insert("Authorization", hv);
    }

    let txn_id = format!("mitch_redact_{}", now_millis());
    let redact_payload = json!({ "reason": reason });
    let res = call_conduit(
        &format!(
            "/_matrix/client/v3/rooms/{}/redact/{}/{}",
            url::form_urlencoded::byte_serialize(room_id.as_bytes()).collect::<String>(),
            url::form_urlencoded::byte_serialize(event_id.as_bytes()).collect::<String>(),
            url::form_urlencoded::byte_serialize(txn_id.as_bytes()).collect::<String>()
        ),
        Method::PUT,
        Some(req_headers),
        Some(Bytes::from(
            serde_json::to_vec(&redact_payload).unwrap_or_default(),
        )),
    )
    .await;

    match res {
        Ok((status, _, _)) if status.is_success() => {
            let admin_actor = mitch_lib::auth::email_from_sid(&state.store, &state.id_secret, sid)
                .unwrap_or_else(|| "admin".to_string());
            mitch_lib::admin::log_admin_action(
                &state.store,
                &state.cfg.data_dir,
                &admin_actor,
                "matrix_redact_message",
                json!({
                    "eventId": event_id,
                    "roomId": room_id,
                    "reason": reason
                }),
            );
            cors_json_response(
                200,
                json!({ "ok": true, "eventId": event_id, "redacted": true }),
            )
        }
        _ => cors_json_response(
            500,
            json!({ "ok": false, "error": "Failed to redact message" }),
        ),
    }
}

async fn mod_slowmode(state: &AppState, headers: &HeaderMap, body_bytes: &[u8]) -> Response {
    let cookies = crate::routes::me::cookies_of(state, headers);
    let sid = cookies
        .get("studentId")
        .filter(|s| !s.is_empty())
        .or_else(|| cookies.get("id"))
        .unwrap_or("");
    if !mitch_lib::auth::is_admin_id(&state.store, &state.id_secret, sid, false) {
        return cors_json_response(403, json!({ "error": "Admin access required" }));
    }

    let body_json: Value = serde_json::from_slice(body_bytes).unwrap_or(json!({}));
    let seconds = std::cmp::max(
        0,
        body_json
            .get("seconds")
            .and_then(|v| v.as_i64())
            .unwrap_or(0),
    );

    let room_id = match body_json.get("roomId").and_then(|v| v.as_str()) {
        Some(r) if !r.is_empty() => r.to_string(),
        _ => match ensure_official_general_room(&state.id_secret).await {
            Ok(id) => id,
            Err(e) => return cors_json_response(500, json!({ "ok": false, "error": e })),
        },
    };

    let settings_file = state.data_dir().join("matrix_room_settings.json");
    let mut all = state.store.read_document(&settings_file, json!({}));
    if let Some(map) = all.as_object_mut() {
        let room = map.entry(room_id.clone()).or_insert_with(|| {
            json!({
                "slowmodeSeconds": 0,
                "roomMuted": false,
                "mutedUsers": {}
            })
        });
        room["slowmodeSeconds"] = json!(seconds);
        let _ = state.store.write_document(&settings_file, &all);
    }

    let admin_actor = mitch_lib::auth::email_from_sid(&state.store, &state.id_secret, sid)
        .unwrap_or_else(|| "admin".to_string());
    mitch_lib::admin::log_admin_action(
        &state.store,
        &state.cfg.data_dir,
        &admin_actor,
        "matrix_set_slowmode",
        json!({
            "roomId": room_id,
            "slowmodeSeconds": seconds
        }),
    );

    cors_json_response(
        200,
        json!({ "ok": true, "roomId": room_id, "slowmodeSeconds": seconds }),
    )
}

async fn mod_mute_user(state: &AppState, headers: &HeaderMap, body_bytes: &[u8]) -> Response {
    let cookies = crate::routes::me::cookies_of(state, headers);
    let sid = cookies
        .get("studentId")
        .filter(|s| !s.is_empty())
        .or_else(|| cookies.get("id"))
        .unwrap_or("");
    if !mitch_lib::auth::is_admin_id(&state.store, &state.id_secret, sid, false) {
        return cors_json_response(403, json!({ "error": "Admin access required" }));
    }

    let body_json: Value = serde_json::from_slice(body_bytes).unwrap_or(json!({}));
    let mut target_user_id = body_json
        .get("userId")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    if target_user_id.is_empty() {
        return cors_json_response(400, json!({ "error": "userId is required" }));
    }
    if !target_user_id.starts_with('@') {
        target_user_id = format!("@{target_user_id}:mitch.pro");
    }

    let duration_seconds = std::cmp::max(
        0,
        body_json
            .get("durationSeconds")
            .and_then(|v| v.as_i64())
            .unwrap_or(0),
    );
    let reason = body_json
        .get("reason")
        .and_then(|v| v.as_str())
        .unwrap_or("Muted by administrator");
    let room_id = match body_json.get("roomId").and_then(|v| v.as_str()) {
        Some(r) if !r.is_empty() => r.to_string(),
        _ => match ensure_official_general_room(&state.id_secret).await {
            Ok(id) => id,
            Err(e) => return cors_json_response(500, json!({ "ok": false, "error": e })),
        },
    };

    let expires_at = if duration_seconds > 0 {
        Some(now_millis() + duration_seconds * 1000)
    } else {
        None
    };

    let admin_actor = mitch_lib::auth::email_from_sid(&state.store, &state.id_secret, sid)
        .unwrap_or_else(|| "admin".to_string());

    let settings_file = state.data_dir().join("matrix_room_settings.json");
    let mut all = state.store.read_document(&settings_file, json!({}));
    if let Some(map) = all.as_object_mut() {
        let room = map.entry(room_id.clone()).or_insert_with(|| {
            json!({
                "slowmodeSeconds": 0,
                "roomMuted": false,
                "mutedUsers": {}
            })
        });
        if room.get("mutedUsers").is_none() {
            room["mutedUsers"] = json!({});
        }
        if let Some(m_map) = room.get_mut("mutedUsers").and_then(|v| v.as_object_mut()) {
            m_map.insert(
                target_user_id.clone(),
                json!({
                    "userId": target_user_id,
                    "reason": reason,
                    "mutedBy": admin_actor,
                    "mutedAt": now_millis(),
                    "expiresAt": expires_at
                }),
            );
        }
        let _ = state.store.write_document(&settings_file, &all);
    }

    // Attempt power level -1 in Conduit
    if let Ok(admin_tok) = get_system_admin_matrix_token(&state.id_secret).await {
        let mut req_headers = HeaderMap::new();
        if let Ok(hv) = HeaderValue::from_str(&format!("Bearer {admin_tok}")) {
            req_headers.insert("Authorization", hv);
        }
        if let Ok((status, _, bytes)) = call_conduit(
            &format!(
                "/_matrix/client/v3/rooms/{}/state/m.room.power_levels",
                url::form_urlencoded::byte_serialize(room_id.as_bytes()).collect::<String>()
            ),
            Method::GET,
            Some(req_headers.clone()),
            None,
        )
        .await
        {
            if status.is_success() {
                if let Ok(mut pl_data) = serde_json::from_slice::<Value>(&bytes) {
                    if let Some(users) = pl_data.get_mut("users").and_then(|v| v.as_object_mut()) {
                        users.insert(target_user_id.clone(), json!(-1));
                        req_headers
                            .insert("Content-Type", HeaderValue::from_static("application/json"));
                        let _ = call_conduit(
                            &format!(
                                "/_matrix/client/v3/rooms/{}/state/m.room.power_levels",
                                url::form_urlencoded::byte_serialize(room_id.as_bytes())
                                    .collect::<String>()
                            ),
                            Method::PUT,
                            Some(req_headers),
                            Some(Bytes::from(
                                serde_json::to_vec(&pl_data).unwrap_or_default(),
                            )),
                        )
                        .await;
                    }
                }
            }
        }
    }

    mitch_lib::admin::log_admin_action(
        &state.store,
        &state.cfg.data_dir,
        &admin_actor,
        "matrix_mute_user",
        json!({
            "roomId": room_id,
            "userId": target_user_id,
            "durationSeconds": duration_seconds,
            "reason": reason,
            "expiresAt": expires_at
        }),
    );

    cors_json_response(
        200,
        json!({ "ok": true, "roomId": room_id, "userId": target_user_id, "muted": true, "expiresAt": expires_at }),
    )
}

async fn mod_unmute_user(state: &AppState, headers: &HeaderMap, body_bytes: &[u8]) -> Response {
    let cookies = crate::routes::me::cookies_of(state, headers);
    let sid = cookies
        .get("studentId")
        .filter(|s| !s.is_empty())
        .or_else(|| cookies.get("id"))
        .unwrap_or("");
    if !mitch_lib::auth::is_admin_id(&state.store, &state.id_secret, sid, false) {
        return cors_json_response(403, json!({ "error": "Admin access required" }));
    }

    let body_json: Value = serde_json::from_slice(body_bytes).unwrap_or(json!({}));
    let mut target_user_id = body_json
        .get("userId")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    if target_user_id.is_empty() {
        return cors_json_response(400, json!({ "error": "userId is required" }));
    }
    if !target_user_id.starts_with('@') {
        target_user_id = format!("@{target_user_id}:mitch.pro");
    }

    let room_id = match body_json.get("roomId").and_then(|v| v.as_str()) {
        Some(r) if !r.is_empty() => r.to_string(),
        _ => match ensure_official_general_room(&state.id_secret).await {
            Ok(id) => id,
            Err(e) => return cors_json_response(500, json!({ "ok": false, "error": e })),
        },
    };

    let settings_file = state.data_dir().join("matrix_room_settings.json");
    let mut all = state.store.read_document(&settings_file, json!({}));
    if let Some(room) = all.get_mut(&room_id) {
        if let Some(m_map) = room.get_mut("mutedUsers").and_then(|v| v.as_object_mut()) {
            m_map.remove(&target_user_id);
            let uname = target_user_id
                .trim_start_matches('@')
                .split(':')
                .next()
                .unwrap_or("");
            m_map.remove(uname);
            let _ = state.store.write_document(&settings_file, &all);
        }
    }

    // Reset PL -1 in Conduit
    if let Ok(admin_tok) = get_system_admin_matrix_token(&state.id_secret).await {
        let mut req_headers = HeaderMap::new();
        if let Ok(hv) = HeaderValue::from_str(&format!("Bearer {admin_tok}")) {
            req_headers.insert("Authorization", hv);
        }
        if let Ok((status, _, bytes)) = call_conduit(
            &format!(
                "/_matrix/client/v3/rooms/{}/state/m.room.power_levels",
                url::form_urlencoded::byte_serialize(room_id.as_bytes()).collect::<String>()
            ),
            Method::GET,
            Some(req_headers.clone()),
            None,
        )
        .await
        {
            if status.is_success() {
                if let Ok(mut pl_data) = serde_json::from_slice::<Value>(&bytes) {
                    if let Some(users) = pl_data.get_mut("users").and_then(|v| v.as_object_mut()) {
                        if users.get(&target_user_id).and_then(|v| v.as_i64()) == Some(-1) {
                            users.remove(&target_user_id);
                            req_headers.insert(
                                "Content-Type",
                                HeaderValue::from_static("application/json"),
                            );
                            let _ = call_conduit(
                                &format!(
                                    "/_matrix/client/v3/rooms/{}/state/m.room.power_levels",
                                    url::form_urlencoded::byte_serialize(room_id.as_bytes())
                                        .collect::<String>()
                                ),
                                Method::PUT,
                                Some(req_headers),
                                Some(Bytes::from(
                                    serde_json::to_vec(&pl_data).unwrap_or_default(),
                                )),
                            )
                            .await;
                        }
                    }
                }
            }
        }
    }

    let admin_actor = mitch_lib::auth::email_from_sid(&state.store, &state.id_secret, sid)
        .unwrap_or_else(|| "admin".to_string());
    mitch_lib::admin::log_admin_action(
        &state.store,
        &state.cfg.data_dir,
        &admin_actor,
        "matrix_unmute_user",
        json!({
            "roomId": room_id,
            "userId": target_user_id
        }),
    );

    cors_json_response(
        200,
        json!({ "ok": true, "roomId": room_id, "userId": target_user_id, "muted": false }),
    )
}

async fn mod_mute_room(state: &AppState, headers: &HeaderMap, body_bytes: &[u8]) -> Response {
    let cookies = crate::routes::me::cookies_of(state, headers);
    let sid = cookies
        .get("studentId")
        .filter(|s| !s.is_empty())
        .or_else(|| cookies.get("id"))
        .unwrap_or("");
    if !mitch_lib::auth::is_admin_id(&state.store, &state.id_secret, sid, false) {
        return cors_json_response(403, json!({ "error": "Admin access required" }));
    }

    let body_json: Value = serde_json::from_slice(body_bytes).unwrap_or(json!({}));
    let room_muted = body_json
        .get("muted")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    let room_id = match body_json.get("roomId").and_then(|v| v.as_str()) {
        Some(r) if !r.is_empty() => r.to_string(),
        _ => match ensure_official_general_room(&state.id_secret).await {
            Ok(id) => id,
            Err(e) => return cors_json_response(500, json!({ "ok": false, "error": e })),
        },
    };

    let settings_file = state.data_dir().join("matrix_room_settings.json");
    let mut all = state.store.read_document(&settings_file, json!({}));
    if let Some(map) = all.as_object_mut() {
        let room = map.entry(room_id.clone()).or_insert_with(|| {
            json!({
                "slowmodeSeconds": 0,
                "roomMuted": false,
                "mutedUsers": {}
            })
        });
        room["roomMuted"] = json!(room_muted);
        let _ = state.store.write_document(&settings_file, &all);
    }

    // Set events_default in Conduit (50 if muted, 0 if normal)
    if let Ok(admin_tok) = get_system_admin_matrix_token(&state.id_secret).await {
        let mut req_headers = HeaderMap::new();
        if let Ok(hv) = HeaderValue::from_str(&format!("Bearer {admin_tok}")) {
            req_headers.insert("Authorization", hv);
        }
        if let Ok((status, _, bytes)) = call_conduit(
            &format!(
                "/_matrix/client/v3/rooms/{}/state/m.room.power_levels",
                url::form_urlencoded::byte_serialize(room_id.as_bytes()).collect::<String>()
            ),
            Method::GET,
            Some(req_headers.clone()),
            None,
        )
        .await
        {
            if status.is_success() {
                if let Ok(mut pl_data) = serde_json::from_slice::<Value>(&bytes) {
                    pl_data["events_default"] = json!(if room_muted { 50 } else { 0 });
                    req_headers
                        .insert("Content-Type", HeaderValue::from_static("application/json"));
                    let _ = call_conduit(
                        &format!(
                            "/_matrix/client/v3/rooms/{}/state/m.room.power_levels",
                            url::form_urlencoded::byte_serialize(room_id.as_bytes())
                                .collect::<String>()
                        ),
                        Method::PUT,
                        Some(req_headers),
                        Some(Bytes::from(
                            serde_json::to_vec(&pl_data).unwrap_or_default(),
                        )),
                    )
                    .await;
                }
            }
        }
    }

    let admin_actor = mitch_lib::auth::email_from_sid(&state.store, &state.id_secret, sid)
        .unwrap_or_else(|| "admin".to_string());
    mitch_lib::admin::log_admin_action(
        &state.store,
        &state.cfg.data_dir,
        &admin_actor,
        "matrix_mute_room",
        json!({
            "roomId": room_id,
            "roomMuted": room_muted
        }),
    );

    cors_json_response(
        200,
        json!({ "ok": true, "roomId": room_id, "roomMuted": room_muted }),
    )
}

async fn mod_prune_stale(state: &AppState, headers: &HeaderMap, body_bytes: &[u8]) -> Response {
    let cookies = crate::routes::me::cookies_of(state, headers);
    let sid = cookies
        .get("studentId")
        .filter(|s| !s.is_empty())
        .or_else(|| cookies.get("id"))
        .unwrap_or("");
    let body_json: Value = serde_json::from_slice(body_bytes).unwrap_or(json!({}));

    let auth_header = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    let user_token = auth_header.trim_start_matches("Bearer ").trim();

    if user_token.is_empty() && sid.is_empty() {
        return cors_json_response(401, json!({ "error": "unauthorized" }));
    }

    let current_device_id = body_json
        .get("currentDeviceId")
        .and_then(|v| v.as_str())
        .or_else(|| {
            headers
                .get("x-matrix-device-id")
                .and_then(|v| v.to_str().ok())
        })
        .unwrap_or("");

    if !user_token.is_empty() {
        let mut dev_headers = HeaderMap::new();
        if let Ok(hv) = HeaderValue::from_str(&format!("Bearer {user_token}")) {
            dev_headers.insert("Authorization", hv);
        }

        if let Ok((status, _, bytes)) = call_conduit(
            "/_matrix/client/v3/devices",
            Method::GET,
            Some(dev_headers.clone()),
            None,
        )
        .await
        {
            if status.is_success() {
                let dev_data: Value = serde_json::from_slice(&bytes).unwrap_or(json!({}));
                let devices = dev_data
                    .get("devices")
                    .and_then(|v| v.as_array())
                    .cloned()
                    .unwrap_or_default();
                let mut pruned = Vec::new();
                for d in devices {
                    let d_id = d.get("device_id").and_then(|v| v.as_str()).unwrap_or("");
                    if !d_id.is_empty() && d_id != current_device_id {
                        let _ = call_conduit(
                            &format!(
                                "/_matrix/client/v3/devices/{}",
                                url::form_urlencoded::byte_serialize(d_id.as_bytes())
                                    .collect::<String>()
                            ),
                            Method::DELETE,
                            Some(dev_headers.clone()),
                            None,
                        )
                        .await;
                        pruned.push(d_id.to_string());
                    }
                }
                return cors_json_response(
                    200,
                    json!({ "ok": true, "pruned": pruned.len(), "devices": pruned }),
                );
            }
        }
    }

    cors_json_response(200, json!({ "ok": true, "pruned": 0, "devices": [] }))
}

/// Gateway dispatcher for Matrix paths: `/_matrix/*`, `/.well-known/matrix/*`, `/matrix/config.json`.
pub async fn handle_matrix_gateway(
    state: &Arc<AppState>,
    method: &Method,
    path: &str,
    headers: &HeaderMap,
    search: &str,
    body_bytes: &[u8],
) -> Option<Response> {
    if method == Method::OPTIONS {
        return Some(cors_response(StatusCode::NO_CONTENT, Bytes::new(), None));
    }

    if path == "/matrix/config.json" && method == Method::GET {
        return Some(handle_cinny_config());
    }

    if path.starts_with("/.well-known/matrix/") {
        return handle_well_known(method, path, headers);
    }

    if !path.starts_with("/_matrix/") {
        return None;
    }

    // VoIP STUN/TURN Discovery
    static TURN_RE: OnceLock<regex::Regex> = OnceLock::new();
    let turn_re = TURN_RE.get_or_init(|| {
        regex::Regex::new(r"^/_matrix/client/(?:v3|r0)/voip/turnServer")
            .unwrap_or_else(|_| unreachable_regex())
    });
    if method == Method::GET && turn_re.is_match(path) {
        return Some(cors_json_response(
            200,
            json!({
                "uris": [
                    "stun:stun.l.google.com:19302",
                    "stun:stun1.l.google.com:19302",
                    "stun:stun2.l.google.com:19302",
                    "stun:stun.cloudflare.com:3478",
                    "stun:stun.matrix.org:3478"
                ],
                "ttl": 86400
            }),
        ));
    }

    // Empty notifications fallback for Conduit
    static NOTIF_RE: OnceLock<regex::Regex> = OnceLock::new();
    let notif_re = NOTIF_RE.get_or_init(|| {
        regex::Regex::new(r"^/_matrix/client/(?:v3|r0)/notifications")
            .unwrap_or_else(|_| unreachable_regex())
    });
    if method == Method::GET && notif_re.is_match(path) {
        return Some(cors_json_response(200, json!({ "notifications": [] })));
    }

    // Intercept readable-message policy before forwarding to homeserver
    static POLICY_SEND_RE: OnceLock<regex::Regex> = OnceLock::new();
    let policy_send_re = POLICY_SEND_RE.get_or_init(|| {
        regex::Regex::new(
            r"^/_matrix/client/(?:v3|r0|v1|unstable)/rooms/[^/]+/send/([^/]+)(?:/[^/]+)?$",
        )
        .unwrap_or_else(|_| unreachable_regex())
    });
    if (method == Method::PUT || method == Method::POST) && !body_bytes.is_empty() {
        if let Some(caps) = policy_send_re.captures(path) {
            let event_type = caps.get(1).map(|m| m.as_str()).unwrap_or("");
            if event_type == "m.room.message" {
                if let Ok(content) = serde_json::from_slice::<Value>(body_bytes) {
                    if mitch_lib::matrix::matrix_message_blocked(&content) {
                        return Some(cors_json_response(
                            403,
                            json!({
                                "errcode": "M_FORBIDDEN",
                                "error": "Your message contains a word or phrase that is not allowed in this chat. Please edit it and try again."
                            }),
                        ));
                    }
                }
            }
        }
    }

    // Intercept client-side chat reports to feed into Mitch.pro Safety & Moderation
    static REPORT_RE: OnceLock<regex::Regex> = OnceLock::new();
    let report_re = REPORT_RE.get_or_init(|| {
        regex::Regex::new(r"^/_matrix/client/(?:v3|r0)/rooms/([^/]+)/report(?:/([^/]+))?$")
            .unwrap_or_else(|_| unreachable_regex())
    });
    if method == Method::POST {
        if let Some(caps) = report_re.captures(path) {
            let room_id = caps.get(1).map(|m| m.as_str()).unwrap_or("");
            let event_id = caps.get(2).map(|m| m.as_str()).unwrap_or("");
            let parsed: Value = serde_json::from_slice(body_bytes).unwrap_or(json!({}));
            let reason =
                parsed
                    .get("reason")
                    .and_then(|v| v.as_str())
                    .unwrap_or(if event_id.is_empty() {
                        "Reported chat without entering"
                    } else {
                        "Reported message"
                    });

            let cookies = crate::routes::me::cookies_of(state, headers);
            let sid = cookies
                .get("studentId")
                .filter(|s| !s.is_empty())
                .or_else(|| cookies.get("id"))
                .unwrap_or("");
            let mut reporter = if !sid.is_empty() {
                mitch_lib::auth::email_from_sid(&state.store, &state.id_secret, sid)
                    .unwrap_or_else(|| sid.to_string())
            } else {
                String::new()
            };
            if reporter.is_empty() {
                reporter = "matrix-user".to_string();
            }

            let clean_id = if !event_id.is_empty() {
                event_id.to_string()
            } else {
                format!("room-{}", now_millis())
            };
            let report_entry = json!({
                "id": format!("matrix-{clean_id}"),
                "reason": format!("[Matrix Room {room_id}] {reason}"),
                "reportedBy": reporter,
                "ts": now_millis(),
                "status": "Needs review",
                "matrixRoomId": room_id,
                "matrixEventId": event_id,
                "matrixSender": "unknown",
                "reportedWithoutEntering": event_id.is_empty(),
                "context": [
                    {
                        "from": "unknown",
                        "to": room_id,
                        "text": format!("Reported: {reason}"),
                        "ts": now_millis(),
                        "reported": true
                    }
                ]
            });

            let reports_file = state.data_dir().join("chat_reports.json");
            let mut reports = state.store.read_document(&reports_file, json!([]));
            if let Some(arr) = reports.as_array_mut() {
                arr.push(report_entry);
                if arr.len() > 5000 {
                    let excess = arr.len() - 5000;
                    arr.drain(0..excess);
                }
                let _ = state.store.write_document(&reports_file, &reports);
            }

            if event_id.is_empty() {
                return Some(cors_json_response(200, json!({})));
            }
        }
    }

    // Enforce slowmode, room lockdown, and user mute on send
    static SEND_RE: OnceLock<regex::Regex> = OnceLock::new();
    let send_re = SEND_RE.get_or_init(|| {
        regex::Regex::new(r"^/_matrix/client/(?:v3|r0)/rooms/([^/]+)/send/([^/]+)(?:/([^/]+))?$")
            .unwrap_or_else(|_| unreachable_regex())
    });
    let mut send_match_room_id = String::new();
    let mut send_match_sender_key = String::new();
    let mut is_chat_send_event = false;

    if method == Method::PUT || method == Method::POST {
        if let Some(caps) = send_re.captures(path) {
            let target_room_id = caps.get(1).map(|m| m.as_str()).unwrap_or("");
            let event_type = caps.get(2).map(|m| m.as_str()).unwrap_or("");
            is_chat_send_event = event_type == "m.room.message"
                || event_type == "m.room.encrypted"
                || event_type == "m.reaction"
                || event_type == "m.sticker"
                || event_type.starts_with("org.matrix.msc2677.reaction");

            if is_chat_send_event {
                send_match_room_id = target_room_id.to_string();
                let parsed_payload: Option<Value> = serde_json::from_slice(body_bytes).ok();
                let sender_account =
                    resolve_matrix_account(state, headers, parsed_payload.as_ref()).await;

                let is_staff = is_matrix_staff_member(state, headers, sender_account.as_ref());
                if !is_staff {
                    let room_settings = load_matrix_room_settings(state, target_room_id);
                    if room_settings.get("roomMuted").and_then(|v| v.as_bool()) == Some(true) {
                        return Some(cors_json_response(
                            403,
                            json!({
                                "errcode": "M_FORBIDDEN",
                                "error": "This room is currently in lockdown mode. Only administrators and moderators may speak."
                            }),
                        ));
                    }

                    let mut sender_ids = Vec::new();
                    if let Some(ref acc) = sender_account {
                        if !acc.user_id.is_empty() {
                            sender_ids.push(acc.user_id.clone());
                        }
                        if !acc.norm_email.is_empty() {
                            sender_ids.push(acc.norm_email.clone());
                        }
                        if !acc.uid.is_empty() {
                            sender_ids.push(acc.uid.clone());
                        }
                    }

                    if let Some(mute) =
                        is_user_muted_in_matrix_room(state, target_room_id, &sender_ids)
                    {
                        let reason = mute.get("reason").and_then(|v| v.as_str()).unwrap_or("");
                        let reason_part = if !reason.is_empty() {
                            format!(": {reason}")
                        } else {
                            String::new()
                        };
                        return Some(cors_json_response(
                            403,
                            json!({
                                "errcode": "M_FORBIDDEN",
                                "error": format!("You are muted in this room{reason_part}.")
                            }),
                        ));
                    }

                    let slowmode_seconds = room_settings
                        .get("slowmodeSeconds")
                        .and_then(|v| v.as_i64())
                        .unwrap_or(0);
                    if slowmode_seconds > 0 {
                        let s_key = sender_ids
                            .first()
                            .cloned()
                            .unwrap_or_else(|| "anonymous".to_string());
                        let wait_sec =
                            check_matrix_slowmode(target_room_id, &s_key, slowmode_seconds);
                        if wait_sec > 0 {
                            let mut resp = cors_json_response(
                                429,
                                json!({
                                    "errcode": "M_LIMIT_EXCEEDED",
                                    "error": format!("Slowmode is enabled ({slowmode_seconds}s). Please wait {wait_sec}s before sending another message."),
                                    "retry_after_ms": wait_sec * 1000
                                }),
                            );
                            if let Ok(hv) = HeaderValue::from_str(&wait_sec.to_string()) {
                                resp.headers_mut().insert("Retry-After", hv);
                            }
                            return Some(resp);
                        }
                    }
                }

                send_match_sender_key = sender_account
                    .as_ref()
                    .map(|a| a.user_id.clone())
                    .unwrap_or_else(|| "anon".to_string());
            }
        }
    }

    // Forward upstream to Conduit
    let full_path = if search.is_empty() {
        path.to_string()
    } else {
        format!("{path}?{search}")
    };

    let body_opt = if body_bytes.is_empty() {
        None
    } else {
        Some(Bytes::copy_from_slice(body_bytes))
    };

    let conduit_res =
        call_conduit(&full_path, method.clone(), Some(headers.clone()), body_opt).await;

    match conduit_res {
        Ok((status, upstream_headers, bytes)) => {
            // Track active user in Matrix for presence
            if let Some(acc) = resolve_matrix_account(state, headers, None).await {
                if !acc.norm_email.is_empty() {
                    let mut seen = state
                        .matrix_user_last_seen
                        .lock()
                        .unwrap_or_else(|e| e.into_inner());
                    seen.insert(acc.norm_email.clone(), now_millis());
                    crate::ws::touch_user_presence(state, &acc.norm_email, "Chatting in Matrix");
                }
            }

            if status.is_success() && is_chat_send_event && !send_match_room_id.is_empty() {
                record_matrix_message_sent(&send_match_room_id, &send_match_sender_key);
            }

            let ct = upstream_headers
                .get("content-type")
                .and_then(|v| v.to_str().ok());
            Some(cors_response(status, bytes, ct))
        }
        Err(err) => Some(cors_json_response(
            502,
            json!({
                "error": "Matrix chat backend unavailable",
                "details": err
            }),
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_matrix_device_id() {
        assert_eq!(
            sanitize_matrix_device_id("ABC_123.test~foo-bar"),
            "ABC_123.test~foo-bar"
        );
        assert_eq!(
            sanitize_matrix_device_id("invalid device id with spaces!"),
            ""
        );
        assert_eq!(sanitize_matrix_device_id(""), "");
    }

    #[test]
    fn test_matrix_password_generation() {
        let p1 = get_matrix_password_for_uid("test-user-123", b"secret-salt");
        let p2 = get_matrix_password_for_uid("test-user-123", b"secret-salt");
        assert_eq!(p1, p2);
        assert!(!p1.is_empty());

        let p3 = get_matrix_password_for_uid("test-user-456", b"secret-salt");
        assert_ne!(p1, p3);
    }

    #[test]
    fn test_slowmode_tracking() {
        let room = "test_room_1";
        let sender = "user_abc";
        assert_eq!(check_matrix_slowmode(room, sender, 10), 0);

        record_matrix_message_sent(room, sender);
        let wait = check_matrix_slowmode(room, sender, 10);
        assert!(wait > 0 && wait <= 10);

        let other_sender = "user_def";
        assert_eq!(check_matrix_slowmode(room, other_sender, 10), 0);
    }

    #[test]
    fn test_cinny_config() {
        let resp = handle_cinny_config();
        assert_eq!(resp.status(), StatusCode::OK);
    }

    #[test]
    fn test_well_known_client_and_server() {
        let mut headers = HeaderMap::new();
        headers.insert("host", HeaderValue::from_static("mitch.pro"));

        let resp_client = handle_well_known(&Method::GET, "/.well-known/matrix/client", &headers);
        assert!(resp_client.is_some());
        assert_eq!(resp_client.unwrap().status(), StatusCode::OK);

        let resp_server = handle_well_known(&Method::GET, "/.well-known/matrix/server", &headers);
        assert!(resp_server.is_some());
        assert_eq!(resp_server.unwrap().status(), StatusCode::OK);

        let resp_opt = handle_well_known(&Method::OPTIONS, "/.well-known/matrix/client", &headers);
        assert!(resp_opt.is_some());
        assert_eq!(resp_opt.unwrap().status(), StatusCode::NO_CONTENT);
    }
}
