import React, { useState, useCallback, useRef } from 'react';
import { MessageList } from '../components/MessageList';
import type { Message } from '../components/MessageList';
import { ChatInput } from '../components/ChatInput';
import { TypingIndicator } from '../components/TypingIndicator';
import hitechclaw from '../lib/api';
import type { StreamCallbacks } from '@hitechclaw/chat-sdk';

interface ChatPageProps {
    sessionId: string;
    onNewSession: () => void;
}

export const ChatPage: React.FC<ChatPageProps> = ({ sessionId, onNewSession }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const abortRef = useRef<{ abort: () => void } | null>(null);

    const handleSend = useCallback(async (text: string) => {
        const userMsg: Message = {
            id: crypto.randomUUID(),
            role: 'user',
            content: text,
            createdAt: new Date(),
        };

        const assistantId = crypto.randomUUID();
        const assistantMsg: Message = {
            id: assistantId,
            role: 'assistant',
            content: '',
            createdAt: new Date(),
            isStreaming: true,
        };

        setMessages((prev) => [...prev, userMsg, assistantMsg]);
        setIsStreaming(true);

        let fullContent = '';

        const callbacks: StreamCallbacks = {
            onTextDelta: (delta: string) => {
                fullContent += delta;
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === assistantId ? { ...m, content: fullContent } : m,
                    ),
                );
            },
            onFinish: () => {
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === assistantId ? { ...m, isStreaming: false } : m,
                    ),
                );
                setIsStreaming(false);

                // Persist assistant message
                hitechclaw.saveMessage(sessionId, fullContent).catch(() => { });
            },
            onError: (err: Error) => {
                const errorContent = fullContent || `Lỗi: ${err.message}`;
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === assistantId
                            ? { ...m, content: errorContent, isStreaming: false }
                            : m,
                    ),
                );
                setIsStreaming(false);
            },
        };

        const handle = hitechclaw.chatStream(text, callbacks, { sessionId });
        abortRef.current = handle;
    }, [sessionId]);

    const handleCancel = useCallback(() => {
        abortRef.current?.abort();
        setIsStreaming(false);
    }, []);

    return (
        <div className="chat-page">
            <div className="chat-header">
                <button className="chat-header-btn" onClick={onNewSession} aria-label="Cuộc trò chuyện mới">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                </button>
                <h1 className="chat-header-title">HiTechClaw AI</h1>
                <div style={{ width: 36 }} />
            </div>

            <div className="chat-messages">
                <MessageList messages={messages} />
                {isStreaming && messages[messages.length - 1]?.content === '' && (
                    <TypingIndicator />
                )}
            </div>

            <div className="chat-footer">
                {isStreaming ? (
                    <div className="chat-cancel-row">
                        <button className="chat-cancel-btn" onClick={handleCancel}>
                            ⏹ Dừng
                        </button>
                    </div>
                ) : (
                    <ChatInput onSend={handleSend} disabled={isStreaming} />
                )}
            </div>
        </div>
    );
};
