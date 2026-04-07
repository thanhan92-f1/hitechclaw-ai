export type NodeType = 'start' | 'llm' | 'tool' | 'condition' | 'human-input' | 'end' | 'custom';
export interface GraphNode {
    id: string;
    type: NodeType;
    handler: (state: GraphState, context: GraphContext) => Promise<GraphState>;
}
export interface GraphEdge {
    from: string;
    to: string;
    condition?: (state: GraphState) => boolean;
}
export interface GraphState {
    [key: string]: unknown;
}
export interface GraphContext {
    nodeId: string;
    executionId: string;
    emit: (event: string, data: unknown) => void;
}
export declare class GraphEngine {
    private nodes;
    private edges;
    private entryNodeId?;
    addNode(node: GraphNode): this;
    addEdge(from: string, to: string, condition?: (state: GraphState) => boolean): this;
    setEntry(nodeId: string): this;
    execute(initialState: GraphState, options?: {
        maxSteps?: number;
        onStep?: (nodeId: string, state: GraphState) => void;
    }): AsyncGenerator<{
        nodeId: string;
        state: GraphState;
    }>;
    getNodes(): GraphNode[];
    getEdges(): GraphEdge[];
}
//# sourceMappingURL=graph-engine.d.ts.map