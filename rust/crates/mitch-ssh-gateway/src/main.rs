//! mitch-ssh-gateway — Rust port of `ssh-gateway/server.js` (plan Step 3).
//!
//! Protocol contract (byte-for-byte with the JS gateway):
//! - Plain WS server on 0.0.0.0:$PORT (default 6820).
//! - Inbound `{type:'connect', host, port, username, cols, rows,
//!   privateKey?|password?, passphrase?}` — secrets are consumed by auth and
//!   never logged (the JS nulls the payload/opts after building them).
//! - Outbound `{type:'connected'}` | `{type:'error', message}` |
//!   `{type:'data', data}`.
//! - Inbound `{type:'data', data}` → shell stdin; `{type:'resize', rows,
//!   cols}` → PTY window change. Term: `xterm-256color`. Shell close → ws
//!   close; ws close → session teardown.
//! - Errors mirror the JS strings where the protocol defines them:
//!   "Invalid JSON", "Missing message type", "Already connected",
//!   "host and username are required". Auth/shell failure text comes from the
//!   SSH layer and may differ slightly from ssh2's wording.

use futures_util::{SinkExt, StreamExt};
use serde_json::json;
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::WebSocketStream;

type Ws = WebSocketStream<tokio::net::TcpStream>;

/// russh client handler: accept all server host keys — parity with ssh2's
/// accept-all default in the JS gateway (the gateway only dials
/// operator-designated admin hosts over an internal network).
struct AcceptAllKeys;

impl russh::client::Handler for AcceptAllKeys {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        _server_public_key: &russh::keys::PublicKeyOrCertificate,
    ) -> Result<bool, Self::Error> {
        Ok(true)
    }
}

/// Port of the JS `connect` handling: authenticate + open a PTY shell.
/// Returns the open channel; on failure the error text becomes the WS error
/// frame.
/// Returns (session handle, channel) — the Handle must stay alive for the
/// session's driving task to keep delivering channel output.
async fn open_shell(
    payload: &serde_json::Value,
) -> Result<
    (
        russh::client::Handle<AcceptAllKeys>,
        russh::Channel<russh::client::Msg>,
    ),
    String,
> {
    let host = payload["host"].as_str().unwrap_or("").trim().to_string();
    let port = payload["port"].as_u64().unwrap_or(22).min(u16::MAX as u64) as u16;
    let username = payload["username"]
        .as_str()
        .unwrap_or("")
        .trim()
        .to_string();
    let cols = payload["cols"].as_u64().unwrap_or(80) as u32;
    let rows = payload["rows"].as_u64().unwrap_or(24) as u32;

    if host.is_empty() || username.is_empty() {
        return Err("host and username are required".to_string());
    }
    tracing::info!("[ssh-gateway] connect {username}@{host}:{port}");

    let config = Arc::new(russh::client::Config::default());
    let mut session = russh::client::connect(config, (host.as_str(), port), AcceptAllKeys)
        .await
        .map_err(|e| e.to_string())?;

    // Authenticate with whichever secret was provided, then drop it — the JS
    // gateway clears the secrets off the payload/opts right after connect.
    let auth = if let Some(key_text) = payload["privateKey"].as_str() {
        let key = russh::keys::decode_secret_key(key_text, payload["passphrase"].as_str())
            .map_err(|e| format!("bad private key: {e}"))?;
        session
            .authenticate_publickey(
                username.as_str(),
                russh::keys::PrivateKeyWithHashAlg::new(Arc::new(key), None),
            )
            .await
            .map_err(|e| e.to_string())?
    } else if let Some(password) = payload["password"].as_str() {
        session
            .authenticate_password(username.as_str(), password)
            .await
            .map_err(|e| e.to_string())?
    } else {
        return Err("no credentials provided".to_string());
    };
    if !auth.success() {
        return Err("All configured authentication methods failed".to_string());
    }

    let channel = session
        .channel_open_session()
        .await
        .map_err(|e| e.to_string())?;
    channel
        .request_pty(true, "xterm-256color", cols, rows, 0, 0, &[])
        .await
        .map_err(|e| format!("pty request failed: {e}"))?;
    channel
        .request_shell(true)
        .await
        .map_err(|e| format!("shell request failed: {e}"))?;
    Ok((session, channel))
}

