import { decryptStoredSecret } from "@/lib/notification-secrets";

interface ZaloApiEnvelope<T> {
  ok?: boolean;
  result?: T;
  error?: unknown;
  message?: string;
}

export interface ZaloMessageConfig {
  botToken: string;
  chatId: string;
}

function getZaloApiUrl(botToken: string, method: string): string {
  return `https://bot-api.zaloplatforms.com/bot${botToken}/${method}`;
}

function getZaloErrorMessage(payload: ZaloApiEnvelope<unknown> | null, status: number): string {
  if (typeof payload?.message === "string" && payload.message.trim()) {
    return payload.message.trim();
  }

  if (typeof payload?.error === "string" && payload.error.trim()) {
    return payload.error.trim();
  }

  if (typeof payload?.error === "number") {
    return `Zalo API error ${payload.error}`;
  }

  return `Zalo API returned ${status}`;
}

export async function callZaloBotApi<T>(
  botToken: string,
  method: string,
  body: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(getZaloApiUrl(botToken, method), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });

  let payload: ZaloApiEnvelope<T> | null = null;
  try {
    payload = (await res.json()) as ZaloApiEnvelope<T>;
  } catch {
    payload = null;
  }

  if (!res.ok || !payload?.ok) {
    throw new Error(getZaloErrorMessage(payload, res.status));
  }

  return payload.result as T;
}

export async function getZaloBotMe(botToken: string): Promise<Record<string, unknown>> {
  return callZaloBotApi<Record<string, unknown>>(botToken, "getMe", {});
}

export async function sendZaloMessage({ botToken, chatId }: ZaloMessageConfig, text: string): Promise<void> {
  await callZaloBotApi(botToken, "sendMessage", {
    chat_id: chatId,
    text,
  });
}

export function getZaloBotToken(config: Record<string, unknown>): string {
  return decryptStoredSecret(config.bot_token);
}

export function getZaloWebhookSecret(config: Record<string, unknown>): string {
  return decryptStoredSecret(config.webhook_secret);
}