# Tests

Local integration + unit tests for the bun-server.

## Layout

| File | Purpose | Needs server? |
|---|---|---|
| `setup_session.js` | Generate valid SIDs, inject test admin + user into `data/names.json`, write a known admin passphrase, password hashes, and invite code. Idempotent. | No |
| `test_daily_login_unit.js` | Pure-math tests for daily-login reward tiers and streak-freeze state machine. | No |
| `test_daily_login.js` | Streak-freeze end-to-end (signup → verify → buy freeze → claim). | Yes |
| `endpoint_test.js` | Master integration suite (80 endpoints). | Yes |
| `test_runner.js` | Backs up `data/`, injects credentials, starts the server, runs the suite, restores `data/`. | Yes |

The integration tests (`test_runner.js` and `test_daily_login.js`) back up the live
`data/` directory into `data_backup_test/` at the repo root and restore it after the
run. The restore runs even on Ctrl-C and SIGTERM.

## Running

```sh
bun run test:unit                  # fastest, no server
bun run test:integration           # full suite (backs up data/)
bun run test:integration:daily-login  # streak-freeze focused
bun test                            # both
```

The integration tests assume the server is reachable on `BASE_URL`
(default `http://localhost:6800`). Override with `BASE_URL=https://… bun run test:integration`
to run against a deployed instance.

## CI

GitHub Actions runs `bun run test:unit` on every push to `master` before the
deploy job. Integration tests are not run in CI because they require a clean
`data/` and a running server; they should be run locally before merging.
