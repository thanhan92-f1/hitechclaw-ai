import { useState, useEffect } from 'react';
import {
    FlaskConical, Play, Copy, Save, Plus, Trash2, X,
    Bot, Sparkles, FileText, ChevronDown,
} from 'lucide-react';
import { getAgentConfigs, getModels } from '../lib/api';

interface Template {
    id: string;
    name: string;
    description: string;
    persona: string;
    systemPrompt: string;
    skills: string[];
    suggestedModel: string;
    tags: string[];
}

const BUILT_IN_TEMPLATES: Template[] = [
    {
        id: 'customer-support',
        name: 'Customer Support',
        description: 'Friendly support agent for common inquiries',
        persona: 'Helpful customer support representative',
        systemPrompt: 'You are a friendly and professional customer support agent. Help users resolve their issues efficiently. Be empathetic, clear, and solution-oriented. If you cannot resolve an issue, escalate to a human agent.',
        skills: ['faq', 'knowledge-search'],
        suggestedModel: 'gpt-4o-mini',
        tags: ['support', 'customer-facing'],
    },
    {
        id: 'code-assistant',
        name: 'Code Assistant',
        description: 'Technical coding assistant for developers',
        persona: 'Senior software engineer',
        systemPrompt: 'You are an expert software engineer. Help users write, debug, and optimize code. Explain clearly, provide code examples, and follow best practices. Support multiple programming languages.',
        skills: ['code-review', 'web-search'],
        suggestedModel: 'claude-sonnet-4-20250514',
        tags: ['developer', 'technical'],
    },
    {
        id: 'data-analyst',
        name: 'Data Analyst',
        description: 'Analyze data, create queries, explain insights',
        persona: 'Data analytics expert',
        systemPrompt: 'You are a data analytics expert. Help users understand their data, write SQL queries, create visualizations concepts, and derive actionable insights. Be precise with numbers and transparent about assumptions.',
        skills: ['knowledge-search', 'web-search'],
        suggestedModel: 'gpt-4o',
        tags: ['analytics', 'data'],
    },
    {
        id: 'content-writer',
        name: 'Content Writer',
        description: 'Generate marketing copy, blog posts, emails',
        persona: 'Creative content strategist',
        systemPrompt: 'You are a creative content strategist and writer. Generate engaging marketing copy, blog posts, social media content, and professional emails. Adapt your tone and style to the target audience and brand voice.',
        skills: ['web-search'],
        suggestedModel: 'claude-sonnet-4-20250514',
        tags: ['marketing', 'content'],
    },
    {
        id: 'healthcare-assistant',
        name: 'Healthcare Assistant',
        description: 'Medical knowledge assistant (non-diagnostic)',
        persona: 'Healthcare knowledge specialist',
        systemPrompt: 'You are a healthcare knowledge assistant. Provide accurate medical information, drug interactions, and health education. Always clarify you are an AI and recommend consulting healthcare professionals for diagnosis and treatment decisions.',
        skills: ['medical-lookup', 'drug-interaction', 'knowledge-search'],
        suggestedModel: 'gpt-4o',
        tags: ['healthcare', 'medical'],
    },
    {
        id: 'multilingual',
        name: 'Multilingual Agent',
        description: 'Auto-detect language and respond in kind',
        persona: 'Polyglot assistant',
        systemPrompt: 'You are a multilingual AI assistant. Detect the user\'s language and respond in the same language. Support Vietnamese, English, Japanese, Korean, Chinese, and other major languages. Maintain cultural sensitivity and appropriate formality levels.',
        skills: ['faq', 'web-search'],
        suggestedModel: 'gpt-4o',
        tags: ['multilingual', 'general'],
    },
];

export function PromptLabPage() {
    const [tab, setTab] = useState<'templates' | 'playground'>('templates');
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            <div className="flex items-center gap-3">
                <FlaskConical className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
                <h1 className="text-2xl font-bold" style={{ color: 'var(--color-fg)' }}>Prompt Lab</h1>
            </div>

            <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--color-bg-secondary)' }}>
                {(['templates', 'playground'] as const).map((t) => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className="flex-1 px-4 py-2 rounded-md text-sm font-medium capitalize transition-colors"
                        style={{
                            background: tab === t ? 'var(--color-bg)' : 'transparent',
                            color: tab === t ? 'var(--color-fg)' : 'var(--color-fg-muted)',
                        }}
                    >
                        {t}
                    </button>
                ))}
            </div>

            {tab === 'templates' && (
                <TemplatesTab onSelect={(t) => { setSelectedTemplate(t); setTab('playground'); }} />
            )}
            {tab === 'playground' && (
                <PlaygroundTab initial={selectedTemplate} />
            )}
        </div>
    );
}

