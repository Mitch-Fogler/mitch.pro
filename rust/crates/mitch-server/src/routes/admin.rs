//! `/api/admin/*` — ~60 endpoints (plan Step 8). Mostly thin loadJson/saveJson
//! wrappers over the tokens/revoked/moderators caches; includes the web-push
//! fan-out port. Status: stub.

#![allow(dead_code)]

pub struct Admin;

impl Admin {
    pub fn placeholder() -> Self {
        Self
    }
}
