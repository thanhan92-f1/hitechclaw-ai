export type LLMProvider = 'openai' | 'anthropic' | 'ollama' | 'google' | 'groq' | 'mistral' | 'deepseek' | 'xai' | 'openrouter' | 'perplexity' | 'huggingface' | 'custom';
export interface LLMCapabilities {
    vision?: boolean;
    audio?: boolean;
    streaming?: boolean;
    functionCalling?: boolean;
}
export interface LLMConfig {
    provider: LLMProvider;
    model: string;
    apiKey?: string;
    baseUrl?: string;
    temperature?: number;
    maxTokens?: number;
    capabilities?: LLMCapabilities;
}
export interface LLMMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    images?: string[];
    toolCallId?: string;
    toolCalls?: ToolCall[];
}
export interface LLMResponse {
    content: string;
    toolCalls?: ToolCall[];
    usage: TokenUsage;
    model: string;
    finishReason: 'stop' | 'tool_calls' | 'length' | 'error';
}
export type ResponseFormat = {
    type: 'text';
} | {
    type: 'json_object';
} | {
    type: 'json_schema';
    schema: Record<string, unknown>;
    name?: string;
    strict?: boolean;
};
export type AgentOrchestrationMode = 'sequential' | 'parallel' | 'debate' | 'supervisor';
export interface MultiAgentTask {
    id: string;
    description: string;
    input: string;
    requiredAgentIds?: string[];
    orchestrationMode: AgentOrchestrationMode;
    maxRounds?: number;
    supervisorAgentId?: string;
}
export interface AgentResult {
    agentId: string;
    agentName: string;
    content: string;
    usage?: TokenUsage;
    duration: number;
}
export interface MultiAgentResult {
    taskId: string;
    mode: AgentOrchestrationMode;
    finalContent: string;
    agentResults: AgentResult[];
    totalDuration: number;
    rounds: number;
}
export interface EvalTestCase {
    id: string;
    input: string;
    expectedOutput?: string;
    expectedToolCalls?: string[];
    tags?: string[];
    metadata?: Record<string, unknown>;
}
export interface EvalMetrics {
    accuracy: number;
    relevance: number;
    latency_ms: number;
    tokenUsage: TokenUsage;
    hallucination: boolean;
    toolCallAccuracy?: number;
}
export interface EvalResult {
    testCaseId: string;
    actualOutput: string;
    metrics: EvalMetrics;
    passed: boolean;
    error?: string;
}
export interface EvalSuiteResult {
    suiteId: string;
    suiteName: string;
    model: string;
    totalTests: number;
    passed: number;
    failed: number;
    averageMetrics: Omit<EvalMetrics, 'hallucination' | 'tokenUsage'>;
    results: EvalResult[];
    startedAt: string;
    completedAt: string;
}
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';
export interface ApprovalRequest {
    id: string;
    sessionId: string;
    toolCall: ToolCall;
    toolDefinition: ToolDefinition;
    reason: string;
    status: ApprovalStatus;
    requestedAt: string;
    resolvedAt?: string;
    resolvedBy?: string;
    expiresAt: string;
}
export interface ConversationSummary {
    sessionId: string;
    summary: string;
    messageCount: number;
    summarizedAt: string;
    tokensSaved: number;
}
export interface TokenUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
}
export type StreamEvent = {
    type: 'text-delta';
    delta: string;
} | {
    type: 'tool-call-start';
    toolCallId: string;
    toolName: string;
} | {
    type: 'tool-call-args';
    toolCallId: string;
    argsJson: string;
} | {
    type: 'tool-call-end';
    toolCallId: string;
} | {
    type: 'tool-result';
    toolCallId: string;
    result: ToolResult;
} | {
    type: 'meta';
    key: string;
    data: unknown;
} | {
    type: 'finish';
    usage: TokenUsage;
    finishReason: string;
} | {
    type: 'error';
    error: string;
};
export interface ToolDefinition {
    name: string;
    description: string;
    category: string;
    parameters: ToolParameter[];
    returns?: ToolParameter;
    requiresApproval?: boolean;
    timeout?: number;
    /** Sandbox execution requirements for this tool (OpenShell integration) */
    sandbox?: ToolSandboxPolicy;
}
export interface ToolParameter {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    description: string;
    required?: boolean;
    default?: unknown;
    enum?: string[];
}
export interface ToolCall {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
}
export interface ToolResult {
    toolCallId: string;
    success: boolean;
    result: unknown;
    error?: string;
    duration: number;
}
export interface SkillManifest {
    id: string;
    name: string;
    version: string;
    description: string;
    author: string;
    category: SkillCategory;
    tags: string[];
    tools: ToolDefinition[];
    triggers?: TriggerDefinition[];
    config?: SkillConfigField[];
    dependencies?: string[];
}
export type SkillCategory = 'programming' | 'healthcare' | 'productivity' | 'marketing' | 'finance' | 'ecommerce' | 'communication' | 'analytics' | 'devops' | 'content' | 'research' | 'sales' | 'project-management' | 'learning' | 'design' | 'custom';
export interface SkillConfigField {
    key: string;
    label: string;
    type: 'string' | 'number' | 'boolean' | 'select' | 'secret';
    description: string;
    required?: boolean;
    default?: unknown;
    options?: {
        label: string;
        value: string;
    }[];
}
export interface TriggerDefinition {
    id: string;
    type: TriggerType;
    name: string;
    description: string;
    config: Record<string, unknown>;
}
export type TriggerType = 'cron' | 'webhook' | 'event' | 'message' | 'file' | 'manual';
export interface QuickReplyButton {
    label: string;
    value: string;
    icon?: string;
}
export interface InteractiveBlock {
    type: 'quick-replies' | 'list-select' | 'confirm';
    title?: string;
    buttons: QuickReplyButton[];
}
export interface Workflow {
    id: string;
    name: string;
    description: string;
    version: number;
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    variables: WorkflowVariable[];
    trigger: TriggerDefinition;
    createdAt: string;
    updatedAt: string;
    enabled: boolean;
}
export interface WorkflowNode {
    id: string;
    type: WorkflowNodeType;
    position: {
        x: number;
        y: number;
    };
    data: WorkflowNodeData;
    inputs: NodePort[];
    outputs: NodePort[];
}
export type WorkflowNodeType = 'trigger' | 'llm-call' | 'tool-call' | 'condition' | 'loop' | 'transform' | 'http-request' | 'code' | 'memory-read' | 'memory-write' | 'notification' | 'wait' | 'switch' | 'merge' | 'sub-workflow' | 'output';
export interface WorkflowNodeData {
    label: string;
    description?: string;
    config: Record<string, unknown>;
    color?: string;
    icon?: string;
}
export interface NodePort {
    id: string;
    name: string;
    type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'any';
}
export interface WorkflowEdge {
    id: string;
    source: string;
    sourcePort: string;
    target: string;
    targetPort: string;
    condition?: string;
}
export interface WorkflowVariable {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    defaultValue?: unknown;
    description?: string;
}
export interface WorkflowExecution {
    id: string;
    workflowId: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    startedAt: string;
    completedAt?: string;
    nodeResults: Map<string, NodeExecutionResult>;
    variables: Record<string, unknown>;
    error?: string;
}
export interface NodeExecutionResult {
    nodeId: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    startedAt: string;
    completedAt?: string;
    input: Record<string, unknown>;
    output: Record<string, unknown>;
    error?: string;
    duration: number;
}
/** Common interface that both WorkflowEngine and LangGraphWorkflowEngine satisfy */
export interface IWorkflowEngine {
    validate(workflow: Workflow): {
        nodeId?: string;
        field?: string;
        message: string;
        severity: 'error' | 'warning';
    }[];
    execute(workflow: Workflow, triggerData?: Record<string, unknown>): Promise<WorkflowExecution>;
    setSandboxConfig?(config: WorkflowSandboxConfig): void;
}
export interface MemoryEntry {
    id: string;
    type: 'fact' | 'preference' | 'conversation' | 'context' | 'skill-data';
    content: string;
    metadata: Record<string, unknown>;
    embedding?: number[];
    createdAt: string;
    updatedAt: string;
    expiresAt?: string;
    source: string;
    tags: string[];
}
export interface ConversationMessage {
    id: string;
    sessionId: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    toolCalls?: ToolCall[];
    toolResults?: ToolResult[];
    timestamp: string;
    metadata?: Record<string, unknown>;
    /** RL feedback: user thumbs-up/down or auto tool-success signal */
    feedback?: {
        skillId: string;
        toolName?: string;
        reward: number;
        success: boolean;
        reason?: string;
    };
}
export type ChatPlatform = 'web' | 'telegram' | 'discord' | 'facebook' | 'slack' | 'whatsapp' | 'zalo' | 'msteams' | 'api';
export interface IncomingMessage {
    platform: ChatPlatform;
    channelId: string;
    userId: string;
    content: string;
    attachments?: Attachment[];
    replyTo?: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
}
export interface OutgoingMessage {
    platform: ChatPlatform;
    channelId: string;
    content: string;
    attachments?: Attachment[];
    replyTo?: string;
}
export interface Attachment {
    type: 'image' | 'file' | 'audio' | 'video';
    url: string;
    name: string;
    mimeType: string;
    size: number;
}
export interface AgentConfig {
    id: string;
    name: string;
    description?: string;
    persona: string;
    systemPrompt: string;
    llm: LLMConfig;
    enabledSkills: string[];
    memory: {
        enabled: boolean;
        maxEntries: number;
    };
    security: {
        requireApprovalForShell: boolean;
        requireApprovalForNetwork: boolean;
        blockedCommands?: string[];
    };
    maxToolIterations: number;
    toolTimeout: number;
    isDefault?: boolean;
    /** Sub-agent references for multi-agent hierarchy (Google ADK-inspired) */
    subAgents?: SubAgentRef[];
    /** Whether LLM-driven agent transfer is allowed */
    allowTransfer?: boolean;
}
/** Reference to a sub-agent within the hierarchy */
export interface SubAgentRef {
    /** Agent config ID in MongoDB */
    agentConfigId: string;
    /** Display name for LLM routing */
    name: string;
    /** Description for LLM to understand when to delegate */
    description: string;
}
/** Workflow agent types — orchestration patterns */
export type WorkflowAgentType = 'sequential' | 'parallel' | 'loop';
/** Configuration for workflow agents that orchestrate sub-agents */
export interface WorkflowAgentConfig {
    id: string;
    name: string;
    type: WorkflowAgentType;
    /** Sub-agent IDs to orchestrate */
    subAgentIds: string[];
    /** For loop agents: max iterations before stopping */
    maxIterations?: number;
    /** For loop agents: state key to check for escalation */
    escalationKey?: string;
    /** Shared state passed between sub-agents */
    initialState?: Record<string, unknown>;
}
/** Result of a workflow agent execution */
export interface WorkflowAgentResult {
    workflowId: string;
    type: WorkflowAgentType;
    finalContent: string;
    agentResults: AgentResult[];
    state: Record<string, unknown>;
    iterations: number;
    totalDuration: number;
}
/** Agent transfer request — LLM decides to delegate to another agent */
export interface AgentTransferRequest {
    /** Name of the target agent to transfer to */
    targetAgentName: string;
    /** Reason for transfer (from LLM) */
    reason?: string;
    /** Context to pass to the target agent */
    context?: string;
}
/** A2A Agent Card — describes an agent's capabilities for remote discovery */
export interface A2AAgentCard {
    name: string;
    description: string;
    url: string;
    version: string;
    capabilities: A2ACapability[];
    inputSchema?: Record<string, unknown>;
    outputSchema?: Record<string, unknown>;
}
export type A2ACapability = 'text' | 'streaming' | 'tools' | 'multi-turn' | 'artifacts';
/** A2A Task — a unit of work sent to a remote agent */
export interface A2ATask {
    id: string;
    message: string;
    sessionId?: string;
    metadata?: Record<string, unknown>;
}
/** A2A Task Result — response from a remote agent */
export interface A2ATaskResult {
    taskId: string;
    status: 'completed' | 'failed' | 'in-progress' | 'requires-input';
    content: string;
    artifacts?: A2AArtifact[];
    error?: string;
}
/** A2A Artifact — binary or structured data from a remote agent */
export interface A2AArtifact {
    name: string;
    mimeType: string;
    data: string;
}
export interface AgentEvent {
    type: string;
    payload: Record<string, unknown>;
    source: string;
    timestamp: string;
}
export type EventHandler = (event: AgentEvent) => Promise<void>;
export interface GatewayConfig {
    port: number;
    host: string;
    corsOrigins: string[];
    jwtSecret: string;
}
export interface GatewaySession {
    id: string;
    userId: string;
    platform: ChatPlatform;
    connectedAt: string;
    lastActiveAt: string;
}
export type GatewayMessageType = 'auth' | 'chat' | 'chat:stream' | 'chat:response' | 'tool:call' | 'tool:result' | 'workflow:execute' | 'workflow:status' | 'skill:list' | 'skill:toggle' | 'event' | 'ping' | 'pong' | 'error';
export interface GatewayMessage {
    type: GatewayMessageType;
    id: string;
    sessionId?: string;
    payload: Record<string, unknown>;
    timestamp: string;
}
export interface ChannelPlugin {
    id: string;
    platform: ChatPlatform;
    name: string;
    version: string;
    initialize(config: Record<string, unknown>): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
    send(message: OutgoingMessage): Promise<void>;
    onMessage(handler: (message: IncomingMessage) => Promise<void>): void;
}
export interface PluginManifest {
    name: string;
    version: string;
    description: string;
    author: string;
    type: 'skill' | 'channel' | 'integration' | 'theme' | 'knowledge-pack';
    entry: string;
    config?: SkillConfigField[];
    platforms?: ChatPlatform[];
    permissions?: PluginPermission[];
}
export type PluginPermission = 'network' | 'filesystem' | 'shell' | 'memory' | 'llm' | 'secrets';
export interface TraceSpan {
    id: string;
    traceId: string;
    parentId?: string;
    name: string;
    kind: 'agent' | 'llm' | 'tool' | 'workflow' | 'memory' | 'custom';
    startTime: number;
    endTime?: number;
    attributes: Record<string, unknown>;
    events: SpanEvent[];
    status: 'ok' | 'error';
}
export interface SpanEvent {
    name: string;
    timestamp: number;
    attributes?: Record<string, unknown>;
}
export type IntegrationCategory = 'messaging' | 'email' | 'calendar' | 'productivity' | 'developer' | 'search' | 'social' | 'storage' | 'crm' | 'payment' | 'analytics' | 'ai' | 'communication' | 'automation' | 'database' | 'custom';
export type IntegrationAuthType = 'none' | 'api-key' | 'basic' | 'bearer' | 'oauth2';
export interface IntegrationDefinition {
    id: string;
    name: string;
    description: string;
    icon: string;
    category: IntegrationCategory;
    authType: IntegrationAuthType;
    actions: IntegrationAction[];
    triggers?: IntegrationTrigger[];
}
export interface IntegrationAction {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    execute: (params: Record<string, unknown>, context: IntegrationContext) => Promise<ActionResult>;
}
export interface IntegrationTrigger {
    name: string;
    description: string;
    type: 'webhook' | 'polling';
    config?: Record<string, unknown>;
}
export interface IntegrationContext {
    credentials: Record<string, string>;
    userId: string;
    metadata?: Record<string, unknown>;
}
export interface ActionResult {
    success: boolean;
    data?: unknown;
    error?: string;
}
export interface DomainPackDefinition {
    id: string;
    name: string;
    description: string;
    icon: string;
    skillCount: number;
    agentPersona: string;
    recommendedIntegrations: string[];
    knowledgePacks?: string[];
}
export type RBACResource = 'chat' | 'sessions' | 'knowledge' | 'workflows' | 'integrations' | 'domains' | 'settings' | 'users' | 'roles' | 'tenants' | 'models' | 'ml' | 'agents' | 'webhooks' | 'mcp';
export type RBACAction = 'read' | 'write' | 'delete' | 'manage';
export type PermissionKey = `${RBACResource}:${RBACAction}` | '*:*';
export interface RoleDefinition {
    id: string;
    name: string;
    displayName: string;
    description?: string;
    isSystem: boolean;
    permissions: PermissionKey[];
}
export interface UserWithPermissions {
    id: string;
    name: string;
    email: string;
    role: string;
    status: string;
    tenantId: string;
    avatarUrl?: string;
    hasPassword: boolean;
    permissions: PermissionKey[];
    oauthProviders: string[];
    lastLoginAt?: string;
    createdAt: string;
}
export type OAuth2Provider = 'google' | 'github' | 'discord';
export interface OAuth2Account {
    id: string;
    provider: OAuth2Provider;
    providerAccountId: string;
    connectedAt: string;
}
export interface OAuth2AuthorizeResponse {
    url: string;
}
export interface OAuth2CallbackResponse {
    token: string;
    expiresIn: number;
    user: {
        id: string;
        name: string;
        email: string;
        role: string;
        tenantId: string;
        avatarUrl?: string;
    };
    provider: OAuth2Provider;
}
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';
export type AuditAction = 'user.login' | 'user.logout' | 'user.create' | 'user.update' | 'user.delete' | 'tenant.create' | 'tenant.update' | 'tenant.delete' | 'workflow.create' | 'workflow.update' | 'workflow.delete' | 'workflow.execute' | 'role.create' | 'role.update' | 'role.delete' | 'role.assign' | 'settings.update' | 'integration.connect' | 'integration.disconnect' | 'agent.config.update' | 'knowledge.upload' | 'knowledge.delete' | 'mcp.connect' | 'mcp.disconnect' | string;
export interface AuditLogEntry {
    id: string;
    tenantId: string;
    userId: string;
    action: AuditAction;
    resource: string;
    resourceId?: string;
    details?: Record<string, unknown>;
    ip?: string;
    userAgent?: string;
    timestamp: string;
}
export interface SystemLogEntry {
    id: string;
    level: LogLevel;
    source: string;
    message: string;
    metadata?: Record<string, unknown>;
    error?: {
        name: string;
        message: string;
        stack?: string;
    };
    timestamp: string;
}
export interface SystemMetrics {
    uptime: number;
    memoryUsage: {
        heapUsed: number;
        heapTotal: number;
        rss: number;
        external: number;
    };
    cpuUsage: {
        user: number;
        system: number;
    };
    activeConnections: number;
    requestsPerMinute: number;
    llmCalls: {
        total: number;
        failed: number;
        avgLatency: number;
    };
    workflowExecutions: {
        total: number;
        running: number;
        failed: number;
    };
    timestamp: string;
}
export interface WorkflowSandboxConfig {
    timeoutMs: number;
    memoryLimitMb?: number;
}
export type PluginType = 'domain' | 'integration' | 'full-stack';
export type PluginStatus = 'registered' | 'active' | 'inactive' | 'error';
/**
 * HiTechClawPlugin — The universal plugin interface for extending HiTechClaw.
 *
 * A plugin can provide:
 * - Domain pack (agent persona + skills + tools)
 * - API routes (Hono sub-app mounted at /api/plugins/:pluginId)
 * - MongoDB collections (plugin-scoped data)
 * - Frontend pages (declared via `pages` manifest)
 * - Config schema (user-configurable settings)
 *
 * Each plugin is a self-contained package that registers with the core PluginManager.
 */
