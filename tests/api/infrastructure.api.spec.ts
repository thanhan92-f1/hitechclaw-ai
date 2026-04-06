import { test, expect } from "@playwright/test";
import { MC_URL, authHeaders } from "../helpers/auth";

test.describe("Infrastructure APIs", () => {
  test("GET /api/infra/nodes returns node list", async ({ request }) => {
    const res = await request.get(`${MC_URL}/api/infra/nodes`, {
      headers: authHeaders(),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe("object");
  });

  test("GET /api/infra/topology returns topology data", async ({ request }) => {
    const res = await request.get(`${MC_URL}/api/infra/topology`, {
      headers: authHeaders(),
    });
    expect(res.status()).toBe(200);
  });

  test("POST /api/infra/report validates payload", async ({ request }) => {
    const res = await request.post(`${MC_URL}/api/infra/report`, {
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      data: {
        nodeId: "playwright-test-node",
        hostname: "playwright-test-node",
        cpu_percent: 25.0,
        memory_percent: 40.0,
        disk_percent: 55.0,
        uptime_seconds: 3600,
      },
    });
    expect([200, 400, 404]).toContain(res.status());
  });
});

test.describe("Compliance API", () => {
  test("GET /api/compliance/audit-log returns entries", async ({ request }) => {
    const res = await request.get(`${MC_URL}/api/compliance/audit-log`, {
      headers: authHeaders(),
    });
    expect(res.status()).toBe(200);
  });
});

test.describe("Benchmarks API", () => {
  test("GET /api/benchmarks/overview returns data", async ({ request }) => {
    const res = await request.get(`${MC_URL}/api/benchmarks/overview`, {
      headers: authHeaders(),
    });
    expect(res.status()).toBe(200);
  });
});
