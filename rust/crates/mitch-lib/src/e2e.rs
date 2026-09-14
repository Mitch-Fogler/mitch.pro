//! User E2E identity keys (server.js:4001-4029) — the server-derived
//! fallback P-256 keypair from `HMAC-SHA256(ID_SECRET, email)`.
//!
//! JS does `createECDH('prime256v1').setPrivateKey(seed)`; OpenSSL accepts
//! any 32-byte scalar and the public key equals (seed mod n)·G, so the Rust
//! side reduces the seed modulo the curve order the same way. `jwk.d` is the
//! RAW seed (not reduced), exactly like the JS `seed.toString('base64url')`.

use crate::crypto::hmac_sha256;
use base64::Engine;
use p256::elliptic_curve::bigint::prelude::ArrayEncoding;
use p256::elliptic_curve::bigint::U256;
use p256::elliptic_curve::ops::Reduce;
use p256::elliptic_curve::sec1::ToEncodedPoint;

/// `deriveUserE2EKeys(email)` → (jwk object, pubKeyHex).
pub fn derive_user_e2e_keys(id_secret: &[u8], email: &str) -> (serde_json::Value, String) {
    let seed = hmac_sha256(id_secret, email.to_lowercase().trim().as_bytes());
    let jwk_d = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(seed);

    // Reduce the 32-byte seed modulo the P-256 group order (Node/OpenSSL
    // semantics for out-of-range scalars). The HMAC output is zero modulo
    // the order only with ~2^-256 probability; treat that as unreachable.
    let scalar = <p256::Scalar as Reduce<U256>>::reduce(U256::from_be_byte_array(seed.into()));
    // subtle's CtOption::unwrap_or_else evaluates the closure eagerly (it is
    // constant-time), so route through Option whose unwrap_or_else is lazy.
    let nzs = Option::<p256::NonZeroScalar>::from(p256::NonZeroScalar::new(scalar))
        .unwrap_or_else(|| unreachable!("hmac seed is nonzero modulo the order"));
    let secret_key = p256::SecretKey::from(nzs);

    let pub_key = secret_key.public_key();
    let encoded = pub_key.to_encoded_point(false); // 0x04 || X || Y (65 bytes)
    let bytes = encoded.as_bytes();
    let x = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(&bytes[1..33]);
    let y = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(&bytes[33..65]);
    let pub_key_hex: String = bytes.iter().map(|b| format!("{b:02x}")).collect();

    let jwk = serde_json::json!({
        "kty": "EC",
        "crv": "P-256",
        "x": x,
        "y": y,
        "d": jwk_d,
    });
    (jwk, pub_key_hex)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn derivation_is_deterministic_and_valid_p256() {
        let secret = [7u8; 32];
        let (jwk1, pub_hex1) = derive_user_e2e_keys(&secret, "User@Example.com ");
        let (jwk2, pub_hex2) = derive_user_e2e_keys(&secret, "user@example.com");
        assert_eq!(pub_hex1, pub_hex2);
        assert_eq!(jwk1, jwk2);
        assert_eq!(pub_hex1.len(), 130); // 65 bytes hex
        assert_eq!(jwk1["kty"], "EC");
        assert_eq!(jwk1["crv"], "P-256");
        // jwk.d is the raw 32-byte seed in base64url (43 chars, no padding).
        assert_eq!(jwk1["d"].as_str().unwrap().len(), 43);
        // x/y decode back to 32 bytes each.
        for k in ["x", "y"] {
            let s = jwk1[k].as_str().unwrap();
            assert_eq!(s.len(), 43);
        }
    }
}
