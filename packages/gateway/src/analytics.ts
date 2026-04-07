// ============================================================
// Analytics Routes — Conversation volume, performance, insights
// ============================================================

import { Hono } from 'hono';
import {
  sessionsCollection,
  messagesCollection,
  llmLogsCollection,
  handoffSessionsCollection,
} from '@hitechclaw/db';

export function createAnalyticsRoutes() {
  const app = new Hono();

  // ─── Overview Analytics ───────────────────────────────────

  app.get('/overview', async (c) => {
    try {
      const tenantId = c.get('tenantId') as string;
      const days = parseInt(c.req.query('days') || '30', 10);
      const since = new Date(Date.now() - days * 24 * 3600 * 1000);

      const sessions = sessionsCollection();
      const messages = messagesCollection();

      const [totalConversations, totalMessages, recentSessions] = await Promise.all([
        sessions.countDocuments({ tenantId, createdAt: { $gte: since } }),
        messages.countDocuments({ tenantId: tenantId as never, createdAt: { $gte: since } }),
        sessions.find({ tenantId, createdAt: { $gte: since } })
          .project({ createdAt: 1, platform: 1, updatedAt: 1 })
          .toArray(),
      ]);

      // Daily volume
      const dailyMap = new Map<string, { conversations: number; messages: number }>();
      for (const s of recentSessions) {
        const date = (s.createdAt as Date).toISOString().slice(0, 10);
        const entry = dailyMap.get(date) || { conversations: 0, messages: 0 };
        entry.conversations++;
        dailyMap.set(date, entry);
      }
      const dailyVolume = [...dailyMap.entries()]
        .map(([date, v]) => ({ date, ...v }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Platform breakdown
      const platformBreakdown: Record<string, number> = {};
      for (const s of recentSessions) {
        const platform = (s as Record<string, unknown>).platform as string || 'web';
        platformBreakdown[platform] = (platformBreakdown[platform] || 0) + 1;
      }

      // Avg messages per conversation
      const avgMessagesPerConversation = totalConversations > 0
        ? Math.round(totalMessages / totalConversations)
        : 0;

      // Peak hours
      const hourCounts = new Array(24).fill(0);
      for (const s of recentSessions) {
        const hour = (s.createdAt as Date).getHours();
        hourCounts[hour]++;
      }
      const peakHours = hourCounts.map((count, hour) => ({ hour, count }));

      // Avg session duration
      let totalDurationMs = 0;
      let durationCount = 0;
      for (const s of recentSessions) {
        const created = s.createdAt as Date;
        const updated = (s as Record<string, unknown>).updatedAt as Date | undefined;
        if (updated) {
          totalDurationMs += updated.getTime() - created.getTime();
          durationCount++;
        }
      }
      const avgSessionDurationMs = durationCount > 0 ? Math.round(totalDurationMs / durationCount) : 0;

      return c.json({
        ok: true,
        analytics: {
          totalConversations,
          totalMessages,
          avgMessagesPerConversation,
          platformBreakdown,
          dailyVolume,
          peakHours,
          avgSessionDurationMs,
          period: { days, since: since.toISOString() },
        },
      });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
    }
  });

  // ─── Agent Performance Metrics ─────────────────────────────

  app.get('/performance', async (c) => {
    try {
      const tenantId = c.get('tenantId') as string;
      const days = parseInt(c.req.query('days') || '30', 10);
      const since = new Date(Date.now() - days * 24 * 3600 * 1000);

      const llmLogs = llmLogsCollection();
      const logs = await llmLogs
        .find({ tenantId, createdAt: { $gte: since } })
        .toArray();

      const totalInteractions = logs.length;
      const totalLatency = logs.reduce((s, l) => s + l.duration, 0);
      const avgLatencyMs = totalInteractions > 0 ? Math.round(totalLatency / totalInteractions) : 0;

      const totalToolCalls = logs.reduce((s, l) => s + (l.toolCalls || 0), 0);
      const toolCallRate = totalInteractions > 0 ? totalToolCalls / totalInteractions : 0;

      const totalPromptTokens = logs.reduce((s, l) => s + (l.promptTokens || 0), 0);
      const totalCompletionTokens = logs.reduce((s, l) => s + (l.completionTokens || 0), 0);
      const totalCost = logs.reduce((s, l) => s + (l.costUsd || 0), 0);
      const errorCount = logs.filter((l) => !l.success).length;
      const errorRate = totalInteractions > 0 ? errorCount / totalInteractions : 0;

      // Model breakdown
      const modelBreakdown: Record<string, { calls: number; avgLatency: number; cost: number }> = {};
      for (const l of logs) {
        const key = `${l.provider}/${l.model}`;
        const entry = modelBreakdown[key] || { calls: 0, avgLatency: 0, cost: 0 };
        entry.avgLatency = (entry.avgLatency * entry.calls + l.duration) / (entry.calls + 1);
        entry.calls++;
        entry.cost += l.costUsd || 0;
        modelBreakdown[key] = entry;
      }

      // Escalation rate
      let escalationRate = 0;
      try {
        const handoffCount = await handoffSessionsCollection().countDocuments({
          tenantId,
          createdAt: { $gte: since },
        });
        const sessionCount = await sessionsCollection().countDocuments({
          tenantId,
          createdAt: { $gte: since },
        });
        escalationRate = sessionCount > 0 ? handoffCount / sessionCount : 0;
      } catch { /* handoff collection may not exist yet */ }

      return c.json({
        ok: true,
        performance: {
          totalInteractions,
          avgLatencyMs,
          toolCallRate: Math.round(toolCallRate * 100) / 100,
          escalationRate: Math.round(escalationRate * 100) / 100,
          tokenUsage: {
            prompt: totalPromptTokens,
            completion: totalCompletionTokens,
            total: totalPromptTokens + totalCompletionTokens,
          },
          costUsd: Math.round(totalCost * 100) / 100,
          modelBreakdown,
          errorRate: Math.round(errorRate * 100) / 100,
        },
      });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
    }
  });

  // ─── Export analytics as CSV ──────────────────────────────

  app.get('/export', async (c) => {
    try {
      const tenantId = c.get('tenantId') as string;
      const type = c.req.query('type') || 'conversations';
      const days = parseInt(c.req.query('days') || '30', 10);
      const since = new Date(Date.now() - days * 24 * 3600 * 1000);

      let csv = '';

      if (type === 'conversations') {
        const sessionsDocs = await sessionsCollection()
          .find({ tenantId, createdAt: { $gte: since } })
          .sort({ createdAt: -1 })
          .limit(10000)
          .toArray();

        csv = 'id,title,platform,createdAt,updatedAt\n';
        for (const s of sessionsDocs) {
          const row = [
            s._id?.toString(),
            `"${((s as Record<string, unknown>).title as string || '').replace(/"/g, '""')}"`,
            (s as Record<string, unknown>).platform || 'web',
            (s.createdAt as Date)?.toISOString(),
            ((s as Record<string, unknown>).updatedAt as Date)?.toISOString() || '',
          ];
          csv += row.join(',') + '\n';
        }
      } else if (type === 'llm') {
        const logs = await llmLogsCollection()
          .find({ tenantId, createdAt: { $gte: since } })
          .sort({ createdAt: -1 })
          .limit(10000)
          .toArray();

        csv = 'provider,model,promptTokens,completionTokens,cost,duration,success,createdAt\n';
        for (const l of logs) {
          csv += `${l.provider},${l.model},${l.promptTokens || 0},${l.completionTokens || 0},${l.costUsd || 0},${l.duration},${l.success},${l.createdAt.toISOString()}\n`;
        }
      }

      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="hitechclaw-${type}-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
    }
  });

  // ─── Cost Tracking ────────────────────────────────────────

  app.get('/cost', async (c) => {
    try {
      const tenantId = c.get('tenantId') as string;
      const days = parseInt(c.req.query('days') || '30', 10);
      const since = new Date(Date.now() - days * 24 * 3600 * 1000);

      const logs = await llmLogsCollection()
        .find({ tenantId, createdAt: { $gte: since } })
        .toArray();

      // Overall totals
      const totalCost = logs.reduce((s, l) => s + (l.costUsd || 0), 0);
      const totalTokens = logs.reduce((s, l) => s + (l.promptTokens || 0) + (l.completionTokens || 0), 0);

      // Daily cost breakdown
      const dailyCostMap = new Map<string, { cost: number; tokens: number; calls: number }>();
      for (const l of logs) {
        const date = l.createdAt.toISOString().slice(0, 10);
        const entry = dailyCostMap.get(date) || { cost: 0, tokens: 0, calls: 0 };
        entry.cost += l.costUsd || 0;
        entry.tokens += (l.promptTokens || 0) + (l.completionTokens || 0);
        entry.calls++;
        dailyCostMap.set(date, entry);
      }
      const dailyCost = [...dailyCostMap.entries()]
        .map(([date, v]) => ({ date, ...v }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Per-model breakdown with token details
      const modelCost: Record<string, {
        calls: number; promptTokens: number; completionTokens: number; totalCost: number;
      }> = {};
      for (const l of logs) {
        const key = `${l.provider}/${l.model}`;
        const entry = modelCost[key] || { calls: 0, promptTokens: 0, completionTokens: 0, totalCost: 0 };
        entry.calls++;
        entry.promptTokens += l.promptTokens || 0;
        entry.completionTokens += l.completionTokens || 0;
        entry.totalCost += l.costUsd || 0;
        modelCost[key] = entry;
      }

      // Per-conversation cost (top 20 most expensive)
      const sessionCost = new Map<string, { cost: number; calls: number }>();
      for (const l of logs) {
        const sid = (l as Record<string, unknown>).sessionId as string | undefined;
        if (!sid) continue;
        const entry = sessionCost.get(sid) || { cost: 0, calls: 0 };
        entry.cost += l.costUsd || 0;
        entry.calls++;
        sessionCost.set(sid, entry);
      }
      const topConversations = [...sessionCost.entries()]
        .map(([sessionId, v]) => ({ sessionId, ...v }))
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 20);

      // Cost per call average
      const avgCostPerCall = logs.length > 0 ? totalCost / logs.length : 0;

      return c.json({
        ok: true,
        cost: {
          totalCost: Math.round(totalCost * 10000) / 10000,
          totalTokens,
          totalCalls: logs.length,
          avgCostPerCall: Math.round(avgCostPerCall * 10000) / 10000,
          dailyCost,
          modelCost,
          topConversations,
          period: { days, since: since.toISOString() },
        },
      });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
    }
  });

  // ─── Sentiment Analysis per Conversation ──────────────────

  app.get('/sentiment', async (c) => {
    try {
      const tenantId = c.get('tenantId') as string;
      const days = parseInt(c.req.query('days') || '30', 10);
      const since = new Date(Date.now() - days * 24 * 3600 * 1000);

      const sessions = sessionsCollection();
      const msgsColl = messagesCollection();

      const recentSessions = await sessions
        .find({ tenantId, createdAt: { $gte: since } })
        .project({ _id: 1, title: 1, createdAt: 1 })
        .limit(500)
        .toArray();

      const sentimentResults: Array<{
        sessionId: string;
        title: string;
        sentiment: 'positive' | 'neutral' | 'negative';
        score: number;
        messageCount: number;
        date: string;
      }> = [];

      for (const session of recentSessions) {
        const msgs = await msgsColl
          .find({ sessionId: session._id, role: 'user' })
          .project({ content: 1 })
          .limit(50)
          .toArray();

        if (msgs.length === 0) continue;

        const allText = msgs.map((m: any) => m.content).join(' ').toLowerCase();
        const score = analyzeSentiment(allText);
        const sentiment = score > 0.15 ? 'positive' : score < -0.15 ? 'negative' : 'neutral';

        sentimentResults.push({
          sessionId: session._id,
          title: (session as any).title || session._id,
          sentiment,
          score: Math.round(score * 100) / 100,
          messageCount: msgs.length,
          date: (session.createdAt as Date).toISOString().slice(0, 10),
        });
      }

      const distribution = {
        positive: sentimentResults.filter((s) => s.sentiment === 'positive').length,
        neutral: sentimentResults.filter((s) => s.sentiment === 'neutral').length,
        negative: sentimentResults.filter((s) => s.sentiment === 'negative').length,
      };

      const avgScore = sentimentResults.length > 0
        ? Math.round((sentimentResults.reduce((sum, s) => sum + s.score, 0) / sentimentResults.length) * 100) / 100
        : 0;

      return c.json({
        ok: true,
        data: {
          total: sentimentResults.length,
          avgScore,
          distribution,
          conversations: sentimentResults.sort((a, b) => a.score - b.score).slice(0, 50),
          period: { days, since: since.toISOString() },
        },
      });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
    }
  });

  // ─── Topic Clustering ─────────────────────────────────────

  app.get('/topics', async (c) => {
    try {
      const tenantId = c.get('tenantId') as string;
      const days = parseInt(c.req.query('days') || '30', 10);
      const since = new Date(Date.now() - days * 24 * 3600 * 1000);

      const msgsColl = messagesCollection();
      const userMessages = await msgsColl
        .find({ tenantId: tenantId as never, role: 'user', createdAt: { $gte: since } })
        .project({ content: 1, sessionId: 1, createdAt: 1 })
        .limit(2000)
        .toArray();

      // Extract topics via keyword frequency + category matching
      const topicCounts = new Map<string, { count: number; sessions: Set<string>; samples: string[] }>();

      for (const msg of userMessages) {
        const content = (msg as any).content as string;
        if (!content || content.length < 5) continue;
        const topics = extractTopics(content);
        for (const topic of topics) {
          const entry = topicCounts.get(topic) || { count: 0, sessions: new Set(), samples: [] };
          entry.count++;
          entry.sessions.add((msg as any).sessionId);
          if (entry.samples.length < 3) entry.samples.push(content.slice(0, 120));
          topicCounts.set(topic, entry);
        }
      }

      // Sort by frequency
      const topics = [...topicCounts.entries()]
        .map(([topic, data]) => ({
          topic,
          messageCount: data.count,
          sessionCount: data.sessions.size,
          samples: data.samples,
        }))
        .sort((a, b) => b.messageCount - a.messageCount)
        .slice(0, 30);

      return c.json({
        ok: true,
        data: {
          totalMessages: userMessages.length,
          topicCount: topics.length,
          topics,
          period: { days, since: since.toISOString() },
        },
      });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
    }
  });

  // ─── PII Detection Report ────────────────────────────────

  app.get('/pii', async (c) => {
    try {
      const tenantId = c.get('tenantId') as string;
      const days = parseInt(c.req.query('days') || '30', 10);
      const since = new Date(Date.now() - days * 24 * 3600 * 1000);

      const messages = messagesCollection();
      // Find messages flagged as containing PII
      const piiMessages = await messages.find({
        sessionId: { $regex: tenantId },
        role: 'user',
        'metadata.piiDetected': true,
        createdAt: { $gte: since },
      }).sort({ createdAt: -1 }).limit(200).toArray();

      // Aggregate PII types
      const typeCounts: Record<string, number> = {};
      for (const msg of piiMessages) {
        const types = (msg.metadata?.piiTypes as string[]) || [];
        for (const t of types) {
          typeCounts[t] = (typeCounts[t] || 0) + 1;
        }
      }

      return c.json({
        ok: true,
        data: {
          totalDetected: piiMessages.length,
          typeBreakdown: typeCounts,
          recentDetections: piiMessages.slice(0, 20).map(m => ({
            sessionId: m.sessionId,
            piiTypes: m.metadata?.piiTypes || [],
            createdAt: m.createdAt,
          })),
          period: { days, since: since.toISOString() },
        },
      });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
    }
  });

  return app;
}

// ─── Sentiment Helpers ────────────────────────────────────────

const POSITIVE_WORDS = new Set([
  'cảm ơn', 'tuyệt vời', 'tốt', 'hay', 'giỏi', 'xuất sắc', 'thích', 'yêu', 'hài lòng',
  'perfect', 'great', 'good', 'thanks', 'thank', 'awesome', 'excellent', 'love', 'helpful',
  'amazing', 'wonderful', 'fantastic', 'nice', 'cool', 'satisfied', 'happy', 'pleased',
  'đúng', 'chính xác', 'rõ ràng', 'dễ hiểu', 'nhanh', 'hiệu quả',
]);
const NEGATIVE_WORDS = new Set([
  'lỗi', 'sai', 'tệ', 'chán', 'khó', 'không hiểu', 'thất vọng', 'kém', 'chậm', 'dở',
  'error', 'wrong', 'bad', 'terrible', 'awful', 'slow', 'broken', 'useless', 'disappointed',
  'frustrated', 'annoying', 'confusing', 'fail', 'hate', 'worst', 'bug', 'issue', 'problem',
  'không được', 'không hoạt động', 'hỏng',
]);

function analyzeSentiment(text: string): number {
  const words = text.split(/\s+/);
  let score = 0;
  for (const word of words) {
    if (POSITIVE_WORDS.has(word)) score += 1;
    if (NEGATIVE_WORDS.has(word)) score -= 1;
  }
  // Also match 2-word phrases
  for (const phrase of POSITIVE_WORDS) {
    if (phrase.includes(' ') && text.includes(phrase)) score += 1.5;
  }
  for (const phrase of NEGATIVE_WORDS) {
    if (phrase.includes(' ') && text.includes(phrase)) score -= 1.5;
  }
  // Normalize to [-1, 1]
  const maxMagnitude = Math.max(words.length * 0.1, 1);
  return Math.max(-1, Math.min(1, score / maxMagnitude));
}

// ─── Topic Extraction Helpers ─────────────────────────────────

const TOPIC_KEYWORDS: Record<string, string[]> = {
  'Health / Medical': ['sức khỏe', 'bệnh', 'thuốc', 'triệu chứng', 'bác sĩ', 'health', 'medical', 'doctor', 'medicine', 'symptom', 'diagnosis', 'treatment', 'icd', 'drug'],
  'Technical / Code': ['code', 'lỗi', 'bug', 'api', 'deploy', 'server', 'database', 'function', 'error', 'typescript', 'react', 'python', 'docker', 'git'],
  'Finance / Commerce': ['giá', 'tiền', 'thanh toán', 'hóa đơn', 'price', 'cost', 'payment', 'billing', 'invoice', 'revenue', 'profit', 'budget', 'sale'],
  'Workflow / Automation': ['workflow', 'quy trình', 'trigger', 'automat', 'schedule', 'cron', 'webhook', 'pipeline', 'step', 'node'],
  'Knowledge / RAG': ['knowledge', 'kiến thức', 'tài liệu', 'document', 'search', 'embed', 'rag', 'crawl', 'index', 'collection'],
  'Integration': ['gmail', 'slack', 'notion', 'github', 'calendar', 'integration', 'kết nối', 'connect', 'oauth', 'webhook'],
  'Configuration': ['cài đặt', 'config', 'setting', 'model', 'tenant', 'role', 'permission', 'user', 'setup'],
  'General Inquiry': ['gì', 'thế nào', 'là gì', 'what', 'how', 'why', 'when', 'explain', 'help', 'giải thích', 'hướng dẫn'],
};

function extractTopics(text: string): string[] {
  const lower = text.toLowerCase();
  const matched: string[] = [];
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      matched.push(topic);
    }
  }
  return matched.length > 0 ? matched : ['Uncategorized'];
}
