import { test, expect } from "@playwright/test";
import { MC_URL } from "../helpers/auth";
import { filterBenignPageErrors, trackPageErrors } from "../helpers/page-errors";

test.use({ storageState: "tests/.auth/admin.json" });

test.describe("Infrastructure Page UI", () => {
  test("infrastructure page loads without errors", async ({ page }) => {
    const errors = trackPageErrors(page);
    await page.goto(`${MC_URL}/infrastructure`);
    await page.waitForLoadState("domcontentloaded");
    expect(filterBenignPageErrors(errors)).toHaveLength(0);
  });

  test("infrastructure page shows topology or node list", async ({ page }) => {
    await page.goto(`${MC_URL}/infrastructure`);
    await page.waitForLoadState("domcontentloaded");
    const content = page.locator("text=Infrastructure")
      .or(page.locator("text=Nodes"))
      .or(page.locator("text=No nodes"));
    await expect(content.first()).toBeVisible({ timeout: 5000 });
  });
});
