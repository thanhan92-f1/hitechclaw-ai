import { useState, useEffect, useMemo } from 'react';
import {
    Bot, Plus, Trash2, Edit3, Star, RefreshCw, X,
    Image, Mic, Zap, Shield, BrainCircuit, Save, ChevronDown,
} from 'lucide-react';
import {
    getAgentConfigs, createAgentConfig, updateAgentConfig, deleteAgentConfig,
    getModels,
} from '../lib/api';

interface AgentConfigData {
    _id: string;
    name: string;
    persona: string;
    systemPrompt: string;
    llmConfig: {
        provider: string;
        model: string;
        temperature?: number;
        maxTokens?: number;
        capabilities?: {
            vision?: boolean;
            audio?: boolean;
            streaming?: boolean;
            functionCalling?: boolean;
        };
    };
    enabledSkills: string[];
    memoryConfig: { enabled: boolean; maxEntries: number };
    securityConfig: { requireApprovalForShell: boolean; requireApprovalForNetwork: boolean };
    maxToolIterations: number;
    toolTimeout: number;
    isDefault: boolean;
    createdAt: string;
    updatedAt: string;
}

const PROVIDERS = [
    { id: 'openai', name: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o1', 'o1-mini'] },
    { id: 'anthropic', name: 'Anthropic', models: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'] },
    { id: 'google', name: 'Google', models: ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-pro', 'gemini-1.5-flash'] },
    { id: 'groq', name: 'Groq', models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'] },
    { id: 'mistral', name: 'Mistral', models: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest'] },
    { id: 'ollama', name: 'Ollama (Local)', models: ['qwen2.5:14b', 'qwen2.5:7b', 'qwen2.5:3b', 'llama3.2', 'llama3.1', 'mistral', 'codellama', 'phi3', 'gemma', 'deepseek-r1'] },
    { id: 'custom', name: 'Custom', models: [] },
];

const OLLAMA_CURATED_MODELS = [
    'qwen2.5:14b',
    'qwen2.5:7b',
    'qwen2.5-coder:14b',
    'qwen2.5vl:7b',
    'qwen2.5vl:3b',
    'llava:13b',
    'llava:7b',
    'llama3.2-vision:11b',
    'moondream:1.8b',
    'deepseek-r1:14b',
    'deepseek-r1:8b',
    'llama3.3:70b-instruct-q4_K_M',
    'llama3.2:3b',
    'llama3.2:1b',
    'gemma3:12b',
    'gemma3:4b',
    'mistral-small:24b',
    'phi4-mini:3.8b',
    'nomic-embed-text',
];

const OLLAMA_MODERN_HINTS = [
    { model: 'qwen2.5:14b', note: 'Best balance Vietnamese + tools' },
    { model: 'qwen2.5vl:7b', note: '👁️ Vision — analyze images + Vietnamese' },
    { model: 'llava:13b', note: '👁️ Vision — strong image understanding' },
    { model: 'llama3.2-vision:11b', note: '👁️ Vision — Meta multimodal model' },
    { model: 'deepseek-r1:14b', note: 'Strong reasoning, slower' },
    { model: 'llama3.2:3b', note: 'Fast on laptop' },
    { model: 'qwen2.5-coder:14b', note: 'Coding-focused tasks' },
    { model: 'gemma3:12b', note: 'Modern compact general model' },
];

const MODEL_CAPABILITIES: Record<string, { vision?: boolean; audio?: boolean; streaming?: boolean; functionCalling?: boolean }> = {
    'gpt-4o': { vision: true, audio: true, streaming: true, functionCalling: true },
    'gpt-4o-mini': { vision: true, streaming: true, functionCalling: true },
    'gpt-4-turbo': { vision: true, streaming: true, functionCalling: true },
    'gpt-3.5-turbo': { streaming: true, functionCalling: true },
    'o1': { vision: true, functionCalling: true },
    'o1-mini': { functionCalling: true },
    'claude-sonnet-4-20250514': { vision: true, streaming: true, functionCalling: true },
    'claude-3-5-haiku-20241022': { vision: true, streaming: true, functionCalling: true },
    'claude-3-opus-20240229': { vision: true, streaming: true, functionCalling: true },
    'gemini-2.0-flash': { vision: true, audio: true, streaming: true, functionCalling: true },
    'gemini-2.0-flash-lite': { vision: true, streaming: true, functionCalling: true },
    'gemini-1.5-pro': { vision: true, audio: true, streaming: true, functionCalling: true },
    'gemini-1.5-flash': { vision: true, streaming: true, functionCalling: true },
    'llama-3.3-70b-versatile': { streaming: true, functionCalling: true },
    'llama-3.1-8b-instant': { streaming: true },
    'mixtral-8x7b-32768': { streaming: true },
    'mistral-large-latest': { streaming: true, functionCalling: true },
    // Ollama vision models
    'qwen2.5vl:7b': { vision: true, streaming: true, functionCalling: true },
    'qwen2.5vl:3b': { vision: true, streaming: true },
    'llava:13b': { vision: true, streaming: true },
    'llava:7b': { vision: true, streaming: true },
    'llama3.2-vision:11b': { vision: true, streaming: true },
    'moondream:1.8b': { vision: true, streaming: true },
};

type FormData = {
    name: string;
    persona: string;
    systemPrompt: string;
    provider: string;
    model: string;
    customModel: string;
    temperature: number;
    maxTokens: number;
    capabilities: { vision: boolean; audio: boolean; streaming: boolean; functionCalling: boolean };
    memoryEnabled: boolean;
    memoryMaxEntries: number;
    requireApprovalForShell: boolean;
    requireApprovalForNetwork: boolean;
    maxToolIterations: number;
    toolTimeout: number;
    isDefault: boolean;
};

const DEFAULT_FORM: FormData = {
    name: '',
    persona: '',
    systemPrompt: '',
    provider: 'ollama',
    model: 'qwen2.5:14b',
    customModel: '',
    temperature: 0.7,
    maxTokens: 4096,
    capabilities: { vision: true, audio: true, streaming: true, functionCalling: true },
    memoryEnabled: true,
    memoryMaxEntries: 100,
    requireApprovalForShell: true,
    requireApprovalForNetwork: false,
    maxToolIterations: 10,
    toolTimeout: 30000,
    isDefault: false,
};

function CapabilityBadge({ icon: Icon, label, active }: { icon: typeof Image; label: string; active: boolean }) {
    return (
        <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
            style={{
                background: active ? 'rgba(34,197,94,0.15)' : 'rgba(156,163,175,0.1)',
                color: active ? '#22c55e' : '#6b7280',
            }}
        >
            <Icon size={11} />
            {label}
        </span>
    );
}

export function AgentsPage() {
    const [configs, setConfigs] = useState<AgentConfigData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Modal
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<FormData>({ ...DEFAULT_FORM });
    const [saving, setSaving] = useState(false);
    const [advancedOpen, setAdvancedOpen] = useState(false);
    const [ollamaInstalledModels, setOllamaInstalledModels] = useState<string[]>([]);

    useEffect(() => {
        loadData();
        loadOllamaModels();
    }, []);

    async function loadData() {
        setLoading(true);
        try {
            const res = await getAgentConfigs();
            setConfigs(res.configs || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load agent configs');
        } finally {
            setLoading(false);
        }
    }

    async function loadOllamaModels() {
        try {
            const data = await getModels() as { models?: Array<{ name?: string }> };
            const installed = (data.models || [])
                .map((m) => m.name)
                .filter((name): name is string => !!name && name.trim().length > 0);
            setOllamaInstalledModels(installed);
        } catch {
            // Ollama may be offline; keep curated fallback list.
            setOllamaInstalledModels([]);
        }
    }

    function openCreate() {
        setEditingId(null);
        setForm({ ...DEFAULT_FORM });
        setAdvancedOpen(false);
        setShowModal(true);
    }

    function openEdit(config: AgentConfigData) {
        setEditingId(config._id);
        const caps = config.llmConfig.capabilities || MODEL_CAPABILITIES[config.llmConfig.model] || {};
        setForm({
            name: config.name,
            persona: config.persona,
            systemPrompt: config.systemPrompt,
            provider: config.llmConfig.provider || 'ollama',
            model: config.llmConfig.model || 'qwen2.5:14b',
            customModel: '',
            temperature: config.llmConfig.temperature ?? 0.7,
            maxTokens: config.llmConfig.maxTokens ?? 4096,
            capabilities: {
                vision: caps.vision ?? false,
                audio: caps.audio ?? false,
                streaming: caps.streaming ?? true,
                functionCalling: caps.functionCalling ?? true,
            },
            memoryEnabled: config.memoryConfig?.enabled ?? true,
            memoryMaxEntries: config.memoryConfig?.maxEntries ?? 100,
            requireApprovalForShell: config.securityConfig?.requireApprovalForShell ?? true,
            requireApprovalForNetwork: config.securityConfig?.requireApprovalForNetwork ?? false,
            maxToolIterations: config.maxToolIterations ?? 10,
            toolTimeout: config.toolTimeout ?? 30000,
            isDefault: config.isDefault,
        });
        setAdvancedOpen(false);
        setShowModal(true);
    }

    async function handleSave() {
        if (!form.name.trim()) { setError('Name is required'); return; }
        setSaving(true);
        setError('');
        try {
            const payload = {
                name: form.name.trim(),
                persona: form.persona,
                systemPrompt: form.systemPrompt,
                llmConfig: {
                    provider: form.provider,
                    model: form.provider === 'custom' ? form.customModel : form.model,
                    temperature: form.temperature,
                    maxTokens: form.maxTokens,
                    capabilities: form.capabilities,
                },
                memoryConfig: { enabled: form.memoryEnabled, maxEntries: form.memoryMaxEntries },
                securityConfig: { requireApprovalForShell: form.requireApprovalForShell, requireApprovalForNetwork: form.requireApprovalForNetwork },
                maxToolIterations: form.maxToolIterations,
                toolTimeout: form.toolTimeout,
                isDefault: form.isDefault,
            };

            if (editingId) {
                await updateAgentConfig(editingId, payload);
                setSuccess('Agent updated');
            } else {
                await createAgentConfig(payload);
                setSuccess('Agent created');
            }
            setShowModal(false);
            await loadData();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save');
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Delete this agent configuration?')) return;
        try {
            await deleteAgentConfig(id);
            setSuccess('Agent deleted');
            await loadData();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete');
        }
    }

    async function handleSetDefault(id: string) {
        try {
            await updateAgentConfig(id, { isDefault: true });
            setSuccess('Default agent updated');
            await loadData();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed');
        }
    }

    function onProviderChange(provider: string) {
        const p = PROVIDERS.find((pr) => pr.id === provider);
        const model = provider === 'ollama'
            ? ollamaModelOptions[0] || ''
            : (p?.models[0] || '');
        const caps = MODEL_CAPABILITIES[model] || {};
        setForm({
            ...form,
            provider,
            model,
            capabilities: {
                vision: caps.vision ?? false,
                audio: caps.audio ?? false,
                streaming: caps.streaming ?? true,
                functionCalling: caps.functionCalling ?? false,
            },
        });
    }

    function onModelChange(model: string) {
        const caps = MODEL_CAPABILITIES[model] || {};
        setForm({
            ...form,
            model,
            capabilities: {
                vision: caps.vision ?? false,
                audio: caps.audio ?? false,
                streaming: caps.streaming ?? true,
                functionCalling: caps.functionCalling ?? false,
            },
        });
    }

    const currentProvider = PROVIDERS.find((p) => p.id === form.provider);
    const ollamaModelOptions = useMemo(() => {
        const merged = new Set<string>();
        for (const name of ollamaInstalledModels) merged.add(name);
        for (const name of OLLAMA_CURATED_MODELS) merged.add(name);
        return Array.from(merged);
    }, [ollamaInstalledModels]);

    const modelOptions = form.provider === 'ollama'
        ? ollamaModelOptions
        : (currentProvider?.models || []);

    return (
        <div className="h-full overflow-y-auto p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--color-fg)' }}>
                            <Bot size={28} style={{ color: 'var(--color-primary)' }} />
                            AI Agents
                        </h1>
                        <p className="text-sm mt-1" style={{ color: 'var(--color-fg-muted)' }}>
                            Create and manage AI agent configurations — persona, model, memory, and capabilities
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={loadData}
                            className="p-2 rounded-lg transition-colors cursor-pointer"
                            style={{ color: 'var(--color-fg-muted)' }}
                            title="Refresh"
                        >
                            <RefreshCw size={18} />
                        </button>
                        <button
                            onClick={openCreate}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
                            style={{ background: 'var(--color-primary)', color: '#fff' }}
                        >
                            <Plus size={16} /> New Agent
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
                ) : configs.length === 0 ? (
                    <div className="text-center py-20">
                        <Bot size={48} className="mx-auto mb-4" style={{ color: 'var(--color-fg-muted)', opacity: 0.4 }} />
                        <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-fg)' }}>No agents yet</h3>
                        <p className="text-sm mb-4" style={{ color: 'var(--color-fg-muted)' }}>
                            Create your first AI agent to get started
                        </p>
                        <button
                            onClick={openCreate}
                            className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
                            style={{ background: 'var(--color-primary)', color: '#fff' }}
                        >
                            <Plus size={14} className="inline mr-1" /> Create Agent
                        </button>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {configs.map((config) => {
                            const caps = config.llmConfig.capabilities || MODEL_CAPABILITIES[config.llmConfig.model] || {};
                            return (
                                <div
                                    key={config._id}
                                    className="rounded-xl p-5 border"
                                    style={{ background: 'var(--color-bg-surface)', borderColor: config.isDefault ? 'var(--color-primary)' : 'var(--color-border)' }}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-semibold text-lg" style={{ color: 'var(--color-fg)' }}>{config.name}</h3>
                                                {config.isDefault && (
                                                    <span className="text-[11px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1"
                                                        style={{ background: 'rgba(251,191,36,0.15)', color: '#f59e0b' }}>
                                                        <Star size={10} /> Default
                                                    </span>
                                                )}
                                            </div>
                                            {config.persona && (
                                                <p className="text-xs mb-2 truncate" style={{ color: 'var(--color-fg-muted)' }}>
                                                    {config.persona}
                                                </p>
                                            )}
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                                                    style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary-light)' }}>
                                                    {config.llmConfig.provider}/{config.llmConfig.model}
                                                </span>
                                                <span className="text-[10px]" style={{ color: 'var(--color-fg-muted)' }}>
                                                    temp: {config.llmConfig.temperature ?? 0.7}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <CapabilityBadge icon={Image} label="Vision" active={!!caps.vision} />
                                                <CapabilityBadge icon={Mic} label="Audio" active={!!caps.audio} />
                                                <CapabilityBadge icon={Zap} label="Streaming" active={!!caps.streaming} />
                                                <CapabilityBadge icon={BrainCircuit} label="Tools" active={!!caps.functionCalling} />
                                                {config.memoryConfig?.enabled && (
                                                    <span className="text-[11px] px-2 py-0.5 rounded-full"
                                                        style={{ background: 'rgba(139,92,246,0.12)', color: '#8b5cf6' }}>
                                                        Memory ({config.memoryConfig.maxEntries})
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 ml-3">
                                            {!config.isDefault && (
                                                <button
                                                    onClick={() => handleSetDefault(config._id)}
                                                    className="p-2 rounded-lg transition-colors cursor-pointer"
                                                    style={{ color: 'var(--color-fg-muted)' }}
                                                    title="Set as default"
                                                >
                                                    <Star size={16} />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => openEdit(config)}
                                                className="p-2 rounded-lg transition-colors cursor-pointer"
                                                style={{ color: 'var(--color-fg-muted)' }}
                                                title="Edit"
                                            >
                                                <Edit3 size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(config._id)}
                                                className="p-2 rounded-lg transition-colors cursor-pointer"
                                                style={{ color: '#ef4444' }}
                                                title="Delete"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 mt-3 pt-3 border-t text-[10px]" style={{ borderColor: 'var(--color-border)', color: 'var(--color-fg-muted)' }}>
                                        <span>Created {new Date(config.createdAt).toLocaleDateString()}</span>
                                        <span>Updated {new Date(config.updatedAt).toLocaleDateString()}</span>
                                        {config.enabledSkills.length > 0 && <span>{config.enabledSkills.length} skills</span>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Create/Edit Modal */}
                {showModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
                        <div
                            className="rounded-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto"
                            style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)' }}
                        >
                            <div className="sticky top-0 z-10 flex items-center justify-between p-6 pb-4 border-b"
                                style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                                <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--color-fg)' }}>
                                    <Bot size={20} style={{ color: 'var(--color-primary)' }} />
                                    {editingId ? 'Edit Agent' : 'New Agent'}
                                </h2>
                                <button onClick={() => setShowModal(false)} className="cursor-pointer" style={{ color: 'var(--color-fg-muted)' }}>
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="p-6 space-y-5">
                                {/* Name */}
                                <div>
                                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-fg-muted)' }}>
                                        Name <span style={{ color: '#ef4444' }}>*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        placeholder="e.g. Customer Support Agent"
                                        className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                                        style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                                    />
                                </div>

                                {/* Persona */}
                                <div>
                                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-fg-muted)' }}>Persona</label>
                                    <input
                                        type="text"
                                        value={form.persona}
                                        onChange={(e) => setForm({ ...form, persona: e.target.value })}
                                        placeholder="e.g. Friendly and helpful assistant"
                                        className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                                        style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                                    />
                                </div>

                                {/* System Prompt */}
                                <div>
                                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-fg-muted)' }}>System Prompt</label>
                                    <textarea
                                        value={form.systemPrompt}
                                        onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
                                        placeholder="Instructions for the agent..."
                                        rows={4}
                                        className="w-full px-3 py-2 rounded-lg text-sm border outline-none resize-y"
                                        style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                                    />
                                </div>

                                {/* LLM Config */}
                                <div className="rounded-xl p-4 border" style={{ borderColor: 'var(--color-border)' }}>
                                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--color-fg)' }}>
                                        <BrainCircuit size={16} style={{ color: 'var(--color-primary)' }} />
                                        Model Configuration
                                    </h3>

                                    <div className="grid grid-cols-2 gap-3">
                                        {/* Provider */}
                                        <div>
                                            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-fg-muted)' }}>Provider</label>
                                            <select
                                                value={form.provider}
                                                onChange={(e) => onProviderChange(e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                                                style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                                            >
                                                {PROVIDERS.map((p) => (
                                                    <option key={p.id} value={p.id}>{p.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Model */}
                                        <div>
                                            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-fg-muted)' }}>Model</label>
                                            {form.provider === 'custom' ? (
                                                <input
                                                    type="text"
                                                    value={form.customModel}
                                                    onChange={(e) => setForm({ ...form, customModel: e.target.value })}
                                                    placeholder="model-name"
                                                    className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                                                    style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                                                />
                                            ) : (
                                                <select
                                                    value={form.model}
                                                    onChange={(e) => onModelChange(e.target.value)}
                                                    className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                                                    style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                                                >
                                                    {modelOptions.map((m) => (
                                                        <option key={m} value={m}>{m}</option>
                                                    ))}
                                                </select>
                                            )}
                                            {form.provider === 'ollama' && (
                                                <p className="mt-1 text-[11px]" style={{ color: 'var(--color-fg-muted)' }}>
                                                    Installed: {ollamaInstalledModels.length} | Curated modern models included for quick testing.
                                                </p>
                                            )}
                                        </div>

                                        {/* Temperature */}
                                        <div>
                                            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-fg-muted)' }}>
                                                Temperature: {form.temperature}
                                            </label>
                                            <input
                                                type="range"
                                                min="0" max="2" step="0.1"
                                                value={form.temperature}
                                                onChange={(e) => setForm({ ...form, temperature: parseFloat(e.target.value) })}
                                                className="w-full"
                                            />
                                        </div>

                                        {/* Max Tokens */}
                                        <div>
                                            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-fg-muted)' }}>Max Tokens</label>
                                            <input
                                                type="number"
                                                value={form.maxTokens}
                                                onChange={(e) => setForm({ ...form, maxTokens: parseInt(e.target.value) || 4096 })}
                                                className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                                                style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                                            />
                                        </div>
                                    </div>

                                    {/* Capabilities badges */}
                                    {form.provider === 'ollama' && (
                                        <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                                            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--color-fg-muted)' }}>
                                                Modern Ollama Picks
                                            </label>
                                            <div className="flex flex-wrap gap-2">
                                                {OLLAMA_MODERN_HINTS.map((item) => (
                                                    <button
                                                        key={item.model}
                                                        type="button"
                                                        onClick={() => onModelChange(item.model)}
                                                        className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-medium cursor-pointer border transition-colors"
                                                        style={{
                                                            background: form.model === item.model ? 'var(--color-primary-soft)' : 'transparent',
                                                            borderColor: form.model === item.model ? 'var(--color-primary)' : 'var(--color-border)',
                                                            color: form.model === item.model ? 'var(--color-primary-light)' : 'var(--color-fg-muted)',
                                                        }}
                                                        title={item.note}
                                                    >
                                                        {item.model}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                                        <label className="block text-xs font-medium mb-2" style={{ color: 'var(--color-fg-muted)' }}>Model Capabilities</label>
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setForm({ ...form, capabilities: { ...form.capabilities, vision: !form.capabilities.vision } })}
                                                className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium cursor-pointer border transition-colors"
                                                style={{
                                                    background: form.capabilities.vision ? 'rgba(34,197,94,0.15)' : 'transparent',
                                                    borderColor: form.capabilities.vision ? '#22c55e' : 'var(--color-border)',
                                                    color: form.capabilities.vision ? '#22c55e' : 'var(--color-fg-muted)',
                                                }}
                                            >
                                                <Image size={12} /> Vision
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setForm({ ...form, capabilities: { ...form.capabilities, audio: !form.capabilities.audio } })}
                                                className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium cursor-pointer border transition-colors"
                                                style={{
                                                    background: form.capabilities.audio ? 'rgba(34,197,94,0.15)' : 'transparent',
                                                    borderColor: form.capabilities.audio ? '#22c55e' : 'var(--color-border)',
                                                    color: form.capabilities.audio ? '#22c55e' : 'var(--color-fg-muted)',
                                                }}
                                            >
                                                <Mic size={12} /> Audio
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setForm({ ...form, capabilities: { ...form.capabilities, streaming: !form.capabilities.streaming } })}
                                                className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium cursor-pointer border transition-colors"
                                                style={{
                                                    background: form.capabilities.streaming ? 'rgba(34,197,94,0.15)' : 'transparent',
                                                    borderColor: form.capabilities.streaming ? '#22c55e' : 'var(--color-border)',
                                                    color: form.capabilities.streaming ? '#22c55e' : 'var(--color-fg-muted)',
                                                }}
                                            >
                                                <Zap size={12} /> Streaming
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setForm({ ...form, capabilities: { ...form.capabilities, functionCalling: !form.capabilities.functionCalling } })}
                                                className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium cursor-pointer border transition-colors"
                                                style={{
                                                    background: form.capabilities.functionCalling ? 'rgba(34,197,94,0.15)' : 'transparent',
                                                    borderColor: form.capabilities.functionCalling ? '#22c55e' : 'var(--color-border)',
                                                    color: form.capabilities.functionCalling ? '#22c55e' : 'var(--color-fg-muted)',
                                                }}
                                            >
                                                <BrainCircuit size={12} /> Function Calling
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Memory & Security */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="rounded-xl p-4 border" style={{ borderColor: 'var(--color-border)' }}>
                                        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-fg)' }}>Memory</h3>
                                        <label className="flex items-center gap-2 text-xs cursor-pointer mb-2" style={{ color: 'var(--color-fg-muted)' }}>
                                            <input
                                                type="checkbox"
                                                checked={form.memoryEnabled}
                                                onChange={(e) => setForm({ ...form, memoryEnabled: e.target.checked })}
                                                className="rounded"
                                            />
                                            Enable memory
                                        </label>
                                        {form.memoryEnabled && (
                                            <div>
                                                <label className="block text-[10px] mb-1" style={{ color: 'var(--color-fg-muted)' }}>Max entries</label>
                                                <input
                                                    type="number"
                                                    value={form.memoryMaxEntries}
                                                    onChange={(e) => setForm({ ...form, memoryMaxEntries: parseInt(e.target.value) || 100 })}
                                                    className="w-full px-2 py-1 rounded-lg text-xs border outline-none"
                                                    style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <div className="rounded-xl p-4 border" style={{ borderColor: 'var(--color-border)' }}>
                                        <h3 className="text-sm font-semibold mb-3 flex items-center gap-1" style={{ color: 'var(--color-fg)' }}>
                                            <Shield size={14} /> Security
                                        </h3>
                                        <label className="flex items-center gap-2 text-xs cursor-pointer mb-2" style={{ color: 'var(--color-fg-muted)' }}>
                                            <input
                                                type="checkbox"
                                                checked={form.requireApprovalForShell}
                                                onChange={(e) => setForm({ ...form, requireApprovalForShell: e.target.checked })}
                                                className="rounded"
                                            />
                                            Approve shell commands
                                        </label>
                                        <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--color-fg-muted)' }}>
                                            <input
                                                type="checkbox"
                                                checked={form.requireApprovalForNetwork}
                                                onChange={(e) => setForm({ ...form, requireApprovalForNetwork: e.target.checked })}
                                                className="rounded"
                                            />
                                            Approve network access
                                        </label>
                                    </div>
                                </div>

                                {/* Advanced */}
                                <button
                                    type="button"
                                    onClick={() => setAdvancedOpen(!advancedOpen)}
                                    className="flex items-center gap-1 text-xs font-medium cursor-pointer"
                                    style={{ color: 'var(--color-fg-muted)' }}
                                >
                                    <ChevronDown size={14} style={{ transform: advancedOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                                    Advanced Settings
                                </button>
                                {advancedOpen && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-fg-muted)' }}>Max Tool Iterations</label>
                                            <input
                                                type="number"
                                                value={form.maxToolIterations}
                                                onChange={(e) => setForm({ ...form, maxToolIterations: parseInt(e.target.value) || 10 })}
                                                className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                                                style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-fg-muted)' }}>Tool Timeout (ms)</label>
                                            <input
                                                type="number"
                                                value={form.toolTimeout}
                                                onChange={(e) => setForm({ ...form, toolTimeout: parseInt(e.target.value) || 30000 })}
                                                className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                                                style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Default toggle */}
                                <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--color-fg-muted)' }}>
                                    <input
                                        type="checkbox"
                                        checked={form.isDefault}
                                        onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                                        className="rounded"
                                    />
                                    <Star size={12} /> Set as default agent
                                </label>
                            </div>

                            <div className="sticky bottom-0 p-6 pt-4 border-t flex gap-3"
                                style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer border"
                                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-fg-muted)' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer flex items-center justify-center gap-2"
                                    style={{ background: 'var(--color-primary)', color: '#fff', opacity: saving ? 0.7 : 1 }}
                                >
                                    <Save size={14} />
                                    {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
