import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Globe, Sparkles, Plug, MessageSquare, Loader2,
    Play, ChevronDown, ChevronRight, User, Wrench, Download, Trash2, Check,
} from 'lucide-react';
import { getDomain, getDomainPersona, installDomain, uninstallDomain } from '../lib/api';

interface Skill {
    id: string;
    name: string;
    description: string;
    tools?: Array<{ name: string; description: string; parameters?: any }>;
}

interface DomainDetail {
    id: string;
    name: string;
    description: string;
    icon: string;
    skills: Skill[];
    integrations?: string[];
    installed?: boolean;
}

export function DomainDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [domain, setDomain] = useState<DomainDetail | null>(null);
    const [persona, setPersona] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [expandedSkill, setExpandedSkill] = useState<string | null>(null);
    const [installed, setInstalled] = useState(false);
    const [installing, setInstalling] = useState(false);

    useEffect(() => {
        if (!id) return;
        Promise.all([
            getDomain(id).catch(() => null),
            getDomainPersona(id).catch(() => null),
        ]).then(([d, p]) => {
            setDomain(d);
            setPersona(p);
            if (d) setInstalled(!!d.installed);
            setLoading(false);
        });
    }, [id]);

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

    return (
        <div className="h-full overflow-y-auto">
            {/* Header */}
            <div className="px-6 pt-5 pb-4 border-b" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                <div className="max-w-4xl mx-auto">
                    <button
                        onClick={() => navigate('/domains')}
                        className="flex items-center gap-1 text-xs mb-3 cursor-pointer transition-colors"
                        style={{ color: 'var(--color-fg-muted)' }}
                    >
                        <ArrowLeft size={12} /> Back to Domains
                    </button>
                    <div className="flex items-start gap-3">
                        <span className="text-3xl">{domain.icon}</span>
                        <div className="flex-1">
                            <h1 className="text-xl font-bold" style={{ color: 'var(--color-fg)' }}>{domain.name}</h1>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--color-fg-muted)' }}>{domain.description}</p>
                            <div className="flex items-center gap-2 mt-2">
                                <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium"
                                    style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary-light)' }}
                                >
                                    <Sparkles size={9} /> {domain.skills?.length || 0} skills
                                </span>
                                {domain.integrations && domain.integrations.length > 0 && (
                                    <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium"
                                        style={{ background: 'var(--color-bg)', color: 'var(--color-fg-muted)' }}
                                    >
                                        <Plug size={9} /> {domain.integrations.length} integrations
                                    </span>
                                )}
                                {installed ? (
                                    <>
                                        <button
                                            onClick={() => navigate(`/domains/${domain.id}/workspace`)}
                                            className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-medium cursor-pointer transition-colors"
                                            style={{ background: 'var(--color-primary)', color: 'white' }}
                                        >
                                            <Wrench size={9} /> Open Workspace
                                        </button>
                                        <button
                                            onClick={() => navigate('/chat')}
                                            className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-medium cursor-pointer transition-colors"
                                            style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary-light)' }}
                                        >
                                            <MessageSquare size={9} /> Chat
                                        </button>
                                    </>
                                ) : null}
                                {domain.id === 'general' ? (
                                    <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-medium"
                                        style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary-light)' }}
                                    >
                                        <Check size={9} /> Default
                                    </span>
                                ) : installed ? (
                                    <button
                                        onClick={async () => { setInstalling(true); try { await uninstallDomain(domain.id); setInstalled(false); } catch { } setInstalling(false); }}
                                        disabled={installing}
                                        className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-medium cursor-pointer transition-colors"
                                        style={{ background: 'rgba(239,68,68,0.08)', color: 'rgb(239,68,68)' }}
                                    >
                                        {installing ? <Loader2 size={9} className="animate-spin" /> : <Trash2 size={9} />} Uninstall
                                    </button>
                                ) : (
                                    <button
                                        onClick={async () => { setInstalling(true); try { await installDomain(domain.id); setInstalled(true); } catch { } setInstalling(false); }}
                                        disabled={installing}
                                        className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-medium cursor-pointer transition-colors"
                                        style={{ background: 'var(--color-primary)', color: 'white' }}
                                    >
                                        {installing ? <Loader2 size={9} className="animate-spin" /> : <Download size={9} />} Install
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="px-6 py-5">
                <div className="max-w-4xl mx-auto space-y-4">
                    {/* Persona */}
                    {persona && (
                        <div className="p-4 rounded-xl border" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                            <div className="flex items-center gap-2 mb-2">
                                <User size={14} style={{ color: 'var(--color-primary)' }} />
                                <h3 className="text-xs font-semibold" style={{ color: 'var(--color-fg)' }}>Agent Persona</h3>
                            </div>
                            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-fg-muted)' }}>
                                {persona.systemPrompt || persona.description || 'No persona defined for this domain.'}
                            </p>
                        </div>
                    )}

                    {/* Integrations */}
                    {domain.integrations && domain.integrations.length > 0 && (
                        <div className="p-4 rounded-xl border" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                            <div className="flex items-center gap-2 mb-2">
                                <Plug size={14} style={{ color: 'var(--color-primary)' }} />
                                <h3 className="text-xs font-semibold" style={{ color: 'var(--color-fg)' }}>Recommended Integrations</h3>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {domain.integrations.map((int) => (
                                    <span key={int} className="text-[11px] px-2.5 py-1 rounded-md border font-medium"
                                        style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg-muted)' }}
                                    >
                                        {int}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Skills */}
                    <div className="p-4 rounded-xl border" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                        <div className="flex items-center gap-2 mb-3">
                            <Sparkles size={14} style={{ color: 'var(--color-primary)' }} />
                            <h3 className="text-xs font-semibold" style={{ color: 'var(--color-fg)' }}>
                                Skills ({domain.skills?.length || 0})
                            </h3>
                        </div>
                        {domain.skills && domain.skills.length > 0 ? (
                            <div className="space-y-2">
                                {domain.skills.map((sk) => (
                                    <div key={sk.id} className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                                        <button
                                            onClick={() => setExpandedSkill(expandedSkill === sk.id ? null : sk.id)}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-left cursor-pointer transition-colors"
                                            style={{ background: expandedSkill === sk.id ? 'var(--color-bg-soft)' : 'var(--color-bg)' }}
                                        >
                                            <Wrench size={12} style={{ color: 'var(--color-primary)' }} />
                                            <div className="flex-1 min-w-0">
                                                <span className="text-xs font-medium" style={{ color: 'var(--color-fg)' }}>{sk.name}</span>
                                                {sk.description && (
                                                    <span className="text-[10px] ml-2" style={{ color: 'var(--color-fg-muted)' }}>— {sk.description}</span>
                                                )}
                                            </div>
                                            {sk.tools && sk.tools.length > 0 && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--color-bg)', color: 'var(--color-fg-muted)' }}>
                                                    {sk.tools.length} tools
                                                </span>
                                            )}
                                            {expandedSkill === sk.id ? <ChevronDown size={12} style={{ color: 'var(--color-fg-muted)' }} />
                                                : <ChevronRight size={12} style={{ color: 'var(--color-fg-muted)' }} />}
                                        </button>
                                        {expandedSkill === sk.id && sk.tools && (
                                            <div className="px-3 py-2 border-t space-y-1.5" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                                                {sk.tools.map((tool) => (
                                                    <div key={tool.name} className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs"
                                                        style={{ background: 'var(--color-bg)' }}
                                                    >
                                                        <Play size={10} style={{ color: 'var(--color-accent)' }} />
                                                        <div className="flex-1 min-w-0">
                                                            <span className="font-medium" style={{ color: 'var(--color-fg)' }}>{tool.name}</span>
                                                            {tool.description && (
                                                                <span className="text-[10px] ml-1.5" style={{ color: 'var(--color-fg-muted)' }}>{tool.description}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs py-4 text-center" style={{ color: 'var(--color-fg-muted)' }}>No skills registered for this domain.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
