//! `/api/me/*` — 19 account endpoints (plan Step 9). First use of the SQL
//! tables (users, friends, referrals, app_logs) — replicate reads/writes in
//! rusqlite, never invent schema bun doesn't know. Status: stub.

#![allow(dead_code)]

pub struct Me;

impl Me {
    pub fn placeholder() -> Self {
        Self
    }
}
