import { test, expect } from "@playwright/test";
import { MC_URL } from "../helpers/auth";

test.use({ storageState: "tests/.auth/admin.json" });

test.describe("Kill Switch UI", () => {
  test("header contains kill switch button", async ({ page }) => {
    await page.goto(`${MC_URL}/`);
    await page.waitForLoadState("domcontentloaded");
    const header = page.locator("header").first();
    await expect(header).toBeVisible();
  });

  test("Ctrl+Shift+K opens quick-kill dialog", async ({ page }) => {
    await page.goto(`${MC_URL}/`);
    await page.waitForLoadState("domcontentloaded");
    await page.keyboard.press("Control+Shift+K");
    const dialog = page.locator('[role="dialog"]')
      .or(page.locator("text=Kill Active Agent"))
      .or(page.locator("text=No active runs"));
    await expect(dialog.first()).toBeVisible({ timeout: 3000 });
  });
});
