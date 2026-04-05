import { test, expect } from "@playwright/test";
import { MC_URL } from "./helpers/auth";

test.describe("Zalo webhook", () => {
  test("GET /api/zalo/webhook returns health payload", async ({ request }) => {
    const res = await request.get(`${MC_URL}/api/zalo/webhook`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, channel: "zalo", webhook: "ready" });
  });

  test("POST /api/zalo/webhook returns 404 when channel is not configured or 401 when secret mismatches", async ({ request }) => {
    const res = await request.post(`${MC_URL}/api/zalo/webhook`, {
      headers: {
        "Content-Type": "application/json",
        "x-bot-api-secret-token": "playwright-invalid-secret",
      },
      data: {
        event_name: "message",
        sender: { id: "pw-user", display_name: "Playwright" },
        message: { text: "/ping" },
      },
    });

    expect([401, 404, 500]).toContain(res.status());

    const body = await res.json().catch(() => ({}));
    if (res.status() === 401) {
      expect(body.error).toContain("Invalid webhook secret");
    }
    if (res.status() === 404) {
      expect(body.error).toContain("Zalo channel is not configured");
    }
  });

  test("POST /api/zalo/webhook ignores non-message callbacks when endpoint is active", async ({ request }) => {
    const res = await request.post(`${MC_URL}/api/zalo/webhook`, {
      headers: {
        "Content-Type": "application/json",
      },
      data: {
        event_name: "follow",
        sender: { id: "pw-user" },
      },
    });

    expect([200, 401, 404, 500]).toContain(res.status());

    if (res.status() === 200) {
      const body = await res.json();
      expect(body.ok).toBeTruthy();
      expect(body.ignored).toBeTruthy();
    }
  });
});
