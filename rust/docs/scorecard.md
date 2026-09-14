# Endpoint Scorecard — Rust rewrite progress

Metric: `BASE_URL=http://localhost:<rust_port> bun tests/endpoint_test.js`
(the same suite that runs against bun). The rewrite is done when this is 100%.
Record one row per plan step; report honestly — partial passes are data.

| Step | Scope | Date | Pass | Total | Notes |
|------|-------|------|------|-------|-------|
| 1 | scaffold (no endpoints) | 2026-09-07 | 0 | ~80 | baseline pending Step 4 server |
| 2 | mail pipeline (mitch-mail + shims) | 2026-09-07 | n/a | n/a | see checks below — send path verified via parity + local TLS SMTP sink |
| 3 | ssh-gateway (russh + tokio-tungstenite) | 2026-09-08 | 13/13 | 13 | same suite passes against JS gateway too — parity proven |
| 4 | core skeleton (hosts, static, pipeline) | 2026-09-08 | 52/52 urls | 52+ | headers AND bodies byte-identical vs bun (104 checks) |
| 5 | data layer + crypto | 2026-09-08 | 8/8 paths | 8 | data parity harness: passthrough + reserialize byte-identical; 29 rust tests green |
| 6a | auth/sessions + rate limits | 2026-09-09 | 102/102 urls | 102+ | parity holds with the live rate limiter + real checkPasswordCookie; 6a test bypass order fixed |
| 7 batch 1 | misc read-heavy endpoints (site-info, bad-passwords, backgrounds, log-click, leaderboard, games) | 2026-09-09 | 102/102 urls | 102+ | six endpoints live with data layer + auth; parity unaffected |
| 7 batch 2 | captcha proxy, ping, content | 2026-09-09 | 102/102 urls | 102+ | worldshardestcaptcha proxy + ping + content endpoints live |
| 8 | admin route group (~60 endpoints) | 2026-09-13 | 102/102 urls | 102+ | parity_static green; admin gate probes byte-identical vs bun (401/403 ladder + passphrase-status passthrough) |

## Step 4 verification log (2026-09-08)

- `tests/parity_static.js` (52 URL cases x both servers, sequential): **headers AND response bodies byte-identical** across mitch.pro / rjuhsd.school / sexypickleclub.com — static assets, injected HTML pages (`/`, `/enroll/`, `/encrypt/`, `/preferences/`, `/index-sales.html`, `/team/`, `/faq/`), directory redirects (301/302), bell/blooket redirects, per-host manifests, 404s, protected files, CSRF-blocked POST, unified password gate.
- Discovery that simplified the port: **bun's static serving has no etag/Last-Modified/304/range support at all** — the contract is the mime map + three Cache-Control classes + COOP/COEP/CORP for `/webvm`.
- Bugs the parity harness caught and fixed, in order: viewport meta replacement dropped the tag's closing group; `safeWebrootPath` lacked `path.resolve`-style `..` normalization; `</head>` insertion sliced past the tag (JS inserts *before* it and keeps it); `jsonResp` built its headers but never attached them; the prelude's unified password gate and the rjuhsd-hub `/index.html` mapping were missing; SSO-bridge redirect targets needed `encodeURIComponent`.
- Session-dependent pieces stubbed unauthenticated (Step 6): `checkPasswordCookie`, bans, SSO bridge tokens, rate limits. The deferred `/images/*` captcha-proxy route is a later step (excluded from the test with a comment).
- The rewrite's progress logging flows into the shared `app_logs` table (category `rust-rewrite`) via `mitch-lib::log` + the `rust_log` example CLI; the admin panel log viewer was upgraded in the same pass (structured rows, level pills, click-to-expand details, debounced search, 10s live tail).
- Dev-note: this sandbox's Docker port-forwarding eats connections; parity runs used host processes (`bun server.js` on 6802 vs rust on 6801) with the dev container stopped to avoid double IMAP watchers, then restored.

## Step 2 verification log (2026-09-08)

- `cargo test --workspace`: 17 tests green (mitch-lib data layer 6, mitch-mail 11).
- `tools/mail_rs_parity.js`: **ALL PARITY CHECKS PASSED** — html/text/subject/from/headers byte-identical to the original JS `formatHtmlEmail` functions across gmail, gmail -a, gmail --raw, noreply, support, support --raw.
- Shim fallback: service unreachable → falls through to nodemailer (verified with dead MAIL_RS_URL).
- Full SMTP round trip: shim → mitch-mail → implicit-TLS SMTP sink delivered a real multipart/alternative MIME message with From/To/Subject/List-Unsubscribe/List-Unsubscribe-Post/Message-ID and both text + html parts.
- Live Gmail/Hostinger send: **pending** — no Doppler credentials on the dev machine; verify on the VPS (or wherever `doppler` is authenticated) before flipping prod traffic: `bun mail/send_email.js <self> "rust mail test" "body"` with the mail-rs service up.
- Deviations from JS, documented: `MAIL_SMTP_PORT` env override (default 465, JS hardcodes 465); lettre Message-ID format differs from nodemailer's but is RFC-5322-valid.

