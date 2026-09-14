//! Blog/Bulletin HTML sanitization — port of server.js:5123-6640's helpers
//! (`htmlEsc`, `safeBlogUrl`, `legacyBlogHtmlFromText`, `sanitizeBlogHtml`).
//! Shared by the blog endpoints and the SPC Club Bulletin.

use regex::Regex;
use std::sync::OnceLock;

/// `htmlEsc` (server.js:5123).
pub fn html_esc(v: &str) -> String {
    v.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

/// `safeBlogUrl` (server.js:6527).
pub fn safe_blog_url(value: &str, image: bool) -> String {
    let raw = crate::jsval::js_slice_utf16(value.trim(), 800);
    static HTTP_RE: OnceLock<Regex> = OnceLock::new();
    let http_re = HTTP_RE
        .get_or_init(|| Regex::new(r"(?i)^https?://").unwrap_or_else(|_| unreachable_regex()));
    if http_re.is_match(&raw) {
        return raw;
    }
    if !image && (raw.starts_with('/') || starts_with_mailto(&raw)) {
        return raw;
    }
    String::new()
}

fn starts_with_mailto(raw: &str) -> bool {
    static MAILTO_RE: OnceLock<Regex> = OnceLock::new();
    let re = MAILTO_RE.get_or_init(|| {
        Regex::new(r"(?i)^mailto:[^@\s]+@[^@\s]+\.[^@\s]+$").unwrap_or_else(|_| unreachable_regex())
    });
    re.is_match(raw)
}

fn unreachable_regex() -> Regex {
    Regex::new("$^").unwrap_or_else(|_| unreachable!())
}

/// `legacyBlogHtmlFromText` (server.js:6549) — split on runs of 2+ newlines.
pub fn legacy_blog_html_from_text(text: &str) -> String {
    static SPLIT_RE: OnceLock<Regex> = OnceLock::new();
    let split_re =
        SPLIT_RE.get_or_init(|| Regex::new(r"\n{2,}").unwrap_or_else(|_| unreachable_regex()));
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return "<p></p>".to_string();
    }
    let parts: Vec<String> = split_re.split(trimmed).map(str::to_string).collect();
    if parts.is_empty() {
        return "<p></p>".to_string();
    }
    parts
        .into_iter()
        .map(|part| format!("<p>{}</p>", html_esc(&part).replace('\n', "<br>")))
        .collect()
}

