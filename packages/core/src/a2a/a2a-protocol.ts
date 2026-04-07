import type {
    A2AAgentCard,
    A2ACapability,
    A2ATask,
    A2ATaskResult,
    ToolDefinition
} from '@hitechclaw/shared';
import { randomUUID } from 'node:crypto';
import { Agent } from '../agent/agent.js';
import { EventBus } from '../agent/event-bus.js';

/**
 * A2AServer — Exposes an HiTechClaw Agent as an A2A-compatible service.
 *
 * Wraps an Agent instance and provides a standardized interface
 * for remote agents to send tasks and receive results.
 *
 * Inspired by Google ADK's A2A Protocol.
 *
 * Usage:
 *   const server = new A2AServer(agent, { name: 'MyAgent', url: '/a2a/my-agent' });
 *   const result = await server.handleTask(task);
 */
export class A2AServer {
  readonly agent: Agent;
  readonly card: A2AAgentCard;
  readonly events = new EventBus();

  constructor(agent: Agent, options: {
    name?: string;
    description?: string;
    url: string;
    version?: string;
    capabilities?: A2ACapability[];
  }) {
    this.agent = agent;
    this.card = {
      name: options.name ?? agent.config.name,
      description: options.description ?? agent.config.description ?? agent.config.persona.slice(0, 200),
      url: options.url,
      version: options.version ?? '1.0.0',
      capabilities: options.capabilities ?? ['text', 'tools'],
    };
  }

  /**
   * Returns the agent card for discovery.
   */
  getAgentCard(): A2AAgentCard {
    return { ...this.card };
  }

  /**
   * Handle an incoming A2A task.
   */
  async handleTask(task: A2ATask): Promise<A2ATaskResult> {
    await this.events.emit({
      type: 'a2a:task-received',
      payload: { taskId: task.id, from: task.metadata?.sourceAgent ?? 'unknown' },
      source: this.card.name,
      timestamp: new Date().toISOString(),
    });

    try {
      const sessionId = task.sessionId ?? `a2a-${task.id}`;
      const response = await this.agent.chat(sessionId, task.message);

      const result: A2ATaskResult = {
        taskId: task.id,
        status: 'completed',
        content: response,
      };

      await this.events.emit({
        type: 'a2a:task-completed',
        payload: { taskId: task.id },
        source: this.card.name,
        timestamp: new Date().toISOString(),
      });

      return result;
    } catch (err) {
      const result: A2ATaskResult = {
        taskId: task.id,
        status: 'failed',
        content: '',
        error: err instanceof Error ? err.message : String(err),
      };

      await this.events.emit({
        type: 'a2a:task-failed',
        payload: { taskId: task.id, error: result.error },
        source: this.card.name,
        timestamp: new Date().toISOString(),
      });

      return result;
    }
  }
}

/**
 * RemoteA2AAgent — Client proxy for consuming a remote A2A agent.
 *
 * Acts as a tool that can be registered in a parent agent's ToolRegistry,
 * allowing seamless interaction with remote agents as if they were local tools.
 *
 * Inspired by Google ADK's RemoteA2aAgent.
 *
 * Usage:
 *   const remote = new RemoteA2AAgent('http://remote:3000/a2a/agent');
 *   parentAgent.tools.register(remote.getToolDefinition(), remote.createHandler());
 */
export class RemoteA2AAgent {
  private baseUrl: string;
  private agentCard?: A2AAgentCard;
  private headers: Record<string, string>;
  readonly events = new EventBus();

