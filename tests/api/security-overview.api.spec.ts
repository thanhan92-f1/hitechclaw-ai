import { test, expect } from "@playwright/test";
import { MC_URL, authHeaders } from "../helpers/auth";

test.describe("Security Overview API", () => {
  test("GET /api/security/overview returns valid shape", async ({ request }) => {
    const res = await request.get(`${MC_URL}/api/security/overview`, {
      headers: authHeaders(),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe("object");
  });

  test("security overview requires auth", async ({ request }) => {
    const res = await request.get(`${MC_URL}/api/security/overview`);
    expect(res.status()).toBe(401);
  });
});
