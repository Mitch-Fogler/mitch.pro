//! SSO bridge tokens + the e2e localStorage key helper — port of server.js's
//! `createSsoBridgeToken`/`consumeSsoBridgeToken` (5443-5467).
//!
//! Contract (exploration-corrected): the bridge token is an OPAQUE random
//! server-side token in an in-memory map — NOT HMAC-signed. Single-use,
//! 90 s TTL, sweep only when size > 500. The exchange is host-gated to
//! rjuhsd.school/sexypickleclub.com (the token can never mint a mitch.pro
//! session directly).

use rand::RngCore;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Mutex;

pub const SSO_BRIDGE_TTL_MS: i64 = 90 * 1000;
const MAX_SIZE_BEFORE_SWEEP: usize = 500;

#[derive(Debug, Clone)]
pub struct BridgeTokenRecord {
    pub email: String,
    pub expires: i64,
}

fn now_millis() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// In-memory `SSO_BRIDGE_TOKENS` map — single-use, 90 s TTL.
#[derive(Default)]
pub struct SsoBridgeTokens {
    tokens: Mutex<HashMap<String, BridgeTokenRecord>>,
}

impl SsoBridgeTokens {
    pub fn new() -> Self {
        Self::default()
    }

    /// `createSsoBridgeToken(normEmail)` — random 24-byte base64url token
    /// indexing `{email, expires}`; sweeps expired entries at >500 size.
    pub fn create(&self, norm_email: &str) -> String {
        let mut bytes = vec![0u8; 24];
        rand::rng().fill_bytes(&mut bytes);
        let token = base64url_encode(&bytes);
        let mut tokens = self.tokens.lock().unwrap_or_else(|e| e.into_inner());
        tokens.insert(
            token.clone(),
            BridgeTokenRecord {
                email: crate::auth::normalize_email(norm_email),
                expires: now_millis() + SSO_BRIDGE_TTL_MS,
            },
        );
        if tokens.len() > MAX_SIZE_BEFORE_SWEEP {
            let now = now_millis();
            tokens.retain(|_, rec| rec.expires >= now);
        }
        token
    }

    /// `consumeSsoBridgeToken(token)` — single-use: deleted on read; expired
    /// or empty-email records return None.
    pub fn consume(&self, token: &str) -> Option<BridgeTokenRecord> {
        let token = token.trim().to_string();
        let mut tokens = self.tokens.lock().unwrap_or_else(|e| e.into_inner());
        let rec = tokens.remove(&token)?;
        if now_millis() > rec.expires || rec.email.is_empty() {
            return None;
        }
        Some(rec)
    }
}

/// `e2eClientStorageEmail(email)` — the localStorage key form: keeps the
/// plus-tag strip and dot-stripping in the local part, maps
/// student.rjuhsd.us -> student.mitch.pro (the INVERSE of normalizeEmail's
/// domain fold; server.js:5434).
pub fn e2e_client_storage_email(email: &str) -> String {
    let e = email.to_lowercase().trim().to_string();
    let Some(at) = e.rfind('@') else {
        return e;
    };
    let local = e[..at].split('+').next().unwrap_or("").replace('.', "");
    let domain = if &e[at + 1..] == "student.rjuhsd.us" {
        "student.mitch.pro"
    } else {
        &e[at + 1..]
    };
    format!("{local}@{domain}")
}

/// The E2E private JWK validation from /api/sso/exchange (server.js ~11120):
/// accepted only if `kty === 'EC' && crv === 'P-256' && x && y && d`,
/// normalized to `{kty, crv, x, y, d, ext: true}`.
pub fn normalize_e2e_private_jwk(raw: &str) -> Option<Value> {
    let cand = serde_json::from_str::<Value>(raw).ok()?;
    let obj = cand.as_object()?;
    if obj.get("kty")?.as_str()? != "EC" || obj.get("crv")?.as_str()? != "P-256" {
        return None;
    }
    for field in ["x", "y", "d"] {
        if obj.get(field)?.as_str()?.is_empty() {
            return None;
        }
    }
    Some(serde_json::json!({
        "kty": "EC", "crv": "P-256",
        "x": obj["x"], "y": obj["y"], "d": obj["d"],
        "ext": true,
    }))
}

fn base64url_encode(data: &[u8]) -> String {
    use base64::Engine;
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(data)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bridge_tokens_single_use_and_expired() {
        let tokens = SsoBridgeTokens::new();
        let token = tokens.create("user@mitch.pro");
        assert!(!token.is_empty());
        // First consume succeeds.
        let rec = tokens.consume(&token).expect("first consume");
        assert_eq!(rec.email, "ab@student.rjuhsd.us".replace("ab", "user")); // normalizeEmail applied
                                                                             // Second consume fails (single-use).
        assert!(tokens.consume(&token).is_none());
        // Unknown token fails.
        assert!(tokens.consume("garbage").is_none());
    }

    #[test]
    fn bridge_token_email_is_normalized() {
        let tokens = SsoBridgeTokens::new();
        let token = tokens.create("A.B+x@mitch.pro");
        let rec = tokens.consume(&token).unwrap();
        assert_eq!(rec.email, "ab@student.rjuhsd.us");
    }

    #[test]
    fn e2e_storage_email_inverts_domain_fold() {
        // normalizeEmail folds mitch.pro -> student.rjuhsd.us; the storage
        // key folds student.rjuhsd.us -> student.mitch.pro (inverse).
        assert_eq!(
            e2e_client_storage_email("A.B+x@student.rjuhsd.us"),
            "ab@student.mitch.pro"
        );
        assert_eq!(e2e_client_storage_email("user@gmail.com"), "user@gmail.com");
        assert_eq!(
            e2e_client_storage_email("admin@mitch.pro"),
            "admin@mitch.pro"
        );
    }

    #[test]
    fn jwk_normalization_requires_ec_p256() {
        let good = r#"{"kty":"EC","crv":"P-256","x":"a","y":"b","d":"c"}"#;
        let normalized = normalize_jwk_normalization(good).expect("good jwk");
        assert_eq!(normalized["ext"], serde_json::json!(true));
        // Wrong kty/crv rejected.
        assert!(normalize_jwk_normalization(
            r#"{"kty":"RSA","crv":"P-256","x":"a","y":"b","d":"d"}"#
        )
        .is_none());
        assert!(normalize_jwk_normalization("not json").is_none());
    }

    fn normalize_jwk_normalization(raw: &str) -> Option<Value> {
        normalize_e2e_private_jwk(raw)
    }
}
