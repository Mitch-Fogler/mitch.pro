//! ID_SECRET handling, at-rest encryption, HMAC ids, and password hashing.
//!
//! Contract (from `server.js`):
//! - DM/TOTP at-rest: `enc1:<iv-hex>:<ct-hex>:<tag-hex>` with AES-256-GCM;
//!   key = `HMAC-SHA256(ID_SECRET, "dm-at-rest-v1")` (and `"totp-at-rest-v1"`).
//!   Rust must decrypt bun-sealed rows forever.
//! - Email ids: `e<sha256(emailKey)[0..24]>.<hex(HMAC-SHA256(ID_SECRET, raw))[0..16]>`.
//! - Session tokens: `randomBytes(32).toString('base64url')` — no JWT anywhere.
//! - Passwords: argon2id (Bun.password.hash, PHC strings embed their params).
//!
//! Status: scaffold stub — implemented in plan Step 5.

#![allow(dead_code)]

/// Crypto provider, not yet wired.
pub struct Crypto;

impl Crypto {
    /// Placeholder so the module compiles; replaced in Step 5.
    pub fn placeholder() -> Self {
        Self
    }
}
