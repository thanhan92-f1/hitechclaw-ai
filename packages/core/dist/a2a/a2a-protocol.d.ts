import type { A2AAgentCard, A2ACapability, A2ATask, A2ATaskResult, ToolDefinition } from '@hitechclaw/shared';
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
export declare class A2AServer {
    readonly agent: Agent;
    readonly card: A2AAgentCard;
    readonly events: EventBus;
    constructor(agent: Agent, options: {
        name?: string;
        description?: string;
        url: string;
        version?: string;
        capabilities?: A2ACapability[];
    });
    /**
     * Returns the agent card for discovery.
     */
    getAgentCard(): A2AAgentCard;
    /**
     * Handle an incoming A2A task.
     */
    handleTask(task: A2ATask): Promise<A2ATaskResult>;
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
export declare class RemoteA2AAgent {
    private baseUrl;
    private agentCard?;
    private headers;
    readonly events: EventBus;
    constructor(baseUrl: string, options?: {
        headers?: Record<string, string>;
        agentCard?: A2AAgentCard;
    });
    /**
     * Discover the remote agent's capabilities.
     */
    discover(): Promise<A2AAgentCard>;
    /**
     * Send a task to the remote agent.
     */
    sendTask(message: string, options?: {
        sessionId?: string;
        metadata?: Record<string, unknown>;
    }): Promise<A2ATaskResult>;
    /**
     * Generate a ToolDefinition for this remote agent, so it can be
     * registered in a parent agent's ToolRegistry.
     */
    getToolDefinition(): ToolDefinition;
    /**
     * Create a tool handler function for this remote agent.
     */
    createHandler(): (args: Record<string, unknown>) => Promise<unknown>;
}
/**
 * A2ARegistry — Registry for managing multiple A2A servers and remote agents.
 */
export declare class A2ARegistry {
    private servers;
    private remotes;
    readonly events: EventBus;
    /**
     * Expose a local agent as an A2A server.
     */
    expose(agent: Agent, url: string, options?: {
        name?: string;
        description?: string;
    }): A2AServer;
    /**
     * Connect to a remote A2A agent.
     */
    connect(url: string, options?: {
        headers?: Record<string, string>;
    }): Promise<RemoteA2AAgent>;
    /**
     * Get all exposed A2A servers.
     */
    getServers(): A2AServer[];
    /**
     * Get all connected remote agents.
     */
    getRemotes(): RemoteA2AAgent[];
    /**
     * Get a specific exposed server by name.
     */
    getServer(name: string): A2AServer | undefined;
    /**
     * Get a specific remote agent by name.
     */
    getRemote(name: string): RemoteA2AAgent | undefined;
    /**
     * Get all agent cards from both local servers and discovered remotes.
     */
    getAllAgentCards(): Promise<A2AAgentCard[]>;
}
//# sourceMappingURL=a2a-protocol.d.ts.map