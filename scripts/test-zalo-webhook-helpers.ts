import assert from "node:assert/strict";
import {
  asRecord,
  buildZaloReply,
  getInboundChatId,
  getInboundSender,
  getInboundText,
  shouldProcessMessage,
} from "../src/lib/zalo-webhook";

function run() {
  const nestedPayload = {
    event_name: "message",
    message: {
      text: "/ping",
      chat: { id: "conv-123" },
    },
    sender: {
      id: "user-456",
      display_name: "Alice",
    },
  };

  assert.deepEqual(asRecord(nestedPayload), nestedPayload);
  assert.deepEqual(asRecord(null), {});
  assert.equal(getInboundText(nestedPayload), "/ping");
  assert.equal(getInboundChatId(nestedPayload), "conv-123");
  assert.equal(getInboundSender(nestedPayload), "Alice");
  assert.equal(shouldProcessMessage(nestedPayload), true);

  const flatPayload = {
    type: "text",
    text: "hello from zalo",
    conversation_id: 987654,
    from: { id: "user-flat", name: "Bob" },
  };

  assert.equal(getInboundText(flatPayload), "hello from zalo");
  assert.equal(getInboundChatId(flatPayload), "987654");
  assert.equal(getInboundSender(flatPayload), "Bob");
  assert.equal(shouldProcessMessage(flatPayload), true);

  const ignoredPayload = {
    event_name: "follow",
    sender: { id: "user-ignore" },
  };

  assert.equal(shouldProcessMessage(ignoredPayload), false);
  assert.equal(buildZaloReply("/ping", {}), "pong");
  assert.equal(buildZaloReply("/help", { reply_prefix: "[HiTechClaw AI]" }), "[HiTechClaw AI] Available commands: /ping, /help, /status");
  assert.equal(buildZaloReply("/status", { reply_prefix: "[Ops]" }), "[Ops] HiTechClaw AI webhook is online and ready to receive alerts.");
  assert.equal(buildZaloReply("/unknown", { reply_prefix: "[Ops]" }), "");

  const dataPayload = {
    data: {
      event_name: "message_received",
      message: { text: "payload from data wrapper" },
      conversation_id: "data-conv",
    },
    user_id: "wrapped-user",
  };

  assert.equal(getInboundText(dataPayload), "payload from data wrapper");
  assert.equal(getInboundChatId(dataPayload), "data-conv");
  assert.equal(getInboundSender(dataPayload), "wrapped-user");
  assert.equal(shouldProcessMessage(dataPayload), true);

  console.log("Zalo webhook helper tests passed");
}

run();
