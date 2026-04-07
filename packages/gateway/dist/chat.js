var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function () { return this; }, i;
    function awaitReturn(f) { return function (v) { return Promise.resolve(v).then(f, reject); }; }
    function verb(n, f) { if (g[n]) { i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; if (f) i[n] = f(i[n]); } }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
import { AgentFileMemory, GuardrailPipeline, LLMRateLimiter, OutputSanitizer, PromptInjectionDetector, streamToSSE, TopicScopeGuard } from '@hitechclaw/core';
import { and, eq, estimateCost, getDB, llmLogsCollection, messagesCollection, sessionsCollection, workflows } from '@hitechclaw/db';
import { tavilyWebSearch } from '@hitechclaw/integrations';
import { ChatRequestSchema } from '@hitechclaw/shared';
import { Hono } from 'hono';
import { randomUUID } from 'node:crypto';
import { getInstalledDomainIds } from './domains.js';
import { scanPII } from './pii.js';
import { getLanguageInstruction } from './settings.js';
import { getTenantLanguageInstruction } from './tenant.js';
// ─── AI Security: Guardrails & Rate Limiting ─────────────────
const guardrails = new GuardrailPipeline();
guardrails.addInputGuardrail(new PromptInjectionDetector());
guardrails.addInputGuardrail(new TopicScopeGuard());
guardrails.addOutputGuardrail(new OutputSanitizer());
// 60 LLM requests per tenant per minute (adjustable per tier)
const rateLimiter = new LLMRateLimiter(60, 60000);
// Cleanup stale rate-limit windows every 5 min
setInterval(() => rateLimiter.cleanup(), 5 * 60000);
// In-memory attachment store (per session) — attachments are ephemeral
const attachmentStore = new Map();
// ─── Workflow-as-Tool ────────────────────────────────────────
/**
 * Build AdditionalTool[] that let the agent list and trigger workflows
 * mid-conversation. The agent calls trigger_workflow(workflowId, inputData)
 * and receives the execution result inline.
 */
function buildWorkflowTools(ctx, tenantId) {
    return [
        {
            definition: {
                name: 'list_workflows',
                description: 'List all enabled workflows available for this tenant. Returns workflow id, name, and description.',
                category: 'automation',
                parameters: [],
            },
            handler: async () => {
                const db = getDB();
                const rows = await db
                    .select({ id: workflows.id, name: workflows.name, description: workflows.description })
                    .from(workflows)
                    .where(and(eq(workflows.tenantId, tenantId), eq(workflows.enabled, true)));
                return rows;
            },
        },
        {
            definition: {
                name: 'trigger_workflow',
                description: 'Execute a workflow by its ID with optional input data. Returns a summary of the execution result.',
                category: 'automation',
                parameters: [
                    { name: 'workflow_id', type: 'string', description: 'The ID of the workflow to execute', required: true },
                    { name: 'input_data', type: 'object', description: 'Input data passed to the workflow trigger', required: false },
                ],
            },
            handler: async (args) => {
                var _a, _b, _c, _d, _e, _f, _g;
                const workflowId = args.workflow_id;
                const inputData = (_a = args.input_data) !== null && _a !== void 0 ? _a : {};
                const db = getDB();
                const [row] = await db
                    .select()
                    .from(workflows)
                    .where(and(eq(workflows.id, workflowId), eq(workflows.tenantId, tenantId)))
                    .limit(1);
                if (!row)
                    return { error: `Workflow '${workflowId}' not found` };
                // Build the Workflow object from DB row (inline to avoid circular import)
                const def = row.definition;
                const workflow = {
                    id: row.id,
                    name: row.name,
                    description: row.description,
                    version: row.version,
                    nodes: (_b = def.nodes) !== null && _b !== void 0 ? _b : [],
                    edges: (_c = def.edges) !== null && _c !== void 0 ? _c : [],
                    variables: Array.isArray(def.variables) ? def.variables : [],
                    trigger: (_d = def.trigger) !== null && _d !== void 0 ? _d : { id: 'manual', type: 'manual', name: 'Manual', description: 'Manual trigger', config: {} },
                    createdAt: typeof row.createdAt === 'string' ? row.createdAt : row.createdAt.toISOString(),
                    updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : row.updatedAt.toISOString(),
                    enabled: row.enabled,
                };
                const execution = await ctx.workflowEngine.execute(workflow, inputData);
                return {
                    executionId: execution.id,
                    status: execution.status,
                    error: execution.error,
                    nodeCount: Object.keys((_e = execution.nodeResults) !== null && _e !== void 0 ? _e : {}).length,
                    summary: execution.status === 'completed'
                        ? `Workflow "${row.name}" completed successfully (${Object.keys((_f = execution.nodeResults) !== null && _f !== void 0 ? _f : {}).length} nodes executed)`
                        : `Workflow "${row.name}" ${execution.status}: ${(_g = execution.error) !== null && _g !== void 0 ? _g : 'unknown error'}`,
                };
            },
        },
    ];
}
// ─── Domain Tool Conversion ──────────────────────────────────
/**
 * Convert a DomainPack's skills/tools into AdditionalTool[] that can be passed
 * to agent.chat() / agent.chatStream() without mutating the shared ToolRegistry.
 */
