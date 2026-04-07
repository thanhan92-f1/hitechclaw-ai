import { useState, useCallback, useRef, type DragEvent } from 'react';
import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    Panel,
    addEdge,
    useNodesState,
    useEdgesState,
    type Connection,
    type Edge,
    type Node,
    BackgroundVariant,
    MarkerType,
    ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Save, Play, CheckCircle, ArrowLeft, Undo2, Redo2, ZoomIn, AlertTriangle } from 'lucide-react';
import { nodeTypes, NODE_CATALOG } from './nodes';
import { NodePalette } from './palette';
import { ConfigPanel } from './config-panel';

// ─── Types ─────────────────────────────────────────────────

interface WorkflowDef {
    nodes: any[];
    edges: any[];
    variables?: Array<{ name: string; defaultValue?: unknown }>;
    trigger?: any;
}

interface WorkflowEditorProps {
    workflowId: string;
    workflowName: string;
    workflowDescription: string;
    definition: WorkflowDef;
    onSave: (definition: WorkflowDef) => Promise<void>;
    onExecute: () => Promise<void>;
    onValidate: () => Promise<{ valid: boolean; errors: any[] }>;
    onBack: () => void;
}

// ─── Helpers ───────────────────────────────────────────────

let nodeIdCounter = 0;
function getNodeId(type: string) {
    nodeIdCounter++;
    return `${type}-${Date.now()}-${nodeIdCounter}`;
}

function toReactFlowNodes(wfNodes: any[]): Node[] {
    return (wfNodes || []).map((n) => ({
        id: n.id,
        type: 'workflowNode',
        position: n.position || { x: 0, y: 0 },
        data: {
            label: n.data?.label || NODE_CATALOG[n.type]?.label || n.type,
            description: n.data?.description || '',
            config: n.data?.config || {},
            nodeType: n.type,
        },
    }));
}

// Handle IDs that match actual Handle id props in nodes.tsx (condition node outputs)
const KNOWN_HANDLE_IDS = new Set(['true', 'false']);

function toReactFlowEdges(wfEdges: any[]): Edge[] {
    return (wfEdges || []).map((e) => ({
        id: e.id,
        source: e.source,
        sourceHandle: KNOWN_HANDLE_IDS.has(e.sourcePort) ? e.sourcePort : undefined,
        target: e.target,
        targetHandle: KNOWN_HANDLE_IDS.has(e.targetPort) ? e.targetPort : undefined,
        animated: true,
        style: { strokeWidth: 2, stroke: '#6366f1' },
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: '#6366f1' },
        label: e.condition || undefined,
        labelStyle: { fill: 'var(--color-fg-muted)', fontSize: 10 },
        labelBgStyle: { fill: 'var(--color-bg-surface)', stroke: 'var(--color-border)' },
    }));
}

function toWorkflowDef(nodes: Node[], edges: Edge[], variables: any[], trigger: any): WorkflowDef {
    return {
        nodes: nodes.map((n) => ({
            id: n.id,
            type: (n.data as any).nodeType,
            position: n.position,
            data: {
                label: (n.data as any).label,
                description: (n.data as any).description,
                config: (n.data as any).config || {},
            },
            inputs: (n.data as any).nodeType !== 'trigger' ? [{ id: 'in', name: 'input', type: 'any' }] : [],
            outputs: (n.data as any).nodeType !== 'output' ? [{ id: 'out', name: 'output', type: 'any' }] : [],
        })),
        edges: edges.map((e) => ({
            id: e.id,
            source: e.source,
            sourcePort: e.sourceHandle || 'default',
            target: e.target,
            targetPort: e.targetHandle || 'default',
            condition: e.label || undefined,
        })),
        variables,
        trigger,
    };
}

// ─── Editor Component ──────────────────────────────────────