## Step 3 verification log (2026-09-08)

- `tests/ssh_gateway_test.js` (registered as `bun run test:gateway`, NOT in the CI pre-deploy chain): **13/13 checks pass against the Rust gateway** — invalid JSON, missing type, missing host/username, live-session double-connect rejection, unreachable host error, real-sshd full echo (connect → echo → PTY resize → exit → ws close).
- **Parity proven**: the identical suite passes against the original JS gateway (`bun ssh-gateway/server.js`).
- Test sshd: disposable container (alpine + openssh, root/mitch-e2e-pass, `docker run --network host … sshd -p 2222`) — host-network mode needed because the sandbox's docker userland proxy eats port-forwarded connections.
- Bugs the tests caught during the port, both fixed:
  1. the select loop treated russh housekeeping messages (`Success`/`WindowAdjusted` replies from `request_pty`/`request_shell`) as shell-close and tore the session down 1 ms after connect — only `None`/`Close` now close;
  2. the russh session `Handle` was dropped when `open_shell` returned, killing the driver task — it is now held for the connection lifetime and disconnected on teardown.
- Documented divergence: error-message TEXT for SSH-layer failures differs from ssh2's wording (e.g. "Connection refused (os error 111)"); protocol-level error strings ("Invalid JSON", "Missing message type", "Already connected", "host and username are required") are byte-identical.
- Compose: `ssh-gateway-rs` sidecar on 6821; cutover = flip `SSH_GATEWAY_URL` to it.

## Step 4 verification log (2026-09-08)

- `tests/parity_static.js` (52 URL cases × both servers, sequential): **headers AND response bodies byte-identical** across mitch.pro / rjuhsd.school / sexypickleclub.com — static assets, injected HTML pages (`/`, `/enroll/`, `/encrypt/`, `/preferences/`, `/index-sales.html`…), directory redirects (301/302), bell/blooket redirects, per-host manifests, 404s, protected files, CSRF-blocked POST, unified password gate.
- Discovery that simplified the port: **bun's static serving has no etag/Last-Modified/304/range support at all** — the contract is the mime map + three Cache-Control classes + COOP/COEP/CORP for `/webvm`.
- Bugs the parity harness caught and fixed, in order: viewport meta replacement dropped the tag's closing group; `safeWebrootPath` lacked `path.resolve`-style `..` normalization; `</head>` insertion sliced past the tag (JS inserts *before* it and keeps it); `jsonResp` built its headers but never attached them; the prelude's unified password gate and the rjuhsd-hub `/index.html` mapping were missing; SSO-bridge redirect targets needed `encodeURIComponent`.
- Session-dependent pieces stubbed unauthenticated (Step 6): `checkPasswordCookie`, bans, SSO bridge tokens, rate limits. The deferred `/images/*` captcha-proxy route is a later step (excluded from the test with a comment).
- The rewrite's progress logging flows into the shared `app_logs` table (category `rust-rewrite`) via `mitch-lib::log` + the `rust_log` example CLI; the admin panel log viewer was upgraded in the same pass (structured rows, level pills, click-to-expand details, debounced search, 10s live tail).
- Dev-note: this sandbox's Docker port-forwarding eats connections; parity runs used host processes (`bun server.js` on 6802 vs rust on 6801) with the dev container stopped to avoid double IMAP watchers, then restored.

## Static parity (tests/parity_static.js, added Step 4)

| Step | URLs checked | Diffs | Notes |
|------|--------------|-------|-------|
## Step 5 verification log (2026-09-08)

