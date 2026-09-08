//! mitch-mail — Rust port of the mail pipeline (plan Step 2).
//!
//! Collapses the three near-duplicate nodemailer CLIs (`mail/send_email.js`,
//! `mail/noreply_send.js`, `mail/support_send.js`) into one HTTP service on
//! internal port 6902, plus the `mail/imap_watcher.js` loop as a background
//! task still writing `data/team_inbox_cache.json` (identical shape, tmp+rename
//! atomic writes). The JS scripts become shims with nodemailer fallback.
//!
//! Status: scaffold — service lands in plan Step 2.

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()),
        )
        .init();
    tracing::info!(
        "mitch-mail {} scaffold — SMTP/IMAP service lands in plan Step 2",
        mitch_lib::version()
    );
}
