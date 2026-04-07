import {
    ArrowRightLeft,
    Bot,
    Brain,
    Eye,
    GripVertical,
    Loader2,
    MessageSquare,
    Network,
    Plus,
    Save,
    Settings2,
    Trash2,
    Wand2,
    X,
    Zap
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// ─── Types ──────────────────────────────────────────────────

interface SkillBlock {
    id: string;
    name: string;
    description: string;
    domainId: string;
    enabled: boolean;
}

interface ToolBlock {
    id: string;
    name: string;
    description: string;
    source: string; // 'mcp' | 'builtin' | 'custom'
}

interface SubAgentRef {
    agentConfigId: string;
    name: string;
    description: string;
}

type LLMProvider = 'openai' | 'anthropic' | 'ollama' | 'google' | 'groq' | 'mistral' | 'deepseek' | 'xai' | 'openrouter' | 'perplexity' | 'huggingface' | 'custom';

const PROVIDER_LABELS: Record<LLMProvider, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    ollama: 'Ollama (Local)',
    google: 'Google AI',
    groq: 'Groq',
    mistral: 'Mistral',
    deepseek: 'DeepSeek',
    xai: 'xAI (Grok)',
    openrouter: 'OpenRouter',
    perplexity: 'Perplexity',
    huggingface: 'HuggingFace',
    custom: 'Custom',
};

const PROVIDER_DEFAULT_MODELS: Partial<Record<LLMProvider, string>> = {
    openai: 'gpt-4o-mini',
    anthropic: 'claude-sonnet-4-20250514',
    ollama: 'qwen2.5:1.5b',
    google: 'gemini-2.0-flash',
    groq: 'llama-3.3-70b-versatile',
    mistral: 'mistral-large-latest',
    deepseek: 'deepseek-chat',
    xai: 'grok-3-mini',
    openrouter: 'openai/gpt-4o-mini',
    perplexity: 'sonar',
};

interface AgentConfig {
    name: string;
    description: string;
    persona: string;
    systemPrompt: string;
    provider: LLMProvider;
    model: string;
    temperature: number;
    maxTokens: number;
    skills: SkillBlock[];
    tools: ToolBlock[];
    knowledgeCollections: string[];
    subAgents: SubAgentRef[];
    allowTransfer: boolean;
}

const DEFAULT_CONFIG: AgentConfig = {
    name: 'New Agent',
    description: '',
    persona: 'A helpful AI assistant.',
    systemPrompt: '',
    provider: 'ollama',
    model: 'qwen2.5:1.5b',
    temperature: 0.7,
    maxTokens: 2048,
    skills: [],
    tools: [],
    knowledgeCollections: [],
    subAgents: [],
    allowTransfer: false,
};

// ─── Demo data ─────────────────────────────────────────────
const DEMO_SKILLS: SkillBlock[] = [
    { id: 'device-control', name: 'Device Control', description: 'Open browser, search websites, capture screenshots, and analyze visual output', domainId: 'developer', enabled: true },
    { id: 'web-search', name: 'Web Search', description: 'Search the web using Brave/Bing APIs and return relevant results', domainId: 'general', enabled: true },
    { id: 'code-execution', name: 'Code Execution', description: 'Execute Python/JavaScript code in a sandboxed environment', domainId: 'developer', enabled: true },
    { id: 'file-management', name: 'File Management', description: 'Read, write, and manage files within the workspace', domainId: 'general', enabled: true },
    { id: 'knowledge-qa', name: 'Knowledge Q&A', description: 'Answer questions from uploaded documents using RAG retrieval', domainId: 'general', enabled: true },
    { id: 'email-compose', name: 'Email Compose', description: 'Draft and send emails via Gmail/SMTP integration', domainId: 'general', enabled: true },
    { id: 'drug-interaction', name: 'Drug Interaction Check', description: 'Check for dangerous drug interactions and contraindications', domainId: 'healthcare', enabled: true },
    { id: 'icd10-lookup', name: 'ICD-10 Lookup', description: 'Search and lookup ICD-10 diagnosis codes', domainId: 'healthcare', enabled: true },
    { id: 'clinical-notes', name: 'Clinical Notes Generator', description: 'Generate structured clinical notes (SOAP, discharge, referral)', domainId: 'healthcare', enabled: true },
    { id: 'sentiment-analysis', name: 'Sentiment Analysis', description: 'Analyze text sentiment and emotion (Vietnamese supported)', domainId: 'general', enabled: true },
    { id: 'data-viz', name: 'Data Visualization', description: 'Generate charts and visualizations from data', domainId: 'developer', enabled: true },
    { id: 'translation', name: 'Translation', description: 'Translate text between languages (EN, VI, JP, KR, ZH)', domainId: 'general', enabled: true },
    { id: 'github-ops', name: 'GitHub Operations', description: 'Manage issues, PRs, and code reviews on GitHub', domainId: 'developer', enabled: true },
];

