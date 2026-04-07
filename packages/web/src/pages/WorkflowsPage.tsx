import {
    Pencil,
    Play,
    Plus,
    RefreshCw,
    ToggleLeft, ToggleRight,
    Trash2,
    Workflow,
    X,
    Zap
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { WorkflowEditor } from '../components/workflow/editor';
import { NODE_CATALOG } from '../components/workflow/nodes';
import {
    createWorkflow, deleteWorkflow,
    executeWorkflow,
    getWorkflow,
    getWorkflows,
    updateWorkflow,
    validateWorkflow,
} from '../lib/api';

// ─── Types ─────────────────────────────────────────────────

interface WorkflowInfo {
    id: string;
    name: string;
    description: string;
    version: number;
    enabled: boolean;
    definition: any;
    createdAt: string;
    updatedAt: string;
}

const DEFAULT_WORKFLOW_DEFINITION = {
    nodes: [
        {
            id: 'trigger-1',
            type: 'trigger',
            position: { x: 300, y: 80 },
            data: { label: 'Start', description: 'Workflow trigger', config: {} },
            inputs: [],
            outputs: [{ id: 'out-1', name: 'output', type: 'any' }],
        },
    ],
    edges: [],
    variables: [],
    trigger: { type: 'manual', config: {} },
};

const DEMO_WORKFLOWS: WorkflowInfo[] = [
    {
        id: 'demo-wf-1', name: 'Customer Support Auto-Reply', description: 'Tự động phân loại và trả lời email hỗ trợ khách hàng', version: 3, enabled: true,
        definition: {
            nodes: [
                { id: 'trigger-1', type: 'trigger', position: { x: 100, y: 80 }, data: { label: 'New Email', description: 'Email received trigger', config: {} }, inputs: [], outputs: [{ id: 'out-1', name: 'output', type: 'any' }] },
                { id: 'llm-1', type: 'llm', position: { x: 300, y: 80 }, data: { label: 'Classify Intent', description: 'Determine customer intent', config: {} }, inputs: [{ id: 'in-1', name: 'input', type: 'any' }], outputs: [{ id: 'out-2', name: 'output', type: 'any' }] },
                { id: 'condition-1', type: 'condition', position: { x: 500, y: 80 }, data: { label: 'Urgency Check', description: 'Branch by priority', config: {} }, inputs: [{ id: 'in-2', name: 'input', type: 'any' }], outputs: [{ id: 'out-3', name: 'true', type: 'any' }, { id: 'out-4', name: 'false', type: 'any' }] },
                { id: 'action-1', type: 'action', position: { x: 700, y: 40 }, data: { label: 'Send Reply', description: 'Auto-reply to customer', config: {} }, inputs: [{ id: 'in-3', name: 'input', type: 'any' }], outputs: [] },
            ],
            edges: [{ id: 'e1', source: 'trigger-1', target: 'llm-1' }, { id: 'e2', source: 'llm-1', target: 'condition-1' }, { id: 'e3', source: 'condition-1', target: 'action-1' }],
            variables: [], trigger: { type: 'webhook', config: {} },
        },
        createdAt: '2026-03-20T08:00:00Z', updatedAt: '2026-03-30T14:22:00Z',
    },
    {
        id: 'demo-wf-2', name: 'Daily Analytics Report', description: 'Tổng hợp dữ liệu analytics và gửi báo cáo hàng ngày qua Slack', version: 2, enabled: true,
        definition: {
            nodes: [
                { id: 'trigger-1', type: 'trigger', position: { x: 100, y: 80 }, data: { label: 'Schedule 8AM', description: 'Daily cron trigger', config: {} }, inputs: [], outputs: [{ id: 'out-1', name: 'output', type: 'any' }] },
                { id: 'action-1', type: 'action', position: { x: 300, y: 80 }, data: { label: 'Fetch Analytics', description: 'Get yesterday metrics', config: {} }, inputs: [{ id: 'in-1', name: 'input', type: 'any' }], outputs: [{ id: 'out-2', name: 'output', type: 'any' }] },
                { id: 'llm-1', type: 'llm', position: { x: 500, y: 80 }, data: { label: 'Summarize', description: 'Generate report summary', config: {} }, inputs: [{ id: 'in-2', name: 'input', type: 'any' }], outputs: [{ id: 'out-3', name: 'output', type: 'any' }] },
                { id: 'action-2', type: 'action', position: { x: 700, y: 80 }, data: { label: 'Send to Slack', description: 'Post report to #analytics', config: {} }, inputs: [{ id: 'in-3', name: 'input', type: 'any' }], outputs: [] },
            ],
            edges: [{ id: 'e1', source: 'trigger-1', target: 'action-1' }, { id: 'e2', source: 'action-1', target: 'llm-1' }, { id: 'e3', source: 'llm-1', target: 'action-2' }],
            variables: [], trigger: { type: 'schedule', config: { cron: '0 8 * * *' } },
        },
        createdAt: '2026-03-15T10:00:00Z', updatedAt: '2026-03-29T09:15:00Z',
    },
    {
        id: 'demo-wf-3', name: 'New User Onboarding', description: 'Gửi email chào mừng và tạo tài khoản mặc định cho người dùng mới', version: 1, enabled: false,
        definition: {
            nodes: [
                { id: 'trigger-1', type: 'trigger', position: { x: 100, y: 80 }, data: { label: 'User Created', description: 'New user webhook', config: {} }, inputs: [], outputs: [{ id: 'out-1', name: 'output', type: 'any' }] },
                { id: 'action-1', type: 'action', position: { x: 350, y: 80 }, data: { label: 'Send Welcome Email', description: 'Personalized welcome', config: {} }, inputs: [{ id: 'in-1', name: 'input', type: 'any' }], outputs: [{ id: 'out-2', name: 'output', type: 'any' }] },
            ],
            edges: [{ id: 'e1', source: 'trigger-1', target: 'action-1' }],
            variables: [], trigger: { type: 'webhook', config: {} },
        },
        createdAt: '2026-03-25T16:00:00Z', updatedAt: '2026-03-25T16:00:00Z',
    },
    {
        id: 'demo-wf-4', name: 'Document Processing Pipeline', description: 'Tự động OCR, trích xuất thông tin và phân loại tài liệu upload', version: 5, enabled: true,
        definition: {
            nodes: [
                { id: 'trigger-1', type: 'trigger', position: { x: 100, y: 80 }, data: { label: 'File Upload', description: 'Document uploaded trigger', config: {} }, inputs: [], outputs: [{ id: 'out-1', name: 'output', type: 'any' }] },
                { id: 'action-1', type: 'action', position: { x: 300, y: 80 }, data: { label: 'OCR Extract', description: 'Extract text from document', config: {} }, inputs: [{ id: 'in-1', name: 'input', type: 'any' }], outputs: [{ id: 'out-2', name: 'output', type: 'any' }] },
                { id: 'llm-1', type: 'llm', position: { x: 500, y: 80 }, data: { label: 'Classify & Extract', description: 'AI classification & entity extraction', config: {} }, inputs: [{ id: 'in-2', name: 'input', type: 'any' }], outputs: [{ id: 'out-3', name: 'output', type: 'any' }] },
                { id: 'condition-1', type: 'condition', position: { x: 700, y: 80 }, data: { label: 'Validation', description: 'Check extraction quality', config: {} }, inputs: [{ id: 'in-3', name: 'input', type: 'any' }], outputs: [{ id: 'out-4', name: 'pass', type: 'any' }, { id: 'out-5', name: 'fail', type: 'any' }] },
                { id: 'action-2', type: 'action', position: { x: 900, y: 40 }, data: { label: 'Save to DB', description: 'Store extracted data', config: {} }, inputs: [{ id: 'in-4', name: 'input', type: 'any' }], outputs: [] },
                { id: 'action-3', type: 'action', position: { x: 900, y: 140 }, data: { label: 'Flag for Review', description: 'Manual review queue', config: {} }, inputs: [{ id: 'in-5', name: 'input', type: 'any' }], outputs: [] },
            ],
            edges: [{ id: 'e1', source: 'trigger-1', target: 'action-1' }, { id: 'e2', source: 'action-1', target: 'llm-1' }, { id: 'e3', source: 'llm-1', target: 'condition-1' }, { id: 'e4', source: 'condition-1', target: 'action-2' }, { id: 'e5', source: 'condition-1', target: 'action-3' }],
            variables: [], trigger: { type: 'webhook', config: {} },
        },
        createdAt: '2026-03-10T12:00:00Z', updatedAt: '2026-03-31T08:45:00Z',
    },
    {
        id: 'demo-wf-5', name: 'Slack Alert on Error', description: 'Theo dõi lỗi hệ thống và gửi cảnh báo qua Slack khi có lỗi nghiêm trọng', version: 1, enabled: true,
        definition: {
            nodes: [
                { id: 'trigger-1', type: 'trigger', position: { x: 100, y: 80 }, data: { label: 'Error Event', description: 'System error trigger', config: {} }, inputs: [], outputs: [{ id: 'out-1', name: 'output', type: 'any' }] },
                { id: 'condition-1', type: 'condition', position: { x: 300, y: 80 }, data: { label: 'Severity >= High', description: 'Filter critical errors', config: {} }, inputs: [{ id: 'in-1', name: 'input', type: 'any' }], outputs: [{ id: 'out-2', name: 'true', type: 'any' }] },
                { id: 'action-1', type: 'action', position: { x: 500, y: 80 }, data: { label: 'Notify Slack', description: 'Send alert to #incidents', config: {} }, inputs: [{ id: 'in-2', name: 'input', type: 'any' }], outputs: [] },
            ],
            edges: [{ id: 'e1', source: 'trigger-1', target: 'condition-1' }, { id: 'e2', source: 'condition-1', target: 'action-1' }],
            variables: [], trigger: { type: 'event', config: { event: 'system.error' } },
        },
        createdAt: '2026-03-28T11:00:00Z', updatedAt: '2026-03-30T16:30:00Z',
    },
];

// ─── Main Page ─────────────────────────────────────────────

export function WorkflowsPage() {
    const [workflows, setWorkflows] = useState<WorkflowInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Create modal
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createForm, setCreateForm] = useState<{ name: string; description: string }>({ name: '', description: '' });
    const [creating, setCreating] = useState(false);

    // Editor mode
    const [editingWorkflow, setEditingWorkflow] = useState<WorkflowInfo | null>(null);
    const [executing, setExecuting] = useState<string | null>(null);

    useEffect(() => { loadWorkflows(); }, []);

    async function loadWorkflows() {
        setLoading(true);
        try {
            const res = await getWorkflows();
            const wfs = res.workflows || [];
            setWorkflows(wfs.length > 0 ? wfs : DEMO_WORKFLOWS);
        } catch {
            setWorkflows(DEMO_WORKFLOWS);
        } finally {
            setLoading(false);
        }
    }

    async function handleCreate() {
        if (!createForm.name.trim()) return;
        setCreating(true);
        setError('');
        try {
            const res = await createWorkflow({
                name: createForm.name,
                description: createForm.description,
                definition: DEFAULT_WORKFLOW_DEFINITION,
            });
            setShowCreateModal(false);
            setCreateForm({ name: '', description: '' });
            // Open in editor immediately
            const created = res.workflow;
            if (created) {
                setEditingWorkflow({
                    ...created,
                    definition: created.definition || DEFAULT_WORKFLOW_DEFINITION,
                });
            } else {
                await loadWorkflows();
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create');
        } finally {
            setCreating(false);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Delete this workflow?')) return;
        try {
            await deleteWorkflow(id);
            setSuccess('Workflow deleted');
            await loadWorkflows();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete');
        }
    }

    async function handleToggle(wf: WorkflowInfo) {
        try {
            await updateWorkflow(wf.id, { enabled: !wf.enabled });
            await loadWorkflows();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to toggle');
        }
    }

    async function handleExecute(wf: WorkflowInfo) {
        setExecuting(wf.id);
        setError('');
        try {
            const result = await executeWorkflow(wf.id);
            if (result.execution?.status === 'completed') {
                setSuccess('Workflow executed successfully!');
            } else if (result.execution?.status === 'failed') {
                setError(`Execution failed: ${result.execution.error || 'Unknown error'}`);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Execution failed');
        } finally {
            setExecuting(null);
        }
    }

    async function handleOpenEditor(wf: WorkflowInfo) {
        try {
            const full = await getWorkflow(wf.id);
            setEditingWorkflow(full.workflow || wf);
        } catch {
            setEditingWorkflow(wf);
        }
    }

    // ─── Editor callbacks ──────────────────────────────────

    const handleEditorSave = useCallback(async (definition: any) => {
        if (!editingWorkflow) return;
        await updateWorkflow(editingWorkflow.id, { definition });
    }, [editingWorkflow]);

    const handleEditorExecute = useCallback(async () => {
        if (!editingWorkflow) return;
        await executeWorkflow(editingWorkflow.id);
    }, [editingWorkflow]);

    const handleEditorValidate = useCallback(async () => {
        if (!editingWorkflow) return { valid: true, errors: [] };
        return await validateWorkflow(editingWorkflow.id);
    }, [editingWorkflow]);

    const handleEditorBack = useCallback(() => {
        setEditingWorkflow(null);
        loadWorkflows();
    }, []);

    // ─── Editor View ───────────────────────────────────────

    if (editingWorkflow) {
        return (
            <div className="h-full">
                <WorkflowEditor
                    workflowId={editingWorkflow.id}
                    workflowName={editingWorkflow.name}
                    workflowDescription={editingWorkflow.description}
                    definition={editingWorkflow.definition || DEFAULT_WORKFLOW_DEFINITION}
                    onSave={handleEditorSave}
                    onExecute={handleEditorExecute}
                    onValidate={handleEditorValidate}
                    onBack={handleEditorBack}
                />
            </div>
        );
    }

    // ─── List View ─────────────────────────────────────────

    const nodeTypeIcons: Record<string, string> = Object.fromEntries(
        Object.entries(NODE_CATALOG).map(([k, v]) => [k, v.icon])
    );

    return (
        <div className="h-full overflow-y-auto p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--color-fg)' }}>
                            <Workflow size={28} style={{ color: 'var(--color-primary)' }} />
                            Workflows
                        </h1>
                        <p className="text-sm mt-1" style={{ color: 'var(--color-fg-muted)' }}>
                            Build and manage automation workflows with a visual drag-and-drop editor
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={loadWorkflows}
                            className="p-2 rounded-lg transition-colors cursor-pointer"
                            style={{ color: 'var(--color-fg-muted)' }} title="Refresh"
                        >
                            <RefreshCw size={18} />
                        </button>
                        <button onClick={() => setShowCreateModal(true)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
                            style={{ background: 'var(--color-primary)', color: '#fff' }}
                        >
                            <Plus size={16} /> New Workflow
                        </button>
                    </div>
                </div>

                {/* Alerts */}
                {error && (
                    <div className="mb-4 px-4 py-3 rounded-lg text-sm flex items-center justify-between" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
                        {error}
                        <button onClick={() => setError('')} className="cursor-pointer"><X size={14} /></button>
                    </div>
                )}
                {success && (
                    <div className="mb-4 px-4 py-3 rounded-lg text-sm flex items-center justify-between" style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>
                        {success}
                        <button onClick={() => setSuccess('')} className="cursor-pointer"><X size={14} /></button>
                    </div>
                )}

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin w-6 h-6 border-2 border-t-transparent rounded-full" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
                    </div>
                ) : workflows.length === 0 ? (
                    <div className="text-center py-20">
                        <Workflow size={48} className="mx-auto mb-4" style={{ color: 'var(--color-fg-muted)', opacity: 0.3 }} />
                        <p className="text-sm" style={{ color: 'var(--color-fg-muted)' }}>No workflows yet</p>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="mt-3 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
                            style={{ background: 'var(--color-primary)', color: '#fff' }}
                        >
                            Create Your First Workflow
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {workflows.map((wf) => (
                            <div
                                key={wf.id}
                                className="rounded-xl border transition-all hover:shadow-lg group relative"
                                style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}
                            >
                                {/* Card header - clickable to open editor */}
                                <div
                                    className="p-5 cursor-pointer"
                                    onClick={() => handleOpenEditor(wf)}
                                >
                                    <div className="flex items-center gap-2 mb-2">
                                        <Zap size={16} style={{ color: wf.enabled ? 'var(--color-primary)' : 'var(--color-fg-muted)' }} />
                                        <h3 className="font-semibold truncate flex-1" style={{ color: 'var(--color-fg)' }}>{wf.name}</h3>
                                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0"
                                            style={{ background: 'var(--color-bg-soft)', color: 'var(--color-fg-muted)' }}>
                                            v{wf.version}
                                        </span>
                                    </div>
                                    {wf.description && (
                                        <p className="text-xs truncate mb-2" style={{ color: 'var(--color-fg-muted)' }}>{wf.description}</p>
                                    )}
                                    <div className="flex items-center gap-3 text-[10px] mb-2" style={{ color: 'var(--color-fg-muted)' }}>
                                        <span>{wf.definition?.nodes?.length || 0} nodes</span>
                                        <span>{wf.definition?.edges?.length || 0} edges</span>
                                    </div>
                                    {/* Node type badges */}
                                    {wf.definition?.nodes?.length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                            {Array.from(new Set((wf.definition.nodes as any[]).map((n: any) => n.type))).slice(0, 5).map((type: string) => (
                                                <span key={type} className="text-[10px] px-1.5 py-0.5 rounded"
                                                    style={{ background: 'var(--color-bg-soft)', color: 'var(--color-fg-muted)' }}>
                                                    {nodeTypeIcons[type] || '📦'} {type}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Card footer with actions */}
                                <div
                                    className="flex items-center justify-between px-4 py-2.5 border-t"
                                    style={{ borderColor: 'var(--color-border)' }}
                                >
                                    <span className="text-[10px]" style={{ color: 'var(--color-fg-muted)' }}>
                                        {new Date(wf.updatedAt).toLocaleDateString()}
                                    </span>
                                    <div className="flex items-center gap-0.5">
                                        <button onClick={() => handleOpenEditor(wf)}
                                            className="p-1.5 rounded-lg cursor-pointer" title="Edit"
                                            style={{ color: 'var(--color-primary)' }}>
                                            <Pencil size={14} />
                                        </button>
                                        <button onClick={() => handleToggle(wf)}
                                            className="p-1.5 rounded-lg cursor-pointer"
                                            title={wf.enabled ? 'Disable' : 'Enable'}
                                            style={{ color: wf.enabled ? '#22c55e' : '#9ca3af' }}>
                                            {wf.enabled ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                                        </button>
                                        <button onClick={() => handleExecute(wf)}
                                            disabled={executing === wf.id}
                                            className="p-1.5 rounded-lg cursor-pointer"
                                            title="Execute"
                                            style={{ color: 'var(--color-primary)', opacity: executing === wf.id ? 0.5 : 1 }}>
                                            {executing === wf.id ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
                                        </button>
                                        <button onClick={() => handleDelete(wf.id)}
                                            className="p-1.5 rounded-lg cursor-pointer" title="Delete" style={{ color: '#ef4444' }}>
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Create Modal */}
                {showCreateModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
                        <div
                            className="rounded-2xl p-6 w-full max-w-md mx-4"
                            style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)' }}
                        >
                            <div className="flex items-center justify-between mb-5">
                                <h2 className="text-lg font-bold" style={{ color: 'var(--color-fg)' }}>New Workflow</h2>
                                <button onClick={() => setShowCreateModal(false)} className="cursor-pointer" style={{ color: 'var(--color-fg-muted)' }}>
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-fg-muted)' }}>
                                        Name <span style={{ color: '#ef4444' }}>*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={createForm.name}
                                        onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                                        placeholder="e.g. Auto-respond to emails"
                                        className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                                        style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-fg-muted)' }}>Description</label>
                                    <textarea
                                        value={createForm.description}
                                        onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                                        placeholder="What does this workflow do?"
                                        rows={3}
                                        className="w-full px-3 py-2 rounded-lg text-sm border outline-none resize-none"
                                        style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button onClick={() => setShowCreateModal(false)}
                                    className="flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer border"
                                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-fg-muted)' }}>
                                    Cancel
                                </button>
                                <button onClick={handleCreate}
                                    disabled={creating || !createForm.name.trim()}
                                    className="flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer"
                                    style={{ background: 'var(--color-primary)', color: '#fff', opacity: creating ? 0.7 : 1 }}>
                                    {creating ? 'Creating...' : 'Create & Edit'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
