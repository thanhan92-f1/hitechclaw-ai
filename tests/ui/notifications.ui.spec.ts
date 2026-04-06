import { test, expect } from "@playwright/test";
import { MC_URL } from "../helpers/auth";
import { filterBenignPageErrors, trackPageErrors } from "../helpers/page-errors";

test.use({ storageState: "tests/.auth/admin.json" });

test.describe("Notification Bell UI", () => {
  test("notification bell icon is visible in header", async ({ page }) => {
    await page.goto(`${MC_URL}/`);
    await page.waitForLoadState("domcontentloaded");
    const header = page.locator("header").first();
    await expect(header).toBeVisible();
    const bell = header.locator('button[aria-label*="notification" i]')
      .or(header.locator('button[aria-label*="bell" i]'));
    await expect(bell.first()).toBeVisible({ timeout: 5000 });
  });

  test("notification settings page loads", async ({ page }) => {
    const errors = trackPageErrors(page);
    await page.goto(`${MC_URL}/settings/notifications`);
    await page.waitForLoadState("domcontentloaded");
    expect(filterBenignPageErrors(errors)).toHaveLength(0);
    const content = page.locator("text=Notification")
      .or(page.locator("text=Channel"))
      .or(page.locator("text=Telegram"));
    await expect(content.first()).toBeVisible({ timeout: 5000 });
  });
});
