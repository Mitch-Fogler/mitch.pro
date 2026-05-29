# Changelog

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
