//! Canvas state core (server.js:4304-4556) — `canvasPixels`, the derived
//! `canvasChunks` map, `canvasLocks`, the in-memory `canvasHeatmap`, and the
//! per-zone pixel/chunk caches (`zonePixelsMap`/`zoneChunksMap`).
//!
//! Persistence parity with JS:
//! - `canvas_pixels.json` / `canvas_locks.json` / `zones.json` / banned /
//!   reports / bookmarks are `loadJson`/`saveJson` files → the SQLite-backed
//!   `read_document`/`write_document` layer.
//! - The `*_history_*.jsonl` files are `appendFileSync`/`readFileSync` in JS
//!   (server.js:4492, 21728) — they hit REAL disk, never the DB, so the Rust
//!   side uses raw `std::fs` for them too.
//! - `canvasPixels` is an in-memory cache mutated per paint and flushed by a
//!   30s interval (server.js:4544-4545); `canvasHeatmap` is in-memory only
//!   with an hourly 24h sweep (server.js:4788-4793). Both intervals live in
//!   `crate::workers`.
//!
//! Key-order parity: JS objects/Maps iterate in insertion order, so every
//! map here is an order-preserving `serde_json::Map` (workspace uses
//! serde_json `preserve_order`) or an insertion-ordered `Vec`.

// `set_pixel`/`delete_pixel`/`locks`/the reports+bookmarks helpers are wired
// by batches 2-3 (painting, zones, bookmarks); the read batch only exercises
// the load/read paths.
#![allow(dead_code)]

use mitch_lib::data::DataStore;
use serde_json::{json, Map, Value};
use std::path::{Path, PathBuf};
use std::sync::Arc;

/// `CHUNK = 64` (server.js:4437).
pub const CHUNK: f64 = 64.0;

/// `canvasHeatmap` (server.js:4309) — "x,y" -> ts, JS `Map` insertion order.
/// Updates of an existing key keep its position, so a plain Vec with a
/// search-and-keep is the faithful shape.
pub struct CanvasState {
    /// `canvasPixels` (server.js:4312) — "x,y" -> pixel object.
    pub pixels: std::sync::RwLock<Map<String, Value>>,
    /// `canvasChunks` (server.js:4313) — "cx,cy" -> { "x,y": pixel } object.
    /// The inner chunk is a `Value::Object`: serde_json's newer `Map` only
    /// carries the entry/get API at `Map<String, Value>` depth, and an object
    /// value is also what the JS `if (!has(ck)) set(ck, {})` stores.
    pub chunks: std::sync::RwLock<Map<String, Value>>,
    /// `canvasLocks` (server.js:4315) — "x,y" -> { email, painter, expiresAt }.
    pub locks: std::sync::RwLock<Map<String, Value>>,
    /// `canvasHeatmap` — in-memory, never persisted.
    pub heatmap: std::sync::Mutex<Vec<(String, i64)>>,
    /// `zonePixelsMap` (server.js:4372) — zoneId -> pixels object cache.
    pub zone_pixels: std::sync::Mutex<std::collections::HashMap<String, Map<String, Value>>>,
    /// `zoneChunksMap` (server.js:4373) — zoneId -> chunk map cache.
    pub zone_chunks: std::sync::Mutex<std::collections::HashMap<String, Map<String, Value>>>,
}

pub fn canvas_pixels_file(data_dir: &Path) -> PathBuf {
    data_dir.join("canvas_pixels.json")
}
pub fn canvas_locks_file(data_dir: &Path) -> PathBuf {
    data_dir.join("canvas_locks.json")
}
pub fn canvas_banned_file(data_dir: &Path) -> PathBuf {
    data_dir.join("canvas_banned.json")
}
pub fn canvas_reports_file(data_dir: &Path) -> PathBuf {
    data_dir.join("canvas_reports.json")
}
pub fn canvas_bookmarks_file(data_dir: &Path) -> PathBuf {
    data_dir.join("canvas_bookmarks.json")
}
pub fn zones_file(data_dir: &Path) -> PathBuf {
    data_dir.join("zones.json")
}
pub fn canvas_history_file(data_dir: &Path) -> PathBuf {
    data_dir.join("canvas_history.jsonl")
}
pub fn zone_pixels_file(data_dir: &Path, zone_id: &str) -> PathBuf {
    data_dir.join(format!("zone_pixels_{zone_id}.json"))
}
/// `getZoneHistoryFile` (server.js:4405-4407).
pub fn zone_history_file(data_dir: &Path, zone_id: &str) -> PathBuf {
    data_dir.join(format!("zone_history_{zone_id}.jsonl"))
}

