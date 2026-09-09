//! Data-layer parity probe (plan Step 5 verification, with
//! `tools/data_parity.js`).
//!
//! Usage: cargo run -q -p mitch-lib --example data_parity -- <base_dir> <mode>
//!   mode "passthrough": read each doc, write the exact stored TEXT back
//!     (JS writeDocument's `typeof data === 'string'` branch).
//!   mode "reserialize": parse each doc, re-emit via js_stringify_pretty
//!     (JS writeDocument's `JSON.stringify(data, null, 2)` branch).
//!
//! The parity script (bun side) writes documents via `lib/data_store.js`,
//! then runs this, then byte-compares the `content` column against the
//! strings JS produced.
//!
//! Debug tool: expect()-based error handling is intentional here.
#![allow(clippy::unwrap_used, clippy::expect_used)]

use mitch_lib::data::DataStore;
use std::path::PathBuf;

fn main() {
    let mut args = std::env::args().skip(1);
    let base = PathBuf::from(args.next().expect("base dir required"));
    let mode = args.next().unwrap_or_else(|| "passthrough".to_string());

    let store = DataStore::open(&base, &base.join("data")).expect("open data store");

    // Discover every json_documents row (bun side wrote them).
    let paths: Vec<String> = store.list_json_document_paths().expect("list paths");

    for path in paths {
        let file = base.join(&path);
        let fallback = serde_json::Value::Null;
        let value = store.read_document(&file, fallback);
        match mode.as_str() {
            "passthrough" => {
                // JS `typeof data === 'string'` branch: stored verbatim.
                if let serde_json::Value::String(text) = &value {
                    store.write_document_raw(&file, text).unwrap();
                } else {
                    panic!("passthrough mode requires string-valued docs: {path}");
                }
            }
            "reserialize" => {
                // JS `JSON.stringify(data, null, 2)` branch: parse + re-emit.
                let text = js_stringify_pretty(&value);
                store
                    .write_document(&file, &serde_json::Value::String(text))
                    .unwrap();
            }
            other => panic!("unknown mode: {other}"),
        }
        println!("rewrote {path}");
    }
    println!("data_parity done");
}

fn js_stringify_pretty(value: &serde_json::Value) -> String {
    mitch_lib::data::js_stringify_pretty(value)
}
