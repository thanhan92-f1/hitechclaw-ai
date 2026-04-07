import type { StreamEvent } from '@hitechclaw/shared';
/**
 * Converts an AsyncGenerator of StreamEvents to an SSE-formatted ReadableStream.
 */
export declare function streamToSSE(generator: AsyncGenerator<StreamEvent>): ReadableStream<Uint8Array>;
/**
 * Collects all text deltas from a stream into a single string.
 */
export declare function collectStreamText(generator: AsyncGenerator<StreamEvent>): Promise<string>;
/**
 * Creates a TransformStream that adds heartbeat pings to keep SSE connections alive.
 */
export declare function withHeartbeat(intervalMs?: number): TransformStream<Uint8Array, Uint8Array>;
//# sourceMappingURL=stream-writer.d.ts.map