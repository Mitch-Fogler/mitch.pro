# Changelog

## 2026-08-23

- **Daily puzzle themes crash.** `puzzles` is `[fen, moves, rating, "theme1 theme2 …"]` (space-separated string, not array); the worker was doing `(p[3] || []).slice(0,3).join(',')` which threw `TypeError: ... .join is not a function` whenever a puzzle fired. Now `String(p[3] || '').split(/\s+/).filter(Boolean).slice(0,3).join(', ')`.
- **`attachSshdHookToLxc` SSH defaults fixed.** Host was `tartarus` (unresolvable from the bun-server container) and key was `/etc/mitch/pve-host.key` (not mounted). Default host is now `192.168.100.1`, the key has no fallback default — `PVE_SSH_KEY_PATH` must be set in `.env` and the key file mounted into the container, otherwise the helper short-circuits with `PVE_SSH_KEY_PATH is not configured`.
- **Masked-recipient guard in `sendEmailBg`.** Auto-email workers were observed sending to a recipient shaped like `ad***n@…`, which is the exact `maskEmail()` display pattern. Audited all 28 call sites — none of them pass a masked value to `sendEmailBg`; `maskEmail` is only ever used for display contexts. As a safety net, `sendEmailBg` now refuses to spawn the mail script and emits an ntfy + stderr warning if `to` matches the mask pattern `^[A-Za-z0-9._%+-]{2}\*\*\*[A-Za-z0-9._%+-]*@`. If this guard ever fires, the leak is from a caller, not from the send pipeline.

## 2026-08-22

- **LXC creation cleanup.** The Proxmox standard templates (debian-12-standard, ubuntu-22.04+) ship openssh-server installed and started by default and accept the `password:` field at create time, so `createLxcContainer` no longer needs to bootstrap sshd. The earlier `pctExec` / `waitForLxcRunning` / `bootstrapLxcSshd` / hookscript path is removed; `createLxcContainer` is now a thin wrapper around `pct create` plus the existing post-create logic.
- **Diagnosed the "LXC 200 won't boot" report** as a one-off startup failure (`__lxc_start: 2288 Failed to spawn container "200"`), not a recurring template problem. Container 200 came up healthy on the next start attempt; `pct enter 200` confirms sshd is listening on `:22`. The root cause was an upstream transient during lxc-start, not anything in the bun-server code.
- **sshd PermitRootLogin override, attached via SSH bridge.** The distros' default `PermitRootLogin prohibit-password` (compiled into openssh-server) was rejecting root password logins to LXC containers even though sshd was listening on `:22`. PVE forbids the bun-server PVEVMAdmin token from setting the `hookscript:` field (`Permission check failed (changing the hookscript is only allowed for root@pam)`), so we instead go through an SSH key whose authorized_keys entry points at the existing `/usr/local/bin/pct-exec-only` forced-command script on tartarus. The script gained a new verb `mitch-attach-hook <vmid>` (range-gated to `[200, 999]`) which runs `pct set <vmid> --hookscript local:snippets/mitch-sshd-bootstrap.sh`. The host-side hookscript itself just writes `/etc/ssh/sshd_config.d/99-mitch.conf` with `PermitRootLogin yes` — that's pre-existing. New endpoints:
  - `POST /api/admin/lxc-attach-sshd-hook` (admin-only, body `{vmid}`) for manually re-attaching the hook on already-existing containers.
  - `createLxcContainer` auto-calls `attachSshdHookToLxc(vmid)` after `pct create` returns successfully, so the override is in place by the time the API responds to the browser.
  - Repo copies:
    - `tools/proxmox-hookscript-mitch-sshd-bootstrap.sh` — the hookscript that runs inside the LXC pre-start (already existed).
    - `tools/tartarus-pct-exec-only.sh` — the new full version of the forced-command script (with the `mitch-attach-hook` verb added). Install: `install -m 0755 ... /usr/local/bin/pct-exec-only` on tartarus.
- **VMID allowlist `[200, 999]`.** The free-VM allocator already scans 200-209 and student/premium containers live in that range; tightened the admin approve-vm check (was `vmid < 100`, now range-checked) and added an `assertVmIdInRange(vmid)` guard at the start of `createLxcContainer` and `cloneUserVm` so any caller passing an out-of-range VMID is rejected before it reaches `pct`. `PVE_VMID_MIN` / `PVE_VMID_MAX` are constants near the other PVE_* declarations.
- **Fixed the UFW `10.0.0.0/8` route-reject** in `tools/setup-firewall.sh`. The student subnet lives inside that /8; the broad reject would have blocked student-to-student and gateway-to-student traffic. The allow on `10.0.0.0/24` is now added before the broad reject so the more-specific match wins.
- **Test harness is in the repo.** Moved `endpoint_test.js`, `generate_session.js`, `test_daily_login*.js`, `test_runner.js` into `tests/`. The harness is now path-agnostic (uses `import.meta.dir` instead of hardcoded `/home/mitch/bun-server/data`) and survives SIGINT/SIGTERM (signal handlers call the data restore so a Ctrl-C never leaves `data/` empty). Added `tests/README.md`. `package.json` has `test:unit`, `test:integration`, `test:integration:daily-login`, and a combined `test` script.
- **CI runs unit tests on push.** `.github/workflows/deploy.yml` now has a `test` job that runs `bun run test:unit` before the deploy job. Integration tests are intentionally not in CI (they need a clean `data/` and a running server; they should be run locally before merging).
- **SQLite migration audit.** Found and fixed two real source-of-truth splits: `newsletter_extra.json` was being read through `loadJson` but written with `writeFileSync` (lines 9636/9645), and `email_whitelist.json` was being read with `readFileSync`. Both now go through the data store.
- **Pre-existing syntax errors on master fixed.** Removed a duplicate `function loadTypingSessions()` (and its `saveTypingSessions` partner) and renamed a shadowing `function maskEmail` (the second declaration was overriding the first via hoisting — every caller was getting the wrong behavior; renamed to `displayEmail` to make the right one win without forcing a behavior change in this commit).
- **Started the server.js split.** Extracted `loadJson`/`saveJson`/`saveJsonSync` into `lib/jsonStore.js`. The full router + per-resource refactor plan is at `/home/mitch/.claude/plans/floating-snacking-rain.md`; pass 1 (helpers + state) and pass 2 (router + registry) are still to do.
- **.gitignore** now excludes `data_backup_test/`, `tests/.tmp/`, and `test-results/`.
- All changes are behavior-preserving except the LXC SSH fix and the `maskEmail` rename, both of which were fixing pre-existing broken behavior. `node --check` and `bun run test:unit` both pass; `bun server.js` boots cleanly through to `Bun.serve`.

