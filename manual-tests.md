# Manual Test Cases — Booking Flow

**Target under test:** Skip-hire booking flow at <http://localhost:3000>
(run `docker compose up --build` or `npm run dev`).

**Scope:** All four steps of the booking flow + all four API endpoints.

**Legend.**
- **Type** — `Positive` · `Negative` · `Edge` · `API failure` · `State transition` · `Accessibility`
- **Priority** — `P0` (blocker) · `P1` (major) · `P2` (minor)

**Tally (for grading against the rubric).**

| Count | Type |
|---|---|
| 44 | Total test cases |
| 12 | Positive |
| 10 | Negative |
| 7 | Edge |
| 5 | API failure |
| 7 | State transition |
| 3 | Accessibility |

---

## 1. Step 1 — Postcode lookup

| ID | Type | Priority | Title | Preconditions | Steps | Expected | Data |
|---|---|---|---|---|---|---|---|
| TC-01 | Positive | P0 | Happy path: valid postcode returns 12+ addresses | App loaded on Step 1 | 1. Type `SW1A 1AA`. 2. Click **Find address**. | Loading spinner appears briefly. List shows ≥12 addresses. Continue is still disabled until one is picked. | `SW1A 1AA` |
| TC-02 | Positive | P1 | Postcode case-insensitive + whitespace-tolerant | On Step 1 | 1. Type `sw1a  1aa`. 2. Submit. | Same result as canonical form — address list populated. | `sw1a  1aa` |
| TC-03 | Positive | P1 | Enter key triggers lookup | Cursor in postcode field | 1. Type `SW1A 1AA`. 2. Press Enter. | Lookup fires; address list appears. | `SW1A 1AA` |
| TC-04 | Edge | P2 | Trailing whitespace is trimmed | On Step 1 | 1. Type `  SW1A 1AA   `. 2. Submit. | Lookup succeeds; trimmed value is sent to the API. | `  SW1A 1AA  ` |
| TC-05 | Edge | P1 | Postcode with format A9A 9AA (e.g. W1A 1AA) is accepted | On Step 1 | 1. Type `W1A 1AA` (or similar). 2. Submit. | Input validation passes; request is sent. (Fallback empty list is fine.) | `W1A 1AA` |
| TC-06 | Negative | P0 | Empty postcode is rejected at input layer | On Step 1 | 1. Leave input blank. 2. Click **Find address**. | Inline error shown; no network call is made. | _(empty)_ |
| TC-07 | Negative | P0 | Obviously malformed postcode rejected client-side | On Step 1 | 1. Type `NOT A POSTCODE`. 2. Submit. | Inline validation error; no API call. | `NOT A POSTCODE` |
| TC-08 | Negative | P1 | Non-UK postcode rejected client-side | On Step 1 | 1. Type `90210`. 2. Submit. | Inline validation error. | `90210` |
| TC-09 | Negative | P1 | Postcode with special characters rejected | On Step 1 | 1. Type `SW1A!1AA`. 2. Submit. | Inline validation error. | `SW1A!1AA` |
| TC-10 | Edge | P2 | Very long input does not crash UI | On Step 1 | 1. Paste a 500-char string. 2. Submit. | Inline validation error; page remains responsive. | 500-char string |
| TC-11 | API failure | P0 | Empty-state: `EC1A 1BB` returns 0 addresses | On Step 1 | 1. Enter `EC1A 1BB`. 2. Submit. | "No addresses found" message. Option to enter address manually. Continue stays disabled until manual address entered. | `EC1A 1BB` |
| TC-12 | API failure | P0 | Slow-network: `M1 1AE` shows loading spinner ≥2s | On Step 1 | 1. Enter `M1 1AE`. 2. Submit. 3. Observe. | Loading spinner visible while request is in flight. Button text becomes "Looking up…". Results appear after ~2.5s. | `M1 1AE` |
| TC-13 | API failure | P0 | Retry: `BS1 4DJ` fails first call, succeeds second | On Step 1 | 1. Enter `BS1 4DJ`. 2. Submit. 3. Click **Retry**. | First request → error card with Retry button. Second request → address list. | `BS1 4DJ` |
| TC-14 | API failure | P1 | Retry button stays functional after multiple failures | Server restarted → counter reset | 1. Enter `BS1 4DJ` → Retry works. 2. Reload page. 3. Enter `BS1 4DJ` again. | Step 1: retry after one 500. Step 3 (after server restart): same behaviour reproducible. | `BS1 4DJ` |
| TC-15 | State transition | P0 | Manual-entry fallback when list empty | Empty state shown (TC-11) | 1. Click **enter your address manually**. 2. Type address. 3. Continue. | Manual address captured, Continue enabled, next step uses manual address. | `EC1A 1BB` |
| TC-16 | Edge | P1 | Selecting an address then changing postcode clears selection | Addresses shown for SW1A 1AA, one selected | 1. Change postcode to `LS1 6AH`. 2. Submit. | Previous selection discarded; new list shown. Continue disabled. | `LS1 6AH` |
| TC-17 | Positive | P1 | Autocomplete attribute set correctly | On Step 1 | Inspect postcode input. | Element has `autocomplete="postal-code"`. | — |
| TC-18 | Accessibility | P1 | Invalid postcode surfaces `aria-invalid` | On Step 1 | 1. Type `NOPE`. 2. Submit. 3. Inspect. | Input has `aria-invalid="true"` and is described by the error node. | `NOPE` |

