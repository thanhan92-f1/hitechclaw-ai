// ============================================================
// @hitechclaw/chat-sdk/react — useSessions Hook
// ============================================================
import { useState, useCallback, useEffect } from 'react';
import { useHiTechClawClient } from './provider.js';
/** Hook for managing chat sessions */
export function useSessions() {
    const client = useHiTechClawClient();
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(false);
    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const res = await client.listSessions();
            setSessions(res);
        }
        catch {
            // silent fail
        }
        setLoading(false);
    }, [client]);
    useEffect(() => {
        refresh();
    }, [refresh]);
    const deleteSession = useCallback(async (sessionId) => {
        await client.deleteSession(sessionId);
        setSessions(prev => prev.filter(s => s.id !== sessionId));
    }, [client]);
    const renameSession = useCallback(async (sessionId, title) => {
        await client.renameSession(sessionId, title);
        setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title } : s));
    }, [client]);
    const getMessages = useCallback(async (sessionId) => {
        const res = await client.getMessages(sessionId);
        return res.messages;
    }, [client]);
    return { sessions, loading, refresh, deleteSession, renameSession, getMessages };
}
//# sourceMappingURL=use-sessions.js.map