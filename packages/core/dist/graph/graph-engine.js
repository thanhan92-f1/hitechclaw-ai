import { randomUUID } from 'node:crypto';
export class GraphEngine {
    nodes = new Map();
    edges = [];
    entryNodeId;
    addNode(node) {
        this.nodes.set(node.id, node);
        return this;
    }
    addEdge(from, to, condition) {
        this.edges.push({ from, to, condition });
        return this;
    }
    setEntry(nodeId) {
        if (!this.nodes.has(nodeId))
            throw new Error(`Node "${nodeId}" not found`);
        this.entryNodeId = nodeId;
        return this;
    }
    async *execute(initialState, options) {
        if (!this.entryNodeId)
            throw new Error('No entry node set');
        const maxSteps = options?.maxSteps ?? 100;
        const executionId = randomUUID();
        let currentNodeId = this.entryNodeId;
        let state = { ...initialState };
        let steps = 0;
        while (currentNodeId && steps < maxSteps) {
            const node = this.nodes.get(currentNodeId);
            if (!node)
                throw new Error(`Node "${currentNodeId}" not found`);
            const context = {
                nodeId: currentNodeId,
                executionId,
                emit: () => { }, // Can be wired to EventBus
            };
            state = await node.handler(state, context);
            options?.onStep?.(currentNodeId, state);
            yield { nodeId: currentNodeId, state };
            if (node.type === 'end')
                break;
            // Find next node via edges
            const outEdges = this.edges.filter((e) => e.from === currentNodeId);
            currentNodeId = undefined;
            for (const edge of outEdges) {
                if (!edge.condition || edge.condition(state)) {
                    currentNodeId = edge.to;
                    break;
                }
            }
            steps++;
        }
    }
    getNodes() {
        return [...this.nodes.values()];
    }
    getEdges() {
        return [...this.edges];
    }
}
//# sourceMappingURL=graph-engine.js.map