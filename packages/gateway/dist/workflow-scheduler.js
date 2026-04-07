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
            for (let i = start; i <= (end ?? max); i += step)
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
    catch {
        return false;
    }
}
// ---------------------------------------------------------------------------
// Node/edge normalizer (same as workflows.ts)
// ---------------------------------------------------------------------------
function normalizeNode(raw) {
    if (raw.data && typeof raw.data.label === 'string')
        return raw;
    return {
        id: raw.id,
        type: raw.type,
        position: raw.position ?? { x: 0, y: 0 },
        data: {
            label: raw.name ?? raw.label ?? raw.id,
            description: raw.description,
            config: raw.config ?? raw.data?.config ?? {},
        },
        inputs: raw.inputs ?? [],
        outputs: raw.outputs ?? [],
    };
}
function normalizeEdge(raw) {
    if (typeof raw.source === 'string' && typeof raw.target === 'string') {
        return { id: raw.id ?? randomUUID(), sourcePort: raw.sourcePort ?? 'default', targetPort: raw.targetPort ?? 'default', ...raw };
    }
    return {
        id: raw.id ?? randomUUID(),
        source: raw.from ?? raw.source,
        sourcePort: raw.sourcePort ?? 'default',
        target: raw.to ?? raw.target,
        targetPort: raw.targetPort ?? 'default',
        condition: raw.condition,
    };
}
function buildWorkflow(row) {
    const def = row.definition;
    return {
        id: row.id,
        name: row.name,
        description: row.description ?? '',
        version: row.version,
        nodes: (def.nodes ?? []).map(normalizeNode),
        edges: (def.edges ?? []).map(normalizeEdge),
        variables: Array.isArray(def.variables) ? def.variables : [],
        trigger: def.trigger ?? { id: 'schedule', type: 'schedule', name: 'Schedule', description: 'Scheduled trigger', config: {} },
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
    const now = new Date();
    try {
        const db = getDB();
        const rows = await db
            .select()
            .from(workflows)
            .where(eq(workflows.enabled, true));
        for (const row of rows) {
            const def = row.definition;
            const trigger = def?.trigger;
            if (!trigger || trigger.type !== 'schedule')
                continue;
            const cron = trigger.config?.cron;
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
                    error: execution.error ?? null,
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
        schedulerTimer = setInterval(() => void tick(workflowEngine), 60_000);
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
//# sourceMappingURL=workflow-scheduler.js.map