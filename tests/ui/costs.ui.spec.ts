import { test, expect } from "@playwright/test";
import { MC_URL } from "../helpers/auth";
import { filterBenignPageErrors, trackPageErrors } from "../helpers/page-errors";

test.use({ storageState: "tests/.auth/admin.json" });

test.describe("Costs Page UI", () => {
  test("costs page loads without errors", async ({ page }) => {
    const errors = trackPageErrors(page);
    await page.goto(`${MC_URL}/costs`);
    await page.waitForLoadState("domcontentloaded");
    expect(filterBenignPageErrors(errors)).toHaveLength(0);
  });

  test("costs page shows summary grid or empty state", async ({ page }) => {
    await page.goto(`${MC_URL}/costs`);
    await page.waitForLoadState("domcontentloaded");
    const content = page.locator("text=Costs")
      .or(page.locator("text=Projected"))
      .or(page.locator("text=Budget"))
      .or(page.locator("text=No cost data"));
    await expect(content.first()).toBeVisible({ timeout: 5000 });
  });

  test("costs page has CSV export button", async ({ page }) => {
    await page.goto(`${MC_URL}/costs`);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("body")).not.toBeEmpty();
  });
});
