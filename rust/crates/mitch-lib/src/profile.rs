//! Profile/member identity helpers (server.js:2326-2364, 6043-6174).
//! Byte-compatible ports of `normalizeUsername`, `defaultUsernameForEmail`,
//! `getUidForEmail`, `resolveTargetEmail`, `processMemberFields`, and the
//! profile-image URL sanitizers.

use crate::auth;
use crate::data::DataStore;
use serde_json::{json, Value};
use std::path::Path;

/// `normalizeUsername` (server.js:2326-2328).
pub fn normalize_username(username: &str) -> String {
    username.trim().to_lowercase()
}

/// `defaultUsernameForEmail` (server.js:2334-2345) without the optional
/// `used` dedup set (the member-list call sites never pass one).
pub fn default_username_for_email(email: &str) -> String {
    let local: String = email
        .split('@')
        .next()
        .unwrap_or("")
        .to_lowercase()
        .chars()
        .map(|c| {
            if c.is_ascii_lowercase() || c.is_ascii_digit() || c == '.' || c == '_' || c == '-' {
                c
            } else {
                '-'
            }
        })
        .collect();
    // Collapse runs of '-', trim leading/trailing [._-].
    let mut collapsed = String::new();
    let mut last_dash = false;
    for c in local.chars() {
        if c == '-' {
            if !last_dash {
                collapsed.push(c);
            }
            last_dash = true;
        } else {
            collapsed.push(c);
            last_dash = false;
        }
    }
    let trimmed = collapsed
        .trim_start_matches(['.', '_', '-'])
        .trim_end_matches(['.', '_', '-']);
    if trimmed.is_empty() {
        "user".to_string()
    } else {
        trimmed.to_string()
    }
}

/// `processMemberFields` (server.js:6147-6174). When `profile` is `None` the
/// profiles document is loaded here, exactly like the JS lazy load.
pub fn process_member_fields(
    store: &DataStore,
    data_dir: &Path,
    member_email: &str,
    profile: Option<&Value>,
    viewer_email: Option<&str>,
) -> Value {
    if member_email.is_empty() {
        return json!({ "displayName": Value::Null, "email": "" });
    }
    let norm_target = auth::normalize_email(member_email);
    let norm_viewer = viewer_email.map(auth::normalize_email).unwrap_or_default();
    let viewer_can_see = norm_viewer == norm_target
        || auth::is_admin_email(store, viewer_email.unwrap_or(""))
        || auth::is_moderator_email(store, viewer_email.unwrap_or(""));
    let profiles;
    let p = match profile {
        Some(p) => p.clone(),
        None => {
            profiles = store.read_document(&data_dir.join("profiles.json"), json!({}));
            profiles
                .get(norm_target.as_str())
                .cloned()
                .unwrap_or(json!({}))
        }
    };
    let username = p
        .get("username")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| default_username_for_email(&norm_target));
    // A saved display name must be visible to other members (JS comment at
    // server.js:6156) — nickname/displayName win over the generated username.
    let public_name = p
        .get("nickname")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .or_else(|| {
            p.get("displayName")
                .and_then(|v| v.as_str())
                .filter(|s| !s.is_empty())
        })
        .unwrap_or(username.as_str())
        .to_string();
    if !viewer_can_see {
        return json!({ "displayName": public_name, "email": username });
    }
    json!({
        "displayName": public_name,
        "email": crate::admin::mask_email(member_email),
    })
}

/// `getUidForEmail` (server.js:6043-6059): names.json reverse lookup, then
/// the current-generation email id.
pub fn get_uid_for_email(store: &DataStore, id_secret: &[u8], email: &str) -> Option<String> {
    if email.is_empty() {
        return None;
    }
    let norm = auth::normalize_email(email);
    let names = store.read_document(&store.base_dir.join(crate::auth::names_file()), json!({}));
    if let Some(map) = names.as_object() {
        for (sid, e) in map {
            if e.as_str()
                .map(|s| auth::normalize_email(s) == norm)
                .unwrap_or(false)
            {
                return Some(sid.clone());
            }
        }
    }
    let gen = auth::current_session_generation(store, &norm);
    Some(auth::make_email_id(&norm, gen.max(0) as u64, id_secret))
}

