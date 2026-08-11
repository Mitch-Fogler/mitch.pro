# Security Policy

## Reporting

Please report security issues privately (do not open a public GitHub issue for exploitable bugs). Include steps to reproduce, impact, and affected paths when possible.

## Production expectations

- Secrets live in Doppler / environment variables — never in git.
- Authentication is session-cookie based (`mitch_session` HttpOnly). Visible `studentId` is display-only.
- Arbitrary-site web proxies are removed; fixed game host proxies (e.g. GameMonetize) remain.
- Admin SSH goes through the isolated `ssh-gateway` container.
- Mutating `/api/*` requests require same-origin Origin/Referer and `X-Mitch-Requested-With: 1`.
