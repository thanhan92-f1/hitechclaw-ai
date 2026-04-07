import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Play, Loader2, Globe, Sparkles, Wrench, Copy, Check,
    ChevronDown, ChevronRight, MessageSquare, AlertCircle,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { getDomain, executeDomainTool, installDomain } from '../lib/api';

interface ToolParam {
    type: string;
    description?: string;
    items?: { type: string };
}

interface Tool {
    name: string;
    description: string;
    parameters?: {
        type: string;
        properties: Record<string, ToolParam>;
        required?: string[];
    };
}

interface Skill {
    id: string;
    name: string;
    description: string;
    tools?: Tool[];
}

interface DomainDetail {
    id: string;
    name: string;
    description: string;
    icon: string;
    skills: Skill[];
    installed?: boolean;
}

interface ToolResult {
    toolName: string;
    success: boolean;
    data?: any;
    error?: string;
    timestamp: Date;
}

export function DomainWorkspacePage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [domain, setDomain] = useState<DomainDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTool, setActiveTool] = useState<{ skillId: string; tool: Tool } | null>(null);
    const [formValues, setFormValues] = useState<Record<string, string>>({});
    const [executing, setExecuting] = useState(false);
    const [results, setResults] = useState<ToolResult[]>([]);
    const [copied, setCopied] = useState<string | null>(null);
    const [expandedSkill, setExpandedSkill] = useState<string | null>(null);
    const [installing, setInstalling] = useState(false);

    useEffect(() => {
        if (!id) return;
        getDomain(id)
            .then((d) => {
                setDomain(d);
                // Auto-expand first skill
                if (d?.skills?.length) setExpandedSkill(d.skills[0].id);
            })
            .catch(() => null)
            .finally(() => setLoading(false));
    }, [id]);

    const selectTool = (skillId: string, tool: Tool) => {
        setActiveTool({ skillId, tool });
        setFormValues({});
    };

    const handleExecute = async () => {
        if (!activeTool || !domain || !id) return;
        setExecuting(true);

        // Parse form values
        const params: Record<string, unknown> = {};
        const props = activeTool.tool.parameters?.properties || {};
        for (const [key, val] of Object.entries(formValues)) {
            if (!val.trim()) continue;
            const propDef = props[key];
            if (propDef?.type === 'number') {
                params[key] = Number(val);
            } else if (propDef?.type === 'boolean') {
                params[key] = val === 'true';
            } else if (propDef?.type === 'array') {
                params[key] = val.split(',').map((s) => s.trim()).filter(Boolean);
            } else {
                params[key] = val;
            }
        }

        try {
            const result = await executeDomainTool(id, activeTool.skillId, activeTool.tool.name, params);
            setResults((prev) => [{
                toolName: activeTool.tool.name,
                success: result.success !== false,
                data: result.data ?? result,
                timestamp: new Date(),
            }, ...prev]);
        } catch (err: any) {
            setResults((prev) => [{
                toolName: activeTool.tool.name,
                success: false,
                error: err.message || 'Execution failed',
                timestamp: new Date(),
            }, ...prev]);
        }
        setExecuting(false);
    };

    const handleInstall = async () => {
        if (!id) return;
        setInstalling(true);
        try {
            await installDomain(id);
            setDomain((prev) => prev ? { ...prev, installed: true } : prev);
        } catch { /* ignore */ }
        setInstalling(false);
    };

    const copyResult = (text: string, idx: number) => {
        navigator.clipboard.writeText(text);
        setCopied(String(idx));
        setTimeout(() => setCopied(null), 2000);
    };

    const formatResult = (data: any): string => {
        if (typeof data === 'string') return data;
        if (data?._llmTool) return `🤖 LLM Tool Prompt:\n\n${data.toolPrompt}`;
        return JSON.stringify(data, null, 2);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
            </div>
        );
    }

    if (!domain) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-3">
                <Globe size={32} style={{ color: 'var(--color-fg-muted)', opacity: 0.3 }} />
                <p className="text-sm" style={{ color: 'var(--color-fg-muted)' }}>Domain not found</p>
                <button onClick={() => navigate('/domains')} className="text-xs cursor-pointer" style={{ color: 'var(--color-primary)' }}>
                    Back to Domains
                </button>
            </div>
        );
    }

    // Not installed
    if (!domain.installed) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4">
                <span className="text-4xl">{domain.icon}</span>
                <h2 className="text-lg font-bold" style={{ color: 'var(--color-fg)' }}>{domain.name}</h2>
                <p className="text-xs max-w-md text-center" style={{ color: 'var(--color-fg-muted)' }}>
                    Install this domain to access its workspace and tools.
                </p>
                <button
                    onClick={handleInstall}
                    disabled={installing}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                    style={{ background: 'var(--color-primary)', color: 'white' }}
                >
                    {installing ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                    Install & Open Workspace
                </button>
                <button onClick={() => navigate('/domains')} className="text-xs cursor-pointer" style={{ color: 'var(--color-fg-muted)' }}>
                    Back to Domains
                </button>
            </div>
        );
    }

    return (
        <div className="h-full flex">
            {/* Left: Skill & Tool Sidebar */}
            <div className="w-72 border-r flex flex-col overflow-y-auto shrink-0" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-surface)' }}>
                {/* Header */}
                <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
                    <button
                        onClick={() => navigate('/domains')}
                        className="flex items-center gap-1 text-[10px] mb-2 cursor-pointer transition-colors"
                        style={{ color: 'var(--color-fg-muted)' }}
                    >
                        <ArrowLeft size={10} /> Domains
                    </button>
                    <div className="flex items-center gap-2">
                        <span className="text-xl">{domain.icon}</span>
                        <div>
                            <h2 className="text-sm font-bold" style={{ color: 'var(--color-fg)' }}>{domain.name}</h2>
                            <p className="text-[10px]" style={{ color: 'var(--color-fg-muted)' }}>{domain.skills.length} skills</p>
                        </div>
                    </div>
                </div>

                {/* Skills & Tools */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {domain.skills.map((skill) => (
                        <div key={skill.id}>
                            <button
                                onClick={() => setExpandedSkill(expandedSkill === skill.id ? null : skill.id)}
                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left cursor-pointer transition-colors"
                                style={{ color: 'var(--color-fg)' }}
                            >
                                <Sparkles size={11} style={{ color: 'var(--color-primary)' }} />
                                <span className="flex-1 text-xs font-medium truncate">{skill.name}</span>
                                {expandedSkill === skill.id ? <ChevronDown size={11} style={{ color: 'var(--color-fg-muted)' }} />
                                    : <ChevronRight size={11} style={{ color: 'var(--color-fg-muted)' }} />}
                            </button>
                            {expandedSkill === skill.id && skill.tools && (
                                <div className="ml-4 space-y-0.5 mt-0.5">
                                    {skill.tools.map((tool) => (
                                        <button
                                            key={tool.name}
                                            onClick={() => selectTool(skill.id, tool)}
                                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left cursor-pointer transition-colors"
                                            style={{
                                                background: activeTool?.tool.name === tool.name ? 'var(--color-primary-soft)' : 'transparent',
                                                color: activeTool?.tool.name === tool.name ? 'var(--color-primary-light)' : 'var(--color-fg-muted)',
                                            }}
                                        >
                                            <Wrench size={10} />
                                            <span className="text-[11px] truncate">{tool.name}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Chat shortcut */}
                <div className="p-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                    <button
                        onClick={() => navigate('/chat')}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                        style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary-light)' }}
                    >
                        <MessageSquare size={12} /> Chat as {domain.name}
                    </button>
                </div>
            </div>

            {/* Right: Tool Form & Results */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {!activeTool ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-3">
                        <Wrench size={32} style={{ color: 'var(--color-fg-muted)', opacity: 0.2 }} />
                        <p className="text-sm" style={{ color: 'var(--color-fg-muted)' }}>Select a tool from the sidebar to get started</p>
                        <p className="text-xs max-w-sm text-center" style={{ color: 'var(--color-fg-muted)', opacity: 0.7 }}>
                            Each domain has specialized tools. Fill in the parameters and execute to see results.
                        </p>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {/* Tool Header */}
                        <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-surface)' }}>
                            <div className="flex items-center gap-2">
                                <Wrench size={14} style={{ color: 'var(--color-primary)' }} />
                                <div>
                                    <h3 className="text-sm font-bold" style={{ color: 'var(--color-fg)' }}>{activeTool.tool.name}</h3>
                                    <p className="text-[11px]" style={{ color: 'var(--color-fg-muted)' }}>{activeTool.tool.description}</p>
                                </div>
                            </div>
                        </div>

                        {/* Tool Form */}
                        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                            {/* Parameters */}
                            {activeTool.tool.parameters?.properties && Object.keys(activeTool.tool.parameters.properties).length > 0 && (
                                <div className="space-y-3">
                                    <h4 className="text-xs font-semibold" style={{ color: 'var(--color-fg)' }}>Parameters</h4>
                                    {Object.entries(activeTool.tool.parameters.properties).map(([key, prop]) => {
                                        const isRequired = activeTool.tool.parameters?.required?.includes(key);
                                        const isTextArea = prop.type === 'string' && (
                                            key === 'text' || key === 'rawInput' || key === 'code' || key === 'description' || key === 'data' ||
                                            key === 'customerMessage' || key === 'context' || key === 'prompt'
                                        );
                                        return (
                                            <div key={key}>
                                                <label className="flex items-center gap-1 text-xs font-medium mb-1" style={{ color: 'var(--color-fg)' }}>
                                                    {key}
                                                    {isRequired && <span style={{ color: 'var(--color-destructive)' }}>*</span>}
                                                    <span className="text-[10px] font-normal ml-1" style={{ color: 'var(--color-fg-muted)' }}>
                                                        ({prop.type}{prop.items ? `<${prop.items.type}>` : ''})
                                                    </span>
                                                </label>
                                                {prop.description && (
                                                    <p className="text-[10px] mb-1" style={{ color: 'var(--color-fg-muted)' }}>{prop.description}</p>
                                                )}
                                                {prop.type === 'boolean' ? (
                                                    <select
                                                        value={formValues[key] || ''}
                                                        onChange={(e) => setFormValues({ ...formValues, [key]: e.target.value })}
                                                        className="w-full px-3 py-1.5 rounded-lg border text-xs focus:outline-none"
                                                        style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                                                    >
                                                        <option value="">— select —</option>
                                                        <option value="true">true</option>
                                                        <option value="false">false</option>
                                                    </select>
                                                ) : isTextArea ? (
                                                    <textarea
                                                        value={formValues[key] || ''}
                                                        onChange={(e) => setFormValues({ ...formValues, [key]: e.target.value })}
                                                        placeholder={prop.description || key}
                                                        rows={4}
                                                        className="w-full px-3 py-2 rounded-lg border text-xs resize-none focus:outline-none"
                                                        style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                                                    />
                                                ) : (
                                                    <input
                                                        type={prop.type === 'number' ? 'number' : 'text'}
                                                        value={formValues[key] || ''}
                                                        onChange={(e) => setFormValues({ ...formValues, [key]: e.target.value })}
                                                        placeholder={prop.description || key}
                                                        className="w-full px-3 py-1.5 rounded-lg border text-xs focus:outline-none"
                                                        style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                                                    />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Execute Button */}
                            <button
                                onClick={handleExecute}
                                disabled={executing}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                                style={{ background: 'var(--color-primary)', color: 'white' }}
                            >
                                {executing ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                                Execute
                            </button>

                            {/* Results */}
                            {results.length > 0 && (
                                <div className="space-y-3 mt-4">
                                    <h4 className="text-xs font-semibold" style={{ color: 'var(--color-fg)' }}>
                                        Results ({results.length})
                                    </h4>
                                    {results.map((r, idx) => (
                                        <div
                                            key={idx}
                                            className="rounded-lg border overflow-hidden"
                                            style={{ borderColor: r.success ? 'var(--color-border)' : 'var(--color-destructive)', background: 'var(--color-bg-surface)' }}
                                        >
                                            <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
                                                <div className="flex items-center gap-2">
                                                    {r.success ? (
                                                        <Check size={12} style={{ color: 'var(--color-success)' }} />
                                                    ) : (
                                                        <AlertCircle size={12} style={{ color: 'var(--color-destructive)' }} />
                                                    )}
                                                    <span className="text-[11px] font-medium" style={{ color: 'var(--color-fg)' }}>{r.toolName}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px]" style={{ color: 'var(--color-fg-muted)' }}>
                                                        {r.timestamp.toLocaleTimeString()}
                                                    </span>
                                                    <button
                                                        onClick={() => copyResult(r.error || formatResult(r.data), idx)}
                                                        className="cursor-pointer"
                                                        style={{ color: 'var(--color-fg-muted)' }}
                                                    >
                                                        {copied === String(idx) ? <Check size={12} style={{ color: 'var(--color-success)' }} /> : <Copy size={12} />}
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="px-3 py-2 text-xs overflow-x-auto" style={{ color: 'var(--color-fg)' }}>
                                                {r.error ? (
                                                    <p style={{ color: 'var(--color-destructive)' }}>{r.error}</p>
                                                ) : r.data?._llmTool ? (
                                                    <div>
                                                        <div className="flex items-center gap-1 mb-2 text-[10px] px-2 py-1 rounded-md" style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary-light)' }}>
                                                            <MessageSquare size={10} /> AI-powered tool — Result generated by LLM
                                                        </div>
                                                        <div className="prose prose-sm max-w-none" style={{ color: 'var(--color-fg)' }}>
                                                            <ReactMarkdown>{r.data.toolPrompt}</ReactMarkdown>
                                                        </div>
                                                    </div>
                                                ) : typeof r.data === 'object' ? (
                                                    <div>
                                                        {r.data.note ? (
                                                            <div className="prose prose-sm max-w-none" style={{ color: 'var(--color-fg)' }}>
                                                                <ReactMarkdown>{r.data.note}</ReactMarkdown>
                                                            </div>
                                                        ) : r.data.gitignore ? (
                                                            <pre className="font-mono text-[11px] whitespace-pre-wrap p-2 rounded" style={{ background: 'var(--color-bg)' }}>
                                                                {r.data.gitignore}
                                                            </pre>
                                                        ) : r.data.interactions ? (
                                                            <div className="space-y-2">
                                                                <p className="text-[11px]">
                                                                    Checked <strong>{r.data.drugCount}</strong> drugs: {r.data.drugs?.join(', ')}
                                                                </p>
                                                                {r.data.interactionCount === 0 ? (
                                                                    <p className="text-[11px] px-2 py-1 rounded" style={{ background: 'rgba(34,197,94,0.1)', color: 'rgb(34,197,94)' }}>
                                                                        ✅ No known interactions found
                                                                    </p>
                                                                ) : (
                                                                    <div className="space-y-1.5">
                                                                        {r.data.interactions.map((int: any, i: number) => (
                                                                            <div key={i} className="px-2.5 py-1.5 rounded-md border" style={{
                                                                                borderColor: int.severity === 'critical' ? 'rgb(239,68,68)' : int.severity === 'high' ? 'rgb(245,158,11)' : 'var(--color-border)',
                                                                                background: int.severity === 'critical' ? 'rgba(239,68,68,0.06)' : int.severity === 'high' ? 'rgba(245,158,11,0.06)' : 'var(--color-bg)',
                                                                            }}>
                                                                                <div className="flex items-center gap-2">
                                                                                    <span className="text-[10px] font-bold uppercase px-1 py-0.5 rounded" style={{
                                                                                        background: int.severity === 'critical' ? 'rgb(239,68,68)' : int.severity === 'high' ? 'rgb(245,158,11)' : 'var(--color-primary)',
                                                                                        color: 'white',
                                                                                    }}>{int.severity}</span>
                                                                                    <span className="text-[11px] font-medium">{int.drug1} + {int.drug2}</span>
                                                                                </div>
                                                                                <p className="text-[10px] mt-1" style={{ color: 'var(--color-fg-muted)' }}>{int.description}</p>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                                {r.data.disclaimer && (
                                                                    <p className="text-[10px] mt-2 px-2 py-1 rounded" style={{ background: 'rgba(245,158,11,0.08)', color: 'rgb(245,158,11)' }}>
                                                                        {r.data.disclaimer}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        ) : r.data.suggestions ? (
                                                            <div className="space-y-2">
                                                                <p className="text-[11px]">Query: <strong>{r.data.query}</strong></p>
                                                                {r.data.suggestions.length === 0 ? (
                                                                    <p className="text-[11px]" style={{ color: 'var(--color-fg-muted)' }}>No matching codes found.</p>
                                                                ) : (
                                                                    <div className="space-y-1">
                                                                        {r.data.suggestions.map((s: any, i: number) => (
                                                                            <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-md" style={{ background: 'var(--color-bg)' }}>
                                                                                <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded" style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary-light)' }}>
                                                                                    {s.code}
                                                                                </span>
                                                                                <span className="text-[11px] flex-1">{s.description}</span>
                                                                                <span className="text-[10px]" style={{ color: 'var(--color-fg-muted)' }}>score: {s.relevance}</span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                                {r.data.disclaimer && (
                                                                    <p className="text-[10px] mt-2 px-2 py-1 rounded" style={{ background: 'rgba(245,158,11,0.08)', color: 'rgb(245,158,11)' }}>
                                                                        {r.data.disclaimer}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <pre className="font-mono text-[11px] whitespace-pre-wrap p-2 rounded" style={{ background: 'var(--color-bg)' }}>
                                                                {JSON.stringify(r.data, null, 2)}
                                                            </pre>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <p className="whitespace-pre-wrap">{String(r.data)}</p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