function buildDomainTools(domain) {
    var _a;
    const tools = [];
    for (const skill of domain.skills) {
        for (const domainTool of skill.tools) {
            // Convert JSON Schema style params → ToolParameter[]
            const parameters = Object.entries((_a = domainTool.parameters.properties) !== null && _a !== void 0 ? _a : {}).map(([name, prop]) => {
                var _a, _b, _c;
                return ({
                    name,
                    type: (prop.type === 'array' ? 'array' : prop.type === 'number' ? 'number' : prop.type === 'boolean' ? 'boolean' : 'string'),
                    description: (_a = prop.description) !== null && _a !== void 0 ? _a : '',
                    required: (_c = (_b = domainTool.parameters.required) === null || _b === void 0 ? void 0 : _b.includes(name)) !== null && _c !== void 0 ? _c : false,
                });
            });
            const definition = {
                name: domainTool.name,
                description: domainTool.description,
                category: skill.category,
                parameters,
            };
            tools.push({
                definition,
                handler: async (args) => {
                    var _a, _b;
                    const result = await domainTool.execute(args);
                    return (_b = (_a = result.data) !== null && _a !== void 0 ? _a : result.error) !== null && _b !== void 0 ? _b : result;
                },
            });
        }
    }
    return tools;
}
// ─── MongoDB-backed Conversation Store ──────────────────────
async function getOrCreateSession(sessionId, tenantId, userId, firstMessage, agentConfigId) {
    const sessions = sessionsCollection();
    const existing = await sessions.findOne({ _id: sessionId });
    if (existing) {
        // Cross-tenant isolation: reject if session belongs to a different tenant
        if (existing.tenantId && existing.tenantId !== tenantId) {
            throw new Error('Session not found');
        }
        return existing;
    }
    const now = new Date();
    const session = {
        _id: sessionId,
        tenantId,
        userId,
        platform: 'web',
        title: firstMessage ? firstMessage.slice(0, 60) + (firstMessage.length > 60 ? '...' : '') : 'New Chat',
        agentConfigId,
        createdAt: now,
        updatedAt: now,
    };
    await sessions.insertOne(session);
    return session;
}
async function addMessage(sessionId, role, content, extra) {
    const messages = messagesCollection();
    const now = new Date();
    await messages.insertOne(Object.assign({ _id: `${role[0]}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, sessionId,
        role,
        content, createdAt: now }, extra));
    // Update session timestamp
    await sessionsCollection().updateOne({ _id: sessionId }, { $set: { updatedAt: now } });
}
// Decode HTML entities
function decodeHtmlEntities(text) {
    return text
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
        .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ');
}
// Web search using Tavily API (falls back to Bing scraping if no API key)
const TAVILY_API_KEY_GLOBAL = process.env.TAVILY_API_KEY || '';
async function bingFallback(query, maxResults = 5) {
    try {
        const encoded = encodeURIComponent(query);
        const res = await fetch(`https://www.bing.com/search?q=${encoded}&count=${maxResults}&setlang=vi&mkt=vi-VN&cc=VN`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
            },
            signal: AbortSignal.timeout(10000),
        });
        if (!res.ok)
            return [];
        const html = await res.text();
        const results = [];
        const resultBlocks = html.split('class="b_algo"');
        for (let i = 1; i < resultBlocks.length && results.length < maxResults; i++) {
            const block = resultBlocks[i];
            let url = '';
            const urlMatch = block.match(/u=a1([^&"]+)/);
            if (urlMatch) {
                try {
                    url = Buffer.from(urlMatch[1], 'base64').toString();
                }
                catch ( /* skip */_a) { /* skip */ }
            }
            if (!url) {
                const hrefMatch = block.match(/href="(https?:\/\/(?!www\.bing\.com)[^"]+)"/);
                if (hrefMatch)
                    url = hrefMatch[1];
            }
            let title = '';
            const h2Match = block.match(/<h2[^>]*>([\s\S]*?)<\/h2>/);
            if (h2Match) {
                title = decodeHtmlEntities(h2Match[1].replace(/<[^>]*>/g, '').trim());
            }
            if (!title) {
                const ariaMatch = block.match(/aria-label="([^"]+)"/);
                if (ariaMatch)
                    title = decodeHtmlEntities(ariaMatch[1]);
            }
            const snippetMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/);
            const snippet = snippetMatch
                ? decodeHtmlEntities(snippetMatch[1].replace(/<[^>]*>/g, '').trim()).slice(0, 300)
                : '';
            if (title || url) {
                results.push({ title: title || url, url, snippet });
            }
        }
        return results;
    }
    catch (_b) {
        return [];
    }
}
async function webSearch(query, maxResults = 5, tenantSettings) {
    // Use tenant's Tavily key, or fall back to global env key
    const apiKey = (tenantSettings === null || tenantSettings === void 0 ? void 0 : tenantSettings.tavilyApiKey) || TAVILY_API_KEY_GLOBAL;
    if (apiKey) {
        const results = await tavilyWebSearch(query, apiKey, maxResults);
        if (results.length > 0)
            return results;
        // Fallback to Bing if Tavily returns nothing
    }
    return bingFallback(query, maxResults);
}
// Check for workflow message triggers that match the incoming message
async function checkWorkflowTriggers(ctx, tenantId, message) {
    var _a, _b, _c, _d, _e;
    if (!ctx.workflowEngine)
        return { triggered: false };
    try {
        const db = getDB();
        const rows = await db
            .select()
            .from(workflows)
            .where(and(eq(workflows.tenantId, tenantId), eq(workflows.enabled, true)));
        for (const row of rows) {
            const def = row.definition;
            const trigger = def.trigger;
            if (!trigger || trigger.type !== 'message')
                continue;
            // Check if message matches trigger pattern (keyword or regex)
            const pattern = (_a = trigger.config) === null || _a === void 0 ? void 0 : _a.pattern;
            const keywords = (_b = trigger.config) === null || _b === void 0 ? void 0 : _b.keywords;
            let matches = false;
            if (pattern) {
                try {
                    matches = new RegExp(pattern, 'i').test(message);
                }
                catch ( /* invalid regex */_f) { /* invalid regex */ }
            }
            if (!matches && (keywords === null || keywords === void 0 ? void 0 : keywords.length)) {
                const msgLower = message.toLowerCase();
                matches = keywords.some((kw) => msgLower.includes(kw.toLowerCase()));
            }
            if (matches) {
                const wf = {
                    id: row.id,
                    name: row.name,
                    description: (_c = row.description) !== null && _c !== void 0 ? _c : '',
                    version: row.version,
                    nodes: ((_d = def.nodes) !== null && _d !== void 0 ? _d : []),
                    edges: ((_e = def.edges) !== null && _e !== void 0 ? _e : []),
                    variables: Array.isArray(def.variables) ? def.variables : [],
                    trigger: trigger,
                    createdAt: typeof row.createdAt === 'string' ? row.createdAt : row.createdAt.toISOString(),
                    updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : row.updatedAt.toISOString(),
                    enabled: row.enabled,
                };
                const execution = await ctx.workflowEngine.execute(wf, { message, tenantId });
                if (execution.status === 'completed') {
                    // Extract output from the last output node, or return a summary
                    const outputNode = wf.nodes.find((n) => n.type === 'output');
                    if (outputNode) {
                        const result = execution.nodeResults.get(outputNode.id);
                        if (result === null || result === void 0 ? void 0 : result.output)
                            return { triggered: true, workflowResult: String(result.output) };
                    }
                    return { triggered: true, workflowResult: `✅ Workflow "${wf.name}" executed successfully.` };
                }
            }
        }
    }
    catch (_g) {
        // Workflow trigger check failure is non-fatal
    }
    return { triggered: false };
}
// Wraps agent stream with meta events for debug info
function wrapStreamWithMeta(agent, ctx, sid, fullMessage, message, ragContext, enableWebSearch, tenantSettings, logMeta, additionalTools, guardCtx) {
    return __asyncGenerator(this, arguments, function* wrapStreamWithMeta_1() {
        var _a, e_1, _b, _c;
        var _d, _e;
        const timing = {};
        // Emit RAG context as meta if available
        if (ragContext) {
            yield yield __await({ type: 'meta', key: 'rag', data: { context: ragContext.slice(0, 2000), hasContext: true } });
        }
        else {
            yield yield __await({ type: 'meta', key: 'rag', data: { context: '', hasContext: false } });
        }
        // Web search if enabled
        let searchResults = [];
        if (enableWebSearch) {
            const searchStart = Date.now();
            searchResults = yield __await(webSearch(message, 5, tenantSettings));
            timing.searchMs = Date.now() - searchStart;
            yield yield __await({ type: 'meta', key: 'search', data: { results: searchResults, query: message } });
            // Append search results to context for the LLM with citation instructions
            if (searchResults.length > 0) {
                const searchContext = searchResults
                    .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.snippet}`)
                    .join('\n\n');
                fullMessage = `You have access to the following web search results. Use them to answer the user's question. IMPORTANT: Always cite your sources using [1], [2], etc. at the end of relevant sentences. At the end of your answer, list all sources used with their titles and URLs in a "Sources:" section.\n\nWeb search results:\n${searchContext}\n\n---\n\nUser question: ${fullMessage}`;
            }
        }
        // Stream from agent
        const llmStart = Date.now();
        const generator = agent.chatStream(sid, fullMessage, ragContext, undefined, additionalTools);
        let toolCallCount = 0;
        let accumulatedContent = '';
        try {
            for (var _f = true, generator_1 = __asyncValues(generator), generator_1_1; generator_1_1 = yield __await(generator_1.next()), _a = generator_1_1.done, !_a; _f = true) {
                _c = generator_1_1.value;
                _f = false;
                const event = _c;
                if (event.type === 'tool-call-start')
                    toolCallCount++;
                if (event.type === 'text-delta' && event.delta)
                    accumulatedContent += event.delta;
                if (event.type === 'finish') {
                    timing.llmMs = Date.now() - llmStart;
                    // Post-stream output guardrail check
                    if (guardCtx && accumulatedContent) {
                        const outputCheck = yield __await(guardrails.checkOutput(accumulatedContent, guardCtx));
                        if (!outputCheck.passed) {
                            yield yield __await({ type: 'meta', key: 'security-warning', data: {
                                    blocked: true,
                                    reason: (_e = (_d = outputCheck.blockedBy) === null || _d === void 0 ? void 0 : _d.blockedReason) !== null && _e !== void 0 ? _e : 'Output blocked by security policy',
                                } });
                        }
                    }
                    yield yield __await({ type: 'meta', key: 'timing', data: timing });
                    // Fire-and-forget LLM log
                    if (logMeta) {
                        const provider = agent.config.llm.provider;
                        const model = agent.config.llm.model;
                        llmLogsCollection().insertOne({
                            _id: `llm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                            tenantId: logMeta.tenantId,
                            userId: logMeta.userId,
                            sessionId: sid,
                            provider,
                            model,
                            promptTokens: 0,
                            completionTokens: 0,
                            totalTokens: 0,
                            duration: timing.llmMs,
                            costUsd: estimateCost(provider, model, 0, 0),
                            platform: 'web',
                            success: true,
                            toolCalls: toolCallCount,
                            streaming: true,
                            createdAt: new Date(),
                        }).catch(() => { });
                    }
                }
                yield yield __await(event);
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (!_f && !_a && (_b = generator_1.return)) yield __await(_b.call(generator_1));
            }
            finally { if (e_1) throw e_1.error; }
        }
    });
}
export function createChatRoutes(ctx) {
    const app = new Hono();
    // POST /api/chat/upload — Upload file attachment
    app.post('/upload', async (c) => {
        const formData = await c.req.formData();
        const file = formData.get('file');
        const sessionId = formData.get('sessionId') || 'default';
        if (!file) {
            return c.json({ error: 'file is required' }, 400);
        }
        // 10MB limit
        if (file.size > 10 * 1024 * 1024) {
            return c.json({ error: 'File too large (max 10MB)' }, 400);
        }
        const buffer = await file.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const dataUrl = `data:${file.type};base64,${base64}`;
        const attachment = {
            id: randomUUID(),
            name: file.name,
            mimeType: file.type,
            size: file.size,
            dataUrl,
        };
        // Store in session
        if (!attachmentStore.has(sessionId)) {
            attachmentStore.set(sessionId, []);
        }
        attachmentStore.get(sessionId).push(attachment);
        // Clean up old sessions (keep last 50)
        if (attachmentStore.size > 50) {
            const keys = [...attachmentStore.keys()];
            for (let i = 0; i < keys.length - 50; i++) {
                attachmentStore.delete(keys[i]);
            }
        }
        return c.json({
            id: attachment.id,
            name: attachment.name,
            mimeType: attachment.mimeType,
            size: attachment.size,
        });
    });
    // POST /api/chat — non-streaming (and streaming if stream=true)
    app.post('/', async (c) => {
        var _a, _b;
        const body = await c.req.json();
        const parsed = ChatRequestSchema.safeParse(body);
        if (!parsed.success) {
            return c.json({ error: parsed.error.flatten() }, 400);
        }
        const { message, sessionId, stream, webSearch: enableWebSearch, domainId, agentConfigId } = parsed.data;
        const sid = sessionId || randomUUID();
        const user = c.get('user');
        const tenantId = (user === null || user === void 0 ? void 0 : user.tenantId) || 'default';
        const userId = (user === null || user === void 0 ? void 0 : user.sub) || 'anonymous';
        // Resolve agent from config ID or use default
        const activeAgent = ctx.agentManager
            ? await ctx.agentManager.getAgent(agentConfigId, tenantId)
            : ctx.agent;
        // Resolve domain persona + tools if a domain is selected and installed
        let domainPersona = '';
        let domainTools = [];
        if (domainId && domainId !== 'general' && ctx.domainPacks) {
            const installedIds = getInstalledDomainIds();
            if (installedIds.has(domainId)) {
                const domain = ctx.domainPacks.find((d) => d.id === domainId);
                if (domain) {
                    if (domain.agentPersona)
                        domainPersona = domain.agentPersona;
                    domainTools = buildDomainTools(domain);
                }
            }
        }
        // Always inject workflow tools so the agent can trigger workflows
        if (ctx.workflowEngine) {
            domainTools = [...domainTools, ...buildWorkflowTools(ctx, tenantId)];
        }
        // PII scan — detect sensitive info in user message, store redacted version
        const piiResult = scanPII(message);
        const storedMessage = piiResult.hasPII ? piiResult.redacted : message;
        // ─── AI Security: Rate Limiting (OWASP LLM10) ─────────────
        const rateCheck = rateLimiter.check(tenantId);
        if (!rateCheck.allowed) {
            return c.json({ error: 'Rate limit exceeded. Please wait before sending more messages.', retryAfterMs: rateCheck.resetMs }, 429);
        }
        // ─── AI Security: Input Guardrails (OWASP LLM01, LLM06, LLM07) ──
        const guardCtx = {
            tenantId,
            userId,
            sessionId: sid,
            agentId: activeAgent.config.id,
            domainId: domainId || undefined,
        };
        const inputCheck = await guardrails.checkInput(message, guardCtx);
        if (!inputCheck.passed) {
            return c.json({
                error: 'Message blocked by security policy.',
                reason: (_a = inputCheck.blockedBy) === null || _a === void 0 ? void 0 : _a.blockedReason,
                guardrail: (_b = inputCheck.blockedBy) === null || _b === void 0 ? void 0 : _b.guardrailName,
            }, 400);
        }
        // Track conversation — save user message to MongoDB
        await getOrCreateSession(sid, tenantId, userId, message, agentConfigId);
        await addMessage(sid, 'user', storedMessage, piiResult.hasPII ? { metadata: { piiDetected: true, piiTypes: [...new Set(piiResult.matches.map(m => m.type))] } } : undefined);
        // Build message with attachment context
        let fullMessage = message;
        const attachmentIds = body.attachmentIds || [];
        const imageDataUrls = [];
        if (attachmentIds.length > 0) {
            const sessionAttachments = attachmentStore.get(sid) || [];
            const matchedAttachments = sessionAttachments.filter((a) => attachmentIds.includes(a.id));
            if (matchedAttachments.length > 0) {
                const attachmentInfo = matchedAttachments
                    .map((a) => `[Attached file: ${a.name} (${a.mimeType}, ${Math.round(a.size / 1024)}KB)]`)
                    .join('\n');
                fullMessage = `${attachmentInfo}\n\n${message}`;
                // Collect image data URLs for vision/OCR models
                for (const att of matchedAttachments) {
                    if (att.mimeType.startsWith('image/')) {
                        imageDataUrls.push(att.dataUrl);
                    }
                }
            }
        }
        // RAG: retrieve relevant context
        let ragContext = '';
        try {
            const retrieval = await ctx.rag.retrieve(message, undefined, undefined, tenantId);
            if (retrieval.context) {
                ragContext = retrieval.context;
            }
        }
        catch (_c) {
            // RAG retrieval failure is non-fatal
        }
        // Check for workflow message triggers — if matched, return workflow result directly
        const workflowCheck = await checkWorkflowTriggers(ctx, tenantId, message);
        if (workflowCheck.triggered && workflowCheck.workflowResult) {
            await addMessage(sid, 'assistant', workflowCheck.workflowResult);
            return c.json({ sessionId: sid, content: workflowCheck.workflowResult, workflow: true });
        }
        // Prepend domain persona to message for domain-aware responses
        if (domainPersona) {
            fullMessage = `[System instruction — Domain specialist mode]\n${domainPersona}\n\n[User message]\n${fullMessage}`;
        }
        // Inject per-tenant language instruction
        const tSettings = c.get('tenantSettings');
        const langInstruction = tSettings ? getTenantLanguageInstruction(tSettings) : getLanguageInstruction();
        if (langInstruction) {
            fullMessage = `[Language instruction]\n${langInstruction}\n\n${fullMessage}`;
        }
        // Inject agent file memory (MEMORY.md) into message context if available
        try {
            const agentMemory = new AgentFileMemory(activeAgent.config.id, 'project');
            const memFragment = await agentMemory.buildPromptFragment();
            if (memFragment) {
                fullMessage = `${memFragment}\n\n${fullMessage}`;
            }
        }
        catch ( /* memory load failure is non-fatal */_d) { /* memory load failure is non-fatal */ }
        if (stream) {
            const generator = wrapStreamWithMeta(activeAgent, ctx, sid, fullMessage, message, ragContext, enableWebSearch, tSettings, { tenantId, userId }, domainTools.length > 0 ? domainTools : undefined, guardCtx);
            const sseStream = streamToSSE(generator);
            return new Response(sseStream, {
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                },
            });
        }
        const llmStart = Date.now();
        const response = await activeAgent.chat(sid, fullMessage, ragContext, imageDataUrls.length > 0 ? imageDataUrls : undefined, domainTools.length > 0 ? domainTools : undefined);
        const llmDuration = Date.now() - llmStart;
        // ─── AI Security: Output Guardrails (OWASP LLM05, LLM07) ──
        const outputCheck = await guardrails.checkOutput(response, guardCtx);
        const safeResponse = outputCheck.passed
            ? (outputCheck.finalContent)
            : 'I apologize, but I cannot provide that response due to security policies.';
        // Track assistant response in MongoDB
        await addMessage(sid, 'assistant', safeResponse);
        // Fire-and-forget LLM log for non-streaming
        const nProvider = activeAgent.config.llm.provider;
        const nModel = activeAgent.config.llm.model;
        llmLogsCollection().insertOne({
            _id: `llm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            tenantId,
            userId,
            sessionId: sid,
            provider: nProvider,
            model: nModel,
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            duration: llmDuration,
            costUsd: estimateCost(nProvider, nModel, 0, 0),
            platform: 'web',
            success: true,
            toolCalls: 0,
            streaming: false,
            createdAt: new Date(),
        }).catch(() => { });
        return c.json({ sessionId: sid, content: safeResponse });
    });
    // POST /api/chat/stream — dedicated streaming endpoint
    app.post('/stream', async (c) => {
        var _a, _b;
        const body = await c.req.json();
        const parsed = ChatRequestSchema.safeParse(body);
        if (!parsed.success) {
            return c.json({ error: parsed.error.flatten() }, 400);
        }
        const { message, sessionId, webSearch: enableWebSearch, domainId: streamDomainId, agentConfigId: streamAgentConfigId } = parsed.data;
        const sid = sessionId || randomUUID();
        // Resolve agent from config ID or use default
        const streamUser = c.get('user');
        const streamTenantId = (streamUser === null || streamUser === void 0 ? void 0 : streamUser.tenantId) || 'default';
        const streamUserId = (streamUser === null || streamUser === void 0 ? void 0 : streamUser.sub) || 'anonymous';
        const streamActiveAgent = ctx.agentManager
            ? await ctx.agentManager.getAgent(streamAgentConfigId, streamTenantId)
            : ctx.agent;
        // ─── AI Security: Rate Limiting (OWASP LLM10) ─────────────
        const streamRateCheck = rateLimiter.check(streamTenantId);
        if (!streamRateCheck.allowed) {
            return c.json({ error: 'Rate limit exceeded. Please wait before sending more messages.', retryAfterMs: streamRateCheck.resetMs }, 429);
        }
        // ─── AI Security: Input Guardrails (OWASP LLM01, LLM06, LLM07) ──
        const streamGuardCtx = {
            tenantId: streamTenantId,
            userId: streamUserId,
            sessionId: sid,
            agentId: streamActiveAgent.config.id,
            domainId: streamDomainId || undefined,
        };
        const streamInputCheck = await guardrails.checkInput(message, streamGuardCtx);
        if (!streamInputCheck.passed) {
            return c.json({
                error: 'Message blocked by security policy.',
                reason: (_a = streamInputCheck.blockedBy) === null || _a === void 0 ? void 0 : _a.blockedReason,
                guardrail: (_b = streamInputCheck.blockedBy) === null || _b === void 0 ? void 0 : _b.guardrailName,
            }, 400);
        }
        // Resolve domain persona + tools
        let streamMessage = message;
        let streamDomainTools = [];
        if (streamDomainId && streamDomainId !== 'general' && ctx.domainPacks) {
            const installedIds = getInstalledDomainIds();
            if (installedIds.has(streamDomainId)) {
                const domain = ctx.domainPacks.find((d) => d.id === streamDomainId);
                if (domain) {
                    if (domain.agentPersona) {
                        streamMessage = `[System instruction — Domain specialist mode]\n${domain.agentPersona}\n\n[User message]\n${message}`;
                    }
                    streamDomainTools = buildDomainTools(domain);
                }
            }
        }
        // Inject workflow tools for streaming endpoint too
        if (ctx.workflowEngine) {
            streamDomainTools = [...streamDomainTools, ...buildWorkflowTools(ctx, streamTenantId)];
        }
        // Inject per-tenant language instruction
        const streamTSettings = c.get('tenantSettings');
        const streamLangInstruction = streamTSettings ? getTenantLanguageInstruction(streamTSettings) : getLanguageInstruction();
        if (streamLangInstruction) {
            streamMessage = `[Language instruction]\n${streamLangInstruction}\n\n${streamMessage}`;
        }
        // RAG: retrieve relevant context
        let ragContext = '';
        try {
            const retrieval = await ctx.rag.retrieve(message, undefined, undefined, streamTenantId);
            if (retrieval.context) {
                ragContext = retrieval.context;
            }
        }
        catch (_c) {
            // RAG retrieval failure is non-fatal
        }
        const generator = wrapStreamWithMeta(streamActiveAgent, ctx, sid, streamMessage, message, ragContext, enableWebSearch, streamTSettings, { tenantId: streamTenantId, userId: streamUserId }, streamDomainTools.length > 0 ? streamDomainTools : undefined, streamGuardCtx);
        const sseStream = streamToSSE(generator);
        return new Response(sseStream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });
    });
    // POST /api/chat/save-search — Save web search results to knowledge base
    app.post('/save-search', async (c) => {
        const body = await c.req.json();
        const { results, query, collectionId } = body;
        if (!(results === null || results === void 0 ? void 0 : results.length) || !query) {
            return c.json({ error: 'results and query are required' }, 400);
        }
        // Build a text document from the search results
        const textContent = results
            .map((r, i) => `## [${i + 1}] ${r.title}\nSource: ${r.url}\n\n${r.snippet}`)
            .join('\n\n---\n\n');
        const title = `Web Search: ${query}`;
        const source = 'web-search';
        try {
            const saveUser = c.get('user');
            const saveTenantId = (saveUser === null || saveUser === void 0 ? void 0 : saveUser.tenantId) || 'default';
            const doc = await ctx.rag.ingestText(textContent, title, source, {
                tags: ['web-search', 'auto-saved'],
                collectionId,
                customMetadata: { query, savedAt: new Date().toISOString(), resultCount: String(results.length) },
                tenantId: saveTenantId,
            });
            return c.json({
                id: doc.id,
                title: doc.title,
                chunkCount: doc.chunks.length,
            }, 201);
        }
        catch (err) {
            return c.json({ error: 'Failed to save search results' }, 500);
        }
    });
    // POST /api/chat/feedback — Self-learning from user corrections
    app.post('/feedback', async (c) => {
        var _a;
        const body = await c.req.json();
        const { originalQuestion, aiAnswer, feedback, correction } = body;
        if (!aiAnswer || !feedback) {
            return c.json({ error: 'aiAnswer and feedback are required' }, 400);
        }
        // When user provides a correction, ingest it into KB so the system learns
        if (feedback === 'negative' && (correction === null || correction === void 0 ? void 0 : correction.trim())) {
            try {
                const textContent = [
                    `## Correction`,
                    `**Question:** ${originalQuestion}`,
                    `**Correct Answer:** ${correction.trim()}`,
                    `**Previous Incorrect Answer:** ${aiAnswer}`,
                    `**Corrected at:** ${new Date().toISOString()}`,
                ].join('\n\n');
                await ctx.rag.ingestText(textContent, `Correction: ${originalQuestion.slice(0, 80)}`, 'user-feedback', {
                    tags: ['feedback', 'correction', 'self-learning'],
                    customMetadata: {
                        feedbackType: 'negative',
                        correctedAt: new Date().toISOString(),
                    },
                    tenantId: ((_a = c.get('user')) === null || _a === void 0 ? void 0 : _a.tenantId) || 'default',
                });
                return c.json({ success: true, learned: true });
            }
            catch (err) {
                return c.json({ error: 'Failed to save correction' }, 500);
            }
        }
        return c.json({ success: true, learned: false });
    });
    // POST /api/chat/generate-image — Generate image via Pollinations.ai (free, no API key)
    app.post('/generate-image', async (c) => {
        const body = await c.req.json();
        const { prompt, sessionId, width, height } = body;
        if (!(prompt === null || prompt === void 0 ? void 0 : prompt.trim())) {
            return c.json({ error: 'prompt is required' }, 400);
        }
        const w = Math.min(width || 1024, 1536);
        const h = Math.min(height || 1024, 1536);
        const seed = Math.floor(Math.random() * 1000000);
        const encodedPrompt = encodeURIComponent(prompt.trim());
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${w}&height=${h}&seed=${seed}&nologo=true`;
        // Track in conversation
        if (sessionId) {
            const imgUser = c.get('user');
            await getOrCreateSession(sessionId, (imgUser === null || imgUser === void 0 ? void 0 : imgUser.tenantId) || 'default', (imgUser === null || imgUser === void 0 ? void 0 : imgUser.sub) || 'anonymous', `🎨 ${prompt.slice(0, 50)}`);
            await addMessage(sessionId, 'user', `🎨 Generate image: ${prompt}`);
            await addMessage(sessionId, 'assistant', `![Generated Image](${imageUrl})`);
        }
        return c.json({
            imageUrl,
            prompt: prompt.trim(),
            width: w,
            height: h,
            seed,
        });
    });
    // POST /api/chat/save-message — Save completed assistant message from streaming
    app.post('/save-message', async (c) => {
        const body = await c.req.json();
        const { sessionId, content } = body;
        if (!sessionId || !content) {
            return c.json({ error: 'sessionId and content required' }, 400);
        }
        await addMessage(sessionId, 'assistant', content);
        return c.json({ success: true });
    });
    // ─── Conversation History Endpoints (MongoDB-backed) ──────
    // GET /api/chat/conversations — List all conversations
    app.get('/conversations', async (c) => {
        const user = c.get('user');
        const tenantId = (user === null || user === void 0 ? void 0 : user.tenantId) || 'default';
        const sessions = sessionsCollection();
        const msgs = messagesCollection();
        const sessionList = await sessions
            .find({ tenantId })
            .sort({ updatedAt: -1 })
            .limit(100)
            .toArray();
        const conversations = await Promise.all(sessionList.map(async (s) => {
            const messageCount = await msgs.countDocuments({ sessionId: s._id });
            const lastMsg = await msgs.findOne({ sessionId: s._id }, { sort: { createdAt: -1 } });
            return {
                id: s._id,
                title: s.title,
                createdAt: s.createdAt.toISOString(),
                updatedAt: s.updatedAt.toISOString(),
                messageCount,
                lastMessage: lastMsg ? lastMsg.content.slice(0, 100) : '',
            };
        }));
        return c.json(conversations);
    });
    // GET /api/chat/conversations/:id — Get conversation with messages
    app.get('/conversations/:id', async (c) => {
        const id = c.req.param('id');
        const tenantId = c.get('tenantId');
        const sessions = sessionsCollection();
        const session = await sessions.findOne({ _id: id });
        if (!session)
            return c.json({ error: 'Conversation not found' }, 404);
        // Cross-tenant isolation: reject if session belongs to a different tenant
        if (session.tenantId && session.tenantId !== tenantId) {
            return c.json({ error: 'Conversation not found' }, 404);
        }
        const msgs = await messagesCollection()
            .find({ sessionId: id })
            .sort({ createdAt: 1 })
            .toArray();
        return c.json({
            id: session._id,
            title: session.title,
            createdAt: session.createdAt.toISOString(),
            updatedAt: session.updatedAt.toISOString(),
            messages: msgs.map(m => ({
                id: m._id,
                role: m.role,
                content: m.content,
                timestamp: m.createdAt.toISOString(),
            })),
        });
    });
    // PUT /api/chat/conversations/:id — Rename conversation
    app.put('/conversations/:id', async (c) => {
        const id = c.req.param('id');
        const tenantId = c.get('tenantId');
        const body = await c.req.json();
        const sessions = sessionsCollection();
        const result = await sessions.updateOne({ _id: id, tenantId }, { $set: { title: String(body.title).slice(0, 100), updatedAt: new Date() } });
        if (result.matchedCount === 0)
            return c.json({ error: 'Conversation not found' }, 404);
        return c.json({ success: true });
    });
    // DELETE /api/chat/conversations/:id — Delete conversation
    app.delete('/conversations/:id', async (c) => {
        const id = c.req.param('id');
        const tenantId = c.get('tenantId');
        // Only delete if the session belongs to this tenant
        const result = await sessionsCollection().deleteOne({ _id: id, tenantId });
        if (result.deletedCount === 0)
            return c.json({ error: 'Conversation not found' }, 404);
        await messagesCollection().deleteMany({ sessionId: id });
        return c.json({ success: true });
    });
    return app;
}
