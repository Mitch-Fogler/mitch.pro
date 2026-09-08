//! Web-push + ntfy push channels (plan Step 8).
//! `web-push` crate against existing `data/push_subs.json` rows
//! (`endpoint`, `keys.p256dh`, `keys.auth`); `/api/push/subscribe`,
//! `/api/push/unsubscribe`, `/api/push/vapid-key`, `/api/blog/subscription`,
//! `/api/ntfy/topic`. Status: stub.

#![allow(dead_code)]

pub struct Push;

impl Push {
    pub fn placeholder() -> Self {
        Self
    }
}