## 2. Step 2 — Waste type + plasterboard branching

| ID | Type | Priority | Title | Preconditions | Steps | Expected | Data |
|---|---|---|---|---|---|---|---|
| TC-19 | Positive | P0 | General waste (no toggles) continues fine | On Step 2 | 1. Leave Heavy + Plasterboard unchecked. 2. Continue. | Moves to Step 3. Skip list fully enabled. | — |
| TC-20 | Positive | P0 | Heavy waste alone continues fine | On Step 2 | 1. Check Heavy. 2. Continue. | Moves to Step 3 with 4 sizes disabled. | — |
| TC-21 | State transition | P0 | Plasterboard toggle reveals 3 handling options | On Step 2 | 1. Check Plasterboard. 2. Observe. | 3 radio options appear (Bag on skip · Separate collection · Under 10%). Continue remains disabled until one is picked. | — |
| TC-22 | Negative | P0 | Continue disabled when plasterboard checked but no handling option | On Step 2, Plasterboard checked | 1. Click **Continue**. | Button is disabled, pointer becomes not-allowed; step does not advance. | — |
| TC-23 | State transition | P1 | Unchecking plasterboard clears the selected handling option | Plasterboard checked + option selected | 1. Uncheck Plasterboard. 2. Re-check it. | Radio group is reset — no option pre-selected. | — |
| TC-24 | Positive | P1 | Both Heavy and Plasterboard with handling option → continues | On Step 2 | 1. Check Heavy + Plasterboard. 2. Pick "Separate collection". 3. Continue. | Advances; Step 4 price breakdown shows both surcharges. | — |
| TC-25 | Accessibility | P1 | Plasterboard radio group has accessible name | On Step 2, Plasterboard checked | Inspect fieldset. | Fieldset has `aria-label="Plasterboard handling options"` (or `<legend>`). | — |

## 3. Step 3 — Skip selection

| ID | Type | Priority | Title | Preconditions | Steps | Expected | Data |
|---|---|---|---|---|---|---|---|
| TC-26 | Positive | P0 | 9 skip sizes rendered | On Step 3 | Count the skip tiles. | Exactly 9 tiles with prices: 4/6/8/10/12/14/16/20/40-yard. | — |
| TC-27 | State transition | P0 | Heavy waste disables the largest 4 sizes | On Step 2 → checked Heavy → Step 3 | Inspect disabled tiles. | 14-yard, 16-yard, 20-yard, 40-yard are `aria-disabled="true"` with a visible reason. | — |
| TC-28 | Negative | P0 | Disabled skip tile is not clickable | On Step 3 with Heavy waste on | 1. Click the 14-yard tile. | Nothing happens. Selection is unchanged. | — |
| TC-29 | Edge | P1 | Changing waste type back to general re-enables sizes | On Step 3 with Heavy on | 1. Back. 2. Uncheck Heavy. 3. Continue. | All 9 sizes enabled again. Previously selected skip may have been cleared if it was disabled. | — |
| TC-30 | State transition | P1 | Previously selected skip persisted across Back/Forward | On Step 3 — pick 6-yard → Continue → Back | 1. Back. 2. Observe. | 6-yard tile is still visually selected. | — |
| TC-31 | Edge | P2 | Changing from general → heavy clears selection if it became disabled | On Step 3 with 16-yard selected | 1. Back → Step 2 → check Heavy → Continue. | 16-yard selection is cleared. Continue disabled until a new choice. | — |