/// `resolveTargetEmail` (server.js:6060-6124): direct/normalized match, then
/// mask/uid match, then username/displayName exact, then local part, then
/// substring. All against passwords.json + profiles.json.
pub fn resolve_target_email(
    store: &DataStore,
    data_dir: &Path,
    id_secret: &[u8],
    input: &str,
) -> Option<String> {
    if input.is_empty() {
        return None;
    }
    let target = input.trim().to_lowercase();
    if target.is_empty() {
        return None;
    }
    let passwords = store.read_document(&data_dir.join("passwords.json"), json!({}));
    let password_map = passwords.as_object()?;
    let emails: Vec<String> = password_map
        .keys()
        .map(|e| e.trim().to_lowercase())
        .collect();
    let has_pw = |email: &str| password_map.contains_key(email);

    // 1. Direct or normalized match.
    if has_pw(&target) {
        return Some(target);
    }
    let norm_target = auth::normalize_email(&target);
    if has_pw(&norm_target) {
        return Some(norm_target.clone());
    }

    // 2. Match by maskEmail or getUidForEmail.
    let trimmed_input = input.trim().to_string();
    for email in &emails {
        if auth::normalize_email(email) == norm_target {
            return Some(email.clone());
        }
        if crate::admin::mask_email(email).to_lowercase() == target {
            return Some(email.clone());
        }
        if get_uid_for_email(store, id_secret, email).as_deref() == Some(trimmed_input.as_str()) {
            return Some(email.clone());
        }
    }

    // 3. Match by username / displayName (exact, case-insensitive).
    let profiles = store.read_document(&data_dir.join("profiles.json"), json!({}));
    if let Some(map) = profiles.as_object() {
        for (norm_email, profile) in map {
            if let Some(username) = profile.get("username").and_then(|v| v.as_str()) {
                if normalize_username(username) == target && has_pw(norm_email) {
                    return Some(norm_email.clone());
                }
            }
            if let Some(display) = profile.get("displayName").and_then(|v| v.as_str()) {
                if display.to_lowercase().trim().to_string() == target && has_pw(norm_email) {
                    return Some(norm_email.clone());
                }
            }
        }
    }

    // 4. Match by local part.
    for email in &emails {
        if email.split('@').next() == Some(target.as_str()) {
            return Some(email.clone());
        }
    }

    // 5. Match by display-name substring.
    if let Some(map) = profiles.as_object() {
        for (norm_email, profile) in map {
            if let Some(username) = profile.get("username").and_then(|v| v.as_str()) {
                if normalize_username(username).contains(&target) && has_pw(norm_email) {
                    return Some(norm_email.clone());
                }
            }
            if let Some(display) = profile.get("displayName").and_then(|v| v.as_str()) {
                if display.to_lowercase().contains(&target) && has_pw(norm_email) {
                    return Some(norm_email.clone());
                }
            }
        }
    }

    None
}

/// `PROFILE_IMAGE_MIME_RE` (server.js:2058).
fn profile_image_mime_ok(mime: &str) -> bool {
    let lower = mime.to_lowercase();
    matches!(
        lower.as_str(),
        "image/png" | "image/jpeg" | "image/jpg" | "image/webp" | "image/gif"
    )
}

