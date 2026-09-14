//! Background interval workers (plan Steps 6-13).
//! Replaces the ~20 `setInterval` timers in server.js with tokio tasks on the
//! same schedule. Live so far:
//! - `saveCanvasPixels` 30s flush (server.js:4544-4545)
//! - `canvasHeatmap` hourly 24h sweep (server.js:4788-4793)
//!
//! The presence sweep, weekly digest, daily puzzle, chess-clock warning, DM
//! digest, premium maintenance, nudge, VM purge, happy-hour and DM-prune
//! timers land with their owning steps.

/// Starts every live worker task. Call once from `main` after the state build.
pub fn spawn(state: std::sync::Arc<crate::state::AppState>) {
    // saveCanvasPixels — every 30s (server.js:4545).
    {
        let state = state.clone();
        tokio::spawn(async move {
            let mut tick = tokio::time::interval(std::time::Duration::from_secs(30));
            loop {
                tick.tick().await;
                state.canvas.flush_pixels(&state.store, state.data_dir());
            }
        });
    }
    // canvasHeatmap sweep — hourly, dropping entries older than 24h
    // (server.js:4788-4793).
    {
        let state = state.clone();
        tokio::spawn(async move {
            let mut tick = tokio::time::interval(std::time::Duration::from_secs(3600));
            loop {
                tick.tick().await;
                state.canvas.sweep_heatmap(mitch_lib::school::now_millis());
            }
        });
    }
    // e2eUsers sweeper — every 60s, entries with last_seen older than 5 min
    // dropped (server.js:4044-4049).
    {
        let state = state.clone();
        tokio::spawn(async move {
            let mut tick = tokio::time::interval(std::time::Duration::from_secs(60));
            loop {
                tick.tick().await;
                crate::routes::e2e::sweep_e2e_users(&state);
            }
        });
    }

    // userPresence sweeper — every 10s (server.js:1129-1136): drop entries
    // with no broadcast socket and a lastSeen ≥ 45s old, broadcasting
    // `presence_changed` offline for each.
    {
        let state = std::sync::Arc::clone(&state);
        tokio::spawn(async move {
            let mut tick = tokio::time::interval(std::time::Duration::from_secs(10));
            tick.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
            loop {
                tick.tick().await;
                crate::ws::sweep_presence(&state);
            }
        });
    }
}
