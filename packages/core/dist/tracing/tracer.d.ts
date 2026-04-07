import type { TraceSpan, SpanEvent } from '@hitechclaw/shared';
export declare class Tracer {
    private spans;
    private activeSpans;
    startSpan(name: string, kind: TraceSpan['kind'], options?: {
        parentId?: string;
        attributes?: Record<string, unknown>;
    }): TraceSpan;
    addEvent(spanId: string, event: SpanEvent): void;
    endSpan(spanId: string, attributes?: Record<string, unknown>): void;
    failSpan(spanId: string, error: string): void;
    getSpans(): TraceSpan[];
    getActiveSpans(): TraceSpan[];
    reset(): void;
}
//# sourceMappingURL=tracer.d.ts.map