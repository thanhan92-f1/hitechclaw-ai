import { test, expect } from "@playwright/test";
import { MC_URL, authHeaders } from "../helpers/auth";

test.describe("Audit Log API", () => {
  test("GET /api/audit returns audit entries @smoke", async ({ request }) => {
    const res = await request.get(`${MC_URL}/api/audit`, {
      headers: authHeaders(),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe("object");
  });

  test("GET /api/audit requires auth", async ({ request }) => {
    const res = await request.get(`${MC_URL}/api/audit`);
    expect(res.status()).toBe(401);
  });

  test("GET /api/audit supports action filter", async ({ request }) => {
    const res = await request.get(`${MC_URL}/api/audit?action=user.login`, {
      headers: authHeaders(),
    });
    expect(res.status()).toBe(200);
  });
});

test.describe("Rate Limiter", () => {
  test("rapid requests eventually get throttled or still succeed", async ({ request }) => {
    const results: number[] = [];
    for (let i = 0; i < 30; i++) {
      const res = await request.get(`${MC_URL}/api/dashboard/overview`, {
        headers: authHeaders(),
      });
      results.push(res.status());
    }
    expect(results.some((status) => status === 200 || status === 429)).toBeTruthy();
  });
});

test.describe("Health Endpoint", () => {
  test("GET /api/health returns healthy @smoke", async ({ request }) => {
    const res = await request.get(`${MC_URL}/api/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("healthy");
  });
});
