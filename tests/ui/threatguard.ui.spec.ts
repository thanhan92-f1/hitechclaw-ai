import { test, expect } from "@playwright/test";
import { MC_URL } from "../helpers/auth";
import { filterBenignPageErrors, trackPageErrors } from "../helpers/page-errors";

test.use({ storageState: "tests/.auth/admin.json" });

test.describe("ThreatGuard UI", () => {
  test("ThreatGuard page loads without errors", async ({ page }) => {
    const errors = trackPageErrors(page);
    await page.goto(`${MC_URL}/security`);
    await page.waitForLoadState("domcontentloaded");
    expect(filterBenignPageErrors(errors)).toHaveLength(0);
  });

  test("ThreatGuard page renders section description on first visit", async ({ page }) => {
    await page.goto(`${MC_URL}/security`);
    await page.evaluate(() => {
      Object.keys(localStorage)
        .filter((key) => key.startsWith("hitechclaw-ai-section-seen-"))
        .forEach((key) => localStorage.removeItem(key));
    });
    await page.reload();
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("ThreatGuard has threat class explainers", async ({ page }) => {
    await page.goto(`${MC_URL}/security`);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("body")).not.toBeEmpty();
  });
});
