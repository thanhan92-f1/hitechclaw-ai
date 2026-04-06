import { test, expect } from "@playwright/test";
import { MC_URL } from "../helpers/auth";
import { filterBenignPageErrors, trackPageErrors } from "../helpers/page-errors";
import { EXTENDED_PAGES } from "../helpers/routes";

test.use({ storageState: "tests/.auth/admin.json" });

test.describe("All Pages — HTTP 200 + no crash @smoke", () => {
  for (const { path, label } of EXTENDED_PAGES) {
    test(`${label} (${path}) returns 200`, async ({ page }) => {
      const response = await page.goto(`${MC_URL}${path}`);
      expect(response?.status()).toBe(200);
    });
  }
});

test.describe("All Pages — no JS errors", () => {
  for (const { path, label } of EXTENDED_PAGES) {
    test(`${label} (${path}) renders without JS errors`, async ({ page }) => {
      const errors = trackPageErrors(page);
      await page.goto(`${MC_URL}${path}`);
      await page.waitForLoadState("domcontentloaded");
      expect(filterBenignPageErrors(errors)).toHaveLength(0);
    });
  }
});