/* ─── Templates Tab ────────────────────────────────────────── */
function TemplatesTab({ onSelect }: { onSelect: (t: Template) => void }) {
    return (
        <div className="space-y-4">
            <p className="text-sm" style={{ color: 'var(--color-fg-muted)' }}>
                Start with a template or build your own agent from scratch in the playground.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {BUILT_IN_TEMPLATES.map((t) => (
                    <div key={t.id}
                        onClick={() => onSelect(t)}
                        className="rounded-xl border p-5 cursor-pointer hover:border-opacity-100 transition-colors group"
                        style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}>
                        <div className="flex items-start justify-between mb-3">
                            <Bot className="w-8 h-8 p-1.5 rounded-lg" style={{ background: 'var(--color-primary)', color: 'white' }} />
                            <Sparkles className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--color-primary)' }} />
                        </div>
                        <h3 className="font-semibold mb-1" style={{ color: 'var(--color-fg)' }}>{t.name}</h3>
                        <p className="text-sm mb-3" style={{ color: 'var(--color-fg-muted)' }}>{t.description}</p>
                        <div className="flex flex-wrap gap-1">
                            {t.tags.map((tag) => (
                                <span key={tag} className="px-2 py-0.5 rounded text-xs" style={{ background: 'var(--color-bg)', color: 'var(--color-fg-muted)' }}>{tag}</span>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ─── Playground Tab ───────────────────────────────────────── */
function PlaygroundTab({ initial }: { initial: Template | null }) {
    const [systemPrompt, setSystemPrompt] = useState(initial?.systemPrompt ?? '');
    const [persona, setPersona] = useState(initial?.persona ?? '');
    const [model, setModel] = useState(initial?.suggestedModel ?? 'gpt-4o-mini');
    const [temperature, setTemperature] = useState(0.7);
    const [testInput, setTestInput] = useState('');
    const [testOutput, setTestOutput] = useState('');
    const [testing, setTesting] = useState(false);
    const [models, setModels] = useState<string[]>([]);

    useEffect(() => {
        if (initial) {
            setSystemPrompt(initial.systemPrompt);
            setPersona(initial.persona);
            setModel(initial.suggestedModel);
        }
    }, [initial]);

    useEffect(() => {
        (async () => {
            try {
                const data = await getModels();
                const names = (data.models ?? []).map((m: any) => m.name ?? m.model);
                setModels(names);
            } catch { /* empty */ }
        })();
    }, []);

    const handleTest = async () => {
        if (!testInput.trim() || !systemPrompt.trim()) return;
        setTesting(true);
        setTestOutput('');
        try {
            const token = localStorage.getItem('hitechclaw_token');
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    message: testInput,
                    sessionId: `prompt-lab-${Date.now()}`,
                    systemPromptOverride: systemPrompt,
                }),
            });
            const data = await res.json();
            setTestOutput(data.reply ?? data.message ?? JSON.stringify(data));
        } catch (err) {
            setTestOutput(`Error: ${err instanceof Error ? err.message : 'Failed'}`);
        }
        setTesting(false);
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Configuration */}
            <div className="space-y-4">
                <h3 className="font-semibold" style={{ color: 'var(--color-fg)' }}>Agent Configuration</h3>

                <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--color-fg-muted)' }}>Persona</label>
                    <input
                        value={persona}
                        onChange={(e) => setPersona(e.target.value)}
                        placeholder="e.g., Helpful customer support agent"
                        className="w-full px-3 py-2 rounded-lg border text-sm"
                        style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                    />
                </div>

                <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--color-fg-muted)' }}>System Prompt</label>
                    <textarea
                        value={systemPrompt}
                        onChange={(e) => setSystemPrompt(e.target.value)}
                        placeholder="Enter the system prompt for your agent..."
                        rows={10}
                        className="w-full px-3 py-2 rounded-lg border text-sm font-mono resize-y"
                        style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                    />
                    <div className="flex justify-between mt-1">
                        <span className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>{systemPrompt.length} chars</span>
                        <button onClick={() => copyToClipboard(systemPrompt)} className="text-xs flex items-center gap-1 hover:opacity-80" style={{ color: 'var(--color-primary)' }}>
                            <Copy className="w-3 h-3" /> Copy
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--color-fg-muted)' }}>Model</label>
                        <select
                            value={model}
                            onChange={(e) => setModel(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border text-sm"
                            style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                        >
                            {['gpt-4o', 'gpt-4o-mini', 'claude-sonnet-4-20250514', 'gemini-2.0-flash', ...models].filter((v, i, a) => a.indexOf(v) === i).map((m) => (
                                <option key={m} value={m}>{m}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--color-fg-muted)' }}>Temperature: {temperature}</label>
                        <input
                            type="range" min={0} max={2} step={0.1}
                            value={temperature}
                            onChange={(e) => setTemperature(Number(e.target.value))}
                            className="w-full mt-2"
                        />
                    </div>
                </div>
            </div>

            {/* Right: Test */}
            <div className="space-y-4">
                <h3 className="font-semibold" style={{ color: 'var(--color-fg)' }}>Test your prompt</h3>

                <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--color-fg-muted)' }}>User Message</label>
                    <textarea
                        value={testInput}
                        onChange={(e) => setTestInput(e.target.value)}
                        placeholder="Enter a test message..."
                        rows={4}
                        className="w-full px-3 py-2 rounded-lg border text-sm resize-y"
                        style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                    />
                </div>

                <button
                    onClick={handleTest}
                    disabled={testing || !testInput.trim() || !systemPrompt.trim()}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                    style={{ background: 'var(--color-primary)' }}
                >
                    {testing ? (
                        <div className="animate-spin w-4 h-4 border-2 border-t-transparent border-white rounded-full" />
                    ) : (
                        <Play className="w-4 h-4" />
                    )}
                    Run Test
                </button>

                {testOutput && (
                    <div className="rounded-xl border p-4 space-y-2" style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}>
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium" style={{ color: 'var(--color-fg-muted)' }}>Response</span>
                            <button onClick={() => copyToClipboard(testOutput)} className="text-xs flex items-center gap-1 hover:opacity-80" style={{ color: 'var(--color-primary)' }}>
                                <Copy className="w-3 h-3" /> Copy
                            </button>
                        </div>
                        <div className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-fg)' }}>{testOutput}</div>
                    </div>
                )}
            </div>
        </div>
    );
}
