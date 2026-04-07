import React, { useEffect, useRef } from 'react';
import { ChatBubble } from './ChatBubble';

export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    createdAt: Date;
    isStreaming?: boolean;
}

interface MessageListProps {
    messages: Message[];
}

export const MessageList: React.FC<MessageListProps> = ({ messages }) => {
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, messages[messages.length - 1]?.content]);

    if (messages.length === 0) {
        return (
            <div className="chat-empty">
                <div className="chat-empty-icon">🤖</div>
                <p className="chat-empty-title">HiTechClaw AI</p>
                <p className="chat-empty-subtitle">Xin chào! Tôi có thể giúp gì cho bạn?</p>
            </div>
        );
    }

    return (
        <div className="message-list">
            {messages.map((msg) => (
                <ChatBubble
                    key={msg.id}
                    role={msg.role}
                    content={msg.content}
                    timestamp={msg.createdAt}
                    isStreaming={msg.isStreaming}
                />
            ))}
            <div ref={bottomRef} />
        </div>
    );
};