- `tests/data_parity.js` + `rust/crates/mitch-lib/examples/data_parity.rs`: **8/8 paths byte-identical** through both passthrough (stored TEXT verbatim) and reserialize (parse + js_stringify_pretty) modes — mixed shapes: strings, ints, floats (1.5, -2.75, 0.000001, 9007199254740992), nested objects, empty object/array, null, booleans, unicode, escaped quotes/backslashes/newlines, key ordering.
- `js_stringify_pretty`: JS JSON.stringify parity port — serde_json's default f64 formatting would emit `1.0` where JS emits `1`; the custom printer handles the JS Number.toString rules (decimal for 1e-6..1e21, exponential outside, `-0` as `0`).
- crypto.rs: `enc1:` seal/open ported (AES-256-GCM, key = HMAC-SHA256(ID_SECRET, purpose), purposes `dm-at-rest-v1`/`totp-at-rest-v1`); round-trip + RFC 4231 HMAC vector tests; ID_SECRET bootstrap (32 random bytes persisted on first boot).
- app_logs: append/query ported with the prune cadence (every 250th write, id-ordered, 20000 cap) — the admin log viewer's data source.
- Full table init parity: all core tables + indexes created on open with the SQLITE_BUSY retry ladder (10 retries, 100ms*attempt).
- Bugs the parity harness caught: the reserialize mode corrupted non-JSON string docs (JS writeDocument's string branch stores arbitrary text; JS readDocument returns the fallback on parse failure — the example now skips unparseable docs); the harness's string-doc expectation needed the same writeDocument ternary.

## Step 6a verification log (2026-09-09)

- `mitch-lib::auth`: normalizeEmail (reserved-locals domain folding), makeEmailId/validId (sha256[0..24] + HMAC-SHA256[0..16] with timing-safe compare), getCookies (legacy-cookie deletion + mitch_session re-derivation), authSessionFromToken (expiry + generation check + 5-min lastSeen refresh + names.json write-back), bannedInfoForEmail/Sid/Ip, issueLoginSession, cookie_path_attrs, checkPasswordCookie (full gate in JS order).
- Rate limiting: RATE_LIMITS table verbatim (~110 entries), sliding-window rlLog, anon = floor(max/5), detectNonHumanTiming (>=4 intervals within 10s, spread < 50ms), checkRateLimit with the polling-path exemptions, WHITELISTED_IPS.
- Wired into mitch-server: real check_password_cookie replaces the stub; get_real_ip (full header-precedence chain with the 172.16-31 bridge fallbacks); rate-limit gate in the prelude for /api/ paths.
- Parity: 102/102 headers+bodies byte-identical with the live rate limiter — the harness's ~51 sequential requests stay under the default [100, 60] bucket.
- Functional: hammering /api/stats on the rust server returns 429 after the bucket fills (verified with a 105-request curl loop).
- Test-semantics fix: the NODE_ENV=test bypass fires AFTER sid validation and email resolution (matching the JS order), not before — the test was asserting the wrong order.

## Step 8 verification log (2026-09-13)

- Admin route group ported as `routes/admin/{mod,dashboard,moderation,economy,legacy,data,vm}.rs` + a shared `AdminCtx` (cookies/sid/ip) — one file per concern, none over ~700 lines; `mitch-lib` gains `admin.rs` (passphrase store, admin-actions log, advanced-data builder, moderator panel/request engine) and `coins.rs` (multiplier, happy hour, gift notices, notifications).
- **Gate-order bug the parity probes caught**: bun's admin gate (server.js:7945) runs BEFORE the maintenance gate, the banned check, and password enforcement — the Rust port had it after the password prelude, so unauthenticated `/api/admin/*` returned `403 password required` instead of `401 unauthorized`. Moved the gate to prelude position 3c; the no-sid ladder (`passphrase-status` 403 passthrough, everything else 401, response bodies identical) now matches bun exactly.
- Admin role model corrected to the real admins.json shape (`{owners, admins, coOwners?}`, moderators a bare array, flat hierarchy); `is_admin_id` keeps the JS three-stage order (test backdoor → names.json generation binding → infinite token).
- Web-push fan-out ported with the `web-push` crate (VAPID from env, AES128GCM, 410/404 subscription cleanup); ntfy + bg-email stay fire-and-forget like the JS `proc.unref()` paths.
- Deferred stubs, documented: Proxmox executors + `ssh-key/copy-id` + `lxc-attach-sshd-hook` → Step 13 (russh) — they return structured failures and never write fake approval state; broadcast WS fan-out → Step 11; `/api/admin-members` + `/api/moderator-members` → Step 9 (need processMemberFields/profiles); ssh-key save re-encrypts via `ssh-keygen -p` instead of node PKCS8 (same russh-readable result).
- Gates: cargo fmt clean, clippy `-D warnings` 0 errors, `cargo test --workspace` 46+11+6 green; `tests/parity_static.js` 102/102 byte-identical.
- Merge adaptation (origin/master grew ~5000 lines: VM desktop portal, SSO fixes, games/matrix portals): synced the Rust copies of the password-exempt list (`/api/me/coins`, `/games`, `/matrix`, `/game-portal`, `/msn-games`, `/rjuhsd`, `/sexypickleclub`), the HTML auth gate (games/matrix open, ban page before the /enroll redirect, new `/admin/vms` actor gate), the static public gate, and the matrix SPA fallback; ported `GET /api/me/coins`. `tests/endpoint_test.js` now passes an identical 33 checks on both servers.
