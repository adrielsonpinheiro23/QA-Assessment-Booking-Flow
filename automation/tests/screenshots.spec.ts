import { expect, test } from "@playwright/test";
import {
  continueFromPostcode,
  enterPostcode,
  sel,
  selectFirstAddress,
} from "./helpers";

// Generates the UI evidence screenshots into ui/screenshots/.
// Each step/state gets both a mobile (375x812) and desktop (1280x800) shot.
//
// Run with: npm run test:screenshots

const DESKTOP = { width: 1280, height: 800 };
const MOBILE = { width: 375, height: 812 };

async function shoot(page: any, name: string) {
  await page.screenshot({
    path: `ui/screenshots/${name}.png`,
    fullPage: true,
  });
}

test.describe("UI evidence capture", () => {
  test.describe.configure({ mode: "serial" });

  for (const [viewportName, viewport] of [
    ["desktop", DESKTOP] as const,
    ["mobile", MOBILE] as const,
  ]) {
    test(`screenshots · ${viewportName}`, async ({ page }) => {
      await page.setViewportSize(viewport);

      // 1. Postcode step — empty
      await page.goto("/");
      await expect(page.locator(sel.stepPostcode)).toBeVisible();
      await shoot(page, `${viewportName}-01-postcode-empty`);

      // 2. Postcode step — loading spinner (M1 1AE has a 2.5s delay).
      await page.locator(sel.postcodeInput).fill("M1 1AE");
      await page.locator(sel.postcodeLookupBtn).click();
      await expect(page.locator('[data-testid="postcode-loading"]')).toBeVisible();
      await shoot(page, `${viewportName}-02-postcode-loading`);
      await expect(page.locator(sel.addressList)).toBeVisible({ timeout: 15_000 });

      // 3. Postcode step — empty state (EC1A 1BB).
      await page.locator(sel.postcodeInput).fill("EC1A 1BB");
      await page.locator(sel.postcodeLookupBtn).click();
      await expect(page.locator(sel.postcodeEmpty)).toBeVisible();
      await shoot(page, `${viewportName}-03-postcode-empty-state`);

      // 4. Postcode step — error + retry UI (BS1 4DJ).
      // Note: the retry fixture is stateful, so only the first request per
      // worker returns 500. Reload the page to reset the view state but the
      // server-side counter persists for the process.
      await page.locator(sel.postcodeInput).fill("BS1 4DJ");
      await page.locator(sel.postcodeLookupBtn).click();
      // This may be an error *or* a success if a prior test already
      // "used up" the first-failure. Handle both paths so screenshot runs
      // are deterministic regardless of ordering.
      const errorVisible = await page
        .locator(sel.postcodeError)
        .isVisible()
        .catch(() => false);
      if (errorVisible) {
        await shoot(page, `${viewportName}-04-postcode-error`);
        await page.locator(sel.postcodeRetryBtn).click();
      }

      // 5. Success — SW1A 1AA with 12+ addresses.
      await page.locator(sel.postcodeInput).fill("SW1A 1AA");
      await page.locator(sel.postcodeLookupBtn).click();
      await expect(page.locator(sel.addressList)).toBeVisible();
      await shoot(page, `${viewportName}-05-postcode-addresses`);
      await selectFirstAddress(page);
      await continueFromPostcode(page);

      // 6. Waste step — plasterboard options branching visible.
      await page.locator(sel.heavyWasteCheckbox).check();
      await page.locator(sel.plasterboardCheckbox).check();
      await page
        .locator(sel.plasterboardOption("bagged-on-skip"))
        .check();
      await shoot(page, `${viewportName}-06-waste-heavy-plasterboard`);
      await page.locator(sel.wasteContinueBtn).click();

      // 7. Skip step — with disabled options visible.
      await expect(page.locator(sel.stepSkip)).toBeVisible();
      await shoot(page, `${viewportName}-07-skip-with-disabled`);
      await page.locator(sel.skipOption("6-yard")).click();
      await page.locator(sel.skipContinueBtn).click();

      // 8. Review + price breakdown.
      await expect(page.locator(sel.stepReview)).toBeVisible();
      await shoot(page, `${viewportName}-08-review-breakdown`);
      await page.locator(sel.confirmBtn).click();

      // 9. Confirmation.
      await expect(page.locator(sel.stepDone)).toBeVisible();
      await shoot(page, `${viewportName}-09-confirmation`);
    });
  }
});
