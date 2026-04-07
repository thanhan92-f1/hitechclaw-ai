import { useState, useEffect, useRef } from 'react';
import { Cpu, Download, Trash2, Loader2, CheckCircle, XCircle, HardDrive, Zap, RefreshCw } from 'lucide-react';
import { getModels, getModelsHealth, setActiveModel, pullModel, deleteModel } from '../lib/api';
import { useToastStore } from '../stores/useToastStore';

interface ModelInfo {
    name: string;
    parameterSize: string;
    family: string;
    quantization: string;
    sizeMB: number;
}

interface HealthStatus {
    running: boolean;
    version?: string;
    models: ModelInfo[];
    gpuAvailable: boolean;
}

const SUGGESTED_MODELS = [
    { name: 'llama3.2:3b', desc: 'Meta Llama 3.2 3B — Fast, general purpose' },
    { name: 'llama3.2:1b', desc: 'Meta Llama 3.2 1B — Ultra lightweight' },
    { name: 'qwen2.5:7b', desc: 'Qwen 2.5 7B — Strong multilingual' },
    { name: 'qwen2.5:3b', desc: 'Qwen 2.5 3B — Good balance' },
    { name: 'gemma2:2b', desc: 'Google Gemma 2 2B — Efficient' },
    { name: 'phi3.5:3.8b', desc: 'Microsoft Phi 3.5 — Reasoning' },
    { name: 'mistral:7b', desc: 'Mistral 7B — European model' },
    { name: 'deepseek-coder-v2:16b', desc: 'DeepSeek Coder V2 — Code generation' },
    { name: 'nomic-embed-text', desc: 'Nomic Embed — Text embeddings' },
];

