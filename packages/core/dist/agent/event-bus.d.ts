import type { AgentEvent, EventHandler } from '@hitechclaw/shared';
export declare class EventBus {
    private handlers;
    on(pattern: string, handler: EventHandler): () => void;
    emit(event: AgentEvent): Promise<void>;
    removeAllListeners(pattern?: string): void;
    private matchesPattern;
}
//# sourceMappingURL=event-bus.d.ts.map