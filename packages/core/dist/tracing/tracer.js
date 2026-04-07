import { randomUUID } from 'node:crypto';
export class Tracer {
    constructor() {
        this.spans = [];
        this.activeSpans = new Map();
    }
    startSpan(name, kind, options) {
        var _a;
        const span = {
            id: randomUUID(),
            traceId: this.spans.length === 0 ? randomUUID() : this.spans[0].traceId,
            parentId: options === null || options === void 0 ? void 0 : options.parentId,
            name,
            kind,
            startTime: Date.now(),
            attributes: (_a = options === null || options === void 0 ? void 0 : options.attributes) !== null && _a !== void 0 ? _a : {},
            events: [],
            status: 'ok',
        };
        this.activeSpans.set(span.id, span);
        this.spans.push(span);
        return span;
    }
    addEvent(spanId, event) {
        const span = this.activeSpans.get(spanId);
        if (span) {
            span.events.push(event);
        }
    }
    endSpan(spanId, attributes) {
        const span = this.activeSpans.get(spanId);
        if (!span)
            return;
        span.endTime = Date.now();
        if (attributes)
            Object.assign(span.attributes, attributes);
        this.activeSpans.delete(spanId);
    }
    failSpan(spanId, error) {
        const span = this.activeSpans.get(spanId);
        if (!span)
            return;
        span.endTime = Date.now();
        span.status = 'error';
        span.attributes['error'] = error;
        this.activeSpans.delete(spanId);
    }
    getSpans() {
        return this.spans;
    }
    getActiveSpans() {
        return [...this.activeSpans.values()];
    }
    reset() {
        this.spans = [];
        this.activeSpans.clear();
    }
}