/// One WS connection == one session, exactly like the JS gateway. A single
/// task owns both the WS and the SSH channel and selects between them, so
/// there is no shared state to race.
async fn handle_connection(ws: Ws) {
    let (mut sink, mut stream) = ws.split();
    let mut connected = false;

    // Send helper — the JS send() skips silently once the socket is closing.
    macro_rules! send_frame {
        ($v:expr) => {
            if sink.send(Message::text(($v).to_string())).await.is_err() {
                break;
            }
        };
    }

    let mut channel: Option<russh::Channel<russh::client::Msg>> = None;
    let mut session: Option<russh::client::Handle<AcceptAllKeys>> = None;

    loop {
        tokio::select! {
            ws_msg = stream.next(), if true => {
                let Some(Ok(msg)) = ws_msg else { break };
                let Message::Text(text) = msg else { continue };
                let Ok(payload) = serde_json::from_str::<serde_json::Value>(&text) else {
                    send_frame!(json!({"type": "error", "message": "Invalid JSON"}));
                    continue;
                };
                let Some(kind) = payload["type"].as_str() else {
                    send_frame!(json!({"type": "error", "message": "Missing message type"}));
                    continue;
                };
                match kind {
                    "connect" => {
                        tracing::debug!(kind, "ws frame");
                        if connected {
                            send_frame!(json!({"type": "error", "message": "Already connected"}));
                            continue;
                        }
                        let host_empty = payload["host"].as_str().map(str::trim).unwrap_or("").is_empty();
                        let user_empty = payload["username"].as_str().map(str::trim).unwrap_or("").is_empty();
                        if host_empty || user_empty {
                            send_frame!(json!({"type": "error", "message": "host and username are required"}));
                            continue;
                        }
                        connected = true;
                        match open_shell(&payload).await {
                            Ok((handle, ch)) => {
                                send_frame!(json!({"type": "connected"}));
                                session = Some(handle); // keeps the session driver alive
                                channel = Some(ch);
                            }
                            Err(e) => {
                                connected = false;
                                send_frame!(json!({"type": "error", "message": e}));
                            }
                        }
                    }
                    "data" => {
                        tracing::debug!(kind = "data", "ws frame");
                        if let (true, Some(ch)) = (payload["data"].is_string(), channel.as_mut()) {
                            let data = payload["data"].as_str().unwrap_or("");
                            if ch.data(data.as_bytes()).await.is_err() {
                                break;
                            }
                        }
                    }
                    "resize" => {
                        if let Some(ch) = channel.as_mut() {
                            let rows = payload["rows"].as_u64().unwrap_or(24) as u32;
                            let cols = payload["cols"].as_u64().unwrap_or(80) as u32;
                            let _ = ch.window_change(cols, rows, 0, 0).await;
                        }
                    }
                    _ => {}
                }
            }
            // SSH stdout/stderr → WS data frames; shell close → ws close.
            out = async {
                match channel.as_mut() {
                    Some(ch) => ch.wait().await,
                    None => std::future::pending().await,
                }
            } => {
                tracing::debug!(?out, "select out arm fired");
                match out {
                    Some(russh::ChannelMsg::Data { ref data }) => {
                        tracing::debug!(bytes = data.len(), "ssh out data");
                        let data = String::from_utf8_lossy(data);
                        send_frame!(json!({"type": "data", "data": data}));
                    }
                    Some(russh::ChannelMsg::ExtendedData { ref data, .. }) => {
                        tracing::debug!(bytes = data.len(), "ssh out extdata");
                        let data = String::from_utf8_lossy(data);
                        send_frame!(json!({"type": "data", "data": data}));
                    }
                    // Housekeeping (pty/shell Success replies, window
                    // adjustments, exit status…) must NOT close the session.
                    Some(_) => {}
                    // EOF/close from the remote shell → close the ws, like
                    // the JS stream.on('close') handler.
                    None => break,
                }
            }
        }
    }

    // cleanupSession: close the channel, disconnect the session, close the ws.
    if let Some(ch) = channel.as_mut() {
        let _ = ch.close().await;
    }
    if let Some(s) = session.as_mut() {
        let _ = s
            .disconnect(russh::Disconnect::ByApplication, "session closed", "en")
            .await;
    }
    let _ = sink.close().await;
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()),
        )
        .init();
    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(6820);
    let listener = TcpListener::bind(("0.0.0.0", port))
        .await
        .unwrap_or_else(|e| panic!("bind 0.0.0.0:{port}: {e}"));
    tracing::info!("[ssh-gateway] listening on 0.0.0.0:{port}");

    while let Ok((tcp, _addr)) = listener.accept().await {
        match tokio_tungstenite::accept_async(tcp).await {
            Ok(ws) => {
                tokio::spawn(handle_connection(ws));
            }
            Err(e) => tracing::debug!("ws upgrade failed: {e}"),
        }
    }
}
