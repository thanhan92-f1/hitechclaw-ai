import React, { useState, useCallback, useEffect } from 'react';
import { ChatPage } from '../pages/ChatPage';
import { HistoryPage } from '../pages/HistoryPage';
import { loginWithZalo, getStoredToken, getStoredUser } from '../lib/zalo-auth';
import type { HiTechClawUser } from '../lib/zalo-auth';
import { setApiToken, getApiBaseUrl } from '../lib/api';
import hitechclaw from '../lib/api';
import type { Message } from './MessageList';

type Tab = 'chat' | 'history';

const Layout: React.FC = () => {
    const [tab, setTab] = useState<Tab>('chat');
    const [sessionId, setSessionId] = useState(crypto.randomUUID());
    const [user, setUser] = useState<HiTechClawUser | null>(getStoredUser());
    const [authLoading, setAuthLoading] = useState(!getStoredToken());
    const [authError, setAuthError] = useState<string | null>(null);

    // Auto-login with Zalo SDK on mount
    useEffect(() => {
        const existingToken = getStoredToken();
        if (existingToken) {
            setApiToken(existingToken);
            setAuthLoading(false);
            return;
        }

        setAuthLoading(true);
        loginWithZalo(getApiBaseUrl())
            .then((data) => {
                setApiToken(data.token);
                setUser(data.user);
                setAuthLoading(false);
            })
            .catch((err) => {
                console.error('Zalo auth failed:', err);
                setAuthError(err instanceof Error ? err.message : 'Đăng nhập thất bại');
                setAuthLoading(false);
            });
    }, []);

    const handleNewSession = useCallback(() => {
        setSessionId(crypto.randomUUID());
    }, []);

    const handleSelectSession = useCallback(async (id: string) => {
        setSessionId(id);
        setTab('chat');
    }, []);

    // Auth loading state
    if (authLoading) {
        return (
            <div className="auth-loading">
                <div className="auth-loading-content">
                    <div className="auth-spinner" />
                    <p>Đang kết nối...</p>
                </div>
            </div>
        );
    }

    // Auth error state
    if (authError && !user) {
        return (
            <div className="auth-error">
                <div className="auth-error-content">
                    <p className="auth-error-icon">⚠️</p>
                    <p className="auth-error-text">{authError}</p>
                    <button
                        className="auth-retry-btn"
                        onClick={() => {
                            setAuthError(null);
                            setAuthLoading(true);
                            loginWithZalo(getApiBaseUrl())
                                .then((data) => {
                                    setApiToken(data.token);
                                    setUser(data.user);
                                    setAuthLoading(false);
                                })
                                .catch((err) => {
                                    setAuthError(err instanceof Error ? err.message : 'Đăng nhập thất bại');
                                    setAuthLoading(false);
                                });
                        }}
                    >
                        Thử lại
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="app">
            <div className="app-content">
                {tab === 'chat' && (
                    <ChatPage
                        sessionId={sessionId}
                        onNewSession={handleNewSession}
                    />
                )}
                {tab === 'history' && (
                    <HistoryPage onSelectSession={handleSelectSession} />
                )}
            </div>

            {/* Bottom Navigation */}
            <nav className="bottom-nav">
                <button
                    className={`bottom-nav-item ${tab === 'chat' ? 'bottom-nav-item--active' : ''}`}
                    onClick={() => setTab('chat')}
                >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <span>Chat</span>
                </button>
                <button
                    className={`bottom-nav-item ${tab === 'history' ? 'bottom-nav-item--active' : ''}`}
                    onClick={() => setTab('history')}
                >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span>Lịch sử</span>
                </button>
            </nav>
        </div>
    );
};

export default Layout;