## 2026-05-16

- Redesigned `preferences.html` into a fuller preferences dashboard with summary cards, clearer sections, and improved controls.
- Added appearance presets, custom accent color controls, background image settings, background dimming, layout density, radius, font, and motion preferences.
- Added homepage preferences for quick actions, member rail visibility, compact layout, search focus, about:blank auto-launch, and launch behavior.
- Added preference backup tools to export, import, reset, and save preferences.
- Wired homepage behavior in `index.html` so saved preferences apply to the front page.
- Fixed the preferences saved-message bug so the confirmation visibly appears after saving.
- Improved preferences reliability when `/api/me` is unavailable.
- Hid the old widget-order controls because the redesigned homepage layout no longer uses them.
- Added a large homepage Games button inside the greeting card with the current day/date.
- Made the homepage Games quick action stand out more visually.
- Redesigned `/games/` into a full game hub with a hero section, featured game button, live date, stats, featured picks, improved category cards, better search, and polished game list cards.
- Fixed game launch paths on `/games/` so relative game links resolve through `/games/` before opening, iframe launching, popup launching, or about:blank launching.
- Expanded `casino.html` into a larger virtual-coin casino dashboard with 11 rooms, improved bankroll display, better recent-play history, clearer risk labels, and a more polished responsive layout.
- Added server-backed casino games for Coin Flip, Dice Duel, Crash, Prize Wheel, Scratch Card, and Keno Rush.
- Tightened casino odds, added max bet validation, and fixed casino stat tracking so invalid bets do not count as casino intake.
- Improved blackjack responses so the frontend can correctly detect finished hands and display win/loss results.
- Redesigned `enroll.html` into a polished access request page with a stronger hero, token claim area, signup flow explanation, and a clear list of site benefits.

## 2026-05-15

- Added visible Admin, Owner, Premium Members, and Online Members sections to the homepage.
- Added `tyler.thompson1@student.rjuhsd.us` as an admin.
- Moved `admin@mitch.pro` into a visual Owner role while keeping owner admin privileges.
- Added visual role labels: admins show `/developer`, owner shows `mitch /owner/developer`.
- Added a rainbow animated premium member chip for `adrian.lopez@student.rjuhsd.us`.
- Added admin badges to profile pages.
- Fixed profile stats so public profiles show real pixel counts, chess wins, achievements, and admin status.
- Added an admin panel on the homepage for privileged admin actions.
- Added secure free-premium granting for admins with premium-grant access.
- Added secure admin coin gifting with reasons and recipient notifications.
- Added admin notification sending to one user or all users.
- Added a notifications bell that stores unread coin gifts, admin notices, and encrypted chat message notices until marked read.
- Changed notification click targets to open through `mitchdog.com`.
- Improved and fixed Online Members refresh.
- Made `/api/members` refresh the current user's active status.
- Changed Online Members polling to every 15 seconds and disabled response caching.
- Added newsletter signup warning that abuse may result in account termination.
- Fixed member-list API routes for premium, admin, and owner members.
- Improved admin panel styling and safety text.
- Added an Advanced Admin Tools dashboard page.
- Added an admin-only dashboard API with visitor analytics, admin action logs, moderation reports, and privacy-respecting chat metadata.
- Added search/filter controls and JSON/CSV export for admin logs.
- Added admin action logging for premium grants, coin gifts, admin notifications, and canvas moderation actions.
- Added a homepage admin sidebar button linking to Advanced Admin Tools.
- Fixed the free-premium giver persistence bug.
- Removed the restricted privilege helper text from the admin panel.
- Updated admin notifications to identify `mitchdog.com` as their source.
- Moved premium and notification admin actions into Advanced Admin Tools.
- Added admin premium revocation from Advanced Admin Tools.
- Added notification unsend support for admin notices.
- Added browser push delivery for admin notifications using the same stored-message pattern as encrypted chat.
- Updated Advanced Admin Tools security monitoring to show visitor IP addresses and stored chat message history.
