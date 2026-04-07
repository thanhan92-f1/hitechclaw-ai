import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

// ─── Node type metadata ────────────────────────────────────

export const NODE_CATALOG: Record<string, {
    icon: string;
    label: string;
    color: string;
    category: 'trigger' | 'ai' | 'logic' | 'data' | 'io';
    description: string;
    configFields: Array<{
        key: string;
        label: string;
        type: 'text' | 'textarea' | 'number' | 'select' | 'code' | 'key-value' | 'cases';
        required?: boolean;
        placeholder?: string;
        options?: Array<{ label: string; value: string }>;
    }>;
}> = {
    'trigger': {
        icon: '⚡', label: 'Trigger', color: '#f59e0b',
        category: 'trigger',
        description: 'Start point of the workflow',
        configFields: [],
    },
    'llm-call': {
        icon: '🤖', label: 'LLM Call', color: '#8b5cf6',
        category: 'ai',
        description: 'Call AI model with a prompt',
        configFields: [
            { key: 'prompt', label: 'Prompt', type: 'textarea', required: true, placeholder: 'Enter your prompt... Use {{variable}} for templates' },
            { key: 'systemPrompt', label: 'System Prompt', type: 'textarea', placeholder: 'Optional system message' },
        ],
    },
    'tool-call': {
        icon: '🔧', label: 'Tool Call', color: '#06b6d4',
        category: 'ai',
        description: 'Invoke a registered tool/skill',
        configFields: [
            { key: 'toolName', label: 'Tool Name', type: 'text', required: true, placeholder: 'e.g. web-search' },
            { key: 'arguments', label: 'Arguments', type: 'key-value', placeholder: 'key=value pairs for tool arguments' },
        ],
    },
    'condition': {
        icon: '🔀', label: 'Condition', color: '#f97316',
        category: 'logic',
        description: 'Branch based on expression (true/false)',
        configFields: [
            { key: 'expression', label: 'Expression (JS)', type: 'code', required: true, placeholder: 'inputs.value > 10' },
        ],
    },
    'switch': {
        icon: '🔁', label: 'Switch', color: '#ec4899',
        category: 'logic',
        description: 'Multi-way branch based on value matching',
        configFields: [
            { key: 'expression', label: 'Expression', type: 'code', required: true, placeholder: 'inputs.status' },
            { key: 'cases', label: 'Cases', type: 'cases', required: true, placeholder: 'value → label' },
        ],
    },
    'loop': {
        icon: '🔄', label: 'Loop', color: '#14b8a6',
        category: 'logic',
        description: 'Iterate over items or repeat with condition',
        configFields: [
            { key: 'maxIterations', label: 'Max Iterations', type: 'number', required: true, placeholder: '10' },
            { key: 'condition', label: 'Exit Condition', type: 'code', placeholder: 'i >= items.length' },
            { key: 'loopVariable', label: 'Variable Name', type: 'text', placeholder: 'i' },
            { key: 'items', label: 'Items (JSON array)', type: 'textarea', placeholder: '["item1", "item2"] or use {{inputs.list}}' },
        ],
    },
    'merge': {
        icon: '🔗', label: 'Merge', color: '#6366f1',
        category: 'logic',
        description: 'Synchronize multiple branches into one',
        configFields: [],
    },
    'transform': {
        icon: '✨', label: 'Transform', color: '#a855f7',
        category: 'data',
        description: 'Transform data with a template',
        configFields: [
            { key: 'template', label: 'Template', type: 'textarea', required: true, placeholder: '{{input.key}}' },
        ],
    },
    'code': {
        icon: '💻', label: 'Code', color: '#22c55e',
        category: 'data',
        description: 'Run JavaScript code in sandbox',
        configFields: [
            { key: 'code', label: 'JavaScript Code', type: 'code', required: true, placeholder: 'return inputs.value * 2;' },
        ],
    },
    'http-request': {
        icon: '🌐', label: 'HTTP Request', color: '#3b82f6',
        category: 'io',
        description: 'Make an HTTP request to external API',
        configFields: [
            { key: 'url', label: 'URL', type: 'text', required: true, placeholder: 'https://api.example.com/data' },
            {
                key: 'method', label: 'Method', type: 'select', options: [
                    { label: 'GET', value: 'GET' }, { label: 'POST', value: 'POST' },
                    { label: 'PUT', value: 'PUT' }, { label: 'DELETE', value: 'DELETE' },
                ]
            },
            { key: 'headers', label: 'Headers', type: 'key-value', placeholder: 'e.g. Authorization: Bearer ...' },
            { key: 'body', label: 'Request Body', type: 'textarea', placeholder: '{"key": "value"}' },
        ],
    },
    'notification': {
        icon: '🔔', label: 'Notification', color: '#eab308',
        category: 'io',
        description: 'Send a notification message',
        configFields: [
            { key: 'message', label: 'Message', type: 'textarea', required: true, placeholder: 'Task {{taskName}} completed!' },
            { key: 'channel', label: 'Channel', type: 'text', placeholder: 'default' },
        ],
    },
    'wait': {
        icon: '⏱️', label: 'Wait', color: '#78716c',
        category: 'logic',
        description: 'Pause execution for a duration',
        configFields: [
            { key: 'seconds', label: 'Seconds', type: 'number', required: true, placeholder: '5' },
        ],
    },
    'memory-read': {
        icon: '📖', label: 'Memory Read', color: '#0ea5e9',
        category: 'data',
        description: 'Read from agent memory',
        configFields: [
            { key: 'query', label: 'Query', type: 'textarea', required: true, placeholder: 'Search query...' },
        ],
    },
    'memory-write': {
        icon: '📝', label: 'Memory Write', color: '#10b981',
        category: 'data',
        description: 'Write to agent memory',
        configFields: [
            { key: 'content', label: 'Content', type: 'textarea', required: true, placeholder: 'Content to memorize...' },
        ],
    },
    'sub-workflow': {
        icon: '📋', label: 'Sub-Workflow', color: '#d946ef',
        category: 'logic',
        description: 'Execute another workflow',
        configFields: [
            { key: 'workflowId', label: 'Workflow ID', type: 'text', required: true, placeholder: 'workflow-id-here' },
        ],
    },
    'output': {
        icon: '📤', label: 'Output', color: '#64748b',
        category: 'io',
        description: 'End point — pass data as workflow result',
        configFields: [],
    },
};

