export class EventBus {
    constructor() {
        this.handlers = new Map();
    }
    on(pattern, handler) {
        if (!this.handlers.has(pattern)) {
            this.handlers.set(pattern, new Set());
        }
        this.handlers.get(pattern).add(handler);
        // Return unsubscribe function
        return () => {
            var _a;
            (_a = this.handlers.get(pattern)) === null || _a === void 0 ? void 0 : _a.delete(handler);
        };
    }
    async emit(event) {
        const promises = [];
        for (const [pattern, handlers] of this.handlers) {
            if (this.matchesPattern(event.type, pattern)) {
                for (const handler of handlers) {
                    promises.push(handler(event).catch((err) => {
                        console.error(`[EventBus] Handler error for ${pattern}:`, err);
                    }));
                }
            }
        }
        await Promise.all(promises);
    }
    removeAllListeners(pattern) {
        if (pattern) {
            this.handlers.delete(pattern);
        }
        else {
            this.handlers.clear();
        }
    }
    matchesPattern(eventType, pattern) {
        if (pattern === '*')
            return true;
        if (pattern === eventType)
            return true;
        // Wildcard: "tool:*" matches "tool:started", "tool:completed"
        if (pattern.endsWith(':*')) {
            const prefix = pattern.slice(0, -1);
            return eventType.startsWith(prefix);
        }
        return false;
    }
}
