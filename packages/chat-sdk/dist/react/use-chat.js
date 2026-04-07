// ============================================================
// @hitechclaw/chat-sdk/react — useChat Hook
// ============================================================
import { useState, useCallback, useRef } from 'react';
import { useHiTechClawClient } from './provider.js';
let idCounter = 0;
function genId(prefix) {
    return `${prefix}-${Date.now()}-${++idCounter}`;
}
/** Main hook for chat interactions — works with React and React Native */
export function useChat(options = {}) {
    const client = useHiTechClawClient();
    const [sessionId] = useState(() => options.sessionId ?? genId('session'));
    const [messages, setMessages] = useState(options.initialMessages ?? []);
    const [isStreaming, setIsStreaming] = useState(false);
    const [usage, setUsage] = useState(null);
    const [error, setError] = useState(null);
    const streamRef = useRef(null);
    const send = useCallback((text) => {
        if (isStreaming || !text.trim())
            return;
        setError(null);
        // Add user message
        const userMsg = {
            id: genId('u'),
            role: 'user',
            content: text.trim(),
            createdAt: new Date(),
        };
        // Add placeholder assistant message
        const botId = genId('a');
        const botMsg = {
            id: botId,
            role: 'assistant',
            content: '',
            createdAt: new Date(),
            isStreaming: true,
        };
        setMessages(prev => [...prev, userMsg, botMsg]);
        setIsStreaming(true);
        const toolCalls = new Map();
        const handle = client.chatStream(text.trim(), {
            onTextDelta: (delta) => {
                setMessages(prev => prev.map(m => m.id === botId ? { ...m, content: m.content + delta } : m));
            },
            onToolCallStart: (toolCallId, toolName) => {
                toolCalls.set(toolCallId, { name: toolName, args: '' });
                options.onToolCall?.(toolName, toolCallId);
            },
            onToolCallArgs: (toolCallId, argsJson) => {
                const tc = toolCalls.get(toolCallId);
                if (tc)
                    tc.args += argsJson;
            },
            onToolResult: (toolCallId, result) => {
                setMessages(prev => prev.map(m => {
                    if (m.id !== botId)
                        return m;
                    const tc = toolCalls.get(toolCallId);
                    const info = {
                        id: toolCallId,
                        name: tc?.name ?? 'unknown',
                        arguments: tc?.args ? safeParse(tc.args) : {},
                        result,
                    };
                    return { ...m, toolCalls: [...(m.toolCalls ?? []), info] };
                }));
            },
            onMeta: (key, data) => {
                options.onMeta?.(key, data);
                setMessages(prev => prev.map(m => m.id === botId
                    ? { ...m, metadata: { ...(m.metadata ?? {}), [key]: data } }
                    : m));
            },
            onFinish: (u, _reason) => {
                setUsage(u);
                setMessages(prev => {
                    const updated = prev.map(m => m.id === botId ? { ...m, usage: u, isStreaming: false } : m);
                    const final = updated.find(m => m.id === botId);
                    if (final)
                        options.onFinish?.(final);
                    return updated;
                });
            },
            onError: (err) => {
                const e = new Error(err);
                setError(e);
                options.onError?.(e);
                setMessages(prev => prev.map(m => m.id === botId
                    ? { ...m, content: m.content || `Error: ${err}`, isStreaming: false }
                    : m));
            },
        }, {
            sessionId,
            domainId: options.domainId,
            webSearch: options.webSearch,
        });
        streamRef.current = handle;
        handle.done
            .catch((err) => {
            if (err instanceof Error && err.name === 'AbortError')
                return;
            const e = err instanceof Error ? err : new Error(String(err));
            setError(e);
            options.onError?.(e);
        })
            .finally(() => {
            setIsStreaming(false);
            streamRef.current = null;
        });
    }, [client, sessionId, isStreaming, options.domainId, options.webSearch]);
    const cancel = useCallback(() => {
        streamRef.current?.cancel();
        streamRef.current = null;
        setIsStreaming(false);
        setMessages(prev => prev.map(m => m.isStreaming ? { ...m, isStreaming: false } : m));
    }, []);
    const clear = useCallback(() => {
        cancel();
        setMessages([]);
        setUsage(null);
        setError(null);
    }, [cancel]);
    return {
        messages,
        isStreaming,
        send,
        cancel,
        clear,
        setMessages,
        sessionId,
        usage,
        error,
    };
}
function safeParse(json) {
    try {
        return JSON.parse(json);
    }
    catch {
        return {};
    }
}
//# sourceMappingURL=use-chat.js.map