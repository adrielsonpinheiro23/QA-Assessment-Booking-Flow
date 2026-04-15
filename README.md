# QA Assessment — Booking Flow

A realistic 4-step UK skip-hire booking flow built as the target-under-test for the QA assessment.
The app is a single Next.js 14 (App Router) service that serves both the UI and the four API
endpoints defined in the assessment contract — no external services, no hidden dependencies.

> 🌐 **Live demo:** https://qa-assessment-booking-flow-5ubsj49qp.vercel.app/
> &nbsp;&nbsp;(no login, no VPN, no expiry — just open it)
>
> Deterministic fixtures to try: `SW1A 1AA` (happy path, 12 addresses) ·
> `EC1A 1BB` (empty state) · `M1 1AE` (loading spinner) · `BS1 4DJ` (error + retry).

## At a glance

| Deliverable | Location |
|---|---|
| **Live demo** | https://qa-assessment-booking-flow-5ubsj49qp.vercel.app/ |
| Source code | [`src/`](src/) |
| Four API routes matching the spec | [`src/app/api/`](src/app/api/) |
| Deterministic fixtures (SW1A 1AA, EC1A 1BB, M1 1AE, BS1 4DJ) | [`src/lib/fixtures.ts`](src/lib/fixtures.ts) |
| E2E automation (Playwright + TS) | [`automation/`](automation/) |
| API contract suite (22 cases vs spec §5) | [`automation/tests/api-contract.spec.ts`](automation/tests/api-contract.spec.ts) |
| Automated a11y (axe-core across every step) | [`automation/tests/a11y.spec.ts`](automation/tests/a11y.spec.ts) |
| Cross-browser projects (Chromium + Firefox + WebKit) | [`automation/playwright.config.ts`](automation/playwright.config.ts) |
| Console-error / pageerror watcher fixture | [`automation/tests/fixtures.ts`](automation/tests/fixtures.ts) |
| Performance tests (k6 smoke / load / stress) | [`load/`](load/) |
| UI evidence (mobile + desktop screenshots) | [`ui/screenshots/`](ui/screenshots/) |
| Flow video (Playwright-recorded .webm) | [`ui/video/booking-walkthrough.webm`](ui/video/booking-walkthrough.webm) |
| Lighthouse reports (desktop + mobile, committed) | [`ui/lighthouse/`](ui/lighthouse/) |
| Step-by-step product walkthrough | [`docs/walkthrough.md`](docs/walkthrough.md) |
| Manual test cases (≥35) | [`manual-tests.md`](manual-tests.md) |
| Bug reports (≥3) | [`bug-reports.md`](bug-reports.md) |
| CI pipeline (lint + types + build + E2E + cross-browser) | [`.github/workflows/ci.yml`](.github/workflows/ci.yml) |
| Docker one-command run | [`Dockerfile`](Dockerfile) + [`docker-compose.yml`](docker-compose.yml) |

---

## Running the demo

### Option 1 — Docker (recommended)

```bash
docker compose up --build
```

Then open <http://localhost:3000>.

To stop:

```bash
docker compose down
```

### Option 2 — Node locally

Requires Node 20+.

```bash
npm install
npm run dev            # dev server on :3000
# or
npm run build && npm run start
```

---

## The flow

```
┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌────────────┐
│ 1. Postcode  │──▶│ 2. Waste     │──▶│ 3. Skip size │──▶│ 4. Review    │──▶│ Confirmed  │
│              │   │   type       │   │              │   │   + price    │   │ (BK-12345) │
└──────────────┘   └──────────────┘   └──────────────┘   └──────────────┘   └────────────┘
```

- **Step 1 — Postcode.** UK-format validation on the client, lookup call to the API,
  render a list of addresses, or surface the loading / empty / error+retry states.
  Manual-entry fallback for addresses not in the list.
- **Step 2 — Waste type.** Two toggles: `Heavy waste`, `Plasterboard`. Checking
  plasterboard reveals 3 handling options (Bag on skip · Separate collection · Small
  quantity under 10%). Continue is disabled until a handling option is chosen.
