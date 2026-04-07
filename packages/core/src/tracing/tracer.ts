import { randomUUID } from 'node:crypto';
import type { TraceSpan, SpanEvent } from '@hitechclaw/shared';

export class Tracer {
  private spans: TraceSpan[] = [];
  private activeSpans = new Map<string, TraceSpan>();

  startSpan(name: string, kind: TraceSpan['kind'], options?: { parentId?: string; attributes?: Record<string, unknown> }): TraceSpan {
    const span: TraceSpan = {
      id: randomUUID(),
      traceId: this.spans.length === 0 ? randomUUID() : this.spans[0].traceId,
      parentId: options?.parentId,
      name,
      kind,
      startTime: Date.now(),
      attributes: options?.attributes ?? {},
      events: [],
      status: 'ok',
    };

    this.activeSpans.set(span.id, span);
    this.spans.push(span);
    return span;
  }

  addEvent(spanId: string, event: SpanEvent): void {
    const span = this.activeSpans.get(spanId);
    if (span) {
      span.events.push(event);
    }
  }

  endSpan(spanId: string, attributes?: Record<string, unknown>): void {
    const span = this.activeSpans.get(spanId);
    if (!span) return;

    span.endTime = Date.now();
    if (attributes) Object.assign(span.attributes, attributes);
    this.activeSpans.delete(spanId);
  }

  failSpan(spanId: string, error: string): void {
    const span = this.activeSpans.get(spanId);
    if (!span) return;

    span.endTime = Date.now();
    span.status = 'error';
    span.attributes['error'] = error;
    this.activeSpans.delete(spanId);
  }

  getSpans(): TraceSpan[] {
    return this.spans;
  }

  getActiveSpans(): TraceSpan[] {
    return [...this.activeSpans.values()];
  }

  reset(): void {
    this.spans = [];
    this.activeSpans.clear();
  }
}
