import test from "node:test";
import assert from "node:assert/strict";

import { HiTechClawAI } from "../dist/index.js";

test("HiTechClawAI sends event payloads to /api/ingest", async () => {
  const calls = [];
  const client = new HiTechClawAI({
    baseUrl: "https://ai.example.com/",
    token: "agent-secret",
    fetch: async (url, init) => {
      calls.push({ url, init });
      return {
        ok: true,
        status: 201,
        json: async () => ({
          ok: true,
          event_id: 42,
          created_at: "2026-04-07T00:00:00.000Z",
        }),
      };
    },
  });

  const response = await client.track("message_sent", {
    agent_id: "agent-1",
    content: "Hello from test",
    metadata: { model: "claude-sonnet-4-6" },
  });

  assert.equal(response.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://ai.example.com/api/ingest");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers.Authorization, "Bearer agent-secret");

  const body = JSON.parse(calls[0].init.body);
  assert.deepEqual(body, {
    event_type: "message_sent",
    agent_id: "agent-1",
    content: "Hello from test",
    metadata: { model: "claude-sonnet-4-6" },
  });
});

test("HiTechClawAI surfaces API errors", async () => {
  const client = new HiTechClawAI({
    baseUrl: "https://ai.example.com",
    token: "agent-secret",
    fetch: async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: "Unauthorized" }),
    }),
  });

  await assert.rejects(
    client.track("message_sent", { content: "Hello" }),
    /Unauthorized/
  );
});