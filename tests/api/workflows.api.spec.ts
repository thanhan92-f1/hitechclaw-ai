import { test, expect } from "@playwright/test";
import { MC_URL, authHeaders } from "../helpers/auth";

/* ── Hitechclaw Workflow Builder — API regression ──────────── */

test.describe("Workflow API", () => {
  test("GET /api/workflows returns workflows array", async ({ request }) => {
    const res = await request.get(`${MC_URL}/api/workflows`, {
      headers: authHeaders(),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.workflows ?? body)).toBeTruthy();
  });

  test("workflows endpoint requires auth", async ({ request }) => {
    const res = await request.get(`${MC_URL}/api/workflows`);
    expect(res.status()).toBe(401);
  });

  test("GET /api/workflows/scheduler returns scheduler state", async ({ request }) => {
    const res = await request.get(`${MC_URL}/api/workflows/scheduler`, {
      headers: authHeaders(),
    });
    expect([200, 404]).toContain(res.status());
  });
});
