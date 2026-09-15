//! `/api/casino/*` — the casino (plan Step 12). The whole group sits behind
//! one shared prelude (server.js:23077-23097): sid auth ladder → method gate
//! → `blackjack/state` → (POSTs except blackjack hit/stand) tryParseJson +
//! verifyRecaptcha — then the helpers `addHistory` / `readCasinoBet` /
//! `isRigged` / `settleCasinoRound` / `weightedPick` / `drawUniqueNumbers`
//! (server.js:23099-23175) and the per-game handlers.
//!
//! This commit ports the prelude + helpers + the read endpoints
//! (`history`, `global-feed`) + the four instant games rock-paper-scissors,
//! lucky-seven, color-card and triple-dice (server.js:23189-23242).
//!
//! Every response body leaves through `js_stringify` — the money fields are
//! `Number(x.toFixed(n))` values whose exact rendering matters.

use axum::http::{HeaderMap, Method};
use serde_json::{json, Value};
use std::sync::Arc;

use crate::errors::json_resp_str;
use crate::state::AppState;
use mitch_lib::data::{js_num_from_fixed, js_stringify, js_to_fixed};
use mitch_lib::jsval;

/// One entry of `bjGames` (server.js:23377): the shuffled deck plus the two
/// hands, the locked-in bet, and the (always false) rig flag. Only
/// `blackjack/state` reads it before the blackjack commit fills the rest.
#[allow(dead_code)]
pub struct BjGame {
    pub deck: Vec<Value>,
    pub player_hand: Vec<Value>,
    pub dealer_hand: Vec<Value>,
    pub bet: f64,
    pub email: String,
    pub rigged: bool,
}

pub(crate) async fn handle(
    state: &Arc<AppState>,
    method: &Method,
    path: &str,
    headers: &HeaderMap,
    body: &Value,
    body_bytes: &[u8],
) -> Option<axum::response::Response> {
    if !path.starts_with("/api/casino/") {
        return None;
    }
    // Auth ladder (server.js:23079-23083) — validId fail → 'unauthorized',
    // emailFromSid fail → 'email not found'. bun does NOT consult the
    // revoked-id store here (unlike the game-portal pair).
    let cookies = crate::routes::me::cookies_of(state, headers);
    let sid = cookies
        .get("studentId")
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| cookies.get("id").unwrap_or(""))
        .to_string();
    if !mitch_lib::auth::valid_id(&sid, &state.id_secret) {
        return Some(resp(401, &json!({ "error": "unauthorized" })));
    }
    let Some(email) = mitch_lib::auth::email_from_sid(&state.store, &state.id_secret, &sid) else {
        return Some(resp(401, &json!({ "error": "email not found" })));
    };
    let norm = mitch_lib::auth::normalize_email(&email);

    // Method gate (server.js:23086-23087): the three read paths are GET-only,
    // everything else POST-only.
    let read_only = matches!(
        path,
        "/api/casino/history" | "/api/casino/global-feed" | "/api/casino/blackjack/state"
    );
    let wanted = if read_only { Method::GET } else { Method::POST };
    if *method != wanted {
        return Some(resp(405, &json!({ "error": "Method not allowed" })));
    }

    // `GET /api/casino/blackjack/state` (server.js:23088-23091) — bjGames is
    // empty until the blackjack commit lands, so this answers {active:false}.
    if path == "/api/casino/blackjack/state" {
        let games = state.bj_games.lock().unwrap_or_else(|e| e.into_inner());
        return Some(match games.get(&norm) {
            Some(g) => resp(
                200,
                &json!({
                    "active": true,
                    "bet": jsval::num_value(g.bet),
                    "playerHand": Value::Array(g.player_hand.clone()),
                    "dealerUpCard": g.dealer_hand.first().cloned().unwrap_or(Value::Null),
                }),
            ),
            None => resp(200, &json!({ "active": false })),
        });
    }

    // POST parse + reCAPTCHA gate (server.js:23093-23097) — blackjack
    // hit/stand skip both (they re-use the parsed body / need no captcha).
    if *method == Method::POST
        && path != "/api/casino/blackjack/hit"
        && path != "/api/casino/blackjack/stand"
    {
        let parsed = if body_bytes.is_empty() {
            Some(json!({}))
        } else {
            serde_json::from_slice(body_bytes).ok()
        };
        let Some(b) = parsed else {
            return Some(resp(400, &json!({ "error": "bad json" })));
        };
        let ip = crate::handler::get_real_ip(headers, None);
        let token = jsval::string(&jsval::or(b.get("recaptcha_token"), json!("")));
        if !crate::routes::push::verify_recaptcha(state, &token, &ip, "").await {
            return Some(resp(
                400,
                &json!({ "error": "reCAPTCHA failed. Please try again." }),
            ));
        }
        return game(state, path, &b, &email, &norm);
    }
    let _ = body; // GET paths never read the body
    game(state, path, &Value::Null, &email, &norm)
}

