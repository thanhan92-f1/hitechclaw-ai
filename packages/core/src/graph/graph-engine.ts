import { randomUUID } from 'node:crypto';

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

export class GraphEngine {
  private nodes = new Map<string, GraphNode>();
  private edges: GraphEdge[] = [];
  private entryNodeId?: string;

  addNode(node: GraphNode): this {
    this.nodes.set(node.id, node);
    return this;
  }

  addEdge(from: string, to: string, condition?: (state: GraphState) => boolean): this {
    this.edges.push({ from, to, condition });
    return this;
  }

  setEntry(nodeId: string): this {
    if (!this.nodes.has(nodeId)) throw new Error(`Node "${nodeId}" not found`);
    this.entryNodeId = nodeId;
    return this;
  }

  async *execute(
    initialState: GraphState,
    options?: { maxSteps?: number; onStep?: (nodeId: string, state: GraphState) => void },
  ): AsyncGenerator<{ nodeId: string; state: GraphState }> {
    if (!this.entryNodeId) throw new Error('No entry node set');

    const maxSteps = options?.maxSteps ?? 100;
    const executionId = randomUUID();
    let currentNodeId: string | undefined = this.entryNodeId;
    let state = { ...initialState };
    let steps = 0;

    while (currentNodeId && steps < maxSteps) {
      const node = this.nodes.get(currentNodeId);
      if (!node) throw new Error(`Node "${currentNodeId}" not found`);

      const context: GraphContext = {
        nodeId: currentNodeId,
        executionId,
        emit: () => {}, // Can be wired to EventBus
      };

      state = await node.handler(state, context);
      options?.onStep?.(currentNodeId, state);
      yield { nodeId: currentNodeId, state };

      if (node.type === 'end') break;

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

  getNodes(): GraphNode[] {
    return [...this.nodes.values()];
  }

  getEdges(): GraphEdge[] {
    return [...this.edges];
  }
}
