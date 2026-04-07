// ============================================================
// Handoff Routes — Human escalation, queue, live agent
// ============================================================
import { Hono } from 'hono';
import { handoffSessionsCollection, escalationRulesCollection, messagesCollection, sessionsCollection, } from '@hitechclaw/db';
export function createHandoffRoutes() {
    const app = new Hono();
    // ─── Escalation Rules CRUD ────────────────────────────────
    app.get('/rules', async (c) => {
        try {
            const tenantId = c.get('tenantId');
            const rules = await escalationRulesCollection()
                .find({ tenantId })
                .sort({ createdAt: -1 })
                .toArray();
            return c.json({ ok: true, rules });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    app.post('/rules', async (c) => {
        try {
            const tenantId = c.get('tenantId');
            const { type, enabled, config } = await c.req.json();
            if (!type)
                return c.json({ error: 'type is required' }, 400);
            const now = new Date();
            const result = await escalationRulesCollection().insertOne({
                tenantId,
                type,
                enabled: enabled ?? true,
                config: config || {},
                createdAt: now,
                updatedAt: now,
            });
            return c.json({ ok: true, id: result.insertedId.toString() });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    app.put('/rules/:ruleId', async (c) => {
        try {
            const tenantId = c.get('tenantId');
            const ruleId = c.req.param('ruleId');
            const updates = await c.req.json();
            const { ObjectId: ObjId } = await import('mongodb');
            await escalationRulesCollection().updateOne({ _id: new ObjId(ruleId), tenantId }, { $set: { ...updates, updatedAt: new Date() } });
            return c.json({ ok: true });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    app.delete('/rules/:ruleId', async (c) => {
        try {
            const tenantId = c.get('tenantId');
            const ruleId = c.req.param('ruleId');
            const { ObjectId: ObjId } = await import('mongodb');
            await escalationRulesCollection().deleteOne({ _id: new ObjId(ruleId), tenantId });
            return c.json({ ok: true });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    // ─── Trigger Escalation ───────────────────────────────────
    app.post('/escalate', async (c) => {
        try {
            const tenantId = c.get('tenantId');
            const user = c.get('user');
            const userId = user.sub;
            const { sessionId, reason, reasonDetail, priority } = await c.req.json();
            if (!sessionId || !reason) {
                return c.json({ error: 'sessionId and reason are required' }, 400);
            }
            const result = await handoffSessionsCollection().insertOne({
                tenantId,
                sessionId,
                userId,
                status: 'pending',
                reason,
                reasonDetail,
                priority: priority || 'medium',
                createdAt: new Date(),
            });
            return c.json({ ok: true, handoffId: result.insertedId.toString() });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    // ─── Live Queue — Pending handoffs for human agents ───────
    app.get('/queue', async (c) => {
        try {
            const tenantId = c.get('tenantId');
            const status = (c.req.query('status') || 'pending');
            const handoffs = await handoffSessionsCollection()
                .find({ tenantId, status })
                .sort({ createdAt: -1 })
                .limit(100)
                .toArray();
            return c.json({ ok: true, handoffs });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    // ─── Assign handoff to a human agent ──────────────────────
    app.post('/:handoffId/assign', async (c) => {
        try {
            const tenantId = c.get('tenantId');
            const user = c.get('user');
            const agentUserId = user.sub;
            const handoffId = c.req.param('handoffId');
            const { ObjectId: ObjId } = await import('mongodb');
            const result = await handoffSessionsCollection().findOneAndUpdate({ _id: new ObjId(handoffId), tenantId, status: 'pending' }, { $set: { status: 'assigned', agentUserId, assignedAt: new Date() } }, { returnDocument: 'after' });
            if (!result) {
                return c.json({ error: 'Handoff not found or already assigned' }, 404);
            }
            return c.json({ ok: true, handoff: result });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    // ─── Resolve handoff ─────────────────────────────────────
    app.post('/:handoffId/resolve', async (c) => {
        try {
            const tenantId = c.get('tenantId');
            const handoffId = c.req.param('handoffId');
            const { returnToAI } = await c.req.json().catch(() => ({ returnToAI: false }));
            const { ObjectId: ObjId } = await import('mongodb');
            const newStatus = returnToAI ? 'returned_to_ai' : 'resolved';
            const result = await handoffSessionsCollection().findOneAndUpdate({ _id: new ObjId(handoffId), tenantId }, { $set: { status: newStatus, resolvedAt: new Date() } }, { returnDocument: 'after' });
            if (!result)
                return c.json({ error: 'Handoff not found' }, 404);
            return c.json({ ok: true, handoff: result });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    // ─── Get conversation context for a handoff ──────────────
    app.get('/:handoffId/context', async (c) => {
        try {
            const tenantId = c.get('tenantId');
            const handoffId = c.req.param('handoffId');
            const { ObjectId: ObjId } = await import('mongodb');
            const handoff = await handoffSessionsCollection().findOne({
                _id: new ObjId(handoffId),
                tenantId,
            });
            if (!handoff)
                return c.json({ error: 'Handoff not found' }, 404);
            // Get session info
            const session = await sessionsCollection().findOne({
                _id: handoff.sessionId,
            });
            // Get recent messages (last 50)
            const messages = await messagesCollection()
                .find({ sessionId: handoff.sessionId })
                .sort({ createdAt: -1 })
                .limit(50)
                .toArray();
            return c.json({
                ok: true,
                handoff,
                session,
                messages: messages.reverse(),
            });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    // ─── Handoff Stats ───────────────────────────────────────
    app.get('/stats', async (c) => {
        try {
            const tenantId = c.get('tenantId');
            const coll = handoffSessionsCollection();
            const [pending, assigned, active, resolved, total] = await Promise.all([
                coll.countDocuments({ tenantId, status: 'pending' }),
                coll.countDocuments({ tenantId, status: 'assigned' }),
                coll.countDocuments({ tenantId, status: 'active' }),
                coll.countDocuments({ tenantId, status: { $in: ['resolved', 'returned_to_ai'] } }),
                coll.countDocuments({ tenantId }),
            ]);
            // Average resolution time (last 30 days)
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);
            const resolvedRecent = await coll
                .find({
                tenantId,
                status: { $in: ['resolved', 'returned_to_ai'] },
                resolvedAt: { $gte: thirtyDaysAgo },
                assignedAt: { $exists: true },
            })
                .toArray();
            let avgResolutionMs = 0;
            if (resolvedRecent.length > 0) {
                const totalMs = resolvedRecent.reduce((sum, h) => {
                    if (h.resolvedAt && h.assignedAt) {
                        return sum + (h.resolvedAt.getTime() - h.assignedAt.getTime());
                    }
                    return sum;
                }, 0);
                avgResolutionMs = totalMs / resolvedRecent.length;
            }
            return c.json({
                ok: true,
                stats: { pending, assigned, active, resolved, total, avgResolutionMs },
            });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    return app;
}
// ─── Auto-Escalation Check (called from chat handler) ──────
export async function checkEscalationTriggers(tenantId, message, sessionId, userId) {
    try {
        const rules = await escalationRulesCollection()
            .find({ tenantId, enabled: true })
            .toArray();
        for (const rule of rules) {
            if (rule.type === 'keyword') {
                const keywords = rule.config.keywords || [];
                const lower = message.toLowerCase();
                const matched = keywords.find((kw) => lower.includes(kw.toLowerCase()));
                if (matched) {
                    return { shouldEscalate: true, reason: 'keyword', detail: `Keyword: ${matched}` };
                }
            }
            if (rule.type === 'user_request') {
                // Common escalation phrases
                const phrases = ['talk to human', 'speak to agent', 'real person', 'nói chuyện với người', 'gặp nhân viên', 'chuyển cho người'];
                const lower = message.toLowerCase();
                const matched = phrases.find((p) => lower.includes(p));
                if (matched) {
                    return { shouldEscalate: true, reason: 'user_request', detail: matched };
                }
            }
        }
        return { shouldEscalate: false };
    }
    catch {
        return { shouldEscalate: false };
    }
}
//# sourceMappingURL=handoff.js.map