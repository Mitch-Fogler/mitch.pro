//! Matrix message moderation and word filter.
//!
//! Port of  matching blocked terms, entity decoding,
//! and word boundary normalization.

use std::sync::OnceLock;

/// Terms blocked in Matrix chat messages.
pub const MATRIX_BLOCKED_TERMS: &[&str] = &[
    "porn",
    "pornography",
    "hentai",
    "nude",
    "nudity",
    "sex",
    "nsfw",
    "xxx",
    "cocaine",
    "heroin",
    "meth",
    "marijuana",
    "weed",
    "fentanyl",
    "lsd",
    "ecstasy",
    "gun",
    "firearm",
    "bomb",
    "explosive",
    "knife",
    "shooting",
    "murder",
    "gore",
    "suicide",
    "self harm",
    "cutting",
    "casino",
    "betting",
    "sportsbook",
    "poker",
    "hacking",
    "exploit",
    "malware",
    "ransomware",
    "ddos",
    "phishing",
    "keylogger",
    "proxy",
    "vpn",
    "unblock",
    "unblocked games",
    "bypass filter",
    "tor",
    "scramjet",
    "scrammerjet",
    "ultraviolet",
    "uv proxy",
    "rammerhead",
    "corrosion",
    "rhodium",
    "wisp server",
    "bare server",
    "holy unblocker",
    "incognito unblocker",
    "titanium network",
    "interstellar proxy",
    "selenite",
    "nebula proxy",
    "metallic proxy",
    "shuttle proxy",
    "artclass",
    "luna proxy",
    "croxyproxy",
    "proxysite",
    "kproxy",
    "web proxy",
    "gn math",
    "classroom 6x",
    "coolmath",
    "coolmath games",
    "cool math games",
    "math playground",
    "hoodamath",
    "tyrone unblocked",
    "tyrone games",
    "ubg100",
    "crazygames",
    "poki",
    "now gg",
    "goguardian bypass",
    "securly bypass",
    "bypass goguardian",
    "bypass securly",
    "disable goguardian",
    "kill goguardian",
    "extension killer",
    "tab cloaker",
    "tab cloaking",
    "dextensify",
    "ltmeat",
    "caub",
    "blooket hack",
    "blooket bot",
    "kahoot bot",
    "kahoot spammer",
    "gimkit bot",
    "roblox",
    "fortnite",
    "minecraft",
    "steam",
    "discord",
    "tiktok",
    "gaming",
    "games",
    "torrent",
    "pirate bay",
    "cracked",
    "warez",
    "rom download",
    "anonymous chat",
    "omegle",
    "omegle style services",
    "chatroom",
    "chatgpt",
    "gemini",
    "claude",
    "ai chatbot",
    "fuck",
    "fucking",
    "fucker",
    "motherfucker",
    "shit",
    "bullshit",
    "bitch",
    "asshole",
    "bastard",
    "cunt",
    "dick",
    "pussy",
    "faggot",
    "nigger",
    "nigga",
    "retard",
];

/// Normalizes text for word matching: lowercase, non-alphanumeric converted to
/// spaces, whitespace collapsed and trimmed.
pub fn normalize(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut last_was_space = true;
    for c in text.chars() {
        if c.is_alphanumeric() {
            for lc in c.to_lowercase() {
                out.push(lc);
            }
            last_was_space = false;
        } else if !last_was_space {
            out.push(' ');
            last_was_space = true;
        }
    }
    out.trim().to_string()
}

/// Fallback for regexes to avoid .
fn unreachable_regex() -> regex::Regex {
    regex::Regex::new("a^").unwrap_or_else(|_| match regex::Regex::new("") {
        Ok(r) => r,
        Err(_) => unreachable!(),
    })
}

