//! mitch-server — the Rust HTTP core for mitch.pro / rjuhsd.school /
//! sexypickleclub.com.
//!
//! `main.rs` only wires: config, State build, router assembly, serve. All
//! handler logic lives in the per-subsystem route modules (one route group per
//! file) and `mitch-lib`. server.js must not be reborn as one big file here.
//!
//! Status: scaffold — hosts/static/auth/routes land in plan Steps 4-14.

use axum::{routing::get, Router};

mod hosts;
mod routes;
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

    let app = Router::new()
        .route("/enroll/", get(|| async { "mitch-server rust scaffold" }))
        .with_state(());

    let port = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(6801_u16);
    let listener = tokio::net::TcpListener::bind(("0.0.0.0", port))
        .await
        .unwrap_or_else(|e| panic!("bind 0.0.0.0:{port}: {e}"));
    tracing::info!("mitch-server (rust scaffold) listening on 0.0.0.0:{port}");
    axum::serve(listener, app)
        .await
        .unwrap_or_else(|e| panic!("serve: {e}"));
}
