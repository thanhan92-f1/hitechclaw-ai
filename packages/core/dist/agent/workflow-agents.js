import { randomUUID } from 'node:crypto';
import { EventBus } from './event-bus.js';
/**
 * SequentialWorkflowAgent — Executes sub-agents one after another.
 *
 * Each agent receives the previous agent's output via shared state.
 * The final agent's output becomes the workflow result.
 *
 * Inspired by Google ADK's SequentialAgent.
 */
export class SequentialWorkflowAgent {
    constructor(config) {
        this.events = new EventBus();
        this.agents = [];
        if (config.type !== 'sequential') {
            throw new Error(`SequentialWorkflowAgent requires type 'sequential', got '${config.type}'`);
        }
        this.config = config;
    }
    setAgents(agents) {
        this.agents = agents;
    }
    async execute(input, state) {
        var _a, _b;
        const start = Date.now();
        const sharedState = Object.assign(Object.assign(Object.assign({}, this.config.initialState), state), { input });
        const agentResults = [];
        const sessionId = `wf-seq-${this.config.id}-${randomUUID().slice(0, 8)}`;
        await this.events.emit({
            type: 'workflow-agent:start',
            payload: { workflowId: this.config.id, type: 'sequential', agentCount: this.agents.length },
            source: this.config.id,
            timestamp: new Date().toISOString(),
        });
        let currentInput = input;
        for (const agent of this.agents) {
            const agentStart = Date.now();
            const contextMessage = agentResults.length > 0
                ? `Previous step output:\n${agentResults[agentResults.length - 1].content}\n\nContinue with:\n${currentInput}`
                : currentInput;
            const content = await agent.chat(`${sessionId}-${agent.config.id}`, contextMessage);
            const result = {
                agentId: agent.config.id,
                agentName: agent.config.name,
                content,
                duration: Date.now() - agentStart,
            };
            agentResults.push(result);
            // Store output in shared state keyed by agent name
            sharedState[agent.config.name] = content;
            currentInput = content;
            await this.events.emit({
                type: 'workflow-agent:step',
                payload: { workflowId: this.config.id, agentName: agent.config.name, step: agentResults.length },
                source: this.config.id,
                timestamp: new Date().toISOString(),
            });
        }
        const finalResult = {
            workflowId: this.config.id,
            type: 'sequential',
            finalContent: (_b = (_a = agentResults[agentResults.length - 1]) === null || _a === void 0 ? void 0 : _a.content) !== null && _b !== void 0 ? _b : '',
            agentResults,
            state: sharedState,
            iterations: 1,
            totalDuration: Date.now() - start,
        };
        await this.events.emit({
            type: 'workflow-agent:complete',
            payload: { workflowId: this.config.id, duration: finalResult.totalDuration },
            source: this.config.id,
            timestamp: new Date().toISOString(),
        });
        return finalResult;
    }
}
/**
 * ParallelWorkflowAgent — Executes sub-agents concurrently.
 *
 * All agents receive the same input and run in parallel.
 * Results are gathered and optionally synthesized by the first agent.
 *
 * Inspired by Google ADK's ParallelAgent.
 */
export class ParallelWorkflowAgent {
    constructor(config) {
        this.events = new EventBus();
        this.agents = [];
        if (config.type !== 'parallel') {
            throw new Error(`ParallelWorkflowAgent requires type 'parallel', got '${config.type}'`);
        }
        this.config = config;
    }
    setAgents(agents) {
        this.agents = agents;
    }
    async execute(input, state) {
        const start = Date.now();
        const sharedState = Object.assign(Object.assign(Object.assign({}, this.config.initialState), state), { input });
        const sessionPrefix = `wf-par-${this.config.id}-${randomUUID().slice(0, 8)}`;
        await this.events.emit({
            type: 'workflow-agent:start',
            payload: { workflowId: this.config.id, type: 'parallel', agentCount: this.agents.length },
            source: this.config.id,
            timestamp: new Date().toISOString(),
        });
        // Fan-out: all agents process in parallel
        const agentResults = await Promise.all(this.agents.map(async (agent) => {
            const agentStart = Date.now();
            const content = await agent.chat(`${sessionPrefix}-${agent.config.id}`, input);
            sharedState[agent.config.name] = content;
            return {
                agentId: agent.config.id,
                agentName: agent.config.name,
                content,
                duration: Date.now() - agentStart,
            };
        }));
        // Gather: synthesize results using first agent
        const synthesizer = this.agents[0];
        const synthesisPrompt = [
            `Multiple agents analyzed this input: "${input}"`,
            '',
            ...agentResults.map((r, i) => `--- Agent ${i + 1} (${r.agentName}) ---\n${r.content}`),
            '',
            'Synthesize a comprehensive answer combining the best insights from all agents.',
        ].join('\n');
        const finalContent = await synthesizer.chat(`${sessionPrefix}-synthesis`, synthesisPrompt);
        sharedState['_synthesis'] = finalContent;
        const finalResult = {
            workflowId: this.config.id,
            type: 'parallel',
            finalContent,
            agentResults,
            state: sharedState,
            iterations: 1,
            totalDuration: Date.now() - start,
        };
        await this.events.emit({
            type: 'workflow-agent:complete',
            payload: { workflowId: this.config.id, duration: finalResult.totalDuration },
            source: this.config.id,
            timestamp: new Date().toISOString(),
        });
        return finalResult;
    }
}
/**
 * LoopWorkflowAgent — Executes sub-agents in a loop until escalation or max iterations.
 *
 * Each iteration runs all sub-agents sequentially.
 * The loop stops when:
 * - `maxIterations` is reached
 * - A sub-agent sets `state[escalationKey]` to `true`
 *
 * Inspired by Google ADK's LoopAgent.
 */
