import React from 'react';
import ReactMarkdown from 'react-markdown';

interface ChatBubbleProps {
    role: 'user' | 'assistant';
    content: string;
    timestamp?: Date;
    isStreaming?: boolean;
    avatarUrl?: string;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({
    role,
    content,
    timestamp,
    isStreaming,
    avatarUrl,
}) => {
    const isUser = role === 'user';

    return (
        <div className={`chat-bubble-row ${isUser ? 'chat-bubble-row--user' : 'chat-bubble-row--assistant'}`}>
            {!isUser && (
                <div className="chat-avatar">
                    {avatarUrl ? (
                        <img src={avatarUrl} alt="AI" className="chat-avatar-img" />
                    ) : (
                        <div className="chat-avatar-placeholder">🤖</div>
                    )}
                </div>
            )}
            <div className={`chat-bubble ${isUser ? 'chat-bubble--user' : 'chat-bubble--assistant'}`}>
                {isUser ? (
                    <p className="chat-bubble-text">{content}</p>
                ) : (
                    <div className="chat-bubble-markdown">
                        <ReactMarkdown>{content}</ReactMarkdown>
                        {isStreaming && <span className="typing-cursor">▊</span>}
                    </div>
                )}
                {timestamp && (
                    <span className="chat-bubble-time">
                        {timestamp.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                )}
            </div>
        </div>
    );
};
