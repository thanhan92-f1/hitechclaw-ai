import assert from "node:assert/strict";

import { HiTechClawAI } from "../dist/index.js";

const requests = [];

const client = new HiTechClawAI({
  baseUrl: "https://smoke.example.com",
  token: "smoke-token",
  fetch: async (url, init) => {
    requests.push({ url, init });
    return {
      ok: true,
      status: 201,
      json: async () => ({
        ok: true,
        event_id: 7,
        created_at: new Date("2026-04-07T00:00:00.000Z").toISOString(),
      }),
    };
  },
});

const result = await client.send({
  event_type: "tool_call",
  agent_id: "smoke-agent",
  content: "SDK smoke event",
  metadata: { tool_name: "health-check" },
});

assert.equal(result.ok, true);
assert.equal(requests.length, 1);
assert.equal(requests[0].url, "https://smoke.example.com/api/ingest");

console.log("[sdk-smoke] SDK smoke validation passed");