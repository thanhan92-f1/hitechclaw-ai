import { test, expect } from "@playwright/test";
import { MC_URL } from "../helpers/auth";

test.use({ storageState: "tests/.auth/admin.json" });

test.describe("Admin Panel Page", () => {
  test("/admin page returns 200", async ({ page }) => {
    const response = await page.goto(`${MC_URL}/admin`);
    expect(response?.status()).toBe(200);
  });

  test("/admin page renders without 500 error", async ({ page }) => {
    await page.goto(`${MC_URL}/admin`);
    const title = await page.title();
    expect(title).not.toContain("500");
    await expect(page.locator("body")).not.toBeEmpty();
  });
});
