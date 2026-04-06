import { test, expect } from "@playwright/test";
import { MC_URL, ADMIN_TOKEN, authenticate, csrfHeaders } from "../helpers/auth";

test.describe("Auth Init API", () => {
  test("POST /api/auth/init with valid token returns 200", async ({ request }) => {
    const res = await request.post(`${MC_URL}/api/auth/init`, {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.role).toBeDefined();
  });

  test("POST /api/auth/init with bad token returns 401", async ({ request }) => {
    const res = await request.post(`${MC_URL}/api/auth/init`, {
      headers: { Authorization: "Bearer bad-token-xyz" },
    });
    expect(res.status()).toBe(401);
  });

  test("POST /api/auth/init with no token returns 401", async ({ request }) => {
    const res = await request.post(`${MC_URL}/api/auth/init`);
    expect(res.status()).toBe(401);
  });

  test("auth sets mc_auth cookie", async ({ request }) => {
    const res = await request.post(`${MC_URL}/api/auth/init`, {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    const cookieHeader = res.headers()["set-cookie"] ?? "";
    expect(cookieHeader).toContain("mc_auth");
  });

  test("auth sets mc_csrf cookie", async ({ request }) => {
    const res = await request.post(`${MC_URL}/api/auth/init`, {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    const cookieHeader = res.headers()["set-cookie"] ?? "";
    expect(cookieHeader).toContain("mc_csrf");
  });
});

test.describe("Cookie Auth + CSRF", () => {
  test("authenticate helper returns CSRF token", async ({ browser }) => {
    const context = await browser.newContext();
    const csrfToken = await authenticate(context);
    expect(csrfToken).toBeTruthy();
    expect(csrfToken.length).toBeGreaterThan(0);
    await context.close();
  });

  test("cookie-based GET works without CSRF header", async ({ browser }) => {
    const context = await browser.newContext();
    await authenticate(context);
    const res = await context.request.get(`${MC_URL}/api/dashboard/overview`);
    expect([200, 429]).toContain(res.status());
    await context.close();
  });

  test("cookie-based mutation with CSRF token succeeds", async ({ browser }) => {
    const context = await browser.newContext();
    const csrfToken = await authenticate(context);
    const res = await context.request.patch(`${MC_URL}/api/notifications`, {
      headers: csrfHeaders(csrfToken),
      data: { ids: [], action: "read" },
    });
    expect(res.status()).not.toBe(403);
    await context.close();
  });

  test("cookie-based mutation without CSRF token returns 403", async ({ browser }) => {
    const context = await browser.newContext();
    await authenticate(context);
    const res = await context.request.patch(`${MC_URL}/api/notifications`, {
      data: { ids: [], action: "read" },
    });
    expect(res.status()).toBe(403);
    await context.close();
  });
});

test.describe("Login + Protected Routes", () => {
  test("POST /api/auth/login with missing fields returns 400", async ({ request }) => {
    const res = await request.post(`${MC_URL}/api/auth/login`, {
      headers: { "Content-Type": "application/json" },
      data: {},
    });
    expect([400, 401, 422]).toContain(res.status());
  });

  test("POST /api/auth/login with bad credentials returns 401", async ({ request }) => {
    const res = await request.post(`${MC_URL}/api/auth/login`, {
      headers: { "Content-Type": "application/json" },
      data: { email: "bad@test.com", password: "wrongpassword" },
    });
    expect(res.status()).toBe(401);
  });

  test("GET /api/auth/sessions requires auth", async ({ request }) => {
    const res = await request.get(`${MC_URL}/api/auth/sessions`);
    expect(res.status()).toBe(401);
  });

  test("protected route without auth returns 401", async ({ request }) => {
    const res = await request.get(`${MC_URL}/api/dashboard/overview`);
    expect([401, 429]).toContain(res.status());
  });

  test("protected route with valid token returns 200", async ({ request }) => {
    const res = await request.get(`${MC_URL}/api/dashboard/overview`, {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect([200, 429]).toContain(res.status());
  });
});

test.describe("Magic Link API", () => {
  test("POST /api/auth/magic-link requires email", async ({ request }) => {
    const res = await request.post(`${MC_URL}/api/auth/magic-link`, {
      headers: { "Content-Type": "application/json" },
      data: {},
    });
    expect([400, 422]).toContain(res.status());
  });

  test("POST /api/auth/magic-link returns success for any email", async ({ request }) => {
    const res = await request.post(`${MC_URL}/api/auth/magic-link`, {
      headers: { "Content-Type": "application/json" },
      data: { email: "nonexistent-playwright@test.com" },
    });
    expect(res.status()).toBe(200);
  });

  test("POST /api/auth/verify-magic-link with invalid token returns error", async ({ request }) => {
    const res = await request.post(`${MC_URL}/api/auth/verify-magic-link`, {
      headers: { "Content-Type": "application/json" },
      data: { token: "invalid-token-xyz" },
    });
    expect([400, 401, 404, 405]).toContain(res.status());
  });
});
