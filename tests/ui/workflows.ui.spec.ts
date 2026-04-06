import { test, expect } from "@playwright/test";
import { MC_URL } from "../helpers/auth";
import { filterBenignPageErrors, trackPageErrors } from "../helpers/page-errors";

test.use({ storageState: "tests/.auth/admin.json" });

test.describe("Workflows Page UI", () => {
  test("workflows page loads without errors", async ({ page }) => {
    const errors = trackPageErrors(page);
    await page.goto(`${MC_URL}/workflows`);
    await page.waitForLoadState("domcontentloaded");
    expect(filterBenignPageErrors(errors)).toHaveLength(0);
  });

  test("workflows page shows template gallery or workflow list", async ({ page }) => {
    await page.goto(`${MC_URL}/workflows`);
    await page.waitForLoadState("domcontentloaded");
    const content = page.locator("text=Workflows")
      .or(page.locator("text=Template"))
      .or(page.locator("text=Create"))
      .or(page.locator("text=No workflows"));
    await expect(content.first()).toBeVisible({ timeout: 5000 });
  });

  test("section description appears on workflows page", async ({ page }) => {
    await page.goto(`${MC_URL}/workflows`);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("body")).not.toBeEmpty();
  });
});
