import { test, expect } from "@playwright/test";
import { MC_URL } from "../helpers/auth";
import { CORE_PAGES } from "../helpers/routes";

test.use({ storageState: "tests/.auth/admin.json" });

test.describe("Page Navigation", () => {
  for (const { path, label } of CORE_PAGES) {
    test(`${label} page (${path}) loads with HTTP 200`, async ({ page }) => {
      const response = await page.goto(`${MC_URL}${path}`);
      expect(response?.status()).toBe(200);
    });

    test(`${label} page (${path}) renders main content`, async ({ page }) => {
      await page.goto(`${MC_URL}${path}`);
      await expect(page.locator("body")).not.toBeEmpty();
      const title = await page.title();
      expect(title).not.toContain("500");
      expect(title).not.toContain("Error");
    });
  }
});
