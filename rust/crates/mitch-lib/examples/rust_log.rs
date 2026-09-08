//! CLI logger for the rewrite's progress channel: appends one entry to the
//! shared `app_logs` table under category `rust-rewrite`, visible in the
//! admin panel's log viewer (GET /api/admin/app-logs).
//!
//! Usage: cargo run -q -p mitch-lib --example rust_log -- <level> <message...>
//! Base dir is cwd (the repo), like every JS entry point; MITCH_BASE overrides.
//!
//! Debug tool: expect()-based error handling is intentional here.
#![allow(clippy::unwrap_used, clippy::expect_used)]

#[tokio::main]
async fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let (level, message) = match args.len() {
        0 => {
            eprintln!("usage: rust_log <level> <message...>  (or rust_log <message...> for info)");
            std::process::exit(1);
        }
        1 => ("info", args[0].clone()),
        _ => (args[0].as_str(), args[1..].join(" ")),
    };

    let base = std::env::var("MITCH_BASE")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| std::env::current_dir().unwrap_or_default());
    let data_dir = std::env::var("DATA_DIR")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| base.join("data"));
    let store = std::sync::Arc::new(
        mitch_lib::data::DataStore::open(&base, &data_dir).expect("open data store"),
    );
    mitch_lib::log::log_rewrite(&store, level, &message).await;
    println!("[rust-rewrite] {level}: {message}");
}
