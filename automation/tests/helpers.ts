import { expect, type Page } from "@playwright/test";

// Small set of selectors + flow helpers shared across specs.
// We rely on data-testid attributes for stability — the visible copy can
// change without breaking tests.

export const sel = {
  stepPostcode: '[data-testid="step-postcode"]',
  stepWaste: '[data-testid="step-waste"]',
  stepSkip: '[data-testid="step-skip"]',
  stepReview: '[data-testid="step-review"]',
  stepDone: '[data-testid="step-confirmation"]',

  postcodeInput: '[data-testid="postcode-input"]',
  postcodeLookupBtn: '[data-testid="postcode-lookup-btn"]',
  postcodeError: '[data-testid="postcode-error"]',
  postcodeEmpty: '[data-testid="postcode-empty"]',
  postcodeRetryBtn: '[data-testid="postcode-retry-btn"]',
  postcodeContinueBtn: '[data-testid="postcode-continue-btn"]',
  addressList: '[data-testid="address-list"]',
  addressOption: (id: string) => `[data-testid="address-option"][data-address-id="${id}"]`,
  firstAddressOption: '[data-testid="address-option"]',

  heavyWasteCheckbox: '[data-testid="heavy-waste-checkbox"]',
  plasterboardCheckbox: '[data-testid="plasterboard-checkbox"]',
  plasterboardOption: (value: string) =>
    `[data-testid="plasterboard-option"][data-value="${value}"] input`,
  wasteContinueBtn: '[data-testid="waste-continue-btn"]',
  wasteBackBtn: '[data-testid="waste-back-btn"]',

  skipList: '[data-testid="skip-list"]',
  skipOption: (size: string) => `[data-testid="skip-option"][data-size="${size}"]`,
  skipContinueBtn: '[data-testid="skip-continue-btn"]',
  skipBackBtn: '[data-testid="skip-back-btn"]',

  reviewPostcode: '[data-testid="review-postcode"]',
  reviewAddress: '[data-testid="review-address"]',
  reviewHeavy: '[data-testid="review-heavy-waste"]',
  reviewPlasterboard: '[data-testid="review-plasterboard"]',
  reviewSkip: '[data-testid="review-skip-size"]',
  priceTotal: '[data-testid="price-total"]',
  priceSubtotal: '[data-testid="price-subtotal"]',
  confirmBtn: '[data-testid="review-confirm-btn"]',
  bookingId: '[data-testid="booking-id"]',
};

export async function enterPostcode(page: Page, postcode: string) {
  await page.locator(sel.postcodeInput).fill(postcode);
  await page.locator(sel.postcodeLookupBtn).click();
}

export async function selectFirstAddress(page: Page) {
  await page.locator(sel.firstAddressOption).first().click();
}

export async function continueFromPostcode(page: Page) {
  await expect(page.locator(sel.postcodeContinueBtn)).toBeEnabled();
  await page.locator(sel.postcodeContinueBtn).click();
  await expect(page.locator(sel.stepWaste)).toBeVisible();
}
