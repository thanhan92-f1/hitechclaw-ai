import { MongoClient } from 'mongodb';
// ─── Connection ────────────────────────────────────────────
let mongoClient = null;
let mongoDB = null;
export function getMongo(mongoUrl) {
    if (mongoDB)
        return mongoDB;
    const url = mongoUrl || process.env.MONGODB_URL;
    if (!url) {
        throw new Error('MONGODB_URL is required');
    }
    mongoClient = new MongoClient(url);
    mongoDB = mongoClient.db();
    return mongoDB;
}
export async function connectMongo(mongoUrl) {
    const url = mongoUrl || process.env.MONGODB_URL;
    if (!url)
        throw new Error('MONGODB_URL is required');
    if (mongoDB && mongoClient)
        return mongoDB;
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
export function sessionsCollection(db) {
    return (db || getMongo()).collection('sessions');
}
export function messagesCollection(db) {
    return (db || getMongo()).collection('messages');
}
export function memoryEntriesCollection(db) {
    return (db || getMongo()).collection('memory_entries');
}
export function agentConfigsCollection(db) {
    return (db || getMongo()).collection('agent_configs');
}
export function auditLogsCollection(db) {
    return (db || getMongo()).collection('audit_logs');
}
export function systemLogsCollection(db) {
    return (db || getMongo()).collection('system_logs');
}
export function channelConnectionsCollection(db) {
    return (db || getMongo()).collection('channel_connections');
}
export function activityLogsCollection(db) {
    return (db || getMongo()).collection('activity_logs');
}
export function llmLogsCollection(db) {
    return (db || getMongo()).collection('llm_logs');
}
export function handoffSessionsCollection(db) {
    return (db || getMongo()).collection('handoff_sessions');
}
export function escalationRulesCollection(db) {
    return (db || getMongo()).collection('escalation_rules');
}
export function apiKeysCollection(db) {
    return (db || getMongo()).collection('api_keys');
}
export function retentionPoliciesCollection(db) {
    return (db || getMongo()).collection('retention_policies');
}
export function sandboxAuditLogsCollection(db) {
    return (db || getMongo()).collection('sandbox_audit_logs');
}
// ─── Indexes ───────────────────────────────────────────────
async function ensureIndexes(db) {
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
//# sourceMappingURL=mongo.js.map