  constructor(baseUrl: string, options?: {
    headers?: Record<string, string>;
    agentCard?: A2AAgentCard;
  }) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.headers = {
      'Content-Type': 'application/json',
      ...options?.headers,
    };
    this.agentCard = options?.agentCard;
  }

  /**
   * Discover the remote agent's capabilities.
   */
  async discover(): Promise<A2AAgentCard> {
    if (this.agentCard) return this.agentCard;

    const response = await fetch(`${this.baseUrl}/.well-known/agent.json`, {
      headers: this.headers,
    });

    if (!response.ok) {
      throw new Error(`A2A discovery failed: ${response.status} ${response.statusText}`);
    }

    this.agentCard = await response.json() as A2AAgentCard;
    return this.agentCard;
  }

  /**
   * Send a task to the remote agent.
   */
  async sendTask(message: string, options?: {
    sessionId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<A2ATaskResult> {
    const task: A2ATask = {
      id: randomUUID(),
      message,
      sessionId: options?.sessionId,
      metadata: options?.metadata,
    };

    await this.events.emit({
      type: 'a2a:task-sent',
      payload: { taskId: task.id, url: this.baseUrl },
      source: 'remote-a2a',
      timestamp: new Date().toISOString(),
    });

    const response = await fetch(`${this.baseUrl}/tasks`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(task),
    });

    if (!response.ok) {
      throw new Error(`A2A task failed: ${response.status} ${response.statusText}`);
    }

    return await response.json() as A2ATaskResult;
  }

  /**
   * Generate a ToolDefinition for this remote agent, so it can be
   * registered in a parent agent's ToolRegistry.
   */
  getToolDefinition(): ToolDefinition {
    const card = this.agentCard;
    return {
      name: `a2a_${(card?.name ?? 'remote').replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()}`,
      description: card?.description ?? `Remote A2A agent at ${this.baseUrl}`,
      category: 'a2a',
      parameters: [
        {
          name: 'message',
          type: 'string',
          description: 'The message or task to send to the remote agent',
          required: true,
        },
        {
          name: 'session_id',
          type: 'string',
          description: 'Optional session ID for multi-turn conversations',
          required: false,
        },
      ],
    };
  }

  /**
   * Create a tool handler function for this remote agent.
   */
  createHandler(): (args: Record<string, unknown>) => Promise<unknown> {
    return async (args: Record<string, unknown>) => {
      const message = args.message as string;
      const sessionId = args.session_id as string | undefined;

      const result = await this.sendTask(message, { sessionId });

      if (result.status === 'failed') {
        throw new Error(`Remote agent error: ${result.error}`);
      }

      return result.content;
    };
  }
}

/**
 * A2ARegistry — Registry for managing multiple A2A servers and remote agents.
 */
export class A2ARegistry {
  private servers = new Map<string, A2AServer>();
  private remotes = new Map<string, RemoteA2AAgent>();
  readonly events = new EventBus();

  /**
   * Expose a local agent as an A2A server.
   */
  expose(agent: Agent, url: string, options?: { name?: string; description?: string }): A2AServer {
    const server = new A2AServer(agent, { url, ...options });
    this.servers.set(server.card.name, server);
    return server;
  }

  /**
   * Connect to a remote A2A agent.
   */
  async connect(url: string, options?: { headers?: Record<string, string> }): Promise<RemoteA2AAgent> {
    const remote = new RemoteA2AAgent(url, options);
    const card = await remote.discover();
    this.remotes.set(card.name, remote);
    return remote;
  }

  /**
   * Get all exposed A2A servers.
   */
  getServers(): A2AServer[] {
    return [...this.servers.values()];
  }

  /**
   * Get all connected remote agents.
   */
  getRemotes(): RemoteA2AAgent[] {
    return [...this.remotes.values()];
  }

  /**
   * Get a specific exposed server by name.
   */
  getServer(name: string): A2AServer | undefined {
    return this.servers.get(name);
  }

  /**
   * Get a specific remote agent by name.
   */
  getRemote(name: string): RemoteA2AAgent | undefined {
    return this.remotes.get(name);
  }

  /**
   * Get all agent cards from both local servers and discovered remotes.
   */
  async getAllAgentCards(): Promise<A2AAgentCard[]> {
    const cards: A2AAgentCard[] = [];
    for (const server of this.servers.values()) {
      cards.push(server.getAgentCard());
    }
    for (const remote of this.remotes.values()) {
      try {
        cards.push(await remote.discover());
      } catch {
        // skip unreachable remotes
      }
    }
    return cards;
  }
}