/// Dispatch after the prelude. `body` is the parsed POST body for games, Null
/// for the GET reads.
fn game(
    state: &Arc<AppState>,
    path: &str,
    body: &Value,
    email: &str,
    norm: &str,
) -> Option<axum::response::Response> {
    match path {
        "/api/casino/history" => Some(history(state, norm)),
        "/api/casino/global-feed" => Some(global_feed(state)),
        "/api/casino/rock-paper-scissors" => Some(rock_paper_scissors(state, body, email, norm)),
        "/api/casino/lucky-seven" => Some(lucky_seven(state, body, email, norm)),
        "/api/casino/color-card" => Some(color_card(state, body, email, norm)),
        "/api/casino/triple-dice" => Some(triple_dice(state, body, email, norm)),
        // blackjack hit/stand/start, poker/slots/wheel/… land in later
        // commits; unhandled paths return None so the request falls through
        // exactly like bun (POST → 405 fallthrough, GET → static 404).
        _ => None,
    }
}

fn resp(code: u16, body: &Value) -> axum::response::Response {
    json_resp_str(code, js_stringify(body))
}

fn now_millis() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn enabled(state: &Arc<AppState>) -> bool {
    state
        .casino_enabled
        .load(std::sync::atomic::Ordering::Relaxed)
}

fn closed() -> axum::response::Response {
    resp(403, &json!({ "error": "Casino is currently closed." }))
}

fn user_stats(state: &Arc<AppState>) -> Value {
    state
        .store
        .read_document(&state.data_dir().join("user_stats.json"), json!({}))
}

/// `isVip` — `stats[norm] && stats[norm].vip_casino_until > Date.now()`.
fn is_vip(state: &Arc<AppState>, norm: &str) -> bool {
    user_stats(state)
        .get(norm)
        .and_then(|s| s.get("vip_casino_until"))
        .and_then(jsval::number)
        .unwrap_or(0.0)
        > now_millis() as f64
}

/// `readCasinoBet` (server.js:23106-23117) — Number(body.amount), the
/// minimum/balance ladder, then the non-VIP 500 cap. Returns the bet clamped
/// through `Number(bet.toFixed(2))`.
fn read_casino_bet(
    state: &Arc<AppState>,
    body: &Value,
    email: &str,
    norm: &str,
    min: f64,
) -> Result<f64, Box<axum::response::Response>> {
    let bet = body
        .get("amount")
        .and_then(jsval::number)
        .unwrap_or(f64::NAN);
    let bal = mitch_lib::coins::get_coins(&state.store, state.data_dir(), email);
    if !bet.is_finite() || bet < min {
        return Err(Box::new(resp(
            400,
            &json!({ "error": format!("Minimum bet is {} coins.", jsval::num_value(min)) }),
        )));
    }
    if bet > bal {
        return Err(Box::new(resp(
            400,
            &json!({ "error": "You do not have enough coins for that bet." }),
        )));
    }
    if !is_vip(state, norm) && bet > 500.0 {
        return Err(Box::new(resp(
            400,
            &json!({ "error": "Maximum bet is 500 coins. Buy a VIP Casino Pass in the shop for unlimited betting!" }),
        )));
    }
    Ok(js_num_from_fixed(&js_to_fixed(bet, 2)))
}