export class LoopWorkflowAgent {
    constructor(config) {
        this.events = new EventBus();
        this.agents = [];
        if (config.type !== 'loop') {
            throw new Error(`LoopWorkflowAgent requires type 'loop', got '${config.type}'`);
        }
        this.config = config;
    }
    setAgents(agents) {
        this.agents = agents;
    }
    async execute(input, state) {
        var _a, _b, _c, _d;
        const start = Date.now();
        const maxIterations = (_a = this.config.maxIterations) !== null && _a !== void 0 ? _a : 5;
        const escalationKey = (_b = this.config.escalationKey) !== null && _b !== void 0 ? _b : '_escalate';
        const sharedState = Object.assign(Object.assign(Object.assign({}, this.config.initialState), state), { input });
        const agentResults = [];
        const sessionId = `wf-loop-${this.config.id}-${randomUUID().slice(0, 8)}`;
        let iterations = 0;
        await this.events.emit({
            type: 'workflow-agent:start',
            payload: { workflowId: this.config.id, type: 'loop', maxIterations },
            source: this.config.id,
            timestamp: new Date().toISOString(),
        });
        for (iterations = 0; iterations < maxIterations; iterations++) {
            let shouldEscalate = false;
            for (const agent of this.agents) {
                const agentStart = Date.now();
                const iterationContext = iterations === 0
                    ? input
                    : `Iteration ${iterations + 1}. Previous state:\n${JSON.stringify(sharedState, null, 2)}\n\nOriginal input: ${input}`;
                const content = await agent.chat(`${sessionId}-iter${iterations}-${agent.config.id}`, iterationContext);
                agentResults.push({
                    agentId: agent.config.id,
                    agentName: agent.config.name,
                    content,
                    duration: Date.now() - agentStart,
                });
                sharedState[agent.config.name] = content;
                // Check for escalation signal in content
                if (content.toLowerCase().includes('"escalate": true') || content.toLowerCase().includes('"escalate":true')) {
                    sharedState[escalationKey] = true;
                }
                if (sharedState[escalationKey]) {
                    shouldEscalate = true;
                    break;
                }
            }
            await this.events.emit({
                type: 'workflow-agent:iteration',
                payload: { workflowId: this.config.id, iteration: iterations + 1, escalated: shouldEscalate },
                source: this.config.id,
                timestamp: new Date().toISOString(),
            });
            if (shouldEscalate)
                break;
        }
        const finalResult = {
            workflowId: this.config.id,
            type: 'loop',
            finalContent: (_d = (_c = agentResults[agentResults.length - 1]) === null || _c === void 0 ? void 0 : _c.content) !== null && _d !== void 0 ? _d : '',
            agentResults,
            state: sharedState,
            iterations: iterations + 1,
            totalDuration: Date.now() - start,
        };
        await this.events.emit({
            type: 'workflow-agent:complete',
            payload: { workflowId: this.config.id, iterations: finalResult.iterations, duration: finalResult.totalDuration },
            source: this.config.id,
            timestamp: new Date().toISOString(),
        });
        return finalResult;
    }
}
/**
 * Factory function to create the appropriate workflow agent based on config type.
 */
export function createWorkflowAgent(config) {
    switch (config.type) {
        case 'sequential':
            return new SequentialWorkflowAgent(config);
        case 'parallel':
            return new ParallelWorkflowAgent(config);
        case 'loop':
            return new LoopWorkflowAgent(config);
        default:
            throw new Error(`Unknown workflow agent type: ${config.type}`);
    }
}
