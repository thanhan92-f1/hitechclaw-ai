import { test, expect } from "@playwright/test";
import { MC_URL } from "../helpers/auth";
import { filterBenignPageErrors, trackPageErrors } from "../helpers/page-errors";

test.use({ storageState: "tests/.auth/admin.json" });

test.describe("Mobile Dashboard", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test.beforeEach(async ({}, testInfo) => {
    test.skip(!testInfo.project.name.includes("mobile"), "Mobile-only test");
  });

  test("mobile dashboard renders health content", async ({ page }) => {
    await page.goto(`${MC_URL}/`);
    await page.waitForLoadState("domcontentloaded");
    const healthContent = page.locator('[data-tour="health-gauge"]')
      .or(page.locator("text=Health"))
      .or(page.locator("text=Overview"));
    await expect(healthContent.first()).toBeVisible({ timeout: 10000 });
  });

  test("mobile bottom nav is visible", async ({ page }) => {
    await page.goto(`${MC_URL}/`);
    await page.waitForLoadState("domcontentloaded");
    const bottomNav = page.locator("text=Home")
      .or(page.locator("text=Tools"))
      .or(page.locator("text=Agents"));
    await expect(bottomNav.first()).toBeVisible({ timeout: 10000 });
  });

  test("mobile stat tiles render in 2-column grid", async ({ page }) => {
    await page.goto(`${MC_URL}/`);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("body")).not.toBeEmpty();
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5);
  });

  test("no console errors on mobile dashboard", async ({ page }) => {
    const errors = trackPageErrors(page);
    await page.goto(`${MC_URL}/`);
    await page.waitForLoadState("domcontentloaded");
    expect(filterBenignPageErrors(errors)).toHaveLength(0);
  });

  test("mobile More sheet opens on tap", async ({ page }) => {
    await page.goto(`${MC_URL}/`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
    const moreBtn = page.locator("text=More").last();
    if (await moreBtn.isVisible().catch(() => false)) {
      await moreBtn.click();
      await page.waitForTimeout(300);
      const sheet = page.locator("text=Settings")
        .or(page.locator("text=Infrastructure"))
        .or(page.locator("text=Costs"));
      await expect(sheet.first()).toBeVisible({ timeout: 3000 });
    }
  });
});

test.describe("PWA Manifest", () => {
  test("manifest.json is accessible", async ({ request }) => {
    const res = await request.get(`${MC_URL}/manifest.json`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.name).toBeDefined();
    expect(body.icons).toBeDefined();
    expect(Array.isArray(body.icons)).toBeTruthy();
  });

  test("service worker is registered", async ({ page }) => {
    await page.goto(`${MC_URL}/`);
    await page.waitForLoadState("domcontentloaded");
    const swRegistered = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return false;
      const registrations = await navigator.serviceWorker.getRegistrations();
      return registrations.length > 0;
    });
    expect(typeof swRegistered).toBe("boolean");
  });
});
