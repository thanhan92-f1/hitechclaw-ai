export type HiTechClawEventType =
  | "message_received"
  | "message_sent"
  | "tool_call"
  | "error"
  | "cron"
  | "system"
  | "note";

export type HiTechClawDirection = "inbound" | "outbound";

export interface HiTechClawMetadata {
  [key: string]: unknown;
}

export interface TrackEventInput {
  agent_id?: string;
  direction?: HiTechClawDirection;
  session_key?: string;
  channel_id?: string;
  sender?: string;
  content?: string;
  metadata?: HiTechClawMetadata;
  token_estimate?: number;
  timestamp?: string;
}

export interface TrackEventPayload extends TrackEventInput {
  event_type: HiTechClawEventType;
}

export interface HiTechClawClientOptions {
  baseUrl: string;
  token: string;
  fetch?: typeof fetch;
  headers?: Record<string, string>;
}

export interface HiTechClawTrackResponse {
  ok: boolean;
  event_id: number;
  created_at: string;
  remaining_requests?: number;
  threat?: {
    level: string;
    classes: string[];
  };
}

export class HiTechClawAI {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly fetchImpl: typeof fetch;
  private readonly headers: Record<string, string>;

  constructor(options: HiTechClawClientOptions) {
    if (!options.baseUrl?.trim()) {
      throw new Error("HiTechClawAI requires a non-empty baseUrl.");
    }
    if (!options.token?.trim()) {
      throw new Error("HiTechClawAI requires a non-empty token.");
    }
    if (!options.fetch) {
      if (typeof globalThis.fetch !== "function") {
        throw new Error("HiTechClawAI requires fetch. Pass options.fetch on runtimes without global fetch.");
      }
      this.fetchImpl = globalThis.fetch.bind(globalThis);
    } else {
      this.fetchImpl = options.fetch;
    }
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.token = options.token;
    this.headers = options.headers ?? {};
  }

  async track(eventType: HiTechClawEventType, payload: TrackEventInput = {}): Promise<HiTechClawTrackResponse> {
    return this.send({ event_type: eventType, ...payload });
  }

  async send(payload: TrackEventPayload): Promise<HiTechClawTrackResponse> {
    const response = await this.fetchImpl(`${this.baseUrl}/api/ingest`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.token}`,
        "Content-Type": "application/json",
        ...this.headers,
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as HiTechClawTrackResponse | { error?: string; retryAfterSeconds?: number };
    if (!response.ok) {
      const message = "error" in data && data.error ? data.error : `HiTechClawAI request failed with ${response.status}`;
      throw new Error(message);
    }
    return data as HiTechClawTrackResponse;
  }
}
