// ============================================================
// @hitechclaw/chat-sdk/react — useSessions Hook
// ============================================================

import { useState, useCallback, useEffect } from 'react';
import { useHiTechClawClient } from './provider.js';
import type { ChatMessage, ConversationSummary } from '../types.js';

export interface UseSessionsReturn {
    /** All sessions */
    sessions: ConversationSummary[];
    /** Currently loading */
    loading: boolean;
    /** Refresh session list */
    refresh: () => Promise<void>;
    /** Delete a session */
    deleteSession: (sessionId: string) => Promise<void>;
    /** Rename a session */
    renameSession: (sessionId: string, title: string) => Promise<void>;
    /** Get messages for a session */
    getMessages: (sessionId: string) => Promise<ChatMessage[]>;
}

/** Hook for managing chat sessions */
export function useSessions(): UseSessionsReturn {
    const client = useHiTechClawClient();
    const [sessions, setSessions] = useState<ConversationSummary[]>([]);
    const [loading, setLoading] = useState(false);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const res = await client.listSessions();
            setSessions(res);
        } catch {
            // silent fail
        }
        setLoading(false);
    }, [client]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const deleteSession = useCallback(async (sessionId: string) => {
        await client.deleteSession(sessionId);
        setSessions(prev => prev.filter(s => s.id !== sessionId));
    }, [client]);

    const renameSession = useCallback(async (sessionId: string, title: string) => {
        await client.renameSession(sessionId, title);
        setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title } : s));
    }, [client]);

    const getMessages = useCallback(async (sessionId: string) => {
        const res = await client.getMessages(sessionId);
        return res.messages;
    }, [client]);

    return { sessions, loading, refresh, deleteSession, renameSession, getMessages };
}
