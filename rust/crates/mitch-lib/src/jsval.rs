//! JavaScript value-coercion helpers shared across ports (`String(v)`,
//! truthiness, `||` fallbacks, `Number()`, `toLocaleString`).
//!
//! server.js leans on JS coercion everywhere; these helpers keep the Rust
//! ports honest at the edges (absent keys, `0`/`''`/`null` fallbacks).

use serde_json::Value;

/// JS truthiness (undefined/null false; 0, '', NaN false; objects/arrays true).
pub fn truthy(v: &Value) -> bool {
    match v {
        Value::Null => false,
        Value::Bool(b) => *b,
        Value::Number(n) => n.as_f64().map(|f| f != 0.0 && !f.is_nan()).unwrap_or(false),
        Value::String(s) => !s.is_empty(),
        Value::Array(_) | Value::Object(_) => true,
    }
}

/// `String(v)` for a present value (null → "null", objects → JSON-ish).
pub fn string(v: &Value) -> String {
    match v {
        Value::String(s) => s.clone(),
        Value::Null => "null".to_string(),
        Value::Bool(b) => b.to_string(),
        Value::Number(n) => n.to_string(),
        Value::Array(a) => a
            .iter()
            .map(|e| match e {
                Value::Null | Value::Object(_) => String::new(),
                other => string(other),
            })
            .collect::<Vec<_>>()
            .join(","),
        Value::Object(_) => "[object Object]".to_string(),
    }
}

/// `String(v)` where an absent key means `undefined` → "undefined".
pub fn string_of(v: Option<&Value>) -> String {
    match v {
        None => "undefined".to_string(),
        Some(val) => string(val),
    }
}

/// `v || fallback` keeping the raw value when truthy (a truthy number stays
/// a number in the response body, exactly like JS).
pub fn or(v: Option<&Value>, fallback: Value) -> Value {
    match v {
        Some(val) if truthy(val) => val.clone(),
        _ => fallback,
    }
}

/// `${v || fallback}` inside a template literal — truthy raw value stringified.
pub fn str_or(v: Option<&Value>, fallback: &str) -> String {
    match v {
        Some(val) if truthy(val) => string(val),
        _ => fallback.to_string(),
    }
}

/// `String.prototype.slice(0, end)` — UTF-16 code-unit semantics (emoji count
/// as 2). A cut landing mid-surrogate-pair drops the whole pair (the JS output
/// would carry a lone surrogate, which JSON can't represent either).
pub fn js_slice_utf16(s: &str, end: usize) -> String {
    let mut units = 0usize;
    let mut out = String::new();
    for c in s.chars() {
        let len = if (c as u32) > 0xFFFF { 2 } else { 1 };
        if units + len > end {
            break;
        }
        units += len;
        out.push(c);
    }
    out
}

/// A whole double as a JSON value without a trailing `.0` — the
/// `JSON.stringify` rendering of a JS number (NaN/Infinity become null).
pub fn num_value(n: f64) -> Value {
    if n.is_finite() && n.fract() == 0.0 && n.abs() < 9.007_199_254_740_992e15 {
        serde_json::json!(n as i64)
    } else {
        serde_json::json!(n)
    }
}

/// `Number(v)` → `None` for NaN (object, non-numeric string, sparse array).
pub fn number(v: &Value) -> Option<f64> {
    match v {
        Value::Number(n) => n.as_f64(),
        Value::Null => Some(0.0),
        Value::Bool(b) => Some(if *b { 1.0 } else { 0.0 }),
        Value::String(s) => {
            let t = s.trim();
            if t.is_empty() {
                Some(0.0)
            } else {
                t.parse::<f64>().ok()
            }
        }
        Value::Array(a) => {
            if a.is_empty() {
                Some(0.0)
            } else if a.len() == 1 {
                match &a[0] {
                    Value::Null | Value::Bool(_) | Value::Number(_) | Value::String(_) => {
                        number(&a[0])
                    }
                    _ => None,
                }
            } else {
                None
            }
        }
        Value::Object(_) => None,
    }
}

/// `Number.prototype.toLocaleString()` default (en-US): grouping, ≤3
/// fraction digits, half-up rounding at the 4th decimal.
pub fn number_to_locale_string(n: f64) -> String {
    if !n.is_finite() {
        return if n.is_nan() {
            "NaN".to_string()
        } else if n > 0.0 {
            "Infinity".to_string()
        } else {
            "-Infinity".to_string()
        };
    }
    let neg = n < 0.0;
    let abs = n.abs();
    let rounded = (abs * 1000.0).round() / 1000.0;
    let int_part = rounded.trunc();
    let frac = rounded - int_part;
    let digits = format!("{:.0}", int_part);
    let mut grouped = String::new();
    for (i, c) in digits.chars().enumerate() {
        if i > 0 && (digits.len() - i) % 3 == 0 {
            grouped.push(',');
        }
        grouped.push(c);
    }
    let mut out = String::new();
    if neg && (int_part != 0.0 || frac > 0.0) {
        out.push('-');
    }
    out.push_str(&grouped);
    if frac > 0.0 {
        let frac_digits = format!("{:.3}", frac)[2..]
            .trim_end_matches('0')
            .to_string();
        if !frac_digits.is_empty() {
            out.push('.');
            out.push_str(&frac_digits);
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn truthiness_matches_js() {
        assert!(!truthy(&json!(0)));
        assert!(truthy(&json!(0.5)));
        assert!(!truthy(&json!("")));
        assert!(truthy(&json!([])));
        assert!(truthy(&json!({})));
        assert!(!truthy(&Value::Null));
    }
}
