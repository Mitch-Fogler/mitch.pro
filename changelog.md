# Changelog

## 2026-08-22

- **LXC SSH bootstrap fix.** Replaced the brittle `setTimeout` + `ssh root@mitch.pro:39222` shellout in `createLxcContainer` with a proper Proxmox-API-based bootstrap (`pctExec`, `waitForLxcRunning`, `bootstrapLxcSshd`). The new path installs `openssh-server` if missing, writes an idempotent `/etc/ssh/sshd_config.d/99-mitch.conf` drop-in (Debian 12's default `PermitRootLogin prohibit-password` was rejecting the auto-generated root password), enables and starts the service, and verifies port 22 is listening. Added `/api/admin/lxc-repair` so admins can fix already-broken LXCs without re-creating them. Failures now log clearly instead of vanishing silently.
- **LXC startup failure detection.** `waitForLxcRunning` now returns `{ ok, error, log }` instead of a bare boolean. It tracks whether the container ever reached the `starting` state and fails fast if it bounces back to `stopped` — the signature of `lxc-start` dying during exec. The error pulls the last ~50 lines of the LXC start log via `GET /nodes/{node}/lxc/{vmid}/log` and `classifyLxcStartFailure()` turns it into a human-readable hint (special-cases "Failed to exec /sbin/init", cgroup mount failure, AppArmor, and seccomp), so the next broken container logs the actual cause instead of a 60-second timeout.
- **Fast-path LXC sshd bootstrap.** `bootstrapLxcSshd` now TCP-probes `10.0.0.<vmid>:22` immediately after `waitForLxcRunning` succeeds and returns `{ success: true, alreadyReady: true }` if sshd is already listening. This is the common case for Proxmox's standard templates (debian-12-standard, ubuntu-22.04+) which ship openssh-server enabled by default — confirmed by `pct enter 200` showing sshd on :22 with no extra work. The fast-path avoids the PVE API `POST /nodes/.../lxc/.../exec` call which returns 501 on this version of Proxmox. The full apt-install/drop-in/systemctl path stays as a fallback for templates that don't ship sshd preinstalled.
- **Diagnosed the original "LXC 200 won't boot" report** as a one-off startup failure (`__lxc_start: 2288 Failed to spawn container "200"`), not a recurring template problem. The user's `debian-12-standard` template is fine; subsequent containers have been coming up. The TCP probe makes the bootstrap robust against transient startup hiccups without depending on Proxmox API endpoints that vary by version.
- Added `tools/proxmox-hookscript-mitch-sshd-bootstrap.sh` — Proxmox-side hookscript that runs during pre-start and (1) installs openssh-server if missing, (2) writes the `99-mitch.conf` drop-in for `PermitRootLogin yes`, (3) generates host keys if missing, (4) creates `/var/run/sshd`, and (5) reads the password Proxmox stored in `/etc/pve/lxc/<vmid>.conf` and runs `chpasswd` inside the chroot. The password step matters because standard (non-cloud-init) Proxmox templates accept the `password:` field at create time but do NOT honor it on first boot — the container is created with no usable root password, so `ssh root@10.0.0.X` fails with `Permission denied` even though sshd is listening. The hookscript is now wired into `createLxcContainer` via `hookscript: local:snippets/mitch-sshd-bootstrap.sh`. Install path on the host: `install -m 0755 tools/proxmox-hookscript-mitch-sshd-bootstrap.sh /var/lib/vz/snippets/mitch-sshd-bootstrap.sh`. Idempotent; runs in pre-start so it completes before Proxmox reports the container as `running`. After reprovisioning LXC 200 (`pct stop 200 && pct start 200`), `ssh root@10.0.0.200` should accept the password set during container creation.
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
