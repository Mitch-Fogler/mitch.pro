//! Captcha proxy + content injection — port of server.js's World's Hardest
//! Captcha API Proxy block (~7982-8027) and /api/content (~12932-13004).
//!
//! Captcha proxy: transparent HTTP relay to worldshardestcaptcha.com with
//! header stripping and method passthrough. /api/content serves HTML with
//! the injection ladder (IS_PREMIUM, sync.js, assistant.js, broadcast.js,
//! agree footer) behind a hash-validation auth ladder.

use crate::errors::json_resp;
use crate::state::AppState;
use axum::http::{HeaderMap, StatusCode};
use axum::response::Response;
use serde_json::json;
use serde_json::Value;
use std::sync::Arc;

const CAPTCHA_TARGET: &str = "https://www.worldshardestcaptcha.com";

/// Paths relayed to worldshardestcaptcha.com.
pub fn is_captcha_proxy_path(path: &str) -> bool {
    path == "/api/token"
        || path.starts_with("/api/puzzle/")
        || path == "/api/solve"
        || path == "/api/submit"
        || path == "/api/stats"
        || path == "/api/next"
        || path.starts_with("/images/")
}

/// Transparent captcha proxy — server.js:7982-8027.
pub async fn captcha_proxy(
    _state: &Arc<AppState>,
    method: &axum::http::Method,
    path: &str,
    headers: &HeaderMap,
    search: &str,
    body_bytes: &[u8],
) -> Option<Response> {
    if !is_captcha_proxy_path(path) {
        return None;
    }
    let target = format!("{CAPTCHA_TARGET}{path}{search}");
    let client = match reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
        .timeout(std::time::Duration::from_secs(10))
        .build()
    {
        Ok(c) => c,
        Err(_) => return Some(bad_gateway()),
    };

    let reqwest_m = match method.as_str() {
        "POST" => reqwest::Method::POST,
        "PUT" => reqwest::Method::PUT,
        "DELETE" => reqwest::Method::DELETE,
        "PATCH" => reqwest::Method::PATCH,
        "HEAD" => reqwest::Method::HEAD,
        _ => reqwest::Method::GET,
    };
    let mut req = client.request(reqwest_m, &target);
    // Copy request headers (stripping the proxy-forbidden set).
    const SKIP: &[&str] = &[
        "host",
        "cookie",
        "referer",
        "origin",
        "accept-encoding",
        "x-mitch-client-ip",
    ];
    for (name, value) in headers.iter() {
        let name_lower = name.as_str().to_lowercase();
        if SKIP.contains(&name_lower.as_str()) {
            continue;
        }
        if let Ok(v) = value.to_str() {
            req = req.header(name.as_str(), v);
        }
    }
    // Force Origin/Referer to the captcha site.
    req = req
        .header("Origin", CAPTCHA_TARGET)
        .header("Referer", CAPTCHA_TARGET);

    if !method.is_safe() && !body_bytes.is_empty() {
        req = req.body(body_bytes.to_vec());
    }

    match req.send().await {
        Ok(upstream) => {
            let status = axum::http::StatusCode::from_u16(upstream.status().as_u16())
                .unwrap_or(StatusCode::BAD_GATEWAY);
            let mut builder = Response::builder().status(status);
            for (name, value) in upstream.headers().iter() {
                let n = name.as_str().to_lowercase();
                if n == "content-security-policy"
                    || n == "x-frame-options"
                    || n == "content-encoding"
                    || n == "content-length"
                {
                    continue;
                }
                builder = builder.header(name, value);
            }
            builder = builder.header("access-control-allow-origin", "*");
            let body = upstream.bytes().await.unwrap_or_default();
            Some(
                builder
                    .body(axum::body::Body::from(body))
                    .unwrap_or_else(|_| bad_gateway()),
            )
        }
        Err(_) => Some(bad_gateway()),
    }
}

fn bad_gateway() -> Response {
    json_resp(
        502,
        json!({"error": "Bad Gateway", "message": "Failed to proxy captcha API."}),
    )
}

