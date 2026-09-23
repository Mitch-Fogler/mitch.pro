//! Guest preview token verification — port of lib/guest_preview.js.
//!
//! Evaluates and mints signed timestamps in format:
//! `<issued-ms>.<HMAC-SHA256(secret, issued-ms)>`
//!
//! Validates:
//! - 13-digit timestamp
//! - 64-char lowercase hex HMAC signature
//! - constant-time comparison
//! - issued timestamp <= serverNow
//!
//! Valid tokens return the original issued timestamp with expiresAt = issued + 60,000ms.
//! Missing/tampered/expired tokens start a fresh trial at serverNow.

use crate::crypto::hmac_sha256_hex;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct GuestPreviewState {
    pub token: String,
    pub expires_at: i64,
    pub server_now: i64,
}

pub fn guest_preview(token: &str, secret: &[u8], now: i64) -> GuestPreviewState {
    let sign = |value: &str| -> String { hmac_sha256_hex(secret, value.as_bytes()) };

    let mut parts = token.split('.');
    let issued = parts.next().unwrap_or("");
    let signature = parts.next().unwrap_or("");

    let valid = if issued.len() == 13
        && issued.chars().all(|c| c.is_ascii_digit())
        && signature.len() == 64
        && signature.chars().all(|c| c.is_ascii_hexdigit())
    {
        let expected = sign(issued);
        // Constant-time hex string equality check
        if signature.len() == expected.len() {
            let mut diff = 0u8;
            for (a, b) in signature.bytes().zip(expected.bytes()) {
                diff |= a ^ b;
            }
            if diff == 0 {
                let issued_num: i64 = issued.parse().unwrap_or(i64::MAX);
                issued_num <= now
            } else {
                false
            }
        } else {
            false
        }
    } else {
        false
    };

    let started_at = if valid {
        issued.parse::<i64>().unwrap_or(now)
    } else {
        now
    };

    GuestPreviewState {
        token: format!("{started_at}.{}", sign(&started_at.to_string())),
        expires_at: started_at + 60000,
        server_now: now,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_guest_preview_cycle() {
        let secret = b"test-secret-key-1234";
        let now = 1700000000000i64;

        let trial = guest_preview("", secret, now);
        assert_eq!(trial.server_now, now);
        assert_eq!(trial.expires_at, now + 60000);

        // Refresh must not restart preview
        let refreshed = guest_preview(&trial.token, secret, now + 30000);
        assert_eq!(refreshed.expires_at, trial.expires_at);

        // Expired preview stays expired
        let expired = guest_preview(&trial.token, secret, now + 61000);
        assert!(expired.expires_at < now + 61000);

        // Tampered signatures rejected
        let mut tampered = trial.token.clone();
        tampered.pop();
        tampered.push('z');
        let rejected = guest_preview(&tampered, secret, now + 10);
        assert_ne!(rejected.token, trial.token);
        assert_eq!(rejected.expires_at, now + 10 + 60000);
    }
}