export interface HiTechClawPlugin {
    /** Unique plugin identifier, e.g. 'shirtgen', 'his-mini' */
    id: string;
    /** Display name */
    name: string;
    /** Semantic version */
    version: string;
    /** Description */
    description: string;
    /** Author name or org */
    author: string;
    /** Icon (emoji or URL) */
    icon: string;
    /** Plugin type */
    type: PluginType;
    /** Domain pack (if plugin provides domain-specific AI) */
    domain?: PluginDomainConfig;
    /** API routes factory — returns a Hono sub-app */
    createRoutes?: (ctx: PluginContext) => unknown;
    /** MongoDB collection declarations (auto-created with indexes) */
    collections?: PluginCollectionConfig[];
    /** Frontend page declarations */
    pages?: PluginPageConfig[];
    /** Configuration schema */
    configSchema?: PluginConfigField[];
    /** Lifecycle hooks */
    onActivate?: (ctx: PluginContext) => Promise<void>;
    onDeactivate?: (ctx: PluginContext) => Promise<void>;
    /** Dependencies on other plugins */
    dependencies?: string[];
}
export interface PluginDomainConfig {
    /** Agent persona / system prompt for this domain */
    agentPersona: string;
    /** Skills provided by this domain */
    skills: PluginSkillConfig[];
    /** Recommended integration IDs */
    recommendedIntegrations?: string[];
    /** Knowledge pack IDs */
    knowledgePacks?: string[];
}
export interface PluginSkillConfig {
    id: string;
    name: string;
    description: string;
    version: string;
    category: string;
    tools: PluginToolConfig[];
}
export interface PluginToolConfig {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    execute: (params: Record<string, unknown>, ctx: PluginContext) => Promise<ActionResult>;
}
export interface PluginCollectionConfig {
    /** Collection name (will be prefixed: plugin_{pluginId}_{name}) */
    name: string;
    /** MongoDB indexes */
    indexes?: Array<{
        fields: Record<string, 1 | -1>;
        options?: {
            unique?: boolean;
            sparse?: boolean;
            expireAfterSeconds?: number;
        };
    }>;
}
export interface PluginPageConfig {
    /** Route path (relative to /plugins/:pluginId/) */
    path: string;
    /** Page title */
    title: string;
    /** Icon (emoji or lucide icon name) */
    icon: string;
    /** Show in sidebar? */
    sidebar?: boolean;
    /** Sidebar group label */
    sidebarGroup?: string;
}
export interface PluginConfigField {
    key: string;
    label: string;
    type: 'string' | 'number' | 'boolean' | 'select' | 'secret' | 'url';
    description: string;
    required?: boolean;
    default?: unknown;
    options?: {
        label: string;
        value: string;
    }[];
}
/**
 * PluginContext — Provided to plugins during lifecycle and route creation.
 * Gives access to core platform services.
 */
