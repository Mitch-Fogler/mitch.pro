//! mitch-server — the Rust HTTP core for mitch.pro / rjuhsd.school /
//! sexypickleclub.com.
//!
//! `main.rs` only wires: config, State build, router assembly, serve. All
//! handler logic lives in the per-subsystem modules (one concern per file)
//! and `mitch-lib`.
//!
//! Step 4 scope: host routing, static serving, HTML injection pipeline,
//! request prelude, /enroll/ health. Session-dependent pieces are stubbed
//! (Step 6); API routes are later steps.

use axum::extract::State;
use axum::http::Request;
use axum::response::Response;
use axum::Router;
use std::sync::Arc;

mod env_file;
mod errors;
mod handler;
mod hosts;
mod inject;
mod manifests;
mod pipeline;
mod routes;
mod state;
mod static_files;
mod workers;
mod ws;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,tower=warn,hyper=warn".into()),
        )
        .init();

    let cfg = hosts::SiteConfig::load();
    let store = Arc::new(
        mitch_lib::data::DataStore::open(&cfg.base_dir, &cfg.data_dir)
            .unwrap_or_else(|e| panic!("open data store at {}: {e}", cfg.data_dir.display())),
    );
    let state = Arc::new(state::AppState::new(cfg.clone(), store.clone()));

    mitch_lib::log::log_rewrite(
        &store,
        "info",
        "mitch-server (rust) core skeleton listening — host routing, static serving, HTML pipeline ported",
    )
    .await;

    let app: Router = Router::new().fallback(get_any).with_state(state);

    let port = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(6801_u16);
    let listener = tokio::net::TcpListener::bind(("0.0.0.0", port))
        .await
        .unwrap_or_else(|e| panic!("bind 0.0.0.0:{port}: {e}"));
    tracing::info!("mitch-server (rust) listening on 0.0.0.0:{port}");
    axum::serve(listener, app)
        .await
        .unwrap_or_else(|e| panic!("serve: {e}"));
}

/// Every request funnels through the ported flow, exactly like bun's single
/// `handleRequest`.
async fn get_any(
    State(state): State<Arc<state::AppState>>,
    req: Request<axum::body::Body>,
) -> Response {
    let method = req.method().clone();
    let headers = req.headers().clone();
    let uri = req.uri().clone();
    // Read the body (empty for GET/HEAD; bounded for API POSTs).
    let body_bytes = axum::body::to_bytes(req.into_body(), 256 * 1024)
        .await
        .unwrap_or_default();
    handler::handle(state, method, &uri, &headers, &body_bytes).await
}