/// `+key.slice(...)` — JS `Number()` on a string chunk coordinate.
fn js_num_str(s: &str) -> f64 {
    let t = s.trim();
    if t.is_empty() {
        return 0.0;
    }
    t.parse::<f64>().unwrap_or(f64::NAN)
}

/// JS `${number}` stringification for the chunk-key coordinates. Canvas
/// coordinates are bounded to ±500000 so plain integer rendering matches JS
/// for every finite result; NaN/Infinity keep their JS names.
fn js_num_to_string(n: f64) -> String {
    if n.is_nan() {
        "NaN".to_string()
    } else if n.is_infinite() {
        if n > 0.0 {
            "Infinity".to_string()
        } else {
            "-Infinity".to_string()
        }
    } else {
        format!("{}", n as i64)
    }
}

/// `Math.floor(x / 64),Math.floor(y / 64)` → the "cx,cy" chunk key.
pub fn chunk_key(x: f64, y: f64) -> String {
    format!(
        "{},{}",
        js_num_to_string((x / CHUNK).floor()),
        js_num_to_string((y / CHUNK).floor())
    )
}

/// The "x,y" pixel key from two numbers (JS template literal).
pub fn pixel_key(x: f64, y: f64) -> String {
    format!("{},{}", js_num_to_string(x), js_num_to_string(y))
}

impl CanvasState {
    /// Boot load (server.js:4312-4315 + `rebuildCanvasChunks()` at 4448).
    pub fn load(store: &DataStore, data_dir: &Path) -> Self {
        let pixels: Map<String, Value> = store
            .read_document(&canvas_pixels_file(data_dir), json!({}))
            .as_object()
            .cloned()
            .unwrap_or_default();
        let chunks = rebuild_chunks(&pixels);
        let locks: Map<String, Value> = store
            .read_document(&canvas_locks_file(data_dir), json!({}))
            .as_object()
            .cloned()
            .unwrap_or_default();
        Self {
            pixels: std::sync::RwLock::new(pixels),
            chunks: std::sync::RwLock::new(chunks),
            locks: std::sync::RwLock::new(locks),
            heatmap: std::sync::Mutex::new(Vec::new()),
            zone_pixels: std::sync::Mutex::new(std::collections::HashMap::new()),
            zone_chunks: std::sync::Mutex::new(std::collections::HashMap::new()),
        }
    }

    /// `rebuildCanvasChunks` (server.js:4435-4447) over an existing pixels
    /// map — also used by the unit tests.
    pub fn rebuild(&self) {
        let pixels = self
            .pixels
            .read()
            .unwrap_or_else(|e| e.into_inner())
            .clone();
        let chunks = rebuild_chunks(&pixels);
        *self.chunks.write().unwrap_or_else(|e| e.into_inner()) = chunks;
    }

    /// `setCanvasPixel(x, y, data, zoneId)` (server.js:4450-4496) — mutates
    /// the in-memory maps and appends the raw-fs history line. `broadcast`
    /// fan-outs land with Step 11.
    pub fn set_pixel(
        &self,
        store: &DataStore,
        data_dir: &Path,
        x: f64,
        y: f64,
        data: Value,
        zone_id: Option<&str>,
    ) {
        let key = pixel_key(x, y);
        let ck = chunk_key(x, y);
        match zone_id {
            Some(zone_id) => {
                // getZonePixels() first — it loads the cache when missing.
                let _ = self.get_zone_pixels(store, data_dir, zone_id);
                {
                    let mut zone_pixels =
                        self.zone_pixels.lock().unwrap_or_else(|e| e.into_inner());
                    if let Some(pixels) = zone_pixels.get_mut(zone_id) {
                        pixels.insert(key.clone(), data.clone());
                    }
                }
                {
                    let mut zone_chunks =
                        self.zone_chunks.lock().unwrap_or_else(|e| e.into_inner());
                    if let Some(chunks) = zone_chunks.get_mut(zone_id) {
                        if !chunks.contains_key(&ck) {
                            chunks.insert(ck.clone(), json!({}));
                        }
                        if let Some(chunk) = chunks.get_mut(&ck).and_then(|v| v.as_object_mut()) {
                            chunk.insert(key, data.clone());
                        }
                    }
                }
                append_history_line(
                    &zone_history_file(data_dir, zone_id),
                    &history_entry(
                        x,
                        y,
                        data.get("color"),
                        data.get("ts"),
                        data.get("painter"),
                        data.get("email"),
                    ),
                );
            }
            None => {
                let mut pixels = self.pixels.write().unwrap_or_else(|e| e.into_inner());
                pixels.insert(key.clone(), data.clone());
                let mut chunks = self.chunks.write().unwrap_or_else(|e| e.into_inner());
                if !chunks.contains_key(&ck) {
                    chunks.insert(ck.clone(), json!({}));
                }
                if let Some(chunk) = chunks.get_mut(&ck).and_then(|v| v.as_object_mut()) {
                    chunk.insert(key, data.clone());
                }
                drop(pixels);
                drop(chunks);
                append_history_line(
                    &canvas_history_file(data_dir),
                    &history_entry(
                        x,
                        y,
                        data.get("color"),
                        data.get("ts"),
                        data.get("painter"),
                        data.get("email"),
                    ),
                );
            }
        }
    }