/// The player context the JS closure captures (`email` + `norm`).
struct Round<'a> {
    email: &'a str,
    norm: &'a str,
}

/// The settle result of `settleCasinoRound` (server.js:23155).
struct Settled {
    payout: f64,
    net: f64,
    new_balance: f64,
}

/// `casinoIntake += v` / `casinoPayout += v` — f64 RMW over the AtomicU64
/// bit stores, then the `saveCasinoStats()` write-through
/// (server.js:1199).
fn add_casino_stat(atomic: &std::sync::atomic::AtomicU64, v: f64) {
    use std::sync::atomic::Ordering::Relaxed;
    let mut cur = atomic.load(Relaxed);
    loop {
        let next = (f64::from_bits(cur) + v).to_bits();
        match atomic.compare_exchange_weak(cur, next, Relaxed, Relaxed) {
            Ok(_) => break,
            Err(c) => cur = c,
        }
    }
}

fn save_casino_stats(state: &Arc<AppState>) {
    use std::sync::atomic::Ordering::Relaxed;
    let doc = json!({
        "intake": jsval::num_value(f64::from_bits(state.casino_intake.load(Relaxed))),
        "payout": jsval::num_value(f64::from_bits(state.casino_payout.load(Relaxed))),
    });
    let _ = state
        .store
        .write_document(&state.cfg.data_dir.join("casino_stats.json"), &doc);
}

/// `addHistory` (server.js:23099-23104) — unshift, 25-cap with pop.
fn add_history(state: &Arc<AppState>, norm: &str, game: &str, amount: f64, outcome: &str) {
    let mut map = state
        .casino_history
        .lock()
        .unwrap_or_else(|e| e.into_inner());
    let mut h = map.get(norm).cloned().unwrap_or_default();
    h.insert(
        0,
        json!({
            "game": game,
            "amount": jsval::num_value(amount),
            "outcome": outcome,
            "ts": now_millis(),
        }),
    );
    if h.len() > 25 {
        h.pop();
    }
    map.insert(norm.to_string(), h);
}

/// `logBet` (server.js:1371-1374) — unshift into the global feed, 50-cap.
fn log_bet(state: &Arc<AppState>, user: &str, game: &str, amount: f64, outcome: &str) {
    let mut feed = state.betting_feed.lock().unwrap_or_else(|e| e.into_inner());
    feed.insert(
        0,
        json!({
            "user": user,
            "game": game,
            "amount": jsval::num_value(amount),
            "outcome": outcome,
            "ts": now_millis(),
        }),
    );
    if feed.len() > 50 {
        feed.pop();
    }
}

