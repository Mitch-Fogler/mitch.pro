//! First ported route group (plan Step 7): read-heavy, low-coupling endpoints
//! — `/api/games`, `/api/stats`, `/api/solve`, `/api/submit`, `/api/log-click`,
//! `/api/weather`, `/api/school-calendar`, `/api/school-info`, `/api/site-info`,
//! `/api/backgrounds/list`, `/api/bad-passwords`. Status: stub.

#![allow(dead_code)]

pub struct Misc;

impl Misc {
    pub fn placeholder() -> Self {
        Self
    }
}