    /// `deleteCanvasPixel(x, y, painter, email, zoneId)` (server.js:4498-4542).
    pub fn delete_pixel(
        &self,
        data_dir: &Path,
        x: f64,
        y: f64,
        painter: &str,
        email: &str,
        zone_id: Option<&str>,
    ) {
        let key = pixel_key(x, y);
        let ck = chunk_key(x, y);
        let now = mitch_lib::school::now_millis();
        let entry =
            json!({ "x": x, "y": y, "color": "", "ts": now, "painter": painter, "email": email });
        match zone_id {
            Some(zone_id) => {
                {
                    let mut zone_pixels =
                        self.zone_pixels.lock().unwrap_or_else(|e| e.into_inner());
                    if let Some(pixels) = zone_pixels.get_mut(zone_id) {
                        pixels.remove(&key);
                    }
                }
                let mut zone_chunks = self.zone_chunks.lock().unwrap_or_else(|e| e.into_inner());
                if let Some(chunks) = zone_chunks.get_mut(zone_id) {
                    if let Some(chunk) = chunks.get_mut(&ck).and_then(|v| v.as_object_mut()) {
                        chunk.remove(&key);
                    }
                }
                drop(zone_chunks);
                append_history_line(&zone_history_file(data_dir, zone_id), &entry);
            }
            None => {
                {
                    let mut pixels = self.pixels.write().unwrap_or_else(|e| e.into_inner());
                    pixels.remove(&key);
                }
                let mut chunks = self.chunks.write().unwrap_or_else(|e| e.into_inner());
                if let Some(chunk) = chunks.get_mut(&ck).and_then(|v| v.as_object_mut()) {
                    chunk.remove(&key);
                }
                drop(chunks);
                append_history_line(&canvas_history_file(data_dir), &entry);
            }
        }
    }

    /// `getZonePixels(zoneId)` (server.js:4375-4396) — cache-or-load, and
    /// builds the zone chunk cache on first load. Returns a clone plus the
    /// chunk clone so handlers can read both without holding the locks.
    pub fn get_zone_pixels(
        &self,
        store: &DataStore,
        data_dir: &Path,
        zone_id: &str,
    ) -> Option<Map<String, Value>> {
        {
            let cache = self.zone_pixels.lock().unwrap_or_else(|e| e.into_inner());
            if cache.contains_key(zone_id) {
                return cache.get(zone_id).cloned();
            }
        }
        let pixels: Map<String, Value> = store
            .read_document(&zone_pixels_file(data_dir, zone_id), json!({}))
            .as_object()
            .cloned()
            .unwrap_or_default();
        let chunks = rebuild_chunks(&pixels);
        {
            let mut zp = self.zone_pixels.lock().unwrap_or_else(|e| e.into_inner());
            zp.insert(zone_id.to_string(), pixels.clone());
        }
        let mut zc = self.zone_chunks.lock().unwrap_or_else(|e| e.into_inner());
        zc.insert(zone_id.to_string(), chunks);
        Some(pixels)
    }

    /// `saveZonePixels` (server.js:4398-4403).
    pub fn save_zone_pixels(&self, store: &DataStore, data_dir: &Path, zone_id: &str) {
        let zone_pixels = self.zone_pixels.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(pixels) = zone_pixels.get(zone_id) {
            let _ = store.write_document(
                &zone_pixels_file(data_dir, zone_id),
                &Value::Object(pixels.clone()),
            );
        }
    }

