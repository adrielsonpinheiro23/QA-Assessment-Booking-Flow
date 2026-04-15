// Shared Playwright fixtures for the booking-flow tests.
//
// Currently provides:
//   - `consoleErrorWatcher`: an auto-applied fixture that listens for browser
//     `console.error` messages and uncaught `pageerror` exceptions during a
//     test, and fails the test at teardown if any fired. This catches things
//     that the assertion wall would never see — React key-prop warnings,
//     hydration mismatches, missing alt text, network failures triggered by
//     image/script loads, etc.
//
// Tests that legitimately produce console errors can opt out per-test:
//
//   import { test } from "./fixtures";
//   test.use({ allowConsoleErrors: true });
//
// Or provide an allowlist of regex patterns to ignore. The value must be an
// object with a `patterns` array — wrapping the array avoids a Playwright
// option-fixture gotcha where a bare array is re-parsed as a [value, options]
// tuple and the patterns silently split apart:
//
//   test.use({
//     allowedConsolePatterns: { patterns: [/Failed to load resource: 500/] },
//   });

import { test as base, expect } from "@playwright/test";

type ConsolePatternConfig = { patterns: RegExp[] };

type ConsoleFixtures = {
  // Set to true to disable the watcher entirely for one test.
  allowConsoleErrors: boolean;
  // Patterns whose match against a console.error/pageerror message is ignored.
  allowedConsolePatterns: ConsolePatternConfig;
  // Auto-fixture: starts the listener and asserts at teardown.
  consoleErrorWatcher: void;
};

export const test = base.extend<ConsoleFixtures>({
  allowConsoleErrors: [false, { option: true }],
  allowedConsolePatterns: [{ patterns: [] }, { option: true }],

  consoleErrorWatcher: [
    async (
      { page, allowConsoleErrors, allowedConsolePatterns },
      use,
      testInfo,
    ) => {
      if (allowConsoleErrors) {
        await use();
        return;
      }

      const patterns = allowedConsolePatterns?.patterns ?? [];
      const errors: string[] = [];
      const isAllowed = (msg: string) => patterns.some((re) => re.test(msg));

      const consoleListener = (msg: import("@playwright/test").ConsoleMessage) => {
        if (msg.type() !== "error") return;
        const text = msg.text();
        if (isAllowed(text)) return;
        errors.push(`[console.error] ${text}`);
      };
      const pageErrorListener = (err: Error) => {
        const msg = err.message ?? String(err);
        if (isAllowed(msg)) return;
        errors.push(`[pageerror] ${msg}`);
      };

      page.on("console", consoleListener);
      page.on("pageerror", pageErrorListener);

      await use();

      page.off("console", consoleListener);
      page.off("pageerror", pageErrorListener);

      if (errors.length > 0) {
        // Attach to the test report so it's visible in HTML output.
        await testInfo.attach("browser-errors.txt", {
          body: errors.join("\n"),
          contentType: "text/plain",
        });
      }
      expect(
        errors,
        `Browser console produced unexpected errors:\n${errors.join("\n")}`,
      ).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
