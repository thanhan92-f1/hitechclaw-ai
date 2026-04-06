import { test, expect } from "@playwright/test";
import { MC_URL } from "../helpers/auth";

test.use({ storageState: "tests/.auth/admin.json" });

test.describe("Settings Pages", () => {
  test("sessions settings page loads", async ({ page }) => {
    const res = await page.goto(`${MC_URL}/settings/sessions`);
    expect(res?.status()).toBe(200);
    await page.waitForLoadState("domcontentloaded");
  });
});