/// `settleCasinoRound` (server.js:23123-23156) — the double-down / bad-beat
/// modifiers, the 4-decimal money rounding, intake/payout bookkeeping, the
/// coin settlement, history + feed + stats.
fn settle_casino_round(
    state: &Arc<AppState>,
    player: &Round<'_>,
    game_name: &str,
    bet: f64,
    payout: f64,
    outcome: &str,
    opts: (bool, bool), // (freeSpin, prepaid)
) -> Settled {
    let (free_spin, prepaid) = opts;
    let (email, norm) = (player.email, player.norm);
    let now = now_millis() as f64;
    let stats = user_stats(state);
    let entry = stats.get(norm);
    let until = |key: &str| {
        entry
            .and_then(|s| s.get(key))
            .and_then(jsval::number)
            .unwrap_or(0.0)
    };
    // `(stats[norm].x || 0) > Date.now()` — NaN is falsy in JS, so an
    // unparseable `x` reads as 0 too (jsval::number's None → 0.0).
    let is_double = entry.is_some() && until("double_down_until") > now;
    let is_insured = entry.is_some() && until("bad_beat_insurance_until") > now;

    let mut final_payout = payout;
    let mut final_outcome = outcome.to_string();
    if payout > bet && is_double {
        final_payout = payout * 2.0;
        final_outcome = format!("{outcome} (2X DOUBLE)");
    } else if payout <= 0.0 && is_insured && !free_spin {
        final_payout = bet;
        final_outcome = "REFUNDED (INSURED)".to_string();
    }

    // `Number(Math.max(0, finalPayout || 0).toFixed(4))` — NaN/0 are falsy
    // under `||`, and Math.max(0, x) clamps negatives to +0.
    let fp = if final_payout.is_nan() || final_payout == 0.0 {
        0.0
    } else {
        final_payout
    };
    let safe_payout = js_num_from_fixed(&js_to_fixed(fp.max(0.0), 4));
    let effective_bet = if free_spin { 0.0 } else { bet };
    let net = js_num_from_fixed(&js_to_fixed(safe_payout - effective_bet, 4));

    add_casino_stat(
        &state.casino_intake,
        if prepaid { 0.0 } else { effective_bet },
    );
    add_casino_stat(&state.casino_payout, safe_payout);
    save_casino_stats(state);
    mitch_lib::coins::add_coins(
        &state.store,
        state.data_dir(),
        email,
        if prepaid { safe_payout } else { net },
        state.coin_multiplier(),
        "",
    );
    add_history(state, norm, game_name, net, &final_outcome);
    log_bet(state, email, game_name, effective_bet, &final_outcome);

    mitch_lib::achievements::update_stat(
        &state.store,
        state.data_dir(),
        email,
        "casino_bets",
        1.0,
        state.coin_multiplier(),
    );
    if net > 0.0 {
        mitch_lib::achievements::update_stat(
            &state.store,
            state.data_dir(),
            email,
            "casino_wins",
            1.0,
            state.coin_multiplier(),
        );
    }

    Settled {
        payout: safe_payout,
        net,
        new_balance: mitch_lib::coins::get_coins(&state.store, state.data_dir(), email),
    }
}

/// `GET /api/casino/history` (server.js:23177-23179).
fn history(state: &Arc<AppState>, norm: &str) -> axum::response::Response {
    let map = state
        .casino_history
        .lock()
        .unwrap_or_else(|e| e.into_inner());
    let h = map.get(norm).cloned().unwrap_or_default();
    resp(200, &json!({ "history": Value::Array(h) }))
}

/// `GET /api/casino/global-feed` (server.js:23181-23187) — first 50 entries
/// with the email local-part replacing `user` (empty → 'anonymous').
fn global_feed(state: &Arc<AppState>) -> axum::response::Response {
    let feed = state.betting_feed.lock().unwrap_or_else(|e| e.into_inner());
    let sanitized: Vec<Value> = feed
        .iter()
        .take(50)
        .map(|b| {
            let mut out = b.clone();
            if let Some(obj) = out.as_object_mut() {
                let user = jsval::string(obj.get("user").unwrap_or(&Value::Null));
                let shown = if user.is_empty() {
                    "anonymous".to_string()
                } else {
                    user.split('@').next().unwrap_or("").to_string()
                };
                obj.insert("user".to_string(), json!(shown));
            }
            out
        })
        .collect();
    resp(200, &json!({ "feed": Value::Array(sanitized) }))
}

// ── Instant games ────────────────────────────────────────────────────────────

/// `POST /api/casino/rock-paper-scissors` (server.js:23189-23202).
fn rock_paper_scissors(
    state: &Arc<AppState>,
    body: &Value,
    email: &str,
    norm: &str,
) -> axum::response::Response {
    if !enabled(state) {
        return closed();
    }
    let bet = match read_casino_bet(state, body, email, norm, 1.0) {
        Ok(b) => b,
        Err(r) => return *r,
    };
    let choice = jsval::string(&jsval::or(body.get("choice"), json!(""))).to_lowercase();
    let options = ["rock", "paper", "scissors"];
    if !options.contains(&choice.as_str()) {
        return resp(400, &json!({ "error": "Choose rock, paper, or scissors." }));
    }
    let computer = options[mitch_lib::crypto::js_random_index(options.len())];
    let tie = choice == computer;
    let won = !tie
        && ((choice == "rock" && computer == "scissors")
            || (choice == "paper" && computer == "rock")
            || (choice == "scissors" && computer == "paper"));
    let payout = if tie {
        bet
    } else if won {
        bet * 1.9
    } else {
        0.0
    };
    let outcome = if tie {
        "PUSH"
    } else if won {
        "WIN"
    } else {
        "LOSE"
    };
    let settled = settle_casino_round(
        state,
        &Round { email, norm },
        "Rock Paper Scissors",
        bet,
        payout,
        outcome,
        (false, false),
    );
    resp(
        200,
        &json!({
            "ok": true,
            "choice": choice,
            "computer": computer,
            "tie": tie,
            "won": won,
            "win": jsval::num_value(settled.payout),
            "net": jsval::num_value(settled.net),
            "newBalance": jsval::num_value(settled.new_balance),
        }),
    )
}

