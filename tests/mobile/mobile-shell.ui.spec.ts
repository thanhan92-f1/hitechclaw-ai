import { test, expect } from "@playwright/test";
import { MC_URL } from "../helpers/auth";

test.use({ storageState: "tests/.auth/admin.json" });

test.describe("Mobile — Hamburger Menu", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("hamburger button is visible on mobile", async ({ page }) => {
    await page.goto(`${MC_URL}/`);
    const hamburger = page.locator('[aria-label="Open sidebar"]');
    await expect(hamburger).toBeVisible();
  });

  test("desktop sidebar is hidden on mobile", async ({ page }) => {
    await page.goto(`${MC_URL}/`);
    const desktopSidebar = page.locator("aside").first();
    await expect(desktopSidebar).toBeHidden();
  });

  test("hamburger opens mobile sidebar", async ({ page }) => {
    await page.goto(`${MC_URL}/`);
    const hamburger = page.locator('[aria-label="Open sidebar"]');
    await hamburger.click();
    const overlay = page.locator('[aria-label="Close sidebar"]').or(
      page.locator(".fixed.inset-0")
    ).first();
    await expect(overlay).toBeVisible({ timeout: 3000 });
  });

  test("Escape key closes mobile sidebar", async ({ page }) => {
    await page.goto(`${MC_URL}/`);
    await page.locator('[aria-label="Open sidebar"]').click();
    await page.waitForTimeout(300);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    await expect(page.locator('[aria-label="Open sidebar"]')).toBeVisible();
  });

  test("nav links visible inside mobile sidebar", async ({ page }) => {
    await page.goto(`${MC_URL}/`);
    await page.locator('[aria-label="Open sidebar"]').click();
    await page.waitForTimeout(400);
    const navLinks = page.locator("nav a, [role='navigation'] a");
    await expect(navLinks.first()).toBeVisible({ timeout: 3000 });
  });
});
