# Endpoint Scorecard — Rust rewrite progress

Metric: `BASE_URL=http://localhost:<rust_port> bun tests/endpoint_test.js`
(the same suite that runs against bun). The rewrite is done when this is 100%.
Record one row per plan step; report honestly — partial passes are data.

| Step | Scope | Date | Pass | Total | Notes |
|------|-------|------|------|-------|-------|
| 1 | scaffold (no endpoints) | 2026-09-07 | 0 | ~80 | baseline pending Step 4 server |

## Static parity (tests/parity_static.js, added Step 4)

| Step | URLs checked | Diffs | Notes |
|------|--------------|-------|-------|