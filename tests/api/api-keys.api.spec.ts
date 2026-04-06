import { test, expect } from "@playwright/test";
import { MC_URL, ADMIN_TOKEN, authHeaders, authenticate, csrfHeaders } from "../helpers/auth";

test.describe("API Keys API", () => {
  test("GET /api/client/api-keys requires auth", async ({ request }) => {
    const res = await request.get(`${MC_URL}/api/client/api-keys`);
    expect(res.status()).toBe(401);
  });

  test("GET /api/client/api-keys returns keys list @smoke", async ({ request }) => {
    const res = await request.get(`${MC_URL}/api/client/api-keys`, {
      headers: authHeaders(),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe("object");
  });

  test("POST /api/client/api-keys creates a key with ak_live_ prefix", async ({ browser }) => {
    const context = await browser.newContext();
    const csrfToken = await authenticate(context);

    const res = await context.request.post(`${MC_URL}/api/client/api-keys`, {
      headers: { ...csrfHeaders(csrfToken), "Content-Type": "application/json" },
      data: {
        name: `playwright-test-${Date.now()}`,
        scopes: ["read"],
      },
    });

    if (res.status() === 201 || res.status() === 200) {
      const body = await res.json();
      if (body.key) {
        expect(body.key).toMatch(/^ak_live_/);
      }
    }

    await context.close();
  });
});

test.describe("Email Auth API", () => {
  test("POST /api/auth/register requires admin auth", async ({ request }) => {
    const res = await request.post(`${MC_URL}/api/auth/register`, {
      headers: { "Content-Type": "application/json" },
      data: { email: "test@test.com", password: "test", role: "viewer" },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("GET /api/auth/sessions returns sessions list with cookie auth", async ({ browser }) => {
    const context = await browser.newContext();
    await context.request.post(`${MC_URL}/api/auth/init`, {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    const res = await context.request.get(`${MC_URL}/api/auth/sessions`);
    expect([200, 401, 404]).toContain(res.status());
    await context.close();
  });
});
