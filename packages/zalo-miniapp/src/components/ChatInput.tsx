import React, { useState, useRef, useCallback } from 'react';

interface ChatInputProps {
    onSend: (message: string) => void;
    disabled?: boolean;
    placeholder?: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
    onSend,
    disabled = false,
    placeholder = 'Nhập tin nhắn...',
}) => {
    const [text, setText] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const composingRef = useRef(false);

    const handleSend = useCallback(() => {
        const trimmed = text.trim();
        if (!trimmed || disabled) return;
        onSend(trimmed);
        setText('');
        if (textareaRef.current) {
            textareaRef.current.style.height = '40px';
        }
    }, [text, disabled, onSend]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey && !composingRef.current) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setText(e.target.value);
        // Auto-resize
        const el = e.target;
        el.style.height = '40px';
        el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    };

    return (
        <div className="chat-input-container">
            <textarea
                ref={textareaRef}
                className="chat-input-textarea"
                value={text}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                onCompositionStart={() => { composingRef.current = true; }}
                onCompositionEnd={() => { composingRef.current = false; }}
                placeholder={placeholder}
                disabled={disabled}
                rows={1}
            />
            <button
                className={`chat-send-btn ${(!text.trim() || disabled) ? 'chat-send-btn--disabled' : ''}`}
                onClick={handleSend}
                disabled={!text.trim() || disabled}
                aria-label="Gửi"
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
            </button>
        </div>
    );
};
