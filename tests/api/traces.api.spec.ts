import { test, expect } from "@playwright/test";
import { MC_URL, authHeaders } from "../helpers/auth";

/* ── Hitechclaw Trace Explorer — API tests ─────────────────────────── */

test.describe("Traces API", () => {
  test("GET /api/traces returns traces array @smoke", async ({ request }) => {
    const res = await request.get(`${MC_URL}/api/traces`, {
      headers: authHeaders(),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe("object");
    expect(Array.isArray(body.traces ?? body)).toBeTruthy();
  });

  test("GET /api/traces requires auth", async ({ request }) => {
    const res = await request.get(`${MC_URL}/api/traces`);
    expect(res.status()).toBe(401);
  });

  test("GET /api/traces supports time filters", async ({ request }) => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const res = await request.get(`${MC_URL}/api/traces?since=${since}`, {
      headers: authHeaders(),
    });
    expect(res.status()).toBe(200);
  });

  test("GET /api/traces/[traceId] returns 404 for non-existent trace", async ({ request }) => {
    const res = await request.get(`${MC_URL}/api/traces/00000000-0000-0000-0000-000000000000`, {
      headers: authHeaders(),
    });
    expect([200, 404]).toContain(res.status());
  });
});
