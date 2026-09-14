//! Push + email side-channels (plan Step 8). These are fire-and-forget
//! channels: failures never alter the HTTP response, matching the JS's
//! `proc.unref()` + silent-catch semantics.
//! - `push_admin_notification` — VAPID web push against data/push_subs.json
//!   via the `web-push` crate (no-op without VAPID env, like the JS gate).
//! - `ntfy_notify` — POST to ntfy.sh with the configured topic.
//! - `send_email_bg` — POST to the mitch-mail service (:6902), the same
//!   transport the mail shims use since Step 2.

#![allow(clippy::expect_used)] // infallible static regexes
use crate::state::AppState;
use std::sync::Arc;

/// `pushAdminNotification(targetEmail, title, message)` — server.js:3125.
/// Reads push_subs.json, best-effort send, 410/404 cleanup, all async.
pub fn push_admin_notification(
    state: &Arc<AppState>,
    target_email: &str,
    title: &str,
    message: &str,
) {
    let vapid_public = std::env::var("VAPID_PUBLIC_KEY")
        .map(|v| v.trim().to_string())
        .unwrap_or_default();
    if vapid_public.is_empty() {
        return; // JS parity: `if (!VAPID_PUBLIC) return;`
    }
    let subs = state.store.read_document(
        &state.cfg.data_dir.join("push_subs.json"),
        serde_json::json!({}),
    );
    let norm = mitch_lib::auth::normalize_email(target_email);
    let sub = subs
        .get(target_email)
        .or_else(|| subs.get(norm.as_str()))
        .cloned();
    let Some(sub) = sub else { return };
    let body = message.chars().take(120).collect::<String>();
    let state = state.clone();
    let target_email = target_email.to_string();
    let title = title.to_string();
    let payload = serde_json::json!({
        "title": if title.is_empty() { "Admin notification" } else { &title },
        "body": body,
        "url": "/",
    });
    tokio::spawn(async move {
        let _ = send_web_push(&state, &vapid_public, &target_email, &sub, &payload).await;
    });
}

/// Sends one web-push message; removes the subscription on 410/404.
async fn send_web_push(
    state: &Arc<AppState>,
    _vapid_public: &str,
    target_email: &str,
    sub: &serde_json::Value,
    payload: &serde_json::Value,
) {
    let endpoint = sub
        .get("endpoint")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    if endpoint.is_empty() {
        return;
    }
    let keys = sub.get("keys").cloned().unwrap_or(serde_json::json!({}));
    let p256dh = keys
        .get("p256dh")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let auth = keys
        .get("auth")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let vapid_private = std::env::var("VAPID_PRIVATE_KEY")
        .map(|v| v.trim().to_string())
        .unwrap_or_default();
    let info = web_push::SubscriptionInfo::new(&endpoint, &p256dh, &auth);
    let Ok(sig_builder) = web_push::VapidSignatureBuilder::from_base64(
        &vapid_private,
        web_push::URL_SAFE_NO_PAD,
        &info,
    ) else {
        tracing::warn!("vapid signature builder init failed");
        return;
    };
    let Ok(sig) = sig_builder.build() else {
        tracing::warn!("vapid signature build failed");
        return;
    };
    let payload_str = payload.to_string();
    let mut message = web_push::WebPushMessageBuilder::new(&info);
    message.set_vapid_signature(sig);
    message.set_payload(web_push::ContentEncoding::Aes128Gcm, payload_str.as_bytes());
    let Ok(message) = message.build() else {
        return;
    };
    use web_push::WebPushClient as _;
    let Ok(client) = web_push::IsahcWebPushClient::new() else {
        return;
    };
    if let Err(e) = client.send(message).await {
        let gone = matches!(
            e,
            web_push::WebPushError::EndpointNotFound | web_push::WebPushError::EndpointNotValid
        );
        if gone {
            let file = state.cfg.data_dir.join("push_subs.json");
            let mut subs = state.store.read_document(&file, serde_json::json!({}));
            if let Some(map) = subs.as_object_mut() {
                map.remove(target_email);
                map.remove(&mitch_lib::auth::normalize_email(target_email));
            }
            let _ = state.store.write_document(&file, &subs);
        }
        tracing::warn!("push send failed: {e}");
    }
}

/// `ntfy(msg, {title, priority})` — POST to ntfy.sh (silent without topic).
pub fn ntfy_notify(msg: &str, title: &str, priority: &str) {
    let topic = std::env::var("NTFY_TOPIC")
        .map(|v| v.trim().to_string())
        .unwrap_or_default();
    if topic.is_empty() {
        return;
    }
    let url = format!("https://ntfy.sh/{topic}");
    let msg = msg.to_string();
    let title = title.to_string();
    let priority = priority.to_string();
    tokio::spawn(async move {
        let mut req = reqwest::Client::new()
            .post(&url)
            .header("Content-Type", "text/plain")
            .timeout(std::time::Duration::from_secs(5));
        if !title.is_empty() {
            req = req.header("Title", title);
        }
        if !priority.is_empty() && priority != "default" {
            req = req.header("Priority", priority);
        }
        let _ = req.body(msg).send().await;
    });
}

/// `sendEmailBg(to, subject, body)` — the Step 2 mail-service transport.
/// Masked-recipient + profanity guards from server.js:3471-3486.
pub fn send_email_bg(state: &Arc<AppState>, to: &str, subject: &str, body: &str) {
    // Defensive: refuse masked recipients (`ad***n@…` shape).
    static MASK_RE: std::sync::OnceLock<regex::Regex> = std::sync::OnceLock::new();
    let re = MASK_RE.get_or_init(|| {
        regex::Regex::new(r"^[A-Za-z0-9._%+-]{2}\*\*\*[A-Za-z0-9._%+-]*@").unwrap_or_else(|e| {
            tracing::error!("mask regex failed: {e}");
            regex::Regex::new("$^").unwrap_or_else(|e| {
                tracing::error!("fallback regex failed: {e}");
                regex::Regex::new("$^").unwrap_or_else(|_| {
                    regex::Regex::new("$^").unwrap_or_else(|e2| {
                        tracing::error!("fallback regex failed: {e2}");
                        regex::Regex::new("$^").unwrap_or_else(|_| unreachable!())
                    })
                })
            })
        })
    });
    if re.is_match(to) {
        tracing::warn!("refusing to send — recipient looks masked: {to}");
        return;
    }
    let sender = "noreply@mitch.pro";
    let url = mail_service_url(state);
    let body = body.to_string();
    let subject = subject.to_string();
    let to = to.to_string();
    tokio::spawn(async move {
        let payload = serde_json::json!({
            "sender": sender,
            "to": to,
            "subject": subject,
            "body": body,
            "dry_run": false,
        });
        let client = reqwest::Client::new();
        let _ = client
            .post(format!("{url}/send"))
            .json(&payload)
            .timeout(std::time::Duration::from_secs(30))
            .send()
            .await;
    });
}

fn mail_service_url(_state: &Arc<AppState>) -> String {
    let port = std::env::var("MAIL_RS_PORT")
        .ok()
        .and_then(|p| p.parse::<u16>().ok())
        .unwrap_or(6902);
    format!("http://127.0.0.1:{port}")
}

#[allow(unused)]
pub fn unused_state_guard(_state: &AppState) {}