## 4. Step 4 — Review + confirm

| ID | Type | Priority | Title | Preconditions | Steps | Expected | Data |
|---|---|---|---|---|---|---|---|
| TC-32 | Positive | P0 | Review summary reflects all prior choices | Full flow on SW1A 1AA, 8-yard, general waste | Inspect summary. | Postcode `SW1A 1AA`, chosen address visible, Heavy=No, Plasterboard=No, Skip=8-yard. | — |
| TC-33 | Positive | P0 | Price breakdown math is correct (general waste, 8-yard) | Same as TC-32 | Inspect breakdown. | Subtotal £300, VAT £60, Total £360. No surcharge lines. | — |
| TC-34 | Positive | P0 | Price breakdown math is correct (heavy + plasterboard, 6-yard) | Heavy on, plasterboard on w/ option, 6-yard selected | Inspect breakdown. | Subtotal £260, Heavy £25, Plasterboard £15, VAT £60, Total £360. | — |
| TC-35 | Negative | P0 | Double-submit is prevented | On Step 4 | 1. Click **Confirm** rapidly 5 times. | Button becomes disabled immediately after first click; confirmation shows **exactly one** booking ID. | — |
| TC-36 | API failure | P1 | API 409 on price-mismatch is surfaced gracefully | Intercept request, change `price` to wrong value | 1. Modify request in DevTools → **Confirm**. | Inline error banner; button re-enables; no confirmation shown. | — |
| TC-37 | State transition | P1 | Confirmation screen → start over resets state | After confirmation | 1. Click **Book another skip**. | Returns to Step 1 with blank inputs. No residual state. | — |
| TC-38 | Positive | P1 | Booking ID format is `BK-#####` | After confirm | Inspect booking ID. | Matches `/^BK-\d{5}$/`. | — |

## 5. Cross-step / regression

| ID | Type | Priority | Title | Preconditions | Steps | Expected |
|---|---|---|---|---|---|---|
| TC-39 | State transition | P1 | Back button preserves postcode + address selection | After reaching Step 2 | 1. Click **Back**. | Step 1 pre-populated with postcode + selected address. |
| TC-40 | Negative | P1 | Browser refresh at Step 3 resets the flow (known limitation) | Mid-flow | 1. Reload page. | Flow restarts from Step 1 — state is in-memory only. |
| TC-41 | Edge | P2 | Postcode input is forced uppercase visually but any case is accepted | On Step 1 | 1. Type `sw1a 1aa`. | Either stays lowercase or is auto-uppercased; server accepts both. |
| TC-42 | Accessibility | P1 | All primary buttons are reachable via Tab in visual order | On any step | Tab through the page. | Focus order is intuitive; visible focus ring on every interactive element. |
| TC-43 | Negative | P0 | Step 1 Continue is disabled until an address is selected | Address list shown for `SW1A 1AA`, no selection yet | 1. Without picking an address, attempt to click **Continue**. | Continue button is `disabled`/`aria-disabled` — clicking does nothing; flow does not advance. |
| TC-44 | Negative | P0 | Step 3 Continue is disabled until a skip is selected | On Step 3, skip list rendered | 1. Without picking any skip, attempt to click **Continue**. | Continue button is `disabled`/`aria-disabled` — clicking does nothing; flow stays on Step 3. |

---

## How these map to the assessment rubric

Counts below are exact — every test labelled with the matching `Type` in the
tables above. No double-counting, no cross-categorising.

| Rubric requirement | Actual coverage |
|---|---|
| ≥ 35 cases | **44** total ✅ |
| ≥ 10 Negative | **10** — TC-06, TC-07, TC-08, TC-09, TC-22, TC-28, TC-35, TC-40, TC-43, TC-44 ✅ |
| ≥ 6 Edge | **7** — TC-04, TC-05, TC-10, TC-16, TC-29, TC-31, TC-41 ✅ |
| ≥ 4 API failure | **5** — TC-11, TC-12, TC-13, TC-14, TC-36 ✅ |
| ≥ 4 State transition | **7** — TC-15, TC-21, TC-23, TC-27, TC-30, TC-37, TC-39 ✅ |
