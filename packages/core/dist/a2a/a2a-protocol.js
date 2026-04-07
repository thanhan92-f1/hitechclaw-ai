import { randomUUID } from 'node:crypto';
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
    constructor(agent, options) {
        var _a, _b, _c, _d, _e;
        this.events = new EventBus();
        this.agent = agent;
        this.card = {
            name: (_a = options.name) !== null && _a !== void 0 ? _a : agent.config.name,
            description: (_c = (_b = options.description) !== null && _b !== void 0 ? _b : agent.config.description) !== null && _c !== void 0 ? _c : agent.config.persona.slice(0, 200),
            url: options.url,
            version: (_d = options.version) !== null && _d !== void 0 ? _d : '1.0.0',
            capabilities: (_e = options.capabilities) !== null && _e !== void 0 ? _e : ['text', 'tools'],
        };
    }
    /**
     * Returns the agent card for discovery.
     */
    getAgentCard() {
        return Object.assign({}, this.card);
    }
    /**
     * Handle an incoming A2A task.
     */
    async handleTask(task) {
        var _a, _b, _c;
        await this.events.emit({
            type: 'a2a:task-received',
            payload: { taskId: task.id, from: (_b = (_a = task.metadata) === null || _a === void 0 ? void 0 : _a.sourceAgent) !== null && _b !== void 0 ? _b : 'unknown' },
            source: this.card.name,
            timestamp: new Date().toISOString(),
        });
        try {
            const sessionId = (_c = task.sessionId) !== null && _c !== void 0 ? _c : `a2a-${task.id}`;
            const response = await this.agent.chat(sessionId, task.message);
            const result = {
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
        }
        catch (err) {
            const result = {
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
    constructor(baseUrl, options) {
        this.events = new EventBus();
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.headers = Object.assign({ 'Content-Type': 'application/json' }, options === null || options === void 0 ? void 0 : options.headers);
        this.agentCard = options === null || options === void 0 ? void 0 : options.agentCard;
    }
    /**
     * Discover the remote agent's capabilities.
     */
    async discover() {
        if (this.agentCard)
            return this.agentCard;
        const response = await fetch(`${this.baseUrl}/.well-known/agent.json`, {
            headers: this.headers,
        });
        if (!response.ok) {
            throw new Error(`A2A discovery failed: ${response.status} ${response.statusText}`);
        }
        this.agentCard = await response.json();
        return this.agentCard;
    }
    /**
     * Send a task to the remote agent.
     */
    async sendTask(message, options) {
        const task = {
            id: randomUUID(),
            message,
            sessionId: options === null || options === void 0 ? void 0 : options.sessionId,
            metadata: options === null || options === void 0 ? void 0 : options.metadata,
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
        return await response.json();
    }
    /**
     * Generate a ToolDefinition for this remote agent, so it can be
     * registered in a parent agent's ToolRegistry.
     */
    getToolDefinition() {
        var _a, _b;
        const card = this.agentCard;
        return {
            name: `a2a_${((_a = card === null || card === void 0 ? void 0 : card.name) !== null && _a !== void 0 ? _a : 'remote').replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()}`,
            description: (_b = card === null || card === void 0 ? void 0 : card.description) !== null && _b !== void 0 ? _b : `Remote A2A agent at ${this.baseUrl}`,
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
    createHandler() {
        return async (args) => {
            const message = args.message;
            const sessionId = args.session_id;
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
    constructor() {
        this.servers = new Map();
        this.remotes = new Map();
        this.events = new EventBus();
    }
    /**
     * Expose a local agent as an A2A server.
     */
    expose(agent, url, options) {
        const server = new A2AServer(agent, Object.assign({ url }, options));
        this.servers.set(server.card.name, server);
        return server;
    }
    /**
     * Connect to a remote A2A agent.
     */
    async connect(url, options) {
        const remote = new RemoteA2AAgent(url, options);
        const card = await remote.discover();
        this.remotes.set(card.name, remote);
        return remote;
    }
    /**
     * Get all exposed A2A servers.
     */
    getServers() {
        return [...this.servers.values()];
    }
    /**
     * Get all connected remote agents.
     */
    getRemotes() {
        return [...this.remotes.values()];
    }
    /**
     * Get a specific exposed server by name.
     */
    getServer(name) {
        return this.servers.get(name);
    }
    /**
     * Get a specific remote agent by name.
     */
    getRemote(name) {
        return this.remotes.get(name);
    }
    /**
     * Get all agent cards from both local servers and discovered remotes.
     */
    async getAllAgentCards() {
        const cards = [];
        for (const server of this.servers.values()) {
            cards.push(server.getAgentCard());
        }
        for (const remote of this.remotes.values()) {
            try {
                cards.push(await remote.discover());
            }
            catch (_a) {
                // skip unreachable remotes
            }
        }
        return cards;
    }
}
