import postgres from 'postgres';
import * as schema from './schema/index.js';
export declare function getDB(databaseUrl?: string): import("drizzle-orm/postgres-js").PostgresJsDatabase<typeof schema> & {
    $client: postgres.Sql<{}>;
};
export declare function closeDB(): Promise<void>;
export declare function runMigrations(databaseUrl?: string): Promise<void>;
export type DB = ReturnType<typeof getDB>;
export * from './schema/index.js';
export { encryptCredentials, decryptCredentials, isEncrypted } from './credential-encryption.js';
export { eq, and, or, desc, asc, sql, like, inArray } from 'drizzle-orm';
export { seedInitialData } from './seed.js';
export { getMongo, connectMongo, closeMongo, sessionsCollection, messagesCollection, memoryEntriesCollection, agentConfigsCollection, auditLogsCollection, systemLogsCollection, channelConnectionsCollection, activityLogsCollection, llmLogsCollection, handoffSessionsCollection, escalationRulesCollection, apiKeysCollection, retentionPoliciesCollection, sandboxAuditLogsCollection, } from './mongo.js';
export type { MongoSession, MongoMessage, MongoMemoryEntry, MongoAgentConfig, MongoAuditLog, MongoSystemLog, MongoChannelConnection, MongoActivityLog, MongoLLMLog, MongoHandoffSession, MongoEscalationRule, MongoApiKey, MongoRetentionPolicy, MongoSandboxAuditLog, } from './mongo.js';
export { mongoMonitoringStore } from './monitoring-store.js';
export { estimateCost, getModelPricing, listPricing } from './llm-pricing.js';
//# sourceMappingURL=index.d.ts.map