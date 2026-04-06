import { test, expect } from "@playwright/test";
import { MC_URL, authHeaders } from "../helpers/auth";

/* ── Hitechclaw Notifications — API regression ────────────── */

test.describe("Notifications API", () => {
  test("GET /api/notifications returns notifications", async ({ request }) => {
    const res = await request.get(`${MC_URL}/api/notifications`, {
      headers: authHeaders(),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe("object");
  });

  test("GET /api/notifications/preferences returns preferences", async ({ request }) => {
    const res = await request.get(`${MC_URL}/api/notifications/preferences`, {
      headers: authHeaders(),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe("object");
  });

  test("notifications endpoint requires auth", async ({ request }) => {
    const res = await request.get(`${MC_URL}/api/notifications`);
    expect(res.status()).toBe(401);
  });
});
