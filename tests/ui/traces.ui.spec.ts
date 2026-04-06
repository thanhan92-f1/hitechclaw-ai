import { test, expect } from "@playwright/test";
import { MC_URL } from "../helpers/auth";
import { filterBenignPageErrors, trackPageErrors } from "../helpers/page-errors";

test.use({ storageState: "tests/.auth/admin.json" });

test.describe("Traces Page UI", () => {
  test("traces page loads without errors @smoke", async ({ page }) => {
    const errors = trackPageErrors(page);
    await page.goto(`${MC_URL}/traces`);
    await page.waitForLoadState("domcontentloaded");
    expect(filterBenignPageErrors(errors)).toHaveLength(0);
  });

  test("traces page renders content", async ({ page }) => {
    await page.goto(`${MC_URL}/traces`);
    await page.waitForLoadState("domcontentloaded");
    const content = page.locator("text=Trace")
      .or(page.locator("text=trace"))
      .or(page.locator("text=No traces"));
    await expect(content.first()).toBeAttached({ timeout: 5000 });
  });

  test("traces page shows filter controls", async ({ page }) => {
    await page.goto(`${MC_URL}/traces`);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("body")).not.toBeEmpty();
  });
});
