//! DM/group chat expiry logic (server.js:6179-6249) — shared by the
//! notifications group and the Step 11 DM/pickle-club message loops.

use crate::auth;
use crate::data::DataStore;
use crate::jsval;
use serde_json::{json, Value};
use std::path::Path;

/// `CHAT_EXPIRY_OPTIONS` (server.js:6179).
pub const CHAT_EXPIRY_OPTIONS: [i64; 4] = [30_000, 60_000, 300_000, 3_600_000];

/// `dmExpiryKey` (server.js:6180) — sorted normalized pair.
pub fn dm_expiry_key(a: &str, b: &str) -> String {
    let mut parts = [auth::normalize_email(a), auth::normalize_email(b)];
    parts.sort();
    format!("dm:{}|{}", parts[0], parts[1])
}

/// `groupExpiryKey` (server.js:6183).
pub fn group_expiry_key(group_id: &str) -> String {
    format!("group:{}", group_id)
}

/// `getChatExpiry` (server.js:6186) — only the four canonical windows count.
pub fn get_chat_expiry(store: &DataStore, data_dir: &Path, key: &str) -> i64 {
    if key.is_empty() {
        return 0;
    }
    let all = store.read_document(&data_dir.join("chat_expiry.json"), json!({}));
    let v = all.get(key).and_then(jsval::number).unwrap_or(0.0) as i64;
    if CHAT_EXPIRY_OPTIONS.contains(&v) {
        v
    } else {
        0
    }
}

/// `getExpiryForMsg` (server.js:6222) — `spc:` prefix picks the
/// pickle-club variant of the same chat keys.
pub fn get_expiry_for_msg(store: &DataStore, data_dir: &Path, m: &Value, is_pickle: bool) -> i64 {
    let pfx = if is_pickle { "spc:" } else { "" };
    if m.get("kind").and_then(|v| v.as_str()) == Some("group") {
        let group_id = m.get("groupId").map(jsval::string).unwrap_or_default();
        get_chat_expiry(
            store,
            data_dir,
            &format!("{}{}", pfx, group_expiry_key(&group_id)),
        )
    } else {
        let from = m.get("from").and_then(|v| v.as_str()).unwrap_or("");
        let to = m.get("to").and_then(|v| v.as_str()).unwrap_or("");
        get_chat_expiry(
            store,
            data_dir,
            &format!("{}{}", pfx, dm_expiry_key(from, to)),
        )
    }
}

/// `isDmMessageRead` (server.js:6213) — groups read when anyone besides the
/// sender has read; DMs via `read === true` or a truthy `readAt`.
pub fn is_dm_message_read(m: &Value) -> bool {
    if m.get("kind").and_then(|v| v.as_str()) == Some("group") {
        let sender = auth::normalize_email(m.get("from").and_then(|v| v.as_str()).unwrap_or(""));
        m.get("readBy")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .any(|r| auth::normalize_email(r.as_str().unwrap_or("")) != sender)
            })
            .unwrap_or(false)
    } else {
        m.get("read").and_then(|v| v.as_bool()).unwrap_or(false)
            || jsval::truthy(m.get("readAt").unwrap_or(&Value::Null))
    }
}

/// `isMessageExpired` (server.js:6231) — auto-delete only applies AFTER a
/// message has been read.
pub fn is_message_expired(
    store: &DataStore,
    data_dir: &Path,
    m: &Value,
    is_pickle: bool,
    now: i64,
) -> bool {
    if !is_dm_message_read(m) {
        return false;
    }
    let expiry = get_expiry_for_msg(store, data_dir, m, is_pickle);
    let ts = m
        .get("ts")
        .filter(|v| jsval::truthy(v))
        .and_then(jsval::number)
        .unwrap_or(0.0);
    if expiry > 0 {
        let age = now as f64 - ts;
        let expires_at = m
            .get("expiresAt")
            .filter(|v| jsval::truthy(v))
            .and_then(jsval::number);
        let read_at = m
            .get("readAt")
            .filter(|v| jsval::truthy(v))
            .and_then(jsval::number);
        (age >= 3_600_000.0)
            || (age >= expiry as f64)
            || expires_at.map(|e| now as f64 > e).unwrap_or(false)
            || read_at
                .map(|r| now as f64 - r >= expiry as f64)
                .unwrap_or(false)
    } else {
        let expires_at = m
            .get("expiresAt")
            .filter(|v| jsval::truthy(v))
            .and_then(jsval::number);
        expires_at.map(|e| now as f64 > e).unwrap_or(false)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dm_key_sorts_pair() {
        assert_eq!(dm_expiry_key("B@x.com", "a@x.com"), "dm:a@x.com|b@x.com");
    }
}
