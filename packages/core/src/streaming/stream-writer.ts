import type { StreamEvent } from '@hitechclaw/shared';

/**
 * Converts an AsyncGenerator of StreamEvents to an SSE-formatted ReadableStream.
 */
export function streamToSSE(generator: AsyncGenerator<StreamEvent>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async pull(controller) {
      const { value, done } = await generator.next();
      if (done) {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
        return;
      }
      const data = JSON.stringify(value);
      controller.enqueue(encoder.encode(`data: ${data}\n\n`));
    },
    cancel() {
      generator.return(undefined);
    },
  });
}

/**
 * Collects all text deltas from a stream into a single string.
 */
export async function collectStreamText(generator: AsyncGenerator<StreamEvent>): Promise<string> {
  let text = '';
  for await (const event of generator) {
    if (event.type === 'text-delta') {
      text += event.delta;
    }
  }
  return text;
}

/**
 * Creates a TransformStream that adds heartbeat pings to keep SSE connections alive.
 */
export function withHeartbeat(intervalMs = 15_000): TransformStream<Uint8Array, Uint8Array> {
  let timer: ReturnType<typeof setInterval> | undefined;
  const encoder = new TextEncoder();

  return new TransformStream({
    start() {
      // Timer started in transform
    },
    transform(chunk, controller) {
      if (!timer) {
        timer = setInterval(() => {
          controller.enqueue(encoder.encode(': ping\n\n'));
        }, intervalMs);
      }
      controller.enqueue(chunk);
    },
    flush() {
      if (timer) clearInterval(timer);
    },
  });
}
