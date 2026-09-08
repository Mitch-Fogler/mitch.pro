# Endpoint Scorecard — Rust rewrite progress

Metric: `BASE_URL=http://localhost:<rust_port> bun tests/endpoint_test.js`
(the same suite that runs against bun). The rewrite is done when this is 100%.
Record one row per plan step; report honestly — partial passes are data.

| Step | Scope | Date | Pass | Total | Notes |
|------|-------|------|------|-------|-------|
| 1 | scaffold (no endpoints) | 2026-09-07 | 0 | ~80 | baseline pending Step 4 server |
| 2 | mail pipeline (mitch-mail + shims) | 2026-09-07 | n/a | n/a | see checks below — send path verified via parity + local TLS SMTP sink |

## Step 2 verification log (2026-09-08)

- `cargo test --workspace`: 17 tests green (mitch-lib data layer 6, mitch-mail 11).
- `tools/mail_rs_parity.js`: **ALL PARITY CHECKS PASSED** — html/text/subject/from/headers byte-identical to the original JS `formatHtmlEmail` functions across gmail, gmail -a, gmail --raw, noreply, support, support --raw.
- Shim fallback: service unreachable → falls through to nodemailer (verified with dead MAIL_RS_URL).
- Full SMTP round trip: shim → mitch-mail → implicit-TLS SMTP sink delivered a real multipart/alternative MIME message with From/To/Subject/List-Unsubscribe/List-Unsubscribe-Post/Message-ID and both text + html parts.
- Live Gmail/Hostinger send: **pending** — no Doppler credentials on the dev machine; verify on the VPS (or wherever `doppler` is authenticated) before flipping prod traffic: `bun mail/send_email.js <self> "rust mail test" "body"` with the mail-rs service up.
- Deviations from JS, documented: `MAIL_SMTP_PORT` env override (default 465, JS hardcodes 465); lettre Message-ID format differs from nodemailer's but is RFC-5322-valid.

## Static parity (tests/parity_static.js, added Step 4)

| Step | URLs checked | Diffs | Notes |
|------|--------------|-------|-------|