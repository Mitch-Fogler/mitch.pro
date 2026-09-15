//! Local-time date helpers matching the JS `Date` methods the endpoints use.
//!
//! The dev/prod hosts run in `America/Los_Angeles`; JS `Date` methods like
//! `toDateString()` / `getFullYear()` use the process-local timezone, which
//! std Rust has no access to — chrono's `clock` feature reads the system TZ
//! database, so those conversions go through `chrono::Local`.

use chrono::{Datelike, TimeZone};

const WEEKDAYS: [&str; 7] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS: [&str; 12] = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/// `new Date(ms).toDateString()` — `Mon Sep 14 2026`, zero-padded day,
/// process-local timezone.
pub fn js_to_date_string(millis: i64) -> String {
    let local = match chrono::Local.timestamp_millis_opt(millis) {
        chrono::LocalResult::Single(dt) => dt,
        _ => return String::new(),
    };
    format!(
        "{} {} {:02} {}",
        WEEKDAYS[local.weekday().num_days_from_sunday() as usize],
        MONTHS[(local.month0()) as usize],
        local.day(),
        local.year()
    )
}

/// `date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate()`
/// — the seed lillians-logic uses to pick the daily wordle word.
pub fn js_date_seed(millis: i64) -> i64 {
    let local = match chrono::Local.timestamp_millis_opt(millis) {
        chrono::LocalResult::Single(dt) => dt,
        _ => return 0,
    };
    local.year() as i64 * 10000 + (local.month() as i64) * 100 + local.day() as i64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn date_string_shape() {
        // Format check only (local timezone varies): "Www Mmm DD YYYY".
        let s = js_to_date_string(0);
        let parts: Vec<&str> = s.split(' ').collect();
        assert_eq!(parts.len(), 4);
        assert!(WEEKDAYS.contains(&parts[0]));
        assert!(MONTHS.contains(&parts[1]));
        assert_eq!(parts[2].len(), 2);
        assert!(parts[3].parse::<i32>().is_ok());
        // Epoch in any timezone is 1969 or 1970.
        assert!(parts[3] == "1969" || parts[3] == "1970");
    }

    #[test]
    fn seed_matches_ymd_shape() {
        let seed = js_date_seed(0);
        // year*10000 + month*100 + day — 19691231/19700101 boundaries.
        assert!(seed / 10000 == 1969 || seed / 10000 == 1970);
    }
}
