import { serve } from '@hono/node-server';
import type { ChatOptions } from '@hitechclaw/core';
import {
    Agent,
    AnthropicAdapter,
    ApprovalManager,
    CoordinatorAgent,
    DeepSeekAdapter,
    EvalFramework,
    GeminiAdapter,
    GroqAdapter,
    HuggingFaceAdapter,
    ImageGenService,
    isCoordinatorModeEnabled,
    LangGraphWorkflowEngine,
    LocalEmbeddingProvider,
    MonitoringService,
    MultiAgentOrchestrator,
    OllamaAdapter,
    OpenAIAdapter,
    OpenAIEmbeddingProvider,
    PluginManager,
    RagEngine,
    TaskManager,
} from '@hitechclaw/core';
import type { MongoChannelConnection } from '@hitechclaw/db';
import { agentConfigsCollection, channelConnectionsCollection, connectMongo, estimateCost, getMongo, llmLogsCollection, messagesCollection, mongoMonitoringStore, runMigrations, sandboxAuditLogsCollection, seedInitialData, sessionsCollection } from '@hitechclaw/db';
import { allDomainPacks } from '@hitechclaw/domains';
import { AgentManager, createGateway, getTenantLanguageInstruction, startWorkflowScheduler, TenantService } from '@hitechclaw/gateway';
import { allIntegrations, IntegrationRegistry } from '@hitechclaw/integrations';
import { MLEngine } from '@hitechclaw/ml';
import { OCSFEventLogger, PolicyWatcher, SandboxManager, TenantSandboxManager } from '@hitechclaw/sandbox';
import type { AgentConfig, GatewayConfig } from '@hitechclaw/shared';
import { reportGenSkill, textToFhirSkill } from '@hitechclaw/skills';
import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ChannelManager } from './channel-manager.js';
import { loadKnowledgePacks } from './knowledge-loader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../../../.env') });

// Load env
const {
  PORT = '5001',
  HOST = '0.0.0.0',
  CORS_ORIGINS = 'http://localhost:3000,http://localhost:3001,http://localhost:3002',
  JWT_SECRET = 'hitechclaw-dev-secret-change-me',
  LLM_PROVIDER = 'ollama',
  LLM_MODEL: LLM_MODEL_ENV,
  OPENAI_API_KEY = '',
  ANTHROPIC_API_KEY = '',
  OLLAMA_BASE_URL = 'http://localhost:11434/v1',
  HUGGINGFACE_API_KEY = '',
  DEEPSEEK_API_KEY = '',
  GROQ_API_KEY = '',
  AGENT_NAME = 'HiTechClaw Assistant',
  AGENT_SYSTEM_PROMPT = '',
  IMAGE_GEN_PROVIDER = 'placeholder',
  GEMINI_API_KEY = '',
  REPLICATE_API_KEY = '',
  TOGETHER_API_KEY = '',
  COMFYUI_URL = 'http://localhost:8188',
  OPENSHELL_ENABLED = '',
  OPENSHELL_GATEWAY_URL = '',
  // Vision model — used when image attachments are detected
  // Ollama: e.g. "llava:13b", "qwen2.5vl:7b", "gemma3:12b"
  // Set VISION_PROVIDER=gemini to use Gemini instead of Ollama
  VISION_PROVIDER = 'ollama',
  VISION_MODEL = '',
  // Channel tokens — auto-seeded to MongoDB on first startup (idempotent, per default tenant)
  TELEGRAM_BOT_TOKEN = '',
  DISCORD_BOT_TOKEN = '',
  SLACK_BOT_TOKEN = '',
  SLACK_SIGNING_SECRET = '',
  WHATSAPP_PHONE_NUMBER_ID = '',
  WHATSAPP_ACCESS_TOKEN = '',
  WHATSAPP_VERIFY_TOKEN = '',
  FACEBOOK_PAGE_ACCESS_TOKEN = '',
  FACEBOOK_VERIFY_TOKEN = '',
} = process.env;

// Auto-detect default model based on provider
const LLM_MODEL = LLM_MODEL_ENV || (LLM_PROVIDER === 'ollama' ? 'qwen2.5:14b' : 'gpt-4o-mini');

// Vietnamese system prompt for doctor support
const DEFAULT_SYSTEM_PROMPT = `You are HiTechClaw, an open-source AI agent platform that adapts to any industry. You are highly capable, helpful, and concise.

You can operate with different domain packs (healthcare, developer, finance, marketing, education, research, devops, legal, HR, sales, e-commerce) and integrate with external services (Gmail, GitHub, Slack, Notion, etc.).

When a user activates a domain pack, adopt that domain's persona and skills. By default, you are a versatile general-purpose assistant.

Respond in the user's language. Be accurate and honest about your limitations.`;

