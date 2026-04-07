import type { ChannelPlugin, IncomingMessage, OutgoingMessage } from '@hitechclaw/shared';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export interface DiscordChannelConfig {
  botToken: string;
  /** Comma-separated list of guild IDs to listen to (empty = all guilds) */
  guildIds?: string[];
}

const DISCORD_API = 'https://discord.com/api/v10';

// Discord Gateway opcodes
const OP_DISPATCH = 0;
const OP_HEARTBEAT = 1;
const OP_IDENTIFY = 2;
const OP_HELLO = 10;
const OP_HEARTBEAT_ACK = 11;

/** Minimal Discord REST helper */
async function discordFetch(path: string, token: string, options: RequestInit = {}): Promise<any> {
  const res = await fetch(`${DISCORD_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Discord API ${path} → ${res.status}: ${body}`);
  }
  return res.json();
}

/**
 * Discord channel adapter for HiTechClaw.
 *
 * Uses Discord Gateway WebSocket (v10) for receiving messages and
 * the REST API for sending messages. Supports slash-less text commands.
 */
export class DiscordChannel implements ChannelPlugin {
  readonly id = 'discord-channel';
  readonly platform = 'discord' as const;
  readonly name = 'Discord Channel';
  readonly version = '2.0.0';

  private config!: DiscordChannelConfig;
  private messageHandler?: (message: IncomingMessage) => Promise<void>;
  private running = false;
  private ws?: any; // ws.WebSocket
  private heartbeatInterval?: ReturnType<typeof setInterval>;
  private sessionId?: string;
  private lastSequence: number | null = null;
  private botUserId?: string;
  private reconnectTimer?: ReturnType<typeof setTimeout>;

  async initialize(config: Record<string, unknown>): Promise<void> {
    const botToken = config.botToken as string;
    if (!botToken) throw new Error('DiscordChannel: botToken is required');

    this.config = {
      botToken,
      guildIds: config.guildIds ? String(config.guildIds).split(',').map((s) => s.trim()).filter(Boolean) : undefined,
    };

    // Verify token and get bot user info
    const me = await discordFetch('/users/@me', botToken);
    this.botUserId = me.id;
    console.log(`   Discord:    connected as @${me.username}#${me.discriminator}`);
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    await this.connectGateway();
    console.log('   Discord:    gateway connected, listening for messages');
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      try { this.ws.close(); } catch { /* ignore */ }
      this.ws = undefined;
    }
    console.log('   Discord:    stopped');
  }

  async send(message: OutgoingMessage): Promise<void> {
    const chunks = this.splitMessage(message.content, 2000);
    for (const chunk of chunks) {
      await discordFetch(`/channels/${message.channelId}/messages`, this.config.botToken, {
        method: 'POST',
        body: JSON.stringify({ content: chunk }),
      });
    }
  }

  onMessage(handler: (message: IncomingMessage) => Promise<void>): void {
    this.messageHandler = handler;
  }

  // ─── Gateway ───────────────────────────────────────────────

  private async connectGateway(): Promise<void> {
    // Get gateway URL
    const gatewayInfo = await discordFetch('/gateway/bot', this.config.botToken);
    const gatewayUrl = `${gatewayInfo.url}?v=10&encoding=json`;

    const { WebSocket } = require('ws') as {
      WebSocket: new (url: string) => {
        on: (event: string, handler: (...args: any[]) => void) => void;
        close: () => void;
        send: (payload: string) => void;
        readyState: number;
      };
    };
    this.ws = new WebSocket(gatewayUrl);

    this.ws.on('message', (data: Buffer) => {
      try {
        const payload = JSON.parse(data.toString());
        this.handleGatewayMessage(payload);
      } catch { /* invalid JSON */ }
    });

    this.ws.on('close', (code: number) => {
      if (!this.running) return;
      console.warn(`   Discord:    gateway closed (code ${code}), reconnecting in 5s...`);
      if (this.heartbeatInterval) { clearInterval(this.heartbeatInterval); this.heartbeatInterval = undefined; }
      this.reconnectTimer = setTimeout(() => this.connectGateway(), 5000);
    });

    this.ws.on('error', (err: Error) => {
      console.error('   Discord:    gateway error:', err.message);
    });
  }

  private handleGatewayMessage(payload: { op: number; d: any; s: number | null; t: string | null }): void {
    if (payload.s !== null) this.lastSequence = payload.s;

    switch (payload.op) {
      case OP_HELLO:
        this.startHeartbeat(payload.d.heartbeat_interval);
        this.identify();
        break;

      case OP_HEARTBEAT:
        this.sendGateway({ op: OP_HEARTBEAT_ACK, d: null });
        break;

      case OP_HEARTBEAT_ACK:
        // Heartbeat acknowledged
        break;

      case OP_DISPATCH:
        this.handleDispatch(payload.t!, payload.d);
        break;
    }
  }

  private handleDispatch(event: string, data: any): void {
    switch (event) {
      case 'READY':
        this.sessionId = data.session_id;
        break;

      case 'MESSAGE_CREATE':
        this.handleMessageCreate(data).catch((err) =>
          console.error('Discord message handler error:', err instanceof Error ? err.message : err),
        );
        break;
    }
  }

  private async handleMessageCreate(msg: any): Promise<void> {
    // Ignore bots and our own messages
    if (msg.author?.bot) return;
    if (msg.author?.id === this.botUserId) return;
    // Filter by guild if configured
    if (this.config.guildIds?.length && msg.guild_id && !this.config.guildIds.includes(msg.guild_id)) return;

    const incoming: IncomingMessage = {
      platform: 'discord',
      channelId: msg.channel_id,
      userId: msg.author?.id ?? 'unknown',
      content: msg.content ?? '',
      timestamp: new Date(msg.timestamp).toISOString(),
      replyTo: msg.message_reference?.message_id,
      metadata: {
        guildId: msg.guild_id,
        messageId: msg.id,
        authorUsername: msg.author?.username,
      },
    };

    if (this.messageHandler) {
      await this.messageHandler(incoming);
    }
  }

  private identify(): void {
    this.sendGateway({
      op: OP_IDENTIFY,
      d: {
        token: this.config.botToken,
        intents: 33280, // GUILDS (1) + GUILD_MESSAGES (512) + MESSAGE_CONTENT (32768)
        properties: { os: 'linux', browser: 'hitechclaw', device: 'hitechclaw' },
      },
    });
  }

  private startHeartbeat(intervalMs: number): void {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = setInterval(() => {
      this.sendGateway({ op: OP_HEARTBEAT, d: this.lastSequence });
    }, intervalMs);
  }

  private sendGateway(payload: object): void {
    if (this.ws?.readyState === 1 /* OPEN */) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  private splitMessage(text: string, maxLength: number): string[] {
    if (text.length <= maxLength) return [text];
    const chunks: string[] = [];
    let i = 0;
    while (i < text.length) {
      chunks.push(text.slice(i, i + maxLength));
      i += maxLength;
    }
    return chunks;
  }
}