/// `POST /api/casino/lucky-seven` (server.js:23204-23213).
fn lucky_seven(
    state: &Arc<AppState>,
    body: &Value,
    email: &str,
    norm: &str,
) -> axum::response::Response {
    if !enabled(state) {
        return closed();
    }
    let bet = match read_casino_bet(state, body, email, norm, 1.0) {
        Ok(b) => b,
        Err(r) => return *r,
    };
    let dice = [
        1.0 + mitch_lib::crypto::js_random().floor() * 6.0,
        1.0 + mitch_lib::crypto::js_random().floor() * 6.0,
    ];
    let total = dice[0] + dice[1];
    let won = total == 7.0;
    let settled = settle_casino_round(
        state,
        &Round { email, norm },
        "Lucky Seven",
        bet,
        if won { bet * 4.8 } else { 0.0 },
        if won { "WIN" } else { "LOSE" },
        (false, false),
    );
    resp(
        200,
        &json!({
            "ok": true,
            "dice": [jsval::num_value(dice[0]), jsval::num_value(dice[1])],
            "total": jsval::num_value(total),
            "won": won,
            "mult": jsval::num_value(if won { 4.8 } else { 0.0 }),
            "win": jsval::num_value(settled.payout),
            "net": jsval::num_value(settled.net),
            "newBalance": jsval::num_value(settled.new_balance),
        }),
    )
}

/// `POST /api/casino/color-card` (server.js:23215-23229).
fn color_card(
    state: &Arc<AppState>,
    body: &Value,
    email: &str,
    norm: &str,
) -> axum::response::Response {
    if !enabled(state) {
        return closed();
    }
    let bet = match read_casino_bet(state, body, email, norm, 1.0) {
        Ok(b) => b,
        Err(r) => return *r,
    };
    let choice = jsval::string(&jsval::or(body.get("choice"), json!(""))).to_lowercase();
    if choice != "red" && choice != "black" {
        return resp(400, &json!({ "error": "Choose red or black." }));
    }
    let suits = ["hearts", "diamonds", "clubs", "spades"];
    let suit = suits[mitch_lib::crypto::js_random_index(suits.len())];
    let color = if suit == "hearts" || suit == "diamonds" {
        "red"
    } else {
        "black"
    };
    let value = 1.0 + mitch_lib::crypto::js_random().floor() * 13.0;
    let card = match value as u32 {
        1 => "A".to_string(),
        13 => "K".to_string(),
        12 => "Q".to_string(),
        11 => "J".to_string(),
        v => v.to_string(),
    };
    let won = choice == color;
    let settled = settle_casino_round(
        state,
        &Round { email, norm },
        "Color Card",
        bet,
        if won { bet * 1.92 } else { 0.0 },
        if won { "WIN" } else { "LOSE" },
        (false, false),
    );
    resp(
        200,
        &json!({
            "ok": true,
            "choice": choice,
            "color": color,
            "suit": suit,
            "card": card,
            "won": won,
            "mult": jsval::num_value(if won { 1.92 } else { 0.0 }),
            "win": jsval::num_value(settled.payout),
            "net": jsval::num_value(settled.net),
            "newBalance": jsval::num_value(settled.new_balance),
        }),
    )
}

