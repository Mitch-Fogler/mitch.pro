//! `errorPage`, `errResp`, `bannedResponse`, `jsonResp` — byte-faithful ports
//! `errorPage`, `errResp`, `bannedResponse`, `jsonResp` — byte-faithful ports
//! from server.js (canned titles/copy per code, Content-Type only header).
#![allow(clippy::expect_used)] // infallible static responses

use axum::http::header;
use axum::response::Response;

fn error_page(code: u16, title: &str, detail_html: &str) -> String {
    format!(
        "<!DOCTYPE html><html><head><meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n<title>{code} — {title}</title>\n<style>\nbody{{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;\nbackground:#0e0e14;color:#bababa;font-family:system-ui,sans-serif;padding:2rem;}}\n.box{{text-align:center;max-width:420px;}}\n.code{{font-size:5rem;font-weight:800;line-height:1;color:#2a2a38;margin-bottom:.5rem;}}\nh1{{font-size:1.3rem;font-weight:700;color:#e8e6e3;margin:0 0 .75rem;}}\np{{font-size:.9rem;line-height:1.6;color:#888;margin:0 0 1.5rem;}}\np a{{color:#7c6aed;text-decoration:none;}}p a:hover{{text-decoration:underline;}}\ncode{{background:#1a1a24;padding:2px 6px;border-radius:4px;font-size:.85em;color:#a0a0c0;}}\n</style></head><body>\n<div class=\"box\"><div class=\"code\">{code}</div>\n<h1>{title}</h1><p>{detail_html}</p></div>\n</body></html>"
    )
}

#[allow(dead_code)] // used by the ban gate, wired with sessions at Step 6
pub fn html_esc(v: &str) -> String {
    v.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

/// `bannedResponse` — the 403 ban page (wired with sessions at Step 6).
#[allow(dead_code)]
pub fn banned_response(info: Option<(&str, &str)>) -> Response {
    let (reason_text, by) = match info {
        Some((r, b)) => (r.to_string(), b.to_string()),
        None => (
            "This account is banned from the website.".to_string(),
            "site admin".to_string(),
        ),
    };
    let reason = html_esc(&reason_text);
    let by = html_esc(&by);
    let alert_text = serde_json::to_string(&format!(
        "This account is banned from the website. Reason: {reason_text}"
    ))
    .unwrap_or_default()
    .replace('<', "\\u003c");
    let body = format!(
        "<!DOCTYPE html><html><head><meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n<title>Account Banned</title>\n<style>\nbody{{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#111318;color:#f8fafc;font-family:system-ui,sans-serif;padding:24px;}}\n.modal{{width:min(440px,100%);background:#1b1f2a;border:1px solid rgba(248,113,113,.35);border-radius:14px;box-shadow:0 24px 80px rgba(0,0,0,.45);padding:24px;text-align:center;}}\n.badge{{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:999px;background:rgba(239,68,68,.14);color:#fecaca;font-weight:900;margin-bottom:14px;}}\nh1{{font-size:1.35rem;margin:0 0 10px;}}\np{{color:#cbd5e1;line-height:1.5;margin:0 0 12px;font-size:.94rem;}}\n.reason{{background:#111827;border:1px solid rgba(148,163,184,.18);border-radius:10px;padding:12px;margin:14px 0;color:#e5e7eb;text-align:left;}}\n.small{{font-size:.78rem;color:#94a3b8;}}\nbutton{{margin-top:8px;border:0;border-radius:9px;background:#ef4444;color:white;padding:10px 16px;font-weight:700;cursor:pointer;}}\n</style></head><body>\n<div class=\"modal\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"ban-title\">\n  <div class=\"badge\">!</div>\n  <h1 id=\"ban-title\">This account is banned from the website</h1>\n  <p>Your account cannot access mitch.pro right now.</p>\n  <div class=\"reason\"><strong>Reason:</strong><br>{reason}</div>\n  <p class=\"small\">Issued by {by}. Contact site staff if you think this was a mistake.</p>\n  <button onclick=\"location.href='/appeal.html'\">Appeal ban</button>\n</div>\n<script>alert({alert_text});</script>\n</body></html>"
    );
    Response::builder()
        .status(403)
        .header(header::CONTENT_TYPE, "text/html; charset=utf-8")
        .body(axum::body::Body::from(body))
        .expect("static response")
}

fn err_title(code: u16) -> &'static str {
    match code {
        400 => "Bad Request",
        401 => "Not Authorised",
        403 => "Forbidden",
        404 => "Page Not Found",
        405 => "Method Not Allowed",
        429 => "Too Many Requests",
        500 => "Server Error",
        502 => "Bad Gateway",
        503 => "Service Unavailable",
        _ => "Error",
    }
}

fn err_detail(code: u16) -> &'static str {
    match code {
        400 => "The request could not be understood.",
        401 => "You need to be logged in to view this page. <a href=\"/enroll.html\">Request access</a>.",
        403 => "You don't have permission to access this. <a href=\"/\">Go home</a>.",
        404 => "This page doesn't exist. <a href=\"/\">Go home</a>.",
        405 => "That request method isn't allowed here.",
        429 => "You're sending too many requests. Slow down and try again.",
        500 => "Something went wrong on our end. <a href=\"mailto:support@mitch.pro\">Contact support</a> if it keeps happening.",
        502 => "Upstream error. Try again in a moment.",
        503 => "The service is temporarily unavailable. Try again shortly.",
        _ => "An unexpected error occurred.",
    }
}

/// `errResp(code, message, explain)` — explicit pair overrides canned copy.
pub fn err_resp(code: u16, message: Option<&str>, explain: Option<&str>) -> Response {
    let title = message.unwrap_or(err_title(code));
    let detail = explain.unwrap_or(err_detail(code));
    Response::builder()
        .status(code)
        .header(header::CONTENT_TYPE, "text/html; charset=utf-8")
        .body(axum::body::Body::from(error_page(code, title, detail)))
        .expect("static response")
}

/// `jsonResp(code, obj)`.
pub fn json_resp(code: u16, obj: serde_json::Value) -> Response {
    json_resp_str(code, obj.to_string())
}

/// `jsonResp` for a pre-serialized body — used by the game endpoints whose
/// responses carry passthrough session state, so numbers can be rendered with
/// the exact ECMAScript `Number::toString` via `mitch_lib::data::js_stringify`
/// (serde_json would emit `1.0`/`1e22` where JS emits `1`/`1e+22`).
pub fn json_resp_str(code: u16, body: String) -> Response {
    Response::builder()
        .status(code)
        .header(header::CONTENT_TYPE, "application/json")
        .header(
            header::CACHE_CONTROL,
            "private, no-cache, no-store, must-revalidate",
        )
        .header(header::PRAGMA, "no-cache")
        .header(header::VARY, "Cookie")
        .header("x-content-type-options", "nosniff")
        .body(axum::body::Body::from(body))
        .expect("static response")
}
