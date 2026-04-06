import { test, expect } from "@playwright/test";
import { MC_URL, authHeaders } from "../helpers/auth";

/* ── Hitechclaw Cost Tracking — API regression ────────────── */

test.describe("Cost APIs", () => {
  test("GET /api/costs/overview returns cost data", async ({ request }) => {
    const res = await request.get(`${MC_URL}/api/costs/overview`, {
      headers: authHeaders(),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe("object");
  });

  test("GET /api/costs/by-agent returns per-agent costs", async ({ request }) => {
    const res = await request.get(`${MC_URL}/api/costs/by-agent`, {
      headers: authHeaders(),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe("object");
  });

  test("GET /api/costs/by-model returns per-model costs", async ({ request }) => {
    const res = await request.get(`${MC_URL}/api/costs/by-model`, {
      headers: authHeaders(),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe("object");
  });

  test("GET /api/admin/budgets returns budget config", async ({ request }) => {
    const res = await request.get(`${MC_URL}/api/admin/budgets`, {
      headers: authHeaders(),
    });
    expect(res.status()).toBe(200);
  });

  test("costs endpoints require auth", async ({ request }) => {
    const res = await request.get(`${MC_URL}/api/costs/overview`);
    expect(res.status()).toBe(401);
  });
});
