// ============================================================
// Global Search Routes — Search across knowledge base and chat
// POST /api/search — Global search
// ============================================================

import { Hono } from 'hono';
import type { GatewayContext } from './gateway.js';

export function createSearchRoutes(ctx: GatewayContext) {
  const app = new Hono();

  // POST /api/search — Global search across KB and chat
  app.post('/', async (c) => {
    const body = await c.req.json() as {
      query?: string;
      sources?: ('knowledge' | 'chat')[];
      topK?: number;
      collectionId?: string;
    };

    if (!body.query) {
      return c.json({ error: 'query is required' }, 400);
    }

    const sources = body.sources ?? ['knowledge'];
    const results: Array<{
      type: 'knowledge' | 'chat';
      title: string;
      content: string;
      score: number;
      metadata: Record<string, unknown>;
    }> = [];

    // Search Knowledge Base
    if (sources.includes('knowledge')) {
      try {
        const retrieval = await ctx.rag.retrieve(body.query, body.topK ?? 10, body.collectionId);
        if (retrieval.chunks) {
          for (const r of retrieval.chunks) {
            results.push({
              type: 'knowledge',
              title: r.chunk.metadata?.title || r.chunk.documentId || 'Document',
              content: r.chunk.content,
              score: r.score,
              metadata: {
                documentId: r.chunk.documentId,
                ...r.chunk.metadata,
              },
            });
          }
        }
      } catch {
        // KB search failure is non-fatal
      }
    }

    // Sort all results by score
    results.sort((a, b) => b.score - a.score);

    return c.json({
      query: body.query,
      results,
      total: results.length,
    });
  });

  return app;
}
