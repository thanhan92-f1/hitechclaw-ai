import {
    Activity,
    AlertCircle,
    AlertTriangle,
    Bot,
    Bug,
    ChevronLeft, ChevronRight,
    Clock,
    Filter,
    Globe,
    Info,
    RefreshCw,
    ScrollText,
    Search,
    User,
    X,
    Zap,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { getActivityLogs, getAuditLogs, getLLMLogs, getSystemLogs } from '../lib/api';

type LogTab = 'system' | 'audit' | 'activity' | 'llm';

const PAGE_SIZE = 50;

// ─── Demo data ─────────────────────────────────────────────
const DEMO_LOGS: Record<string, any[]> = {
    system: [
        { _id: 'sl-1', timestamp: '2026-03-31T10:15:32Z', level: 'info', message: 'Server started successfully on port 3000', source: 'server', metadata: { uptime: '0s', nodeVersion: 'v22.12.0' } },
        { _id: 'sl-2', timestamp: '2026-03-31T10:15:30Z', level: 'info', message: 'MongoDB connected: hitechclaw_dev', source: 'database', metadata: { host: 'mongodb:27017' } },
        { _id: 'sl-3', timestamp: '2026-03-31T10:15:28Z', level: 'info', message: 'PostgreSQL migrations completed (13 tables)', source: 'database', metadata: { duration: '1.2s' } },
        { _id: 'sl-4', timestamp: '2026-03-31T10:14:55Z', level: 'info', message: 'Redis connected', source: 'cache', metadata: { host: 'redis:6379' } },
        { _id: 'sl-5', timestamp: '2026-03-31T09:45:12Z', level: 'warn', message: 'Rate limit approaching: 85% capacity for tenant tenant-001', source: 'guardrails', metadata: { tenant: 'tenant-001', limit: 100, current: 85 } },
        { _id: 'sl-6', timestamp: '2026-03-31T09:30:01Z', level: 'error', message: 'Ollama connection refused — model qwen2.5:14b not responding', source: 'llm', metadata: { provider: 'ollama', model: 'qwen2.5:14b', retryCount: 3 } },
        { _id: 'sl-7', timestamp: '2026-03-31T09:28:45Z', level: 'info', message: 'MCP server "doc-mcp" connected with 3 tools', source: 'mcp', metadata: { server: 'doc-mcp', tools: ['search_docs', 'read_doc', 'list_docs'] } },
        { _id: 'sl-8', timestamp: '2026-03-31T09:15:00Z', level: 'info', message: 'Scheduled backup completed for MongoDB', source: 'backup', metadata: { size: '245MB', duration: '12.3s' } },
        { _id: 'sl-9', timestamp: '2026-03-31T08:52:30Z', level: 'warn', message: 'Prompt injection attempt detected and blocked', source: 'guardrails', metadata: { sessionId: 'sess-abc123', severity: 'high' } },
        { _id: 'sl-10', timestamp: '2026-03-31T08:30:00Z', level: 'info', message: 'Seed data loaded: 3 tenants, 5 roles, 12 permissions', source: 'seed', metadata: {} },
        { _id: 'sl-11', timestamp: '2026-03-30T23:00:00Z', level: 'info', message: 'Daily analytics aggregation completed', source: 'analytics', metadata: { conversations: 87, messages: 634 } },
        { _id: 'sl-12', timestamp: '2026-03-30T22:45:12Z', level: 'debug', message: 'Workflow "Customer Support Auto-Reply" executed successfully', source: 'workflow', metadata: { workflowId: 'wf-001', duration: '3.2s' } },
        { _id: 'sl-13', timestamp: '2026-03-30T18:22:01Z', level: 'error', message: 'Gmail integration token expired for user admin@hitechclaw.dev', source: 'integrations', metadata: { integration: 'gmail', userId: 'user-001' } },
        { _id: 'sl-14', timestamp: '2026-03-30T16:10:33Z', level: 'info', message: 'Healthcare plugin loaded: 6 skills, 4 API routes', source: 'plugins', metadata: { plugin: 'healthcare', version: '1.0.0' } },
        { _id: 'sl-15', timestamp: '2026-03-30T14:05:00Z', level: 'info', message: 'TeeForge.AI plugin loaded: 5 skills, 5 API routes', source: 'plugins', metadata: { plugin: 'shirtgen', version: '1.0.0' } },
    ],
    audit: [
        { _id: 'al-1', timestamp: '2026-03-31T10:12:00Z', action: 'user.login', userId: 'admin', details: 'Login via password', ip: '192.168.1.100', userAgent: 'Mozilla/5.0 Chrome/133' },
        { _id: 'al-2', timestamp: '2026-03-31T10:05:00Z', action: 'agent.config.update', userId: 'admin', details: 'Updated agent "General Assistant" — changed model to qwen2.5:14b', ip: '192.168.1.100' },
        { _id: 'al-3', timestamp: '2026-03-31T09:50:00Z', action: 'workflow.create', userId: 'admin', details: 'Created workflow "Slack Alert on Error"', ip: '192.168.1.100' },
        { _id: 'al-4', timestamp: '2026-03-31T09:30:00Z', action: 'channel.activate', userId: 'admin', details: 'Activated Telegram channel "HiTechClaw Bot"', ip: '192.168.1.100' },
        { _id: 'al-5', timestamp: '2026-03-30T16:20:00Z', action: 'role.assign', userId: 'admin', details: 'Assigned role "doctor" to user drsmith@hospital.com', ip: '10.0.1.50' },
        { _id: 'al-6', timestamp: '2026-03-30T15:00:00Z', action: 'tenant.settings.update', userId: 'admin', details: 'Updated security policy to "strict"', ip: '192.168.1.100' },
        { _id: 'al-7', timestamp: '2026-03-30T11:30:00Z', action: 'user.create', userId: 'admin', details: 'Created user devuser@hitechclaw.dev with role "developer"', ip: '192.168.1.100' },
        { _id: 'al-8', timestamp: '2026-03-29T14:00:00Z', action: 'apikey.create', userId: 'admin', details: 'Created API key "CI/CD Pipeline" with scope: read,write', ip: '192.168.1.100' },
        { _id: 'al-9', timestamp: '2026-03-29T10:00:00Z', action: 'plugin.install', userId: 'admin', details: 'Installed plugin "healthcare" v1.0.0', ip: '192.168.1.100' },
        { _id: 'al-10', timestamp: '2026-03-28T09:00:00Z', action: 'user.login', userId: 'devuser', details: 'Login via OAuth (GitHub)', ip: '172.16.0.5' },
    ],
    activity: [
        { _id: 'ac-1', timestamp: '2026-03-31T10:14:00Z', method: 'POST', path: '/api/chat', status: 200, duration: 1250, userId: 'admin', ip: '192.168.1.100' },
        { _id: 'ac-2', timestamp: '2026-03-31T10:13:30Z', method: 'GET', path: '/api/agent-configs', status: 200, duration: 45, userId: 'admin', ip: '192.168.1.100' },
        { _id: 'ac-3', timestamp: '2026-03-31T10:12:00Z', method: 'POST', path: '/api/auth/login', status: 200, duration: 320, userId: 'admin', ip: '192.168.1.100' },
        { _id: 'ac-4', timestamp: '2026-03-31T10:10:00Z', method: 'GET', path: '/api/plugins', status: 200, duration: 23, userId: 'anonymous', ip: '192.168.1.100' },
        { _id: 'ac-5', timestamp: '2026-03-31T09:55:00Z', method: 'POST', path: '/api/chat', status: 200, duration: 2340, userId: 'devuser', ip: '172.16.0.5' },
        { _id: 'ac-6', timestamp: '2026-03-31T09:45:00Z', method: 'GET', path: '/api/analytics/overview', status: 200, duration: 156, userId: 'admin', ip: '192.168.1.100' },
        { _id: 'ac-7', timestamp: '2026-03-31T09:40:00Z', method: 'POST', path: '/api/plugins/healthcare/api/drug-interaction', status: 200, duration: 890, userId: 'drsmith', ip: '10.0.1.50' },
        { _id: 'ac-8', timestamp: '2026-03-31T09:35:00Z', method: 'GET', path: '/api/workflows', status: 200, duration: 67, userId: 'admin', ip: '192.168.1.100' },
        { _id: 'ac-9', timestamp: '2026-03-31T09:30:00Z', method: 'POST', path: '/api/knowledge/upload', status: 201, duration: 4500, userId: 'admin', ip: '192.168.1.100' },
        { _id: 'ac-10', timestamp: '2026-03-31T09:20:00Z', method: 'DELETE', path: '/api/sessions/old-session-123', status: 204, duration: 34, userId: 'admin', ip: '192.168.1.100' },
        { _id: 'ac-11', timestamp: '2026-03-31T09:10:00Z', method: 'PUT', path: '/api/agent-configs/config-1', status: 200, duration: 89, userId: 'admin', ip: '192.168.1.100' },
        { _id: 'ac-12', timestamp: '2026-03-31T08:50:00Z', method: 'GET', path: '/api/mcp/tools', status: 200, duration: 112, userId: 'admin', ip: '192.168.1.100' },
    ],
    llm: [
        { _id: 'll-1', timestamp: '2026-03-31T10:14:00Z', provider: 'ollama', model: 'qwen2.5:14b', promptTokens: 1250, completionTokens: 430, totalTokens: 1680, latencyMs: 1180, success: true, cost: 0, sessionId: 'sess-demo-1' },
        { _id: 'll-2', timestamp: '2026-03-31T10:10:00Z', provider: 'anthropic', model: 'claude-sonnet-4-20250514', promptTokens: 2100, completionTokens: 890, totalTokens: 2990, latencyMs: 1420, success: true, cost: 0.0089, sessionId: 'sess-demo-2' },
        { _id: 'll-3', timestamp: '2026-03-31T09:55:00Z', provider: 'ollama', model: 'qwen2.5:14b', promptTokens: 850, completionTokens: 320, totalTokens: 1170, latencyMs: 780, success: true, cost: 0, sessionId: 'sess-demo-3' },
        { _id: 'll-4', timestamp: '2026-03-31T09:45:00Z', provider: 'openai', model: 'gpt-4o-mini', promptTokens: 1500, completionTokens: 600, totalTokens: 2100, latencyMs: 650, success: true, cost: 0.0012, sessionId: 'sess-demo-4' },
        { _id: 'll-5', timestamp: '2026-03-31T09:30:00Z', provider: 'ollama', model: 'qwen2.5:14b', promptTokens: 3200, completionTokens: 1100, totalTokens: 4300, latencyMs: 2800, success: false, cost: 0, error: 'Context length exceeded', sessionId: 'sess-demo-5' },
        { _id: 'll-6', timestamp: '2026-03-31T09:20:00Z', provider: 'google', model: 'gemini-2.0-flash', promptTokens: 900, completionTokens: 450, totalTokens: 1350, latencyMs: 520, success: true, cost: 0.0004, sessionId: 'sess-demo-6' },
        { _id: 'll-7', timestamp: '2026-03-31T09:10:00Z', provider: 'ollama', model: 'qwen2.5vl:7b', promptTokens: 1800, completionTokens: 550, totalTokens: 2350, latencyMs: 1950, success: true, cost: 0, sessionId: 'sess-demo-7' },
        { _id: 'll-8', timestamp: '2026-03-31T08:50:00Z', provider: 'anthropic', model: 'claude-3-5-haiku-20241022', promptTokens: 680, completionTokens: 290, totalTokens: 970, latencyMs: 390, success: true, cost: 0.0003, sessionId: 'sess-demo-8' },
    ],
};

// ─── Level badge colors ────────────────────────────────────
function levelColor(level: string) {
    switch (level) {
        case 'fatal': return { bg: 'rgba(220,38,38,0.15)', fg: '#ef4444' };
        case 'error': return { bg: 'rgba(239,68,68,0.15)', fg: '#f87171' };
        case 'warn': return { bg: 'rgba(234,179,8,0.15)', fg: '#eab308' };
        case 'info': return { bg: 'rgba(59,130,246,0.15)', fg: '#60a5fa' };
        case 'debug': return { bg: 'rgba(107,114,128,0.15)', fg: '#9ca3af' };
        default: return { bg: 'rgba(107,114,128,0.1)', fg: '#6b7280' };
    }
}

function levelIcon(level: string) {
    switch (level) {
        case 'fatal': case 'error': return <AlertCircle size={13} />;
        case 'warn': return <AlertTriangle size={13} />;
        case 'info': return <Info size={13} />;
        case 'debug': return <Bug size={13} />;
        default: return <Info size={13} />;
    }
}

function statusColor(code: number) {
    if (code >= 500) return '#ef4444';
    if (code >= 400) return '#eab308';
    if (code >= 300) return '#60a5fa';
    return '#22c55e';
}

function formatDate(d: string) {
    try { return new Date(d).toLocaleString('vi-VN', { hour12: false }); }
    catch { return d; }
}

function formatDuration(ms: number) {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
}

export function SystemLogsPage() {
    const [tab, setTab] = useState<LogTab>('system');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [logs, setLogs] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [expandedRow, setExpandedRow] = useState<string | null>(null);

    // Filters
    const [searchText, setSearchText] = useState('');
    const [levelFilter, setLevelFilter] = useState('');
    const [sourceFilter, setSourceFilter] = useState('');
    const [methodFilter, setMethodFilter] = useState('');
    const [providerFilter, setProviderFilter] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    const loadLogs = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const base = { limit: PAGE_SIZE, offset: page * PAGE_SIZE };
            let res: any;
            switch (tab) {
                case 'system':
                    res = await getSystemLogs({
                        ...base,
                        level: levelFilter || undefined,
                        source: sourceFilter || undefined,
                        search: searchText || undefined,
                    });
                    break;
                case 'audit':
                    res = await getAuditLogs({
                        ...base,
                        action: searchText || undefined,
                    });
                    break;
                case 'activity':
                    res = await getActivityLogs({
                        ...base,
                        method: methodFilter || undefined,
                        path: searchText || undefined,
                    });
                    break;
                case 'llm':
                    res = await getLLMLogs({
                        ...base,
                        provider: providerFilter || undefined,
                        success: undefined,
                    });
                    break;
            }
            const fetchedLogs = res.logs || [];
            if (fetchedLogs.length > 0) {
                setLogs(fetchedLogs);
                setTotal(res.total ?? fetchedLogs.length);
            } else {
                const demo = DEMO_LOGS[tab] || [];
                setLogs(demo);
                setTotal(demo.length);
            }
        } catch {
            const demo = DEMO_LOGS[tab] || [];
            setLogs(demo);
            setTotal(demo.length);
        } finally {
            setLoading(false);
        }
    }, [tab, page, searchText, levelFilter, sourceFilter, methodFilter, providerFilter]);

    useEffect(() => {
        loadLogs();
    }, [loadLogs]);

    // Reset page & filters on tab change
    function switchTab(t: LogTab) {
        setTab(t);
        setPage(0);
        setSearchText('');
        setLevelFilter('');
        setSourceFilter('');
        setMethodFilter('');
        setProviderFilter('');
        setExpandedRow(null);
    }

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const TABS: { key: LogTab; label: string; icon: React.ReactNode; desc: string }[] = [
        { key: 'system', label: 'System Logs', icon: <ScrollText size={14} />, desc: 'Errors, warnings, debug messages' },
        { key: 'audit', label: 'Audit Logs', icon: <User size={14} />, desc: 'User actions & RBAC events' },
        { key: 'activity', label: 'API Activity', icon: <Globe size={14} />, desc: 'HTTP requests & responses' },
        { key: 'llm', label: 'LLM Logs', icon: <Bot size={14} />, desc: 'AI model calls & token usage' },
    ];

    return (
        <div className="h-full overflow-y-auto p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-light))' }}>
                            <ScrollText size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold" style={{ color: 'var(--color-fg)' }}>System Logs</h1>
                            <p className="text-sm" style={{ color: 'var(--color-fg-muted)' }}>Monitor system activity, debug errors, and track API usage</p>
                        </div>
                    </div>
                    <button
                        onClick={loadLogs}
                        disabled={loading}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer"
                        style={{ background: 'var(--color-bg-soft)', color: 'var(--color-fg)', border: '1px solid var(--color-border)' }}
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>

                {/* Error alert */}
                {error && (
                    <div className="mb-4 p-3 rounded-lg flex items-center gap-2 text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                        <AlertCircle size={14} /> {error}
                        <button onClick={() => setError('')} className="ml-auto cursor-pointer"><X size={14} /></button>
                    </div>
                )}

                {/* Tabs */}
                <div className="flex gap-1 mb-4 p-1 rounded-xl" style={{ background: 'var(--color-bg-soft)' }}>
                    {TABS.map((t) => (
                        <button
                            key={t.key}
                            onClick={() => switchTab(t.key)}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer"
                            style={{
                                background: tab === t.key ? 'var(--color-bg)' : 'transparent',
                                color: tab === t.key ? 'var(--color-primary-light)' : 'var(--color-fg-muted)',
                                boxShadow: tab === t.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                            }}
                        >
                            {t.icon} {t.label}
                        </button>
                    ))}
                </div>

                {/* Search & Filters */}
                <div className="flex items-center gap-2 mb-4">
                    <div className="flex-1 relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-fg-muted)' }} />
                        <input
                            type="text"
                            value={searchText}
                            onChange={(e) => { setSearchText(e.target.value); setPage(0); }}
                            placeholder={
                                tab === 'system' ? 'Search log messages...' :
                                    tab === 'audit' ? 'Filter by action...' :
                                        tab === 'activity' ? 'Filter by path...' : 'Search LLM logs...'
                            }
                            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm"
                            style={{ background: 'var(--color-bg-soft)', color: 'var(--color-fg)', border: '1px solid var(--color-border)' }}
                        />
                    </div>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-all cursor-pointer"
                        style={{
                            background: showFilters ? 'var(--color-primary-soft)' : 'var(--color-bg-soft)',
                            color: showFilters ? 'var(--color-primary-light)' : 'var(--color-fg-muted)',
                            border: '1px solid var(--color-border)',
                        }}
                    >
                        <Filter size={14} /> Filters
                    </button>
                </div>

                {/* Filter bar */}
                {showFilters && (
                    <div className="flex flex-wrap gap-2 mb-4 p-3 rounded-lg" style={{ background: 'var(--color-bg-soft)', border: '1px solid var(--color-border)' }}>
                        {tab === 'system' && (
                            <>
                                <select
                                    value={levelFilter}
                                    onChange={(e) => { setLevelFilter(e.target.value); setPage(0); }}
                                    className="px-2 py-1.5 rounded-md text-xs"
                                    style={{ background: 'var(--color-bg)', color: 'var(--color-fg)', border: '1px solid var(--color-border)' }}
                                >
                                    <option value="">All Levels</option>
                                    <option value="fatal">Fatal</option>
                                    <option value="error">Error</option>
                                    <option value="warn">Warning</option>
                                    <option value="info">Info</option>
                                    <option value="debug">Debug</option>
                                </select>
                                <input
                                    type="text"
                                    value={sourceFilter}
                                    onChange={(e) => { setSourceFilter(e.target.value); setPage(0); }}
                                    placeholder="Source..."
                                    className="px-2 py-1.5 rounded-md text-xs w-32"
                                    style={{ background: 'var(--color-bg)', color: 'var(--color-fg)', border: '1px solid var(--color-border)' }}
                                />
                            </>
                        )}
                        {tab === 'activity' && (
                            <select
                                value={methodFilter}
                                onChange={(e) => { setMethodFilter(e.target.value); setPage(0); }}
                                className="px-2 py-1.5 rounded-md text-xs"
                                style={{ background: 'var(--color-bg)', color: 'var(--color-fg)', border: '1px solid var(--color-border)' }}
                            >
                                <option value="">All Methods</option>
                                <option value="GET">GET</option>
                                <option value="POST">POST</option>
                                <option value="PUT">PUT</option>
                                <option value="DELETE">DELETE</option>
                                <option value="PATCH">PATCH</option>
                            </select>
                        )}
                        {tab === 'llm' && (
                            <input
                                type="text"
                                value={providerFilter}
                                onChange={(e) => { setProviderFilter(e.target.value); setPage(0); }}
                                placeholder="Provider (e.g. ollama, openai)..."
                                className="px-2 py-1.5 rounded-md text-xs w-48"
                                style={{ background: 'var(--color-bg)', color: 'var(--color-fg)', border: '1px solid var(--color-border)' }}
                            />
                        )}
                    </div>
                )}

                {/* Stats bar */}
                <div className="flex items-center justify-between mb-3 text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                    <span>{total} log{total !== 1 ? 's' : ''} found</span>
                    <span>Page {page + 1} / {totalPages}</span>
                </div>

                {/* Log table */}
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="animate-spin w-6 h-6 border-2 border-t-transparent rounded-full" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-2" style={{ color: 'var(--color-fg-muted)' }}>
                            <ScrollText size={32} className="opacity-30" />
                            <p className="text-sm">No logs found</p>
                        </div>
                    ) : (
                        <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                            {tab === 'system' && <SystemLogRows logs={logs} expandedRow={expandedRow} setExpandedRow={setExpandedRow} />}
                            {tab === 'audit' && <AuditLogRows logs={logs} expandedRow={expandedRow} setExpandedRow={setExpandedRow} />}
                            {tab === 'activity' && <ActivityLogRows logs={logs} expandedRow={expandedRow} setExpandedRow={setExpandedRow} />}
                            {tab === 'llm' && <LLMLogRows logs={logs} expandedRow={expandedRow} setExpandedRow={setExpandedRow} />}
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-4">
                        <button
                            onClick={() => setPage(Math.max(0, page - 1))}
                            disabled={page === 0}
                            className="p-2 rounded-lg transition-all cursor-pointer disabled:opacity-30"
                            style={{ background: 'var(--color-bg-soft)', color: 'var(--color-fg)' }}
                        >
                            <ChevronLeft size={16} />
                        </button>
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            const startPage = Math.max(0, Math.min(page - 2, totalPages - 5));
                            const p = startPage + i;
                            if (p >= totalPages) return null;
                            return (
                                <button
                                    key={p}
                                    onClick={() => setPage(p)}
                                    className="w-8 h-8 rounded-lg text-xs font-medium transition-all cursor-pointer"
                                    style={{
                                        background: p === page ? 'var(--color-primary)' : 'var(--color-bg-soft)',
                                        color: p === page ? '#fff' : 'var(--color-fg-muted)',
                                    }}
                                >
                                    {p + 1}
                                </button>
                            );
                        })}
                        <button
                            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                            disabled={page >= totalPages - 1}
                            className="p-2 rounded-lg transition-all cursor-pointer disabled:opacity-30"
                            style={{ background: 'var(--color-bg-soft)', color: 'var(--color-fg)' }}
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── System Log Rows ────────────────────────────────────────
function SystemLogRows({ logs, expandedRow, setExpandedRow }: { logs: any[]; expandedRow: string | null; setExpandedRow: (id: string | null) => void }) {
    return (
        <>
            {logs.map((log: any) => {
                const id = log._id ?? log.id ?? `${log.createdAt}-${log.source}`;
                const lc = levelColor(log.level);
                const expanded = expandedRow === id;
                return (
                    <div key={id}>
                        <button
                            onClick={() => setExpandedRow(expanded ? null : id)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors cursor-pointer hover:brightness-110"
                            style={{ background: expanded ? 'var(--color-bg-soft)' : 'transparent' }}
                        >
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 min-w-[60px] justify-center"
                                style={{ background: lc.bg, color: lc.fg }}>
                                {levelIcon(log.level)} {log.level}
                            </span>
                            <span className="text-[10px] shrink-0 tabular-nums w-[130px]" style={{ color: 'var(--color-fg-muted)' }}>
                                {formatDate(log.createdAt)}
                            </span>
                            {log.source && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] shrink-0" style={{ background: 'var(--color-bg-soft)', color: 'var(--color-fg-muted)' }}>
                                    {log.source}
                                </span>
                            )}
                            <span className="flex-1 truncate" style={{ color: 'var(--color-fg)' }}>{log.message}</span>
                        </button>
                        {expanded && (
                            <div className="px-4 py-3 text-xs space-y-2 border-t" style={{ background: 'var(--color-bg-soft)', borderColor: 'var(--color-border)' }}>
                                <div style={{ color: 'var(--color-fg)' }}>
                                    <strong>Message:</strong> <span className="whitespace-pre-wrap">{log.message}</span>
                                </div>
                                {log.error && (
                                    <div style={{ color: '#f87171' }}>
                                        <strong>Error:</strong> <pre className="mt-1 p-2 rounded overflow-x-auto text-[11px]" style={{ background: 'rgba(239,68,68,0.05)' }}>{typeof log.error === 'string' ? log.error : JSON.stringify(log.error, null, 2)}</pre>
                                    </div>
                                )}
                                {log.metadata && Object.keys(log.metadata).length > 0 && (
                                    <div>
                                        <strong style={{ color: 'var(--color-fg-muted)' }}>Metadata:</strong>
                                        <pre className="mt-1 p-2 rounded overflow-x-auto text-[11px]" style={{ background: 'var(--color-bg)', color: 'var(--color-fg)' }}>{JSON.stringify(log.metadata, null, 2)}</pre>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </>
    );
}

// ─── Audit Log Rows ─────────────────────────────────────────
function AuditLogRows({ logs, expandedRow, setExpandedRow }: { logs: any[]; expandedRow: string | null; setExpandedRow: (id: string | null) => void }) {
    return (
        <>
            {logs.map((log: any) => {
                const id = log._id ?? log.id ?? `${log.createdAt}-${log.action}`;
                const expanded = expandedRow === id;
                return (
                    <div key={id}>
                        <button
                            onClick={() => setExpandedRow(expanded ? null : id)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors cursor-pointer hover:brightness-110"
                            style={{ background: expanded ? 'var(--color-bg-soft)' : 'transparent' }}
                        >
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0"
                                style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
                                <Activity size={11} /> {log.action}
                            </span>
                            <span className="text-[10px] shrink-0 tabular-nums w-[130px]" style={{ color: 'var(--color-fg-muted)' }}>
                                {formatDate(log.createdAt)}
                            </span>
                            {log.resource && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] shrink-0" style={{ background: 'var(--color-bg-soft)', color: 'var(--color-fg-muted)' }}>
                                    {log.resource}
                                </span>
                            )}
                            <span className="flex-1 truncate" style={{ color: 'var(--color-fg)' }}>
                                {log.resourceId ? `${log.resource}:${log.resourceId}` : log.action}
                            </span>
                            {log.userId && (
                                <span className="text-[10px] shrink-0" style={{ color: 'var(--color-fg-muted)' }}>
                                    <User size={10} className="inline mr-0.5" />{log.userId.slice(0, 8)}
                                </span>
                            )}
                        </button>
                        {expanded && (
                            <div className="px-4 py-3 text-xs space-y-2 border-t" style={{ background: 'var(--color-bg-soft)', borderColor: 'var(--color-border)' }}>
                                <div className="grid grid-cols-2 gap-2">
                                    <div><strong style={{ color: 'var(--color-fg-muted)' }}>User ID:</strong> <span style={{ color: 'var(--color-fg)' }}>{log.userId || '—'}</span></div>
                                    <div><strong style={{ color: 'var(--color-fg-muted)' }}>Tenant:</strong> <span style={{ color: 'var(--color-fg)' }}>{log.tenantId || '—'}</span></div>
                                    <div><strong style={{ color: 'var(--color-fg-muted)' }}>IP:</strong> <span style={{ color: 'var(--color-fg)' }}>{log.ip || '—'}</span></div>
                                    <div><strong style={{ color: 'var(--color-fg-muted)' }}>Resource ID:</strong> <span style={{ color: 'var(--color-fg)' }}>{log.resourceId || '—'}</span></div>
                                </div>
                                {log.details && (
                                    <div>
                                        <strong style={{ color: 'var(--color-fg-muted)' }}>Details:</strong>
                                        <pre className="mt-1 p-2 rounded overflow-x-auto text-[11px]" style={{ background: 'var(--color-bg)', color: 'var(--color-fg)' }}>{typeof log.details === 'string' ? log.details : JSON.stringify(log.details, null, 2)}</pre>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </>
    );
}

// ─── Activity Log Rows ──────────────────────────────────────
function ActivityLogRows({ logs, expandedRow, setExpandedRow }: { logs: any[]; expandedRow: string | null; setExpandedRow: (id: string | null) => void }) {
    return (
        <>
            {logs.map((log: any) => {
                const id = log._id ?? log.id ?? `${log.createdAt}-${log.path}`;
                const expanded = expandedRow === id;
                const sc = statusColor(log.statusCode ?? 200);
                return (
                    <div key={id}>
                        <button
                            onClick={() => setExpandedRow(expanded ? null : id)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors cursor-pointer hover:brightness-110"
                            style={{ background: expanded ? 'var(--color-bg-soft)' : 'transparent' }}
                        >
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold shrink-0 min-w-[48px] text-center"
                                style={{ background: 'var(--color-bg-soft)', color: sc }}>
                                {log.method}
                            </span>
                            <span className="text-[10px] font-mono shrink-0 min-w-[30px] text-center" style={{ color: sc }}>
                                {log.statusCode}
                            </span>
                            <span className="text-[10px] shrink-0 tabular-nums w-[130px]" style={{ color: 'var(--color-fg-muted)' }}>
                                {formatDate(log.createdAt)}
                            </span>
                            <span className="flex-1 truncate font-mono text-xs" style={{ color: 'var(--color-fg)' }}>{log.path}</span>
                            {log.duration !== undefined && (
                                <span className="text-[10px] shrink-0 tabular-nums" style={{ color: log.duration > 1000 ? '#eab308' : 'var(--color-fg-muted)' }}>
                                    <Clock size={10} className="inline mr-0.5" />{formatDuration(log.duration)}
                                </span>
                            )}
                        </button>
                        {expanded && (
                            <div className="px-4 py-3 text-xs space-y-2 border-t" style={{ background: 'var(--color-bg-soft)', borderColor: 'var(--color-border)' }}>
                                <div className="grid grid-cols-3 gap-2">
                                    <div><strong style={{ color: 'var(--color-fg-muted)' }}>User ID:</strong> <span style={{ color: 'var(--color-fg)' }}>{log.userId || '—'}</span></div>
                                    <div><strong style={{ color: 'var(--color-fg-muted)' }}>Tenant:</strong> <span style={{ color: 'var(--color-fg)' }}>{log.tenantId || '—'}</span></div>
                                    <div><strong style={{ color: 'var(--color-fg-muted)' }}>IP:</strong> <span style={{ color: 'var(--color-fg)' }}>{log.ip || '—'}</span></div>
                                    <div><strong style={{ color: 'var(--color-fg-muted)' }}>Response Size:</strong> <span style={{ color: 'var(--color-fg)' }}>{log.responseSize ? `${log.responseSize} bytes` : '—'}</span></div>
                                    <div><strong style={{ color: 'var(--color-fg-muted)' }}>Duration:</strong> <span style={{ color: 'var(--color-fg)' }}>{log.duration ? formatDuration(log.duration) : '—'}</span></div>
                                    <div><strong style={{ color: 'var(--color-fg-muted)' }}>Session:</strong> <span style={{ color: 'var(--color-fg)' }}>{log.sessionId || '—'}</span></div>
                                </div>
                                {log.userAgent && (
                                    <div>
                                        <strong style={{ color: 'var(--color-fg-muted)' }}>User Agent:</strong>
                                        <span className="ml-1" style={{ color: 'var(--color-fg)' }}>{log.userAgent}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </>
    );
}

// ─── LLM Log Rows ───────────────────────────────────────────
function LLMLogRows({ logs, expandedRow, setExpandedRow }: { logs: any[]; expandedRow: string | null; setExpandedRow: (id: string | null) => void }) {
    return (
        <>
            {logs.map((log: any) => {
                const id = log._id ?? log.id ?? `${log.createdAt}-${log.provider}`;
                const expanded = expandedRow === id;
                const ok = log.success !== false;
                return (
                    <div key={id}>
                        <button
                            onClick={() => setExpandedRow(expanded ? null : id)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors cursor-pointer hover:brightness-110"
                            style={{ background: expanded ? 'var(--color-bg-soft)' : 'transparent' }}
                        >
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: ok ? '#22c55e' : '#ef4444' }} />
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold shrink-0"
                                style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa' }}>
                                {log.provider}
                            </span>
                            <span className="text-[10px] shrink-0 font-mono" style={{ color: 'var(--color-fg-muted)' }}>
                                {log.model}
                            </span>
                            <span className="text-[10px] shrink-0 tabular-nums w-[130px]" style={{ color: 'var(--color-fg-muted)' }}>
                                {formatDate(log.createdAt)}
                            </span>
                            <span className="flex-1" />
                            <span className="text-[10px] shrink-0 tabular-nums" style={{ color: 'var(--color-fg-muted)' }}>
                                <Zap size={10} className="inline mr-0.5" />{log.totalTokens ?? ((log.promptTokens ?? 0) + (log.completionTokens ?? 0))} tokens
                            </span>
                            {log.duration !== undefined && (
                                <span className="text-[10px] shrink-0 tabular-nums" style={{ color: log.duration > 5000 ? '#eab308' : 'var(--color-fg-muted)' }}>
                                    <Clock size={10} className="inline mr-0.5" />{formatDuration(log.duration)}
                                </span>
                            )}
                            {log.costUsd !== undefined && log.costUsd > 0 && (
                                <span className="text-[10px] shrink-0 tabular-nums font-medium" style={{ color: '#22c55e' }}>
                                    ${log.costUsd.toFixed(4)}
                                </span>
                            )}
                        </button>
                        {expanded && (
                            <div className="px-4 py-3 text-xs space-y-2 border-t" style={{ background: 'var(--color-bg-soft)', borderColor: 'var(--color-border)' }}>
                                <div className="grid grid-cols-3 gap-2">
                                    <div><strong style={{ color: 'var(--color-fg-muted)' }}>Provider:</strong> <span style={{ color: 'var(--color-fg)' }}>{log.provider}</span></div>
                                    <div><strong style={{ color: 'var(--color-fg-muted)' }}>Model:</strong> <span style={{ color: 'var(--color-fg)' }}>{log.model}</span></div>
                                    <div><strong style={{ color: 'var(--color-fg-muted)' }}>Success:</strong> <span style={{ color: ok ? '#22c55e' : '#ef4444' }}>{ok ? 'Yes' : 'No'}</span></div>
                                    <div><strong style={{ color: 'var(--color-fg-muted)' }}>Prompt Tokens:</strong> <span style={{ color: 'var(--color-fg)' }}>{log.promptTokens ?? 0}</span></div>
                                    <div><strong style={{ color: 'var(--color-fg-muted)' }}>Completion Tokens:</strong> <span style={{ color: 'var(--color-fg)' }}>{log.completionTokens ?? 0}</span></div>
                                    <div><strong style={{ color: 'var(--color-fg-muted)' }}>Total Tokens:</strong> <span style={{ color: 'var(--color-fg)' }}>{log.totalTokens ?? ((log.promptTokens ?? 0) + (log.completionTokens ?? 0))}</span></div>
                                    <div><strong style={{ color: 'var(--color-fg-muted)' }}>Duration:</strong> <span style={{ color: 'var(--color-fg)' }}>{log.duration ? formatDuration(log.duration) : '—'}</span></div>
                                    <div><strong style={{ color: 'var(--color-fg-muted)' }}>Cost:</strong> <span style={{ color: 'var(--color-fg)' }}>{log.costUsd !== undefined ? `$${log.costUsd.toFixed(6)}` : '—'}</span></div>
                                    <div><strong style={{ color: 'var(--color-fg-muted)' }}>Streaming:</strong> <span style={{ color: 'var(--color-fg)' }}>{log.streaming ? 'Yes' : 'No'}</span></div>
                                    <div><strong style={{ color: 'var(--color-fg-muted)' }}>User ID:</strong> <span style={{ color: 'var(--color-fg)' }}>{log.userId || '—'}</span></div>
                                    <div><strong style={{ color: 'var(--color-fg-muted)' }}>Session:</strong> <span style={{ color: 'var(--color-fg)' }}>{log.sessionId || '—'}</span></div>
                                    <div><strong style={{ color: 'var(--color-fg-muted)' }}>Platform:</strong> <span style={{ color: 'var(--color-fg)' }}>{log.platform || '—'}</span></div>
                                </div>
                                {log.error && (
                                    <div style={{ color: '#f87171' }}>
                                        <strong>Error:</strong>
                                        <pre className="mt-1 p-2 rounded overflow-x-auto text-[11px]" style={{ background: 'rgba(239,68,68,0.05)' }}>{typeof log.error === 'string' ? log.error : JSON.stringify(log.error, null, 2)}</pre>
                                    </div>
                                )}
                                {log.toolCalls && log.toolCalls.length > 0 && (
                                    <div>
                                        <strong style={{ color: 'var(--color-fg-muted)' }}>Tool Calls ({log.toolCalls.length}):</strong>
                                        <pre className="mt-1 p-2 rounded overflow-x-auto text-[11px]" style={{ background: 'var(--color-bg)', color: 'var(--color-fg)' }}>{JSON.stringify(log.toolCalls, null, 2)}</pre>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </>
    );
}
