import { test, expect } from "@playwright/test";
import { MC_URL } from "../helpers/auth";
import { filterBenignPageErrors, trackPageErrors } from "../helpers/page-errors";

test.use({ storageState: "tests/.auth/admin.json" });

test.describe("Agents Page UI", () => {
  test("agents page loads without errors", async ({ page }) => {
    const errors = trackPageErrors(page);
    await page.goto(`${MC_URL}/agents`);
    await page.waitForLoadState("domcontentloaded");
    expect(filterBenignPageErrors(errors)).toHaveLength(0);
  });

  test("agents page shows agent cards or empty state", async ({ page }) => {
    await page.goto(`${MC_URL}/agents`);
    await page.waitForLoadState("domcontentloaded");
    const content = page.locator('[class*="card"], [class*="Card"]')
      .or(page.locator("text=No agents"))
      .or(page.locator("text=Agents"));
    await expect(content.first()).toBeVisible({ timeout: 5000 });
  });
});