export const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
    trigger: { label: 'Triggers', color: '#f59e0b' },
    ai: { label: 'AI / LLM', color: '#8b5cf6' },
    logic: { label: 'Logic & Flow', color: '#f97316' },
    data: { label: 'Data & Transform', color: '#22c55e' },
    io: { label: 'I/O & Actions', color: '#3b82f6' },
};

// ─── Custom Node Component ─────────────────────────────────

interface WorkflowNodeData {
    label: string;
    description?: string;
    config: Record<string, unknown>;
    nodeType: string;
    [key: string]: unknown;
}

function WorkflowNodeComponent({ data, selected }: NodeProps) {
    const nd = data as unknown as WorkflowNodeData;
    const meta = NODE_CATALOG[nd.nodeType] || NODE_CATALOG['output'];
    const hasInputs = nd.nodeType !== 'trigger';
    const hasOutputs = nd.nodeType !== 'output';
    const isCondition = nd.nodeType === 'condition';

    return (
        <div
            className="rounded-xl shadow-lg min-w-45 max-w-55 transition-all"
            style={{
                background: 'var(--color-bg-surface)',
                border: `2px solid ${selected ? meta.color : 'var(--color-border)'}`,
                boxShadow: selected ? `0 0 0 2px ${meta.color}40` : undefined,
            }}
        >
            {/* Input handle */}
            {hasInputs && (
                <Handle
                    type="target"
                    position={Position.Top}
                    className="workflow-handle"
                    style={{
                        width: 14, height: 14,
                        background: meta.color,
                        border: '3px solid var(--color-bg-surface)',
                        boxShadow: `0 0 0 2px ${meta.color}60`,
                        transition: 'all 0.15s ease',
                    }}
                />
            )}

            {/* Header */}
            <div
                className="flex items-center gap-2 px-3 py-2 rounded-t-[10px]"
                style={{ background: `${meta.color}18` }}
            >
                <span className="text-base">{meta.icon}</span>
                <span className="text-xs font-bold truncate" style={{ color: meta.color }}>
                    {nd.label || meta.label}
                </span>
            </div>

            {/* Body */}
            <div className="px-3 py-2">
                <p className="text-[10px] leading-tight" style={{ color: 'var(--color-fg-muted)' }}>
                    {nd.description || meta.description}
                </p>
                {/* Show key config values */}
                {nd.config && Object.keys(nd.config).length > 0 && (
                    <div className="mt-1.5 space-y-0.5">
                        {Object.entries(nd.config).slice(0, 2).map(([k, v]) => (
                            <div key={k} className="flex items-center gap-1 text-[9px]" style={{ color: 'var(--color-fg-muted)', opacity: 0.7 }}>
                                <span className="font-medium">{k}:</span>
                                <span className="truncate">{String(v).slice(0, 30)}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Output handles */}
            {hasOutputs && !isCondition && (
                <Handle
                    type="source"
                    position={Position.Bottom}
                    className="workflow-handle"
                    style={{
                        width: 14, height: 14,
                        background: meta.color,
                        border: '3px solid var(--color-bg-surface)',
                        boxShadow: `0 0 0 2px ${meta.color}60`,
                        transition: 'all 0.15s ease',
                    }}
                />
            )}
            {/* Condition node: two outputs (true/false) */}
            {isCondition && (
                <>
                    <Handle
                        type="source"
                        position={Position.Bottom}
                        id="true"
                        className="workflow-handle"
                        style={{
                            width: 14, height: 14,
                            background: '#22c55e',
                            border: '3px solid var(--color-bg-surface)',
                            boxShadow: '0 0 0 2px rgba(34,197,94,0.6)',
                            left: '30%',
                            transition: 'all 0.15s ease',
                        }}
                    />
                    <Handle
                        type="source"
                        position={Position.Bottom}
                        id="false"
                        className="workflow-handle"
                        style={{
                            width: 14, height: 14,
                            background: '#ef4444',
                            border: '3px solid var(--color-bg-surface)',
                            boxShadow: '0 0 0 2px rgba(239,68,68,0.6)',
                            left: '70%',
                            transition: 'all 0.15s ease',
                        }}
                    />
                    <div className="flex justify-between px-3 pb-1" style={{ fontSize: 8, color: 'var(--color-fg-muted)' }}>
                        <span style={{ color: '#22c55e' }}>✓ true</span>
                        <span style={{ color: '#ef4444' }}>✗ false</span>
                    </div>
                </>
            )}
        </div>
    );
}

export const MemoizedWorkflowNode = memo(WorkflowNodeComponent);

// Map for React Flow nodeTypes
export const nodeTypes = {
    workflowNode: MemoizedWorkflowNode,
};
