// Records a real .webm video of the full booking flow happy-path.
//
// Run with: npm run test:video
//
// Playwright captures the browser at 1280×720 the entire time the test runs,
// so we deliberately add small pauses between actions to make the result easy
// for a human reviewer to follow. The final file is copied out of the
// per-test results folder into ui/video/booking-walkthrough.webm so it lives
// in a stable, committable location.
//
// Why a Playwright spec and not a Loom / QuickTime recording?
//   - Reproducible: regenerated on demand, never stale.
//   - Self-narrating: the test asserts each step before moving on, so if the
//     UI breaks, the video stops at the broken step.
//   - Versionable: the .webm lands in git alongside the code.

import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { expect, test } from "@playwright/test";
import {
  continueFromPostcode,
  enterPostcode,
  sel,
  selectFirstAddress,
} from "./helpers";

// Always record this spec, regardless of the project default.
test.use({
  video: { mode: "on", size: { width: 1280, height: 720 } },
  viewport: { width: 1280, height: 720 },
});

const STEP_PAUSE = 700; // ms between user actions — slow enough to follow on screen

async function pause(page: import("@playwright/test").Page) {
  await page.waitForTimeout(STEP_PAUSE);
}

const OUTPUT_PATH = "ui/video/booking-walkthrough.webm";

test("records the full booking flow happy path", async ({ page }) => {
  // ──────── Step 1 · Postcode lookup ────────
  await page.goto("/");
  await expect(page.locator(sel.stepPostcode)).toBeVisible();
  await pause(page);

  await enterPostcode(page, "SW1A 1AA");
  await expect(page.locator(sel.addressList)).toBeVisible();
  await pause(page);

  await selectFirstAddress(page);
  await pause(page);
  await continueFromPostcode(page);

  // ──────── Step 2 · Waste type ────────
  await expect(page.locator(sel.stepWaste)).toBeVisible();
  await pause(page);

  await page.locator(sel.heavyWasteCheckbox).check();
  await pause(page);
  await page.locator(sel.plasterboardCheckbox).check();
  await pause(page);
  await page.locator(sel.plasterboardOption("bagged-on-skip")).check();
  await pause(page);

  await page.locator(sel.wasteContinueBtn).click();

  // ──────── Step 3 · Skip selection ────────
  await expect(page.locator(sel.stepSkip)).toBeVisible();
  // Wait for the skip list to render so the disabled-state cards appear in the video.
  await expect(page.locator('[data-testid="skip-option"]')).toHaveCount(9);
  await pause(page);

  // Pick a smaller skip (heavy waste disables the larger ones).
  await page.locator(sel.skipOption("8-yard")).click();
  await pause(page);
  await page.locator(sel.skipContinueBtn).click();

  // ──────── Step 4 · Review + price breakdown ────────
  await expect(page.locator(sel.stepReview)).toBeVisible();
  await pause(page);
  // Pause on the price breakdown so the viewer can read it.
  await expect(page.locator(sel.priceTotal)).toBeVisible();
  await page.waitForTimeout(STEP_PAUSE * 2);

  await page.locator(sel.confirmBtn).click();

  // ──────── Step 5 · Confirmation ────────
  await expect(page.locator(sel.stepDone)).toBeVisible();
  await expect(page.locator(sel.bookingId)).toContainText(/^BK-\d{5}$/);
  await page.waitForTimeout(STEP_PAUSE * 2);
});

// After the test finishes, Playwright finalizes the .webm. Copy it to a
// stable, committable path. We do this in afterAll so the video has been
// fully written (Playwright finalizes on context close, which happens between
// test and afterAll).
test.afterAll(async ({}, testInfo) => {
  // The active context's video lands in testInfo.outputDir/video.webm.
  // We don't have a handle to it from afterAll — instead the test's video
  // attachment is recorded on testInfo.attachments. Resolve via the run results.
  // Simpler: scan the test-results folder for the .webm matching this spec.
  // Playwright writes to test-results/<sanitized-test-name>/video.webm.
  const fs = await import("node:fs");
  const path = await import("node:path");
  const root = path.resolve(testInfo.project.outputDir);
  if (!fs.existsSync(root)) return;

  // Walk one level deep looking for video.webm under our spec's folder.
  const candidates: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (!entry.name.startsWith("walkthrough.video")) continue;
    const inner = path.join(root, entry.name);
    for (const f of fs.readdirSync(inner)) {
      if (f.endsWith(".webm")) candidates.push(path.join(inner, f));
    }
  }
  if (candidates.length === 0) {
    console.warn("[walkthrough.video] no .webm found under", root);
    return;
  }
  // Pick the most recent.
  candidates.sort(
    (a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs,
  );
  const src = candidates[0];

  if (!existsSync(dirname(OUTPUT_PATH))) {
    mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  }
  copyFileSync(src, OUTPUT_PATH);
  console.log(`[walkthrough.video] saved -> ${OUTPUT_PATH}`);
});
