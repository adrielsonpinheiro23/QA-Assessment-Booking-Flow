import { defineConfig, devices } from "@playwright/test";

// Playwright runs from the repo root. The tests live under automation/tests.
// The web server is started automatically (dev server on :3000) and reused
// between runs to keep the feedback loop fast.
//
// CI uses the production build (`next build && next start`) for more realistic
// timing/network behavior.

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false, // the BS1 4DJ retry fixture is stateful (per-process)
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { outputFolder: "../playwright-report", open: "never" }],
  ],
  outputDir: "../test-results",
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      // Default project — runs every spec in the directory, including the
      // Chromium-only screenshots and walkthrough video.
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      // Firefox runs only the user-flow + contract specs. Screenshots and the
      // walkthrough video are intentionally chromium-only artifacts.
      name: "firefox",
      use: { ...devices["Desktop Firefox"], viewport: { width: 1280, height: 800 } },
      testMatch: [
        "**/general-waste.spec.ts",
        "**/heavy-plasterboard.spec.ts",
        "**/api-contract.spec.ts",
      ],
    },
    {
      // WebKit (Safari engine) — same scope as Firefox.
      name: "webkit",
      use: { ...devices["Desktop Safari"], viewport: { width: 1280, height: 800 } },
      testMatch: [
        "**/general-waste.spec.ts",
        "**/heavy-plasterboard.spec.ts",
        "**/api-contract.spec.ts",
      ],
    },
  ],
  webServer: {
    command: isCI ? "npm run build && npm run start" : "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !isCI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
