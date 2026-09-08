//! `/api/dm/*` — 13 endpoints + `/ws` presence/chat (plan Step 11).
//! sealAtRest/openAtRest, allSockets/userPresence, same-origin upgrade check,
//! identical JSON message shapes. Ported before games: per-conversation state
//! is bounded and proves the WS + at-rest + presence stack. Status: stub.

#![allow(dead_code)]

pub struct Dm;

impl Dm {
    pub fn placeholder() -> Self {
        Self
    }
}
