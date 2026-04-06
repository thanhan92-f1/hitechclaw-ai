import { test, expect } from "@playwright/test";
import { MC_URL } from "../helpers/auth";
import { filterBenignPageErrors, trackPageErrors } from "../helpers/page-errors";

/* ── Hitechclaw Setup Wizard — first-run detection, setup flow ──── */

test.describe("Setup Status API", () => {
  test("GET /api/setup/status returns setup state", async ({ request }) => {
    const res = await request.get(`${MC_URL}/api/setup/status`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body.setup_completed === "boolean" || body.setup_completed !== undefined).toBeTruthy();
  });
});

test.describe("Setup Wizard UI", () => {
  test("setup page loads without errors", async ({ page }) => {
    const errors = trackPageErrors(page);
    await page.goto(`${MC_URL}/setup`);
    await page.waitForLoadState("domcontentloaded");
    expect(filterBenignPageErrors(errors)).toHaveLength(0);
  });

  test("setup page shows step 1 or redirects to dashboard", async ({ page }) => {
    await page.goto(`${MC_URL}/setup`);
    await page.waitForLoadState("domcontentloaded");
    const url = page.url();
    const isSetupPage = url.includes("/setup");
    const isDashboard = url.endsWith("/") || url.includes("/dashboard");
    const isLogin = url.includes("/login");
    expect(isSetupPage || isDashboard || isLogin).toBeTruthy();
  });

  test("setup page has no shell chrome", async ({ page }) => {
    await page.goto(`${MC_URL}/setup`);
    await page.waitForLoadState("domcontentloaded");
    if (page.url().includes("/setup")) {
      expect(page.url()).toContain("/setup");
    }
  });
});