- **Step 3 — Skip size.** 9 options rendered with price and disabled state. When
  `Heavy waste` is on, sizes 14-yard, 16-yard, 20-yard and 40-yard are disabled (4 of 9 —
  satisfies the "≥2 disabled" requirement with visible reason text).
- **Step 4 — Review.** Full summary + price breakdown (skip hire + heavy surcharge +
  plasterboard surcharge + VAT = total). `Confirm booking` calls the API, shows a
  loading state, and prevents a second submit.

---

## API contract

All four routes match the contract in the assessment PDF. They live under `src/app/api/`.

| Method | Path | File |
|---|---|---|
| POST | `/api/postcode/lookup` | [`src/app/api/postcode/lookup/route.ts`](src/app/api/postcode/lookup/route.ts) |
| POST | `/api/waste-types` | [`src/app/api/waste-types/route.ts`](src/app/api/waste-types/route.ts) |
| GET | `/api/skips?postcode=…&heavyWaste=…` | [`src/app/api/skips/route.ts`](src/app/api/skips/route.ts) |
| POST | `/api/booking/confirm` | [`src/app/api/booking/confirm/route.ts`](src/app/api/booking/confirm/route.ts) |

### Deterministic fixtures

The fixtures below are hard-coded in [`src/lib/fixtures.ts`](src/lib/fixtures.ts) and exist
so the manual tests and automation can exercise every branch deterministically without
needing a real backend.

