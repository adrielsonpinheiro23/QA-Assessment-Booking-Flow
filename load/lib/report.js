// Shared k6 `handleSummary` factory.
//
// Usage from any test script:
//
//   import { createReportHandler } from "./lib/report.js";
//
//   export const handleSummary = createReportHandler({
//     name: "booking-load",
//     type: "Load",
//     vus: "20 VUs, 4 minutes",
//   });
//
// Every run produces:
//   load/reports/<name>-<iso-timestamp>.html     — timestamped HTML report
//   load/reports/<name>-latest.html              — always the most recent run
//   load/reports/<name>-<iso-timestamp>.json     — raw k6 summary JSON
//   stdout                                       — compact text summary + verdict

const PCT = (n) => `${(n * 100).toFixed(2)}%`;
const MS = (n) => `${n.toFixed(1)}ms`;
const NUM = (n) =>
  typeof n === "number" && Number.isFinite(n) ? n.toLocaleString() : "—";

function fmtDuration(ms) {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

// Pull every threshold from the metrics and flatten into {metric, condition, ok, value}.
function collectThresholds(metrics) {
  const out = [];
  for (const [metric, data] of Object.entries(metrics)) {
    if (!data.thresholds) continue;
    for (const [condition, info] of Object.entries(data.thresholds)) {
      out.push({
        metric,
        condition,
        ok: info.ok,
        value: formatMetricValue(metric, data),
      });
    }
  }
  return out;
}

function formatMetricValue(name, metric) {
  const v = metric.values || {};
  if (metric.type === "rate") return PCT(v.rate ?? 0);
  if (metric.type === "counter") return NUM(v.count ?? 0);
  if (metric.type === "gauge") return NUM(v.value ?? 0);
  // trend — pick the most useful single number
  if (v["p(95)"] != null) return `p95 ${MS(v["p(95)"])}`;
  if (v.avg != null) return `avg ${MS(v.avg)}`;
  return "—";
}

function collectEndpointLatencies(metrics) {
  // Trends we defined in flow.js, one per endpoint.
  const rows = [];
  const keys = [
    ["postcode_latency", "POST /api/postcode/lookup"],
    ["waste_latency", "POST /api/waste-types"],
    ["skips_latency", "GET  /api/skips"],
    ["confirm_latency", "POST /api/booking/confirm"],
  ];
  for (const [metric, label] of keys) {
    const m = metrics[metric];
    if (!m) continue;
    const v = m.values || {};
    rows.push({
      label,
      avg: v.avg,
      med: v.med,
      p90: v["p(90)"],
      p95: v["p(95)"],
      p99: v["p(99)"],
      max: v.max,
    });
  }
  return rows;
}

// ---------- Text (stdout) ----------

function renderText(config, data) {
  const { metrics, state } = data;
  const thresholds = collectThresholds(metrics);
  const passed = thresholds.every((t) => t.ok);
  const verdict = passed ? "✅ PASS" : "❌ FAIL";

  const totalReqs = metrics.http_reqs?.values?.count ?? 0;
  const reqPerSec = metrics.http_reqs?.values?.rate ?? 0;
  const failRate = metrics.http_req_failed?.values?.rate ?? 0;
  const flowSuccess = metrics.flow_success?.values?.rate;
  const checks = metrics.checks?.values;

  const lines = [];
  const box = "═".repeat(62);
  lines.push("");
  lines.push(box);
  lines.push(`  k6 report · ${config.name}`);
  lines.push(`  ${config.type} · ${config.vus}`);
  lines.push(`  Duration: ${fmtDuration(state.testRunDurationMs)}`);
  lines.push(`  Verdict:  ${verdict}`);
  lines.push(box);
  lines.push("");
  lines.push("  Thresholds:");
  if (thresholds.length === 0) {
    lines.push("    (none declared)");
  } else {
    for (const t of thresholds) {
      const flag = t.ok ? "✓" : "✗";
      lines.push(
        `    ${flag} ${t.metric.padEnd(34)} ${t.condition.padEnd(18)} (${t.value})`,
      );
    }
  }
  lines.push("");
  lines.push("  Traffic:");
  lines.push(`    total requests ..... ${NUM(totalReqs)}`);
  lines.push(`    throughput ......... ${reqPerSec.toFixed(2)} req/s`);
  lines.push(`    http error rate .... ${PCT(failRate)}`);
  if (flowSuccess != null) {
    lines.push(`    flow success rate .. ${PCT(flowSuccess)}`);
  }
  if (checks) {
    lines.push(
      `    checks ............. ${NUM(checks.passes)} / ${NUM(checks.passes + checks.fails)} (${PCT(checks.rate)})`,
    );
  }
  lines.push("");
  lines.push("  Endpoint latency (milliseconds):");
  lines.push(
    "    " +
      "ENDPOINT".padEnd(30) +
      "  avg    med    p90    p95    p99    max",
  );
  for (const r of collectEndpointLatencies(metrics)) {
    lines.push(
      "    " +
        r.label.padEnd(30) +
        `  ${(r.avg ?? 0).toFixed(0).padStart(4)}   ` +
        `${(r.med ?? 0).toFixed(0).padStart(4)}   ` +
        `${(r.p90 ?? 0).toFixed(0).padStart(4)}   ` +
        `${(r.p95 ?? 0).toFixed(0).padStart(4)}   ` +
        `${(r.p99 ?? 0).toFixed(0).padStart(4)}   ` +
        `${(r.max ?? 0).toFixed(0).padStart(4)}`,
    );
  }
  lines.push("");
  lines.push("  Reports written to load/reports/:");
  lines.push(`    ${config.name}-latest.html       (open in browser)`);
  lines.push(`    ${config.name}-<timestamp>.html`);
  lines.push(`    ${config.name}-<timestamp>.json`);
  lines.push(box);
  lines.push("");
  return lines.join("\n");
}

// ---------- HTML ----------

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderHtml(config, data) {
  const { metrics, state } = data;
  const thresholds = collectThresholds(metrics);
  const passed = thresholds.every((t) => t.ok);
  const verdict = passed ? "PASS" : "FAIL";
  const verdictClass = passed ? "pass" : "fail";
  const endpoints = collectEndpointLatencies(metrics);
  const when = new Date().toISOString();
  const duration = fmtDuration(state.testRunDurationMs);

  const totalReqs = metrics.http_reqs?.values?.count ?? 0;
  const reqPerSec = metrics.http_reqs?.values?.rate ?? 0;
  const failRate = metrics.http_req_failed?.values?.rate ?? 0;
  const flowSuccess = metrics.flow_success?.values?.rate;
  const checks = metrics.checks?.values;
  const iters = metrics.iterations?.values?.count ?? 0;

  const trendRow = (m, label) => {
    const v = (metrics[m]?.values) || {};
    return `
      <tr>
        <td>${escapeHtml(label)}</td>
        <td class="num">${(v.avg ?? 0).toFixed(1)}</td>
        <td class="num">${(v.med ?? 0).toFixed(1)}</td>
        <td class="num">${(v["p(90)"] ?? 0).toFixed(1)}</td>
        <td class="num">${(v["p(95)"] ?? 0).toFixed(1)}</td>
        <td class="num">${(v["p(99)"] ?? 0).toFixed(1)}</td>
        <td class="num">${(v.max ?? 0).toFixed(1)}</td>
      </tr>
    `;
  };

  const endpointRows = endpoints
    .map((r) => {
      const fmt = (n) => (n == null ? "—" : n.toFixed(1));
      return `
        <tr>
          <td>${escapeHtml(r.label)}</td>
          <td class="num">${fmt(r.avg)}</td>
          <td class="num">${fmt(r.med)}</td>
          <td class="num">${fmt(r.p90)}</td>
          <td class="num">${fmt(r.p95)}</td>
          <td class="num">${fmt(r.p99)}</td>
          <td class="num">${fmt(r.max)}</td>
        </tr>
      `;
    })
    .join("");

  const thresholdRows =
    thresholds.length === 0
      ? `<tr><td colspan="4" class="muted">No thresholds declared.</td></tr>`
      : thresholds
          .map(
            (t) => `
              <tr class="${t.ok ? "pass" : "fail"}">
                <td>${escapeHtml(t.metric)}</td>
                <td><code>${escapeHtml(t.condition)}</code></td>
                <td>${escapeHtml(t.value)}</td>
                <td>${t.ok ? "✓ pass" : "✗ fail"}</td>
              </tr>
            `,
          )
          .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>k6 report · ${escapeHtml(config.name)}</title>
<style>
  :root { color-scheme: light; }
  body { font: 14px/1.5 -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; margin: 0; padding: 2rem; background: #f8fafc; color: #0f172a; }
  h1 { margin: 0 0 .25rem; font-size: 1.5rem; }
  h2 { font-size: 1rem; margin: 2rem 0 .75rem; color: #334155; text-transform: uppercase; letter-spacing: .05em; }
  .container { max-width: 960px; margin: 0 auto; }
  .meta { color: #64748b; margin-bottom: 1.5rem; }
  .meta code { background: #e2e8f0; padding: 1px 6px; border-radius: 4px; }
  .verdict { display: inline-block; padding: .5rem 1rem; border-radius: 6px; font-weight: 600; font-size: 1.125rem; }
  .verdict.pass { background: #dcfce7; color: #166534; border: 1px solid #86efac; }
  .verdict.fail { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: .75rem; }
  .card { background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; }
  .card .label { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: .05em; }
  .card .value { font-size: 1.5rem; font-weight: 600; margin-top: .25rem; }
  table { width: 100%; border-collapse: collapse; background: white; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
  th, td { text-align: left; padding: .625rem .875rem; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
  th { background: #f1f5f9; font-weight: 600; color: #334155; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  tr:last-child td { border-bottom: none; }
  tr.pass td { background: #f0fdf4; }
  tr.fail td { background: #fef2f2; }
  .muted { color: #94a3b8; text-align: center; padding: 1rem; }
  footer { margin-top: 2rem; color: #94a3b8; font-size: 12px; text-align: center; }
</style>
</head>
<body>
<div class="container">
  <h1>${escapeHtml(config.name)}</h1>
  <p class="meta">
    <strong>${escapeHtml(config.type)}</strong> · ${escapeHtml(config.vus)}
    · duration <code>${escapeHtml(duration)}</code>
    · generated <code>${escapeHtml(when)}</code>
  </p>
  <p><span class="verdict ${verdictClass}">${verdict}</span></p>

  <h2>Traffic</h2>
  <div class="grid">
    <div class="card"><div class="label">Iterations</div><div class="value">${NUM(iters)}</div></div>
    <div class="card"><div class="label">Total requests</div><div class="value">${NUM(totalReqs)}</div></div>
    <div class="card"><div class="label">Throughput</div><div class="value">${reqPerSec.toFixed(2)} req/s</div></div>
    <div class="card"><div class="label">HTTP error rate</div><div class="value">${PCT(failRate)}</div></div>
    ${flowSuccess != null ? `<div class="card"><div class="label">Flow success</div><div class="value">${PCT(flowSuccess)}</div></div>` : ""}
    ${checks ? `<div class="card"><div class="label">Checks</div><div class="value">${NUM(checks.passes)} / ${NUM(checks.passes + checks.fails)}</div></div>` : ""}
  </div>

  <h2>Thresholds</h2>
  <table>
    <thead>
      <tr><th>Metric</th><th>Condition</th><th>Actual</th><th>Status</th></tr>
    </thead>
    <tbody>${thresholdRows}</tbody>
  </table>

  <h2>Endpoint latency (ms)</h2>
  <table>
    <thead>
      <tr>
        <th>Endpoint</th>
        <th style="text-align:right">avg</th>
        <th style="text-align:right">med</th>
        <th style="text-align:right">p90</th>
        <th style="text-align:right">p95</th>
        <th style="text-align:right">p99</th>
        <th style="text-align:right">max</th>
      </tr>
    </thead>
    <tbody>
      ${endpointRows}
    </tbody>
  </table>

  <h2>Aggregate HTTP</h2>
  <table>
    <thead>
      <tr>
        <th>Metric</th>
        <th style="text-align:right">avg</th>
        <th style="text-align:right">med</th>
        <th style="text-align:right">p90</th>
        <th style="text-align:right">p95</th>
        <th style="text-align:right">p99</th>
        <th style="text-align:right">max</th>
      </tr>
    </thead>
    <tbody>
      ${trendRow("http_req_duration", "http_req_duration")}
      ${trendRow("http_req_waiting", "http_req_waiting (TTFB)")}
      ${trendRow("iteration_duration", "iteration_duration")}
    </tbody>
  </table>

  <footer>Generated by k6 via load/lib/report.js · <a href="${escapeHtml(config.name)}-latest.html">${escapeHtml(config.name)}-latest.html</a></footer>
</div>
</body>
</html>`;
}

// ---------- Public API ----------

export function createReportHandler(config) {
  const { name, type, vus } = config;
  if (!name || !type || !vus) {
    throw new Error(
      "createReportHandler requires { name, type, vus } — got: " +
        JSON.stringify(config),
    );
  }
  return function handleSummary(data) {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const base = `load/reports/${name}`;
    const html = renderHtml(config, data);
    const json = JSON.stringify(data, null, 2);
    return {
      stdout: renderText(config, data),
      [`${base}-${ts}.html`]: html,
      [`${base}-latest.html`]: html,
      [`${base}-${ts}.json`]: json,
    };
  };
}
