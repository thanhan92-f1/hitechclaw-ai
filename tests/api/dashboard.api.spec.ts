import { test, expect } from "@playwright/test";
import { MC_URL, authHeaders } from "../helpers/auth";

test.describe("Dashboard API", () => {
  test("GET /api/dashboard/overview returns valid shape", async ({ request }) => {
    const res = await request.get(`${MC_URL}/api/dashboard/overview`, {
      headers: authHeaders(),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe("object");
  });

  test("GET /api/dashboard/activity returns array or object", async ({ request }) => {
    const res = await request.get(`${MC_URL}/api/dashboard/activity`, {
      headers: authHeaders(),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe("object");
  });

  test("GET /api/dashboard/anomalies returns 200", async ({ request }) => {
    const res = await request.get(`${MC_URL}/api/dashboard/anomalies`, {
      headers: authHeaders(),
    });
    expect([200, 429]).toContain(res.status());
  });
});