/// `sanitizeProfileImageUrl` (server.js:2060-2097). `allow_data` maps to
/// `opts.allowData !== false`; `max_url_length`/`max_data_bytes` to the opts.
pub fn sanitize_profile_image_url(
    value: &str,
    allow_data: bool,
    max_url_length: usize,
    max_data_bytes: usize,
) -> String {
    let raw = value.trim();
    if raw.is_empty() {
        return String::new();
    }
    if raw
        .chars()
        .any(|c| c < '\u{20}' || c == '\u{7f}' || matches!(c, '<' | '>' | '"' | '`'))
    {
        return String::new();
    }

    if raw.to_lowercase().starts_with("data:") {
        if !allow_data {
            return String::new();
        }
        // ^data:([^;,]+);base64,([a-z0-9+/=\s]+)$
        let rest = &raw[5..];
        let Some((mime_part, payload)) = rest.split_once(";base64,") else {
            return String::new();
        };
        if mime_part.contains(';') || mime_part.contains(',') {
            return String::new();
        }
        if !profile_image_mime_ok(mime_part) {
            return String::new();
        }
        // JS validates the base64 charset with ([a-z0-9+/=\s]+) anchored at
        // both ends, then strips whitespace.
        let charset_ok = payload.chars().all(|c| {
            c.is_ascii_lowercase()
                || c.is_ascii_uppercase()
                || c.is_ascii_digit()
                || matches!(c, '+' | '/' | '=' | ' ' | '\t' | '\n' | '\r')
        });
        if !charset_ok {
            return String::new();
        }
        let stripped: String = payload.chars().filter(|c| !c.is_whitespace()).collect();
        if stripped.is_empty() || stripped.len() % 4 != 0 {
            return String::new();
        }
        let bytes = crate::crypto::base64_decode(&stripped);
        if bytes.is_empty() || bytes.len() > max_data_bytes {
            return String::new();
        }
        format!("data:{};base64,{}", mime_part, stripped)
    } else {
        if raw.len() > max_url_length {
            return String::new();
        }
        match url::Url::parse(raw) {
            Ok(u) => {
                if u.scheme() != "https" && u.scheme() != "http" {
                    return String::new();
                }
                if u.username() != "" || u.password().is_some() {
                    return String::new();
                }
                // JS new URL lowercases the host; u.to_string() differs from
                // u.href only in trailing-slash normalization both share.
                u.to_string()
            }
            Err(_) => String::new(),
        }
    }
}

/// `sanitizeProfileWebsiteUrl` (server.js:2092-2104).
pub fn sanitize_profile_website_url(value: &str) -> String {
    let raw = value.trim();
    if raw.is_empty() || raw.len() > 300 {
        return String::new();
    }
    if raw
        .chars()
        .any(|c| c.is_control() || matches!(c, '<' | '>' | '"' | '`'))
    {
        return String::new();
    }
    match url::Url::parse(raw) {
        Ok(u) => {
            if u.scheme() != "https" && u.scheme() != "http" {
                return String::new();
            }
            u.to_string()
        }
        Err(_) => String::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_usernames_match_js() {
        assert_eq!(
            default_username_for_email("Mitch Fogler@mitch.pro"),
            "mitch-fogler"
        );
        assert_eq!(default_username_for_email("a@b.c"), "a");
        assert_eq!(default_username_for_email("...@@@"), "user");
        assert_eq!(default_username_for_email("--x--@y.z"), "x");
    }

    #[test]
    fn image_url_rejects_control_chars_and_bad_mime() {
        assert_eq!(
            sanitize_profile_image_url("https://x.test/a.png", true, 1000, 100),
            "https://x.test/a.png"
        );
        assert_eq!(
            sanitize_profile_image_url("javascript:alert(1)", true, 1000, 100),
            ""
        );
        assert_eq!(
            sanitize_profile_image_url("https://u:p@x.test/a.png", true, 1000, 100),
            ""
        );
        assert_eq!(
            sanitize_profile_image_url("data:text/html;base64,AAAA", true, 1000, 100),
            ""
        );
        assert_eq!(
            sanitize_profile_image_url("data:image/png;base64,aGk=", true, 1000, 100),
            "data:image/png;base64,aGk="
        );
        assert_eq!(
            sanitize_profile_image_url("data:image/png;base64,!!!", true, 1000, 100),
            ""
        );
    }
}
