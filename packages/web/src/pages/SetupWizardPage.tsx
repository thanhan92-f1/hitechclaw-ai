import { useState, useEffect } from 'react';
import {
    Sparkles, ArrowRight, ArrowLeft, Check, Cpu, Globe, Layers,
    Rocket, Zap, Shield,
} from 'lucide-react';
import { completeSetup, getDomains } from '../lib/api';
import { useI18n } from '../i18n';

const LLM_PROVIDERS = [
    { id: 'ollama', name: 'Ollama (Local)', desc: 'Free, runs locally', icon: '🦙' },
    { id: 'openai', name: 'OpenAI', desc: 'GPT-4o, GPT-4, GPT-3.5', icon: '🧠' },
    { id: 'anthropic', name: 'Anthropic', desc: 'Claude 4, Claude 3.5', icon: '🤖' },
    { id: 'google', name: 'Google Gemini', desc: 'Gemini Pro, Flash', icon: '💎' },
    { id: 'deepseek', name: 'DeepSeek', desc: 'DeepSeek V3, R1', icon: '🔍' },
    { id: 'groq', name: 'Groq', desc: 'Ultra-fast inference', icon: '⚡' },
    { id: 'huggingface', name: 'HuggingFace', desc: 'Open models, Inference API', icon: '🤗' },
    { id: 'custom', name: 'Custom', desc: 'OpenAI-compatible API', icon: '🔧' },
];

const DOMAIN_ICONS: Record<string, string> = {
    general: '💬', developer: '💻', healthcare: '🏥', finance: '💰',
    marketing: '📣', education: '🎓', research: '🔬', devops: '🚀',
    legal: '⚖️', hr: '👥', sales: '📊', ecommerce: '🛒', ml: '🤖',
};

interface SetupConfig {
    agentName: string;
    aiLanguage: string;
    llmProvider: string;
    llmModel: string;
    llmApiKey: string;
    llmBaseUrl: string;
    enableWebSearch: boolean;
    enableRag: boolean;
    enableWorkflows: boolean;
    enabledDomains: string[];
}

interface SetupWizardProps {
    onComplete: () => void;
}

