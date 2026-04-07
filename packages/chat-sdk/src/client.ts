// ============================================================
// @hitechclaw/chat-sdk — Core Client
// ============================================================

import type {
    HiTechClawConfig,
    ChatRequest,
    ChatResponse,
    LoginRequest,
    LoginResponse,
    ConversationListResponse,
    ConversationDetailResponse,
    MessageListResponse,
    UploadResponse,
    FeedbackRequest,
    StreamCallbacks,
    StreamHandle,
    StreamEvent,
    TokenUsage,
} from './types.js';

export class HiTechClawClient {
    private config: Required<Pick<HiTechClawConfig, 'baseUrl' | 'timeout'>> & HiTechClawConfig;
    private _fetch: typeof globalThis.fetch;

    constructor(config: HiTechClawConfig) {
        this.config = {
            timeout: 60_000,
            ...config,
            baseUrl: config.baseUrl.replace(/\/+$/, ''),
        };
        this._fetch = config.fetch ?? globalThis.fetch.bind(globalThis);
    }

    // ─── Auth ───────────────────────────────────────────────

    /** Authenticate and store token */
    async login(credentials: LoginRequest): Promise<LoginResponse> {
        const res = await this.request<LoginResponse>('/auth/login', {
            method: 'POST',
            body: credentials,
            skipAuth: true,
        });
        this.config.token = res.token;
        return res;
    }

    /** Set authentication token directly */
    setToken(token: string): void {
        this.config.token = token;
    }

    /** Get current token */
    getToken(): string | undefined {
        return this.config.token;
    }

    // ─── Chat ───────────────────────────────────────────────

    /** Send a chat message (non-streaming) */
    async chat(message: string, options?: Partial<Omit<ChatRequest, 'message' | 'stream'>>): Promise<ChatResponse> {
        return this.request<ChatResponse>('/api/chat', {
            method: 'POST',
            body: {
                message,
                stream: false,
                webSearch: this.config.webSearch,
                domainId: this.config.defaultDomain,
                ...options,
            } satisfies ChatRequest,
        });
    }

    /** Send a chat message with streaming response */
    chatStream(
        message: string,
        callbacks?: StreamCallbacks,
        options?: Partial<Omit<ChatRequest, 'message' | 'stream'>>,
    ): StreamHandle {
        const controller = new AbortController();
        const allEvents: StreamEvent[] = [];

        const done = this.executeStream(
            message,
            callbacks,
            options,
            controller,
            allEvents,
        );

        return {
            cancel: () => controller.abort(),
            done,
            events: done.then(() => allEvents),
        };
    }

    // ─── Sessions / Conversations ────────────────────────────

    /** List chat conversations */
    async listSessions(): Promise<ConversationListResponse> {
        return this.request<ConversationListResponse>('/api/chat/conversations');
    }

    /** Get a conversation with messages */
    async getConversation(sessionId: string): Promise<ConversationDetailResponse> {
        return this.request<ConversationDetailResponse>(`/api/chat/conversations/${encodeURIComponent(sessionId)}`);
    }

    /** Get messages for a session (alias for getConversation) */
    async getMessages(sessionId: string): Promise<MessageListResponse> {
        const conv = await this.getConversation(sessionId);
        return { messages: conv.messages };
    }

    /** Rename a conversation */
    async renameSession(sessionId: string, title: string): Promise<void> {
        await this.request(`/api/chat/conversations/${encodeURIComponent(sessionId)}`, {
            method: 'PUT',
            body: { title },
        });
    }

    /** Delete a chat session */
    async deleteSession(sessionId: string): Promise<void> {
        await this.request(`/api/chat/conversations/${encodeURIComponent(sessionId)}`, {
            method: 'DELETE',
        });
    }

    /** Save a completed assistant message */
    async saveMessage(sessionId: string, content: string): Promise<void> {
        await this.request('/api/chat/save-message', {
            method: 'POST',
            body: { sessionId, content },
        });
    }

    // ─── Attachments ────────────────────────────────────────

