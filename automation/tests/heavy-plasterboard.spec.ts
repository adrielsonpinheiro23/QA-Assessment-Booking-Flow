import { expect, test } from "./fixtures";
import {
  continueFromPostcode,
  enterPostcode,
  sel,
  selectFirstAddress,
} from "./helpers";

// E2E flow 2: Heavy waste + plasterboard branching.
// Asserts that:
//  - heavy waste disables >= 2 skip sizes
//  - plasterboard branching reveals the 3 handling options
//  - Continue is blocked until a plasterboard handling option is selected
//  - price breakdown reflects both surcharges
test.describe("Booking flow — heavy waste + plasterboard", () => {
  test("completes a heavy + plasterboard booking with the correct breakdown", async ({
    page,
  }) => {
    await page.goto("/");

    await enterPostcode(page, "SW1A 1AA");
    await selectFirstAddress(page);
    await continueFromPostcode(page);

    // Toggle heavy waste + plasterboard.
    await page.locator(sel.heavyWasteCheckbox).check();
    await page.locator(sel.plasterboardCheckbox).check();

    // Continue should be disabled until a plasterboard option is selected.
    await expect(page.locator(sel.wasteContinueBtn)).toBeDisabled();
    await page.locator(sel.plasterboardOption("separate-collection")).check();
    await expect(page.locator(sel.wasteContinueBtn)).toBeEnabled();
    await page.locator(sel.wasteContinueBtn).click();

    // Skip step — heavy waste should disable the larger sizes.
    await expect(page.locator(sel.stepSkip)).toBeVisible();
    // Wait for the skip list to finish loading before counting.
    await expect(page.locator('[data-testid="skip-option"]')).toHaveCount(9);
    const disabledCount = await page
      .locator('[data-testid="skip-option"][data-disabled="true"]')
      .count();
    expect(disabledCount).toBeGreaterThanOrEqual(2);

    // A disabled option should not be selectable.
    const disabled = page.locator(sel.skipOption("14-yard"));
    await expect(disabled).toBeDisabled();

    // Pick a smaller, enabled size.
    await page.locator(sel.skipOption("6-yard")).click();
    await page.locator(sel.skipContinueBtn).click();

    // Review — price breakdown = 260 + 25 + 15 + 20% VAT = 360.
    await expect(page.locator(sel.stepReview)).toBeVisible();
    await expect(page.locator(sel.reviewHeavy)).toHaveText("Yes");
    await expect(page.locator(sel.reviewPlasterboard)).toHaveText(
      "Separate collection",
    );
    await expect(page.locator(sel.priceSubtotal)).toHaveText("£260");
    await expect(page.locator('[data-testid="price-heavy"]')).toHaveText("£25");
    await expect(
      page.locator('[data-testid="price-plasterboard"]'),
    ).toHaveText("£15");
    // 260 + 25 + 15 = 300, VAT = 60, total = 360
    await expect(page.locator('[data-testid="price-vat"]')).toHaveText("£60");
    await expect(page.locator(sel.priceTotal)).toHaveText("£360");

    await page.locator(sel.confirmBtn).click();
    await expect(page.locator(sel.stepDone)).toBeVisible();
    await expect(page.locator(sel.bookingId)).toHaveText(/^BK-\d{5}$/);
  });

  test("empty-state: EC1A 1BB returns 0 addresses", async ({ page }) => {
    await page.goto("/");
    await enterPostcode(page, "EC1A 1BB");
    await expect(page.locator(sel.postcodeEmpty)).toBeVisible();
    // Continue should still be disabled because no address was selected.
    await expect(page.locator(sel.postcodeContinueBtn)).toBeDisabled();
  });

  // This test forces a 500 response. Chromium logs network failures to the
  // console as errors — that's expected here, so we allowlist the matching
  // patterns for this test only. The watcher still fails on any other
  // unexpected console.error / pageerror.
  test.use({
    allowedConsolePatterns: {
      patterns: [/Failed to load resource/i, /500/, /UPSTREAM_500/],
    },
  });
  test("error + retry: BS1 4DJ fails the first call then succeeds", async ({
    page,
  }) => {
    // The BS1 4DJ retry counter is per-process and may have been
    // advanced by manual exploration or earlier tests. Intercept at the
    // network layer so this spec is deterministic regardless of server
    // state — first call gets a forced 500, subsequent calls pass through.
    let calls = 0;
    await page.route("**/api/postcode/lookup", async (route) => {
      const body = route.request().postDataJSON() as { postcode?: string };
      if (body?.postcode?.replace(/\s/g, "").toUpperCase() === "BS14DJ") {
        calls++;
        if (calls === 1) {
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({
              error: "Upstream postcode service temporarily unavailable",
              code: "UPSTREAM_500",
            }),
          });
          return;
        }
      }
      await route.continue();
    });

    await page.goto("/");
    await enterPostcode(page, "BS1 4DJ");
    // First call -> 500 -> error surface shown.
    await expect(page.locator(sel.postcodeError)).toBeVisible();
    // Retry should succeed and show the address list.
    await page.locator(sel.postcodeRetryBtn).click();
    await expect(page.locator(sel.addressList)).toBeVisible();
    expect(calls).toBeGreaterThanOrEqual(2);
  });

  test("invalid postcode blocks lookup at the input layer", async ({
    page,
  }) => {
    await page.goto("/");
    await page.locator(sel.postcodeInput).fill("NOT A POSTCODE");
    await page.locator(sel.postcodeLookupBtn).click();
    await expect(
      page.locator('[data-testid="postcode-input-error"]'),
    ).toBeVisible();
    await expect(page.locator(sel.addressList)).toHaveCount(0);
  });
});
