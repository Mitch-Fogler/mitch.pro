//! The coins economy data layer — port of server.js's loadCoins/saveCoins/
//! getCoins/addCoins (2976-3005), addCoinGiftNotice (3083-3100), and
//! addAdminNotification (3102-3123).
//!
//! Contract:
//! - coins.json maps normalized email → f64 balance (toFixed(4) rounding).
//! - addCoins: positive amounts are multiplied by the global coin multiplier
//!   (raised to at least 2.0 during a personal happy hour), negative amounts
//!   pass through unmultiplied. Balances round to 4 decimals (JS toFixed).
//! - Positive amounts also bump `lifetime_earned` in user_stats.json.
//! - Every change appends a TSV line to logs/coins.log.
//! - coin_gifts.json maps normalized email → array of notices (capped 50,
//!   newest first via unshift).

use crate::auth::normalize_email;
use crate::data::DataStore;
use serde_json::{json, Value};
use std::path::Path;

/// `loadCoins()` / `saveCoins()` — the JS keeps coinsCache in memory; every
/// write goes straight to disk through saveJson, so read-through works.
pub fn load_coins(store: &DataStore, data_dir: &Path) -> Value {
    store.read_document(&data_dir.join("coins.json"), json!({}))
}

pub fn save_coins(store: &DataStore, data_dir: &Path, coins: &Value) {
    let _ = store.write_document(&data_dir.join("coins.json"), coins);
}

/// `getCoins(email)` — 0 for empty email or unknown user.
pub fn get_coins(store: &DataStore, data_dir: &Path, email: &str) -> f64 {
    if email.is_empty() {
        return 0.0;
    }
    let norm = normalize_email(email);
    load_coins(store, data_dir)
        .get(&norm)
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0)
}

/// `globalCoinMultiplier` default (server.js:1159).
pub const DEFAULT_COIN_MULTIPLIER: f64 = 1.0;

/// `addCoins(email, amount, reason)` — server.js:2979-3005.
/// `multiplier` is `globalCoinMultiplier` at call time; `personal_happy_hour`
/// is read from user_stats.json (positive amounts only, minimum 2.0x).
pub fn add_coins(
    store: &DataStore,
    data_dir: &Path,
    email: &str,
    amount: f64,
    multiplier: f64,
    reason: &str,
) {
    if email.is_empty() {
        return;
    }
    let norm = normalize_email(email);
    let mut coins = load_coins(store, data_dir);
    let mut stats = store.read_document(&data_dir.join("user_stats.json"), json!({}));

    let personal_hh = stats
        .get(&norm)
        .and_then(|s| s.get("personal_happy_hour_until"))
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0)
        > now_millis() as f64;
    let mult = if personal_hh {
        multiplier.max(2.0)
    } else {
        multiplier
    };
    let adjusted = if amount > 0.0 { amount * mult } else { amount };
    let before = coins.get(&norm).and_then(|v| v.as_f64()).unwrap_or(0.0);
    let after = js_round4(before + adjusted);
    if let Some(map) = coins.as_object_mut() {
        map.insert(norm.clone(), json!(after));
    }
    save_coins(store, data_dir, &coins);

    // Track lifetime earned in stats.
    if amount > 0.0 {
        let entry = stats
            .as_object_mut()
            .map(|m| m.entry(norm.clone()).or_insert(json!({})))
            .cloned()
            .unwrap_or(json!({}));
        let lifetime = entry
            .get("lifetime_earned")
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0);
        if let Some(map) = stats.as_object_mut() {
            map.insert(
                norm.clone(),
                json!({ "lifetime_earned": lifetime + adjusted }),
            );
        }
        let _ = store.write_document(&data_dir.join("user_stats.json"), &stats);
    }

    // Append to coin log (JS parity: silent on failure).
    let ts = js_iso_date();
    let sign = if adjusted >= 0.0 { "+" } else { "" };
    let line = format!(
        "{ts}\t{norm}\t{sign}{:.4}\t{:.4} -> {:.4}\t{}\n",
        adjusted,
        before,
        after,
        if reason.is_empty() {
            "unspecified"
        } else {
            reason
        }
    );
    let logs_dir = data_dir.parent().unwrap_or(data_dir).join("logs");
    let _ = std::fs::create_dir_all(&logs_dir);
    let _ = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(logs_dir.join("coins.log"))
        .and_then(|mut f| std::io::Write::write_all(&mut f, line.as_bytes()));
}

