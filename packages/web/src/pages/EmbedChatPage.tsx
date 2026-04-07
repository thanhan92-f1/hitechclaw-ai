import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { setToken, getToken, clearToken, getMe } from '../lib/api';
import { ChatPage } from './ChatPage';

/**
 * Embed-only chat page for iframe embedding.
 * Accepts ?token=JWT or a valid existing local token.
 * Renders ChatPage without Layout/Sidebar.
 */
export function EmbedChatPage() {
    const [searchParams] = useSearchParams();
    const [ready, setReady] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const init = async () => {
            // 1. Check if token is passed via URL param
            const tokenParam = searchParams.get('token');
            if (tokenParam) {
                setToken(tokenParam);
                setReady(true);
                return;
            }

            // 2. Check if already authenticated
            const existing = getToken();
            if (existing) {
                try {
                    await getMe();
                    setReady(true);
                    return;
                } catch {
                    clearToken();
                }
            }

            // 3. No valid auth token
            setError('Missing or invalid token. Please provide ?token=<JWT> for embedded chat.');
        };
        init();
    }, [searchParams]);

    if (error) {
        return (
            <div className="flex items-center justify-center h-screen" style={{ background: 'var(--color-bg)' }}>
                <div className="text-center space-y-3">
                    <div className="text-2xl">⚠️</div>
                    <p className="text-sm" style={{ color: 'var(--color-fg-muted)' }}>{error}</p>
                </div>
            </div>
        );
    }

    if (!ready) {
        return (
            <div className="flex items-center justify-center h-screen" style={{ background: 'var(--color-bg)' }}>
                <div className="flex items-center gap-3">
                    <div className="animate-spin w-5 h-5 border-2 border-t-transparent rounded-full" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
                    <span className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>Đang kết nối HiTechClaw AI...</span>
                </div>
            </div>
        );
    }

    // In embed mode, collapse the chat sidebar by default for compact view
    useEffect(() => {
        if (ready) {
            localStorage.setItem('hitechclaw-sidebar-open', 'false');
        }
    }, [ready]);

    return (
        <div className="h-screen overflow-hidden" style={{ background: 'var(--color-bg)' }}>
            <ChatPage />
        </div>
    );
}