/// `sanitizeBlogHtml` (server.js:6555-6594). Removes comments/doctypes/banned
/// block elements, then rewrites every remaining tag to the allowlist (`a`/`img`
/// keep only their href/src/alt attrs, escaped).
pub fn sanitize_blog_html(input: &str, fallback_text: &str) -> String {
    let html = crate::jsval::js_slice_utf16(input, 60_000);
    let mut html = if html.trim().is_empty() && !fallback_text.is_empty() {
        legacy_blog_html_from_text(fallback_text)
    } else {
        html
    };

    static NULL_RE: OnceLock<Regex> = OnceLock::new();
    static COMMENT_RE: OnceLock<Regex> = OnceLock::new();
    static DOCTYPE_RE: OnceLock<Regex> = OnceLock::new();
    static BLOCK_PAIR_RES: OnceLock<Vec<Regex>> = OnceLock::new();
    static BLOCK_TAG_RE: OnceLock<Regex> = OnceLock::new();
    static TAG_RE: OnceLock<Regex> = OnceLock::new();

    const BANNED: [&str; 15] = [
        "script", "style", "iframe", "object", "embed", "svg", "math", "form", "input", "button",
        "select", "textarea", "meta", "link", "base",
    ];

    let null_re =
        NULL_RE.get_or_init(|| Regex::new(r"\x00").unwrap_or_else(|_| unreachable_regex()));
    let comment_re = COMMENT_RE
        .get_or_init(|| Regex::new(r"(?s)<!--[\s\S]*?-->").unwrap_or_else(|_| unreachable_regex()));
    let doctype_re = DOCTYPE_RE
        .get_or_init(|| Regex::new(r"(?i)<!doctype[^>]*>").unwrap_or_else(|_| unreachable_regex()));
    // Banned paired blocks: <tag ...>...</tag>. The regex crate has no
    // backreferences, so the JS combined pattern is reproduced as one
    // compiled pair-regex per banned tag (same `<open ...>[\s\S]*?</close>`
    // lazy-scan semantics).
    let block_pair_res = BLOCK_PAIR_RES.get_or_init(|| {
        BANNED
            .iter()
            .map(|tag| {
                Regex::new(&format!(r"(?is)<\s*{tag}[^>]*>[\s\S]*?<\s*/\s*{tag}\s*>"))
                    .unwrap_or_else(|_| unreachable_regex())
            })
            .collect()
    });
    let block_tag_re = BLOCK_TAG_RE.get_or_init(|| {
        Regex::new(r"(?i)<\s*/?\s*(script|style|iframe|object|embed|svg|math|form|input|button|select|textarea|meta|link|base)[^>]*>")
            .unwrap_or_else(|_| unreachable_regex())
    });
    let tag_re = TAG_RE.get_or_init(|| {
        Regex::new(r"(?i)<\s*(/?)([a-z0-9-]+)([^>]*)>").unwrap_or_else(|_| unreachable_regex())
    });

    html = null_re.replace_all(&html, "").into_owned();
    html = comment_re.replace_all(&html, "").into_owned();
    html = doctype_re.replace_all(&html, "").into_owned();
    for re in block_pair_res {
        html = re.replace_all(&html, "").into_owned();
    }
    html = block_tag_re.replace_all(&html, "").into_owned();

    static HREF_RE: OnceLock<Regex> = OnceLock::new();
    static SRC_RE: OnceLock<Regex> = OnceLock::new();
    static ALT_RE: OnceLock<Regex> = OnceLock::new();
    let attr_re = |re: &'static OnceLock<Regex>, pat: &'static str| -> &'static Regex {
        re.get_or_init(|| Regex::new(pat).unwrap_or_else(|_| unreachable_regex()))
    };
    let href_re = attr_re(
        &HREF_RE,
        r#"(?i)\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))"#,
    );
    let src_re = attr_re(
        &SRC_RE,
        r#"(?i)\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))"#,
    );
    let alt_re = attr_re(
        &ALT_RE,
        r#"(?i)\balt\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))"#,
    );

    let out = tag_re
        .replace_all(&html, |caps: &regex::Captures| {
            let is_close = caps.get(1).map(|m| !m.as_str().is_empty()).unwrap_or(false);
            let raw_tag = caps.get(2).map(|m| m.as_str()).unwrap_or("");
            let attrs = caps.get(3).map(|m| m.as_str()).unwrap_or("");
            let lower = raw_tag.to_lowercase();
            let allowed = [
                "p",
                "br",
                "strong",
                "b",
                "em",
                "i",
                "u",
                "s",
                "a",
                "h2",
                "h3",
                "ul",
                "ol",
                "li",
                "blockquote",
                "pre",
                "code",
                "img",
                "hr",
                "span",
                "div",
            ];
            if !allowed.contains(&lower.as_str()) {
                return String::new();
            }
            let tag = match lower.as_str() {
                "div" => "p",
                "b" => "strong",
                "i" => "em",
                _ => lower.as_str(),
            };
            if is_close {
                return if tag == "br" || tag == "hr" || tag == "img" {
                    String::new()
                } else {
                    format!("</{tag}>")
                };
            }
            match tag {
                "br" | "hr" => format!("<{tag}>"),
                "a" => {
                    let href = href_re
                        .captures(attrs)
                        .and_then(|c| {
                            [1, 2, 3]
                                .iter()
                                .find_map(|i| c.get(*i).map(|m| m.as_str().to_string()))
                        })
                        .unwrap_or_default();
                    let href = safe_blog_url(&href, false);
                    if href.is_empty() {
                        "<a>".to_string()
                    } else {
                        format!(
                            "<a href=\"{}\" target=\"_blank\" rel=\"noopener noreferrer\">",
                            html_esc(&href)
                        )
                    }
                }
                "img" => {
                    let src = src_re
                        .captures(attrs)
                        .and_then(|c| {
                            [1, 2, 3]
                                .iter()
                                .find_map(|i| c.get(*i).map(|m| m.as_str().to_string()))
                        })
                        .unwrap_or_default();
                    let src = safe_blog_url(&src, true);
                    if src.is_empty() {
                        return String::new();
                    }
                    let alt = alt_re
                        .captures(attrs)
                        .and_then(|c| {
                            [1, 2, 3]
                                .iter()
                                .find_map(|i| c.get(*i).map(|m| m.as_str().to_string()))
                        })
                        .unwrap_or_default();
                    let alt = crate::jsval::js_slice_utf16(&alt, 140);
                    format!(
                        "<img src=\"{}\" alt=\"{}\">",
                        html_esc(&src),
                        html_esc(&alt)
                    )
                }
                other => format!("<{other}>"),
            }
        })
        .into_owned();

    crate::jsval::js_slice_utf16(&out, 60_000)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_strips_banned_and_allowlists() {
        assert_eq!(sanitize_blog_html("<p>hi</p>", ""), "<p>hi</p>");
        assert_eq!(
            sanitize_blog_html("<script>alert(1)</script><b>x</b>", ""),
            "<strong>x</strong>"
        );
        assert_eq!(
            sanitize_blog_html("<div class=y>d</div><i>i</i>", ""),
            "<p>d</p><em>i</em>"
        );
        assert_eq!(sanitize_blog_html("<hr><br>", ""), "<hr><br>");
        assert_eq!(sanitize_blog_html("</img></br></hr>", ""), "");
        // Golden-reference cases verified against the JS (bun).
        assert_eq!(
            sanitize_blog_html("<img src=\"https://x/y.png\" alt=\"a<b\">", ""),
            "<img src=\"https://x/y.png\" alt=\"a&lt;b\">"
        );
        // Relative img srcs are dropped (safeBlogUrl(value, image=true) only
        // allows absolute http(s)).
        assert_eq!(sanitize_blog_html("<img src=\"/x.png\" alt=\"z\">", ""), "");
        assert_eq!(
            sanitize_blog_html("<IMG SRC=\"https://a/b.PNG\">", ""),
            "<img src=\"https://a/b.PNG\" alt=\"\">"
        );
        // Pair removal extends past mismatched close tags to the real one.
        assert_eq!(
            sanitize_blog_html("<script>x</div>y</script>keep", ""),
            "keep"
        );
        assert_eq!(
            sanitize_blog_html("<a href='javascript:x'>y</a>", ""),
            "<a>y</a>"
        );
        assert_eq!(
            sanitize_blog_html("<a href=\"https://m.pro/q\">y</a>", ""),
            "<a href=\"https://m.pro/q\" target=\"_blank\" rel=\"noopener noreferrer\">y</a>"
        );
        // comments + doctype removed
        assert_eq!(
            sanitize_blog_html("<!--c--><!DOCTYPE html><u>z</u>", ""),
            "<u>z</u>"
        );
        // empty input falls back to text
        assert_eq!(sanitize_blog_html("", "a\n\nb"), "<p>a</p><p>b</p>");
        assert_eq!(sanitize_blog_html("", ""), "");
    }
}
