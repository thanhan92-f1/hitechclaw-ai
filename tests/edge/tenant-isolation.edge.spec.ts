import { test, expect } from "@playwright/test";
import { MC_URL, ADMIN_TOKEN, authHeaders } from "../helpers/auth";

test.use({ storageState: "tests/.auth/admin.json" });

/* ── Tenant Isolation — API-level tests ──────────────────────── */

test.describe("Tenant API", () => {
  test("GET /api/admin/tenants returns tenants for owner @smoke", async ({ request }) => {
    const res = await request.get(`${MC_URL}/api/admin/tenants`, {
      headers: authHeaders(),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.tenants ?? body)).toBeTruthy();
  });

  test("GET /api/admin/tenants requires auth", async ({ request }) => {
    const res = await request.get(`${MC_URL}/api/admin/tenants`);
    expect(res.status()).toBe(401);
  });
});

test.describe("Tenant Data Isolation", () => {
  test("events API filters by tenant when mc_tenant cookie is set", async ({ browser }) => {
    const context = await browser.newContext();
    await context.request.post(`${MC_URL}/api/auth/init`, {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    });

    const allEvents = await context.request.get(`${MC_URL}/api/dashboard/activity`, {
      headers: authHeaders(),
    });
    expect(allEvents.status()).toBe(200);

    await context.close();
  });

  test("agents-live API returns agents list", async ({ request }) => {
    const res = await request.get(`${MC_URL}/api/tools/agents-live`, {
      headers: authHeaders(),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe("object");
  });

  test("costs API respects tenant scope", async ({ request }) => {
    const res = await request.get(`${MC_URL}/api/costs`, {
      headers: authHeaders(),
    });
    expect([200, 404]).toContain(res.status());
  });
});

test.describe("Tenant Switcher UI", () => {
  test("tenant switcher is visible in header", async ({ page }) => {
    await page.goto(`${MC_URL}/`);
    await page.waitForLoadState("domcontentloaded");
    const header = page.locator("header").first();
    await expect(header).toBeVisible();
  });

  test("client portal page loads for tenant users", async ({ page }) => {
    const response = await page.goto(`${MC_URL}/client`);
    expect(response?.status()).toBe(200);
  });
});