    /// `saveCanvasPixels` (server.js:4544) — the 30s flush writes the whole
    /// in-memory map through the DB layer.
    pub fn flush_pixels(&self, store: &DataStore, data_dir: &Path) {
        let pixels = self
            .pixels
            .read()
            .unwrap_or_else(|e| e.into_inner())
            .clone();
        let _ = store.write_document(&canvas_pixels_file(data_dir), &Value::Object(pixels));
    }

    /// The hourly `canvasHeatmap` sweep (server.js:4788-4793) — drop entries
    /// older than 24h.
    pub fn sweep_heatmap(&self, now: i64) {
        let mut heatmap = self.heatmap.lock().unwrap_or_else(|e| e.into_inner());
        heatmap.retain(|(_, ts)| now - *ts <= 86_400_000);
    }

    /// `canvasHeatmap.set(key, ts)` — JS Map semantics (keep position).
    pub fn heatmap_set(&self, key: &str, ts: i64) {
        let mut heatmap = self.heatmap.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(slot) = heatmap.iter_mut().find(|(k, _)| k == key) {
            slot.1 = ts;
        } else {
            heatmap.push((key.to_string(), ts));
        }
    }

    /// `Object.fromEntries(canvasHeatmap)` in insertion order.
    pub fn heatmap_object(&self) -> Map<String, Value> {
        let heatmap = self.heatmap.lock().unwrap_or_else(|e| e.into_inner());
        heatmap
            .iter()
            .map(|(k, ts)| (k.clone(), json!(ts)))
            .collect()
    }
}

/// `rebuildCanvasChunks` body (server.js:4436-4446) — pure so the boot load
/// and the unit tests share it. Non-numeric coordinates keep the JS
/// NaN-chunk behavior ("NaN,NaN" chunk entries, filtered at read time).
fn rebuild_chunks(pixels: &Map<String, Value>) -> Map<String, Value> {
    let mut chunks: Map<String, Value> = Map::new();
    for (key, d) in pixels {
        let Some((xs, ys)) = key.split_once(',') else {
            continue;
        };
        let wx = js_num_str(xs);
        let wy = js_num_str(ys);
        let ck = chunk_key(wx, wy);
        if !chunks.contains_key(&ck) {
            chunks.insert(ck.clone(), json!({}));
        }
        if let Some(chunk) = chunks.get_mut(&ck).and_then(|v| v.as_object_mut()) {
            chunk.insert(key.clone(), d.clone());
        }
    }
    chunks
}

/// The history log entry (server.js:4462-4469 / 4484-4491): x, y, color,
/// `ts: data.ts || Date.now()`, painter/email defaults ''.
fn history_entry(
    x: f64,
    y: f64,
    color: Option<&Value>,
    ts: Option<&Value>,
    painter: Option<&Value>,
    email: Option<&Value>,
) -> Value {
    json!({
        "x": x,
        "y": y,
        "color": color.cloned().unwrap_or(Value::Null),
        "ts": mitch_lib::jsval::or(ts, json!(mitch_lib::school::now_millis())),
        "painter": mitch_lib::jsval::or(painter, json!("")),
        "email": mitch_lib::jsval::or(email, json!("")),
    })
}

/// `appendFileSync(file, JSON.stringify(entry) + '\n', 'utf8')` — the JS
/// swallows write errors with a console.error, so this returns ().
fn append_history_line(file: &Path, entry: &Value) {
    use std::io::Write;
    let line = match serde_json::to_string(entry) {
        Ok(line) => line,
        Err(_) => return,
    };
    if let Ok(mut f) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(file)
    {
        let _ = f.write_all(format!("{line}\n").as_bytes());
    }
}

