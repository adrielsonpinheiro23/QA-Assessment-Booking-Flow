// Load test.
//
// Simulates the kind of traffic the system is expected to handle in
// production: a steady stream of real bookings. We ramp to 20 concurrent
// users, hold for 2 minutes of steady state, then ramp down. Total ~4 minutes.
//
// Thresholds encode the SLOs:
//   - 95th percentile response time below 500ms
//   - 99th percentile below 1s
//   - HTTP error rate below 1%
//   - Full-flow success rate above 98%
//   - /api/booking/confirm p95 must be tighter (400ms) since it's the write path
//
// Run:
//   k6 run load/load-test.js
//   BASE_URL=http://localhost:3000 k6 run --out json=load/reports/load.json load/load-test.js

import { runBookingFlow } from "./lib/flow.js";
import { createReportHandler } from "./lib/report.js";

export const options = {
  stages: [
    { duration: "30s", target: 10 }, // ramp up
    { duration: "1m", target: 20 }, // ramp to target
    { duration: "2m", target: 20 }, // steady state
    { duration: "30s", target: 0 }, // ramp down
  ],
  thresholds: {
    checks: ["rate>0.98"],
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<500", "p(99)<1000"],
    flow_success: ["rate>0.98"],
    "http_req_duration{endpoint:confirm}": ["p(95)<400"],
    "http_req_duration{endpoint:postcode}": ["p(95)<300"],
  },
  // Useful defaults for reporting.
  summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"],
};

export default function () {
  runBookingFlow();
}

export const handleSummary = createReportHandler({
  name: "booking-load",
  type: "Load",
  vus: "20 VUs, ~4 minutes",
});