    /** Upload a file attachment */
    async uploadFile(file: Blob, filename: string): Promise<UploadResponse> {
        const formData = new FormData();
        formData.append('file', file, filename);

        const res = await this._fetch(`${this.config.baseUrl}/api/chat/upload`, {
            method: 'POST',
            headers: this.authHeaders(),
            body: formData,
            signal: AbortSignal.timeout(this.config.timeout),
        });

        if (!res.ok) {
            const body = await res.text();
            throw new HiTechClawError(`Upload failed: ${res.status}`, res.status, body);
        }

        return res.json();
    }

    // ─── Feedback ───────────────────────────────────────────

    /** Submit correction feedback for self-learning */
    async feedback(data: FeedbackRequest): Promise<void> {
        await this.request('/api/chat/feedback', {
            method: 'POST',
            body: data,
        });
    }

    // ─── Internals ──────────────────────────────────────────

    private authHeaders(): Record<string, string> {
        const headers: Record<string, string> = {};
        if (this.config.token) {
            headers['Authorization'] = `Bearer ${this.config.token}`;
        }
        if (this.config.headers) {
            Object.assign(headers, this.config.headers);
        }
        return headers;
    }

    private async request<T>(
        path: string,
        options?: {
            method?: string;
            body?: unknown;
            skipAuth?: boolean;
        },
    ): Promise<T> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(options?.skipAuth ? {} : this.authHeaders()),
        };

        const res = await this._fetch(`${this.config.baseUrl}${path}`, {
            method: options?.method ?? 'GET',
            headers,
            body: options?.body ? JSON.stringify(options.body) : undefined,
            signal: AbortSignal.timeout(this.config.timeout),
        });

        if (!res.ok) {
            const body = await res.text();
            throw new HiTechClawError(`Request failed: ${res.status}`, res.status, body);
        }

        return res.json() as Promise<T>;
    }

    private async executeStream(
        message: string,
        callbacks: StreamCallbacks | undefined,
        options: Partial<Omit<ChatRequest, 'message' | 'stream'>> | undefined,
        controller: AbortController,
        allEvents: StreamEvent[],
    ): Promise<string> {
        const res = await this._fetch(`${this.config.baseUrl}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...this.authHeaders(),
            },
            body: JSON.stringify({
                message,
                stream: true,
                webSearch: this.config.webSearch,
                domainId: this.config.defaultDomain,
                ...options,
            } satisfies ChatRequest),
            signal: controller.signal,
        });

        if (!res.ok) {
            const body = await res.text();
            throw new HiTechClawError(`Chat stream failed: ${res.status}`, res.status, body);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new HiTechClawError('No response body', 0, '');

        const decoder = new TextDecoder();
        let accumulated = '';
        let buffer = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const payload = line.slice(6).trim();
                    if (payload === '[DONE]') continue;

                    try {
                        const event = JSON.parse(payload) as StreamEvent;
                        allEvents.push(event);
                        this.dispatchEvent(event, callbacks, () => accumulated, (v) => { accumulated = v; });
                    } catch {
                        // skip malformed JSON
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }

        return accumulated;
    }

    private dispatchEvent(
        event: StreamEvent,
        callbacks: StreamCallbacks | undefined,
        getAccumulated: () => string,
        setAccumulated: (v: string) => void,
    ): void {
        if (!callbacks) return;

        switch (event.type) {
            case 'text-delta': {
                const next = getAccumulated() + event.delta;
                setAccumulated(next);
                callbacks.onTextDelta?.(event.delta, next);
                break;
            }
            case 'tool-call-start':
                callbacks.onToolCallStart?.(event.toolCallId, event.toolName);
                break;
            case 'tool-call-args':
                callbacks.onToolCallArgs?.(event.toolCallId, event.argsJson);
                break;
            case 'tool-call-end':
                callbacks.onToolCallEnd?.(event.toolCallId);
                break;
            case 'tool-result':
                callbacks.onToolResult?.(event.toolCallId, event.result);
                break;
            case 'meta':
                callbacks.onMeta?.(event.key, event.data);
                break;
            case 'finish':
                callbacks.onFinish?.(event.usage, event.finishReason);
                break;
            case 'error':
                callbacks.onError?.(event.error);
                break;
        }
    }
}

// ─── Error Class ────────────────────────────────────────────

export class HiTechClawError extends Error {
    constructor(
        message: string,
        public readonly status: number,
        public readonly body: string,
    ) {
        super(message);
        this.name = 'HiTechClawError';
    }
}
