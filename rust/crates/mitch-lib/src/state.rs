//! Shared in-memory State: tokens/coins/presence caches and their flushers.
//!
//! Contract (from `server.js`): module-level mutable singletons
//! (`tokensCache`, `coinsCache`, `userStats`, `dailyLogins`, `canvasPixels`,
//! `allSockets`, `userPresence`, game-state maps, rate-limit tables) become
//! fields of a shared `State` owned by the router, persisted through
//! [`crate::data`] on the same schedule as the JS `setInterval` flushers.
//!
//! Status: scaffold stub — implemented across plan Steps 6-12.

#![allow(dead_code)]

/// Shared state, not yet wired.
pub struct State;

impl State {
    /// Placeholder so the module compiles; replaced in Step 6.
    pub fn placeholder() -> Self {
        Self
    }
}
