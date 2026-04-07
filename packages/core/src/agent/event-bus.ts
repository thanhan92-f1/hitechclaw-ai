import type { AgentEvent, EventHandler } from '@hitechclaw/shared';

type WildcardPattern = string;

export class EventBus {
  private handlers = new Map<WildcardPattern, Set<EventHandler>>();

  on(pattern: string, handler: EventHandler): () => void {
    if (!this.handlers.has(pattern)) {
      this.handlers.set(pattern, new Set());
    }
    this.handlers.get(pattern)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.handlers.get(pattern)?.delete(handler);
    };
  }

  async emit(event: AgentEvent): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const [pattern, handlers] of this.handlers) {
      if (this.matchesPattern(event.type, pattern)) {
        for (const handler of handlers) {
          promises.push(
            handler(event).catch((err) => {
              console.error(`[EventBus] Handler error for ${pattern}:`, err);
            }),
          );
        }
      }
    }

    await Promise.all(promises);
  }

  removeAllListeners(pattern?: string): void {
    if (pattern) {
      this.handlers.delete(pattern);
    } else {
      this.handlers.clear();
    }
  }

  private matchesPattern(eventType: string, pattern: string): boolean {
    if (pattern === '*') return true;
    if (pattern === eventType) return true;

    // Wildcard: "tool:*" matches "tool:started", "tool:completed"
    if (pattern.endsWith(':*')) {
      const prefix = pattern.slice(0, -1);
      return eventType.startsWith(prefix);
    }

    return false;
  }
}