const SYSTEM_PROMPT = AGENT_SYSTEM_PROMPT || DEFAULT_SYSTEM_PROMPT;

const REALTIME_HINT_PATTERNS: RegExp[] = [
  /\b(today|latest|breaking|current|now|news|update)\b/i,
  /\b(weather|temperature|forecast|traffic|score|result|price|stock|exchange\s*rate)\b/i,
  /\b(hom nay|moi nhat|tin moi|thoi tiet|gia|ty gia|ket qua|truc tiep)\b/i,
];

function wantsRealtimeSearch(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/')) return false;
  return REALTIME_HINT_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function buildRoutingInstruction(opts: { hasImages: boolean; wantsWebSearch: boolean }): string {
  const instructions: string[] = [];
  if (opts.hasImages) {
    instructions.push(
      'User attached image(s). Prioritize visual understanding from attached images before answering. If text in image is important, extract it first, then answer based on both image and user text.',
    );
  }
  if (opts.wantsWebSearch) {
    instructions.push(
      'This query likely needs up-to-date information. If a web-search tool is available, use it first and cite sources. If no web-search tool is available, clearly state that the answer may be outdated.',
    );
  }
  if (!instructions.length) return '';
  return `[Routing instruction]\n${instructions.join('\n')}`;
}

async function main() {
  console.log('🐾 HiTechClaw v2.1.0 — Open Platform Starting...');

  // Run PostgreSQL migrations (idempotent)
  try {
    await runMigrations();
    console.log('   PostgreSQL: migrations applied');
  } catch (err) {
    console.warn('⚠️  Migration skipped:', (err as Error).message);
  }

  // Connect MongoDB (sessions, messages, memory)
  try {
    await connectMongo();
    console.log('   MongoDB:    connected (sessions, messages, memory)');
  } catch (err) {
    console.warn('⚠️  MongoDB skipped:', (err as Error).message);
  }

  // Seed default data (idempotent — skips if already seeded)
  try {
    await seedInitialData();
  } catch (err) {
    console.warn('⚠️  Seed skipped (DB may not be ready):', (err as Error).message);
  }

  // Auto-seed channel connections from env vars → MongoDB (idempotent, default tenant only)
  // This means: set TELEGRAM_BOT_TOKEN in .env once → persists in MongoDB across all restarts
  // Admin UI can still override/add more channels per-tenant
  try {
    const channels = channelConnectionsCollection();
    const now = new Date();

    if (TELEGRAM_BOT_TOKEN) {
      const existing = await channels.findOne({ channelType: 'telegram', tenantId: 'default' });
      if (!existing) {
        await channels.insertOne({
          _id: 'env-telegram-default',
          tenantId: 'default',
          userId: 'system',
          channelType: 'telegram',
          name: 'Telegram Bot (env)',
          config: { botToken: TELEGRAM_BOT_TOKEN },
          status: 'active',
          createdAt: now,
          updatedAt: now,
        });
        console.log('   Channels:  ✅ seeded Telegram from TELEGRAM_BOT_TOKEN env');
      } else if (existing.config?.botToken !== TELEGRAM_BOT_TOKEN) {
        // Token rotated in .env → update MongoDB automatically
        await channels.updateOne(
          { _id: existing._id },
          { $set: { 'config.botToken': TELEGRAM_BOT_TOKEN, status: 'active', updatedAt: now } },
        );
        console.log('   Channels:  🔄 updated Telegram token from env (token rotated)');
      }
    }

    if (DISCORD_BOT_TOKEN) {
      const existing = await channels.findOne({ channelType: 'discord', tenantId: 'default' });
      if (!existing) {
        await channels.insertOne({
          _id: 'env-discord-default',
          tenantId: 'default',
          userId: 'system',
          channelType: 'discord',
          name: 'Discord Bot (env)',
          config: { botToken: DISCORD_BOT_TOKEN },
          status: 'active',
          createdAt: now,
          updatedAt: now,
        });
        console.log('   Channels:  ✅ seeded Discord from DISCORD_BOT_TOKEN env');
      } else if (existing.config?.botToken !== DISCORD_BOT_TOKEN) {
        await channels.updateOne(
          { _id: existing._id },
          { $set: { 'config.botToken': DISCORD_BOT_TOKEN, status: 'active', updatedAt: now } },
        );
        console.log('   Channels:  🔄 updated Discord token from env');
      }
    }

    if (SLACK_BOT_TOKEN && SLACK_SIGNING_SECRET) {
      const existing = await channels.findOne({ channelType: 'slack', tenantId: 'default' });
      if (!existing) {
        await channels.insertOne({
          _id: 'env-slack-default',
          tenantId: 'default',
          userId: 'system',
          channelType: 'slack',
          name: 'Slack Bot (env)',
          config: { botToken: SLACK_BOT_TOKEN, signingSecret: SLACK_SIGNING_SECRET },
          status: 'active',
          createdAt: now,
          updatedAt: now,
        });
        console.log('   Channels:  ✅ seeded Slack from SLACK_BOT_TOKEN env');
      }
    }

    if (WHATSAPP_PHONE_NUMBER_ID && WHATSAPP_ACCESS_TOKEN) {
      const existing = await channels.findOne({ channelType: 'whatsapp', tenantId: 'default' });
      if (!existing) {
        await channels.insertOne({
          _id: 'env-whatsapp-default',
          tenantId: 'default',
          userId: 'system',
          channelType: 'whatsapp',
          name: 'WhatsApp (env)',
          config: {
            phoneNumberId: WHATSAPP_PHONE_NUMBER_ID,
            accessToken: WHATSAPP_ACCESS_TOKEN,
            verifyToken: WHATSAPP_VERIFY_TOKEN,
          },
          status: 'active',
          createdAt: now,
          updatedAt: now,
        });
        console.log('   Channels:  ✅ seeded WhatsApp from env');
      }
    }

    if (FACEBOOK_PAGE_ACCESS_TOKEN) {
      const existing = await channels.findOne({ channelType: 'facebook', tenantId: 'default' });
      if (!existing) {
        await channels.insertOne({
          _id: 'env-facebook-default',
          tenantId: 'default',
          userId: 'system',
          channelType: 'facebook',
          name: 'Facebook Page (env)',
          config: {
            pageAccessToken: FACEBOOK_PAGE_ACCESS_TOKEN,
            verifyToken: FACEBOOK_VERIFY_TOKEN,
          },
          status: 'active',
          createdAt: now,
          updatedAt: now,
        });
        console.log('   Channels:  ✅ seeded Facebook from env');
      }
    }
  } catch (err) {
    console.warn('⚠️  Channel env-seed skipped:', (err as Error).message);
  }

  // Seed default agent config in MongoDB (idempotent)
  try {
    const configs = agentConfigsCollection();
    const existing = await configs.findOne({ tenantId: 'default', isDefault: true });
    if (!existing) {
      const now = new Date();
      await configs.insertOne({
        _id: 'default-agent',
        tenantId: 'default',
        name: AGENT_NAME,
        persona: AGENT_NAME,
        systemPrompt: SYSTEM_PROMPT,
        llmConfig: {
          provider: LLM_PROVIDER,
          model: LLM_MODEL,
          apiKey: LLM_PROVIDER === 'openai' ? OPENAI_API_KEY : ANTHROPIC_API_KEY,
          baseUrl: LLM_PROVIDER === 'ollama' ? OLLAMA_BASE_URL : undefined,
        },
        enabledSkills: [],
        memoryConfig: { enabled: true, maxEntries: 1000 },
        securityConfig: { requireApprovalForShell: true, requireApprovalForNetwork: false },
        maxToolIterations: 10,
        toolTimeout: 30000,
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      });
      console.log('   AgentConfig: default agent config seeded');
    }
  } catch (err) {
    console.warn('⚠️  Agent config seed skipped:', (err as Error).message);
  }

  // Agent config
  const agentConfig: AgentConfig = {
    id: 'default-agent',
    name: AGENT_NAME,
    persona: AGENT_NAME,
    systemPrompt: SYSTEM_PROMPT,
    llm: {
      provider: LLM_PROVIDER as AgentConfig['llm']['provider'],
      model: LLM_MODEL,
      apiKey: LLM_PROVIDER === 'openai' ? OPENAI_API_KEY : ANTHROPIC_API_KEY,
      baseUrl: LLM_PROVIDER === 'ollama' ? OLLAMA_BASE_URL : undefined,
    },
    enabledSkills: [],
    memory: { enabled: true, maxEntries: 1000 },
    security: {
      requireApprovalForShell: true,
      requireApprovalForNetwork: false,
    },
    maxToolIterations: 10,
    toolTimeout: 30000,
  };

  // Create agent
  const agent = new Agent(agentConfig);

  // Register LLM adapters
  let ollamaAdapter: OllamaAdapter | undefined;

  if (LLM_PROVIDER === 'ollama') {
    // Use native Ollama adapter for multi-model management
    const ollamaBaseUrl = OLLAMA_BASE_URL.replace(/\/v1\/?$/, '');
    ollamaAdapter = new OllamaAdapter({
      baseUrl: ollamaBaseUrl,
      model: LLM_MODEL,
    });
    agent.llm.registerAdapter(ollamaAdapter);
    console.log(`   Ollama:   ${ollamaBaseUrl} (model: ${LLM_MODEL})`);
  }

  if (OPENAI_API_KEY && LLM_PROVIDER !== 'ollama') {
    agent.llm.registerAdapter(
      new OpenAIAdapter({
        apiKey: OPENAI_API_KEY,
        model: LLM_MODEL,
      }),
    );
  }
  if (ANTHROPIC_API_KEY) {
    agent.llm.registerAdapter(
      new AnthropicAdapter({
        apiKey: ANTHROPIC_API_KEY,
        model: LLM_PROVIDER === 'anthropic' ? LLM_MODEL : 'claude-sonnet-4-20250514',
      }),
    );
  }
  if (HUGGINGFACE_API_KEY) {
    agent.llm.registerAdapter(
      new HuggingFaceAdapter({
        apiKey: HUGGINGFACE_API_KEY,
        model: LLM_PROVIDER === 'huggingface' ? LLM_MODEL : 'meta-llama/Llama-3.1-70B-Instruct',
      }),
    );
  }
  if (DEEPSEEK_API_KEY) {
    agent.llm.registerAdapter(
      new DeepSeekAdapter({
        apiKey: DEEPSEEK_API_KEY,
        model: LLM_PROVIDER === 'deepseek' ? LLM_MODEL : 'deepseek-chat',
      }),
    );
  }
  if (GROQ_API_KEY) {
    agent.llm.registerAdapter(
      new GroqAdapter({
        apiKey: GROQ_API_KEY,
        model: LLM_PROVIDER === 'groq' ? LLM_MODEL : 'llama-3.3-70b-versatile',
      }),
    );
  }
  if (GEMINI_API_KEY) {
    agent.llm.registerAdapter(
      new GeminiAdapter({
        apiKey: GEMINI_API_KEY,
        model: LLM_PROVIDER === 'google' ? LLM_MODEL : 'gemini-2.0-flash',
      }),
    );
  }

  // ── Vision adapter: registered under its own provider key ─────────────
  // When images are detected, the channel handler will prefer this adapter.
  // Priority: Ollama vision model (local, no cost) → Gemini → OpenAI
  const visionModel = VISION_MODEL || LLM_MODEL;
  if (VISION_PROVIDER === 'ollama') {
    const ollamaBaseUrl = OLLAMA_BASE_URL.replace(/\/v1\/?$/, '');
    // Register a dedicated vision adapter under key 'ollama-vision'
    const visionAdapter = new OllamaAdapter({ baseUrl: ollamaBaseUrl, model: visionModel });
    // Attach under a distinct name so LLMRouter can select it
    Object.defineProperty(visionAdapter, 'provider', { value: 'ollama-vision', writable: false });
    agent.llm.registerAdapter(visionAdapter);
    console.log(`   Vision:    ollama-vision (model: ${visionModel})`);
  }
  // Build the vision fallback chain (used per-request when images are present)
  // Ollama-vision → Gemini → OpenAI → default (Ollama text)
  const VISION_FALLBACK_CHAIN: string[] = [
    ...(VISION_PROVIDER === 'ollama' ? ['ollama-vision'] : []),
    ...(GEMINI_API_KEY ? ['gemini'] : []),
    ...(OPENAI_API_KEY ? ['openai'] : []),
    'ollama',
  ].filter((v, i, a) => a.indexOf(v) === i); // deduplicate
  const agentManager = new AgentManager(agent);

  // Register adapters for dynamic agents
  if (LLM_PROVIDER === 'ollama' && ollamaAdapter) {
    agentManager.registerAdapter(ollamaAdapter);
  }
  if (OPENAI_API_KEY && LLM_PROVIDER !== 'ollama') {
    agentManager.registerAdapter(
      new OpenAIAdapter({ apiKey: OPENAI_API_KEY, model: LLM_MODEL }),
    );
  }
  if (ANTHROPIC_API_KEY) {
    agentManager.registerAdapter(
      new AnthropicAdapter({
        apiKey: ANTHROPIC_API_KEY,
        model: LLM_PROVIDER === 'anthropic' ? LLM_MODEL : 'claude-sonnet-4-20250514',
      }),
    );
  }
  if (HUGGINGFACE_API_KEY) {
    agentManager.registerAdapter(
      new HuggingFaceAdapter({
        apiKey: HUGGINGFACE_API_KEY,
        model: LLM_PROVIDER === 'huggingface' ? LLM_MODEL : 'meta-llama/Llama-3.1-70B-Instruct',
      }),
    );
  }
  if (DEEPSEEK_API_KEY) {
    agentManager.registerAdapter(
      new DeepSeekAdapter({
        apiKey: DEEPSEEK_API_KEY,
        model: LLM_PROVIDER === 'deepseek' ? LLM_MODEL : 'deepseek-chat',
      }),
    );
  }
  if (GROQ_API_KEY) {
    agentManager.registerAdapter(
      new GroqAdapter({
        apiKey: GROQ_API_KEY,
        model: LLM_PROVIDER === 'groq' ? LLM_MODEL : 'llama-3.3-70b-versatile',
      }),
    );
  }
  if (GEMINI_API_KEY) {
    agentManager.registerAdapter(
      new GeminiAdapter({
        apiKey: GEMINI_API_KEY,
        model: LLM_PROVIDER === 'google' ? LLM_MODEL : 'gemini-2.0-flash',
      }),
    );
  }

  // Register vision adapter in agentManager too (for dynamic agents)
  if (VISION_PROVIDER === 'ollama') {
    const ollamaBaseUrl = OLLAMA_BASE_URL.replace(/\/v1\/?$/, '');
    const visionAdapterForManager = new OllamaAdapter({ baseUrl: ollamaBaseUrl, model: visionModel });
    Object.defineProperty(visionAdapterForManager, 'provider', { value: 'ollama-vision', writable: false });
    agentManager.registerAdapter(visionAdapterForManager);
  }

  // RAG Engine
  const embeddingProvider = OPENAI_API_KEY
    ? new OpenAIEmbeddingProvider({ apiKey: OPENAI_API_KEY })
    : new LocalEmbeddingProvider();
  const rag = new RagEngine(embeddingProvider, undefined, {
    chunkingOptions: { chunkSize: 512, chunkOverlap: 50 },
    topK: 5,
    scoreThreshold: 0.1,
  });

  // Auto-load knowledge packs into RAG
  const knowledgeCount = await loadKnowledgePacks(rag);
  if (knowledgeCount > 0) {
    console.log(`   Knowledge: ${knowledgeCount} documents loaded from knowledge packs`);
  }

  // Integration Registry
  const integrationRegistry = new IntegrationRegistry();
  integrationRegistry.registerAll(allIntegrations);
  console.log(`   Integrations: ${allIntegrations.length} registered`);
  console.log(`   Domains: ${allDomainPacks.length} domain packs loaded`);

  // ML Engine
  const mlEngine = new MLEngine();
  console.log(`   ML Engine: ${mlEngine.listAlgorithms().length} algorithms available`);

  // Register built-in text-to-fhir skill (HIS query tools for LLM)
  for (const tool of textToFhirSkill.tools) {
    agent.tools.register(tool.definition, tool.handler);
  }
  console.log(`   Skills:    text-to-fhir (${textToFhirSkill.tools.length} tools registered)`);

  // Register report-gen skill (Excel, chart, AI report generation)
  for (const tool of reportGenSkill.tools) {
    agent.tools.register(tool.definition, tool.handler);
  }
  console.log(`   Skills:    report-gen (${reportGenSkill.tools.length} tools registered)`);

  // Workflow Engine (LangGraph-backed)
  const workflowEngine = new LangGraphWorkflowEngine(agent.tools, agent.llm, agent.events);
  console.log('   Workflow:  LangGraph engine ready (16 node types, checkpointing enabled)');

  // Monitoring Service
  const monitoring = new MonitoringService(agent.events);
  monitoring.setStore(mongoMonitoringStore as any);
  console.log('   Monitoring: audit logs + system logs + metrics active');

  // Plugin Manager
  const imageGen = new ImageGenService({
    provider: IMAGE_GEN_PROVIDER as 'gemini' | 'replicate' | 'together' | 'comfyui' | 'placeholder',
    apiKey: IMAGE_GEN_PROVIDER === 'gemini' ? GEMINI_API_KEY
      : IMAGE_GEN_PROVIDER === 'replicate' ? REPLICATE_API_KEY
      : TOGETHER_API_KEY,
    baseUrl: IMAGE_GEN_PROVIDER === 'comfyui' ? COMFYUI_URL : undefined,
  });
  console.log(`   ImageGen:  ${IMAGE_GEN_PROVIDER} provider`);

  const pluginManager = new PluginManager({
    getMongoDb: () => {
      try { return getMongo(); } catch { return null; }
    },
    llm: agent.llm,
    tools: agent.tools,
    events: agent.events,
    rag,
    imageGen,
  });

  // Plugins are loaded from external submodule (hitechclaw-plugins)
  console.log(`   Plugins:   ${pluginManager.listActive().length} loaded`);

  // ─── Shared message handler factory for all channel plugins ─────────────
  // Debug mode per chat (channelId-userId → true/false)
  const debugSessions = new Set<string>();

  const makeChannelHandler = (
    platform: string,
    send: (channelId: string, content: string, replyTo?: string) => Promise<void>,
  ) => async (incoming: { channelId: string; userId: string; content: string; attachments?: import('@hitechclaw/shared').Attachment[]; metadata?: Record<string, unknown> }) => {
    const prefix = platform.substring(0, 3);
    const sessionId = `${prefix}-${incoming.channelId}-${incoming.userId}`;
    const debugKey = `${platform}-${incoming.channelId}-${incoming.userId}`;

    // ─── Debug commands (/debug, /debug on, /debug off) ───
    const trimmed = incoming.content.trim().toLowerCase();
    if (trimmed === '/debug' || trimmed === '/debug on' || trimmed === '/debug off' || trimmed.startsWith('/debug ')) {
      try {
        const channelConn = await channelConnectionsCollection().findOne({ channelType: platform as MongoChannelConnection['channelType'], status: 'active' });
        const channelAgent = channelConn?.agentConfigId
          ? await agentManager.getAgent(channelConn.agentConfigId, 'default')
          : await agentManager.getDefaultForTenant('default');

        if (trimmed === '/debug off') {
          debugSessions.delete(debugKey);
          await send(incoming.channelId, '🔇 Debug mode OFF', incoming.metadata?.messageId ? String(incoming.metadata.messageId) : undefined);
          return;
        }

        if (trimmed === '/debug on') {
          debugSessions.add(debugKey);
          await send(incoming.channelId, '🔊 Debug mode ON — mỗi response sẽ kèm debug info', incoming.metadata?.messageId ? String(incoming.metadata.messageId) : undefined);
          return;
        }

        // /debug → show full agent config
        const agentCfg = channelAgent.config;
        const caps = (agentCfg.llm as any).capabilities || {};
        const historyCount = channelAgent.memory.getHistorySync(sessionId).length;
        const toolDefs = channelAgent.tools.getDefinitions();
        const debugInfo = [
          `🔍 DEBUG — ${platform.toUpperCase()} Channel`,
          `━━━━━━━━━━━━━━━━━━━━━━`,
          `📌 Agent: ${agentCfg.name || agentCfg.id}`,
          `🤖 Provider: ${agentCfg.llm.provider}`,
          `🧠 Model: ${agentCfg.llm.model}`,
          `🌡️ Temperature: ${(agentCfg.llm as any).temperature ?? 0.7}`,
          `📏 Max Tokens: ${(agentCfg.llm as any).maxTokens ?? 'default'}`,
          `━━━━━━━━━━━━━━━━━━━━━━`,
          `👁️ Vision: ${caps.vision ? '✅' : '❌'}`,
          `🎤 Audio: ${caps.audio ? '✅' : '❌'}`,
          `⚡ Streaming: ${caps.streaming ? '✅' : '❌'}`,
          `🔧 Function Calling: ${caps.functionCalling ? '✅' : '❌'}`,
          `━━━━━━━━━━━━━━━━━━━━━━`,
          `💬 Session: ${sessionId}`,
          `📜 History: ${historyCount} messages`,
          `🧰 Tools: ${toolDefs.length} (${toolDefs.slice(0, 5).map(t => t.name).join(', ')}${toolDefs.length > 5 ? '...' : ''})`,
          `🧲 RAG: ${rag ? '✅ Active' : '❌ Disabled'}`,
          `🏢 Channel: ${channelConn?.name || 'default'}`,
          `🔑 Agent Config ID: ${channelConn?.agentConfigId || 'default'}`,
          `🏷️ Domain: ${channelConn?.domainId || 'general'}`,
          `🖼️ Images: ${incoming.attachments?.length || 0} attachment(s)`,
          `━━━━━━━━━━━━━━━━━━━━━━`,
          `📝 System Prompt (first 200 chars):`,
          `${(agentCfg.systemPrompt || agentCfg.persona || '(none)').slice(0, 200)}...`,
          `━━━━━━━━━━━━━━━━━━━━━━`,
          `🔊 /debug on  — kèm debug sau mỗi response`,
          `🔇 /debug off — tắt debug`,
        ].join('\n');
        await send(incoming.channelId, debugInfo, incoming.metadata?.messageId ? String(incoming.metadata.messageId) : undefined);
      } catch (err) {
        await send(incoming.channelId, `❌ Debug error: ${err instanceof Error ? err.message : 'Unknown'}`, incoming.metadata?.messageId ? String(incoming.metadata.messageId) : undefined);
      }
      return;
    }

    try {
      const channelConn = await channelConnectionsCollection().findOne({ channelType: platform as MongoChannelConnection['channelType'], status: 'active' });
      const channelAgent = channelConn?.agentConfigId
        ? await agentManager.getAgent(channelConn.agentConfigId, 'default')
        : await agentManager.getDefaultForTenant('default');

      const sessions = sessionsCollection();
      const now = new Date();
      const existingSession = await sessions.findOne({ _id: sessionId });
      if (!existingSession) {
        await sessions.insertOne({
          _id: sessionId,
          tenantId: 'default',
          userId: `${prefix}-${incoming.userId}`,
          platform,
          title: incoming.content.slice(0, 60) + (incoming.content.length > 60 ? '...' : ''),
          createdAt: now,
          updatedAt: now,
        });
      } else {
        await sessions.updateOne({ _id: sessionId }, { $set: { updatedAt: now } });
      }

      const messages = messagesCollection();
      await messages.insertOne({
        _id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sessionId,
        role: 'user',
        content: incoming.content,
        metadata: incoming.metadata,
        createdAt: now,
      });

      let ragContext = '';
      try {
        const retrieval = await rag.retrieve(incoming.content);
        if (retrieval.context) ragContext = retrieval.context;
      } catch { /* RAG failure is non-fatal */ }

      let channelMessage = incoming.content;
      const hasImageAttachments = !!incoming.attachments?.some((a) => a.type === 'image');
      const shouldUseWebSearch = wantsRealtimeSearch(incoming.content);
      const routingInstruction = buildRoutingInstruction({
        hasImages: hasImageAttachments,
        wantsWebSearch: shouldUseWebSearch,
      });
      if (routingInstruction) {
        channelMessage = `${routingInstruction}\n\n${channelMessage}`;
      }

      if (channelConn?.domainId && channelConn.domainId !== 'general') {
        const domain = allDomainPacks.find((d) => d.id === channelConn.domainId);
        if (domain?.agentPersona) {
          channelMessage = `[System instruction — Domain specialist mode]\n${domain.agentPersona}\n\n[User message]\n${incoming.content}`;
          if (routingInstruction) {
            channelMessage = `${routingInstruction}\n\n${channelMessage}`;
          }
        }
      }

      // Inject per-tenant language instruction
      const tenantId = channelConn?.tenantId || 'default';
      const tSettings = await TenantService.getSettings(tenantId);
      if (tSettings) {
        const langInstruction = getTenantLanguageInstruction(tSettings);
        if (langInstruction) {
          channelMessage = `[Language instruction]\n${langInstruction}\n\n${channelMessage}`;
        }
      }

      // Extract image data URLs from attachments for vision models
      const imageDataUrls = incoming.attachments
        ?.filter((a) => a.type === 'image' && a.url.startsWith('data:'))
        .map((a) => a.url);

      // Hard-switch model: if images present, use VISION_FALLBACK_CHAIN (Ollama-vision first)
      const llmOptions: ChatOptions | undefined = hasImageAttachments
        ? { fallbackChain: VISION_FALLBACK_CHAIN }
        : undefined;

      const llmStart = Date.now();
      const response = await channelAgent.chat(sessionId, channelMessage, ragContext, imageDataUrls?.length ? imageDataUrls : undefined, undefined, llmOptions);
      const llmDuration = Date.now() - llmStart;

      llmLogsCollection().insertOne({
        tenantId: 'default',
        userId: `${prefix}-${incoming.userId}`,
        sessionId,
        provider: channelAgent.config.llm.provider,
        model: channelAgent.config.llm.model,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        duration: llmDuration,
        costUsd: estimateCost(channelAgent.config.llm.provider, channelAgent.config.llm.model, 0, 0),
        platform,
        success: true,
        toolCalls: 0,
        streaming: false,
        createdAt: new Date(),
      } as any).catch(() => {});

      await messages.insertOne({
        _id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sessionId,
        role: 'assistant',
        content: response,
        createdAt: new Date(),
      });

      // Append debug info if debug mode is ON for this chat
      let finalResponse = response;
      if (debugSessions.has(debugKey)) {
        const caps = (channelAgent.config.llm as any).capabilities || {};
        finalResponse += `\n\n━━━ 🔍 DEBUG ━━━\n`
          + `🤖 ${channelAgent.config.llm.provider}/${channelAgent.config.llm.model}\n`
          + `⏱️ ${llmDuration}ms\n`
          + `👁️ Vision: ${caps.vision ? '✅' : '❌'} | 🖼️ Images: ${imageDataUrls?.length || 0}\n`
          + `🧭 Routing: vision=${hasImageAttachments ? 'on' : 'off'}, webSearchHint=${shouldUseWebSearch ? 'on' : 'off'}\n`
          + `🔀 Model chain: ${llmOptions ? VISION_FALLBACK_CHAIN.join(' → ') : channelAgent.config.llm.provider + '/' + channelAgent.config.llm.model}\n`
          + `📚 RAG: ${ragContext ? `✅ (${ragContext.length} chars)` : '❌ no context'}\n`
          + `🏷️ Domain: ${channelConn?.domainId || 'general'}\n`
          + `💬 Session: ${sessionId}`;
      }

      await send(incoming.channelId, finalResponse, incoming.metadata?.messageId ? String(incoming.metadata.messageId) : undefined);
    } catch (err) {
      console.error(`${platform} agent error:`, err instanceof Error ? err.message : err);
      try { await send(incoming.channelId, '❌ Xin lỗi, có lỗi xảy ra khi xử lý yêu cầu.'); } catch { /* ignore */ }
    }
  };

  // ─── Channel Manager (per-tenant, DB-driven) ──────────────
  // Start all active channels from DB
  const channelManager = new ChannelManager(makeChannelHandler);
  const channelCount = await channelManager.startAllActive();
  console.log(`   Channels:  ${channelCount} active channel(s) started from DB`);

  // Gateway config
  const gatewayConfig: GatewayConfig = {
    port: parseInt(PORT, 10),
    host: HOST,
    corsOrigins: CORS_ORIGINS.split(',').map((s) => s.trim()),
    jwtSecret: JWT_SECRET,
  };

  // ─── OpenShell Sandbox (optional) ─────────────────────────
  let sandboxManager: SandboxManager | undefined;
  let tenantSandboxManager: TenantSandboxManager | undefined;

  if (OPENSHELL_ENABLED === 'true') {
    try {
      const ocsfLogger = new OCSFEventLogger();
      ocsfLogger.addDestination(OCSFEventLogger.consoleDestination());

      sandboxManager = new SandboxManager({
        gatewayUrl: OPENSHELL_GATEWAY_URL || undefined,
        mode: OPENSHELL_GATEWAY_URL ? 'remote' : 'local',
        onAudit: (entry) => {
          sandboxAuditLogsCollection().insertOne({
            sandboxId: entry.sandboxId,
            tenantId: entry.tenantId,
            action: entry.action,
            details: entry.details,
            createdAt: new Date(),
          }).catch(() => {});
          ocsfLogger.logAudit(entry);
        },
      });
      tenantSandboxManager = new TenantSandboxManager(sandboxManager);

      // Hot-reload policies from YAML files
      const policyWatcher = new PolicyWatcher({
        policyDir: new URL('../../../deploy/policies', import.meta.url).pathname,
        onPolicyUpdate: (name, policy) => {
          console.log(`   Policy:    hot-reloaded '${name}'`);
        },
        onError: (err) => {
          console.warn('⚠️  Policy watcher error:', err.message);
        },
      });
      policyWatcher.start();

      await sandboxManager.bootstrapGateway();
      console.log('   Sandbox:   OpenShell gateway ready');
    } catch (err) {
      console.warn('⚠️  OpenShell sandbox skipped:', (err as Error).message);
      sandboxManager = undefined;
      tenantSandboxManager = undefined;
    }
  }

  // ─── Multi-Agent Orchestrator ──────────────────────────────
  const multiAgentOrchestrator = new MultiAgentOrchestrator();
  multiAgentOrchestrator.registerAgent(agent);
  console.log('   Multi-Agent: orchestrator ready (sequential, parallel, debate, supervisor)');

  // ─── Evaluation Framework ────────────────────────────────
  const evalFramework = new EvalFramework(agent.llm);
  console.log('   Evaluation: framework ready (LLM-as-judge, accuracy, hallucination detection)');

  // ─── Approval Manager (HITL) ─────────────────────────────
  const approvalManager = new ApprovalManager();
  console.log('   Approvals:  HITL approval manager ready (5m expiry)');

  // ─── Coordinator Agent (optional — enabled by HITECHCLAW_COORDINATOR_MODE=1) ──
  let coordinatorAgent: CoordinatorAgent | undefined;
  let taskManager: TaskManager | undefined;
  if (isCoordinatorModeEnabled()) {
    const result = agentManager.createCoordinator(agentConfig, {
      enabled: true,
      maxConcurrentAgents: 5,
    });
    coordinatorAgent = result.coordinator;
    taskManager = result.taskManager;
    console.log('   Coordinator: multi-agent coordinator mode enabled');
  }

  // Create Hono app
  const app = createGateway({
    agent,
    agentManager,
    rag,
    config: gatewayConfig,
    ollamaAdapter,
    integrationRegistry,
    domainPacks: allDomainPacks,
    mlEngine,
    workflowEngine,
    monitoring,
    pluginManager,
    sandboxManager,
    tenantSandboxManager,
    channelManager,
    multiAgentOrchestrator,
    evalFramework,
    approvalManager,
    coordinatorAgent,
    taskManager,
  });

  // Start server
  serve(
    { fetch: app.fetch, hostname: gatewayConfig.host, port: gatewayConfig.port },
    (info) => {
      console.log(`🚀 HiTechClaw server running at http://${info.address}:${info.port}`);
      console.log(`   Provider: ${LLM_PROVIDER} / Model: ${LLM_MODEL}`);
      console.log(`   Health:   http://${info.address}:${info.port}/health`);
      console.log(`   RAG:      ${OPENAI_API_KEY ? 'OpenAI embeddings' : 'Local embeddings (dev mode)'}`);
    },
  );

  // Start workflow cron scheduler
  startWorkflowScheduler(workflowEngine);
}

main().catch((err) => {
  console.error('❌ Failed to start HiTechClaw:', err);
  process.exit(1);
});