/// `addCoinGiftNotice(targetEmail, amount, adminEmail, reason)` — 3083-3100.
pub fn add_coin_gift_notice(
    store: &DataStore,
    data_dir: &Path,
    target_email: &str,
    amount: f64,
    admin_email: &str,
    reason: &str,
) -> Option<Value> {
    let norm = normalize_email(target_email);
    if norm.is_empty() {
        return None;
    }
    let file = data_dir.join("coin_gifts.json");
    let mut gifts = store.read_document(&file, json!({}));
    let map = gifts.as_object_mut()?;
    let notices = map
        .entry(norm.clone())
        .or_insert_with(|| json!([]))
        .as_array_mut()
        .cloned()
        .unwrap_or_default();
    let notice = json!({
        "id": crate::crypto::random_bytes_hex(12),
        "amount": amount,
        "from": if admin_email.is_empty() { "admin" } else { admin_email },
        "reason": if reason.is_empty() { "admin gift" } else { reason },
        "ts": now_millis(),
        "read": false,
    });
    let mut next = Vec::with_capacity(notices.len() + 1);
    next.push(notice.clone());
    next.extend(notices.into_iter().take(49));
    map.insert(norm, json!(next));
    let _ = store.write_document(&file, &gifts);
    Some(notice)
}

/// `addAdminNotification(targetEmail, title, message, adminEmail, batchId, url)`
/// — server.js:3102-3123. `kind: 'admin_notice'` rows in coin_gifts.json.
#[allow(clippy::too_many_arguments)] // mirrors the JS signature
pub fn add_admin_notification(
    store: &DataStore,
    data_dir: &Path,
    target_email: &str,
    title: &str,
    message: &str,
    admin_email: &str,
    batch_id: &str,
    url: &str,
) -> Option<Value> {
    let norm = normalize_email(target_email);
    if norm.is_empty() {
        return None;
    }
    let file = data_dir.join("coin_gifts.json");
    let mut gifts = store.read_document(&file, json!({}));
    let map = gifts.as_object_mut()?;
    let notices = map
        .entry(norm.clone())
        .or_insert_with(|| json!([]))
        .as_array_mut()
        .cloned()
        .unwrap_or_default();
    let clean_path = if url.starts_with('/') {
        url.to_string()
    } else if url.is_empty() {
        "/".to_string()
    } else {
        format!("/{url}")
    };
    let notice = json!({
        "id": crate::crypto::random_bytes_hex(12),
        "kind": "admin_notice",
        "title": if title.is_empty() { "Admin notification" } else { title },
        "message": message,
        "from": if admin_email.is_empty() { "admin" } else { admin_email },
        "source": "mitchdog.com",
        "url": clean_path,
        "batchId": batch_id,
        "ts": now_millis(),
        "read": false,
    });
    let mut next = Vec::with_capacity(notices.len() + 1);
    next.push(notice.clone());
    next.extend(notices.into_iter().take(49));
    map.insert(norm, json!(next));
    let _ = store.write_document(&file, &gifts);
    Some(notice)
}

fn now_millis() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// `new Date().toISOString()` — `YYYY-MM-DDTHH:MM:SS.sssZ`, UTC, no time crate.
pub fn js_iso_date() -> String {
    let millis = now_millis();
    let days = millis.div_euclid(86_400_000);
    let secs = millis.rem_euclid(86_400_000) / 1000;
    let ms = millis.rem_euclid(1000);
    // Civil-from-days (Howard Hinnant's algorithm).
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    format!(
        "{y:04}-{m:02}-{d:02}T{:02}:{:02}:{:02}.{ms:03}Z",
        secs / 3600,
        (secs % 3600) / 60,
        secs % 60
    )
}

