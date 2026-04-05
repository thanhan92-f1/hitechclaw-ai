export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readPath(source: unknown, path: string[]): unknown {
  let current: unknown = source;
  for (const segment of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function pickString(source: unknown, paths: string[][]): string {
  for (const path of paths) {
    const value = readPath(source, path);
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number") {
      return String(value);
    }
  }
  return "";
}

export function getInboundText(payload: Record<string, unknown>): string {
  return pickString(payload, [
    ["message", "text"],
    ["message", "content"],
    ["text"],
    ["content"],
    ["message", "body"],
    ["data", "message", "text"],
    ["data", "text"],
  ]);
}

export function getInboundChatId(payload: Record<string, unknown>): string {
  return pickString(payload, [
    ["chat_id"],
    ["conversation_id"],
    ["thread_id"],
    ["message", "chat", "id"],
    ["message", "conversation_id"],
    ["data", "chat_id"],
    ["data", "conversation_id"],
    ["sender", "id"],
    ["from", "id"],
    ["user_id"],
  ]);
}

export function getInboundSender(payload: Record<string, unknown>): string {
  return pickString(payload, [
    ["sender", "display_name"],
    ["sender", "name"],
    ["from", "name"],
    ["from", "username"],
    ["sender", "id"],
    ["from", "id"],
    ["user_id"],
  ]);
}

export function shouldProcessMessage(payload: Record<string, unknown>): boolean {
  const eventName = pickString(payload, [
    ["event_name"],
    ["event"],
    ["type"],
    ["message", "type"],
    ["data", "event_name"],
  ]).toLowerCase();

  if (!eventName) return true;
  return ["message", "message_received", "user_message", "text"].includes(eventName);
}

export function buildZaloReply(command: string, config: Record<string, unknown>): string {
  const prefix = String(config.reply_prefix ?? "").trim();
  const header = prefix ? `${prefix} ` : "";

  switch (command) {
    case "/ping":
      return `${header}pong`;
    case "/help":
      return `${header}Available commands: /ping, /help, /status`;
    case "/status":
      return `${header}HiTechClaw AI webhook is online and ready to receive alerts.`;
    default:
      return "";
  }
}