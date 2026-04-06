import { test, expect } from "@playwright/test";
import { MC_URL, authHeaders } from "../helpers/auth";

/* ── Hitechclaw Kill Switch — API regression ──────────────── */

test.describe("Kill Switch API", () => {
  test("GET /api/active-runs returns array", async ({ request }) => {
    const res = await request.get(`${MC_URL}/api/active-runs`, {
      headers: authHeaders(),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.runs ?? body)).toBeTruthy();
  });

  test("GET /api/tools/agents-live returns agents", async ({ request }) => {
    const res = await request.get(`${MC_URL}/api/tools/agents-live`, {
      headers: authHeaders(),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe("object");
  });

  test("active-runs endpoint requires auth", async ({ request }) => {
    const res = await request.get(`${MC_URL}/api/active-runs`);
    expect(res.status()).toBe(401);
  });
});
