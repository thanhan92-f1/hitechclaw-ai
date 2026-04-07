import { Db, Collection } from 'mongodb';
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
    embedding?: number[];
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
    userId?: string;
    type: 'fact' | 'preference' | 'conversation' | 'context' | 'instruction' | 'skill-data';
    content: string;
    metadata: Record<string, any>;
    source: string;
    tags: string[];
    embedding?: number[];
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
    error?: {
        name: string;
        message: string;
        stack?: string;
    };
    createdAt: Date;
}
export interface MongoChannelConnection {
    _id: string;
    tenantId: string;
    userId: string;
    channelType: 'telegram' | 'discord' | 'facebook' | 'slack' | 'whatsapp' | 'zalo' | 'msteams' | 'webhook';
    name: string;
    config: Record<string, any>;
    status: 'active' | 'inactive' | 'error';
    agentConfigId?: string;
    domainId?: string;
    lastConnectedAt?: Date;
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}
export interface MongoActivityLog {
    _id: string;
    tenantId: string;
    userId: string;
    method: string;
    path: string;
    statusCode: number;
    duration: number;
    ip?: string;
    userAgent?: string;
    requestBody?: Record<string, any>;
    responseSize?: number;
    sessionId?: string;
    createdAt: Date;
}
export interface MongoLLMLog {
    _id: string;
    tenantId: string;
    userId: string;
    sessionId?: string;
    provider: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    duration: number;
    costUsd: number;
    platform?: string;
    success: boolean;
    error?: string;
    toolCalls?: number;
    streaming: boolean;
    createdAt: Date;
}
export declare function getMongo(mongoUrl?: string): Db;
export declare function connectMongo(mongoUrl?: string): Promise<Db>;
export declare function closeMongo(): Promise<void>;
export declare function sessionsCollection(db?: Db): Collection<MongoSession>;
export declare function messagesCollection(db?: Db): Collection<MongoMessage>;
export declare function memoryEntriesCollection(db?: Db): Collection<MongoMemoryEntry>;
export declare function agentConfigsCollection(db?: Db): Collection<MongoAgentConfig>;
export declare function auditLogsCollection(db?: Db): Collection<MongoAuditLog>;
export declare function systemLogsCollection(db?: Db): Collection<MongoSystemLog>;
export declare function channelConnectionsCollection(db?: Db): Collection<MongoChannelConnection>;
export declare function activityLogsCollection(db?: Db): Collection<MongoActivityLog>;
export declare function llmLogsCollection(db?: Db): Collection<MongoLLMLog>;
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
export declare function handoffSessionsCollection(db?: Db): Collection<MongoHandoffSession>;
export interface MongoEscalationRule {
    tenantId: string;
    type: string;
    enabled: boolean;
    config: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
}
export declare function escalationRulesCollection(db?: Db): Collection<MongoEscalationRule>;
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
export declare function apiKeysCollection(db?: Db): Collection<MongoApiKey>;
export interface MongoRetentionPolicy {
    tenantId: string;
    resource: string;
    retentionDays: number;
    enabled: boolean;
    lastRunAt?: Date;
    createdAt: Date;
}
export declare function retentionPoliciesCollection(db?: Db): Collection<MongoRetentionPolicy>;
export interface MongoSandboxAuditLog {
    _id?: string;
    sandboxId: string;
    tenantId: string;
    action: 'create' | 'connect' | 'execute' | 'policy-update' | 'destroy' | 'blocked';
    details: Record<string, unknown>;
    createdAt: Date;
}
export declare function sandboxAuditLogsCollection(db?: Db): Collection<MongoSandboxAuditLog>;
//# sourceMappingURL=mongo.d.ts.map