const DEMO_TOOLS: ToolBlock[] = [
    { id: 'chrome_open_page', name: 'chrome_open_page', description: 'Open Chrome and navigate to a URL for browser automation workflows', source: 'mcp' },
    { id: 'chrome_take_screenshot', name: 'chrome_take_screenshot', description: 'Capture webpage screenshots after search/navigation', source: 'mcp' },
    { id: 'vision_analyze_screenshot', name: 'vision_analyze_screenshot', description: 'Analyze captured screenshots for insights, errors, or UI issues', source: 'builtin' },
    { id: 'search_docs', name: 'search_docs', description: 'Full-text search across HiTechClaw dev documentation', source: 'mcp' },
    { id: 'github_create_issue', name: 'github_create_issue', description: 'Create a new issue in a GitHub repository', source: 'mcp' },
    { id: 'github_search_code', name: 'github_search_code', description: 'Search code across GitHub repositories', source: 'mcp' },
    { id: 'fs_read_file', name: 'fs_read_file', description: 'Read contents of a file within the sandboxed directory', source: 'mcp' },
    { id: 'pg_query', name: 'pg_query', description: 'Execute a read-only SQL query against the PostgreSQL database', source: 'mcp' },
    { id: 'slack_send_message', name: 'slack_send_message', description: 'Send a message to a Slack channel', source: 'mcp' },
    { id: 'facebook_send_message', name: 'facebook_send_message', description: 'Send and receive chat messages through Facebook Messenger channel', source: 'builtin' },
    { id: 'zalo_send_message', name: 'zalo_send_message', description: 'Send and receive chat messages through Zalo Official Account channel', source: 'builtin' },
    { id: 'brave_web_search', name: 'brave_web_search', description: 'Search the web using Brave Search API', source: 'mcp' },
    { id: 'shell_exec', name: 'shell_exec', description: 'Execute shell commands in a sandboxed environment', source: 'builtin' },
    { id: 'http_request', name: 'http_request', description: 'Make HTTP requests to external APIs', source: 'builtin' },
    { id: 'json_parse', name: 'json_parse', description: 'Parse and transform JSON data structures', source: 'builtin' },
];

// ─── Main Page Component ────────────────────────────────────

