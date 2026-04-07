// ============================================================
// Workflow Scheduler — cron/schedule triggered workflows
// ============================================================
// Runs a lightweight poll every minute to evaluate cron expressions
// against enabled workflows, without requiring external cron libraries.
import { getDB, workflows, workflowExecutions, eq } from '@hitechclaw/db';
import { randomUUID } from 'node:crypto';
// ---------------------------------------------------------------------------
// Minimal 5-field cron parser: "min hour day month weekday"
// Each field supports: * / - ,
// ---------------------------------------------------------------------------
function parseField(field, min, max) {
    const values = new Set();
    for (const part of field.split(',')) {
        if (part === '*') {
            for (let i = min; i <= max; i++)
                values.add(i);
            continue;
        }
        if (part.includes('/')) {
            const [range, stepStr] = part.split('/');
            const step = parseInt(stepStr, 10);
            const [start, end] = range === '*'
                ? [min, max]
                : range.split('-').map(Number);
            for (let i = start; i <= (end !== null && end !== void 0 ? end : max); i += step)
                values.add(i);
            continue;
        }
        if (part.includes('-')) {
            const [start, end] = part.split('-').map(Number);
            for (let i = start; i <= end; i++)
                values.add(i);
            continue;
        }
        const n = parseInt(part, 10);
        if (!isNaN(n))
            values.add(n);
    }
    return values;
}
function cronMatches(cron, date) {
    const parts = cron.trim().split(/\s+/);
    if (parts.length !== 5)
        return false;
    const [minF, hourF, dayF, monF, wdF] = parts;
    try {
        const mins = parseField(minF, 0, 59);
        const hours = parseField(hourF, 0, 23);
        const days = parseField(dayF, 1, 31);
        const months = parseField(monF, 1, 12);
        const weekdays = parseField(wdF, 0, 6);
        return (mins.has(date.getMinutes()) &&
            hours.has(date.getHours()) &&
            days.has(date.getDate()) &&
            months.has(date.getMonth() + 1) &&
            weekdays.has(date.getDay()));
    }
    catch (_a) {
        return false;
    }
}
// ---------------------------------------------------------------------------
// Node/edge normalizer (same as workflows.ts)
// ---------------------------------------------------------------------------
function normalizeNode(raw) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    if (raw.data && typeof raw.data.label === 'string')
        return raw;
    return {
        id: raw.id,
        type: raw.type,
        position: (_a = raw.position) !== null && _a !== void 0 ? _a : { x: 0, y: 0 },
        data: {
            label: (_c = (_b = raw.name) !== null && _b !== void 0 ? _b : raw.label) !== null && _c !== void 0 ? _c : raw.id,
            description: raw.description,
            config: (_f = (_d = raw.config) !== null && _d !== void 0 ? _d : (_e = raw.data) === null || _e === void 0 ? void 0 : _e.config) !== null && _f !== void 0 ? _f : {},
        },
        inputs: (_g = raw.inputs) !== null && _g !== void 0 ? _g : [],
        outputs: (_h = raw.outputs) !== null && _h !== void 0 ? _h : [],
    };
}
function normalizeEdge(raw) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    if (typeof raw.source === 'string' && typeof raw.target === 'string') {
        return Object.assign({ id: (_a = raw.id) !== null && _a !== void 0 ? _a : randomUUID(), sourcePort: (_b = raw.sourcePort) !== null && _b !== void 0 ? _b : 'default', targetPort: (_c = raw.targetPort) !== null && _c !== void 0 ? _c : 'default' }, raw);
    }
    return {
        id: (_d = raw.id) !== null && _d !== void 0 ? _d : randomUUID(),
        source: (_e = raw.from) !== null && _e !== void 0 ? _e : raw.source,
        sourcePort: (_f = raw.sourcePort) !== null && _f !== void 0 ? _f : 'default',
        target: (_g = raw.to) !== null && _g !== void 0 ? _g : raw.target,
        targetPort: (_h = raw.targetPort) !== null && _h !== void 0 ? _h : 'default',
        condition: raw.condition,
    };
}
function buildWorkflow(row) {
    var _a, _b, _c, _d;
    const def = row.definition;
    return {
        id: row.id,
        name: row.name,
        description: (_a = row.description) !== null && _a !== void 0 ? _a : '',
        version: row.version,
        nodes: ((_b = def.nodes) !== null && _b !== void 0 ? _b : []).map(normalizeNode),
        edges: ((_c = def.edges) !== null && _c !== void 0 ? _c : []).map(normalizeEdge),
        variables: Array.isArray(def.variables) ? def.variables : [],
        trigger: (_d = def.trigger) !== null && _d !== void 0 ? _d : { id: 'schedule', type: 'schedule', name: 'Schedule', description: 'Scheduled trigger', config: {} },
        createdAt: typeof row.createdAt === 'string' ? row.createdAt : row.createdAt.toISOString(),
        updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : row.updatedAt.toISOString(),
        enabled: row.enabled,
    };
}
// ---------------------------------------------------------------------------
// Scheduler
// ---------------------------------------------------------------------------
let schedulerTimer = null;
async function tick(workflowEngine) {
    var _a, _b;
    const now = new Date();
    try {
        const db = getDB();
        const rows = await db
            .select()
            .from(workflows)
            .where(eq(workflows.enabled, true));
        for (const row of rows) {
            const def = row.definition;
            const trigger = def === null || def === void 0 ? void 0 : def.trigger;
            if (!trigger || trigger.type !== 'schedule')
                continue;
            const cron = (_a = trigger.config) === null || _a === void 0 ? void 0 : _a.cron;
            if (!cron)
                continue;
            if (!cronMatches(cron, now))
                continue;
            // Fire workflow
            const wf = buildWorkflow(row);
            console.log(`[Scheduler] Firing workflow "${wf.name}" (${wf.id}) — cron: ${cron}`);
            try {
                const execution = await workflowEngine.execute(wf, {
                    triggeredBy: 'schedule',
                    scheduledAt: now.toISOString(),
                });
                const nodeResultsObj = {};
                execution.nodeResults.forEach((v, k) => { nodeResultsObj[k] = v; });
                await db.insert(workflowExecutions).values({
                    id: execution.id,
                    workflowId: row.id,
                    status: execution.status,
                    nodeResults: nodeResultsObj,
                    variables: execution.variables,
                    error: (_b = execution.error) !== null && _b !== void 0 ? _b : null,
                    startedAt: new Date(execution.startedAt),
                    completedAt: execution.completedAt ? new Date(execution.completedAt) : null,
                });
                console.log(`[Scheduler] Workflow "${wf.name}" — ${execution.status}`);
            }
            catch (err) {
                console.warn(`[Scheduler] Workflow "${wf.name}" execution failed:`, err instanceof Error ? err.message : err);
            }
        }
    }
    catch (err) {
        // DB not ready yet — silently skip
        if (!(err instanceof Error && err.message.includes('connect'))) {
            console.warn('[Scheduler] tick error:', err instanceof Error ? err.message : err);
        }
    }
}
/**
 * Starts the schedule-trigger polling loop.
 * Runs every minute on the minute boundary.
 * Call once after server startup.
 */
export function startWorkflowScheduler(workflowEngine) {
    if (schedulerTimer)
        return; // already running
    // Align to next minute boundary, then tick every 60 seconds
    const msToNextMinute = (60 - new Date().getSeconds()) * 1000;
    setTimeout(() => {
        void tick(workflowEngine);
        schedulerTimer = setInterval(() => void tick(workflowEngine), 60000);
    }, msToNextMinute);
    console.log('   Scheduler: workflow cron scheduler started');
}
/**
 * Stops the scheduler (e.g. for graceful shutdown).
 */
export function stopWorkflowScheduler() {
    if (schedulerTimer) {
        clearInterval(schedulerTimer);
        schedulerTimer = null;
    }
}
