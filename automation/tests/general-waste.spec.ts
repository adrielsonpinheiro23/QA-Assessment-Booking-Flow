import { expect, test } from "./fixtures";
import {
  continueFromPostcode,
  enterPostcode,
  sel,
  selectFirstAddress,
} from "./helpers";

// E2E flow 1: General waste (no heavy, no plasterboard).
// Covers the happy path end-to-end with assertions at every step.
test.describe("Booking flow — general waste", () => {
  test("completes a general-waste booking end to end", async ({ page }) => {
    await page.goto("/");

    // Step 1 — postcode lookup returns SW1A addresses.
    await expect(page.locator(sel.stepPostcode)).toBeVisible();
    await enterPostcode(page, "SW1A 1AA");
    await expect(page.locator(sel.addressList)).toBeVisible();
    const addressCount = await page.locator('[data-testid="address-option"]').count();
    expect(addressCount).toBeGreaterThanOrEqual(12);
    await selectFirstAddress(page);
    await continueFromPostcode(page);

    // Step 2 — general waste only. Leave both toggles off.
    await expect(page.locator(sel.heavyWasteCheckbox)).not.toBeChecked();
    await expect(page.locator(sel.plasterboardCheckbox)).not.toBeChecked();
    await page.locator(sel.wasteContinueBtn).click();

    // Step 3 — skip list should have all 9 options, none disabled.
    await expect(page.locator(sel.stepSkip)).toBeVisible();
    await expect(page.locator('[data-testid="skip-option"]')).toHaveCount(9);
    const disabledCount = await page
      .locator('[data-testid="skip-option"][data-disabled="true"]')
      .count();
    expect(disabledCount).toBe(0);

    await page.locator(sel.skipOption("8-yard")).click();
    await page.locator(sel.skipContinueBtn).click();

    // Step 4 — review + price breakdown.
    await expect(page.locator(sel.stepReview)).toBeVisible();
    await expect(page.locator(sel.reviewPostcode)).toHaveText("SW1A 1AA");
    await expect(page.locator(sel.reviewHeavy)).toHaveText("No");
    await expect(page.locator(sel.reviewPlasterboard)).toHaveText("No");
    await expect(page.locator(sel.reviewSkip)).toHaveText("8-yard");
    // Subtotal 300 + VAT 60 = 360 (no surcharges).
    await expect(page.locator(sel.priceSubtotal)).toHaveText("£300");
    await expect(page.locator(sel.priceTotal)).toHaveText("£360");

    await page.locator(sel.confirmBtn).click();

    // Confirmation.
    await expect(page.locator(sel.stepDone)).toBeVisible();
    await expect(page.locator(sel.bookingId)).toHaveText(/^BK-\d{5}$/);
  });

  test("prevents double-submit on the confirm button", async ({ page }) => {
    // Hold the confirm response for 800ms so the "submitting" state is
    // observable, and count the number of times the request actually
    // reaches the server — the real contract we care about.
    let confirmCallCount = 0;
    await page.route("**/api/booking/confirm", async (route) => {
      confirmCallCount++;
      await new Promise((r) => setTimeout(r, 800));
      await route.continue();
    });

    await page.goto("/");
    await enterPostcode(page, "SW1A 1AA");
    await selectFirstAddress(page);
    await continueFromPostcode(page);
    await page.locator(sel.wasteContinueBtn).click();
    await page.locator(sel.skipOption("6-yard")).click();
    await page.locator(sel.skipContinueBtn).click();

    const confirmBtn = page.locator(sel.confirmBtn);
    await expect(confirmBtn).toBeEnabled();

    // Fire 5 rapid DOM clicks bypassing Playwright's "wait for enabled"
    // behavior — this simulates a user mashing the button faster than
    // React can re-render it as disabled.
    await page.evaluate(() => {
      const btn = document.querySelector(
        '[data-testid="review-confirm-btn"]',
      ) as HTMLButtonElement | null;
      if (!btn) throw new Error("confirm button missing");
      for (let i = 0; i < 5; i++) btn.click();
    });

    // While submitting, the button is marked aria-busy.
    await expect(confirmBtn).toHaveAttribute("aria-busy", "true");

    // Confirmation renders and the server was hit exactly once.
    await expect(page.locator(sel.stepDone)).toBeVisible();
    expect(confirmCallCount).toBe(1);
  });
});
