// Stress test.
//
// Push beyond expected load to find the breaking point and verify the system
// degrades gracefully instead of catastrophically. We ramp through
// 20 → 50 → 100 → 150 → 200 concurrent users over ~5 minutes, then cool down.
//
// Under stress, latency is expected to grow. The goal is NOT to hit the
// load-test SLOs — it's to verify:
//   - the system doesn't return 5xx in bulk (errors stay < 5%)
//   - the full-flow success rate stays above 90%
//   - the process doesn't crash, hang, or leak memory
//
// Run:
//   k6 run load/stress-test.js
//   BASE_URL=http://localhost:3000 k6 run --out json=load/reports/stress.json load/stress-test.js

import { runBookingFlow } from "./lib/flow.js";
import { createReportHandler } from "./lib/report.js";

export const options = {
  stages: [
    { duration: "1m", target: 20 },
    { duration: "1m", target: 50 },
    { duration: "1m", target: 100 },
    { duration: "1m", target: 150 },
    { duration: "1m", target: 200 },
    { duration: "1m", target: 0 }, // cool-down
  ],
  thresholds: {
    // Degrade gracefully — aim for <5% failures even under 200 VUs.
    http_req_failed: ["rate<0.05"],
    // The full flow (4 chained API calls) should still work for 90% of users.
    flow_success: ["rate>0.90"],
    // We also want to see p95 numbers to judge degradation.
    http_req_duration: ["p(95)<2000"],
  },
  summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"],
};

export default function () {
  runBookingFlow();
}

export const handleSummary = createReportHandler({
  name: "booking-stress",
  type: "Stress",
  vus: "20 → 200 VUs, ~6 minutes",
});
