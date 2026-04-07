// ============================================================
// Widget Analytics Routes — Track embeddable widget events
// ============================================================

import { Hono } from 'hono';
import { getMongo } from '@hitechclaw/db';

interface WidgetEvent {
  event: string;
  sessionId: string;
  timestamp: string;
  url: string;
  data?: Record<string, unknown>;
}

function widgetEventsCollection() {
  return getMongo().collection('widget_events');
}

export function createWidgetRoutes() {
  const app = new Hono();

  // Ingest widget events (batch)
  app.post('/analytics', async (c) => {
    try {
      const body = await c.req.json();
      const events: WidgetEvent[] = body.events;
      if (!Array.isArray(events) || events.length === 0) {
        return c.json({ ok: true, ingested: 0 });
      }

      // Limit batch size to prevent abuse
      const batch = events.slice(0, 50);

      const tenantId = c.get('tenantId') as string || 'default';
      const docs = batch.map((e) => ({
        tenantId,
        event: String(e.event || '').slice(0, 50),
        sessionId: String(e.sessionId || '').slice(0, 100),
        timestamp: new Date(e.timestamp || Date.now()),
        url: String(e.url || '').slice(0, 500),
        data: e.data || {},
        createdAt: new Date(),
      }));

      await widgetEventsCollection().insertMany(docs);
      return c.json({ ok: true, ingested: docs.length });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
    }
  });

  // Widget analytics summary
  app.get('/analytics', async (c) => {
    try {
      const tenantId = c.get('tenantId') as string;
      const days = parseInt(c.req.query('days') || '30', 10);
      const since = new Date(Date.now() - days * 24 * 3600 * 1000);

      const col = widgetEventsCollection();
      const filter = { tenantId, timestamp: { $gte: since } };

      const [totalEvents, eventsByType, uniqueSessions] = await Promise.all([
        col.countDocuments(filter),
        col.aggregate([
          { $match: filter },
          { $group: { _id: '$event', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]).toArray(),
        col.aggregate([
          { $match: filter },
          { $group: { _id: '$sessionId' } },
          { $count: 'total' },
        ]).toArray(),
      ]);

      const breakdown: Record<string, number> = {};
      for (const e of eventsByType) {
        breakdown[e._id as string] = e.count as number;
      }

      return c.json({
        ok: true,
        data: {
          totalEvents,
          uniqueSessions: uniqueSessions[0]?.total || 0,
          eventBreakdown: breakdown,
          period: { days, since: since.toISOString() },
        },
      });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
    }
  });

  return app;
}
