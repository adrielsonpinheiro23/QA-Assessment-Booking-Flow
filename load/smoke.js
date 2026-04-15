// Smoke test.
//
// Sanity check: 1 virtual user for 30 seconds running the full booking flow.
// Catches outright regressions (the API is down, a route returns 500, the
// contract is broken) before you bother running the heavier scenarios.
//
// Run:
//   k6 run load/smoke.js
//   BASE_URL=http://host.docker.internal:3000 k6 run load/smoke.js

import { runBookingFlow } from "./lib/flow.js";
import { createReportHandler } from "./lib/report.js";

export const options = {
  vus: 1,
  duration: "30s",
  thresholds: {
    // Every check should pass in a healthy system with a single user.
    checks: ["rate>0.99"],
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<500"],
    flow_success: ["rate>0.99"],
  },
  summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"],
};

export default function () {
  runBookingFlow();
}

export const handleSummary = createReportHandler({
  name: "booking-smoke",
  type: "Smoke",
  vus: "1 VU, 30 seconds",
});
