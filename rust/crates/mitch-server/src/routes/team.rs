//! `/api/team/*` + gmail bridge — 11 endpoints (plan Step 13).
//! Reads `data/team_inbox_cache.json` (produced by mitch-mail's IMAP watcher)
//! and spawns/forwards the send pipeline. Status: stub.

#![allow(dead_code)]

pub struct Team;

impl Team {
    pub fn placeholder() -> Self {
        Self
    }
}
