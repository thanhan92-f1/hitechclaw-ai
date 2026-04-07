import { EventBus } from './event-bus.js';
/**
 * Multi-Agent Collaboration — Orchestrates multiple agents working together
 * on complex tasks using different coordination patterns.
 *
 * Modes:
 * - `sequential`: Agents process in order, each building on previous output
 * - `parallel`: All agents process simultaneously, results merged
 * - `debate`: Agents debate and refine answers across rounds
 * - `supervisor`: A supervisor agent delegates and synthesizes sub-results
 */
export class MultiAgentOrchestrator {
    agents = new Map();
    events = new EventBus();
    registerAgent(agent) {
        this.agents.set(agent.config.id, agent);
    }
    unregisterAgent(agentId) {
        this.agents.delete(agentId);
    }
    getAgents() {
        return [...this.agents.values()];
    }
    async execute(task) {
        const start = Date.now();
        await this.events.emit({
            type: 'multi-agent:start',
            payload: { taskId: task.id, mode: task.orchestrationMode },
            source: 'orchestrator',
            timestamp: new Date().toISOString(),
        });
        const selectedAgents = this.selectAgents(task);
        if (selectedAgents.length === 0) {
            throw new Error('No agents available for this task');
        }
        let result;
        switch (task.orchestrationMode) {
            case 'sequential':
                result = await this.executeSequential(task, selectedAgents);
                break;
            case 'parallel':
                result = await this.executeParallel(task, selectedAgents);
                break;
            case 'debate':
                result = await this.executeDebate(task, selectedAgents);
                break;
            case 'supervisor':
                result = await this.executeSupervisor(task, selectedAgents);
                break;
            default:
                throw new Error(`Unknown orchestration mode: ${task.orchestrationMode}`);
        }
        result.totalDuration = Date.now() - start;
        await this.events.emit({
            type: 'multi-agent:complete',
            payload: { taskId: task.id, duration: result.totalDuration, rounds: result.rounds },
            source: 'orchestrator',
            timestamp: new Date().toISOString(),
        });
        return result;
    }
    /**
     * Sequential: Each agent processes in order, receiving the previous agent's output.
     */
    async executeSequential(task, agents) {
        const sessionId = `multi-${task.id}`;
        const agentResults = [];
        let currentInput = task.input;
        for (const agent of agents) {
            const start = Date.now();
            const contextMessage = agentResults.length > 0
                ? `Previous analysis:\n${agentResults[agentResults.length - 1].content}\n\nNow continue with your perspective:\n${currentInput}`
                : currentInput;
            const content = await agent.chat(sessionId, contextMessage);
            agentResults.push({
                agentId: agent.config.id,
                agentName: agent.config.name,
                content,
                duration: Date.now() - start,
            });
            currentInput = content;
        }
        return {
            taskId: task.id,
            mode: 'sequential',
            finalContent: agentResults[agentResults.length - 1].content,
            agentResults,
            totalDuration: 0,
            rounds: 1,
        };
    }
    /**
     * Parallel: All agents process simultaneously, results are merged.
     */
    async executeParallel(task, agents) {
        const agentResults = await Promise.all(agents.map(async (agent) => {
            const sessionId = `multi-${task.id}-${agent.config.id}`;
            const start = Date.now();
            const content = await agent.chat(sessionId, task.input);
            return {
                agentId: agent.config.id,
                agentName: agent.config.name,
                content,
                duration: Date.now() - start,
            };
        }));
        // Use first agent to synthesize parallel results
        const synthesizer = agents[0];
        const synthesisPrompt = `Multiple experts analyzed this question: "${task.input}"\n\nTheir responses:\n${agentResults.map((r, i) => `--- Expert ${i + 1} (${r.agentName}) ---\n${r.content}`).join('\n\n')}\n\nSynthesize a comprehensive answer combining the best insights from all experts.`;
        const sessionId = `multi-${task.id}-synthesis`;
        const finalContent = await synthesizer.chat(sessionId, synthesisPrompt);
        return {
            taskId: task.id,
            mode: 'parallel',
            finalContent,
            agentResults,
            totalDuration: 0,
            rounds: 1,
        };
    }
    /**
     * Debate: Agents take turns refining the answer across multiple rounds.
     */
    async executeDebate(task, agents) {
        const maxRounds = task.maxRounds ?? 3;
        const sessionId = `multi-${task.id}`;
        const agentResults = [];
        let currentAnswer = '';
        let round = 0;
        for (round = 0; round < maxRounds; round++) {
            for (const agent of agents) {
                const start = Date.now();
                const prompt = round === 0 && currentAnswer === ''
                    ? task.input
                    : `Original question: "${task.input}"\n\nCurrent best answer:\n${currentAnswer}\n\nCritique this answer and provide an improved version. If the answer is already good, confirm it.`;
                const content = await agent.chat(sessionId, prompt);
                agentResults.push({
                    agentId: agent.config.id,
                    agentName: agent.config.name,
                    content,
                    duration: Date.now() - start,
                });
                currentAnswer = content;
            }
        }
        return {
            taskId: task.id,
            mode: 'debate',
            finalContent: currentAnswer,
            agentResults,
            totalDuration: 0,
            rounds: round,
        };
    }
    /**
     * Supervisor: A designated supervisor agent delegates subtasks and synthesizes.
     */
    async executeSupervisor(task, agents) {
        const supervisorId = task.supervisorAgentId ?? agents[0].config.id;
        const supervisor = this.agents.get(supervisorId);
        if (!supervisor) {
            throw new Error(`Supervisor agent "${supervisorId}" not found`);
        }
        const workers = agents.filter((a) => a.config.id !== supervisorId);
        if (workers.length === 0) {
            throw new Error('Need at least one worker agent besides supervisor');
        }
        const sessionId = `multi-${task.id}`;
        const agentResults = [];
        // Supervisor plans subtasks
        const planPrompt = `You are a supervisor coordinating ${workers.length} agents. Task: "${task.input}"\n\nAvailable agents:\n${workers.map((w) => `- ${w.config.name}: ${w.config.persona}`).join('\n')}\n\nBreak this task into subtasks, one per agent. Output ONLY a JSON array: [{"agentName": "...", "subtask": "..."}]`;
        const start = Date.now();
        const planContent = await supervisor.chat(sessionId, planPrompt);
        agentResults.push({
            agentId: supervisor.config.id,
            agentName: supervisor.config.name,
            content: planContent,
            duration: Date.now() - start,
        });
        // Parse plan and delegate
        let subtasks;
        try {
            const jsonMatch = planContent.match(/\[[\s\S]*\]/);
            subtasks = jsonMatch ? JSON.parse(jsonMatch[0]) : workers.map((w) => ({ agentName: w.config.name, subtask: task.input }));
        }
        catch {
            subtasks = workers.map((w) => ({ agentName: w.config.name, subtask: task.input }));
        }
        // Execute subtasks in parallel
        const workerResults = await Promise.all(subtasks.map(async (st) => {
            const worker = workers.find((w) => w.config.name === st.agentName) ?? workers[0];
            const wStart = Date.now();
            const content = await worker.chat(`multi-${task.id}-${worker.config.id}`, st.subtask);
            const result = {
                agentId: worker.config.id,
                agentName: worker.config.name,
                content,
                duration: Date.now() - wStart,
            };
            agentResults.push(result);
            return result;
        }));
        // Supervisor synthesizes
        const synthPrompt = `Results from your team:\n${workerResults.map((r) => `--- ${r.agentName} ---\n${r.content}`).join('\n\n')}\n\nSynthesize a final comprehensive answer for: "${task.input}"`;
        const synthStart = Date.now();
        const finalContent = await supervisor.chat(sessionId, synthPrompt);
        agentResults.push({
            agentId: supervisor.config.id,
            agentName: supervisor.config.name,
            content: finalContent,
            duration: Date.now() - synthStart,
        });
        return {
            taskId: task.id,
            mode: 'supervisor',
            finalContent,
            agentResults,
            totalDuration: 0,
            rounds: 2,
        };
    }
    selectAgents(task) {
        if (task.requiredAgentIds?.length) {
            return task.requiredAgentIds
                .map((id) => this.agents.get(id))
                .filter((a) => a !== undefined);
        }
        return [...this.agents.values()];
    }
}
//# sourceMappingURL=multi-agent.js.map