/// `POST /api/casino/triple-dice` (server.js:23231-23242).
fn triple_dice(
    state: &Arc<AppState>,
    body: &Value,
    email: &str,
    norm: &str,
) -> axum::response::Response {
    if !enabled(state) {
        return closed();
    }
    let bet = match read_casino_bet(state, body, email, norm, 1.0) {
        Ok(b) => b,
        Err(r) => return *r,
    };
    // `Number(body.pick)` then `Number.isInteger(pick) && 1 <= pick <= 6`.
    let pick = body.get("pick").and_then(jsval::number).unwrap_or(f64::NAN);
    if !pick.is_finite() || pick.fract() != 0.0 || pick < 1.0 || pick > 6.0 {
        return resp(400, &json!({ "error": "Pick a number from 1 to 6." }));
    }
    let dice: [f64; 3] = [
        1.0 + mitch_lib::crypto::js_random().floor() * 6.0,
        1.0 + mitch_lib::crypto::js_random().floor() * 6.0,
        1.0 + mitch_lib::crypto::js_random().floor() * 6.0,
    ];
    let matches = dice.iter().filter(|d| **d == pick).count() as f64;
    let mult = [0.0, 2.0, 5.0, 25.0][matches as usize];
    let settled = settle_casino_round(
        state,
        &Round { email, norm },
        "Triple Dice",
        bet,
        bet * mult,
        if matches > 0.0 { "WIN" } else { "LOSE" },
        (false, false),
    );
    resp(
        200,
        &json!({
            "ok": true,
            "pick": jsval::num_value(pick),
            "dice": dice.map(jsval::num_value),
            "matches": jsval::num_value(matches),
            "mult": jsval::num_value(mult),
            "win": jsval::num_value(settled.payout),
            "net": jsval::num_value(settled.net),
            "newBalance": jsval::num_value(settled.new_balance),
        }),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    /// `Number(x.toFixed(4))` money rounding through the shared helper.
    #[test]
    fn money_rounding_matches_js() {
        let r4 = |x: f64| js_num_from_fixed(&js_to_fixed(x, 4));
        assert_eq!(r4(19.0), 19.0);
        assert_eq!(r4(10.0 * 1.9), 19.0);
        assert_eq!(r4(0.1 + 0.2), 0.3);
        assert_eq!(r4(-5.0), -5.0); // clamped later by Math.max(0, …)
        let r2 = |x: f64| js_num_from_fixed(&js_to_fixed(x, 2));
        assert_eq!(r2(1.005), 1.0); // JS: Number((1.005).toFixed(2)) === 1
        assert_eq!(r2(10.5), 10.5);
    }

    /// Payout multipliers: push returns the bet, RPS wins pay bet×1.9,
    /// color-card bet×1.92, lucky-seven bet×4.8 — all funnelled through the
    /// same 4-decimal settle rounding the JS applies.
    #[test]
    fn rps_and_card_payouts() {
        // Push pays the bet back, win pays bet×1.9 (RPS) / bet×1.92 (color
        // card) exactly as the JS multiplies them.
        for bet in [1.0, 2.5, 100.0, 500.0] {
            assert_eq!(bet * 1.0, bet);
            assert_eq!(bet * 1.9, bet * 1.9);
            assert_eq!(bet * 1.92, bet * 1.92);
            assert_eq!(bet * 4.8, bet * 4.8); // lucky seven
        }
        // The 4-decimal settle rounding of a 1.92 payout on a 2.50 bet.
        let r4 = |x: f64| js_num_from_fixed(&js_to_fixed(x, 4));
        assert_eq!(r4(2.5 * 1.92), 4.8);
        assert_eq!(r4(100.0 * 1.9), 190.0);
    }

    /// Triple-dice multiplier table — `[0, 2, 5, 25][matches]`.
    #[test]
    fn triple_dice_mult_table() {
        let table = [0.0, 2.0, 5.0, 25.0];
        assert_eq!(table[0], 0.0);
        assert_eq!(table[1], 2.0);
        assert_eq!(table[2], 5.0);
        assert_eq!(table[3], 25.0);
    }
}