/// `checkZoneAccess(zoneId, email, sid)` (server.js:4409-4433).
pub fn check_zone_access(
    store: &DataStore,
    data_dir: &Path,
    id_secret: &[u8],
    node_env_test: bool,
    zone_id: &str,
    email: &str,
    sid: &str,
) -> bool {
    if mitch_lib::auth::is_any_admin_id(store, id_secret, sid, node_env_test) {
        return true;
    }
    let zones = store.read_document(&zones_file(data_dir), json!({}));
    let Some(zone) = zones.get(zone_id) else {
        return false;
    };
    let norm_email = mitch_lib::auth::normalize_email(email);
    let norm_owner = mitch_lib::auth::normalize_email(&mitch_lib::jsval::string(
        zone.get("owner").unwrap_or(&Value::Null),
    ));
    if norm_email == norm_owner {
        return true;
    }
    if mitch_lib::jsval::truthy(zone.get("friendsOnly").unwrap_or(&Value::Null)) {
        let friends = store.read_document(&data_dir.join("friends.json"), json!({}));
        let empty = vec![];
        let owner_friends = friends
            .get(&norm_owner)
            .and_then(|v| v.as_array())
            .unwrap_or(&empty);
        let user_friends = friends
            .get(&norm_email)
            .and_then(|v| v.as_array())
            .unwrap_or(&empty);
        let is_friend_of_owner = owner_friends
            .iter()
            .any(|v| mitch_lib::jsval::string(v) == norm_email)
            || user_friends
                .iter()
                .any(|v| mitch_lib::jsval::string(v) == norm_owner);
        if is_friend_of_owner {
            return true;
        }
    }
    let allowed: Vec<String> = zone
        .get("allowedUsers")
        .and_then(|v| v.as_array())
        .map(|a| {
            a.iter()
                .map(|v| mitch_lib::auth::normalize_email(&mitch_lib::jsval::string(v)))
                .collect()
        })
        .unwrap_or_default();
    allowed.contains(&norm_email)
}

/// `loadJson(CANVAS_BANNED_FILE, {})` fresh per call (server.js:21773).
pub fn load_bans(store: &Arc<DataStore>, data_dir: &Path) -> Value {
    store.read_document(&canvas_banned_file(data_dir), json!({}))
}

#[cfg(test)]
mod tests {
    #![cfg_attr(test, allow(clippy::unwrap_used, clippy::expect_used))]
    use super::*;

    #[test]
    fn chunk_keys_match_js_floor_division() {
        // Math.floor(x/64) across the quadrant boundaries.
        assert_eq!(chunk_key(0.0, 0.0), "0,0");
        assert_eq!(chunk_key(63.0, 63.0), "0,0");
        assert_eq!(chunk_key(64.0, 64.0), "1,1");
        assert_eq!(chunk_key(-1.0, -1.0), "-1,-1");
        assert_eq!(chunk_key(-64.0, -64.0), "-1,-1");
        assert_eq!(chunk_key(-65.0, 64.0), "-2,1");
        assert_eq!(chunk_key(500000.0, -500000.0), "7812,-7813");
        // Non-numeric coordinates keep the JS NaN key name.
        assert_eq!(chunk_key(f64::NAN, f64::NAN), "NaN,NaN");
    }

    #[test]
    fn rebuild_and_read_filter_empties() {
        let mut pixels = Map::new();
        pixels.insert("10,10".to_string(), json!({"color": "#112233"}));
        pixels.insert("-5,70".to_string(), json!({"color": "#445566"}));
        pixels.insert("abc,def".to_string(), json!({"color": "#000000"}));
        let chunks = rebuild_chunks(&pixels);
        // "abc,def" → Number("abc")=NaN → the "NaN,NaN" chunk (filtered out
        // of /api/canvas/chunks bounds by Number.isFinite); 10,10 → 0,0;
        // -5,70 → -1,1. A key with no comma is skipped entirely (JS continue).
        let keys: Vec<&String> = chunks.keys().collect();
        assert_eq!(keys, ["0,0", "-1,1", "NaN,NaN"]);
        assert!(rebuild_chunks(&Map::from_iter([("junk".to_string(), json!({}))])).is_empty());
    }

    #[test]
    fn heatmap_keeps_position_on_update() {
        // A throwaway DB-backed store, matching the coins.rs test pattern.
        let dir = std::env::temp_dir().join(format!("canvas-test-{}", std::process::id()));
        let _ = std::fs::create_dir_all(&dir);
        let store = DataStore::open(&dir, &dir.join("data")).expect("open store");
        let st = CanvasState::load(&store, &dir.join("data"));
        st.heatmap_set("1,1", 100);
        st.heatmap_set("2,2", 200);
        st.heatmap_set("1,1", 300);
        let obj = st.heatmap_object();
        let keys: Vec<&String> = obj.keys().collect();
        assert_eq!(keys, ["1,1", "2,2"]);
        assert_eq!(obj.get("1,1"), Some(&json!(300)));
        // Sweep: JS deletes when now - ts > 86400000, so EXACTLY 24h is kept.
        st.sweep_heatmap(200 + 86_400_000);
        assert_eq!(st.heatmap_object().keys().len(), 2);
        st.sweep_heatmap(300 + 86_400_000);
        let kept: Vec<String> = st.heatmap_object().keys().cloned().collect();
        assert_eq!(kept, ["1,1"]);
    }
}
