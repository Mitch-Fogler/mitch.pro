# mitch.pro redesign

The refreshed UI uses warm charcoal and ivory surfaces, coral accents, a shared navigation bar, and consistent forms, panels, tables, and responsive layouts. The homepage and public welcome page have new layouts. Encrypted chat has a redesigned conversation list, message styling, empty and signed-out states, mobile navigation, and an on-demand member details panel. Orbit branding has been removed from the main interface.

## Local preview

```sh
bun install
bun run preview:ui
```

Open http://127.0.0.1:4317. This is an isolated static preview; it deliberately has no live backend. Account actions need the real server. The normal deployment still uses `bun server.js`.

## Verification

```sh
bunx playwright install chromium
bun run test:ui
node tools/review-ui.mjs --all
bun run test:unit
```

UI checks use synthetic accounts, temporary encryption keys, and intercepted API responses. They check desktop/mobile layouts, conversation selection, the details panel, mobile back navigation, the group dialog, keyboard search, and light mode. Screenshots and the page audit are saved under `artifacts/ui-review/`. The broad audit includes redirects and legacy utility pages; remote destinations and embedded game runtimes are not end-to-end tested. Live delivery, real authentication, and server integrations require a configured backend.

The existing encryption protocol, account permissions, and server routes are preserved. New public styles are included in the server asset allowlist, and the service worker cache version is bumped.