export function AgentBuilderPage() {
    const navigate = useNavigate();
    const [config, setConfig] = useState<AgentConfig>({ ...DEFAULT_CONFIG });
    const [availableSkills, setAvailableSkills] = useState<SkillBlock[]>([]);
    const [availableTools, setAvailableTools] = useState<ToolBlock[]>([]);
    const [saving, setSaving] = useState(false);
    const [activePanel, setActivePanel] = useState<'persona' | 'skills' | 'tools' | 'settings'>('persona');
    const [savedAgents, setSavedAgents] = useState<Array<{ _id: string; name: string; persona: string }>>([]);
    const [tenantDefaults, setTenantDefaults] = useState<{ provider: string; model: string; temperature?: number; maxTokens?: number } | null>(null);
    const [dragOverZone, setDragOverZone] = useState<string | null>(null);
    const [previewOpen, setPreviewOpen] = useState(false);

    useEffect(() => {
        // Load tenant settings (configured provider/model for this tenant)
        fetch('/api/settings', {
            headers: { Authorization: `Bearer ${localStorage.getItem('hitechclaw_token')}` },
        })
            .then((r) => r.json())
            .then((data) => {
                const md = data.modelDefaults;
                if (md) {
                    setTenantDefaults(md);
                    setConfig((p) => ({
                        ...p,
                        provider: (md.provider as LLMProvider) || p.provider,
                        model: md.model || p.model,
                        temperature: md.temperature ?? p.temperature,
                        maxTokens: md.maxTokens ?? p.maxTokens,
                    }));
                }
            })
            .catch(() => {});

        // Load available skills from domains
        fetch('/api/marketplace/skills', {
            headers: { Authorization: `Bearer ${localStorage.getItem('hitechclaw_token')}` },
        })
            .then((r) => r.json())
            .then((data) => {
                const skills = (data.skills || []).map((s: Record<string, unknown>) => ({
                    id: s.id as string,
                    name: s.name as string,
                    description: s.description as string,
                    domainId: s.domainId as string,
                    enabled: true,
                }));
                setAvailableSkills(skills.length > 0 ? skills : DEMO_SKILLS);
            })
            .catch(() => { setAvailableSkills(DEMO_SKILLS); });

        // Load saved agents for sub-agent selection
        fetch('/api/agents', {
            headers: { Authorization: `Bearer ${localStorage.getItem('hitechclaw_token')}` },
        })
            .then((r) => r.json())
            .then((data) => setSavedAgents(data.agents || []))
            .catch(() => {});

        // Load available MCP tools
        fetch('/api/mcp/tools', {
            headers: { Authorization: `Bearer ${localStorage.getItem('hitechclaw_token')}` },
        })
            .then((r) => r.json())
            .then((data) => {
                const tools = (data.tools || []).map((t: Record<string, unknown>) => ({
                    id: t.name as string,
                    name: (t.name as string).split('__').pop() || (t.name as string),
                    description: t.description as string,
                    source: 'mcp',
                }));
                setAvailableTools(tools.length > 0 ? tools : DEMO_TOOLS);
            })
            .catch(() => { setAvailableTools(DEMO_TOOLS); });
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/agents', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('hitechclaw_token')}`,
                },
                body: JSON.stringify({
                    name: config.name,
                    description: config.description,
                    config: {
                        persona: config.persona,
                        systemPrompt: config.systemPrompt,
                        provider: config.provider,
                        model: config.model,
                        temperature: config.temperature,
                        maxTokens: config.maxTokens,
                        skills: config.skills.map((s) => s.id),
                        tools: config.tools.map((t) => t.id),
                        knowledgeCollections: config.knowledgeCollections,
                        subAgents: config.subAgents,
                        allowTransfer: config.allowTransfer,
                    },
                }),
            });
            if (res.ok) navigate('/agents');
        } catch { /* ignore */ }
        setSaving(false);
    };

    const addSkill = useCallback((skill: SkillBlock) => {
        setConfig((prev) => {
            if (prev.skills.find((s) => s.id === skill.id)) return prev;
            return { ...prev, skills: [...prev.skills, { ...skill }] };
        });
    }, []);

    const removeSkill = useCallback((id: string) => {
        setConfig((prev) => ({ ...prev, skills: prev.skills.filter((s) => s.id !== id) }));
    }, []);

    const addTool = useCallback((tool: ToolBlock) => {
        setConfig((prev) => {
            if (prev.tools.find((t) => t.id === tool.id)) return prev;
            return { ...prev, tools: [...prev.tools, { ...tool }] };
        });
    }, []);

    const removeTool = useCallback((id: string) => {
        setConfig((prev) => ({ ...prev, tools: prev.tools.filter((t) => t.id !== id) }));
    }, []);

    const handleDrop = useCallback((e: React.DragEvent, zone: 'skills' | 'tools') => {
        e.preventDefault();
        setDragOverZone(null);
        try {
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            if (zone === 'skills' && data.type === 'skill') addSkill(data.item);
            if (zone === 'tools' && data.type === 'tool') addTool(data.item);
        } catch { /* ignore */ }
    }, [addSkill, addTool]);

    const handleDragOver = (e: React.DragEvent, zone: string) => {
        e.preventDefault();
        setDragOverZone(zone);
    };

    return (
        <div className="h-full flex overflow-hidden">
            {/* Left Panel — Configuration */}
            <div className="flex-1 overflow-y-auto p-6" style={{ background: 'var(--color-bg)' }}>
                <div className="max-w-3xl mx-auto space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--color-primary-soft)' }}>
                                <Wand2 size={20} style={{ color: 'var(--color-primary)' }} />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold" style={{ color: 'var(--color-fg)' }}>Agent Builder</h1>
                                <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>Design your agent with persona, skills, and tools</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setPreviewOpen(!previewOpen)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border cursor-pointer"
                                style={{ borderColor: 'var(--color-border)', color: 'var(--color-fg-muted)' }}>
                                <Eye size={14} /> Preview
                            </button>
                            <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white cursor-pointer disabled:opacity-50"
                                style={{ background: 'var(--color-primary)' }}>
                                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                Save Agent
                            </button>
                        </div>
                    </div>

                    {/* Agent Name & Description */}
                    <div className="rounded-xl border p-5 space-y-3" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                        <input
                            type="text"
                            value={config.name}
                            onChange={(e) => setConfig((p) => ({ ...p, name: e.target.value }))}
                            className="w-full text-lg font-bold bg-transparent outline-none"
                            style={{ color: 'var(--color-fg)' }}
                            placeholder="Agent Name"
                        />
                        <input
                            type="text"
                            value={config.description}
                            onChange={(e) => setConfig((p) => ({ ...p, description: e.target.value }))}
                            className="w-full text-sm bg-transparent outline-none"
                            style={{ color: 'var(--color-fg-muted)' }}
                            placeholder="Short description..."
                        />
                    </div>

                    {/* Panel Tabs */}
                    <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--color-bg-surface)' }}>
                        {([
                            { key: 'persona', icon: MessageSquare, label: 'Persona' },
                            { key: 'skills', icon: Brain, label: 'Skills' },
                            { key: 'tools', icon: Zap, label: 'Tools' },
                            { key: 'settings', icon: Settings2, label: 'Settings' },
                        ] as const).map(({ key, icon: Icon, label }) => (
                            <button
                                key={key}
                                onClick={() => setActivePanel(key)}
                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium cursor-pointer transition-colors"
                                style={{
                                    background: activePanel === key ? 'var(--color-bg)' : 'transparent',
                                    color: activePanel === key ? 'var(--color-fg)' : 'var(--color-fg-muted)',
                                }}
                            >
                                <Icon size={13} /> {label}
                            </button>
                        ))}
                    </div>

                    {/* Persona Panel */}
                    {activePanel === 'persona' && (
                        <div className="rounded-xl border p-5 space-y-4" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                            <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--color-fg)' }}>
                                <MessageSquare size={14} /> Persona
                            </h3>
                            <div>
                                <label className="block text-xs mb-1" style={{ color: 'var(--color-fg-muted)' }}>Personality / Role</label>
                                <textarea
                                    value={config.persona}
                                    onChange={(e) => setConfig((p) => ({ ...p, persona: e.target.value }))}
                                    rows={3}
                                    className="w-full px-3 py-2 rounded-lg text-sm border outline-none resize-none"
                                    style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                                    placeholder="Describe the agent's personality and role..."
                                />
                            </div>
                            <div>
                                <label className="block text-xs mb-1" style={{ color: 'var(--color-fg-muted)' }}>System Prompt (optional override)</label>
                                <textarea
                                    value={config.systemPrompt}
                                    onChange={(e) => setConfig((p) => ({ ...p, systemPrompt: e.target.value }))}
                                    rows={5}
                                    className="w-full px-3 py-2 rounded-lg text-sm border outline-none resize-none font-mono"
                                    style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                                    placeholder="Custom system prompt..."
                                />
                            </div>
                        </div>
                    )}

                    {/* Skills Panel */}
                    {activePanel === 'skills' && (
                        <div className="space-y-4">
                            {/* Active Skills Drop Zone */}
                            <div
                                className="rounded-xl border p-4 min-h-[120px] transition-colors"
                                style={{
                                    background: dragOverZone === 'skills' ? 'var(--color-primary-soft)' : 'var(--color-bg-surface)',
                                    borderColor: dragOverZone === 'skills' ? 'var(--color-primary)' : 'var(--color-border)',
                                    borderStyle: config.skills.length === 0 ? 'dashed' : 'solid',
                                }}
                                onDrop={(e) => handleDrop(e, 'skills')}
                                onDragOver={(e) => handleDragOver(e, 'skills')}
                                onDragLeave={() => setDragOverZone(null)}
                            >
                                <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-fg-muted)' }}>
                                    Active Skills ({config.skills.length})
                                </h3>
                                {config.skills.length === 0 ? (
                                    <p className="text-xs text-center py-4" style={{ color: 'var(--color-fg-muted)' }}>
                                        Drag skills here or click + to add
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {config.skills.map((skill) => (
                                            <div key={skill.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
                                                <GripVertical size={14} style={{ color: 'var(--color-fg-muted)' }} />
                                                <Brain size={14} style={{ color: 'var(--color-primary)' }} />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-medium truncate" style={{ color: 'var(--color-fg)' }}>{skill.name}</p>
                                                    <p className="text-[10px] truncate" style={{ color: 'var(--color-fg-muted)' }}>{skill.description}</p>
                                                </div>
                                                <button onClick={() => removeSkill(skill.id)} className="p-1 cursor-pointer" style={{ color: 'var(--color-destructive)' }}>
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Available Skills */}
                            <div className="rounded-xl border p-4" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                                <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-fg-muted)' }}>
                                    Available Skills
                                </h3>
                                <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                                    {availableSkills.filter((s) => !config.skills.find((cs) => cs.id === s.id)).map((skill) => (
                                        <div
                                            key={skill.id}
                                            draggable
                                            onDragStart={(e) => e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'skill', item: skill }))}
                                            className="flex items-center gap-2 px-3 py-2 rounded-lg border cursor-grab active:cursor-grabbing hover:border-[var(--color-primary)] transition-colors"
                                            style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
                                        >
                                            <Brain size={13} style={{ color: 'var(--color-fg-muted)' }} />
                                            <span className="text-xs truncate flex-1" style={{ color: 'var(--color-fg)' }}>{skill.name}</span>
                                            <button onClick={() => addSkill(skill)} className="p-0.5 cursor-pointer" style={{ color: 'var(--color-primary)' }}>
                                                <Plus size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tools Panel */}
                    {activePanel === 'tools' && (
                        <div className="space-y-4">
                            <div
                                className="rounded-xl border p-4 min-h-[120px] transition-colors"
                                style={{
                                    background: dragOverZone === 'tools' ? 'var(--color-primary-soft)' : 'var(--color-bg-surface)',
                                    borderColor: dragOverZone === 'tools' ? 'var(--color-primary)' : 'var(--color-border)',
                                    borderStyle: config.tools.length === 0 ? 'dashed' : 'solid',
                                }}
                                onDrop={(e) => handleDrop(e, 'tools')}
                                onDragOver={(e) => handleDragOver(e, 'tools')}
                                onDragLeave={() => setDragOverZone(null)}
                            >
                                <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-fg-muted)' }}>
                                    Active Tools ({config.tools.length})
                                </h3>
                                {config.tools.length === 0 ? (
                                    <p className="text-xs text-center py-4" style={{ color: 'var(--color-fg-muted)' }}>
                                        Drag tools here or click + to add
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {config.tools.map((tool) => (
                                            <div key={tool.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
                                                <GripVertical size={14} style={{ color: 'var(--color-fg-muted)' }} />
                                                <Zap size={14} style={{ color: 'var(--color-accent)' }} />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-medium truncate" style={{ color: 'var(--color-fg)' }}>{tool.name}</p>
                                                    <p className="text-[10px] truncate" style={{ color: 'var(--color-fg-muted)' }}>{tool.description}</p>
                                                </div>
                                                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary-light)' }}>{tool.source}</span>
                                                <button onClick={() => removeTool(tool.id)} className="p-1 cursor-pointer" style={{ color: 'var(--color-destructive)' }}>
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="rounded-xl border p-4" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                                <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-fg-muted)' }}>
                                    Available Tools (MCP)
                                </h3>
                                <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                                    {availableTools.filter((t) => !config.tools.find((ct) => ct.id === t.id)).map((tool) => (
                                        <div
                                            key={tool.id}
                                            draggable
                                            onDragStart={(e) => e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'tool', item: tool }))}
                                            className="flex items-center gap-2 px-3 py-2 rounded-lg border cursor-grab active:cursor-grabbing hover:border-[var(--color-primary)] transition-colors"
                                            style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
                                        >
                                            <Zap size={13} style={{ color: 'var(--color-fg-muted)' }} />
                                            <span className="text-xs truncate flex-1" style={{ color: 'var(--color-fg)' }}>{tool.name}</span>
                                            <button onClick={() => addTool(tool)} className="p-0.5 cursor-pointer" style={{ color: 'var(--color-primary)' }}>
                                                <Plus size={12} />
                                            </button>
                                        </div>
                                    ))}
                                    {availableTools.length === 0 && (
                                        <p className="col-span-2 text-xs text-center py-4" style={{ color: 'var(--color-fg-muted)' }}>
                                            No MCP tools available. Connect MCP servers first.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Settings Panel */}
                    {activePanel === 'settings' && (<>
                        <div className="rounded-xl border p-5 space-y-4" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                            <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--color-fg)' }}>
                                <Settings2 size={14} /> Model Settings
                            </h3>
                            <div>
                                <label className="block text-xs mb-1" style={{ color: 'var(--color-fg-muted)' }}>Provider</label>
                                <select
                                    value={config.provider}
                                    onChange={(e) => {
                                        const provider = e.target.value as LLMProvider;
                                        const defaultModel = PROVIDER_DEFAULT_MODELS[provider] || '';
                                        setConfig((p) => ({ ...p, provider, model: defaultModel }));
                                    }}
                                    className="w-full px-3 py-2 rounded-lg text-sm border outline-none cursor-pointer"
                                    style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                                >
                                    {(Object.keys(PROVIDER_LABELS) as LLMProvider[]).map((p) => (
                                        <option key={p} value={p}>
                                            {PROVIDER_LABELS[p]}{tenantDefaults?.provider === p ? ' ★ Tenant Default' : ''}
                                        </option>
                                    ))}
                                </select>
                                {tenantDefaults && config.provider !== tenantDefaults.provider && (
                                    <p className="text-xs mt-1" style={{ color: 'var(--color-warning, #f59e0b)' }}>
                                        ⚠ Tenant mặc định dùng {PROVIDER_LABELS[(tenantDefaults.provider as LLMProvider)] || tenantDefaults.provider}. Chọn provider khác có thể cần API key riêng.
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className="block text-xs mb-1" style={{ color: 'var(--color-fg-muted)' }}>Model</label>
                                <input
                                    type="text"
                                    value={config.model}
                                    onChange={(e) => setConfig((p) => ({ ...p, model: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                                    style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                                    placeholder={PROVIDER_DEFAULT_MODELS[config.provider] || 'model-name'}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs mb-1" style={{ color: 'var(--color-fg-muted)' }}>
                                        Temperature: {config.temperature}
                                    </label>
                                    <input
                                        type="range"
                                        min={0}
                                        max={2}
                                        step={0.1}
                                        value={config.temperature}
                                        onChange={(e) => setConfig((p) => ({ ...p, temperature: Number(e.target.value) }))}
                                        className="w-full"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs mb-1" style={{ color: 'var(--color-fg-muted)' }}>Max Tokens</label>
                                    <input
                                        type="number"
                                        value={config.maxTokens}
                                        onChange={(e) => setConfig((p) => ({ ...p, maxTokens: Number(e.target.value) }))}
                                        min={256}
                                        max={128000}
                                        step={256}
                                        className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                                        style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Multi-Agent Settings */}
                        <div className="rounded-xl border p-5 space-y-4 mt-4" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                            <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--color-fg)' }}>
                                <Network size={14} /> Multi-Agent Settings
                            </h3>

                            {/* Allow Transfer Toggle */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <label className="block text-xs font-medium" style={{ color: 'var(--color-fg)' }}>Allow Agent Transfer</label>
                                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-fg-muted)' }}>Enable this agent to transfer conversations to other agents</p>
                                </div>
                                <button
                                    onClick={() => setConfig((p) => ({ ...p, allowTransfer: !p.allowTransfer }))}
                                    className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${
                                        config.allowTransfer ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'
                                    }`}
                                >
                                    <span
                                        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                                            config.allowTransfer ? 'translate-x-5' : 'translate-x-0.5'
                                        }`}
                                    />
                                </button>
                            </div>

                            {/* Sub-Agents */}
                            <div>
                                <label className="block text-xs font-medium mb-2" style={{ color: 'var(--color-fg)' }}>
                                    Sub-Agents ({config.subAgents.length})
                                </label>
                                <p className="text-xs mb-3" style={{ color: 'var(--color-fg-muted)' }}>
                                    Add child agents that this agent can delegate tasks to
                                </p>

                                {/* Existing sub-agents */}
                                <div className="space-y-2 mb-3">
                                    {config.subAgents.map((sa, idx) => (
                                        <div
                                            key={sa.agentConfigId || idx}
                                            className="flex items-center gap-2 px-3 py-2 rounded-lg border"
                                            style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
                                        >
                                            <Bot size={13} style={{ color: 'var(--color-primary)' }} />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-medium truncate" style={{ color: 'var(--color-fg)' }}>{sa.name}</p>
                                                <p className="text-xs truncate" style={{ color: 'var(--color-fg-muted)' }}>{sa.description}</p>
                                            </div>
                                            <button
                                                onClick={() => setConfig((p) => ({ ...p, subAgents: p.subAgents.filter((_, i) => i !== idx) }))}
                                                className="p-1 cursor-pointer hover:text-red-400 transition-colors"
                                                style={{ color: 'var(--color-fg-muted)' }}
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                {/* Add from saved agents */}
                                {savedAgents.length > 0 && (
                                    <div>
                                        <label className="block text-xs mb-1" style={{ color: 'var(--color-fg-muted)' }}>Add from existing agents</label>
                                        <div className="flex flex-wrap gap-1.5">
                                            {savedAgents
                                                .filter((a) => !config.subAgents.find((sa) => sa.agentConfigId === a._id))
                                                .map((agent) => (
                                                    <button
                                                        key={agent._id}
                                                        onClick={() =>
                                                            setConfig((p) => ({
                                                                ...p,
                                                                subAgents: [
                                                                    ...p.subAgents,
                                                                    { agentConfigId: agent._id, name: agent.name, description: agent.persona || '' },
                                                                ],
                                                            }))
                                                        }
                                                        className="flex items-center gap-1 px-2 py-1 rounded-md border text-xs cursor-pointer hover:border-[var(--color-primary)] transition-colors"
                                                        style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                                                    >
                                                        <Plus size={10} /> {agent.name}
                                                    </button>
                                                ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>)}
                </div>
            </div>

            {/* Right Panel — Preview */}
            {previewOpen && (
                <div className="w-80 shrink-0 border-l overflow-y-auto p-4 space-y-4" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-fg)' }}>Agent Preview</h3>
                        <button onClick={() => setPreviewOpen(false)} className="p-1 cursor-pointer" style={{ color: 'var(--color-fg-muted)' }}>
                            <X size={14} />
                        </button>
                    </div>

                    <div className="rounded-xl border p-4 space-y-3" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
                        <div className="flex items-center gap-2">
                            <Bot size={20} style={{ color: 'var(--color-primary)' }} />
                            <span className="font-semibold text-sm" style={{ color: 'var(--color-fg)' }}>{config.name || 'Unnamed Agent'}</span>
                        </div>
                        {config.description && <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>{config.description}</p>}
                    </div>

                    <div className="space-y-2">
                        <p className="text-xs font-semibold" style={{ color: 'var(--color-fg-muted)' }}>PROVIDER</p>
                        <p className="text-xs font-mono px-2 py-1 rounded" style={{ background: 'var(--color-bg)', color: 'var(--color-fg)' }}>{PROVIDER_LABELS[config.provider]}</p>
                    </div>

                    <div className="space-y-2">
                        <p className="text-xs font-semibold" style={{ color: 'var(--color-fg-muted)' }}>MODEL</p>
                        <p className="text-xs font-mono px-2 py-1 rounded" style={{ background: 'var(--color-bg)', color: 'var(--color-fg)' }}>{config.model}</p>
                    </div>

                    <div className="space-y-2">
                        <p className="text-xs font-semibold" style={{ color: 'var(--color-fg-muted)' }}>SKILLS ({config.skills.length})</p>
                        {config.skills.map((s) => (
                            <div key={s.id} className="text-xs px-2 py-1 rounded flex items-center gap-1.5" style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary-light)' }}>
                                <Brain size={10} /> {s.name}
                            </div>
                        ))}
                    </div>

                    <div className="space-y-2">
                        <p className="text-xs font-semibold" style={{ color: 'var(--color-fg-muted)' }}>TOOLS ({config.tools.length})</p>
                        {config.tools.map((t) => (
                            <div key={t.id} className="text-xs px-2 py-1 rounded flex items-center gap-1.5" style={{ background: 'var(--color-bg)', color: 'var(--color-fg-muted)' }}>
                                <Zap size={10} /> {t.name}
                            </div>
                        ))}
                    </div>

                    {config.subAgents.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-xs font-semibold" style={{ color: 'var(--color-fg-muted)' }}>SUB-AGENTS ({config.subAgents.length})</p>
                            {config.subAgents.map((sa) => (
                                <div key={sa.agentConfigId} className="text-xs px-2 py-1 rounded flex items-center gap-1.5" style={{ background: 'var(--color-bg)', color: 'var(--color-fg-muted)' }}>
                                    <Network size={10} /> {sa.name}
                                </div>
                            ))}
                        </div>
                    )}

                    {config.allowTransfer && (
                        <div className="flex items-center gap-1.5 text-xs px-2 py-1 rounded" style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary-light)' }}>
                            <ArrowRightLeft size={10} /> Agent Transfer Enabled
                        </div>
                    )}

                    <div className="space-y-1">
                        <p className="text-xs font-semibold" style={{ color: 'var(--color-fg-muted)' }}>PERSONA</p>
                        <p className="text-xs italic" style={{ color: 'var(--color-fg-soft)' }}>
                            "{config.persona || 'No persona set'}"
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
