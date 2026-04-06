import { test, expect } from "@playwright/test";
import { MC_URL } from "../helpers/auth";
import { filterBenignPageErrors, trackPageErrors } from "../helpers/page-errors";

test.use({ storageState: "tests/.auth/admin.json" });

test.describe("Help Panel", () => {
  test("help button is visible in header", async ({ page }) => {
    await page.goto(`${MC_URL}/`);
    await page.waitForLoadState("domcontentloaded");
    const helpBtn = page.locator('[aria-label="Help"]');
    await expect(helpBtn).toBeVisible({ timeout: 5000 });
  });

  test("clicking help button opens slide-out panel", async ({ page }) => {
    await page.goto(`${MC_URL}/`);
    await page.waitForLoadState("domcontentloaded");
    const helpBtn = page.locator('[aria-label="Help"]');
    await helpBtn.click();
    const panel = page.locator("text=Key Concepts")
      .or(page.locator("text=Common Tasks"));
    await expect(panel.first()).toBeVisible({ timeout: 3000 });
  });

  test("question-mark shortcut opens help panel", async ({ page }) => {
    await page.goto(`${MC_URL}/`);
    await page.waitForLoadState("domcontentloaded");
    await page.keyboard.press("?");
    const panelContent = page.locator("text=Key Concepts")
      .or(page.locator("text=Common Tasks"));
    await expect(panelContent.first()).toBeVisible({ timeout: 3000 });
  });

  test("help panel can be closed via close button", async ({ page }) => {
    await page.goto(`${MC_URL}/`);
    await page.waitForLoadState("domcontentloaded");
    await page.locator('[aria-label="Help"]').click();
    const backdrop = page.locator(".fixed.inset-0.bg-black\\/40");
    await expect(backdrop).toBeVisible({ timeout: 3000 });
    await page.locator('[aria-label="Close help"]').click();
    await expect(backdrop).toBeHidden({ timeout: 3000 });
  });

  test("help panel shows contextual content per page", async ({ page }) => {
    await page.goto(`${MC_URL}/`);
    await page.waitForLoadState("domcontentloaded");
    await page.keyboard.press("?");
    await expect(page.locator("text=Dashboard").first()).toBeVisible({ timeout: 3000 });
    await page.keyboard.press("Escape");

    await page.goto(`${MC_URL}/security`);
    await page.waitForLoadState("domcontentloaded");
    await page.keyboard.press("?");
    const secHelp = page.locator("text=ThreatGuard").or(page.locator("text=threat"));
    await expect(secHelp.first()).toBeVisible({ timeout: 3000 });
  });
});

test.describe("Glossary Page", () => {
  test("glossary page loads without errors", async ({ page }) => {
    const errors = trackPageErrors(page);
    await page.goto(`${MC_URL}/help/glossary`);
    await page.waitForLoadState("domcontentloaded");
    expect(filterBenignPageErrors(errors)).toHaveLength(0);
  });

  test("glossary shows searchable terms", async ({ page }) => {
    await page.goto(`${MC_URL}/help/glossary`);
    await page.waitForLoadState("domcontentloaded");
    const terms = page.locator("text=Agent")
      .or(page.locator("text=Kill Switch"))
      .or(page.locator("text=Workflow"));
    await expect(terms.first()).toBeVisible({ timeout: 5000 });
  });
});