export function ModelsPage() {
    const [health, setHealth] = useState<HealthStatus | null>(null);
    const [models, setModels] = useState<ModelInfo[]>([]);
    const [activeModelName, setActiveModelName] = useState('');
    const [pullProgress, setPullProgress] = useState<{ model: string; status: string; percent: number } | null>(null);
    const [customModel, setCustomModel] = useState('');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const refresh = async () => {
        setRefreshing(true);
        try {
            const [healthData, modelsData] = await Promise.all([
                getModelsHealth().catch(() => null),
                getModels().catch(() => null),
            ]);
            if (healthData) setHealth(healthData);
            if (modelsData) {
                setModels(modelsData.models || []);
                setActiveModelName(modelsData.activeModel || '');
            }
        } catch { /* ignore */ }
        setLoading(false);
        setRefreshing(false);
    };

    useEffect(() => { refresh(); }, []);

    const handleSetActive = async (model: string) => {
        try {
            await setActiveModel(model);
            setActiveModelName(model);
        } catch { /* ignore */ }
    };

    const pullingRef = useRef(false);

    const handlePull = async (modelName: string) => {
        if (pullingRef.current) return;
        pullingRef.current = true;
        setPullProgress({ model: modelName, status: 'Starting...', percent: 0 });

        const { addToast, updateToast } = useToastStore.getState();
        const toastId = addToast({ type: 'progress', title: `Pulling ${modelName}`, message: 'Starting...', percent: 0 });

        try {
            for await (const progress of pullModel(modelName)) {
                const percent = progress.total ? Math.round(((progress.completed ?? 0) / progress.total) * 100) : 0;
                setPullProgress({ model: modelName, status: progress.status, percent });
                updateToast(toastId, { percent, message: progress.status });
            }
            updateToast(toastId, { type: 'success', title: `${modelName} ready`, message: 'Model pulled successfully', percent: undefined, duration: 4000 });
            // Auto-dismiss success toast
            setTimeout(() => useToastStore.getState().removeToast(toastId), 4000);
            await refresh();
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Pull failed';
            updateToast(toastId, { type: 'error', title: `Failed to pull ${modelName}`, message: msg, percent: undefined, duration: 5000 });
            setTimeout(() => useToastStore.getState().removeToast(toastId), 5000);
        } finally {
            setPullProgress(null);
            pullingRef.current = false;
        }
    };

    const handleDelete = async (modelName: string) => {
        try {
            await deleteModel(modelName);
            await refresh();
        } catch { /* ignore */ }
    };

    const formatSize = (mb: number) => {
        if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
        return `${mb} MB`;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div
                className="flex items-center justify-between px-6 h-14 border-b shrink-0"
                style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}
            >
                <div className="flex items-center gap-2">
                    <Cpu size={20} style={{ color: 'var(--color-primary)' }} />
                    <h2 className="text-sm font-semibold" style={{ color: 'var(--color-fg)' }}>Ollama Models</h2>
                    {health?.running ? (
                        <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                            Online {health.version && `v${health.version}`}
                        </span>
                    ) : (
                        <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                            Offline
                        </span>
                    )}
                </div>
                <button
                    onClick={refresh}
                    disabled={refreshing}
                    className="p-2 rounded-lg cursor-pointer transition-colors"
                    style={{ color: 'var(--color-fg-muted)' }}
                >
                    <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-4xl mx-auto space-y-6">
                    {/* Status Cards */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="p-4 rounded-lg border" style={{ background: 'var(--color-bg-soft)', borderColor: 'var(--color-border)' }}>
                            <div className="flex items-center gap-2 mb-1">
                                {health?.running ? <CheckCircle size={16} style={{ color: '#22c55e' }} /> : <XCircle size={16} style={{ color: '#ef4444' }} />}
                                <span className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>Status</span>
                            </div>
                            <p className="text-lg font-bold" style={{ color: 'var(--color-fg)' }}>
                                {health?.running ? 'Running' : 'Offline'}
                            </p>
                        </div>
                        <div className="p-4 rounded-lg border" style={{ background: 'var(--color-bg-soft)', borderColor: 'var(--color-border)' }}>
                            <div className="flex items-center gap-2 mb-1">
                                <HardDrive size={16} style={{ color: 'var(--color-primary)' }} />
                                <span className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>Models</span>
                            </div>
                            <p className="text-lg font-bold" style={{ color: 'var(--color-fg)' }}>
                                {models.length}
                            </p>
                        </div>
                        <div className="p-4 rounded-lg border" style={{ background: 'var(--color-bg-soft)', borderColor: 'var(--color-border)' }}>
                            <div className="flex items-center gap-2 mb-1">
                                <Zap size={16} style={{ color: health?.gpuAvailable ? '#22c55e' : 'var(--color-fg-muted)' }} />
                                <span className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>GPU</span>
                            </div>
                            <p className="text-lg font-bold" style={{ color: 'var(--color-fg)' }}>
                                {health?.gpuAvailable ? 'Available' : 'CPU Only'}
                            </p>
                        </div>
                    </div>

                    {/* Pull Progress */}
                    {pullProgress && (
                        <div className="p-4 rounded-lg border" style={{ background: 'var(--color-bg-soft)', borderColor: 'var(--color-border)' }}>
                            <div className="flex items-center gap-2 mb-2">
                                <Loader2 size={14} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
                                <span className="text-sm font-medium" style={{ color: 'var(--color-fg)' }}>
                                    Pulling {pullProgress.model}
                                </span>
                            </div>
                            <p className="text-xs mb-2" style={{ color: 'var(--color-fg-muted)' }}>{pullProgress.status}</p>
                            <div className="w-full h-2 rounded-full" style={{ background: 'var(--color-bg)' }}>
                                <div
                                    className="h-full rounded-full transition-all"
                                    style={{ width: `${pullProgress.percent}%`, background: 'var(--color-primary)' }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Installed Models */}
                    <div>
                        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-fg)' }}>Installed Models</h3>
                        {models.length === 0 ? (
                            <p className="text-sm py-4 text-center" style={{ color: 'var(--color-fg-muted)' }}>
                                {health?.running ? 'No models installed. Pull a model below to get started.' : 'Ollama is not running. Start Ollama first.'}
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {models.map((model) => (
                                    <div
                                        key={model.name}
                                        className="flex items-center gap-3 p-3 rounded-lg border transition-colors"
                                        style={{
                                            background: model.name === activeModelName ? 'var(--color-primary-soft)' : 'var(--color-bg-soft)',
                                            borderColor: model.name === activeModelName ? 'var(--color-primary)' : 'var(--color-border)',
                                        }}
                                    >
                                        <Cpu size={18} style={{ color: model.name === activeModelName ? 'var(--color-primary-light)' : 'var(--color-fg-muted)' }} />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium" style={{ color: 'var(--color-fg)' }}>{model.name}</span>
                                                {model.name === activeModelName && (
                                                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--color-primary)', color: 'white' }}>
                                                        Active
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                                                {model.parameterSize} · {model.family} · {model.quantization} · {formatSize(model.sizeMB)}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {model.name !== activeModelName && (
                                                <button
                                                    onClick={() => handleSetActive(model.name)}
                                                    className="text-xs px-3 py-1.5 rounded-lg cursor-pointer"
                                                    style={{ background: 'var(--color-primary)', color: 'white' }}
                                                >
                                                    Use
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleDelete(model.name)}
                                                className="p-1.5 rounded-lg cursor-pointer"
                                                style={{ color: '#ef4444' }}
                                                title="Delete model"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Pull New Model */}
                    {health?.running && (
                        <div>
                            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-fg)' }}>Pull New Model</h3>
                            <div className="flex gap-2 mb-4">
                                <input
                                    value={customModel}
                                    onChange={(e) => setCustomModel(e.target.value)}
                                    placeholder="Model name (e.g., llama3.2:3b)"
                                    className="flex-1 px-3 py-2 rounded-lg text-sm border outline-none"
                                    style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                                    onKeyDown={(e) => e.key === 'Enter' && customModel.trim() && handlePull(customModel.trim())}
                                />
                                <button
                                    onClick={() => customModel.trim() && handlePull(customModel.trim())}
                                    disabled={!customModel.trim() || !!pullProgress}
                                    className="px-4 py-2 rounded-lg text-sm cursor-pointer disabled:opacity-40"
                                    style={{ background: 'var(--color-primary)', color: 'white' }}
                                >
                                    <Download size={14} />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {SUGGESTED_MODELS
                                    .filter((s) => !models.some((m) => m.name === s.name))
                                    .map((s) => (
                                        <button
                                            key={s.name}
                                            onClick={() => handlePull(s.name)}
                                            disabled={!!pullProgress}
                                            className="flex items-center gap-3 p-3 rounded-lg border text-left transition-colors cursor-pointer disabled:opacity-40"
                                            style={{ background: 'var(--color-bg-soft)', borderColor: 'var(--color-border)' }}
                                        >
                                            <Download size={14} style={{ color: 'var(--color-primary)' }} />
                                            <div className="flex-1 min-w-0">
                                                <span className="text-sm font-medium block" style={{ color: 'var(--color-fg)' }}>{s.name}</span>
                                                <span className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>{s.desc}</span>
                                            </div>
                                        </button>
                                    ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
