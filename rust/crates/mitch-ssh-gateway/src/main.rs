//! mitch-ssh-gateway — Rust port of `ssh-gateway/server.js` (plan Step 3).
//!
//! Protocol contract (must match byte-for-byte):
//! - WS server on 0.0.0.0:6820.
//! - Inbound: `{type:'connect', host, port, username, cols, rows,
//!   privateKey?|password?, passphrase?}` — secrets cleared from the payload
//!   after building connect opts.
//! - Outbound: `{type:'connected'}` | `{type:'error', message}` |
//!   `{type:'data', data}`.
//! - Inbound `{type:'data', data}` → shell stdin; `{type:'resize', rows, cols}`
//!   → PTY window change. Term: `xterm-256color`. Shell close → ws close.
//!
//! Status: scaffold stub — implemented in plan Step 3.

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()),
        )
        .init();
    tracing::info!(
        "mitch-ssh-gateway {} scaffold — WS↔russh port lands in plan Step 3",
        mitch_lib::version()
    );
}
