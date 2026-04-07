/**
 * Slack Web API wrapper — minimal implementation for HiTechClaw channel plugin.
 * Uses plain HTTP calls to avoid heavy SDK dependencies.
 */

export interface SlackMessage {
  type: string;
  channel: string;
  user?: string;
  text: string;
  ts: string;
  thread_ts?: string;
  bot_id?: string;
  subtype?: string;
}

export interface SlackEvent {
  type: string;
  event: SlackMessage;
  event_id: string;
  team_id: string;
}

export class SlackApi {
  private baseUrl = 'https://slack.com/api';

  constructor(private botToken: string) {}

  private async call(method: string, body?: Record<string, unknown>): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}/${method}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.botToken}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json() as Record<string, unknown>;
    if (!data.ok) throw new Error(`Slack API error: ${data.error}`);
    return data;
  }

  async authTest(): Promise<{ user_id: string; user: string; bot_id: string; team: string }> {
    return this.call('auth.test') as Promise<{ user_id: string; user: string; bot_id: string; team: string }>;
  }

  async postMessage(channel: string, text: string, threadTs?: string): Promise<void> {
    await this.call('chat.postMessage', { channel, text, thread_ts: threadTs });
  }

  async conversationsHistory(channel: string, limit = 10): Promise<SlackMessage[]> {
    const data = await this.call('conversations.history', { channel, limit }) as { messages: SlackMessage[] };
    return data.messages || [];
  }
}
