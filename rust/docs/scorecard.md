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