export interface PluginContext {
    /** Plugin's own config values */
    config: Record<string, unknown>;
    /** Plugin's MongoDB collection accessor */
    getCollection: (name: string) => unknown;
    /** Access to the Agent's LLM router */
    llm: unknown;
    /** Access to the Agent's tool registry */
    tools: unknown;
    /** Access to the Agent's event bus */
    events: unknown;
    /** Access to RAG engine */
    rag: unknown;
    /** Access to image generation service */
    imageGen?: unknown;
    /** Tenant ID from request context */
    tenantId?: string;
    /** User ID from request context */
    userId?: string;
}
export interface PluginRegistryEntry {
    plugin: HiTechClawPlugin;
    status: PluginStatus;
    activatedAt?: string;
    error?: string;
}
export interface TranscriptionResult {
    text: string;
    language?: string;
    duration?: number;
    segments?: Array<{
        start: number;
        end: number;
        text: string;
    }>;
}
export interface TTSRequest {
    text: string;
    voice?: string;
    speed?: number;
    language?: string;
}
export type HandoffStatus = 'pending' | 'assigned' | 'active' | 'resolved' | 'returned_to_ai';
export type EscalationReason = 'user_request' | 'sentiment' | 'keyword' | 'confidence' | 'loop_detected' | 'manual';
export interface HandoffSession {
    id: string;
    tenantId: string;
    sessionId: string;
    userId: string;
    agentUserId?: string;
    status: HandoffStatus;
    reason: EscalationReason;
    reasonDetail?: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    metadata?: Record<string, unknown>;
    createdAt: string;
    assignedAt?: string;
    resolvedAt?: string;
}
export interface EscalationRule {
    id: string;
    tenantId: string;
    type: EscalationReason;
    enabled: boolean;
    config: {
        keywords?: string[];
        sentimentThreshold?: number;
        confidenceThreshold?: number;
        maxLoopCount?: number;
    };
}
export interface ConversationAnalytics {
    totalConversations: number;
    totalMessages: number;
    avgResponseTimeMs: number;
    avgMessagesPerConversation: number;
    resolutionRate: number;
    platformBreakdown: Record<string, number>;
    dailyVolume: Array<{
        date: string;
        conversations: number;
        messages: number;
    }>;
    topTopics: Array<{
        topic: string;
        count: number;
    }>;
    sentimentDistribution: {
        positive: number;
        neutral: number;
        negative: number;
    };
    avgSessionDurationMs: number;
    peakHours: Array<{
        hour: number;
        count: number;
    }>;
}
export interface AgentPerformanceMetrics {
    totalInteractions: number;
    avgLatencyMs: number;
    toolCallRate: number;
    escalationRate: number;
    tokenUsage: {
        prompt: number;
        completion: number;
        total: number;
    };
    costUsd: number;
    modelBreakdown: Record<string, {
        calls: number;
        avgLatency: number;
        cost: number;
    }>;
    errorRate: number;
}
export interface AgentTemplate {
    id: string;
    name: string;
    description: string;
    icon: string;
    category: string;
    persona: string;
    systemPrompt: string;
    skills: string[];
    tools: string[];
    suggestedModel?: string;
    tags: string[];
}
export interface RetentionPolicy {
    id: string;
    tenantId: string;
    resource: 'messages' | 'sessions' | 'audit_logs' | 'activity_logs' | 'llm_logs';
    retentionDays: number;
    enabled: boolean;
    lastRunAt?: string;
}
export interface ApiKeyEntry {
    id: string;
    tenantId: string;
    name: string;
    keyPrefix: string;
    keyHash: string;
    scopes: string[];
    expiresAt?: string;
    lastUsedAt?: string;
    createdAt: string;
    createdBy: string;
}
/** Trust level for skills — determines sandbox requirements */
export type SkillTrustLevel = 'builtin' | 'verified' | 'community';
/** Sandbox execution status */
export type SandboxStatus = 'creating' | 'ready' | 'running' | 'stopping' | 'stopped' | 'error';
/** Filesystem policy rule */
export interface FilesystemPolicyRule {
    path: string;
    access: 'read' | 'write' | 'read-write' | 'none';
}
/** Network policy rule (L7 HTTP method + path level) */
export interface NetworkPolicyRule {
    host: string;
    ports?: number[];
    methods?: ('GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS')[];
    pathPatterns?: string[];
    allow: boolean;
}
/** Process policy constraints */
export interface ProcessPolicy {
    allowPrivilegeEscalation: boolean;
    blockedSyscalls?: string[];
    maxProcesses?: number;
}
/** Inference routing policy */
export interface InferencePolicy {
    provider: string;
    model: string;
    stripCredentials: boolean;
}
/** Complete sandbox policy (maps to OpenShell YAML policy) */
export interface SandboxPolicy {
    name: string;
    version: string;
    filesystem: {
        rules: FilesystemPolicyRule[];
        defaultAccess: 'none' | 'read';
    };
    network: {
        rules: NetworkPolicyRule[];
        defaultAction: 'allow' | 'deny';
    };
    process: ProcessPolicy;
    inference?: InferencePolicy;
}
/** Provider for credential injection into sandbox */
export interface SandboxProvider {
    id: string;
    name: string;
    type: 'api-key' | 'oauth2' | 'bearer' | 'basic';
    /** Environment variable names to inject (never expose values in this type) */
    envVars: string[];
}
/** Configuration for creating a sandbox */
export interface SandboxConfig {
    /** Unique sandbox identifier */
    id: string;
    /** Sandbox name (human-readable) */
    name: string;
    /** Tenant that owns this sandbox */
    tenantId: string;
    /** Base image (default: 'base') */
    image?: string;
    /** Policy to apply */
    policy: SandboxPolicy;
    /** Credential providers to inject */
    providers?: SandboxProvider[];
    /** Enable GPU passthrough */
    gpu?: boolean;
    /** Resource limits */
    resources?: SandboxResourceLimits;
    /** Timeout for sandbox operations in ms */
    timeoutMs?: number;
}
/** Resource limits for a sandbox container */
export interface SandboxResourceLimits {
    /** CPU limit (e.g., '0.5' = half a core) */
    cpuLimit?: string;
    /** Memory limit (e.g., '512Mi', '1Gi') */
    memoryLimit?: string;
    /** Max concurrent sandboxes per tenant */
    maxConcurrent?: number;
}
/** Sandbox instance info (runtime state) */
export interface SandboxInstance {
    id: string;
    name: string;
    tenantId: string;
    status: SandboxStatus;
    image: string;
    policy: SandboxPolicy;
    gpu: boolean;
    createdAt: string;
    lastActivityAt: string;
    resources?: SandboxResourceLimits;
}
/** Result of executing code/tool inside a sandbox */
export interface SandboxExecutionResult {
    success: boolean;
    output: unknown;
    stderr?: string;
    exitCode: number;
    durationMs: number;
    /** Policy violations that were blocked */
    blockedActions?: SandboxBlockedAction[];
}
/** A blocked action recorded by the policy engine */
export interface SandboxBlockedAction {
    type: 'filesystem' | 'network' | 'process' | 'inference';
    description: string;
    rule: string;
    timestamp: string;
}
/** Sandbox audit log entry */
export interface SandboxAuditEntry {
    sandboxId: string;
    tenantId: string;
    action: 'create' | 'connect' | 'execute' | 'policy-update' | 'destroy' | 'blocked';
    details: Record<string, unknown>;
    timestamp: string;
}
/** Tenant-level sandbox configuration stored in tenantSettings */
export interface TenantSandboxConfig {
    /** Whether sandbox execution is enabled for this tenant */
    enabled: boolean;
    /** Default policy name to use */
    defaultPolicy: string;
    /** Max concurrent sandboxes */
    maxConcurrentSandboxes: number;
    /** Sandbox idle timeout (ms) — destroy after inactivity */
    idleTimeoutMs: number;
    /** CPU limit per sandbox */
    cpuLimit: string;
    /** Memory limit per sandbox */
    memoryLimit: string;
    /** Enable GPU for this tenant */
    gpuEnabled: boolean;
}
/** Per-tool sandbox requirement (added to ToolDefinition) */
export interface ToolSandboxPolicy {
    /** Whether this tool requires sandbox execution */
    required: boolean;
    /** Policy name to use (defaults to tenant default) */
    policyName?: string;
    /** Additional network rules needed by this tool */
    networkAllowlist?: string[];
    /** Filesystem paths this tool needs */
    filesystemPaths?: FilesystemPolicyRule[];
}
export type AgentTaskType = 'subagent' | 'shell' | 'workflow' | 'remote';
export type AgentTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export interface AgentTask {
    id: string;
    type: AgentTaskType;
    status: AgentTaskStatus;
    description: string;
    parentTaskId?: string;
    agentId: string;
    sessionId: string;
    startedAt: string;
    completedAt?: string;
    result?: string;
    error?: string;
    metadata?: Record<string, unknown>;
}
export interface TokenBudget {
    /** Total context window for this model (in tokens) */
    contextWindow: number;
    /** Fraction at which auto-compact triggers (default 0.8) */
    compactThreshold: number;
    /** Accumulated tokens used across iterations in this session */
    usedTokens: number;
}
export type AgentMemoryScope = 'user' | 'project' | 'session';
export interface AgentDefinition {
    /** Unique agent type name (used as directory name for memory) */
    agentType: string;
    description: string;
    systemPrompt: string;
    /** Tool names allowed; undefined = all registered tools */
    tools?: string[];
    disallowedTools?: string[];
    /** Override LLM model for this agent */
    model?: string;
    maxTurns?: number;
    memoryScope?: AgentMemoryScope;
    permissionMode?: 'normal' | 'strict' | 'bubble';
    /** Source of this definition */
    source: 'built-in' | 'project' | 'user' | 'api';
}
export interface CoordinatorConfig {
    /** Whether coordinator mode is active */
    enabled: boolean;
    /** Maximum number of concurrent subagents */
    maxConcurrentAgents?: number;
    /** Tool names available to worker agents (undefined = all) */
    workerTools?: string[];
}
//# sourceMappingURL=index.d.ts.map