/// JS `(x).toFixed(4)` as a number — round-half-away-from-zero to 4 places.
fn js_round4(x: f64) -> f64 {
    let scaled = x * 10000.0;
    let rounded = if scaled >= 0.0 {
        (scaled + 0.5).floor()
    } else {
        (scaled - 0.5).ceil()
    };
    rounded / 10000.0
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn temp_store(tag: &str) -> (std::path::PathBuf, std::path::PathBuf, DataStore) {
        let base = std::env::temp_dir().join(format!(
            "mitch-lib-coins-test-{tag}-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(base.join("data")).unwrap();
        let store = DataStore::open(&base, &base.join("data")).unwrap();
        // Helpers take the DATA dir; tests return both for convenience.
        (base.clone(), base.join("data"), store)
    }

    #[test]
    fn add_coins_rounds_to_four_decimals() {
        let (base, data, store) = temp_store("round");
        add_coins(&store, &data, "A.B+x@mitch.pro", 10.0, 1.0, "test");
        let norm = normalize_email("a.b+x@mitch.pro");
        let coins = load_coins(&store, &data);
        assert_eq!(coins.get(&norm).and_then(|v| v.as_f64()), Some(10.0));
        // Multiplier applies to positive amounts.
        add_coins(&store, &data, "ab@student.rjuhsd.us", 3.0, 2.0, "");
        let coins = load_coins(&store, &data);
        assert_eq!(coins.get(&norm).and_then(|v| v.as_f64()), Some(16.0));
        // Negative amounts skip the multiplier.
        add_coins(&store, &data, "ab@student.rjuhsd.us", -5.0, 2.0, "burn");
        let coins = load_coins(&store, &data);
        assert_eq!(coins.get(&norm).and_then(|v| v.as_f64()), Some(11.0));
        assert_eq!(get_coins(&store, &data, "ab@student.rjuhsd.us"), 11.0);
        // lifetime_earned tracked in user_stats for positive amounts
        // (multiplier-adjusted: 10 + 3×2.0).
        let stats = store.read_document(&data.join("user_stats.json"), json!({}));
        assert_eq!(
            stats
                .get(&norm)
                .and_then(|s| s.get("lifetime_earned"))
                .and_then(|v| v.as_f64()),
            Some(16.0)
        );
        std::fs::remove_dir_all(base).ok();
    }

    #[test]
    fn admin_notices_land_in_coin_gifts() {
        let (base, data, store) = temp_store("notice");
        let n = add_admin_notification(
            &store,
            &data,
            "user@mitch.pro",
            "Hi",
            "msg",
            "admin@mitch.pro",
            "batch1",
            "",
        )
        .unwrap();
        assert_eq!(n.get("kind").and_then(|v| v.as_str()), Some("admin_notice"));
        assert_eq!(
            n.get("source").and_then(|v| v.as_str()),
            Some("mitchdog.com")
        );
        let gifts = store.read_document(&data.join("coin_gifts.json"), json!({}));
        let mine = gifts
            .get(normalize_email("user@mitch.pro").as_str())
            .and_then(|v| v.as_array())
            .unwrap();
        assert_eq!(mine.len(), 1);
        // Coin gift notices cap at 50, newest first.
        for i in 0..55 {
            add_coin_gift_notice(&store, &data, "user@mitch.pro", i as f64, "admin", "");
        }
        let gifts = store.read_document(&base.join("data/coin_gifts.json"), json!({}));
        let mine = gifts
            .get(normalize_email("user@mitch.pro").as_str())
            .and_then(|v| v.as_array())
            .unwrap();
        assert_eq!(mine.len(), 50);
        assert_eq!(mine[0].get("amount").and_then(|v| v.as_f64()), Some(54.0));
        std::fs::remove_dir_all(base).ok();
    }
}
