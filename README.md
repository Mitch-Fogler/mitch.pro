# mitch.pro / bun-server

Private invite-oriented student site stack: Bun HTTP server, Caddy blue/green deploy, Docker Compose, and static pages under `webserver/`.

## License

Apache License 2.0 **with Commons Clause** (`LICENSE`). You may use, modify, and share this software. You may **not Sell** it.

## Quick start

1. Install [Bun](https://bun.sh) and Docker.
2. Copy `.env.example` into Doppler (recommended) or a local `.env` (gitignored).
3. `docker compose up --build`
4. App listens behind Caddy on port `6800`.

## Important env / flags

| Variable | Purpose |
|----------|---------|
| `SESSION_COOKIE_SECURE` | Set `1` in HTTPS production |
| `SMS_WEBHOOK_SECRET` | Required for `/api/sms-reply` |
| `SSH_GATEWAY_URL` | Default `ws://ssh-gateway:6820` |
| `ENABLE_ADMIN_KEY_HEADER` | Break-glass only; keep `0` |
| `ENABLE_CLIENT_CHESS_REWARDS` | Keep `0` unless server-validated |
| `NODE_ENV` | Use `production` in deploy |

There is **no** open arbitrary web proxy. Game-specific reverse proxies (e.g. `/proxy/gamemonetize/`) stay enabled.

## Publishing notes

- Do not commit `.env`, `data/` runtime state, keys, or `proxy/jail/`.
- If this repo was previously private with secrets/PII in git history, scrub history or cut a fresh orphan branch before making it public.
- School emails (`@student.rjuhsd.us`) and WHS bell branding are intentional product identity.

See `SECURITY.md` for reporting guidance and `SECURITY_POSTURE.md` for the current control summary.