/// `GET|POST /api/content` — server.js:12932-13004.
pub async fn content(
    state: &Arc<AppState>,
    body: &serde_json::Value,
    _headers: &HeaderMap,
) -> Option<Response> {
    let hash = body.get("hash").and_then(|v| v.as_str()).unwrap_or("");
    let content_path = body.get("path").and_then(|v| v.as_str()).unwrap_or("");
    let pathname = url::Url::parse(&format!("http://x/{content_path}"))
        .map(|u| u.path().trim_start_matches('/').to_string())
        .unwrap_or_default();
    let rel = if pathname.is_empty() || pathname.ends_with('/') {
        format!("{pathname}index.html")
    } else {
        pathname
    };

    // Auth ladder: revoked > invalidated > valid_hashes.json array fallback.
    let revoked = state
        .store
        .read_document(&state.data_dir().join("revoked.json"), json!({}))
        .get(hash)
        .cloned();
    let invalidated = state
        .store
        .read_document(&state.data_dir().join("invalidated.json"), json!({}))
        .get(hash)
        .cloned();
    let revoked = revoked.map(|v| v.as_bool().unwrap_or(true));
    let invalidated = invalidated.map(|v| v.as_bool().unwrap_or(false));
    if revoked == Some(true) {
        return Some(json_response(
            200,
            json!({
                "content": "<!DOCTYPE html><html><head><title>403</title></head><body>Access Revoked</body></html>",
                "revoked": true,
            }),
        ));
    }
    if invalidated == Some(true) {
        return Some(json_response(
            200,
            json!({
                "content": "<!DOCTYPE html><html><head><title>403</title></head><body>Access Revoked</body></html>",
                "revoked": true,
            }),
        ));
    }

    // Valid-hashes fallback.
    let valid_hashes = state
        .store
        .read_document(&state.data_dir().join("valid_hashes.json"), json!([]));
    let hash_ok = mitch_lib::auth::valid_id(hash, &state.id_secret)
        && revoked.is_none()
        && invalidated != Some(true);
    if !hash_ok
        && !valid_hashes
            .as_array()
            .map(|a| a.contains(&json!(hash)))
            .unwrap_or(false)
    {
        return Some(json_response(
            200,
            json!({
                "content": "<!DOCTYPE html><html><head><title>401</title></head><body>Not enrolled</body></html>",
            }),
        ));
    }

    // Path safety.
    let webroot = state.cfg.base_dir.join("webserver");
    let Some(file_path) = crate::static_files::safe_webroot_path(&webroot, &format!("/{rel}"))
    else {
        return Some(json_response(
            200,
            json!({
                "content": "<!DOCTYPE html><html><head><title>403</title></head><body>Forbidden</body></html>",
            }),
        ));
    };
    if rel.starts_with("simulate/") {
        return Some(json_response(
            200,
            json!({
                "content": "<!DOCTYPE html><html><head><title>410</title></head><body>Gone</body></html>",
            }),
        ));
    }
    let Ok(html) = std::fs::read_to_string(&file_path) else {
        return Some(json_response(
            200,
            json!({
                "content": "<!DOCTYPE html><html><head><title>404</title></head><body>Not found</body></html>",
            }),
        ));
    };

    // Injection ladder: IS_PREMIUM (canvas/chess-bot only), sync.js, assistant.js, broadcast.js, agree_footer.
    let mut html = html;
    let is_canvas_or_chess = rel.starts_with("canvas/") || rel.starts_with("games/chess-bot/");
    if is_canvas_or_chess && !html.contains("IS_PREMIUM") {
        let premium = is_premium_email(state, hash);
        html = html.replacen(
            "</head>",
            &format!("<script>var IS_PREMIUM = {premium};</script>\n</head>"),
            1,
        );
    }
    if !html.contains("/sync.js") {
        if let Some(idx) = html.rfind("</body>") {
            html = format!(
                "{}<script src=\"/sync.js\" defer></script>{}",
                &html[..idx],
                &html[idx..]
            );
        }
    }
    if !html.contains("/assistant.js") && !rel.starts_with("encrypt/") {
        if let Some(idx) = html.rfind("</body>") {
            html = format!(
                "{}<script src=\"/assistant.js\" defer></script>{}",
                &html[..idx],
                &html[idx..]
            );
        }
    }
    if !html.contains("/broadcast.js") {
        if let Some(idx) = html.rfind("</body>") {
            html = format!(
                "{}<script src=\"/broadcast.js?v=4\" defer></script>{}",
                &html[..idx],
                &html[idx..]
            );
        }
    }
    if !html.contains("_agree_footer") {
        let footer = "<div id=\"_agree_footer\" style=\"position:fixed;bottom:5px;left:0;right:0;text-align:center;pointer-events:none;z-index:2147483647;font-size:.65rem;color:rgba(255,255,255,.15);\">By using mitch.pro you agree to the <a href=\"/use-agreement.html\" style=\"color:rgba(255,255,255,.15);pointer-events:all;\" target=\"_blank\">use agreement</a>.</div>";
        match html.rfind("</body>") {
            Some(idx) => html = format!("{}{}{}", &html[..idx], footer, &html[idx..]),
            None => html = format!("{html}{footer}"),
        }
    }

    let featured = state
        .store
        .read_document(&state.data_dir().join("featured_game.json"), json!(""))
        .as_str()
        .unwrap_or("")
        .to_string();
    Some(json_response(
        200,
        json!({ "content": html, "featured": featured }),
    ))
}