| Postcode | Behaviour |
|---|---|
| `SW1A 1AA` | 12 real addresses — happy path |
| `EC1A 1BB` | 0 addresses — empty state |
| `M1 1AE` | ~2.5s simulated latency — exercises the loading spinner |
| `BS1 4DJ` | Returns 500 on the first call, success on every subsequent call — exercises error + retry. The counter resets on server restart. |
| Any other valid UK postcode | Returns 0 addresses (you'll see the empty-state branch) |

Heavy-waste disables skip sizes 14-yard and larger (4 of 9 options).

### Quick API probe

```bash
curl -s -X POST http://localhost:3000/api/postcode/lookup \
  -H 'Content-Type: application/json' \
  -d '{"postcode":"SW1A 1AA"}' | jq
```

---

## Automation (Playwright)

Two E2E specs, a contract-test spec, an a11y spec, a walkthrough-video spec, and a
screenshot-capture spec live under [`automation/tests/`](automation/tests/). Everything
runs against the live dev server — Playwright starts it automatically via the
`webServer` config.

```bash
# one-time browser install
npm run test:install           # Chromium only (matches npm run test:e2e)
npm run test:install:all       # Chromium + Firefox + WebKit (for cross-browser)

# run all E2E + contract + a11y suites (Chromium)
npm run test:e2e

# run E2E flows headed (watch the browser)
npm run test:e2e:headed

# cross-browser: re-run E2E + contract in Firefox + WebKit
npm run test:e2e:cross-browser

# a11y only (axe-core across every flow step)
npm run test:a11y

# regenerate UI evidence screenshots into ui/screenshots/
npm run test:screenshots

# re-record the walkthrough video into ui/video/
npm run test:video
```

The HTML report lands at `playwright-report/index.html`. Open it with
`npx playwright show-report`.

### The two required E2E flows

| Spec | Flow | What it asserts |
|---|---|---|
| [`general-waste.spec.ts`](automation/tests/general-waste.spec.ts) | General waste, no plasterboard | 12+ addresses visible, all 9 skips enabled, review subtotal £300 → total £360 with no surcharges, booking ID matches `/^BK-\d{5}$/`, double-submit is blocked |
| [`heavy-plasterboard.spec.ts`](automation/tests/heavy-plasterboard.spec.ts) | Heavy waste + plasterboard branching | Plasterboard checkbox reveals 3 handling options, Continue disabled until one is picked, ≥2 skips disabled on the skip step, 14-yard is `aria-disabled`, price breakdown includes heavy (£25) + plasterboard (£15) + VAT, EC1A 1BB empty state, BS1 4DJ error+retry, invalid postcode blocked |

### API contract suite

[`api-contract.spec.ts`](automation/tests/api-contract.spec.ts) hits each of the four
endpoints directly (no UI, no browser) and asserts the response shape against the
contract in section 5 of the assessment PDF — every required field present and
correctly typed, every error response uses the `{ error, code }` envelope, and any
undocumented extra field fails the test. Two known additive extensions are tolerated
and explicitly exercised: `Skip.disabledReason` (present only on disabled skips) and
`BookingConfirmResponse.deduplicated: true` (returned only on the dedupe path).

22 cases cover happy-path shape, error envelope, dedupe behaviour, price tampering,
disabled-skip rejection, and unknown-address/skip rejection. If a field gets renamed
or a key disappears, these tests fail in a way that pinpoints the exact field —
much louder than the UI breaking three steps later.

Both suites use assertion at *every* step of the flow, not just the last one — progress
indicator, form state, network responses, DOM presence / enabled / disabled, and final
booking ID format.

### Accessibility suite (axe-core)

[`a11y.spec.ts`](automation/tests/a11y.spec.ts) runs
[`@axe-core/playwright`](https://github.com/dequelabs/axe-core-npm) against each of the
five flow screens (postcode idle / populated / error, waste default + plasterboard
branch, skip with disabled tiles, review, confirmation) and asserts zero
**critical** or **serious** violations under the WCAG 2.0/2.1 A and AA tag set. Any
violation is attached to the test report as JSON for triage.

This suite already caught two real issues in the shipped UI: `text-slate-400` on the
step indicator and footer failed AA color-contrast (~3.0:1 on white). Both were
fixed by bumping to `text-slate-500` (~4.6:1) — the 5 a11y tests are now green.

### Cross-browser

The Playwright config defines three projects — `chromium-desktop`, `firefox`,
`webkit` — and the E2E + contract specs are explicitly listed in each via
`testMatch`. Run them against the other engines with:

```bash
npm run test:install:all         # one-time
npm run test:e2e:cross-browser
```

Screenshots and walkthrough-video specs are deliberately scoped to Chromium only
(no value in triplicating those artefacts).

### Console-error / pageerror watcher

Every test uses a custom `test` from [`automation/tests/fixtures.ts`](automation/tests/fixtures.ts)
that auto-attaches a listener to the page for `console.error` and unhandled
`pageerror` events, and fails the test at teardown if any fired — catching React key
warnings, hydration mismatches, missing alt text, and network failures that the
assertion wall would never see. Tests that legitimately trigger a console error
(e.g. the forced-500 BS1 4DJ retry path) opt in to an allowlist:

```ts
test.use({
  allowedConsolePatterns: {
    patterns: [/Failed to load resource/i, /500/, /UPSTREAM_500/],
  },
});
```

### Selector strategy

Every interactive and every assertion target carries a `data-testid` attribute. These
are intentionally decoupled from copy and layout — visible text can change, the
`data-testid` stays. The full catalog lives in
[`automation/tests/helpers.ts`](automation/tests/helpers.ts).

### Mocking / test-data strategy

We intentionally **do not** mock at the network layer in the E2E tests. The backend is
in-process (it's a Next.js route handler), so the deterministic fixtures in
[`src/lib/fixtures.ts`](src/lib/fixtures.ts) already give us:

1. A happy-path address list (SW1A 1AA)
2. An empty-list response (EC1A 1BB)
3. Artificial latency (M1 1AE)
4. A first-call-fails, retry-succeeds response (BS1 4DJ — stateful in-memory counter)

This means the tests exercise the **real** route handlers against the **real** browser,
with predictable inputs keyed only by postcode. No `page.route(...)` intercepts, no
MSW, no fixtures to keep in sync across layers — if the contract regresses, the tests
fail for the right reason.

The BS1 4DJ retry counter is stateful **per process**. Playwright is configured with
`fullyParallel: false` and `workers: 1` to keep that determinism.

---

## UI evidence

### Screenshots

`npm run test:screenshots` captures the full flow at 1280×800 (desktop) and 375×812
(mobile iPhone-ish) into [`ui/screenshots/`](ui/screenshots/). Each run captures:

| # | State |
|---|---|
| 01 | Postcode step — empty |
| 02 | Postcode step — loading (M1 1AE) |
| 03 | Postcode step — empty result (EC1A 1BB) |
| 04 | Postcode step — error + retry (BS1 4DJ) |
| 05 | Postcode step — address list populated |
| 06 | Waste step — heavy + plasterboard options visible |
| 07 | Skip step — mixed enabled/disabled tiles |
| 08 | Review step — price breakdown |
| 09 | Confirmation |

### Walkthrough video

`npm run test:video` records a 1280×720 .webm of the full happy-path booking
flow, slowed slightly between actions so a human can follow it. The output
lands at [`ui/video/booking-walkthrough.webm`](ui/video/booking-walkthrough.webm).

The recorder is a Playwright spec
([`automation/tests/walkthrough.video.spec.ts`](automation/tests/walkthrough.video.spec.ts))
that asserts every step before moving on, so the video is always either a
passing flow or it doesn't exist — no stale Loom link, no out-of-date marketing.

### Step-by-step walkthrough

[`docs/walkthrough.md`](docs/walkthrough.md) documents each step of the flow with
screenshots, branching logic, the API call fired, the server-side guards, and a
worked example of the price breakdown. Read this alongside the video.

---

## Load & stress testing (k6)

Three k6 scripts live under [`load/`](load/). See [`load/README.md`](load/README.md) for the
full writeup (SLOs, caveats, metrics). Quick start:

```bash
# Install k6 (macOS):
brew install k6

# The app must be running — ideally the production build:
npm run build && npm run start

# Canary (1 VU, 30s)
npm run load:smoke

# Load test (20 VUs, ~4 min) — SLO-gated
npm run load:test

# Stress test (ramps to 200 VUs, ~6 min)
npm run load:stress
```

The helper in [`load/lib/flow.js`](load/lib/flow.js) exercises all four API endpoints
in the same order a real user would, with randomized postcode/address/skip combinations
to avoid skew from the server-side dedupe cache.

---

### Lighthouse reports

Desktop and mobile Lighthouse reports are committed at
[`ui/lighthouse/`](ui/lighthouse/) (both HTML and JSON). They were generated against
the production build with:

```bash
npm run build && npm run start   # in one terminal
npm run lighthouse                # in another
```

The `lighthouse` script runs the desktop preset and then the mobile form-factor,
writing both formats into `ui/lighthouse/`. Re-generate any time the UI changes
materially.

---

## Continuous integration

Every push to `main` and every PR against `main` runs through
[`.github/workflows/ci.yml`](.github/workflows/ci.yml):

| Job | Purpose | Gate? |
|---|---|---|
| `lint-and-typecheck` | `npm run lint` + `npm run type-check` | ✅ gates the rest |
| `build` | `npm run build`, uploads `.next` as an artifact | ✅ gates E2E |
| `e2e` | E2E + contract + a11y suites in Chromium against the production build | ✅ required |
| `cross-browser` | E2E + contract in Firefox + WebKit | ⚠️ `continue-on-error: true` until green-rate is high |

The `build` artifact is reused by both test jobs so we compile once per commit.
Playwright browser binaries are cached across runs. On any test failure the
Playwright HTML report and trace bundles are uploaded as artifacts for 7 days.

---

## Project layout

```
.
├── src/
│   ├── app/
│   │   ├── api/                    # 4 route handlers (the contract)
│   │   │   ├── postcode/lookup/route.ts
│   │   │   ├── waste-types/route.ts
│   │   │   ├── skips/route.ts
│   │   │   └── booking/confirm/route.ts
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx                # mounts <BookingFlow />
│   ├── components/
│   │   ├── BookingFlow.tsx         # the state machine
│   │   ├── StepIndicator.tsx
│   │   ├── PostcodeStep.tsx
│   │   ├── WasteTypeStep.tsx
│   │   ├── SkipStep.tsx
│   │   ├── ReviewStep.tsx
│   │   └── ConfirmationStep.tsx
│   └── lib/
│       ├── types.ts                # shared domain types
│       ├── fixtures.ts             # deterministic postcodes & skip rules
│       └── api.ts                  # thin fetch wrapper used by the UI
├── automation/
│   ├── playwright.config.ts
│   └── tests/
│       ├── fixtures.ts                 # console-error watcher fixture
│       ├── helpers.ts                  # selector catalog + flow helpers
│       ├── general-waste.spec.ts       # E2E flow 1
│       ├── heavy-plasterboard.spec.ts  # E2E flow 2 + edge cases
│       ├── api-contract.spec.ts        # 22 contract assertions vs spec section 5
│       ├── a11y.spec.ts                # axe-core sweep of every flow step
│       ├── walkthrough.video.spec.ts   # records ui/video/booking-walkthrough.webm
│       └── screenshots.spec.ts         # UI evidence capture
├── .github/
│   └── workflows/
│       └── ci.yml                  # lint + types + build + E2E + cross-browser
├── .eslintrc.json                  # extends next/core-web-vitals
├── docs/
│   └── walkthrough.md              # step-by-step product walkthrough
├── ui/screenshots/                 # generated by test:screenshots
├── ui/video/                       # generated by test:video
├── ui/lighthouse/                  # desktop + mobile Lighthouse (HTML + JSON)
├── manual-tests.md                 # ≥35 cases (10+ negative, 6+ edge, 4+ API, 4+ state)
├── bug-reports.md                  # ≥3 bugs incl. a branching/state one
├── Dockerfile
├── docker-compose.yml
├── package.json
└── tsconfig.json
```

---

## Scripts reference

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server on :3000 |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | ESLint (`next/core-web-vitals`) |
| `npm run type-check` | `tsc --noEmit` |
| `npm run test:install` | `playwright install chromium` (first-time only) |
| `npm run test:install:all` | `playwright install chromium firefox webkit` (for cross-browser) |
| `npm run test:e2e` | Run E2E + contract + a11y suites (Chromium) |
| `npm run test:e2e:headed` | Same, headed browser |
| `npm run test:e2e:cross-browser` | Re-run E2E + contract in Firefox + WebKit |
| `npm run test:a11y` | axe-core sweep across every flow step |
| `npm run test:screenshots` | Regenerate UI screenshots into `ui/screenshots/` |
| `npm run test:video` | Re-record the walkthrough video into `ui/video/` |
| `npm run lighthouse` | Generate desktop + mobile Lighthouse reports into `ui/lighthouse/` |
| `npm run load:smoke` / `:test` / `:stress` | k6 scenarios — see [`load/README.md`](load/README.md) |

---

## Design notes

- **Single service.** The UI and API live in the same Next.js app. This keeps the Docker
  image minimal, avoids cross-origin plumbing, and matches what a real hiring exercise
  reviewer can run in 30 seconds.
- **State machine in one component.** [`BookingFlow.tsx`](src/components/BookingFlow.tsx)
  owns the whole flow state. Each step is a child that receives its slice and a typed
  `onContinue` callback. No global store needed — keeps the blast radius of a broken
  step isolated.
- **Server guards everything the client does.** Double-submit, price-tamper, disabled-skip,
  unknown-address and bad-plasterboard-combinations all return 4xx from
  [`src/app/api/booking/confirm/route.ts`](src/app/api/booking/confirm/route.ts) — so
  the manual-test negative cases are reproducible with `curl`, not just the UI.
- **Accessibility.** Step indicator uses `aria-current="step"`; live regions announce
  loading/error states; all controls are keyboard-reachable with a visible focus ring;
  each list-option pair (addresses, plasterboard, skip) is a real radio or button.
