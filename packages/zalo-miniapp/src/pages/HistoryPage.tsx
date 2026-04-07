import React, { useEffect, useState, useCallback } from 'react';
import hitechclaw from '../lib/api';

interface ConversationSummary {
    id: string;
    title?: string;
    lastMessage?: string;
    messageCount: number;
    updatedAt: string;
}

interface HistoryPageProps {
    onSelectSession: (sessionId: string) => void;
}

export const HistoryPage: React.FC<HistoryPageProps> = ({ onSelectSession }) => {
    const [conversations, setConversations] = useState<ConversationSummary[]>([]);
    const [loading, setLoading] = useState(true);

    const loadConversations = useCallback(async () => {
        setLoading(true);
        try {
            const data = await hitechclaw.listSessions();
            setConversations(data.conversations || []);
        } catch {
            // Silently fail
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadConversations();
    }, [loadConversations]);

    const handleDelete = async (e: React.MouseEvent, sessionId: string) => {
        e.stopPropagation();
        try {
            await hitechclaw.deleteSession(sessionId);
            setConversations((prev) => prev.filter((c) => c.id !== sessionId));
        } catch {
            // Silently fail
        }
    };

    const formatDate = (dateStr: string): string => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / 86_400_000);

        if (days === 0) return 'Hôm nay';
        if (days === 1) return 'Hôm qua';
        if (days < 7) return `${days} ngày trước`;
        return date.toLocaleDateString('vi-VN');
    };

    return (
        <div className="history-page">
            <div className="history-header">
                <h1 className="history-title">Lịch sử trò chuyện</h1>
            </div>

            <div className="history-list">
                {loading && (
                    <div className="history-loading">
                        <div className="typing-indicator">
                            <span className="typing-dot" />
                            <span className="typing-dot" />
                            <span className="typing-dot" />
                        </div>
                    </div>
                )}

                {!loading && conversations.length === 0 && (
                    <div className="history-empty">
                        <p>Chưa có cuộc trò chuyện nào</p>
                    </div>
                )}

                {conversations.map((conv) => (
                    <div
                        key={conv.id}
                        className="history-item"
                        onClick={() => onSelectSession(conv.id)}
                    >
                        <div className="history-item-content">
                            <p className="history-item-title">
                                {conv.title || 'Cuộc trò chuyện'}
                            </p>
                            {conv.lastMessage && (
                                <p className="history-item-preview">
                                    {conv.lastMessage.slice(0, 80)}
                                    {conv.lastMessage.length > 80 ? '...' : ''}
                                </p>
                            )}
                            <span className="history-item-meta">
                                {formatDate(conv.updatedAt)} · {conv.messageCount} tin nhắn
                            </span>
                        </div>
                        <button
                            className="history-delete-btn"
                            onClick={(e) => handleDelete(e, conv.id)}
                            aria-label="Xóa"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                <path d="M10 11v6" />
                                <path d="M14 11v6" />
                            </svg>
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};