/// HTML entity decoder for message content inspection.
pub fn decode_entities(text: &str) -> String {
    static ENTITY_NUM_RE: OnceLock<regex::Regex> = OnceLock::new();
    let num_re = ENTITY_NUM_RE.get_or_init(|| {
        regex::Regex::new(r"(?i)&#(x[0-9a-f]+|\d+);?").unwrap_or_else(|_| unreachable_regex())
    });

    let s = num_re.replace_all(text, |caps: &regex::Captures| {
        let capture = &caps[1];
        let code = if capture.starts_with('x') || capture.starts_with('X') {
            u32::from_str_radix(&capture[1..], 16).ok()
        } else {
            capture.parse::<u32>().ok()
        };
        match code.and_then(char::from_u32) {
            Some(ch) => ch.to_string(),
            None => caps[0].to_string(),
        }
    });

    s.replace("&nbsp;", " ")
        .replace("&NBSP;", " ")
        .replace("&amp;", "&")
        .replace("&AMP;", "&")
        .replace("&lt;", "<")
        .replace("&LT;", "<")
        .replace("&gt;", ">")
        .replace("&GT;", ">")
        .replace("&quot;", "\"")
        .replace("&QUOT;", "\"")
        .replace("&apos;", "'")
        .replace("&APOS;", "'")
}

fn needles() -> &'static [String] {
    static NEEDLES: OnceLock<Vec<String>> = OnceLock::new();
    NEEDLES.get_or_init(|| {
        MATRIX_BLOCKED_TERMS
            .iter()
            .map(|t| format!(" {} ", normalize(t)))
            .collect()
    })
}

/// Checks whether a Matrix message content object contains blocked terms.
/// Inspects body, filename, caption, and HTML formatted body (with tags
/// removed).
pub fn matrix_message_blocked(content: &serde_json::Value) -> bool {
    if !content.is_object() {
        return false;
    }
    static TAG_RE: OnceLock<regex::Regex> = OnceLock::new();
    let tag_re = TAG_RE
        .get_or_init(|| regex::Regex::new(r"<[^>]*>").unwrap_or_else(|_| unreachable_regex()));

    let all_needles = needles();

    // Check main object and m.new_content edit replacement
    let mut variants = vec![content];
    if let Some(new_content) = content.get("m.new_content") {
        if new_content.is_object() {
            variants.push(new_content);
        }
    }

    for variant in variants {
        let mut texts = Vec::new();
        if let Some(body) = variant.get("body").and_then(|v| v.as_str()) {
            texts.push(body.to_string());
        }
        if let Some(filename) = variant.get("filename").and_then(|v| v.as_str()) {
            texts.push(filename.to_string());
        }
        if let Some(caption) = variant.get("caption").and_then(|v| v.as_str()) {
            texts.push(caption.to_string());
        }
        if let Some(formatted_body) = variant.get("formatted_body").and_then(|v| v.as_str()) {
            // Removing formatting catches split words such as pro<b>x</b>y
            let stripped_empty = tag_re.replace_all(formatted_body, "").to_string();
            let stripped_space = tag_re.replace_all(formatted_body, " ").to_string();
            texts.push(decode_entities(&stripped_empty));
            texts.push(decode_entities(&stripped_space));
        }

        for text in texts {
            let padded = format!(" {} ", normalize(&text));
            for needle in all_needles {
                if padded.contains(needle) {
                    return true;
                }
            }
        }
    }

    false
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_clean_message_passes() {
        let msg = json!({
            "msgtype": "m.text",
            "body": "Hello world, hope you have a nice class today!"
        });
        assert!(!matrix_message_blocked(&msg));
    }

    #[test]
    fn test_innocent_substrings_pass() {
        let msg = json!({
            "body": "This class uses a new method to study Torres Strait."
        });
        assert!(!matrix_message_blocked(&msg));
    }

    #[test]
    fn test_blocked_word_triggers() {
        let msg = json!({
            "body": "Let's play roblox right now"
        });
        assert!(matrix_message_blocked(&msg));

        let msg2 = json!({
            "body": "Do you know a good VPN?"
        });
        assert!(matrix_message_blocked(&msg2));
    }

    #[test]
    fn test_html_tag_bypass_detected() {
        let msg = json!({
            "body": "check this out",
            "format": "org.matrix.custom.html",
            "formatted_body": "pro<b>x</b>y site here"
        });
        assert!(matrix_message_blocked(&msg));
    }

    #[test]
    fn test_edit_content_checked() {
        let msg = json!({
            "body": "clean text initially",
            "m.new_content": {
                "body": "edited to mention discord"
            }
        });
        assert!(matrix_message_blocked(&msg));
    }
}
