//! WebAuthn/passkey primitives — port of `lib/webauthn.js` (rpForHost,
//! makeChallengeStore, publicCredentialView, guessCredentialName) plus the
//! assertion/registration verification matching @simplewebauthn/server@14.
//!
//! Contract:
//! - Challenge store: sha256-hex keyed, TTL 180s, single-use take().
//! - expectedChallenge compares sha256(clientClaimedChallenge).hex.
//! - Stored credential public key: COSE ES256 map, standard base64.
//! - Assertion signature: ECDSA P-256/SHA-256 over authData || sha256(clientDataJSON).
//! - requireUserVerification: false on both verify paths.

use base64::Engine;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Mutex;

/// `rpForHost(hostname, rpOrigins)` — exact host equality, https only.
pub fn rp_for_host(hostname: &str, rp_origins: &[String]) -> Option<(String, String)> {
    let lowered = hostname.to_lowercase();
    let h = lowered.split(':').next().unwrap_or("");
    for raw in rp_origins {
        let Ok(u) = url::Url::parse(raw) else {
            continue;
        };
        if u.scheme() != "https" {
            continue;
        }
        if let Some(host) = u.host_str() {
            if h == host {
                return Some((host.to_string(), u.origin().ascii_serialization()));
            }
        }
    }
    None
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct IssuedChallenge {
    pub kind: String,
    #[serde(default)]
    pub email: String,
    #[serde(rename = "rpId", default)]
    pub rp_id: String,
    pub expires: i64,
    /// sha256-hex digest (JS `issued.key`).
    pub key: String,
}

fn now_millis() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// `makeChallengeStore(ttlMs = 180_000)`.
#[derive(Default)]
pub struct ChallengeStore {
    pending: Mutex<HashMap<String, IssuedChallenge>>,
    ttl_ms: i64,
}

impl ChallengeStore {
    pub fn new() -> Self {
        Self::with_ttl(3 * 60 * 1000)
    }

    pub fn with_ttl(ttl_ms: i64) -> Self {
        Self {
            pending: Mutex::new(HashMap::new()),
            ttl_ms,
        }
    }

    /// `issue(kind, email, rpId, challenge?)` — sweep + store + return raw challenge.
    pub fn issue(&self, kind: &str, email: &str, rp_id: &str, challenge: Option<String>) -> String {
        let challenge = challenge.unwrap_or_else(|| base64url(&random_bytes(32)));
        let now = now_millis();
        let mut pending = self.pending.lock().unwrap_or_else(|e| e.into_inner());
        pending.retain(|_, rec| rec.expires > now);
        let key = sha256_hex_str(challenge.as_bytes());
        pending.insert(
            key.clone(),
            IssuedChallenge {
                kind: kind.to_owned(),
                email: email.to_owned(),
                rp_id: rp_id.to_owned(),
                expires: now + self.ttl_ms,
                key,
            },
        );
        challenge
    }

    /// `take(challenge, kind)` — single-use; deleted on kind-mismatch or expiry.
    pub fn take(&self, challenge: &str, kind: &str) -> Option<IssuedChallenge> {
        let key = sha256_hex_str(challenge.as_bytes());
        let mut pending = self.pending.lock().unwrap_or_else(|e| e.into_inner());
        let rec = pending.get(&key).cloned()?;
        pending.remove(&key);
        if rec.kind != kind || now_millis() > rec.expires {
            return None;
        }
        Some(IssuedChallenge { key, ..rec })
    }

    pub fn size(&self) -> usize {
        self.pending.lock().unwrap_or_else(|e| e.into_inner()).len()
    }
}

/// `publicCredentialView(c)` — omits publicKey/counter/aaguid.
pub fn public_credential_view(cred: &Value) -> Value {
    serde_json::json!({
        "id": cred.get("id").cloned().unwrap_or(Value::Null),
        "name": cred.get("name").and_then(|v| v.as_str()).unwrap_or("Passkey"),
        "rpId": cred.get("rpId").and_then(|v| v.as_str()).unwrap_or(""),
        "deviceType": cred.get("deviceType").and_then(|v| v.as_str()).unwrap_or(""),
        "backedUp": cred.get("backedUp").and_then(|v| v.as_bool()).unwrap_or(false),
        "transports": cred.get("transports").cloned().unwrap_or(Value::Null),
        "createdAt": cred.get("createdAt").and_then(|v| v.as_i64()).unwrap_or(0),
        "lastUsedAt": cred.get("lastUsedAt").cloned().unwrap_or(Value::Null),
    })
}

/// `guessCredentialName(userAgent)` — platform then browser, first match wins.
pub fn guess_credential_name(user_agent: &str) -> String {
    let ua = &user_agent[..user_agent.len().min(120)];
    let platform = if regex_contains(ua, r"(?i)iPhone|iPad") {
        "iOS"
    } else if ua.contains("Android") {
        "Android"
    } else if ua.contains("Macintosh") {
        "macOS"
    } else if ua.contains("Windows") {
        "Windows"
    } else if ua.contains("Linux") {
        "Linux"
    } else {
        ""
    };
    let browser = if regex_contains(ua, r"(?i)Edg/") {
        "Edge"
    } else if regex_contains(ua, r"(?i)Chrome/") {
        "Chrome"
    } else if regex_contains(ua, r"(?i)Firefox/") {
        "Firefox"
    } else if regex_contains(ua, r"(?i)Safari/") {
        "Safari"
    } else {
        ""
    };
    if platform.is_empty() || browser.is_empty() {
        "Passkey".to_owned()
    } else {
        format!("Passkey — {platform} · {browser}")
    }
}

fn regex_contains(s: &str, pattern: &str) -> bool {
    regex::Regex::new(pattern)
        .map(|re| re.is_match(s))
        .unwrap_or(false)
}

fn random_bytes(n: usize) -> Vec<u8> {
    crate::crypto::random_bytes(n)
}

fn sha256_hex_str(data: &[u8]) -> String {
    crate::crypto::sha256_hex(data)
}

// ── Verification ─────────────────────────────────────────────────────────────

/// Verifies clientDataJSON: type, challenge (hashed against issued.key), origin.
pub fn verify_client_data(
    client_data_json_b64url: &str,
    expected_type: &str,
    issued_key: &str,
    expected_origin: &str,
) -> Result<(), String> {
    let json_bytes = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(client_data_json_b64url.trim())
        .map_err(|e| format!("clientDataJSON base64: {e}"))?;
    let cd: Value =
        serde_json::from_slice(&json_bytes).map_err(|e| format!("clientDataJSON: {e}"))?;
    if cd.get("type").and_then(|v| v.as_str()).unwrap_or("") != expected_type {
        return Err("wrong type".into());
    }
    let challenge = cd.get("challenge").and_then(|v| v.as_str()).unwrap_or("");
    if sha256_hex_str(challenge.as_bytes()) != issued_key {
        return Err("challenge mismatch".into());
    }
    if cd.get("origin").and_then(|v| v.as_str()).unwrap_or("") != expected_origin {
        return Err("origin mismatch".into());
    }
    Ok(())
}

/// Extracts the raw authenticatorData bytes from a base64url field.
pub fn decode_b64url_bytes(s: &str) -> Result<Vec<u8>, String> {
    base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(s.trim())
        .map_err(|e| format!("base64url: {e}"))
}

/// authData: rpIdHash(32) + flags(1) + counter(4 BE) → (counter, flags).
pub fn parse_auth_data_counter_flags(auth_data: &[u8]) -> Option<(u32, u8)> {
    if auth_data.len() < 37 {
        return None;
    }
    Some((
        u32::from_be_bytes([auth_data[33], auth_data[34], auth_data[35], auth_data[36]]),
        auth_data[32],
    ))
}

/// COSE ES256 key as a map: keys are CBOR integers (1=kty, 3=alg, -1=crv, -2=x, -3=y).
type CoseKey = std::collections::BTreeMap<i128, serde_cbor::Value>;

fn cose_es256_key(cbor: &serde_cbor::Value) -> Option<CoseKey> {
    let map = match cbor {
        serde_cbor::Value::Map(m) => m,
        _ => return None,
    };
    let get = |k: i128| -> Option<i128> {
        map.iter().find_map(|(key, _)| match key {
            serde_cbor::Value::Integer(i) if *i == k => Some(*i),
            _ => None,
        })
    };
    // 2 = EC2 key type, -7 = ES256 algorithm.
    if get(1) != Some(2) || get(3) != Some(-7) {
        return None;
    }
    let mut out = CoseKey::new();
    out.insert(
        -2,
        map.iter().find_map(|(k, v)| {
            if matches!(k, serde_cbor::Value::Integer(i) if *i == -2) {
                Some(v.clone())
            } else {
                None
            }
        })?,
    );
    out.insert(
        -1,
        map.iter().find_map(|(k, v)| {
            if matches!(k, serde_cbor::Value::Integer(i) if *i == -1) {
                Some(v.clone())
            } else {
                None
            }
        })?,
    );
    out.insert(3, serde_cbor::Value::Integer(-7));
    out.insert(1, serde_cbor::Value::Integer(2));
    Some(out)
}

/// Verifies an ES256 signature with a COSE key over `message`.
fn verify_es256(key: &CoseKey, message: &[u8], signature: &[u8]) -> bool {
    use p256::ecdsa::{signature::Verifier, Signature, VerifyingKey};
    let Some(serde_cbor::Value::Bytes(x)) = key.get(&-2i128) else {
        return false;
    };
    let Some(serde_cbor::Value::Bytes(y)) = key.get(&-1i128) else {
        return false;
    };
    let mut sec1 = Vec::with_capacity(65);
    sec1.push(0x04);
    sec1.extend_from_slice(x);
    sec1.extend_from_slice(y);
    let Ok(vk) = VerifyingKey::from_sec1_bytes(&sec1) else {
        return false;
    };
    let Ok(sig) = Signature::from_der(signature).or_else(|_| Signature::from_slice(signature))
    else {
        return false;
    };
    vk.verify(message, &sig).is_ok()
}

/// Login assertion verification: ES256 over authData || sha256(clientDataJSON)
/// against the stored credential's COSE public key.
pub fn verify_authentication_signature(
    cose_public_key_bytes: &[u8],
    authenticator_data: &[u8],
    client_data_json_b64url: &str,
    signature: &[u8],
) -> Result<(), String> {
    let cose: serde_cbor::Value =
        serde_cbor::from_slice(cose_public_key_bytes).map_err(|e| format!("stored key: {e}"))?;
    let key = cose_es256_key(&cose).ok_or("stored key not COSE ES256")?;
    let client_data_bytes = decode_b64url_bytes(client_data_json_b64url)?;
    let client_hash = sha256_bytes(&client_data_bytes);
    let mut signed = authenticator_data.to_vec();
    signed.extend_from_slice(&client_hash);
    if !verify_es256(&key, &signed, signature) {
        return Err("signature verification failed".into());
    }
    Ok(())
}

/// Registration info (the fields stored in passkeys.json).
pub struct RegistrationInfo {
    pub credential_id: String,
    pub cose_public_key: Vec<u8>,
    pub counter: u32,
    pub aaguid_hex: String,
}

/// Registration attestation verification (fmt "none" or "packed" self-attestation).
pub fn verify_registration(
    attestation_object_b64url: &str,
    client_data_json_b64url: &str,
    issued_key: &str,
    expected_origin: &str,
    expected_rp_id: &str,
) -> Result<RegistrationInfo, String> {
    // Caller must have verified clientData first; do it here for completeness.
    verify_client_data(
        client_data_json_b64url,
        "webauthn.create",
        issued_key,
        expected_origin,
    )?;
    let att_bytes = decode_b64url_bytes(attestation_object_b64url)?;
    let att: serde_cbor::Value =
        serde_cbor::from_slice(&att_bytes).map_err(|e| format!("attObj: {e}"))?;
    let serde_cbor::Value::Map(att_map) = &att else {
        return Err("attObj not a map".into());
    };
    let find_bytes = |k: &str| -> Option<Vec<u8>> {
        att_map.iter().find_map(|(key, v)| {
            if matches!(key, serde_cbor::Value::Text(t) if t == k) {
                match v {
                    serde_cbor::Value::Bytes(b) => Some(b.clone()),
                    _ => None,
                }
            } else {
                None
            }
        })
    };
    let find_text = |k: &str| -> Option<String> {
        att_map.iter().find_map(|(key, v)| {
            if matches!(key, serde_cbor::Value::Text(t) if t == k) {
                match v {
                    serde_cbor::Value::Text(s) => Some(s.clone()),
                    _ => None,
                }
            } else {
                None
            }
        })
    };
    let fmt = find_text("fmt").ok_or("attObj missing fmt")?;
    if fmt != "none" && fmt != "packed" {
        return Err(format!("unsupported fmt: {fmt}"));
    }
    let auth_data = find_bytes("authData").ok_or("attObj missing authData")?;

    let expected_hash = sha256_bytes(expected_rp_id.as_bytes());
    if auth_data.len() < 37 {
        return Err("authData too short".into());
    }
    if auth_data[..32] != expected_hash[..] {
        return Err("rpIdHash mismatch".into());
    }
    let flags = auth_data[32];
    if flags & 0x40 == 0 {
        return Err("user-present flag not set".into());
    }
    if flags & 0x80 == 0 {
        return Err("attested-credential flag not set".into());
    }
    let counter = u32::from_be_bytes([auth_data[33], auth_data[34], auth_data[35], auth_data[36]]);

    // Attested credential data: aaguid(16) + credIdLen(2 BE) + credId + COSE key.
    let rest = &auth_data[37..];
    if rest.len() < 18 {
        return Err("attested credential data too short".into());
    }
    let aaguid_hex: String = rest[..16].iter().map(|b| format!("{b:02x}")).collect();
    let cred_id_len = u16::from_be_bytes([rest[16], rest[17]]) as usize;
    if rest.len() < 18 + cred_id_len {
        return Err("credential id truncated".into());
    }
    let credential_id = rest[18..18 + cred_id_len].to_vec();
    let cose: serde_cbor::Value =
        serde_cbor::from_slice(&rest[18 + cred_id_len..]).map_err(|e| format!("COSE key: {e}"))?;
    let key = cose_es256_key(&cose).ok_or("COSE key not ES256")?;

    // fmt "packed" self-attestation signs authData || clientDataHash.
    if fmt == "packed" {
        let serde_cbor::Value::Map(stmt) = att_map
            .iter()
            .find_map(|(k, v)| {
                if matches!(k, serde_cbor::Value::Text(t) if t == "attStmt") {
                    Some(v.clone())
                } else {
                    None
                }
            })
            .ok_or("attStmt missing")?
        else {
            return Err("attStmt not a map".into());
        };
        let sig = stmt
            .iter()
            .find_map(|(k, v)| {
                if matches!(k, serde_cbor::Value::Text(t) if t == "sig") {
                    match v {
                        serde_cbor::Value::Bytes(b) => Some(b.clone()),
                        _ => None,
                    }
                } else {
                    None
                }
            })
            .ok_or("attStmt missing sig")?;
        let client_data_bytes = decode_b64url_bytes(client_data_json_b64url)?;
        let client_hash = sha256_bytes(&client_data_bytes);
        let mut signed = auth_data.clone();
        signed.extend_from_slice(&client_hash);
        if !verify_es256(&key, &signed, &sig) {
            return Err("attestation signature invalid".into());
        }
    }

    Ok(RegistrationInfo {
        credential_id: base64url(&credential_id),
        cose_public_key: serde_cbor::to_vec(&cose).unwrap_or_default(),
        counter,
        aaguid_hex,
    })
}

fn sha256_bytes(data: &[u8]) -> Vec<u8> {
    use sha2::Digest;
    let mut hasher = sha2::Sha256::new();
    hasher.update(data);
    hasher.finalize().to_vec()
}

fn base64url(data: &[u8]) -> String {
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(data)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rp_for_host_matches_exact_https_origins() {
        let origins = vec![
            "https://mitch.pro".to_owned(),
            "https://mitchdog.com".to_owned(),
        ];
        let (rp_id, origin) = rp_for_host("mitch.pro", &origins).unwrap();
        assert_eq!(
            (rp_id.as_str(), origin.as_str()),
            ("mitch.pro", "https://mitch.pro")
        );
        assert!(
            rp_for_host("sub.mitch.pro", &origins).is_none(),
            "no subdomain wildcard"
        );
        assert!(rp_for_host("evil.example.com", &origins).is_none());
        assert_eq!(
            rp_for_host("MITCH.PRO:443", &origins).unwrap().0,
            "mitch.pro"
        );
    }

    #[test]
    fn challenge_store_single_use_and_kind_bound() {
        let store = ChallengeStore::with_ttl(60_000);
        let challenge = store.issue("login", "user@mitch.pro", "mitch.pro", None);
        assert!(store.take(&challenge, "register").is_none(), "wrong kind");
        let challenge2 = store.issue("login", "", "", None);
        let issued = store.take(&challenge2, "login").unwrap();
        assert_eq!(issued.key, sha256_hex_str(challenge2.as_bytes()));
        assert!(store.take(&challenge2, "login").is_none(), "single-use");
    }

    #[test]
    fn credential_name_matches_js_order() {
        // The iPhone UA truncated to 120 chars loses "Safari/" → browser
        // is empty → JS returns "Passkey" (both parts must be non-empty).
        assert_eq!(guess_credential_name("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"), "Passkey");
        // Shorter UA where Safari IS within 120 chars.
        assert_eq!(guess_credential_name("iPhone AppleWebKit/605.1.15 Safari/604.1 Mozilla/5.0 (KHTML, like Gecko) Version/17.0 Mobile/15E148 more text to fill up the 120 character limit and beyond here"), "Passkey — iOS · Safari");
        assert_eq!(guess_credential_name("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"), "Passkey — macOS · Chrome");
        assert_eq!(guess_credential_name("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0"), "Passkey — Windows · Edge");
        assert_eq!(guess_credential_name("curl/8.0"), "Passkey");
    }

    #[test]
    fn client_data_verification_checks_type_challenge_origin() {
        let challenge = "test-challenge-abc";
        let key = sha256_hex_str(challenge.as_bytes());
        let cd = serde_json::json!({"type": "webauthn.get", "challenge": challenge, "origin": "https://mitch.pro"});
        let b64 =
            base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(cd.to_string().as_bytes());
        assert!(verify_client_data(&b64, "webauthn.get", &key, "https://mitch.pro").is_ok());
        assert!(verify_client_data(&b64, "webauthn.create", &key, "https://mitch.pro").is_err());
        assert!(verify_client_data(&b64, "webauthn.get", &key, "https://evil.com").is_err());
        assert!(verify_client_data(&b64, "webauthn.get", "wrongkey", "https://mitch.pro").is_err());
    }
}
