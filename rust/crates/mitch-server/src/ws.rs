//! WebSocket handlers (plan Steps 11-13).
//! `/ws` presence + E2EE chat relay, `/ssh/ws` gateway relay,
//! `/vnc/ws` raw-TCP bridge, `/api/blooket-bot/ws` proxy. Message shapes and
//! the same-origin upgrade check must match server.js exactly.
//! Status: stub.

#![allow(dead_code)]

pub struct Ws;

impl Ws {
    pub fn placeholder() -> Self {
        Self
    }
}
