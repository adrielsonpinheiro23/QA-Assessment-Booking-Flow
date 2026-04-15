# Load & stress tests (k6)

Three k6 scripts covering three distinct performance concerns:

| Script | VUs | Duration | Purpose |
|---|---|---|---|
| [`smoke.js`](smoke.js) | 1 | 30s | Canary run. Catches regressions before anyone pays for heavier scenarios. |
| [`load-test.js`](load-test.js) | 20 (ramped) | ~4 min | Simulates expected production traffic. SLO-gated. |
| [`stress-test.js`](stress-test.js) | 20 → 200 | ~6 min | Pushes past expected load to find the breaking point. |

All three call the same full-flow helper in [`lib/flow.js`](lib/flow.js) so the
behavior under test is identical across scenarios — only the traffic shape and
the thresholds differ.

## Prerequisites

1. k6 installed. On macOS: `brew install k6`. (Other platforms: <https://k6.io/docs/get-started/installation/>.)
2. The app must be running and reachable. For realistic numbers run the
   **production build**, not the dev server:

   ```bash
   npm run build && npm run start
   # or
   docker compose up --build
   ```

   The dev server (`npm run dev`) has HMR/TS compilation in the hot path and
   will report inflated latencies that do not reflect production.

## Run

```bash
# Canary — 1 VU, 30s. Do this first.
npm run load:smoke

# Full load test against expected production traffic.
npm run load:test

# Stress test — push to 200 VUs.
npm run load:stress
```

Point at a different host with `BASE_URL`:

```bash
BASE_URL=https://your-demo.example.com npm run load:test
```

## What's measured

Besides the built-in `http_req_duration` / `http_req_failed` metrics, each run
emits custom metrics (see [`lib/flow.js`](lib/flow.js)):

| Metric | Kind | What it tracks |
|---|---|---|
| `postcode_latency` | Trend | `/api/postcode/lookup` only |
| `waste_latency` | Trend | `/api/waste-types` only |
| `skips_latency` | Trend | `/api/skips` only |
| `confirm_latency` | Trend | `/api/booking/confirm` only |
| `flow_success` | Rate | Fraction of iterations where every check passed |
| `flow_errors` | Rate | Inverse of the above |

Each HTTP request is also tagged with `endpoint:<name>` so you can slice
`http_req_duration` per endpoint in k6's built-in summary or in any downstream
dashboard (Grafana/Datadog/etc.).

## SLOs encoded as thresholds

If any threshold fails, `k6 run` exits non-zero — good enough for CI gating.

### Load test (`load-test.js`)

| Threshold | Why |
|---|---|
| `http_req_duration p(95) < 500ms` | UX: P95 felt latency stays snappy. |
| `http_req_duration p(99) < 1000ms` | Tail latency: one slow hit per 100 is OK, one per 10 is not. |
| `http_req_failed < 1%` | Health: a bad deploy shouldn't slip past this. |
| `flow_success > 98%` | End-to-end business metric — more meaningful than per-request. |
| `http_req_duration{endpoint:confirm} p(95) < 400ms` | The write path gets a tighter target. |
| `http_req_duration{endpoint:postcode} p(95) < 300ms` | Gatekeeper to the rest of the flow — must feel instant. |

### Stress test (`stress-test.js`)

| Threshold | Why |
|---|---|
| `http_req_failed < 5%` | We expect some degradation, not catastrophe. |
| `flow_success > 90%` | Even under 200 VUs the flow should still work for most users. |
| `http_req_duration p(95) < 2000ms` | Latency is allowed to grow but should stay bounded. |

## Caveats

- `/api/booking/confirm` has a **10-second server-side dedupe cache** keyed by
  `{postcode, addressId, skipSize, heavyWaste, plasterboard, plasterboardOption}`.
  The helper randomizes across 2 postcodes × 13 addresses × 5 skip sizes (≈130
  unique keys) to keep dedupe hits low but not zero. If your run shows
  suspiciously fast `confirm_latency`, that's the dedupe cache serving cached
  bookingIds — still a valid 200 response, just short-circuited.
- The simulated postcodes with artificial latency (`M1 1AE`) or first-call 500s
  (`BS1 4DJ`) are **not used** by these scripts — they're for the E2E suite.
- These scripts do not use a real browser — they hit the API directly. Lighthouse /
  WebPageTest remain the right tools for front-end perf budgeting.
