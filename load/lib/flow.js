// Shared booking-flow helpers for the k6 scripts.
//
// Every k6 scenario (smoke, load, stress) calls `runBookingFlow()` once per
// iteration. The function exercises all four API endpoints in the same order
// a real user would, with a small think-time between calls.
//
// Notes for interpreting results:
//  - We deliberately pick random postcodes + addresses + skip sizes to avoid
//    the 10-second server-side dedupe cache on /api/booking/confirm.
//  - We skip M1 1AE (2.5s simulated latency) and BS1 4DJ (500 on first call)
//    for performance tests — those fixtures are exercised by the E2E suite.

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

// Custom metrics so we can reason about each endpoint separately.
export const postcodeLatency = new Trend("postcode_latency", true);
export const wasteLatency = new Trend("waste_latency", true);
export const skipsLatency = new Trend("skips_latency", true);
export const confirmLatency = new Trend("confirm_latency", true);
export const flowSuccess = new Rate("flow_success");
export const flowErrors = new Rate("flow_errors");

// Deterministic fixtures with >0 addresses and no artificial latency/errors.
const POSTCODES = ["SW1A 1AA", "LS1 6AH"];

// Keep in sync with src/lib/fixtures.ts `buildSkips()` for the non-heavy case.
const SKIP_OPTIONS = [
  { size: "4-yard", price: 220 },
  { size: "6-yard", price: 260 },
  { size: "8-yard", price: 300 },
  { size: "10-yard", price: 340 },
  { size: "12-yard", price: 380 },
];

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function jsonHeaders() {
  return { headers: { "Content-Type": "application/json" } };
}

export function runBookingFlow() {
  let flowOk = true;
  const postcode = pickRandom(POSTCODES);

  // --- 1. Postcode lookup --------------------------------------------------
  const r1 = http.post(
    `${BASE_URL}/api/postcode/lookup`,
    JSON.stringify({ postcode }),
    { ...jsonHeaders(), tags: { endpoint: "postcode" } },
  );
  postcodeLatency.add(r1.timings.duration);

  const r1Ok = check(r1, {
    "postcode: status 200": (r) => r.status === 200,
    "postcode: returns addresses[]": (r) => {
      try {
        return Array.isArray(r.json("addresses"));
      } catch {
        return false;
      }
    },
  });
  flowOk = flowOk && r1Ok;

  if (!r1Ok) {
    flowSuccess.add(false);
    flowErrors.add(true);
    return;
  }
  const addresses = r1.json("addresses");
  if (!addresses.length) {
    flowSuccess.add(false);
    flowErrors.add(true);
    return;
  }
  const addressId = pickRandom(addresses).id;

  sleep(0.1 + Math.random() * 0.2); // 100–300ms think-time

  // --- 2. Waste-types ------------------------------------------------------
  const r2 = http.post(
    `${BASE_URL}/api/waste-types`,
    JSON.stringify({
      heavyWaste: false,
      plasterboard: false,
      plasterboardOption: null,
    }),
    { ...jsonHeaders(), tags: { endpoint: "waste" } },
  );
  wasteLatency.add(r2.timings.duration);
  flowOk =
    check(r2, {
      "waste: status 200": (r) => r.status === 200,
      "waste: ok=true": (r) => {
        try {
          return r.json("ok") === true;
        } catch {
          return false;
        }
      },
    }) && flowOk;

  sleep(0.1 + Math.random() * 0.2);

  // --- 3. Skip list --------------------------------------------------------
  const r3 = http.get(
    `${BASE_URL}/api/skips?postcode=${encodeURIComponent(postcode)}&heavyWaste=false`,
    { tags: { endpoint: "skips" } },
  );
  skipsLatency.add(r3.timings.duration);
  flowOk =
    check(r3, {
      "skips: status 200": (r) => r.status === 200,
      "skips: returns 9 sizes": (r) => {
        try {
          return r.json("skips").length === 9;
        } catch {
          return false;
        }
      },
    }) && flowOk;

  sleep(0.2 + Math.random() * 0.3); // 200–500ms — user contemplating skip

  // --- 4. Booking confirm --------------------------------------------------
  const skip = pickRandom(SKIP_OPTIONS);
  const r4 = http.post(
    `${BASE_URL}/api/booking/confirm`,
    JSON.stringify({
      postcode,
      addressId,
      heavyWaste: false,
      plasterboard: false,
      plasterboardOption: null,
      skipSize: skip.size,
      price: skip.price,
    }),
    { ...jsonHeaders(), tags: { endpoint: "confirm" } },
  );
  confirmLatency.add(r4.timings.duration);
  flowOk =
    check(r4, {
      "confirm: status 200": (r) => r.status === 200,
      "confirm: has bookingId": (r) => {
        try {
          return /^BK-\d{5}$/.test(r.json("bookingId"));
        } catch {
          return false;
        }
      },
    }) && flowOk;

  flowSuccess.add(flowOk);
  flowErrors.add(!flowOk);
}
