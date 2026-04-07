import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as schema from './schema/index.js';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
let db = null;
let client = null;
export function getDB(databaseUrl) {
    if (db)
        return db;
    const url = databaseUrl || process.env.DATABASE_URL;
    if (!url) {
        throw new Error('DATABASE_URL is required');
    }
    client = postgres(url);
    db = drizzle(client, { schema });
    return db;
}
export async function closeDB() {
    if (client) {
        await client.end();
        client = null;
        db = null;
    }
}
export async function runMigrations(databaseUrl) {
    const url = databaseUrl || process.env.DATABASE_URL;
    if (!url)
        throw new Error('DATABASE_URL is required for migrations');
    const migrationClient = postgres(url, { max: 1 });
    const migrationDb = drizzle(migrationClient);
    const migrationsFolder = resolve(__dirname, 'migrations');
    await migrate(migrationDb, { migrationsFolder });
    await migrationClient.end();
}
// Re-export schema and drizzle helpers
export * from './schema/index.js';
export { encryptCredentials, decryptCredentials, isEncrypted } from './credential-encryption.js';
export { eq, and, or, desc, asc, sql, like, inArray } from 'drizzle-orm';
export { seedInitialData } from './seed.js';
// MongoDB exports
export { getMongo, connectMongo, closeMongo, sessionsCollection, messagesCollection, memoryEntriesCollection, agentConfigsCollection, auditLogsCollection, systemLogsCollection, channelConnectionsCollection, activityLogsCollection, llmLogsCollection, handoffSessionsCollection, escalationRulesCollection, apiKeysCollection, retentionPoliciesCollection, sandboxAuditLogsCollection, } from './mongo.js';
// Monitoring store
export { mongoMonitoringStore } from './monitoring-store.js';
// LLM Pricing
export { estimateCost, getModelPricing, listPricing } from './llm-pricing.js';
//# sourceMappingURL=index.js.map