// Automated accessibility checks using axe-core.
//
// Walks the booking flow and runs axe at every stable screen state.
// Configured to fail the test on any violation rated `serious` or `critical`,
// which is the bar for shipping. `moderate` and `minor` violations are
// surfaced in the test report as attachments without failing the build —
// they're tracked, not gated.
//
// Why scan multiple states, not just the landing page?
//   - Different React subtrees mount per step (different inputs, radios,
//     buttons, summary tables). A landing-page-only scan misses 80% of the
//     interactive surface.
//
// Run with: npm run test:a11y

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";
import {
  continueFromPostcode,
  enterPostcode,
  sel,
  selectFirstAddress,
} from "./helpers";

const SERIOUS_OR_WORSE = ["critical", "serious"] as const;

async function scan(page: import("@playwright/test").Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  // Always attach the full results so the HTML report carries them.
  test.info().attachments.push({
    name: `axe-${label}.json`,
    contentType: "application/json",
    body: Buffer.from(JSON.stringify(results.violations, null, 2)),
  });

  const blockers = results.violations.filter((v) =>
    (SERIOUS_OR_WORSE as readonly string[]).includes(v.impact ?? ""),
  );

  // Useful, specific failure message: list each blocker with its id, impact,
  // and the first node selector — enough to reproduce without opening axe docs.
  const summary = blockers
    .map((v) => {
      const firstSelector = v.nodes[0]?.target?.[0] ?? "(no node)";
      return `  - [${v.impact}] ${v.id}: ${v.help} (${firstSelector})`;
    })
    .join("\n");

  expect(
    blockers,
    `${label}: ${blockers.length} serious/critical a11y violation(s):\n${summary}`,
  ).toEqual([]);
}

test.describe("a11y · axe sweep across every flow step", () => {
  test("step 1 — postcode (idle, populated, error states)", async ({ page }) => {
    await page.goto("/");
    await scan(page, "step1-idle");

    await enterPostcode(page, "SW1A 1AA");
    await expect(page.locator(sel.addressList)).toBeVisible();
    await scan(page, "step1-address-list");

    // Validation error visible
    await page.locator(sel.postcodeInput).fill("NOT A POSTCODE");
    await page.locator(sel.postcodeLookupBtn).click();
    await expect(page.locator('[data-testid="postcode-input-error"]')).toBeVisible();
    await scan(page, "step1-validation-error");
  });

  test("step 2 — waste type (default + plasterboard branch)", async ({ page }) => {
    await page.goto("/");
    await enterPostcode(page, "SW1A 1AA");
    await selectFirstAddress(page);
    await continueFromPostcode(page);
    await expect(page.locator(sel.stepWaste)).toBeVisible();
    await scan(page, "step2-default");

    await page.locator(sel.heavyWasteCheckbox).check();
    await page.locator(sel.plasterboardCheckbox).check();
    await expect(
      page.locator(sel.plasterboardOption("bagged-on-skip")),
    ).toBeVisible();
    await scan(page, "step2-plasterboard-options");
  });

  test("step 3 — skip selection with disabled tiles", async ({ page }) => {
    await page.goto("/");
    await enterPostcode(page, "SW1A 1AA");
    await selectFirstAddress(page);
    await continueFromPostcode(page);
    await page.locator(sel.heavyWasteCheckbox).check();
    await page.locator(sel.wasteContinueBtn).click();
    await expect(page.locator(sel.stepSkip)).toBeVisible();
    await expect(page.locator('[data-testid="skip-option"]')).toHaveCount(9);
    await scan(page, "step3-with-disabled");
  });

  test("step 4 — review + price breakdown", async ({ page }) => {
    await page.goto("/");
    await enterPostcode(page, "SW1A 1AA");
    await selectFirstAddress(page);
    await continueFromPostcode(page);
    await page.locator(sel.wasteContinueBtn).click();
    await page.locator(sel.skipOption("8-yard")).click();
    await page.locator(sel.skipContinueBtn).click();
    await expect(page.locator(sel.stepReview)).toBeVisible();
    await scan(page, "step4-review");
  });

  test("step 5 — confirmation screen", async ({ page }) => {
    await page.goto("/");
    await enterPostcode(page, "SW1A 1AA");
    await selectFirstAddress(page);
    await continueFromPostcode(page);
    await page.locator(sel.wasteContinueBtn).click();
    await page.locator(sel.skipOption("4-yard")).click();
    await page.locator(sel.skipContinueBtn).click();
    await page.locator(sel.confirmBtn).click();
    await expect(page.locator(sel.stepDone)).toBeVisible();
    await scan(page, "step5-confirmation");
  });
});
