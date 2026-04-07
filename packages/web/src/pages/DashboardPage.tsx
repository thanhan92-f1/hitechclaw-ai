import { useState, useEffect } from 'react';
import {
    Activity, Database, MessageSquare, Cpu, FileText, Zap,
    TrendingUp, Users, Globe, Workflow, Bot, Radio,
    ArrowUpRight, Clock, Sparkles, Shield,
} from 'lucide-react';
import { getHealth, getKnowledge } from '../lib/api';

interface HealthData {
    status: string;
    version: string;
    uptime: number;
    timestamp: string;
}

interface KBData {
    stats: { totalDocuments: number; totalChunks: number };
}

function formatUptime(seconds: number): string {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    return `${h}h ${m}m`;
}

const GRADIENT_COLORS = [
    { from: '#6366f1', to: '#8b5cf6', bg: 'rgba(99, 102, 241, 0.12)' },
    { from: '#06b6d4', to: '#22d3ee', bg: 'rgba(6, 182, 212, 0.12)' },
    { from: '#10b981', to: '#34d399', bg: 'rgba(16, 185, 129, 0.12)' },
    { from: '#f59e0b', to: '#fbbf24', bg: 'rgba(245, 158, 11, 0.12)' },
];

export function DashboardPage() {
    const [health, setHealth] = useState<HealthData | null>(null);
    const [kb, setKB] = useState<KBData | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        getHealth().then(setHealth).catch(() => setError('Server unreachable'));
        getKnowledge().then(setKB).catch(() => { });
    }, []);

    const isOnline = health?.status === 'ok';

    const stats = [
        {
            icon: Activity,
            label: 'System Status',
            value: isOnline ? 'Online' : 'Offline',
            gradient: isOnline ? GRADIENT_COLORS[2] : { from: '#ef4444', to: '#f87171', bg: 'rgba(239,68,68,0.12)' },
            detail: isOnline ? 'All systems operational' : 'Connection lost',
        },
        {
            icon: Cpu,
            label: 'Uptime',
            value: health ? formatUptime(health.uptime) : '—',
            gradient: GRADIENT_COLORS[1],
            detail: `v${health?.version ?? '2.0.0'}`,
        },
        {
            icon: FileText,
            label: 'Documents',
            value: kb?.stats?.totalDocuments?.toString() ?? '0',
            gradient: GRADIENT_COLORS[0],
            detail: `${kb?.stats?.totalChunks ?? 0} chunks indexed`,
        },
        {
            icon: Database,
            label: 'KB Size',
            value: kb?.stats?.totalChunks?.toString() ?? '0',
            gradient: GRADIENT_COLORS[2],
            detail: 'Vector embeddings',
        },
    ];

    const quickActions = [
        { icon: MessageSquare, title: 'AI Chat', desc: 'Start a conversation', href: '/chat', gradient: GRADIENT_COLORS[0] },
        { icon: Database, title: 'Knowledge Base', desc: 'Upload & manage documents', href: '/knowledge', gradient: GRADIENT_COLORS[2] },
        { icon: Zap, title: 'RAG Search', desc: 'Semantic knowledge search', href: '/search', gradient: GRADIENT_COLORS[1] },
        { icon: Workflow, title: 'Workflows', desc: 'Visual automation builder', href: '/workflows', gradient: GRADIENT_COLORS[3] },
        { icon: Bot, title: 'Agent Manager', desc: 'Configure AI agents', href: '/agents', gradient: GRADIENT_COLORS[0] },
        { icon: Radio, title: 'Channels', desc: 'Messaging integrations', href: '/channels', gradient: GRADIENT_COLORS[1] },
    ];

    const capabilities = [
        { icon: Globe, label: '13 Domain Packs', desc: 'Industry-specialized AI', href: '/domains' },
        { icon: Cpu, label: 'Multi-LLM', desc: 'OpenAI, Anthropic, Ollama & more', href: '/models' },
        { icon: Shield, label: 'RBAC', desc: '60 granular permissions', href: '/settings/users' },
        { icon: Sparkles, label: 'ML/AutoML', desc: '12 ML algorithms', href: '/ml' },
    ];

    return (
        <div className="h-full overflow-y-auto">
            {/* Hero Section */}
            <div
                className="relative overflow-hidden border-b"
                style={{ borderColor: 'rgba(255,255,255,0.06)' }}
            >
                {/* Enhanced gradient mesh */}
                <div
                    className="absolute inset-0"
                    style={{
                        background: `
                            radial-gradient(ellipse at 20% 50%, rgba(99, 102, 241, 0.12) 0%, transparent 50%),
                            radial-gradient(ellipse at 80% 20%, rgba(6, 182, 212, 0.08) 0%, transparent 50%),
                            radial-gradient(ellipse at 60% 80%, rgba(16, 185, 129, 0.06) 0%, transparent 50%),
                            radial-gradient(ellipse at 40% 30%, rgba(139, 92, 246, 0.06) 0%, transparent 40%)
                        `,
                    }}
                />
                <div className="relative max-w-6xl mx-auto px-6 py-10">
                    <div className="flex items-center gap-4 mb-2">
                        <div
                            className="w-12 h-12 rounded-2xl flex items-center justify-center"
                            style={{
                                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                boxShadow: '0 4px 20px rgba(99, 102, 241, 0.35)',
                            }}
                        >
                            <Sparkles size={22} color="#fff" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold" style={{ color: '#f4f4f5' }}>
                                Welcome to HiTechClaw
                            </h1>
                            <p className="text-sm" style={{ color: '#71717a' }}>
                                Open-source AI Agent Platform — Multi-industry, Multi-tenant
                            </p>
                        </div>
                    </div>

                    {error && (
                        <div
                            className="mt-4 px-4 py-3 rounded-xl text-sm flex items-center gap-2"
                            style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.15)' }}
                        >
                            <Activity size={14} /> {error}
                        </div>
                    )}
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 py-6 space-y-8">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {stats.map((stat, i) => (
                        <div
                            key={stat.label}
                            className="glass-card relative rounded-2xl p-5 hover-lift overflow-hidden transition-all duration-300"
                            style={{
                                animationDelay: `${i * 80}ms`,
                            }}
                        >
                            {/* Subtle gradient glow */}
                            <div
                                className="absolute top-0 right-0 w-28 h-28 rounded-full opacity-25 blur-2xl"
                                style={{ background: `linear-gradient(135deg, ${stat.gradient.from}, ${stat.gradient.to})` }}
                            />
                            <div className="relative">
                                <div className="flex items-center gap-3 mb-4">
                                    <div
                                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                                        style={{ background: stat.gradient.bg }}
                                    >
                                        <stat.icon size={18} style={{ color: stat.gradient.from }} />
                                    </div>
                                    <span className="text-xs font-medium" style={{ color: '#a1a1aa' }}>
                                        {stat.label}
                                    </span>
                                </div>
                                <p className="text-2xl font-bold mb-1" style={{ color: stat.gradient.from }}>
                                    {stat.value}
                                </p>
                                <p className="text-[11px]" style={{ color: '#71717a' }}>
                                    {stat.detail}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Quick Actions */}
                <div>
                    <div className="flex items-center gap-2 mb-4">
                        <Zap size={16} style={{ color: 'var(--color-primary)' }} />
                        <h2 className="text-sm font-semibold" style={{ color: 'var(--color-fg)' }}>
                            Quick Actions
                        </h2>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {quickActions.map((action) => (
                            <a
                                key={action.title}
                                href={action.href}
                                className="group glass-card relative rounded-xl p-4 hover-lift transition-all duration-300"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div
                                        className="w-9 h-9 rounded-lg flex items-center justify-center"
                                        style={{ background: action.gradient.bg }}
                                    >
                                        <action.icon size={17} style={{ color: action.gradient.from }} />
                                    </div>
                                    <ArrowUpRight
                                        size={14}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                                        style={{ color: '#71717a' }}
                                    />
                                </div>
                                <h3 className="text-sm font-semibold mb-0.5" style={{ color: '#e4e4e7' }}>
                                    {action.title}
                                </h3>
                                <p className="text-[11px]" style={{ color: '#71717a' }}>
                                    {action.desc}
                                </p>
                            </a>
                        ))}
                    </div>
                </div>

                {/* Platform Capabilities */}
                <div>
                    <div className="flex items-center gap-2 mb-4">
                        <TrendingUp size={16} style={{ color: 'var(--color-accent)' }} />
                        <h2 className="text-sm font-semibold" style={{ color: 'var(--color-fg)' }}>
                            Platform Capabilities
                        </h2>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {capabilities.map((cap) => (
                            <a
                                key={cap.label}
                                href={cap.href}
                                className="rounded-xl p-4 hover-lift hover-border-glow"
                                style={{
                                    background: 'var(--color-bg-surface)',
                                    border: '1px solid var(--color-border)',
                                }}
                            >
                                <cap.icon size={18} style={{ color: 'var(--color-primary-light)' }} className="mb-2" />
                                <h3 className="text-xs font-semibold mb-0.5" style={{ color: 'var(--color-fg)' }}>
                                    {cap.label}
                                </h3>
                                <p className="text-[11px]" style={{ color: 'var(--color-fg-muted)' }}>
                                    {cap.desc}
                                </p>
                            </a>
                        ))}
                    </div>
                </div>

                {/* System Information */}
                {health && (
                    <div
                        className="rounded-2xl p-5 hover-border-glow"
                        style={{
                            background: 'var(--color-bg-surface)',
                            border: '1px solid var(--color-border)',
                        }}
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <Clock size={14} style={{ color: 'var(--color-fg-muted)' }} />
                            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-fg)' }}>
                                System Information
                            </h3>
                            <div className="flex items-center gap-1.5 ml-auto">
                                <span className={`status-dot ${isOnline ? 'status-dot-active' : 'status-dot-error'}`} />
                                <span className="text-[11px]" style={{ color: isOnline ? '#22c55e' : '#ef4444' }}>
                                    {isOnline ? 'Healthy' : 'Unhealthy'}
                                </span>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <InfoBlock label="Version" value={health.version} />
                            <InfoBlock label="Status" value={health.status} />
                            <InfoBlock label="Uptime" value={formatUptime(health.uptime)} />
                            <InfoBlock label="Last Check" value={new Date(health.timestamp).toLocaleTimeString()} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl p-3" style={{ background: 'var(--color-bg)' }}>
            <span className="text-[10px] font-medium" style={{ color: 'var(--color-fg-muted)' }}>
                {label}
            </span>
            <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--color-fg)' }}>
                {value}
            </p>
        </div>
    );
}
