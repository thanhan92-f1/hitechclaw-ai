import { useState, useRef, useEffect, useCallback, useMemo, type FormEvent } from 'react';
import {
    Send, Loader2, User, Trash2, Paperclip, X, ChevronDown, Cpu,
    Globe, Sparkles, RotateCcw, Copy, Check, Hash, Clock, Bug, Search,
    ChevronRight, Zap, Database, ExternalLink, Timer, BookmarkPlus,
    ThumbsUp, ThumbsDown, MessageSquare, Plus, Edit3,
    PanelLeftClose, PanelLeft, Mic, StopCircle, Image, Volume2,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import {
    streamChat, sendChat, uploadChatAttachment, getModels, setActiveModel, getInstalledDomains,
    saveSearchToKnowledge, submitChatFeedback,
    getConversations, getConversation, deleteConversation, renameConversation, saveChatMessage,
    getAgentConfigs,
} from '../lib/api';
import { useVoice } from '../hooks/useVoice';

interface ChatAttachment {
    id: string;
    name: string;
    mimeType: string;
    size: number;
    file?: File;
    previewUrl?: string;
}

interface DebugInfo {
    ragContext?: string;
    hasRag?: boolean;
    webResults?: Array<{ title: string; url: string; snippet: string }>;
    webQuery?: string;
    timing?: Record<string, number>;
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
    finishReason?: string;
}

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    streaming?: boolean;
    attachments?: ChatAttachment[];
    domain?: string;
    tokens?: number;
    debugInfo?: DebugInfo;
}

interface DomainOption {
    id: string;
    name: string;
    icon: string;
    description: string;
}

interface ConversationSummary {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    messageCount: number;
    lastMessage: string;
}

const QUICK_PROMPTS = [
    { label: 'Summarize', prompt: 'Summarize the following text:', icon: '📝' },
    { label: 'Explain', prompt: 'Explain this in simple terms:', icon: '💡' },
    { label: 'Translate', prompt: 'Translate to English:', icon: '🌐' },
    { label: 'Code Review', prompt: 'Review this code and suggest improvements:', icon: '🔍' },
    { label: 'Write Email', prompt: 'Write a professional email about:', icon: '✉️' },
    { label: 'Analyze Data', prompt: 'Analyze this data and provide insights:', icon: '📊' },
];

