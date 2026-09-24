//! Tor Browser & Onion Gateway proxy route handler
use crate::state::AppState;
use axum::body::Body;
use axum::http::{HeaderMap, Method, Response, StatusCode};
use std::sync::Arc;

pub fn tor_service_url() -> String {
    if let Ok(url) = std::env::var("TOR_SERVICE_URL") {
        if !url.is_empty() {
            return url.trim_end_matches('/').to_string();
        }
    }
    let host = std::env::var("TOR_SERVICE_HOST").unwrap_or_else(|_| {
        if std::env::var("DOCKER_ENV").as_deref() == Ok("1")
            || std::path::Path::new("/.dockerenv").exists()
        {
            "tor-browser".to_string()
        } else {
            "127.0.0.1".to_string()
        }
    });
    format!("http://{host}:6840")
}

pub async fn handle(
    _state: &Arc<AppState>,
    method: &Method,
    path: &str,
    headers: &HeaderMap,
    body_bytes: &[u8],
    search: &str,
) -> Option<Response<Body>> {
    let subpath = if path.starts_with("/api/tor/") {
        path
    } else if path == "/tor/view" {
        "/api/tor/browse"
    } else {
        return None;
    };

    let base = tor_service_url();
    let target = format!("{base}{subpath}{search}");

    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
    {
        Ok(c) => c,
        Err(_) => {
            return Some(
                Response::builder()
                    .status(StatusCode::BAD_GATEWAY)
                    .header("Content-Type", "application/json")
                    .body(Body::from(
                        r#"{"ok":false,"error":"Tor client build failed"}"#,
                    ))
                    .unwrap_or_else(|_| Response::new(Body::empty())),
            )
        }
    };

    let reqwest_m = match method.as_str() {
        "POST" => reqwest::Method::POST,
        "PUT" => reqwest::Method::PUT,
        "DELETE" => reqwest::Method::DELETE,
        _ => reqwest::Method::GET,
    };

    let mut req = client.request(reqwest_m, &target);

    // Forward user identity headers and cookies
    if let Some(cookie) = headers.get("cookie") {
        if let Ok(c) = cookie.to_str() {
            req = req.header("cookie", c);
        }
    }
    if let Some(user_hdr) = headers.get("x-tor-user") {
        if let Ok(u) = user_hdr.to_str() {
            req = req.header("x-tor-user", u);
        }
    }
    if let Some(ct) = headers.get("content-type") {
        if let Ok(c) = ct.to_str() {
            req = req.header("content-type", c);
        }
    }

    if !body_bytes.is_empty() {
        req = req.body(body_bytes.to_vec());
    }

    match req.send().await {
        Ok(resp) => {
            let status = StatusCode::from_u16(resp.status().as_u16()).unwrap_or(StatusCode::OK);
            let mut builder = Response::builder().status(status);

            for (name, val) in resp.headers().iter() {
                let name_s = name.as_str();
                if name_s.eq_ignore_ascii_case("content-length")
                    || name_s.eq_ignore_ascii_case("transfer-encoding")
                    || name_s.eq_ignore_ascii_case("connection")
                {
                    continue;
                }
                builder = builder.header(name_s, val.as_bytes());
            }

            builder = builder.header("Access-Control-Allow-Origin", "*");

            match resp.bytes().await {
                Ok(bytes) => Some(builder.body(Body::from(bytes)).unwrap_or_else(|_| {
                    Response::builder()
                        .status(StatusCode::INTERNAL_SERVER_ERROR)
                        .body(Body::empty())
                        .unwrap_or_else(|_| Response::new(Body::empty()))
                })),
                Err(_) => Some(
                    Response::builder()
                        .status(StatusCode::BAD_GATEWAY)
                        .body(Body::from("Failed to read response from Tor service"))
                        .unwrap_or_else(|_| Response::new(Body::empty())),
                ),
            }
        }
        Err(e) => {
            tracing::warn!("[tor-proxy] Failed to reach Tor microservice at {target}: {e}");
            Some(
                Response::builder()
                    .status(StatusCode::BAD_GATEWAY)
                    .header("Content-Type", "application/json")
                    .body(Body::from(
                        r#"{"ok":false,"error":"Tor service gateway unavailable"}"#,
                    ))
                    .unwrap_or_else(|_| Response::new(Body::empty())),
            )
        }
    }
}