export function SetupWizardPage({ onComplete }: SetupWizardProps) {
    const { t } = useI18n();
    const [step, setStep] = useState(0);
    const [saving, setSaving] = useState(false);
    const [domains, setDomains] = useState<Array<{ id: string; name: string; description: string }>>([]);
    const [config, setConfig] = useState<SetupConfig>({
        agentName: 'HiTechClaw Assistant',
        aiLanguage: 'auto',
        llmProvider: 'ollama',
        llmModel: 'qwen2.5:14b',
        llmApiKey: '',
        llmBaseUrl: '',
        enableWebSearch: true,
        enableRag: true,
        enableWorkflows: true,
        enabledDomains: ['general'],
    });

    useEffect(() => {
        getDomains().then((data) => {
            const list = (data.domains ?? data ?? []) as Array<{ id: string; name: string; description: string }>;
            setDomains(list);
        }).catch(() => { });
    }, []);

    const needsApiKey = !['ollama'].includes(config.llmProvider);
    const needsBaseUrl = ['ollama', 'custom', 'huggingface'].includes(config.llmProvider);

    const handleComplete = async () => {
        setSaving(true);
        try {
            const payload: Record<string, unknown> = {
                agentName: config.agentName,
                aiLanguage: config.aiLanguage,
                llmProvider: config.llmProvider,
                llmModel: config.llmModel,
                enableWebSearch: config.enableWebSearch,
                enableRag: config.enableRag,
                enableWorkflows: config.enableWorkflows,
                enabledDomains: config.enabledDomains,
            };
            if (config.llmApiKey) payload.llmApiKey = config.llmApiKey;
            if (config.llmBaseUrl) payload.llmBaseUrl = config.llmBaseUrl;
            await completeSetup(payload);
            onComplete();
        } catch {
            setSaving(false);
        }
    };

    const toggleDomain = (id: string) => {
        setConfig((prev) => ({
            ...prev,
            enabledDomains: prev.enabledDomains.includes(id)
                ? prev.enabledDomains.filter((d) => d !== id)
                : [...prev.enabledDomains, id],
        }));
    };

    const STEPS = [
        { label: 'Welcome', icon: Sparkles },
        { label: 'AI Engine', icon: Cpu },
        { label: 'Features', icon: Layers },
        { label: 'Launch', icon: Rocket },
    ];

    return (
        <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#0a0a0f' }}>
            {/* Animated blobs */}
            <div className="login-blob login-blob-1" />
            <div className="login-blob login-blob-2" />

            <div className="relative z-10 w-full max-w-2xl">
                {/* Step indicator */}
                <div className="flex items-center justify-center gap-2 mb-8">
                    {STEPS.map((s, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                                style={{
                                    background: i <= step ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)',
                                    color: i <= step ? '#818cf8' : '#52525b',
                                    border: i === step ? '2px solid #818cf8' : '2px solid transparent',
                                }}
                            >
                                {i < step ? <Check size={14} /> : i + 1}
                            </div>
                            <span className="text-xs hidden sm:inline" style={{ color: i <= step ? '#a5b4fc' : '#52525b' }}>
                                {s.label}
                            </span>
                            {i < STEPS.length - 1 && (
                                <div className="w-8 h-px mx-1" style={{ background: i < step ? '#6366f1' : '#27272a' }} />
                            )}
                        </div>
                    ))}
                </div>

                {/* Card */}
                <div
                    className="rounded-2xl border p-8"
                    style={{
                        background: 'rgba(24, 24, 32, 0.95)',
                        borderColor: 'rgba(99,102,241,0.15)',
                        backdropFilter: 'blur(20px)',
                        boxShadow: '0 0 80px rgba(99,102,241,0.08)',
                    }}
                >
                    {/* Step 0: Welcome */}
                    {step === 0 && (
                        <div className="space-y-6 text-center">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-2" style={{ background: 'rgba(99,102,241,0.15)' }}>
                                <Sparkles size={28} style={{ color: '#818cf8' }} />
                            </div>
                            <h2 className="text-2xl font-bold" style={{ color: '#f4f4f5' }}>
                                {t('setup.welcome')}
                            </h2>
                            <p className="text-sm leading-relaxed max-w-md mx-auto" style={{ color: '#a1a1aa' }}>
                                {t('setup.welcomeDesc')}
                            </p>
                            <div className="space-y-4 text-left max-w-sm mx-auto">
                                <div>
                                    <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: '#a1a1aa' }}>
                                        {t('setup.agentName')}
                                    </label>
                                    <input
                                        value={config.agentName}
                                        onChange={(e) => setConfig({ ...config, agentName: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                                        style={{
                                            background: 'rgba(255,255,255,0.05)',
                                            border: '1px solid rgba(255,255,255,0.08)',
                                            color: '#f4f4f5',
                                        }}
                                        placeholder="HiTechClaw Assistant"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: '#a1a1aa' }}>
                                        {t('setup.language')}
                                    </label>
                                    <select
                                        value={config.aiLanguage}
                                        onChange={(e) => setConfig({ ...config, aiLanguage: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                                        style={{
                                            background: 'rgba(255,255,255,0.05)',
                                            border: '1px solid rgba(255,255,255,0.08)',
                                            color: '#f4f4f5',
                                            appearance: 'none',
                                        }}
                                    >
                                        <option value="auto">Auto Detect</option>
                                        <option value="en">English</option>
                                        <option value="vi">Tiếng Việt</option>
                                        <option value="ja">日本語</option>
                                        <option value="ko">한국어</option>
                                        <option value="zh">中文</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 1: LLM Configuration */}
                    {step === 1 && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-3" style={{ background: 'rgba(99,102,241,0.15)' }}>
                                    <Cpu size={22} style={{ color: '#818cf8' }} />
                                </div>
                                <h2 className="text-xl font-bold" style={{ color: '#f4f4f5' }}>
                                    {t('setup.llmTitle')}
                                </h2>
                                <p className="text-sm mt-1" style={{ color: '#71717a' }}>
                                    {t('setup.llmDesc')}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {LLM_PROVIDERS.map((p) => (
                                    <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => setConfig({ ...config, llmProvider: p.id, llmModel: p.id === 'ollama' ? 'qwen2.5:14b' : p.id === 'huggingface' ? 'meta-llama/Llama-3.1-70B-Instruct' : '', llmBaseUrl: '' })}
                                        className="text-left p-3 rounded-xl border transition-all"
                                        style={{
                                            background: config.llmProvider === p.id ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.03)',
                                            borderColor: config.llmProvider === p.id ? '#6366f1' : 'rgba(255,255,255,0.06)',
                                        }}
                                    >
                                        <span className="text-lg">{p.icon}</span>
                                        <p className="text-sm font-medium mt-1" style={{ color: '#e4e4e7' }}>{p.name}</p>
                                        <p className="text-[10px]" style={{ color: '#71717a' }}>{p.desc}</p>
                                    </button>
                                ))}
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#a1a1aa' }}>
                                        {t('setup.model')}
                                    </label>
                                    <input
                                        value={config.llmModel}
                                        onChange={(e) => setConfig({ ...config, llmModel: e.target.value })}
                                        placeholder={
                                            config.llmProvider === 'ollama' ? 'qwen2.5:14b'
                                                : config.llmProvider === 'openai' ? 'gpt-4o'
                                                    : config.llmProvider === 'anthropic' ? 'claude-sonnet-4-20250514'
                                                        : config.llmProvider === 'google' ? 'gemini-2.0-flash'
                                                            : config.llmProvider === 'deepseek' ? 'deepseek-chat'
                                                                : config.llmProvider === 'groq' ? 'llama-3.3-70b-versatile'
                                                                    : config.llmProvider === 'huggingface' ? 'meta-llama/Llama-3.1-70B-Instruct'
                                                                        : 'model-name'
                                        }
                                        className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#f4f4f5' }}
                                    />
                                </div>
                                {needsApiKey && (
                                    <div>
                                        <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#a1a1aa' }}>
                                            API Key
                                        </label>
                                        <input
                                            type="password"
                                            value={config.llmApiKey}
                                            onChange={(e) => setConfig({ ...config, llmApiKey: e.target.value })}
                                            placeholder="sk-..."
                                            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#f4f4f5' }}
                                        />
                                    </div>
                                )}
                                {needsBaseUrl && (
                                    <div>
                                        <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#a1a1aa' }}>
                                            {config.llmProvider === 'ollama' ? 'Ollama URL' : 'Base URL'}
                                        </label>
                                        <input
                                            value={config.llmBaseUrl}
                                            onChange={(e) => setConfig({ ...config, llmBaseUrl: e.target.value })}
                                            placeholder={
                                                config.llmProvider === 'ollama' ? 'http://localhost:11434'
                                                    : config.llmProvider === 'huggingface' ? 'https://api-inference.huggingface.co/v1/'
                                                        : 'https://api.example.com/v1'
                                            }
                                            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#f4f4f5' }}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Step 2: Features & Domains */}
                    {step === 2 && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-3" style={{ background: 'rgba(99,102,241,0.15)' }}>
                                    <Layers size={22} style={{ color: '#818cf8' }} />
                                </div>
                                <h2 className="text-xl font-bold" style={{ color: '#f4f4f5' }}>
                                    {t('setup.featuresTitle')}
                                </h2>
                            </div>

                            {/* Feature toggles */}
                            <div className="space-y-2">
                                {[
                                    { key: 'enableWebSearch' as const, label: t('setup.webSearch'), icon: Globe, desc: t('setup.webSearchDesc') },
                                    { key: 'enableRag' as const, label: t('setup.rag'), icon: Zap, desc: t('setup.ragDesc') },
                                    { key: 'enableWorkflows' as const, label: t('setup.workflows'), icon: Shield, desc: t('setup.workflowsDesc') },
                                ].map((f) => (
                                    <label key={f.key} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
                                        style={{ background: config[f.key] ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.02)', border: '1px solid', borderColor: config[f.key] ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)' }}>
                                        <input type="checkbox" checked={config[f.key]} onChange={(e) => setConfig({ ...config, [f.key]: e.target.checked })} className="rounded" />
                                        <f.icon size={16} style={{ color: config[f.key] ? '#818cf8' : '#52525b' }} />
                                        <div>
                                            <span className="text-sm font-medium" style={{ color: '#e4e4e7' }}>{f.label}</span>
                                            <p className="text-[11px]" style={{ color: '#71717a' }}>{f.desc}</p>
                                        </div>
                                    </label>
                                ))}
                            </div>

                            {/* Domain selection */}
                            <div>
                                <h3 className="text-sm font-semibold mb-3" style={{ color: '#a1a1aa' }}>
                                    {t('setup.domainPacks')}
                                </h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {domains.map((d) => {
                                        const selected = config.enabledDomains.includes(d.id);
                                        return (
                                            <button
                                                key={d.id}
                                                type="button"
                                                onClick={() => toggleDomain(d.id)}
                                                className="text-left p-3 rounded-xl border transition-all"
                                                style={{
                                                    background: selected ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.03)',
                                                    borderColor: selected ? '#6366f1' : 'rgba(255,255,255,0.06)',
                                                }}
                                            >
                                                <span className="text-base">{DOMAIN_ICONS[d.id] ?? '📦'}</span>
                                                <p className="text-xs font-medium mt-1" style={{ color: selected ? '#c7d2fe' : '#a1a1aa' }}>{d.name}</p>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Complete */}
                    {step === 3 && (
                        <div className="space-y-6 text-center">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-2" style={{ background: 'rgba(34,197,94,0.15)' }}>
                                <Rocket size={28} style={{ color: '#4ade80' }} />
                            </div>
                            <h2 className="text-2xl font-bold" style={{ color: '#f4f4f5' }}>
                                {t('setup.readyTitle')}
                            </h2>
                            <p className="text-sm" style={{ color: '#a1a1aa' }}>
                                {t('setup.readyDesc')}
                            </p>
                            {/* Summary */}
                            <div className="text-left space-y-2 max-w-sm mx-auto">
                                {[
                                    { label: t('setup.agentName'), value: config.agentName },
                                    { label: t('setup.provider'), value: LLM_PROVIDERS.find((p) => p.id === config.llmProvider)?.name ?? config.llmProvider },
                                    { label: t('setup.model'), value: config.llmModel || '—' },
                                    { label: t('setup.language'), value: config.aiLanguage === 'auto' ? 'Auto Detect' : config.aiLanguage },
                                    { label: t('setup.domainPacks'), value: `${config.enabledDomains.length} selected` },
                                ].map((item, i) => (
                                    <div key={i} className="flex justify-between py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                                        <span className="text-xs" style={{ color: '#71717a' }}>{item.label}</span>
                                        <span className="text-sm font-medium" style={{ color: '#e4e4e7' }}>{item.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Navigation buttons */}
                    <div className="flex justify-between items-center mt-8 pt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        {step > 0 ? (
                            <button onClick={() => setStep(step - 1)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm"
                                style={{ color: '#a1a1aa' }}>
                                <ArrowLeft size={14} /> {t('common.back')}
                            </button>
                        ) : <div />}
                        {step < 3 ? (
                            <button onClick={() => setStep(step + 1)}
                                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-all"
                                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 4px 20px rgba(99,102,241,0.3)' }}>
                                {t('setup.next')} <ArrowRight size={14} />
                            </button>
                        ) : (
                            <button onClick={handleComplete} disabled={saving}
                                className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-50"
                                style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 4px 20px rgba(34,197,94,0.3)' }}>
                                {saving ? (
                                    <div className="animate-spin w-4 h-4 border-2 border-t-transparent border-white rounded-full" />
                                ) : (
                                    <><Rocket size={14} /> {t('setup.launch')}</>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