export function ChatPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [sessionId, setSessionId] = useState(() => {
        const saved = localStorage.getItem('hitechclaw-last-session');
        return saved || `session-${Date.now()}`;
    });
    const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
    const [models, setModels] = useState<Array<{ name: string; parameterSize: string; family: string; sizeMB: number }>>([]);
    const [activeModel, setActiveModelState] = useState('');
    const [showModelPicker, setShowModelPicker] = useState(false);
    const [domains, setDomains] = useState<DomainOption[]>([]);
    const [activeDomain, setActiveDomain] = useState<string>('general');
    const [showDomainPicker, setShowDomainPicker] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [debugMode, setDebugMode] = useState(false);
    const [webSearchEnabled, setWebSearchEnabled] = useState(false);
    const [agentConfigs, setAgentConfigs] = useState<Array<{ _id: string; name: string; isDefault: boolean; llmConfig?: any }>>([]);
    const [activeAgentConfigId, setActiveAgentConfigId] = useState<string | undefined>(undefined);
    const [conversations, setConversations] = useState<ConversationSummary[]>([]);
    const isComposingRef = useRef(false);
    const [sidebarOpen, setSidebarOpen] = useState(() => {
        const saved = localStorage.getItem('hitechclaw-sidebar-open');
        return saved !== null ? saved === 'true' : true; // default open
    });
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameText, setRenameText] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);

    const { isRecording, isTranscribing, recordingDuration, startRecording, stopRecording, cancelRecording, speak, isSpeaking, stopSpeaking } = useVoice({
        language: 'vi',
        onTranscript: (text) => {
            setInput((prev) => prev ? prev + ' ' + text : text);
            inputRef.current?.focus();
        },
        onError: (err) => console.error('Voice error:', err),
    });

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;
        for (const file of Array.from(files)) {
            if (!file.type.startsWith('image/')) continue;
            const previewUrl = URL.createObjectURL(file);
            setAttachments((prev) => [...prev, {
                id: `img-${Date.now()}-${Math.random()}`,
                name: file.name,
                mimeType: file.type,
                size: file.size,
                file,
                previewUrl,
            }]);
        }
        e.target.value = '';
    };

    // Persist sidebar state
    useEffect(() => {
        localStorage.setItem('hitechclaw-sidebar-open', String(sidebarOpen));
    }, [sidebarOpen]);

    // Persist last sessionId
    useEffect(() => {
        localStorage.setItem('hitechclaw-last-session', sessionId);
    }, [sessionId]);

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages]);

    // Auto-resize textarea
    const autoResize = useCallback(() => {
        const el = inputRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 160) + 'px';
    }, []);

    useEffect(() => {
        autoResize();
    }, [input, autoResize]);

    useEffect(() => {
        getModels()
            .then((data) => {
                if (data.models) setModels(data.models);
                if (data.activeModel) setActiveModelState(data.activeModel);
            })
            .catch(() => { });
        getInstalledDomains()
            .then((data) => {
                if (data.domains) setDomains(data.domains.map((d: any) => ({
                    id: d.id, name: d.name, icon: d.icon, description: d.description,
                })));
            })
            .catch(() => { });
        getAgentConfigs()
            .then((data) => {
                if (data.configs) {
                    setAgentConfigs(data.configs);
                    const def = data.configs.find((c: any) => c.isDefault);
                    if (def) setActiveAgentConfigId(def._id);
                }
            })
            .catch(() => { });
    }, []);

    // Load conversation list
    const refreshConversations = useCallback(() => {
        getConversations().then(setConversations).catch(() => { });
    }, []);

    useEffect(() => {
        refreshConversations();
    }, [refreshConversations]);

    // Auto-load last conversation on mount
    useEffect(() => {
        const lastSession = localStorage.getItem('hitechclaw-last-session');
        if (lastSession && lastSession !== sessionId) return;
        if (lastSession) {
            getConversation(lastSession)
                .then((conv) => {
                    if (conv.messages?.length > 0) {
                        setMessages(conv.messages.map((m: any) => ({
                            id: m.id,
                            role: m.role,
                            content: m.content,
                            timestamp: new Date(m.createdAt ?? m.timestamp),
                        })));
                    }
                })
                .catch(() => { /* no saved conversation, start fresh */ });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Switch to an existing conversation
    const loadConversation = useCallback(async (convId: string) => {
        try {
            const conv = await getConversation(convId);
            setSessionId(convId);
            setMessages(conv.messages.map((m: any) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                timestamp: new Date(m.createdAt ?? m.timestamp),
            })));
        } catch { /* ignore */ }
    }, []);

    // Start new conversation
    const startNewChat = useCallback(() => {
        setSessionId(`session-${Date.now()}`);
        setMessages([]);
    }, []);

    // Delete a conversation
    const handleDeleteConversation = useCallback(async (convId: string) => {
        try {
            await deleteConversation(convId);
            setConversations((prev) => prev.filter((c) => c.id !== convId));
            if (convId === sessionId) startNewChat();
        } catch { /* ignore */ }
    }, [sessionId, startNewChat]);

    // Rename a conversation
    const handleRenameConversation = useCallback(async (convId: string, newTitle: string) => {
        if (!newTitle.trim()) return;
        try {
            await renameConversation(convId, newTitle.trim());
            setConversations((prev) => prev.map((c) => c.id === convId ? { ...c, title: newTitle.trim() } : c));
            setRenamingId(null);
        } catch { /* ignore */ }
    }, []);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;
        for (const file of Array.from(files)) {
            const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
            setAttachments((prev) => [...prev, {
                id: `pending-${Date.now()}-${Math.random()}`,
                name: file.name,
                mimeType: file.type,
                size: file.size,
                file,
                previewUrl,
            }]);
        }
        e.target.value = '';
    };

    const removeAttachment = (id: string) => {
        setAttachments((prev) => {
            const att = prev.find((a) => a.id === id);
            if (att?.previewUrl) URL.revokeObjectURL(att.previewUrl);
            return prev.filter((a) => a.id !== id);
        });
    };

    const switchModel = async (model: string) => {
        try {
            await setActiveModel(model);
            setActiveModelState(model);
            // Manual model selection means no agent-specific override.
            setActiveAgentConfigId(undefined);
        } catch { /* ignore */ }
        setShowModelPicker(false);
    };

    const copyMessage = (id: string, content: string) => {
        navigator.clipboard.writeText(content);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const regenerateMessage = async (msgIndex: number) => {
        const userMsg = messages[msgIndex - 1];
        if (!userMsg || userMsg.role !== 'user' || loading) return;

        const assistantMsg: Message = {
            id: `a-${Date.now()}`,
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            streaming: true,
            domain: activeDomain,
            debugInfo: {},
        };

        setMessages((prev) => [...prev.slice(0, msgIndex), assistantMsg]);
        setLoading(true);

        try {
            let fullContent = '';
            const debug: DebugInfo = {};

            for await (const event of streamChat(userMsg.content, sessionId, webSearchEnabled, activeDomain, activeAgentConfigId)) {
                if (event.type === 'text-delta') {
                    fullContent += event.delta;
                    setMessages((prev) =>
                        prev.map((m) => m.id === assistantMsg.id ? { ...m, content: fullContent } : m),
                    );
                } else if (event.type === 'meta') {
                    if (event.key === 'rag') {
                        debug.ragContext = (event.data as any)?.context;
                        debug.hasRag = (event.data as any)?.hasContext;
                    } else if (event.key === 'search') {
                        debug.webResults = (event.data as any)?.results;
                        debug.webQuery = (event.data as any)?.query;
                    } else if (event.key === 'timing') {
                        debug.timing = event.data as Record<string, number>;
                    }
                } else if (event.type === 'finish') {
                    debug.usage = event.usage as any;
                    debug.finishReason = event.finishReason;
                }
            }
            setMessages((prev) =>
                prev.map((m) => m.id === assistantMsg.id ? { ...m, streaming: false, debugInfo: debug } : m),
            );
        } catch {
            try {
                const res = await sendChat(userMsg.content, sessionId, activeDomain, activeAgentConfigId);
                setMessages((prev) =>
                    prev.map((m) => m.id === assistantMsg.id ? { ...m, content: res.content, streaming: false } : m),
                );
            } catch {
                setMessages((prev) =>
                    prev.map((m) => m.id === assistantMsg.id ? { ...m, content: 'Failed to regenerate.', streaming: false } : m),
                );
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        const text = input.trim();
        if (!text || loading) return;

        // ─── Normal Chat Mode ───────────────────────────────────
        const uploadedAttachmentIds: string[] = [];
        const msgAttachments = [...attachments];
        for (const att of msgAttachments) {
            if (att.file) {
                try {
                    const result = await uploadChatAttachment(att.file, sessionId);
                    uploadedAttachmentIds.push(result.id);
                    att.id = result.id;
                } catch { /* skip */ }
            }
        }

        const userMsg: Message = {
            id: `u-${Date.now()}`,
            role: 'user',
            content: text,
            timestamp: new Date(),
            attachments: msgAttachments.length > 0 ? msgAttachments : undefined,
        };

        const assistantMsg: Message = {
            id: `a-${Date.now()}`,
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            streaming: true,
            domain: activeDomain,
            debugInfo: {},
        };

        setMessages((prev) => [...prev, userMsg, assistantMsg]);
        setInput('');
        setAttachments([]);
        setLoading(true);

        try {
            let fullContent = '';
            const debug: DebugInfo = {};

            for await (const event of streamChat(text, sessionId, webSearchEnabled, activeDomain, activeAgentConfigId)) {
                if (event.type === 'text-delta') {
                    fullContent += event.delta;
                    setMessages((prev) =>
                        prev.map((m) => m.id === assistantMsg.id ? { ...m, content: fullContent } : m),
                    );
                } else if (event.type === 'error') {
                    fullContent = `Error: ${event.error}`;
                    setMessages((prev) =>
                        prev.map((m) => m.id === assistantMsg.id ? { ...m, content: fullContent, streaming: false } : m),
                    );
                } else if (event.type === 'meta') {
                    if (event.key === 'rag') {
                        debug.ragContext = (event.data as any)?.context;
                        debug.hasRag = (event.data as any)?.hasContext;
                    } else if (event.key === 'search') {
                        debug.webResults = (event.data as any)?.results;
                        debug.webQuery = (event.data as any)?.query;
                    } else if (event.key === 'timing') {
                        debug.timing = event.data as Record<string, number>;
                    }
                } else if (event.type === 'finish') {
                    debug.usage = event.usage as any;
                    debug.finishReason = event.finishReason;
                }
            }
            setMessages((prev) =>
                prev.map((m) => m.id === assistantMsg.id ? { ...m, streaming: false, debugInfo: debug } : m),
            );
            // Save completed assistant message to conversation history
            if (fullContent) {
                saveChatMessage(sessionId, fullContent).catch(() => { });
                refreshConversations();
            }
        } catch {
            try {
                const res = await sendChat(text, sessionId, activeDomain, activeAgentConfigId);
                setMessages((prev) =>
                    prev.map((m) => m.id === assistantMsg.id ? { ...m, content: res.content, streaming: false } : m),
                );
                refreshConversations();
            } catch {
                setMessages((prev) =>
                    prev.map((m) => m.id === assistantMsg.id ? { ...m, content: 'Failed to get a response. Check LLM configuration.', streaming: false } : m),
                );
            }
        } finally {
            setLoading(false);
            inputRef.current?.focus();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && !isComposingRef.current) {
            e.preventDefault();
            handleSubmit(e as unknown as FormEvent);
        }
    };

    const handleQuickReply = useCallback((text: string) => {
        if (loading) return;
        setInput(text);
        // Auto-submit after setting input via a microtask
        queueMicrotask(() => {
            const form = document.querySelector('form[data-chat-form]') as HTMLFormElement | null;
            form?.requestSubmit();
        });
    }, [loading]);

    const activeDomainInfo = domains.find((d) => d.id === activeDomain);
    const activeAgentConfig = agentConfigs.find((a) => a._id === activeAgentConfigId);
    const activeModelLabel = activeAgentConfig
        ? `${activeAgentConfig.name} (Agent)`
        : (activeModel || 'Model');

    // Group conversations by date
    const groupedConversations = useMemo(() => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today.getTime() - 86400000);
        const week = new Date(today.getTime() - 7 * 86400000);

        const groups: { label: string; items: ConversationSummary[] }[] = [
            { label: 'Today', items: [] },
            { label: 'Yesterday', items: [] },
            { label: 'Previous 7 Days', items: [] },
            { label: 'Older', items: [] },
        ];

        for (const conv of conversations) {
            const d = new Date(conv.updatedAt);
            if (d >= today) groups[0].items.push(conv);
            else if (d >= yesterday) groups[1].items.push(conv);
            else if (d >= week) groups[2].items.push(conv);
            else groups[3].items.push(conv);
        }
        return groups.filter((g) => g.items.length > 0);
    }, [conversations]);

    return (
        <div className="flex h-full">
            {/* ─── Sidebar ─────────────────────────────────────────── */}
            <div
                className="shrink-0 border-r flex flex-col transition-all duration-200 overflow-hidden"
                style={{
                    width: sidebarOpen ? '260px' : '0px',
                    background: 'var(--color-bg)',
                    borderColor: 'var(--color-border)',
                }}
            >
                {sidebarOpen && (
                    <>
                        {/* Sidebar header */}
                        <div className="flex items-center justify-between px-3 h-12 shrink-0 border-b" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="flex items-center gap-1.5">
                                <img src="/logo.png" alt="HiTechClaw" className="w-4 h-4" />
                                <span className="text-xs font-semibold" style={{ color: 'var(--color-fg)' }}>Chats</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={startNewChat}
                                    className="p-1.5 rounded-lg transition-colors cursor-pointer"
                                    style={{ color: 'var(--color-fg-muted)' }}
                                    title="New Chat"
                                >
                                    <Plus size={15} />
                                </button>
                                <button
                                    onClick={() => setSidebarOpen(false)}
                                    className="p-1.5 rounded-lg transition-colors cursor-pointer"
                                    style={{ color: 'var(--color-fg-muted)' }}
                                    title="Close sidebar"
                                >
                                    <PanelLeftClose size={15} />
                                </button>
                            </div>
                        </div>

                        {/* Conversation list */}
                        <div className="flex-1 overflow-y-auto px-2 py-2">
                            {conversations.length === 0 ? (
                                <div className="px-2 py-8 text-center">
                                    <MessageSquare size={20} style={{ color: 'var(--color-fg-muted)', opacity: 0.25 }} className="mx-auto mb-2" />
                                    <p className="text-[11px]" style={{ color: 'var(--color-fg-muted)', opacity: 0.5 }}>
                                        No conversations yet
                                    </p>
                                    <p className="text-[10px] mt-1" style={{ color: 'var(--color-fg-muted)', opacity: 0.35 }}>
                                        Start chatting to see history here
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {groupedConversations.map((group) => (
                                        <div key={group.label}>
                                            <p className="text-[10px] font-semibold uppercase px-2 mb-1" style={{ color: 'var(--color-fg-muted)', opacity: 0.5 }}>
                                                {group.label}
                                            </p>
                                            <div className="space-y-0.5">
                                                {group.items.map((conv) => (
                                                    <div
                                                        key={conv.id}
                                                        className="group/conv rounded-lg transition-colors"
                                                        style={{
                                                            background: conv.id === sessionId ? 'var(--color-primary-soft)' : 'transparent',
                                                        }}
                                                    >
                                                        {renamingId === conv.id ? (
                                                            <div className="px-2 py-1.5">
                                                                <input
                                                                    value={renameText}
                                                                    onChange={(e) => setRenameText(e.target.value)}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') handleRenameConversation(conv.id, renameText);
                                                                        if (e.key === 'Escape') setRenamingId(null);
                                                                    }}
                                                                    onBlur={() => handleRenameConversation(conv.id, renameText)}
                                                                    autoFocus
                                                                    className="w-full text-[11px] px-1.5 py-1 rounded border outline-none"
                                                                    style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                                                                />
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={() => loadConversation(conv.id)}
                                                                className="w-full text-left px-2.5 py-2 cursor-pointer rounded-lg"
                                                                style={{
                                                                    color: conv.id === sessionId ? 'var(--color-primary-light)' : 'var(--color-fg)',
                                                                }}
                                                            >
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-[11px] font-medium truncate flex-1 mr-1">{conv.title}</span>
                                                                    <div className="flex items-center gap-0.5 opacity-0 group-hover/conv:opacity-100 transition-opacity shrink-0">
                                                                        <span
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setRenamingId(conv.id);
                                                                                setRenameText(conv.title);
                                                                            }}
                                                                            className="p-0.5 rounded cursor-pointer"
                                                                            style={{ color: 'var(--color-fg-muted)' }}
                                                                            title="Rename"
                                                                        >
                                                                            <Edit3 size={10} />
                                                                        </span>
                                                                        <span
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleDeleteConversation(conv.id);
                                                                            }}
                                                                            className="p-0.5 rounded cursor-pointer"
                                                                            style={{ color: 'var(--color-destructive)' }}
                                                                            title="Delete"
                                                                        >
                                                                            <Trash2 size={10} />
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                {conv.lastMessage && (
                                                                    <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--color-fg-muted)', opacity: 0.55 }}>
                                                                        {conv.lastMessage}
                                                                    </p>
                                                                )}
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* ─── Main Chat Area ──────────────────────────────────── */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <div
                    className="flex items-center justify-between px-3 h-12 border-b shrink-0"
                    style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}
                >
                    <div className="flex items-center gap-1.5">
                        {!sidebarOpen && (
                            <button
                                onClick={() => setSidebarOpen(true)}
                                className="p-1.5 rounded-lg transition-colors cursor-pointer mr-1"
                                style={{ color: 'var(--color-fg-muted)' }}
                                title="Open sidebar"
                            >
                                <PanelLeft size={16} />
                            </button>
                        )}
                        {!sidebarOpen && (
                            <button
                                onClick={startNewChat}
                                className="p-1.5 rounded-lg transition-colors cursor-pointer mr-1"
                                style={{ color: 'var(--color-fg-muted)' }}
                                title="New Chat"
                            >
                                <Plus size={16} />
                            </button>
                        )}
                        <h2 className="text-sm font-semibold" style={{ color: 'var(--color-fg)' }}>
                            {messages.length > 0 ? (conversations.find(c => c.id === sessionId)?.title || 'Chat') : 'New Chat'}
                        </h2>
                    </div>
                    <div className="flex items-center gap-1">
                        {/* Unified Model + Domain Selector (ChatGPT-style) */}
                        <div className="relative">
                            <button
                                onClick={() => { setShowModelPicker(!showModelPicker); setShowDomainPicker(false); }}
                                className="flex items-center gap-1.5 text-sm font-semibold px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer"
                                style={{ color: 'var(--color-fg)', background: 'transparent' }}
                            >
                                {activeDomainInfo?.icon && <span>{activeDomainInfo.icon}</span>}
                                <span>{activeModelLabel}</span>
                                <ChevronDown size={14} style={{ color: 'var(--color-fg-muted)' }} />
                            </button>
                            {showModelPicker && (
                                <div
                                    className="absolute right-0 top-full mt-1 w-80 rounded-xl shadow-xl z-50 overflow-hidden glass-card animate-scale-in"
                                    style={{ boxShadow: '0 16px 40px rgba(0,0,0,0.3)' }}
                                >
                                    {/* Domain Section */}
                                    {domains.length > 0 && (
                                        <>
                                            <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
                                                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-fg-muted)' }}>Domain</p>
                                            </div>
                                            <div className="py-1 max-h-44 overflow-y-auto">
                                                {domains.map((d) => (
                                                    <button
                                                        key={d.id}
                                                        onClick={() => { setActiveDomain(d.id); }}
                                                        className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors cursor-pointer"
                                                        style={{
                                                            color: d.id === activeDomain ? 'var(--color-primary-light)' : 'var(--color-fg)',
                                                            background: d.id === activeDomain ? 'var(--color-primary-soft)' : 'transparent',
                                                        }}
                                                    >
                                                        <span className="text-base">{d.icon}</span>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-xs font-medium truncate">{d.name}</div>
                                                        </div>
                                                        {d.id === activeDomain && <Check size={14} style={{ color: 'var(--color-primary)' }} />}
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                    {/* Agent Config Section */}
                                    {agentConfigs.length > 0 && (
                                        <>
                                            <div className="px-3 py-2 border-t border-b" style={{ borderColor: 'var(--color-border)' }}>
                                                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-fg-muted)' }}>Agent</p>
                                            </div>
                                            <div className="py-1 max-h-44 overflow-y-auto">
                                                <button
                                                    onClick={() => { setActiveAgentConfigId(undefined); }}
                                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors cursor-pointer"
                                                    style={{
                                                        color: !activeAgentConfigId ? 'var(--color-primary-light)' : 'var(--color-fg)',
                                                        background: !activeAgentConfigId ? 'var(--color-primary-soft)' : 'transparent',
                                                    }}
                                                >
                                                    <img src="/logo.png" alt="HiTechClaw" className="w-3 h-3" />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-xs font-medium truncate">Use global model (no agent override)</div>
                                                        <div className="text-[10px]" style={{ color: 'var(--color-fg-muted)' }}>
                                                            Pick directly from Model section below
                                                        </div>
                                                    </div>
                                                    {!activeAgentConfigId && <Check size={14} style={{ color: 'var(--color-primary)' }} />}
                                                </button>
                                                {agentConfigs.map((ac) => (
                                                    <button
                                                        key={ac._id}
                                                        onClick={() => { setActiveAgentConfigId(ac._id); setShowModelPicker(false); }}
                                                        className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors cursor-pointer"
                                                        style={{
                                                            color: ac._id === activeAgentConfigId ? 'var(--color-primary-light)' : 'var(--color-fg)',
                                                            background: ac._id === activeAgentConfigId ? 'var(--color-primary-soft)' : 'transparent',
                                                        }}
                                                    >
                                                        <img src="/logo.png" alt="HiTechClaw" className="w-3 h-3" />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-xs font-medium truncate">{ac.name}</div>
                                                            <div className="text-[10px]" style={{ color: 'var(--color-fg-muted)' }}>
                                                                {ac.llmConfig?.provider || 'ollama'} · {ac.llmConfig?.model || 'qwen2.5:14b'}
                                                            </div>
                                                        </div>
                                                        {ac._id === activeAgentConfigId && <Check size={14} style={{ color: 'var(--color-primary)' }} />}
                                                        {ac.isDefault && <span className="text-[9px] px-1 py-0.5 rounded" style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}>default</span>}
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                    {/* Model Section */}
                                    {models.length > 0 && (
                                        <>
                                            <div className="px-3 py-2 border-t border-b" style={{ borderColor: 'var(--color-border)' }}>
                                                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-fg-muted)' }}>Model</p>
                                            </div>
                                            {activeAgentConfigId ? (
                                                <div className="px-3 py-2 text-[11px]" style={{ color: 'var(--color-fg-muted)' }}>
                                                    Model is controlled by selected Agent. Switch to "Use global model" above to pick model manually.
                                                </div>
                                            ) : (
                                                <div className="py-1 max-h-44 overflow-y-auto">
                                                    {models.map((m) => (
                                                        <button
                                                            key={m.name}
                                                            onClick={() => { switchModel(m.name); setShowModelPicker(false); }}
                                                            className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors cursor-pointer"
                                                            style={{
                                                                color: m.name === activeModel ? 'var(--color-primary-light)' : 'var(--color-fg)',
                                                                background: m.name === activeModel ? 'var(--color-primary-soft)' : 'transparent',
                                                            }}
                                                        >
                                                            <Cpu size={12} />
                                                            <div className="flex-1 min-w-0">
                                                                <div className="truncate font-medium">{m.name}</div>
                                                                <div className="text-[10px]" style={{ color: 'var(--color-fg-muted)' }}>
                                                                    {m.parameterSize} · {m.family}
                                                                </div>
                                                            </div>
                                                            {m.name === activeModel && <Check size={12} style={{ color: 'var(--color-primary)' }} />}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Debug Toggle */}
                        <button
                            onClick={() => setDebugMode(!debugMode)}
                            className="p-1.5 rounded-lg transition-colors cursor-pointer"
                            style={{
                                color: debugMode ? 'var(--color-warning)' : 'var(--color-fg-muted)',
                                background: debugMode ? 'rgba(234,179,8,0.1)' : 'transparent',
                            }}
                            title={debugMode ? 'Debug ON' : 'Debug OFF'}
                        >
                            <Bug size={14} />
                        </button>

                        {messages.length > 0 && (
                            <button
                                onClick={() => setMessages([])}
                                className="p-1.5 rounded-lg transition-colors cursor-pointer"
                                style={{ color: 'var(--color-destructive)' }}
                                title="Clear messages"
                            >
                                <Trash2 size={14} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Messages */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4" onClick={() => { setShowModelPicker(false); setShowDomainPicker(false); }}>
                    {messages.length === 0 ? (
                        <EmptyState
                            domains={domains}
                            activeDomain={activeDomain}
                            onSelectDomain={setActiveDomain}
                            onQuickPrompt={(p) => setInput(p)}
                        />
                    ) : (
                        <div className="max-w-3xl mx-auto space-y-3">
                            {messages.map((msg, i) => (
                                <ChatBubble
                                    key={msg.id}
                                    message={msg}
                                    userQuestion={msg.role === 'assistant' && i > 0 ? messages[i - 1]?.content || '' : ''}
                                    onCopy={() => copyMessage(msg.id, msg.content)}
                                    onRegenerate={msg.role === 'assistant' && !msg.streaming ? () => regenerateMessage(i) : undefined}
                                    onSpeak={msg.role === 'assistant' && !msg.streaming ? () => {
                                        if (isSpeaking) { stopSpeaking(); } else { speak(msg.content); }
                                    } : undefined}
                                    isSpeaking={isSpeaking}
                                    copied={copiedId === msg.id}
                                    debugMode={debugMode}
                                    onQuickReply={handleQuickReply}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Input */}
                <div className="shrink-0 border-t px-4 py-3" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                    {attachments.length > 0 && (
                        <div className="max-w-3xl mx-auto mb-2 flex flex-wrap gap-1.5">
                            {attachments.map((att) => (
                                <div
                                    key={att.id}
                                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs border"
                                    style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                                >
                                    {att.previewUrl ? (
                                        <img src={att.previewUrl} alt={att.name} className="w-6 h-6 rounded object-cover" />
                                    ) : (
                                        <Paperclip size={12} style={{ color: 'var(--color-fg-muted)' }} />
                                    )}
                                    <span className="max-w-[100px] truncate">{att.name}</span>
                                    <button onClick={() => removeAttachment(att.id)} className="cursor-pointer" style={{ color: 'var(--color-fg-muted)' }}>
                                        <X size={11} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    <form onSubmit={handleSubmit} data-chat-form className="max-w-3xl mx-auto flex gap-2">
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            className="hidden"
                            onChange={handleFileSelect}
                            accept="image/*,.pdf,.doc,.docx,.txt,.csv,.json,.md"
                        />
                        <input
                            ref={imageInputRef}
                            type="file"
                            multiple
                            className="hidden"
                            onChange={handleImageSelect}
                            accept="image/*"
                            capture="environment"
                        />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors cursor-pointer shrink-0 self-end"
                            style={{ background: 'var(--color-bg)', color: 'var(--color-fg-muted)', border: '1px solid var(--color-border)' }}
                            title="Đính kèm file"
                        >
                            <Paperclip size={16} />
                        </button>
                        <button
                            type="button"
                            onClick={() => imageInputRef.current?.click()}
                            className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors cursor-pointer shrink-0 self-end"
                            style={{ background: 'var(--color-bg)', color: 'var(--color-fg-muted)', border: '1px solid var(--color-border)' }}
                            title="Gửi hình ảnh"
                        >
                            <Image size={16} />
                        </button>
                        <button
                            type="button"
                            onClick={() => setWebSearchEnabled(!webSearchEnabled)}
                            className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors cursor-pointer shrink-0 self-end"
                            style={{
                                background: webSearchEnabled ? 'rgba(59,130,246,0.1)' : 'var(--color-bg)',
                                color: webSearchEnabled ? 'rgb(59,130,246)' : 'var(--color-fg-muted)',
                                border: webSearchEnabled ? '1px solid rgba(59,130,246,0.3)' : '1px solid var(--color-border)',
                            }}
                            title={webSearchEnabled ? 'Tìm kiếm Web BẬT' : 'Tìm kiếm Web TẮT'}
                        >
                            <Search size={16} />
                        </button>
                        <div className="flex-1 relative">
                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                onCompositionStart={() => { isComposingRef.current = true; }}
                                onCompositionEnd={() => { isComposingRef.current = false; }}
                                placeholder={`Hỏi ${activeDomainInfo?.name || 'HiTechClaw'} bất kì điều gì... (Shift+Enter xuống dòng)`}
                                rows={1}
                                className="w-full resize-none pl-3 pr-3 py-2.5 rounded-xl text-sm border outline-none transition-colors"
                                style={{
                                    background: 'var(--color-bg)',
                                    borderColor: 'var(--color-border)',
                                    color: 'var(--color-fg)',
                                    minHeight: '40px',
                                    maxHeight: '160px',
                                    overflow: 'auto',
                                }}
                            />
                        </div>
                        <button
                            type="button"
                            onClick={isRecording ? stopRecording : startRecording}
                            disabled={isTranscribing}
                            className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors cursor-pointer shrink-0 self-end"
                            style={{
                                background: isRecording ? 'rgba(239,68,68,0.15)' : 'var(--color-bg)',
                                color: isRecording ? 'rgb(239,68,68)' : 'var(--color-fg-muted)',
                                border: isRecording ? '1px solid rgba(239,68,68,0.4)' : '1px solid var(--color-border)',
                                animation: isRecording ? 'pulse 1.5s infinite' : 'none',
                            }}
                            title={isRecording ? `Đang ghi... ${recordingDuration}s — nhấn để dừng` : 'Nhập giọng nói'}
                        >
                            {isTranscribing ? <Loader2 size={16} className="animate-spin" /> : isRecording ? <StopCircle size={16} /> : <Mic size={16} />}
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !input.trim()}
                            className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 self-end"
                            style={{ background: 'var(--color-primary)', color: 'white' }}
                        >
                            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                        </button>
                    </form>
                    <div className="max-w-3xl mx-auto mt-1.5 flex items-center justify-between">
                        <p className="text-[10px] flex items-center gap-1.5" style={{ color: 'var(--color-fg-muted)', opacity: 0.5 }}>
                            RAG-enhanced · {activeModel || 'No model'} · {activeDomainInfo?.icon} {activeDomainInfo?.name || 'General'}
                            {webSearchEnabled && <span style={{ color: 'rgb(59,130,246)', opacity: 1 }}>· 🔍 Web</span>}
                            {isRecording && <span style={{ color: 'rgb(239,68,68)', opacity: 1 }}>· 🎙️ Đang ghi ({recordingDuration}s)</span>}
                            {isTranscribing && <span style={{ color: 'var(--color-warning)', opacity: 1 }}>· ⏳ Đang chuyển giọng nói...</span>}
                            {debugMode && <span style={{ color: 'var(--color-warning)', opacity: 1 }}>· 🐛 Debug</span>}
                        </p>
                        <p className="text-[10px]" style={{ color: 'var(--color-fg-muted)', opacity: 0.5 }}>
                            Enter to send · Shift+Enter for newline
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ChatBubble({
    message, userQuestion, onCopy, onRegenerate, onSpeak, isSpeaking, copied, debugMode, onQuickReply,
}: {
    message: Message;
    userQuestion: string;
    onCopy: () => void;
    onRegenerate?: () => void;
    onSpeak?: () => void;
    isSpeaking?: boolean;
    copied: boolean;
    debugMode: boolean;
    onQuickReply?: (text: string) => void;
}) {
    const isUser = message.role === 'user';
    const [debugOpen, setDebugOpen] = useState(false);
    const [savedToKB, setSavedToKB] = useState(false);
    const [saving, setSaving] = useState(false);
    const [feedbackGiven, setFeedbackGiven] = useState<'positive' | 'negative' | null>(null);
    const [showCorrection, setShowCorrection] = useState(false);
    const [correctionText, setCorrectionText] = useState('');
    const [submittingFeedback, setSubmittingFeedback] = useState(false);
    const hasDebug = !isUser && message.debugInfo && (
        message.debugInfo.hasRag || message.debugInfo.webResults?.length || message.debugInfo.timing || message.debugInfo.usage
    );
    const hasWebResults = !isUser && message.debugInfo?.webResults && message.debugInfo.webResults.length > 0;

    // Parse interactive blocks from assistant messages (```interactive-blocks\n{...}\n```)
    const { cleanContent, interactiveBlocks } = useMemo(() => {
        if (isUser || !message.content) return { cleanContent: message.content, interactiveBlocks: [] as Array<{ type: string; title?: string; buttons: Array<{ label: string; value: string; icon?: string }> }> };
        const blockRegex = /```interactive-blocks\s*\n([\s\S]*?)\n```/g;
        let clean = message.content;
        const blocks: Array<{ type: string; title?: string; buttons: Array<{ label: string; value: string; icon?: string }> }> = [];
        let match: RegExpExecArray | null;
        while ((match = blockRegex.exec(message.content)) !== null) {
            try {
                const parsed = JSON.parse(match[1]);
                if (parsed.buttons && Array.isArray(parsed.buttons)) {
                    blocks.push(parsed);
                }
            } catch { /* invalid JSON */ }
            clean = clean.replace(match[0], '');
        }
        return { cleanContent: clean.trim(), interactiveBlocks: blocks };
    }, [message.content, isUser]);

    const handleSaveToKB = async () => {
        if (!message.debugInfo?.webResults || saving || savedToKB) return;
        setSaving(true);
        try {
            await saveSearchToKnowledge(
                message.debugInfo.webResults,
                message.debugInfo.webQuery || 'web search',
            );
            setSavedToKB(true);
        } catch { /* ignore */ }
        setSaving(false);
    };

    return (
        <div className={`flex gap-2.5 animate-fade-in group ${isUser ? 'justify-end' : ''}`}>
            {!isUser && (
                <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 overflow-hidden"
                    style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.15))', boxShadow: '0 2px 6px rgba(99,102,241,0.15)' }}
                >
                    <img src="/logo.png" alt="HiTechClaw" className="w-5 h-5" />
                </div>
            )}
            <div className="max-w-[80%] min-w-0">
                <div
                    className="px-3.5 py-2.5 rounded-2xl text-sm"
                    style={{
                        background: isUser ? 'var(--color-primary)' : 'var(--color-bg-soft)',
                        color: isUser ? 'white' : 'var(--color-fg)',
                        borderBottomRightRadius: isUser ? '6px' : undefined,
                        borderBottomLeftRadius: !isUser ? '6px' : undefined,
                    }}
                >
                    {message.attachments && message.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-1.5">
                            {message.attachments.map((att) => (
                                <div key={att.id} className="flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded"
                                    style={{ background: isUser ? 'rgba(255,255,255,0.15)' : 'var(--color-bg)' }}
                                >
                                    {att.previewUrl ? (
                                        <img src={att.previewUrl} alt={att.name} className="w-5 h-5 rounded object-cover" />
                                    ) : (
                                        <Paperclip size={10} />
                                    )}
                                    <span className="max-w-[80px] truncate">{att.name}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    {isUser ? (
                        <p className="whitespace-pre-wrap">{message.content}</p>
                    ) : (
                        <div className="prose-chat">
                            {message.streaming && !message.content && (
                                <div className="flex gap-1 py-1">
                                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-fg-muted)', animation: 'pulse-dot 1.4s infinite 0s' }} />
                                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-fg-muted)', animation: 'pulse-dot 1.4s infinite 0.2s' }} />
                                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-fg-muted)', animation: 'pulse-dot 1.4s infinite 0.4s' }} />
                                </div>
                            )}
                            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{cleanContent}</ReactMarkdown>
                        </div>
                    )}
                </div>

                {/* Interactive Quick Reply Blocks */}
                {!isUser && interactiveBlocks.length > 0 && !message.streaming && (
                    <div className="mt-2 space-y-2">
                        {interactiveBlocks.map((block, bi) => (
                            <div key={bi}>
                                {block.title && (
                                    <p className="text-[11px] font-medium mb-1.5" style={{ color: 'var(--color-fg-muted)' }}>{block.title}</p>
                                )}
                                <div className="flex flex-wrap gap-1.5">
                                    {block.buttons.map((btn, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => onQuickReply?.(btn.value)}
                                            className="px-3 py-1.5 rounded-xl text-xs font-medium border transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                                            style={{
                                                background: 'var(--color-bg)',
                                                borderColor: 'var(--color-primary)',
                                                color: 'var(--color-primary)',
                                            }}
                                        >
                                            {btn.icon && <span className="mr-1">{btn.icon}</span>}
                                            {btn.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Web Search Sources — always visible when present */}
                {hasWebResults && !message.streaming && (
                    <div className="mt-2 p-2.5 rounded-xl border" style={{ background: 'var(--color-bg)', borderColor: 'rgba(59,130,246,0.15)' }}>
                        <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: 'rgb(59,130,246)' }}>
                                <Globe size={11} />
                                <span>Web Sources ({message.debugInfo!.webResults!.length})</span>
                                {message.debugInfo?.timing?.searchMs != null && (
                                    <span className="font-normal opacity-60 ml-1">{message.debugInfo.timing.searchMs}ms</span>
                                )}
                            </div>
                            <button
                                onClick={handleSaveToKB}
                                disabled={saving || savedToKB}
                                className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md transition-colors cursor-pointer disabled:opacity-50"
                                style={{
                                    background: savedToKB ? 'rgba(34,197,94,0.1)' : 'rgba(59,130,246,0.08)',
                                    color: savedToKB ? 'rgb(34,197,94)' : 'rgb(59,130,246)',
                                }}
                                title={savedToKB ? 'Saved to Knowledge Base' : 'Save search results to Knowledge Base'}
                            >
                                {saving ? <Loader2 size={9} className="animate-spin" /> : savedToKB ? <Check size={9} /> : <BookmarkPlus size={9} />}
                                <span>{savedToKB ? 'Saved to KB' : 'Save to KB'}</span>
                            </button>
                        </div>
                        <div className="space-y-1">
                            {message.debugInfo!.webResults!.map((r, idx) => (
                                <a
                                    key={idx}
                                    href={r.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-start gap-1.5 p-1.5 rounded-lg transition-colors"
                                    style={{ background: 'var(--color-bg-soft)' }}
                                >
                                    <span className="text-[9px] font-bold mt-0.5 shrink-0 w-4 h-4 rounded flex items-center justify-center"
                                        style={{ background: 'rgba(59,130,246,0.1)', color: 'rgb(59,130,246)' }}
                                    >{idx + 1}</span>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1 text-[11px] font-medium" style={{ color: 'rgb(59,130,246)' }}>
                                            <ExternalLink size={9} className="shrink-0" />
                                            <span className="truncate">{r.title}</span>
                                        </div>
                                        {r.snippet && <p className="text-[10px] mt-0.5 line-clamp-2" style={{ color: 'var(--color-fg-muted)' }}>{r.snippet}</p>}
                                        <p className="text-[9px] mt-0.5 truncate opacity-50" style={{ color: 'var(--color-fg-muted)' }}>{r.url}</p>
                                    </div>
                                </a>
                            ))}
                        </div>
                    </div>
                )}

                {/* Debug Panel */}
                {debugMode && hasDebug && !message.streaming && (
                    <div className="mt-1.5">
                        <button
                            onClick={() => setDebugOpen(!debugOpen)}
                            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg transition-colors cursor-pointer"
                            style={{ color: 'var(--color-warning)', background: 'rgba(234,179,8,0.08)' }}
                        >
                            <ChevronRight size={10} className={`transition-transform ${debugOpen ? 'rotate-90' : ''}`} />
                            <Bug size={10} />
                            <span>Debug Info</span>
                            {message.debugInfo?.usage && (
                                <span className="ml-1 opacity-70">{message.debugInfo.usage.totalTokens} tokens</span>
                            )}
                            {message.debugInfo?.timing?.llmMs && (
                                <span className="ml-1 opacity-70">{message.debugInfo.timing.llmMs}ms</span>
                            )}
                        </button>
                        {debugOpen && (
                            <div
                                className="mt-1 p-2.5 rounded-xl text-[11px] space-y-2 border"
                                style={{
                                    background: 'var(--color-bg)',
                                    borderColor: 'rgba(234,179,8,0.15)',
                                    color: 'var(--color-fg-muted)',
                                }}
                            >
                                {/* RAG Context */}
                                {message.debugInfo?.hasRag && message.debugInfo.ragContext && (
                                    <div>
                                        <div className="flex items-center gap-1 font-semibold mb-1" style={{ color: 'var(--color-fg)' }}>
                                            <Database size={10} /> RAG Context
                                        </div>
                                        <pre className="whitespace-pre-wrap text-[10px] p-2 rounded-lg overflow-auto max-h-32"
                                            style={{ background: 'var(--color-bg-soft)' }}
                                        >
                                            {message.debugInfo.ragContext}
                                        </pre>
                                    </div>
                                )}

                                {/* Web Search Results */}
                                {message.debugInfo?.webResults && message.debugInfo.webResults.length > 0 && (
                                    <div>
                                        <div className="flex items-center gap-1 font-semibold mb-1" style={{ color: 'var(--color-fg)' }}>
                                            <Search size={10} /> Web Search ({message.debugInfo.webResults.length} results)
                                        </div>
                                        <div className="space-y-1">
                                            {message.debugInfo.webResults.map((r, idx) => (
                                                <div key={idx} className="p-1.5 rounded-lg" style={{ background: 'var(--color-bg-soft)' }}>
                                                    <a
                                                        href={r.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-1 text-[10px] font-medium hover:underline"
                                                        style={{ color: 'rgb(59,130,246)' }}
                                                    >
                                                        <ExternalLink size={9} />
                                                        {r.title}
                                                    </a>
                                                    {r.snippet && <p className="text-[9px] mt-0.5 opacity-70">{r.snippet}</p>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Timing & Usage */}
                                <div className="flex flex-wrap gap-3">
                                    {message.debugInfo?.timing && (
                                        <div>
                                            <div className="flex items-center gap-1 font-semibold mb-0.5" style={{ color: 'var(--color-fg)' }}>
                                                <Timer size={10} /> Timing
                                            </div>
                                            <div className="flex gap-2">
                                                {message.debugInfo.timing.llmMs != null && (
                                                    <span className="px-1.5 py-0.5 rounded" style={{ background: 'var(--color-bg-soft)' }}>
                                                        LLM: {message.debugInfo.timing.llmMs}ms
                                                    </span>
                                                )}
                                                {message.debugInfo.timing.searchMs != null && (
                                                    <span className="px-1.5 py-0.5 rounded" style={{ background: 'var(--color-bg-soft)' }}>
                                                        Search: {message.debugInfo.timing.searchMs}ms
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    {message.debugInfo?.usage && (
                                        <div>
                                            <div className="flex items-center gap-1 font-semibold mb-0.5" style={{ color: 'var(--color-fg)' }}>
                                                <Zap size={10} /> Tokens
                                            </div>
                                            <div className="flex gap-2">
                                                <span className="px-1.5 py-0.5 rounded" style={{ background: 'var(--color-bg-soft)' }}>
                                                    Prompt: {message.debugInfo.usage.promptTokens}
                                                </span>
                                                <span className="px-1.5 py-0.5 rounded" style={{ background: 'var(--color-bg-soft)' }}>
                                                    Completion: {message.debugInfo.usage.completionTokens}
                                                </span>
                                                <span className="px-1.5 py-0.5 rounded font-medium" style={{ background: 'var(--color-bg-soft)' }}>
                                                    Total: {message.debugInfo.usage.totalTokens}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                    {message.debugInfo?.finishReason && (
                                        <div>
                                            <span className="font-semibold" style={{ color: 'var(--color-fg)' }}>Finish: </span>
                                            <span className="px-1.5 py-0.5 rounded" style={{ background: 'var(--color-bg-soft)' }}>
                                                {message.debugInfo.finishReason}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Actions */}
                {!isUser && !message.streaming && message.content && (
                    <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={onCopy}
                            className="p-1 rounded transition-colors cursor-pointer"
                            style={{ color: 'var(--color-fg-muted)' }}
                            title="Copy"
                        >
                            {copied ? <Check size={12} style={{ color: 'var(--color-success)' }} /> : <Copy size={12} />}
                        </button>
                        {onRegenerate && (
                            <button
                                onClick={onRegenerate}
                                className="p-1 rounded transition-colors cursor-pointer"
                                style={{ color: 'var(--color-fg-muted)' }}
                                title="Regenerate"
                            >
                                <RotateCcw size={12} />
                            </button>
                        )}
                        {onSpeak && (
                            <button
                                onClick={onSpeak}
                                className="p-1 rounded transition-colors cursor-pointer"
                                style={{ color: isSpeaking ? 'var(--color-primary)' : 'var(--color-fg-muted)' }}
                                title={isSpeaking ? 'Dừng đọc' : 'Đọc to'}
                            >
                                <Volume2 size={12} />
                            </button>
                        )}
                        <div className="w-px h-3 mx-0.5" style={{ background: 'var(--color-border)' }} />
                        <button
                            onClick={async () => {
                                if (feedbackGiven) return;
                                setFeedbackGiven('positive');
                                try {
                                    await submitChatFeedback(userQuestion, message.content, 'positive');
                                } catch { }
                            }}
                            className="p-1 rounded transition-colors cursor-pointer"
                            style={{ color: feedbackGiven === 'positive' ? 'var(--color-success)' : 'var(--color-fg-muted)' }}
                            title="Good answer"
                            disabled={!!feedbackGiven}
                        >
                            <ThumbsUp size={12} />
                        </button>
                        <button
                            onClick={() => {
                                if (feedbackGiven === 'positive') return;
                                if (feedbackGiven === 'negative') {
                                    setShowCorrection(!showCorrection);
                                    return;
                                }
                                setFeedbackGiven('negative');
                                setShowCorrection(true);
                            }}
                            className="p-1 rounded transition-colors cursor-pointer"
                            style={{ color: feedbackGiven === 'negative' ? 'var(--color-danger, #ef4444)' : 'var(--color-fg-muted)' }}
                            title="Bad answer — provide correction"
                            disabled={feedbackGiven === 'positive'}
                        >
                            <ThumbsDown size={12} />
                        </button>
                        <span className="text-[10px] ml-1" style={{ color: 'var(--color-fg-muted)', opacity: 0.5 }}>
                            <Clock size={9} className="inline mr-0.5" />
                            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                )}
                {/* Correction input for self-learning */}
                {showCorrection && feedbackGiven === 'negative' && (
                    <div className="mt-2 rounded-lg p-2.5 text-xs" style={{ background: 'var(--color-bg-soft)', border: '1px solid var(--color-border)' }}>
                        <div className="flex items-center gap-1 mb-1.5" style={{ color: 'var(--color-fg-muted)' }}>
                            <MessageSquare size={11} />
                            <span className="font-medium">Provide correct answer to help AI learn:</span>
                        </div>
                        <textarea
                            value={correctionText}
                            onChange={(e) => setCorrectionText(e.target.value)}
                            className="w-full rounded-md p-2 text-xs resize-none focus:outline-none"
                            style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-fg)', minHeight: '60px' }}
                            placeholder="Type the correct answer here..."
                        />
                        <div className="flex justify-end gap-1.5 mt-1.5">
                            <button
                                onClick={() => { setShowCorrection(false); setCorrectionText(''); setFeedbackGiven(null); }}
                                className="px-2 py-1 rounded text-[11px] cursor-pointer"
                                style={{ color: 'var(--color-fg-muted)' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    if (!correctionText.trim() || submittingFeedback) return;
                                    setSubmittingFeedback(true);
                                    try {
                                        await submitChatFeedback(
                                            userQuestion,
                                            message.content,
                                            'negative',
                                            correctionText.trim(),
                                        );
                                        setShowCorrection(false);
                                    } catch { } finally {
                                        setSubmittingFeedback(false);
                                    }
                                }}
                                disabled={!correctionText.trim() || submittingFeedback}
                                className="px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer"
                                style={{
                                    background: correctionText.trim() ? 'var(--color-accent)' : 'var(--color-bg-soft)',
                                    color: correctionText.trim() ? '#fff' : 'var(--color-fg-muted)',
                                }}
                            >
                                {submittingFeedback ? 'Submitting...' : 'Submit Correction'}
                            </button>
                        </div>
                    </div>
                )}
                {isUser && (
                    <div className="flex justify-end mt-0.5">
                        <span className="text-[10px]" style={{ color: 'var(--color-fg-muted)', opacity: 0.4 }}>
                            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                )}
            </div>
            {isUser && (
                <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: 'var(--color-bg-soft)' }}
                >
                    <User size={14} style={{ color: 'var(--color-fg-muted)' }} />
                </div>
            )}
        </div>
    );
}

function EmptyState({
    domains, activeDomain, onSelectDomain, onQuickPrompt,
}: {
    domains: DomainOption[];
    activeDomain: string;
    onSelectDomain: (id: string) => void;
    onQuickPrompt: (prompt: string) => void;
}) {
    return (
        <div className="flex flex-col items-center justify-center h-full max-w-2xl mx-auto relative">
            {/* Background mesh */}
            <div className="absolute inset-0 gradient-mesh opacity-50 pointer-events-none" />

            <div className="relative">
                <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 overflow-hidden"
                    style={{ boxShadow: '0 6px 20px rgba(99,102,241,0.35)' }}
                >
                    <img src="/logo.png" alt="HiTechClaw" className="w-14 h-14" />
                </div>
                <h3 className="text-xl font-bold mb-1 text-center" style={{ color: 'var(--color-fg)' }}>HiTechClaw AI Chat</h3>
                <p className="text-xs text-center mb-8" style={{ color: 'var(--color-fg-muted)' }}>
                    RAG-enhanced multi-domain AI assistant. Select a domain and start chatting.
                </p>

                {/* Domain quick-select */}
                {domains.length > 0 && (
                    <div className="w-full mb-8">
                        <p className="text-[11px] font-semibold mb-2.5 text-center" style={{ color: 'var(--color-fg-muted)' }}>
                            <Globe size={12} className="inline mr-1" /> SELECT DOMAIN
                        </p>
                        <div className="flex flex-wrap justify-center gap-1.5">
                            {domains.map((d) => (
                                <button
                                    key={d.id}
                                    onClick={() => onSelectDomain(d.id)}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer hover-lift"
                                    style={{
                                        background: d.id === activeDomain
                                            ? 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))'
                                            : 'var(--color-bg-surface)',
                                        color: d.id === activeDomain ? 'var(--color-primary-light)' : 'var(--color-fg-muted)',
                                        border: d.id === activeDomain
                                            ? '1px solid rgba(99,102,241,0.4)'
                                            : '1px solid var(--color-border)',
                                        boxShadow: d.id === activeDomain ? '0 2px 8px rgba(99,102,241,0.15)' : 'none',
                                    }}
                                >
                                    <span>{d.icon}</span>
                                    <span>{d.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Quick prompts */}
                <div className="w-full">
                    <p className="text-[11px] font-semibold mb-2.5 text-center" style={{ color: 'var(--color-fg-muted)' }}>
                        <Sparkles size={12} className="inline mr-1" /> QUICK START
                    </p>
                    <div className="grid grid-cols-3 gap-2.5">
                        {QUICK_PROMPTS.map((qp) => (
                            <button
                                key={qp.label}
                                onClick={() => onQuickPrompt(qp.prompt)}
                                className="flex items-center gap-2 px-3 py-3 rounded-xl text-xs transition-all duration-200 cursor-pointer text-left hover-lift hover-border-glow"
                                style={{
                                    background: 'var(--color-bg-surface)',
                                    border: '1px solid var(--color-border)',
                                    color: 'var(--color-fg-muted)',
                                }}
                            >
                                <span className="text-base">{qp.icon}</span>
                                <span className="font-medium">{qp.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