fn is_premium_email(state: &Arc<AppState>, hash: &str) -> bool {
    // The hash IS the sid: resolve to email, then the full premium ladder.
    let Some(email) = mitch_lib::auth::email_from_sid(&state.store, &state.id_secret, hash) else {
        return false;
    };
    mitch_lib::auth::is_premium_email(&state.store, &email)
}

fn json_response(code: u16, obj: serde_json::Value) -> Response {
    crate::errors::json_resp(code, obj)
}

pub async fn ping(
    state: &Arc<AppState>,
    body: &serde_json::Value,
    headers: &HeaderMap,
) -> Option<Response> {
    let cookie_header = headers
        .get(axum::http::header::COOKIE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    let cookies = mitch_lib::auth::get_cookies_from_header_value(
        cookie_header,
        &state.store,
        &state.id_secret,
        std::env::var("NODE_ENV").unwrap_or_default() == "test",
    );
    let id = body
        .get("id")
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .unwrap_or_else(|| cookies.auth_sid());
    let mut page = body
        .get("page")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    if page.starts_with("/proxy/gamemonetize/") {
        page = format!(
            "https://html5.gamemonetize.co/{}",
            &page["/proxy/gamemonetize/".len()..]
        );
    }
    let category = body
        .get("category")
        .and_then(|v| v.as_str())
        .unwrap_or("Utilities")
        .to_string();

    // Update global game stats.
    let stats_file = state.data_dir().join("global_game_stats.json");
    if page.starts_with("https://html5.gamemonetize.co/") || page.starts_with("/games/") {
        let normalized = normalize_game_page(&page);
        if !normalized.is_empty() {
            let mut stats = state.store.read_document(&stats_file, json!({}));
            if let Some(map) = stats.as_object_mut() {
                *map.entry(normalized).or_insert(json!(0)) =
                    json!(map.get(&normalized).and_then(|v| v.as_u64()).unwrap_or(0) + 1);
            }
            let _ = state.store.write_document(&stats_file, &stats);
        }
    }

    // Session log (capped at 50000).
    let session_file = state.data_dir().join("sessions.json");
    let mut sessions = state.store.read_document(&session_file, json!([]));
    if let Some(arr) = sessions.as_array_mut() {
        arr.push(json!({ "id": id, "timestamp": now_millis_str() }));
        if arr.len() > 50000 {
            let excess = arr.len() - 50000;
            arr.drain(0..excess);
        }
        let _ = state.store.write_document(&session_file, &sessions);
    }

    // Resolve email for presence/coins (only when sid is valid).
    let email = if !id.is_empty() && mitch_lib::auth::valid_id(&id, &state.id_secret) {
        mitch_lib::auth::email_from_sid(&state.store, &state.id_secret, &id)
    } else {
        None
    };

    // Playtime stats + ping reward for the email (server.js:15663-15682).
    if let Some(ref em) = email {
        let norm = mitch_lib::auth::normalize_email(em);
        let stats_file = state.data_dir().join("user_stats.json");
        let mut stats = state.store.read_document(&stats_file, json!({}));
        if let Some(map) = stats.as_object_mut() {
            let user = map.entry(norm.clone()).or_insert(json!({}));
            if let Some(u) = user.as_object_mut() {
                let playtime = u.entry("playtime").or_insert(json!({}));
                if let Some(pt) = playtime.as_object_mut() {
                    let cat_entry = pt.entry(category.clone()).or_insert(json!(0));
                    let cur = cat_entry.as_i64().unwrap_or(0);
                    *cat_entry = json!(cur + 1);
                }
                // last_ping_reward: 0.25 coins per 60s (server.js:15668-15673).
                let now = now_millis() as f64;
                let last_reward = u
                    .get("last_ping_reward")
                    .and_then(|v| v.as_f64())
                    .unwrap_or(0.0);
                if now - last_reward >= 60_000.0 {
                    mitch_lib::coins::add_coins(
                        &state.store,
                        state.data_dir(),
                        em,
                        0.25,
                        state.coin_multiplier(),
                        "",
                    );
                    u.insert("last_ping_reward".into(), json!(now));
                }
                if now
                    - u.get("last_active_at")
                        .and_then(|v| v.as_f64())
                        .unwrap_or(0.0)
                    >= 10_000.0
                {
                    u.insert("last_active_at".into(), json!(now));
                }
            }
        }
        let _ = state.store.write_document(&stats_file, &stats);
        let _ = norm;
    }

    // Presence leg (server.js:15617-15639): the playingGame ladder keyed off
    // the lowercased page, then touchUserPresence.
    if let Some(ref em) = email {
        let page_lower = page.to_lowercase();
        let playing_game = if page_lower.contains("/games/chess/") {
            "Chess".to_string()
        } else if page_lower.contains("/games/casino/") || page_lower.contains("/casino/") {
            "Casino".to_string()
        } else if page_lower.contains("/canvas/") {
            "Canvas".to_string()
        } else if page_lower.contains("/encrypt.html")
            || page_lower.contains("/encrypt/")
            || page_lower.contains("/matrix/")
        {
            "Chat".to_string()
        } else if page_lower.contains("/games/") {
            match regex::Regex::new(r"/games/([^/]+)").ok().and_then(|re| {
                re.captures(&page)
                    .and_then(|c| c.get(1))
                    .map(|m| m.as_str().to_string())
            }) {
                Some(m) => m,
                None => "Games".to_string(),
            }
        } else {
            String::new()
        };
        let playing = if playing_game.is_empty() {
            page.clone()
        } else {
            playing_game
        };
        crate::ws::touch_user_presence(state, em, &playing);
    }

    // `/api/ping`'s challenge list (server.js:15683-15689): filters
    // `c.to === normalizeEmail(em)` over the cvChallenges map — which is
    // provably always empty (the /challenge handler never stores), so this
    // stays [] in practice; kept for structural fidelity. Note the JS maps
    // `type: "c".type` — undefined, so the key is dropped by JSON.stringify.
    let challenges = if let Some(ref em) = email {
        let norm = mitch_lib::auth::normalize_email(em);
        let chs = state
            .cv_challenges
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        chs.values()
            .filter(|c| mitch_lib::jsval::string_of(c.get("to")) == norm)
            .map(|c| {
                let mut m = serde_json::Map::new();
                if let Some(v) = c.get("from") {
                    m.insert("from".into(), v.clone());
                }
                if let Some(v) = c.get("id") {
                    m.insert("id".into(), v.clone());
                }
                Value::Object(m)
            })
            .collect::<Vec<_>>()
    } else {
        Vec::new()
    };

    Some(json_response(
        200,
        json!({ "success": true, "challenges": challenges }),
    ))
}

fn normalize_game_page(page: &str) -> String {
    let mut p = page.to_string();
    // Strip origin prefix.
    for origin in ["https://mitch.pro", "https://mitchdog.com"] {
        if p.starts_with(origin) {
            p = p[origin.len()..].to_string();
        }
    }
    // Unmangle proxy prefix back to the external URL.
    if p.starts_with("/proxy/gamemonetize/") {
        p = format!(
            "https://html5.gamemonetize.co/{}",
            &p["/proxy/gamemonetize/".len()..]
        );
    }
    // Count only game pages.
    if !p.starts_with("https://html5.gamemonetize.co/") && !p.starts_with("/games/") {
        return String::new();
    }
    if p.ends_with("/index.html") {
        p = p.trim_end_matches("/index.html").to_string();
    }
    if !p.ends_with('/') {
        p.push('/');
    }
    p
}

fn now_millis() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn now_millis_str() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis().to_string())
        .unwrap_or_default()
}
