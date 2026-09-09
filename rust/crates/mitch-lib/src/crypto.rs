//! At-rest crypto + ID helpers — byte-faithful port of server.js's
//! `sealAtRest`/`openAtRest` (dm + totp purposes), the `makeEmailId` HMAC
//! scheme, and the ID_SECRET bootstrap.
//!
//! Contract:
//! - key = HMAC-SHA256(key = ID_SECRET, data = <purpose>).digest() — 32 bytes.
//!   Purposes: `dm-at-rest-v1`, `totp-at-rest-v1`.
//! - sealed format: `enc1:<iv-hex>:<ct-hex>:<tag-hex>` — AES-256-GCM,
//!   12-byte random IV, ct = AES ciphertext (tag split off by the JS), tag
//!   = 16-byte GCM tag.
//! - `openAtRest` returns the original string on any failure (parity), and
//!   the parsed value when it is an object.
//! - ID_SECRET: read from `data/id_secret.key` as raw bytes; on missing,
//!   32 random bytes + persisted back (JS readFileSync/randomBytes parity).

use aes_gcm::aead::generic_array::GenericArray;
use aes_gcm::aead::Aead;
use aes_gcm::{Aes256Gcm, KeyInit};
use hmac::{Hmac, Mac};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::path::Path;

use crate::data::DataError;

type HmacSha256 = Hmac<Sha256>;

pub const DM_AT_REST_PREFIX: &str = "enc1:";
pub const TOTP_AT_REST_PREFIX: &str = "enc1:";
pub const DM_AT_REST_PURPOSE: &str = "dm-at-rest-v1";
pub const TOTP_AT_REST_PURPOSE: &str = "totp-at-rest-v1";

/// ID_SECRET — raw bytes from `data/id_secret.key`; generated once when
/// missing (JS readFileSync/randomBytes+writeFileSync parity).
pub fn load_id_secret(data_dir: &Path) -> Result<Vec<u8>, DataError> {
    let file = data_dir.join("id_secret.key");
    if let Ok(bytes) = std::fs::read(&file) {
        return Ok(bytes);
    }
    let mut secret = vec![0u8; 32];
    rand::RngCore::fill_bytes(&mut rand::rng(), &mut secret);
    std::fs::write(&file, &secret)?;
    Ok(secret)
}

/// `HMAC-SHA256(key, data).digest()` — 32 raw bytes.
#[allow(clippy::expect_used)] // new_from_slice only errors on empty keys
pub fn hmac_sha256(key: &[u8], data: &[u8]) -> [u8; 32] {
    let mut mac = <HmacSha256 as Mac>::new_from_slice(key).expect("hmac accepts any key size");
    mac.update(data);
    mac.finalize().into_bytes().into()
}

/// Hex of `HMAC-SHA256(key, data)` (used by the email-id scheme).
pub fn hmac_sha256_hex(key: &[u8], data: &[u8]) -> String {
    hex(&hmac_sha256(key, data))
}

/// `sha256(data).hex` helper (used by email-id + bg-dir derivations).
pub fn sha256_hex(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    let mut out = String::with_capacity(64);
    for b in hasher.finalize() {
        out.push_str(&format!("{b:02x}"));
    }
    out
}

fn hex(data: &[u8]) -> String {
    let mut out = String::with_capacity(data.len() * 2);
    for b in data.iter() {
        out.push_str(&format!("{b:02x}"));
    }
    out
}

fn unhex(s: &str) -> Option<Vec<u8>> {
    if !s.len().is_multiple_of(2) {
        return None;
    }
    (0..s.len() / 2)
        .map(|i| u8::from_str_radix(&s[i * 2..i * 2 + 2], 16).ok())
        .collect()
}

/// AES-256-GCM seal, JS shape: `enc1:<iv-hex>:<ct-hex>:<tag-hex>` (the
/// aes-gcm crate appends the 16-byte tag to the ciphertext, so split it).
/// Returns None when the plaintext is not valid UTF-8 (JS catch -> null).
pub fn seal_at_rest(key: &[u8; 32], json_string: &str, prefix: &str) -> Option<String> {
    let iv: [u8; 12] = rand::random();
    let cipher = Aes256Gcm::new_from_slice(key).ok()?;
    let nonce = GenericArray::from_slice(&iv);
    let sealed = cipher.encrypt(nonce, json_string.as_bytes()).ok()?;
    let (ct, tag) = sealed.split_at(sealed.len() - 16);
    Some(format!("{prefix}{}:{}:{}", hex(&iv), hex(ct), hex(tag)))
}

