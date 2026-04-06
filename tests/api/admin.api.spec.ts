import { test, expect } from "@playwright/test";
import { MC_URL, authHeaders } from "../helpers/auth";

test.describe("Admin API", () => {
  test("GET /api/admin/agents returns 200 with auth", async ({ request }) => {
    const res = await request.get(`${MC_URL}/api/admin/agents`, { headers: authHeaders() });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe("object");
  });

  test("GET /api/admin/agents returns 401 without auth", async ({ request }) => {
    const res = await request.get(`${MC_URL}/api/admin/agents`);
    expect(res.status()).toBe(401);
  });

  test("GET /api/infra/nodes returns 200 with auth", async ({ request }) => {
    const res = await request.get(`${MC_URL}/api/infra/nodes`, { headers: authHeaders() });
    expect(res.status()).toBe(200);
  });
});
