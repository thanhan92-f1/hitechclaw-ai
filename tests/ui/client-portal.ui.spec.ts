import { test, expect } from "@playwright/test";
import { MC_URL } from "../helpers/auth";
import { filterBenignPageErrors, trackPageErrors } from "../helpers/page-errors";

test.use({ storageState: "tests/.auth/admin.json" });

test.describe("Client Portal Pages", () => {
  test("client dashboard loads @smoke", async ({ page }) => {
    const errors = trackPageErrors(page);
    const res = await page.goto(`${MC_URL}/client`);
    expect(res?.status()).toBe(200);
    await page.waitForLoadState("domcontentloaded");
    expect(filterBenignPageErrors(errors)).toHaveLength(0);
  });

  test("client agents page loads", async ({ page }) => {
    const res = await page.goto(`${MC_URL}/client/agents`);
    expect(res?.status()).toBe(200);
  });

  test("client costs page loads", async ({ page }) => {
    const res = await page.goto(`${MC_URL}/client/costs`);
    expect(res?.status()).toBe(200);
  });

  test("client API keys page loads", async ({ page }) => {
    const res = await page.goto(`${MC_URL}/client/api-keys`);
    expect(res?.status()).toBe(200);
  });

  test("client portal shows HiTechClaw AI branding", async ({ page }) => {
    await page.goto(`${MC_URL}/client`);
    await page.waitForLoadState("domcontentloaded");
    const powered = page.locator("text=Powered by HiTechClaw AI")
      .or(page.locator("text=HiTechClaw AI"));
    await expect(powered.first()).toBeAttached({ timeout: 5000 });
  });
});

test.describe("Client Portal Navigation", () => {
  test("client portal has navigation tabs", async ({ page }) => {
    await page.goto(`${MC_URL}/client`);
    await page.waitForLoadState("domcontentloaded");
    const tabs = page.locator("text=Dashboard")
      .or(page.locator("text=Agents"))
      .or(page.locator("text=Costs"))
      .or(page.locator("text=API Keys"));
    await expect(tabs.first()).toBeAttached({ timeout: 5000 });
  });
});
