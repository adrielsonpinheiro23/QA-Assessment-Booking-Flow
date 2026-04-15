# Bug Reports

All three bugs below are **reproducible against the current `main` build** via
`docker compose up --build` or `npm run dev`. Evidence points to specific files/lines
so a developer can start investigation immediately.

| ID | Title | Severity | Priority | Category |
|---|---|---|---|---|
| [BUG-001](#bug-001) | Manual address entry path cannot complete a booking | **Major** | **P0** | Branching + API contract gap |
| [BUG-002](#bug-002) | Navigating Back from Step 2 drops the fetched address list | Minor | P2 | State transition |
| [BUG-003](#bug-003) | Manual address field accepts 1-character / whitespace-padded input | Minor | P2 | Validation |

Per the rubric: at least one bug is a branching / state-transition bug — **BUG-001** is
primarily a branching bug (the empty-list → manual-entry fallback branch), and
**BUG-002** is a pure state-transition bug.

---

<a id="bug-001"></a>

## BUG-001 — Manual address entry path cannot complete a booking

| Field | Value |
|---|---|
| **Severity** | Major |
| **Priority** | P0 |
| **Category** | Branching logic + API contract gap |
| **Environment** | Chrome 120, macOS 14. Built from this repo. Reproduced on `docker compose up` and on `npm run dev`. Terminal output from server log also captured below. |
| **First seen** | Initial build |
| **Related test case(s)** | TC-11, TC-15 (manual-entry fallback when postcode returns zero addresses) |

### Steps to reproduce

1. Open the app at <http://localhost:3000>.
2. In the postcode field enter `EC1A 1BB` (the empty-state fixture).
3. Click **Find address**.
4. In the amber banner that appears, click **enter your address manually**.
5. Type any address into the textarea (e.g. `1 Demo Street, London`).
6. Click **Continue**.
7. On Step 2, leave both toggles unchecked. Click **Continue**.
8. On Step 3, pick any skip (e.g. 6-yard). Click **Continue**.
9. On Step 4 (Review), click **Confirm booking**.

### Actual behaviour

The confirm request is sent to `/api/booking/confirm` with `"addressId": ""`.
The server rejects it with **HTTP 422** and the response:

```json
{ "error": "Missing/invalid fields: addressId", "code": "MISSING_FIELDS" }
```

The user sees a red error banner on the review step and cannot complete the booking.
The review page does render the manual address text correctly — so the data is
present in the client, it just isn't being communicated to the server in a form
the server accepts.

### Expected behaviour

A user who picked the manual-entry fallback (because their postcode returned zero
addresses) must be able to complete the booking. Either of the following is
acceptable:

- Extend the API contract with a `manualAddress` field on `/api/booking/confirm` and
  mark one of `addressId` / `manualAddress` as required (xor).
- Generate a synthetic `addressId` on the client for manual entries (e.g.
  `manual-<timestamp>`) and include the free-text address on the booking record.

The review screen should also not display "Address: empty" (or blank) in the
manual-entry case.

### Evidence

- Server log excerpt:
  ```
  POST /api/booking/confirm 422 in 2ms
  ```
- Direct reproduction with `curl`:
  ```bash
  curl -s -w "\nSTATUS:%{http_code}\n" -X POST http://localhost:3000/api/booking/confirm \
    -H 'Content-Type: application/json' \
    -d '{"postcode":"EC1A 1BB","addressId":"","heavyWaste":false,
         "plasterboard":false,"skipSize":"6-yard","price":260}'
  # => {"error":"Missing/invalid fields: addressId","code":"MISSING_FIELDS"}
  # => STATUS:422
  ```
- Source pointers:
  - [`src/components/PostcodeStep.tsx:80-88`](src/components/PostcodeStep.tsx) —
    `onContinue` callback forwards `addressId: null` in manual mode.
  - [`src/components/ReviewStep.tsx:51-59`](src/components/ReviewStep.tsx) —
    `confirmBooking` call coerces the null into `""`.
  - [`src/app/api/booking/confirm/route.ts:42-51`](src/app/api/booking/confirm/route.ts) —
    treats an empty string as "missing field".

### Suggested fix

Shortest path: extend the contract.

1. Add `manualAddress?: string` to `BookingConfirmRequest` in
   [`src/lib/types.ts`](src/lib/types.ts).
2. In the route handler, allow `(addressId AND it resolves to a real address) OR
   (manualAddress is a non-empty string)`. Reject if both / neither.
3. In [`src/components/ReviewStep.tsx`](src/components/ReviewStep.tsx), include
   `manualAddress` in the payload when `address === null`.

---

<a id="bug-002"></a>

## BUG-002 — Navigating Back from Step 2 drops the previously-fetched address list

| Field | Value |
|---|---|
| **Severity** | Minor |
| **Priority** | P2 |
| **Category** | State transition |
| **Environment** | Any browser. Built from this repo. |
| **Related test case(s)** | TC-39 ("Back button preserves postcode + address selection") |

### Steps to reproduce

1. Open the app.
2. Enter `SW1A 1AA` and click **Find address**. Verify the 12+ address list appears.
3. Pick the first address. Click **Continue**.
4. You are now on Step 2 (waste type). Click **Back**.
5. Observe Step 1.

### Actual behaviour

The postcode input still shows `SW1A 1AA` and the previously-selected `selectedId`
is still tracked inside the component, but the **address list is empty** — the
fieldset is not rendered, because `addresses` in `PostcodeStep` has reset to `[]`
on re-mount. The Continue button is disabled because `addresses.some(...)` returns
false. The user must click **Find address** again to resume.

### Expected behaviour

Back should be a cheap undo. The address list should re-hydrate, or — at minimum —
the lookup should fire automatically so the user can step forward without a
manual re-submit.

### Evidence

- Reproduced on Chrome 120 + Firefox 120 on macOS 14.
- Source pointer:
  [`src/components/PostcodeStep.tsx:25-28`](src/components/PostcodeStep.tsx) —
  `addresses` is initialized to `[]` on mount; only a successful `doLookup()` call
  populates it. The parent `BookingFlow` only retains the single selected `Address`,
  not the full list.

### Suggested fix

Lift the fetched address list into the parent `BookingFlow` state (store `Address[]`
alongside the selected `Address`), and pass it down as `initialAddresses`. Alternatively,
auto-fire the lookup on mount when `initialPostcode` is non-empty and `initialAddressId`
is non-null.

---

<a id="bug-003"></a>

## BUG-003 — Manual address field accepts single-character input

| Field | Value |
|---|---|
| **Severity** | Minor |
| **Priority** | P2 |
| **Category** | Validation |
| **Environment** | Any browser. Reproduced on `docker compose up`. |
| **Related test case(s)** | TC-15 |

### Steps to reproduce

1. Enter `EC1A 1BB` on Step 1 and click **Find address**.
2. Click **enter your address manually**.
3. Type a single character (`a`) in the manual address field.
4. Observe the Continue button.

### Actual behaviour

The Continue button enables as soon as the trimmed input is longer than 0
characters. There is no minimum-length check and no structural validation
(no requirement for a number, no requirement for a city, etc.).

### Expected behaviour

At a minimum, reject manual addresses shorter than a reasonable threshold (e.g.
10 characters) and show an inline validation message. Ideally, require at least
two whitespace-separated tokens so an address like "10 Downing Street" passes but
`a` does not.

### Evidence

- Source pointer:
  [`src/components/PostcodeStep.tsx:86`](src/components/PostcodeStep.tsx) —
  `canContinue` checks only `manualAddress.trim().length > 0`.

### Suggested fix

Replace `.length > 0` with a small validator, e.g.:

```ts
const manualOk =
  manualAddress.trim().length >= 10 &&
  /\s/.test(manualAddress.trim());
```

and surface an `aria-describedby` inline error when invalid.