/// AES-256-GCM open, JS shape: parse `enc1:<iv-hex>:<ct-hex>:<tag-hex>`,
/// decrypt, JSON.parse — returning the original string on any failure
/// (parity with the JS catch -> return str).
pub fn open_at_rest(key: &[u8; 32], sealed: &str, prefix: &str) -> Value {
    if !sealed.starts_with(prefix) {
        return Value::String(sealed.to_owned());
    }
    let opened = (|| -> Option<Value> {
        let body = &sealed[prefix.len()..];
        let i1 = body.find(':')?;
        let i2 = body[i1 + 1..].find(':')? + i1 + 1;
        let iv = unhex(&body[..i1])?;
        let ct = unhex(&body[i1 + 1..i2])?;
        let tag = unhex(&body[i2 + 1..])?;
        let cipher = Aes256Gcm::new_from_slice(key).ok()?;
        let nonce = GenericArray::from_slice(&iv);
        let mut combined = ct.clone();
        combined.extend_from_slice(&tag);
        let plain = cipher.decrypt(nonce, combined.as_ref()).ok()?;
        serde_json::from_str::<Value>(std::str::from_utf8(&plain).ok()?).ok()
    })();
    opened.unwrap_or_else(|| Value::String(sealed.to_owned()))
}

/// `timingSafeEqual(a, b)` — constant-time compare; false on length mismatch
/// (which JS throws on, so call sites guard lengths first).
pub fn timing_safe_equal(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}

/// `argon2id` verification against Bun.password.hash PHC strings. The params
/// are embedded in the PHC string, so verification matches whatever params
/// bun used.
pub fn argon2_verify(phc_hash: &str, password: &str) -> bool {
    use argon2::{Argon2, PasswordHash, PasswordVerifier};
    match PasswordHash::new(phc_hash) {
        Ok(parsed) => Argon2::default()
            .verify_password(password.as_bytes(), &parsed)
            .is_ok(),
        Err(_) => false,
    }
}

/// `Disconnect` reason codes for russh teardown parity.
pub const DISCONNECT_BY_APPLICATION: &str = "ByApplication";

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_key() -> [u8; 32] {
        hmac_sha256(b"mitch-e2e", b"crypto-test")
    }

    #[test]
    fn seal_open_round_trips() {
        let key = test_key();
        let obj = serde_json::json!({"text": "secret dm ✅", "n": 42});
        let sealed = seal_at_rest(
            &key,
            &serde_json::to_string(&obj).expect("stringify"),
            DM_AT_REST_PREFIX,
        )
        .expect("seal");
        assert!(sealed.starts_with("enc1:"));
        // iv:ct:tag all hex.
        let parts: Vec<&str> = sealed[5..].split(':').collect();
        assert_eq!(parts.len(), 3);
        for p in &parts {
            assert!(!p.is_empty() && p.chars().all(|c| c.is_ascii_hexdigit()));
        }
        // Round trip.
        let opened = open_at_rest(&key, &sealed, DM_AT_REST_PREFIX);
        assert_eq!(opened, obj);
    }

    #[test]
    fn open_returns_original_on_garbage() {
        let key = test_key();
        assert_eq!(
            open_at_rest(&key, "not-sealed", DM_AT_REST_PREFIX),
            serde_json::json!("not-sealed")
        );
        assert_eq!(
            open_at_rest(&key, "enc1:zz:zz:zz", DM_AT_REST_PREFIX),
            serde_json::json!("enc1:zz:zz:zz")
        );
    }

    #[test]
    fn hmac_matches_known_vector() {
        // RFC 4231 test case 2: key "Jefe", data "what do ya want for nothing?"
        let expected = "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843";
        assert_eq!(
            hmac_sha256_hex(b"Jefe", b"what do ya want for nothing?"),
            expected
        );
    }

    #[test]
    fn sha256_matches_known() {
        assert_eq!(
            sha256_hex(b"abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }

    #[test]
    fn id_secret_persists_once() {
        let dir = std::env::temp_dir().join(format!(
            "mitch-lib-crypto-test-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        let secret1 = load_id_secret(&dir).unwrap();
        let secret2 = load_id_secret(&dir).unwrap();
        assert_eq!(secret1, secret2, "second load must reuse the file");
        assert_eq!(secret1.len(), 32);
        assert!(dir.join("id_secret.key").exists());
        std::fs::remove_dir_all(&dir).ok();
    }
}
