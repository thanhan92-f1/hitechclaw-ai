import { MongoClient, Db, Collection, ObjectId } from 'mongodb';

// ─── Types ─────────────────────────────────────────────────

export interface MongoSession {
  _id: string;
  tenantId: string;
  userId: string;
  platform: string;
  title: string | null;
  agentConfigId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MongoMessage {
  _id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCalls?: any;
  toolResults?: any;
  metadata?: Record<string, any>;
  embedding?: number[]; // vector embedding for RAG
  /** RL feedback: user or system reward signal for bandit learning */
  feedback?: {
    skillId: string;
    toolName?: string;
    reward: number;
    success: boolean;
    reason?: string;
  };
  createdAt: Date;
}

export interface MongoMemoryEntry {
  _id: string;
  tenantId: string;
  userId?: string; // user-scoped persistent memory (null = tenant-wide)
  type: 'fact' | 'preference' | 'conversation' | 'context' | 'instruction' | 'skill-data';
  content: string;
  metadata: Record<string, any>; // extra fields: key, confidence, etc.
  source: string; // 'explicit' | 'inferred' | ...
  tags: string[];
  embedding?: number[]; // vector embedding for similarity search
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

export interface MongoAgentConfig {
  _id: string;
  tenantId: string;
  name: string;
  persona: string;
  systemPrompt: string;
  llmConfig: Record<string, any>;
  enabledSkills: string[];
  memoryConfig: Record<string, any>;
  securityConfig: Record<string, any>;
  maxToolIterations: number;
  toolTimeout: number;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MongoAuditLog {
  _id: string;
  tenantId: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, any>;
  ip?: string;
  userAgent?: string;
  createdAt: Date;
}

export interface MongoSystemLog {
  _id: string;
  level: string;
  source: string;
  message: string;
  metadata?: Record<string, any>;
  error?: { name: string; message: string; stack?: string };
  createdAt: Date;
}

export interface MongoChannelConnection {
  _id: string;
  tenantId: string;
  userId: string;
  channelType: 'telegram' | 'discord' | 'facebook' | 'slack' | 'whatsapp' | 'zalo' | 'msteams' | 'webhook';
  name: string;
  config: Record<string, any>; // e.g. { botToken, allowedChatIds }
  status: 'active' | 'inactive' | 'error';
  agentConfigId?: string;
  domainId?: string; // Domain pack ID for channel-specific AI persona (e.g. 'healthcare', 'finance')
  lastConnectedAt?: Date;
  metadata?: Record<string, any>; // e.g. { botUsername, botId }
  createdAt: Date;
  updatedAt: Date;
}

export interface MongoActivityLog {
  _id: string;
  tenantId: string;
  userId: string;
  method: string;        // GET, POST, PUT, DELETE
  path: string;          // /api/chat, /api/settings, etc.
  statusCode: number;
  duration: number;       // ms
  ip?: string;
  userAgent?: string;
  requestBody?: Record<string, any>; // sanitized (no secrets)
  responseSize?: number;
  sessionId?: string;     // chat session if applicable
  createdAt: Date;
}

export interface MongoLLMLog {
  _id: string;
  tenantId: string;
  userId: string;
  sessionId?: string;
  provider: string;       // ollama, openai, anthropic
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  duration: number;       // ms
  costUsd: number;        // estimated cost in USD
  platform?: string;      // web, telegram, slack, api, etc.
  success: boolean;
  error?: string;
  toolCalls?: number;     // count of tool calls in this interaction
  streaming: boolean;
  createdAt: Date;
}

// ─── Connection ────────────────────────────────────────────

let mongoClient: MongoClient | null = null;
let mongoDB: Db | null = null;

export function getMongo(mongoUrl?: string): Db {
  if (mongoDB) return mongoDB;

  const url = mongoUrl || process.env.MONGODB_URL;
  if (!url) {
    throw new Error('MONGODB_URL is required');
  }

  mongoClient = new MongoClient(url);
  mongoDB = mongoClient.db();
  return mongoDB;
}

export async function connectMongo(mongoUrl?: string): Promise<Db> {
  const url = mongoUrl || process.env.MONGODB_URL;
  if (!url) throw new Error('MONGODB_URL is required');

  if (mongoDB && mongoClient) return mongoDB;

  mongoClient = new MongoClient(url);
  await mongoClient.connect();
  mongoDB = mongoClient.db();

  // Ensure indexes
  await ensureIndexes(mongoDB);

  return mongoDB;
}

export async function closeMongo() {
  if (mongoClient) {
    await mongoClient.close();
    mongoClient = null;
    mongoDB = null;
  }
}

// ─── Collections ───────────────────────────────────────────

export function sessionsCollection(db?: Db): Collection<MongoSession> {
  return (db || getMongo()).collection<MongoSession>('sessions');
}

export function messagesCollection(db?: Db): Collection<MongoMessage> {
  return (db || getMongo()).collection<MongoMessage>('messages');
}

export function memoryEntriesCollection(db?: Db): Collection<MongoMemoryEntry> {
  return (db || getMongo()).collection<MongoMemoryEntry>('memory_entries');
}

export function agentConfigsCollection(db?: Db): Collection<MongoAgentConfig> {
  return (db || getMongo()).collection<MongoAgentConfig>('agent_configs');
}

export function auditLogsCollection(db?: Db): Collection<MongoAuditLog> {
  return (db || getMongo()).collection<MongoAuditLog>('audit_logs');
}

export function systemLogsCollection(db?: Db): Collection<MongoSystemLog> {
  return (db || getMongo()).collection<MongoSystemLog>('system_logs');
}

export function channelConnectionsCollection(db?: Db): Collection<MongoChannelConnection> {
  return (db || getMongo()).collection<MongoChannelConnection>('channel_connections');
}

export function activityLogsCollection(db?: Db): Collection<MongoActivityLog> {
  return (db || getMongo()).collection<MongoActivityLog>('activity_logs');
}

export function llmLogsCollection(db?: Db): Collection<MongoLLMLog> {
  return (db || getMongo()).collection<MongoLLMLog>('llm_logs');
}

// ─── Handoff Sessions ──────────────────────────────────────

export interface MongoHandoffSession {
  tenantId: string;
  sessionId: string;
  userId: string;
  agentUserId?: string;
  status: 'pending' | 'assigned' | 'active' | 'resolved' | 'returned_to_ai';
  reason: string;
  reasonDetail?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  metadata?: Record<string, unknown>;
  createdAt: Date;
  assignedAt?: Date;
  resolvedAt?: Date;
}

export function handoffSessionsCollection(db?: Db): Collection<MongoHandoffSession> {
  return (db || getMongo()).collection<MongoHandoffSession>('handoff_sessions');
}

// ─── Escalation Rules ──────────────────────────────────────

export interface MongoEscalationRule {
  tenantId: string;
  type: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export function escalationRulesCollection(db?: Db): Collection<MongoEscalationRule> {
  return (db || getMongo()).collection<MongoEscalationRule>('escalation_rules');
}

// ─── API Keys ──────────────────────────────────────────────

export interface MongoApiKey {
  tenantId: string;
  name: string;
  keyPrefix: string;
  keyHash: string;
  scopes: string[];
  expiresAt?: Date;
  lastUsedAt?: Date;
  createdAt: Date;
  createdBy: string;
}

export function apiKeysCollection(db?: Db): Collection<MongoApiKey> {
  return (db || getMongo()).collection<MongoApiKey>('api_keys');
}

// ─── Retention Policies ────────────────────────────────────

export interface MongoRetentionPolicy {
  tenantId: string;
  resource: string;
  retentionDays: number;
  enabled: boolean;
  lastRunAt?: Date;
  createdAt: Date;
}

export function retentionPoliciesCollection(db?: Db): Collection<MongoRetentionPolicy> {
  return (db || getMongo()).collection<MongoRetentionPolicy>('retention_policies');
}

// ─── Sandbox Audit Logs ────────────────────────────────────

export interface MongoSandboxAuditLog {
  _id?: string;
  sandboxId: string;
  tenantId: string;
  action: 'create' | 'connect' | 'execute' | 'policy-update' | 'destroy' | 'blocked';
  details: Record<string, unknown>;
  createdAt: Date;
}

export function sandboxAuditLogsCollection(db?: Db): Collection<MongoSandboxAuditLog> {
  return (db || getMongo()).collection<MongoSandboxAuditLog>('sandbox_audit_logs');
}

// ─── Indexes ───────────────────────────────────────────────

async function ensureIndexes(db: Db) {
  const sessions = sessionsCollection(db);
  await sessions.createIndex({ tenantId: 1, userId: 1 });
  await sessions.createIndex({ userId: 1 });
  await sessions.createIndex({ updatedAt: -1 });

  const messages = messagesCollection(db);
  await messages.createIndex({ sessionId: 1, createdAt: 1 });

  const memory = memoryEntriesCollection(db);
  await memory.createIndex({ tenantId: 1, type: 1 });
  await memory.createIndex({ tags: 1 });
  await memory.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

  const agentConfigs = agentConfigsCollection(db);
  await agentConfigs.createIndex({ tenantId: 1 });
  await agentConfigs.createIndex({ tenantId: 1, isDefault: 1 });

  // Audit logs
  const auditLogs = auditLogsCollection(db);
  await auditLogs.createIndex({ tenantId: 1, createdAt: -1 });
  await auditLogs.createIndex({ userId: 1, createdAt: -1 });
  await auditLogs.createIndex({ action: 1 });
  await auditLogs.createIndex({ resource: 1 });
  // TTL: auto-delete audit logs after 90 days
  await auditLogs.createIndex({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });

  // System logs
  const systemLogs = systemLogsCollection(db);
  await systemLogs.createIndex({ level: 1, createdAt: -1 });
  await systemLogs.createIndex({ source: 1, createdAt: -1 });
  await systemLogs.createIndex({ message: 'text' });
  // TTL: auto-delete system logs after 30 days
  await systemLogs.createIndex({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 3600 });

  // Channel connections
  const channels = channelConnectionsCollection(db);
  await channels.createIndex({ tenantId: 1, userId: 1 });
  await channels.createIndex({ tenantId: 1, channelType: 1 });
  await channels.createIndex({ status: 1 });

  // Activity logs (per-user API request logs)
  const activityLogs = activityLogsCollection(db);
  await activityLogs.createIndex({ tenantId: 1, userId: 1, createdAt: -1 });
  await activityLogs.createIndex({ userId: 1, createdAt: -1 });
  await activityLogs.createIndex({ path: 1, createdAt: -1 });
  await activityLogs.createIndex({ method: 1 });
  // TTL: auto-delete activity logs after 60 days
  await activityLogs.createIndex({ createdAt: 1 }, { expireAfterSeconds: 60 * 24 * 3600 });

  // LLM interaction logs
  const llmLogs = llmLogsCollection(db);
  await llmLogs.createIndex({ tenantId: 1, userId: 1, createdAt: -1 });
  await llmLogs.createIndex({ provider: 1, model: 1, createdAt: -1 });
  await llmLogs.createIndex({ sessionId: 1 });
  await llmLogs.createIndex({ success: 1 });
  // TTL: auto-delete LLM logs after 90 days
  await llmLogs.createIndex({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });

  // Handoff sessions
  const handoff = handoffSessionsCollection(db);
  await handoff.createIndex({ tenantId: 1, status: 1, createdAt: -1 });
  await handoff.createIndex({ sessionId: 1 });
  await handoff.createIndex({ agentUserId: 1, status: 1 });

  // Escalation rules
  const rules = escalationRulesCollection(db);
  await rules.createIndex({ tenantId: 1, type: 1 });

  // API keys
  const apiKeys = apiKeysCollection(db);
  await apiKeys.createIndex({ tenantId: 1 });
  await apiKeys.createIndex({ keyHash: 1 }, { unique: true });

  // Retention policies
  const retention = retentionPoliciesCollection(db);
  await retention.createIndex({ tenantId: 1, resource: 1 }, { unique: true });

  // Sandbox audit logs
  const sandboxAudit = sandboxAuditLogsCollection(db);
  await sandboxAudit.createIndex({ tenantId: 1, createdAt: -1 });
  await sandboxAudit.createIndex({ sandboxId: 1, createdAt: -1 });
  await sandboxAudit.createIndex({ action: 1 });
  // TTL: auto-delete sandbox audit logs after 90 days
  await sandboxAudit.createIndex({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });
}