function WorkflowEditorInner({
    workflowId, workflowName, workflowDescription,
    definition, onSave, onExecute, onValidate, onBack,
}: WorkflowEditorProps) {
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const [nodes, setNodes, onNodesChange] = useNodesState(toReactFlowNodes(definition.nodes));
    const [edges, setEdges, onEdgesChange] = useEdgesState(toReactFlowEdges(definition.edges));
    const [variables] = useState(definition.variables || []);
    const [trigger] = useState(definition.trigger || { type: 'manual', config: {} });

    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [validationErrors, setValidationErrors] = useState<any[]>([]);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

    // Undo/Redo stacks
    const [undoStack, setUndoStack] = useState<Array<{ nodes: Node[]; edges: Edge[] }>>([]);
    const [redoStack, setRedoStack] = useState<Array<{ nodes: Node[]; edges: Edge[] }>>([]);

    const pushUndo = useCallback(() => {
        setUndoStack((prev) => [...prev.slice(-30), { nodes: nodes.map((n) => ({ ...n })), edges: edges.map((e) => ({ ...e })) }]);
        setRedoStack([]);
    }, [nodes, edges]);

    const undo = useCallback(() => {
        if (undoStack.length === 0) return;
        const prev = undoStack[undoStack.length - 1];
        setRedoStack((r) => [...r, { nodes: nodes.map((n) => ({ ...n })), edges: edges.map((e) => ({ ...e })) }]);
        setNodes(prev.nodes);
        setEdges(prev.edges);
        setUndoStack((s) => s.slice(0, -1));
    }, [undoStack, nodes, edges, setNodes, setEdges]);

    const redo = useCallback(() => {
        if (redoStack.length === 0) return;
        const next = redoStack[redoStack.length - 1];
        setUndoStack((u) => [...u, { nodes: nodes.map((n) => ({ ...n })), edges: edges.map((e) => ({ ...e })) }]);
        setNodes(next.nodes);
        setEdges(next.edges);
        setRedoStack((r) => r.slice(0, -1));
    }, [redoStack, nodes, edges, setNodes, setEdges]);

    // Connect edges
    const onConnect = useCallback((connection: Connection) => {
        pushUndo();
        setEdges((eds) => addEdge({
            ...connection,
            id: `edge-${Date.now()}`,
            animated: true,
            style: { strokeWidth: 2, stroke: '#6366f1' },
            markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: '#6366f1' },
        }, eds));
    }, [setEdges, pushUndo]);

    // Drop new node from palette
    const onDragOver = useCallback((e: DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback((e: DragEvent) => {
        e.preventDefault();
        const nodeType = e.dataTransfer.getData('application/hitechclaw-node-type');
        if (!nodeType || !NODE_CATALOG[nodeType]) return;
        if (!reactFlowInstance || !reactFlowWrapper.current) return;

        const bounds = reactFlowWrapper.current.getBoundingClientRect();
        const position = reactFlowInstance.screenToFlowPosition({
            x: e.clientX - bounds.left,
            y: e.clientY - bounds.top,
        });

        pushUndo();

        const meta = NODE_CATALOG[nodeType];
        const newNode: Node = {
            id: getNodeId(nodeType),
            type: 'workflowNode',
            position,
            data: {
                label: meta.label,
                description: '',
                config: {},
                nodeType,
            },
        };
        setNodes((nds) => [...nds, newNode]);
    }, [reactFlowInstance, setNodes, pushUndo]);

    // Node selection
    const onNodeClick = useCallback((_: any, node: Node) => {
        setSelectedNodeId(node.id);
    }, []);

    const onPaneClick = useCallback(() => {
        setSelectedNodeId(null);
    }, []);

    // Config panel callbacks
    const handleNodeDataChange = useCallback((nodeId: string, newData: Record<string, unknown>) => {
        setNodes((nds) => nds.map((n) =>
            n.id === nodeId ? { ...n, data: { ...n.data, ...newData } } : n
        ));
    }, [setNodes]);

    const handleNodeDelete = useCallback((nodeId: string) => {
        pushUndo();
        setNodes((nds) => nds.filter((n) => n.id !== nodeId));
        setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
        setSelectedNodeId(null);
    }, [setNodes, setEdges, pushUndo]);

    const handleNodeDuplicate = useCallback((nodeId: string) => {
        pushUndo();
        const node = nodes.find((n) => n.id === nodeId);
        if (!node) return;
        const newNode: Node = {
            ...node,
            id: getNodeId((node.data as any).nodeType),
            position: { x: node.position.x + 30, y: node.position.y + 30 },
            selected: false,
        };
        setNodes((nds) => [...nds, newNode]);
    }, [nodes, setNodes, pushUndo]);

    // Save
    const handleSave = useCallback(async () => {
        setSaving(true);
        setMessage(null);
        try {
            const def = toWorkflowDef(nodes, edges, variables, trigger);
            await onSave(def);
            setMessage({ type: 'success', text: 'Workflow saved!' });
        } catch (err) {
            setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Save failed' });
        } finally {
            setSaving(false);
        }
    }, [nodes, edges, variables, trigger, onSave]);

    // Validate
    const handleValidate = useCallback(async () => {
        setMessage(null);
        try {
            // Save first so validation uses latest definition
            const def = toWorkflowDef(nodes, edges, variables, trigger);
            await onSave(def);
            const result = await onValidate();
            setValidationErrors(result.errors || []);
            if (result.valid) {
                setMessage({ type: 'success', text: 'Workflow is valid!' });
            } else {
                setMessage({ type: 'error', text: `${result.errors?.length || 0} validation issue(s) found` });
            }
        } catch (err) {
            setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Validation failed' });
        }
    }, [nodes, edges, variables, trigger, onSave, onValidate]);

    // Execute
    const handleExecute = useCallback(async () => {
        setMessage(null);
        try {
            await onExecute();
            setMessage({ type: 'success', text: 'Workflow executed!' });
        } catch (err) {
            setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Execution failed' });
        }
    }, [onExecute]);

    // Selected node data
    const selectedNode = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : null;

    return (
        <div className="flex h-full" style={{ background: 'var(--color-bg)' }}>
            {/* Left: Node Palette */}
            <div
                className="w-55 shrink-0 border-r overflow-hidden"
                style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}
            >
                <NodePalette />
            </div>

            {/* Center: Canvas */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Toolbar */}
                <div
                    className="flex items-center gap-2 px-4 h-12 border-b shrink-0"
                    style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}
                >
                    <button
                        onClick={onBack}
                        className="flex items-center gap-1 text-xs cursor-pointer mr-2"
                        style={{ color: 'var(--color-fg-muted)' }}
                    >
                        <ArrowLeft size={14} /> Back
                    </button>
                    <div className="h-4 w-px mx-1" style={{ background: 'var(--color-border)' }} />
                    <div className="flex-1 min-w-0">
                        <span className="text-sm font-bold" style={{ color: 'var(--color-fg)' }}>{workflowName}</span>
                        {workflowDescription && (
                            <span className="text-[10px] ml-2" style={{ color: 'var(--color-fg-muted)' }}>
                                {workflowDescription}
                            </span>
                        )}
                    </div>

                    <button onClick={undo} disabled={undoStack.length === 0}
                        className="p-1.5 rounded cursor-pointer disabled:opacity-30"
                        style={{ color: 'var(--color-fg-muted)' }} title="Undo">
                        <Undo2 size={14} />
                    </button>
                    <button onClick={redo} disabled={redoStack.length === 0}
                        className="p-1.5 rounded cursor-pointer disabled:opacity-30"
                        style={{ color: 'var(--color-fg-muted)' }} title="Redo">
                        <Redo2 size={14} />
                    </button>
                    <div className="h-4 w-px mx-1" style={{ background: 'var(--color-border)' }} />

                    <button onClick={handleValidate}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium cursor-pointer border"
                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-fg-muted)' }}
                    >
                        <CheckCircle size={12} /> Validate
                    </button>
                    <button onClick={handleExecute}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium cursor-pointer"
                        style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}
                    >
                        <Play size={12} /> Run
                    </button>
                    <button onClick={handleSave} disabled={saving}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium cursor-pointer"
                        style={{ background: 'var(--color-primary)', color: '#fff', opacity: saving ? 0.7 : 1 }}
                    >
                        <Save size={12} /> {saving ? 'Saving...' : 'Save'}
                    </button>
                </div>

                {/* Status message */}
                {message && (
                    <div
                        className="px-4 py-2 text-xs flex items-center gap-2"
                        style={{
                            background: message.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                            color: message.type === 'success' ? '#22c55e' : '#ef4444',
                        }}
                    >
                        {message.type === 'success' ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
                        {message.text}
                        <button onClick={() => setMessage(null)} className="ml-auto text-[10px] underline cursor-pointer">dismiss</button>
                    </div>
                )}

                {/* Validation errors */}
                {validationErrors.length > 0 && (
                    <div className="px-4 py-2 text-[10px] space-y-0.5 border-b" style={{ borderColor: 'var(--color-border)', background: 'rgba(239,68,68,0.05)' }}>
                        {validationErrors.map((err, i) => (
                            <div key={i} className="flex items-center gap-1" style={{ color: err.severity === 'error' ? '#ef4444' : '#f59e0b' }}>
                                <AlertTriangle size={10} />
                                <span>{err.message}</span>
                                {err.nodeId && <span className="opacity-50">({err.nodeId})</span>}
                            </div>
                        ))}
                    </div>
                )}

                {/* React Flow canvas */}
                <div className="flex-1" ref={reactFlowWrapper}>
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onNodeClick={onNodeClick}
                        onPaneClick={onPaneClick}
                        onDragOver={onDragOver}
                        onDrop={onDrop}
                        onInit={setReactFlowInstance}
                        nodeTypes={nodeTypes}
                        fitView
                        snapToGrid
                        snapGrid={[16, 16]}
                        connectionLineStyle={{ strokeWidth: 3, stroke: '#a78bfa' }}
                        defaultEdgeOptions={{
                            animated: true,
                            style: { strokeWidth: 2, stroke: '#6366f1' },
                            markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: '#6366f1' },
                        }}
                        proOptions={{ hideAttribution: true }}
                        style={{ background: 'var(--color-bg)' }}
                    >
                        <Background
                            variant={BackgroundVariant.Dots}
                            gap={20}
                            size={1}
                            color="var(--color-border)"
                        />
                        <Controls
                            showInteractive={false}
                            style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', borderRadius: 8 }}
                        />
                        <MiniMap
                            style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', borderRadius: 8 }}
                            nodeColor={(n) => {
                                const t = (n.data as any)?.nodeType;
                                return NODE_CATALOG[t]?.color || '#64748b';
                            }}
                            maskColor="rgba(0,0,0,0.3)"
                        />
                        <Panel position="bottom-center">
                            <div className="text-[10px] px-3 py-1 rounded-full" style={{ background: 'var(--color-bg-surface)', color: 'var(--color-fg-muted)', border: '1px solid var(--color-border)' }}>
                                {nodes.length} nodes · {edges.length} edges
                            </div>
                        </Panel>
                    </ReactFlow>
                </div>
            </div>

            {/* Right: Config Panel */}
            {selectedNode && (
                <div
                    className="w-70 shrink-0 border-l overflow-hidden"
                    style={{ borderColor: 'var(--color-border)' }}
                >
                    <ConfigPanel
                        key={selectedNode.id}
                        nodeId={selectedNode.id}
                        nodeType={(selectedNode.data as any).nodeType}
                        data={{
                            label: (selectedNode.data as any).label,
                            description: (selectedNode.data as any).description,
                            config: (selectedNode.data as any).config || {},
                        }}
                        onChange={handleNodeDataChange}
                        onDelete={handleNodeDelete}
                        onDuplicate={handleNodeDuplicate}
                        onClose={() => setSelectedNodeId(null)}
                    />
                </div>
            )}
        </div>
    );
}

// Wrap with provider
export function WorkflowEditor(props: WorkflowEditorProps) {
    return (
        <ReactFlowProvider>
            <WorkflowEditorInner {...props} />
        </ReactFlowProvider>
    );
}
