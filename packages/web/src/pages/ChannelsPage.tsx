import { useState, useEffect } from 'react';
import {
    Radio, Plus, Trash2, Power, PowerOff, TestTube, RefreshCw,
    MessageSquare, ChevronRight, X, Eye, EyeOff, Pencil,
} from 'lucide-react';
import {
    getChannelTypes, getChannels, createChannel, updateChannel, deleteChannel,
    testChannel, activateChannel, deactivateChannel,
    getAgentSessions, getSessionMessages, getAgentConfigs,
} from '../lib/api';
import { useChannelsStore } from '../stores/index.js';

interface AgentConfigInfo {
    _id: string;
    name: string;
    llmConfig?: { provider?: string; model?: string };
    isDefault?: boolean;
}

interface SessionInfo {
    _id: string;
    platform: string;
    userId: string;
    title: string;
    createdAt: string;
    updatedAt: string;
}

interface MessageInfo {
    _id: string;
    sessionId: string;
    role: string;
    content: string;
    createdAt: string;
    metadata?: Record<string, unknown>;
}

export function ChannelsPage() {
    const { channels, channelTypes, setChannels, setChannelTypes } = useChannelsStore();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Modal states
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedType, setSelectedType] = useState<ChannelTypeInfo | null>(null);
    const [addForm, setAddForm] = useState<{ name: string; config: Record<string, string>; agentConfigId: string }>({ name: '', config: {}, agentConfigId: '' });
    const [adding, setAdding] = useState(false);
    const [agentConfigs, setAgentConfigs] = useState<AgentConfigInfo[]>([]);

    // Edit modal states
    const [editChannel, setEditChannel] = useState<ChannelConnection | null>(null);
    const [editForm, setEditForm] = useState<{ name: string; config: Record<string, string>; agentConfigId: string }>({ name: '', config: {}, agentConfigId: '' });
    const [saving, setSaving] = useState(false);

    // Sessions / Chat history
    const [tab, setTab] = useState<'channels' | 'history'>('channels');
    const [sessions, setSessions] = useState<SessionInfo[]>([]);
    const [selectedSession, setSelectedSession] = useState<SessionInfo | null>(null);
    const [messages, setMessages] = useState<MessageInfo[]>([]);
    const [loadingSessions, setLoadingSessions] = useState(false);
    const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        setLoading(true);
        try {
            const [typesRes, channelsRes, agentRes] = await Promise.all([
                getChannelTypes(),
                getChannels(),
                getAgentConfigs(),
            ]);
            setChannelTypes(typesRes.types || []);
            setChannels(channelsRes.channels || []);
            setAgentConfigs(agentRes.configs || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load data');
        } finally {
            setLoading(false);
        }
    }

    async function loadSessions() {
        setLoadingSessions(true);
        try {
            const res = await getAgentSessions();
            setSessions(res.sessions || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load sessions');
        } finally {
            setLoadingSessions(false);
        }
    }

    async function loadMessages(session: SessionInfo) {
        setSelectedSession(session);
        try {
            const res = await getSessionMessages(session._id);
            setMessages(res.messages || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load messages');
        }
    }

    function openAddModal(type: ChannelTypeInfo) {
        setSelectedType(type);
        const defaultAgent = agentConfigs.find(a => a.isDefault);
        setAddForm({ name: `My ${type.name} Bot`, config: {}, agentConfigId: defaultAgent?._id || '' });
        setShowAddModal(true);
    }

    async function handleAdd() {
        if (!selectedType) return;
        setAdding(true);
        setError('');
        try {
            await createChannel({
                channelType: selectedType.id,
                name: addForm.name,
                config: addForm.config,
                agentConfigId: addForm.agentConfigId || undefined,
            });
            setSuccess(`${selectedType.name} channel created!`);
            setShowAddModal(false);
            await loadData();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create channel');
        } finally {
            setAdding(false);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Delete this channel connection?')) return;
        try {
            await deleteChannel(id);
            setSuccess('Channel deleted');
            await loadData();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete');
        }
    }

    function openEditModal(ch: ChannelConnection) {
        setEditChannel(ch);
        setEditForm({
            name: ch.name,
            config: { ...ch.config },
            agentConfigId: ch.agentConfigId || '',
        });
        setShowPasswords({});
    }

    async function handleEdit() {
        if (!editChannel) return;
        setSaving(true);
        setError('');
        try {
            // Filter out masked values (containing ****) — don't overwrite secrets with mask
            const cleanConfig: Record<string, string> = {};
            for (const [key, val] of Object.entries(editForm.config)) {
                if (val && !val.includes('****')) {
                    cleanConfig[key] = val;
                }
            }
            await updateChannel(editChannel._id, {
                name: editForm.name,
                config: Object.keys(cleanConfig).length > 0 ? cleanConfig : undefined,
                agentConfigId: editForm.agentConfigId || undefined,
            });
            setSuccess('Channel updated!');
            setEditChannel(null);
            await loadData();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update channel');
        } finally {
            setSaving(false);
        }
    }

    async function handleTest(id: string) {
        setError('');
        setSuccess('');
        try {
            const res = await testChannel(id);
            if (res.ok) {
                setSuccess(res.message || 'Connection verified!');
            } else {
                setError(res.message || 'Test failed');
            }
            await loadData();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Test failed');
        }
    }

    async function handleActivate(id: string) {
        try {
            const res = await activateChannel(id);
            setSuccess(res.message || 'Channel activated!');
            await loadData();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Activation failed');
        }
    }

    async function handleDeactivate(id: string) {
        try {
            await deactivateChannel(id);
            setSuccess('Channel deactivated');
            await loadData();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Deactivation failed');
        }
    }

    function getTypeInfo(typeId: string) {
        return channelTypes.find((t) => t.id === typeId);
    }

    const statusColor = (status: string) => {
        switch (status) {
            case 'active': return { bg: 'rgba(34,197,94,0.15)', color: '#22c55e' };
            case 'error': return { bg: 'rgba(239,68,68,0.15)', color: '#ef4444' };
            default: return { bg: 'rgba(156,163,175,0.15)', color: '#9ca3af' };
        }
    };

    return (
        <div className="h-full overflow-y-auto p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg, #6366f1, #06b6d4)', boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }}
                        >
                            <Radio size={20} color="#fff" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold" style={{ color: 'var(--color-fg)' }}>
                                Channels
                            </h1>
                            <p className="text-sm" style={{ color: 'var(--color-fg-muted)' }}>
                                Messaging integrations — Telegram, Discord, Slack, WhatsApp, Zalo & more
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={loadData}
                        className="p-2.5 rounded-xl transition-all duration-200 cursor-pointer hover:bg-[var(--color-bg-soft)]"
                        style={{ color: 'var(--color-fg-muted)' }}
                        title="Refresh"
                    >
                        <RefreshCw size={18} />
                    </button>
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

                {/* Tabs */}
                <div className="flex gap-1 mb-6 p-1 rounded-xl" style={{ background: 'var(--color-bg-soft)' }}>
                    <button
                        onClick={() => setTab('channels')}
                        className="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer"
                        style={{
                            background: tab === 'channels'
                                ? 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))'
                                : 'transparent',
                            color: tab === 'channels' ? 'var(--color-fg)' : 'var(--color-fg-muted)',
                            boxShadow: tab === 'channels' ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
                        }}
                    >
                        <Radio size={14} className="inline mr-2" />
                        Channels
                    </button>
                    <button
                        onClick={() => { setTab('history'); loadSessions(); }}
                        className="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer"
                        style={{
                            background: tab === 'history'
                                ? 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))'
                                : 'transparent',
                            color: tab === 'history' ? 'var(--color-fg)' : 'var(--color-fg-muted)',
                            boxShadow: tab === 'history' ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
                        }}
                    >
                        <MessageSquare size={14} className="inline mr-2" />
                        Chat History
                    </button>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin w-6 h-6 border-2 border-t-transparent rounded-full" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
                    </div>
                ) : tab === 'channels' ? (
                    <>
                        {/* Connected Channels */}
                        {channels.length > 0 && (
                            <div className="mb-8">
                                <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-fg)' }}>
                                    Connected Channels ({channels.length})
                                </h2>
                                <div className="grid gap-4">
                                    {channels.map((ch) => {
                                        const typeInfo = getTypeInfo(ch.channelType);
                                        const sc = statusColor(ch.status);
                                        return (
                                            <div
                                                key={ch._id}
                                                className="rounded-2xl p-5 hover-lift hover-border-glow"
                                                style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)' }}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div
                                                            className="w-11 h-11 rounded-xl flex items-center justify-center text-xl"
                                                            style={{ background: 'var(--color-bg-soft)' }}
                                                        >
                                                            {typeInfo?.icon || '🔌'}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <h3 className="font-semibold" style={{ color: 'var(--color-fg)' }}>{ch.name}</h3>
                                                                <span className="flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: sc.bg, color: sc.color }}>
                                                                    <span className={`status-dot ${ch.status === 'active' ? 'status-dot-active' : ch.status === 'error' ? 'status-dot-error' : 'status-dot-inactive'}`} style={{ width: 6, height: 6 }} />
                                                                    {ch.status}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs mt-0.5" style={{ color: 'var(--color-fg-muted)' }}>
                                                                {typeInfo?.name} • Created {new Date(ch.createdAt).toLocaleDateString()}
                                                                {ch.metadata?.botUsername && ` • @${ch.metadata.botUsername}`}
                                                            </p>
                                                            {ch.agentConfigId && (() => {
                                                                const linked = agentConfigs.find(a => a._id === ch.agentConfigId);
                                                                return linked ? (
                                                                    <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: 'var(--color-primary-light)' }}>
                                                                        <img src="/logo.png" alt="HiTechClaw" className="w-2.5 h-2.5" /> {linked.name}
                                                                    </p>
                                                                ) : null;
                                                            })()}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => openEditModal(ch)}
                                                            className="p-2 rounded-lg transition-all duration-200 cursor-pointer hover:bg-[var(--color-bg-soft)]"
                                                            style={{ color: 'var(--color-fg-muted)' }}
                                                            title="Edit"
                                                        >
                                                            <Pencil size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleTest(ch._id)}
                                                            className="p-2 rounded-lg transition-all duration-200 cursor-pointer hover:bg-[var(--color-bg-soft)]"
                                                            style={{ color: 'var(--color-fg-muted)' }}
                                                            title="Test Connection"
                                                        >
                                                            <TestTube size={16} />
                                                        </button>
                                                        {ch.status === 'active' ? (
                                                            <button
                                                                onClick={() => handleDeactivate(ch._id)}
                                                                className="p-2 rounded-lg transition-all duration-200 cursor-pointer hover:bg-[rgba(239,68,68,0.1)]"
                                                                style={{ color: '#ef4444' }}
                                                                title="Deactivate"
                                                            >
                                                                <PowerOff size={16} />
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleActivate(ch._id)}
                                                                className="p-2 rounded-lg transition-all duration-200 cursor-pointer hover:bg-[rgba(34,197,94,0.1)]"
                                                                style={{ color: '#22c55e' }}
                                                                title="Activate"
                                                            >
                                                                <Power size={16} />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => handleDelete(ch._id)}
                                                            className="p-2 rounded-lg transition-all duration-200 cursor-pointer hover:bg-[rgba(239,68,68,0.1)]"
                                                            style={{ color: '#ef4444' }}
                                                            title="Delete"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Add New Channel */}
                        <div>
                            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-fg)' }}>
                                <Plus size={18} className="inline mr-1" />
                                Add Channel
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {channelTypes.map((type) => (
                                    <button
                                        key={type.id}
                                        onClick={() => openAddModal(type)}
                                        className="group text-left rounded-2xl p-5 hover-lift hover-border-glow cursor-pointer"
                                        style={{
                                            background: 'var(--color-bg-surface)',
                                            border: '1px solid var(--color-border)',
                                        }}
                                    >
                                        <div className="flex items-center gap-3 mb-3">
                                            <div
                                                className="w-11 h-11 rounded-xl flex items-center justify-center text-xl transition-transform duration-200 group-hover:scale-110"
                                                style={{ background: 'var(--color-bg-soft)' }}
                                            >
                                                {type.icon}
                                            </div>
                                            <h3 className="font-semibold" style={{ color: 'var(--color-fg)' }}>{type.name}</h3>
                                        </div>
                                        <p className="text-xs mb-3" style={{ color: 'var(--color-fg-muted)' }}>{type.description}</p>
                                        <div className="flex items-center gap-1 text-xs font-medium transition-colors" style={{ color: 'var(--color-primary)' }}>
                                            Connect <ChevronRight size={12} className="transition-transform duration-200 group-hover:translate-x-0.5" />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </>
                ) : (
                    /* Chat History Tab — Read Only */
                    <div>
                        <div className="mb-3 px-3 py-2 rounded-lg text-xs flex items-center gap-2"
                            style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary-light)' }}>
                            <MessageSquare size={14} />
                            Read-only view — messages from external channels cannot be replied to from here
                        </div>
                        <div className="flex gap-4" style={{ height: 'calc(100vh - 320px)' }}>
                            {/* Session list */}
                            <div
                                className="w-80 shrink-0 rounded-xl border overflow-y-auto"
                                style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}
                            >
                                <div className="p-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
                                    <h3 className="text-sm font-semibold" style={{ color: 'var(--color-fg)' }}>Sessions</h3>
                                </div>
                                {loadingSessions ? (
                                    <div className="flex items-center justify-center py-10">
                                        <div className="animate-spin w-5 h-5 border-2 border-t-transparent rounded-full" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
                                    </div>
                                ) : sessions.length === 0 ? (
                                    <p className="text-xs text-center py-10" style={{ color: 'var(--color-fg-muted)' }}>No sessions yet</p>
                                ) : (
                                    <div className="p-1">
                                        {sessions.map((s) => (
                                            <button
                                                key={s._id}
                                                onClick={() => loadMessages(s)}
                                                className="w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors cursor-pointer mb-0.5"
                                                style={{
                                                    background: selectedSession?._id === s._id ? 'var(--color-primary-soft)' : 'transparent',
                                                    color: selectedSession?._id === s._id ? 'var(--color-primary-light)' : 'var(--color-fg-muted)',
                                                }}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs">
                                                        {s.platform === 'telegram' ? '✈️' : s.platform === 'discord' ? '🎮' : '💬'}
                                                    </span>
                                                    <span className="truncate flex-1 font-medium text-xs">{s.title || s._id}</span>
                                                </div>
                                                <p className="text-[10px] mt-0.5 opacity-60">
                                                    {s.platform} • {new Date(s.updatedAt).toLocaleString()}
                                                </p>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Messages */}
                            <div
                                className="flex-1 rounded-xl border overflow-y-auto"
                                style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}
                            >
                                {selectedSession ? (
                                    <>
                                        <div className="p-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--color-border)' }}>
                                            <div>
                                                <h3 className="text-sm font-semibold" style={{ color: 'var(--color-fg)' }}>
                                                    {selectedSession.title || selectedSession._id}
                                                </h3>
                                                <p className="text-[10px]" style={{ color: 'var(--color-fg-muted)' }}>
                                                    {selectedSession.platform} • {messages.length} messages • read-only
                                                </p>
                                            </div>
                                        </div>
                                        <div className="p-4 space-y-3">
                                            {messages.map((msg) => (
                                                <div
                                                    key={msg._id}
                                                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                                >
                                                    <div
                                                        className="max-w-[75%] rounded-xl px-4 py-2.5 text-sm"
                                                        style={{
                                                            background: msg.role === 'user' ? 'var(--color-primary)' : 'var(--color-bg-soft)',
                                                            color: msg.role === 'user' ? '#fff' : 'var(--color-fg)',
                                                        }}
                                                    >
                                                        <p className="whitespace-pre-wrap">{msg.content}</p>
                                                        <p className="text-[10px] mt-1 opacity-50">
                                                            {new Date(msg.createdAt).toLocaleTimeString()}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                            {messages.length === 0 && (
                                                <p className="text-center text-xs py-10" style={{ color: 'var(--color-fg-muted)' }}>No messages</p>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex items-center justify-center h-full">
                                        <p className="text-sm" style={{ color: 'var(--color-fg-muted)' }}>Select a session to view chat history</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Add Channel Modal */}
                {showAddModal && selectedType && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
                        <div
                            className="rounded-2xl p-6 w-full max-w-md mx-4 animate-scale-in glass-card"
                            style={{ boxShadow: '0 24px 48px rgba(0,0,0,0.3)' }}
                        >
                            <div className="flex items-center justify-between mb-5">
                                <div className="flex items-center gap-2">
                                    <span className="text-xl">{selectedType.icon}</span>
                                    <h2 className="text-lg font-bold" style={{ color: 'var(--color-fg)' }}>
                                        Connect {selectedType.name}
                                    </h2>
                                </div>
                                <button onClick={() => setShowAddModal(false)} className="cursor-pointer" style={{ color: 'var(--color-fg-muted)' }}>
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Setup guide */}
                            <div className="mb-4 px-3 py-2 rounded-lg text-xs" style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary-light)' }}>
                                💡 {selectedType.setupGuide}
                            </div>

                            <div className="space-y-4">
                                {/* Channel name */}
                                <div>
                                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-fg-muted)' }}>Channel Name</label>
                                    <input
                                        type="text"
                                        value={addForm.name}
                                        onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                                        style={{
                                            background: 'var(--color-bg)',
                                            borderColor: 'var(--color-border)',
                                            color: 'var(--color-fg)',
                                        }}
                                    />
                                </div>

                                {/* Agent Config selector */}
                                {agentConfigs.length > 0 && (
                                    <div>
                                        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-fg-muted)' }}>
                                            <img src="/logo.png" alt="HiTechClaw" className="w-3 h-3 inline mr-1" />
                                            Agent Config
                                        </label>
                                        <select
                                            value={addForm.agentConfigId}
                                            onChange={(e) => setAddForm({ ...addForm, agentConfigId: e.target.value })}
                                            className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                                            style={{
                                                background: 'var(--color-bg)',
                                                borderColor: 'var(--color-border)',
                                                color: 'var(--color-fg)',
                                            }}
                                        >
                                            <option value="">No agent (use default)</option>
                                            {agentConfigs.map((ac) => (
                                                <option key={ac._id} value={ac._id}>
                                                    {ac.name}{ac.isDefault ? ' (default)' : ''}{ac.llmConfig?.provider ? ` — ${ac.llmConfig.provider}/${ac.llmConfig.model}` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {/* Config fields */}
                                {selectedType.configFields.map((field) => (
                                    <div key={field.key}>
                                        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-fg-muted)' }}>
                                            {field.label} {field.required && <span style={{ color: '#ef4444' }}>*</span>}
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={field.type === 'password' && !showPasswords[field.key] ? 'password' : 'text'}
                                                value={addForm.config[field.key] || ''}
                                                onChange={(e) => setAddForm({
                                                    ...addForm,
                                                    config: { ...addForm.config, [field.key]: e.target.value },
                                                })}
                                                placeholder={field.placeholder}
                                                className="w-full px-3 py-2 rounded-lg text-sm border outline-none pr-9"
                                                style={{
                                                    background: 'var(--color-bg)',
                                                    borderColor: 'var(--color-border)',
                                                    color: 'var(--color-fg)',
                                                }}
                                            />
                                            {field.type === 'password' && (
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPasswords(prev => ({ ...prev, [field.key]: !prev[field.key] }))}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer"
                                                    style={{ color: 'var(--color-fg-muted)' }}
                                                >
                                                    {showPasswords[field.key] ? <EyeOff size={14} /> : <Eye size={14} />}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => setShowAddModal(false)}
                                    className="flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer border"
                                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-fg-muted)' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAdd}
                                    disabled={adding}
                                    className="flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer"
                                    style={{ background: 'var(--color-primary)', color: '#fff', opacity: adding ? 0.7 : 1 }}
                                >
                                    {adding ? 'Connecting...' : 'Connect'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Edit Channel Modal */}
                {editChannel && (() => {
                    const typeInfo = getTypeInfo(editChannel.channelType);
                    if (!typeInfo) return null;
                    return (
                        <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
                            <div
                                className="rounded-2xl p-6 w-full max-w-md mx-4 animate-scale-in glass-card"
                                style={{ boxShadow: '0 24px 48px rgba(0,0,0,0.3)' }}
                            >
                                <div className="flex items-center justify-between mb-5">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">{typeInfo.icon}</span>
                                        <h2 className="text-lg font-bold" style={{ color: 'var(--color-fg)' }}>
                                            Edit {typeInfo.name}
                                        </h2>
                                    </div>
                                    <button onClick={() => setEditChannel(null)} className="cursor-pointer" style={{ color: 'var(--color-fg-muted)' }}>
                                        <X size={18} />
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    {/* Channel name */}
                                    <div>
                                        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-fg-muted)' }}>Channel Name</label>
                                        <input
                                            type="text"
                                            value={editForm.name}
                                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                            className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                                            style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                                        />
                                    </div>

                                    {/* Agent Config selector */}
                                    {agentConfigs.length > 0 && (
                                        <div>
                                            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-fg-muted)' }}>
                                                <img src="/logo.png" alt="HiTechClaw" className="w-3 h-3 inline mr-1" />
                                                Agent Config
                                            </label>
                                            <select
                                                value={editForm.agentConfigId}
                                                onChange={(e) => setEditForm({ ...editForm, agentConfigId: e.target.value })}
                                                className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                                                style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                                            >
                                                <option value="">No agent (use default)</option>
                                                {agentConfigs.map((ac) => (
                                                    <option key={ac._id} value={ac._id}>
                                                        {ac.name}{ac.isDefault ? ' (default)' : ''}{ac.llmConfig?.provider ? ` — ${ac.llmConfig.provider}/${ac.llmConfig.model}` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {/* Config fields */}
                                    {typeInfo.configFields.map((field) => (
                                        <div key={field.key}>
                                            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-fg-muted)' }}>
                                                {field.label} {field.required && <span style={{ color: '#ef4444' }}>*</span>}
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type={field.type === 'password' && !showPasswords[`edit_${field.key}`] ? 'password' : 'text'}
                                                    value={editForm.config[field.key] || ''}
                                                    onChange={(e) => setEditForm({
                                                        ...editForm,
                                                        config: { ...editForm.config, [field.key]: e.target.value },
                                                    })}
                                                    placeholder={field.placeholder || (editForm.config[field.key]?.includes('****') ? 'Leave blank to keep current' : '')}
                                                    className="w-full px-3 py-2 rounded-lg text-sm border outline-none pr-9"
                                                    style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                                                />
                                                {field.type === 'password' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowPasswords(prev => ({ ...prev, [`edit_${field.key}`]: !prev[`edit_${field.key}`] }))}
                                                        className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer"
                                                        style={{ color: 'var(--color-fg-muted)' }}
                                                    >
                                                        {showPasswords[`edit_${field.key}`] ? <EyeOff size={14} /> : <Eye size={14} />}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex gap-3 mt-6">
                                    <button
                                        onClick={() => setEditChannel(null)}
                                        className="flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer border"
                                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-fg-muted)' }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleEdit}
                                        disabled={saving}
                                        className="flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer"
                                        style={{ background: 'var(--color-primary)', color: '#fff', opacity: saving ? 0.7 : 1 }}
                                    >
                                        {saving ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })()}
            </div>
        </div>
    );
}
