# Endpoint Scorecard — Rust rewrite progress

Metric: `BASE_URL=http://localhost:<rust_port> bun tests/endpoint_test.js`
(the same suite that runs against bun). The rewrite is done when this is 100%.
Record one row per plan step; report honestly — partial passes are data.

| Step | Scope | Date | Pass | Total | Notes |
|------|-------|------|------|-------|-------|
| 1 | scaffold (no endpoints) | 2026-09-07 | 0 | ~80 | baseline pending Step 4 server |
| 2 | mail pipeline (mitch-mail + shims) | 2026-09-07 | n/a | n/a | see checks below — send path verified via parity + local TLS SMTP sink |
| 3 | ssh-gateway (russh + tokio-tungstenite) | 2026-09-08 | 13/13 | 13 | same suite passes against JS gateway too — parity proven |

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

## Static parity (tests/parity_static.js, added Step 4)

| Step | URLs checked | Diffs | Notes |
|------|--------------|-------|-------|