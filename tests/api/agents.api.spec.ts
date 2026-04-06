import { test, expect } from "@playwright/test";
import { MC_URL, authHeaders } from "../helpers/auth";

/* ── Hitechclaw Agents — API regression ────────────── */

test.describe("Agent APIs", () => {
  test("GET /api/admin/agents returns agents array", async ({ request }) => {
    const res = await request.get(`${MC_URL}/api/admin/agents`, {
      headers: authHeaders(),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.agents ?? body)).toBeTruthy();
  });

  test("GET /api/dashboard/overview returns agent data", async ({ request }) => {
    const res = await request.get(`${MC_URL}/api/dashboard/overview`, {
      headers: authHeaders(),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe("object");
    expect(body.agents !== undefined || body.agent_count !== undefined || body.total_agents !== undefined).toBeTruthy();
  });
});
