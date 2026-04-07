import { pgTable, text, timestamp, integer, boolean, jsonb, index, varchar, serial, uniqueIndex } from 'drizzle-orm/pg-core';

// ─── Tenants ────────────────────────────────────────────────

export const tenants = pgTable('tenants', {
  id: text('id').primaryKey(), // e.g. 'hospital-abc', 'clinic-xyz'
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(), // URL-friendly identifier
  plan: text('plan').notNull().default('free'), // free | starter | pro | enterprise
  status: text('status').notNull().default('active'), // active | suspended | deleted
  metadata: jsonb('metadata').notNull().default({}), // org info, address, etc.
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ─── Tenant Settings (per-tenant configuration) ─────────────

export const tenantSettings = pgTable('tenant_settings', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  // LLM Configuration
  llmProvider: text('llm_provider').notNull().default('ollama'), // openai | anthropic | ollama
  llmModel: text('llm_model').notNull().default('qwen2.5:14b'),
  llmApiKey: text('llm_api_key'), // encrypted — tenant's own API key
  llmBaseUrl: text('llm_base_url'), // for ollama / custom endpoints
  llmTemperature: integer('llm_temperature'), // stored as integer x100 (e.g. 70 = 0.7)
  llmMaxTokens: integer('llm_max_tokens'),
  // Agent persona
  agentName: text('agent_name').notNull().default('HiTechClaw Assistant'),
  systemPrompt: text('system_prompt'), // null = use platform default
  // Language
  aiLanguage: text('ai_language').notNull().default('auto'),
  aiLanguageCustom: text('ai_language_custom'),
  // Features
  enableWebSearch: boolean('enable_web_search').notNull().default(true),
  enableRag: boolean('enable_rag').notNull().default(true),
  enableWorkflows: boolean('enable_workflows').notNull().default(true),
  enabledDomains: jsonb('enabled_domains').notNull().default([]), // ['healthcare', 'developer']
  enabledIntegrations: jsonb('enabled_integrations').notNull().default([]),
  // Limits
  maxUsersPerTenant: integer('max_users_per_tenant').notNull().default(10),
  maxSessionsPerUser: integer('max_sessions_per_user').notNull().default(100),
  maxMessagesPerDay: integer('max_messages_per_day').notNull().default(1000),
  // Search
  tavilyApiKey: text('tavily_api_key'), // tenant's own Tavily key
  // Custom branding
  branding: jsonb('branding').notNull().default({}), // { logo, primaryColor, appTitle }
  // Sandbox Configuration (OpenShell)
  sandboxConfig: jsonb('sandbox_config').notNull().default({
    enabled: false,
    defaultPolicy: 'default',
    maxConcurrentSandboxes: 5,
    idleTimeoutMs: 300000,
    cpuLimit: '0.5',
    memoryLimit: '512Mi',
    gpuEnabled: false,
  }), // TenantSandboxConfig from @hitechclaw/shared
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('tenant_settings_tenant_id_idx').on(table.tenantId),
]);

// ─── Users ──────────────────────────────────────────────────

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  email: text('email').notNull(),
  passwordHash: text('password_hash'), // nullable for OAuth-only users
  avatarUrl: text('avatar_url'),
  role: text('role').notNull().default('user'), // legacy: owner | admin | user
  status: text('status').notNull().default('active'), // active | suspended | invited
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('users_tenant_email_idx').on(table.tenantId, table.email),
]);

// ─── Roles (per-tenant RBAC) ────────────────────────────────

export const roles = pgTable('roles', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(), // e.g. 'owner', 'admin', 'member', 'viewer', or custom
  displayName: text('display_name').notNull(),
  description: text('description'),
  isSystem: boolean('is_system').notNull().default(false), // system roles can't be deleted
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('roles_tenant_name_idx').on(table.tenantId, table.name),
  index('roles_tenant_id_idx').on(table.tenantId),
]);

// ─── Permissions ────────────────────────────────────────────

export const permissions = pgTable('permissions', {
  id: text('id').primaryKey(),
  resource: text('resource').notNull(), // e.g. 'chat', 'users', 'settings', 'workflows', 'roles'
  action: text('action').notNull(), // e.g. 'read', 'write', 'delete', 'manage'
  description: text('description'),
}, (table) => [
  uniqueIndex('permissions_resource_action_idx').on(table.resource, table.action),
]);

// ─── Role ↔ Permission (many-to-many) ──────────────────────

export const rolePermissions = pgTable('role_permissions', {
  id: text('id').primaryKey(),
  roleId: text('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
  permissionId: text('permission_id').notNull().references(() => permissions.id, { onDelete: 'cascade' }),
}, (table) => [
  uniqueIndex('role_permissions_role_perm_idx').on(table.roleId, table.permissionId),
  index('role_permissions_role_id_idx').on(table.roleId),
]);

// ─── User ↔ Role (many-to-many, per-tenant) ────────────────

export const userRoles = pgTable('user_roles', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  roleId: text('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
  assignedAt: timestamp('assigned_at').defaultNow().notNull(),
  assignedBy: text('assigned_by'), // userId who assigned this role
}, (table) => [
  uniqueIndex('user_roles_user_role_idx').on(table.userId, table.roleId),
  index('user_roles_user_id_idx').on(table.userId),
  index('user_roles_role_id_idx').on(table.roleId),
]);

// ─── OAuth Accounts (linked external providers) ─────────────

export const oauthAccounts = pgTable('oauth_accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(), // google | github | discord
  providerAccountId: text('provider_account_id').notNull(), // external userId
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  tokenExpiresAt: timestamp('token_expires_at'),
  scope: text('scope'),
  profile: jsonb('profile').notNull().default({}), // raw provider profile
  connectedAt: timestamp('connected_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('oauth_accounts_provider_account_idx').on(table.provider, table.providerAccountId, table.tenantId),
  index('oauth_accounts_user_id_idx').on(table.userId),
  index('oauth_accounts_tenant_id_idx').on(table.tenantId),
]);

// ─── Sessions, Messages, Memory, AgentConfigs → MongoDB ────
// These tables have been moved to MongoDB for flexible AI data storage.
// See packages/db/src/mongo.ts for MongoDB models.

// ─── Workflows ──────────────────────────────────────────────

export const workflows = pgTable('workflows', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  version: integer('version').notNull().default(1),
  definition: jsonb('definition').notNull(), // nodes + edges + variables + trigger
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('workflows_tenant_id_idx').on(table.tenantId),
]);

// ─── Workflow Executions ────────────────────────────────────

export const workflowExecutions = pgTable('workflow_executions', {
  id: text('id').primaryKey(),
  workflowId: text('workflow_id').notNull().references(() => workflows.id),
  status: text('status').notNull().default('pending'), // pending | running | completed | failed | cancelled
  nodeResults: jsonb('node_results').notNull().default({}),
  variables: jsonb('variables').notNull().default({}),
  error: text('error'),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
}, (table) => [
  index('workflow_executions_workflow_id_idx').on(table.workflowId),
]);

// ─── Integration Connections ────────────────────────────────

export const integrationConnections = pgTable('integration_connections', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  integrationId: text('integration_id').notNull(), // e.g. 'gmail', 'github', 'slack-api'
  credentials: jsonb('credentials').notNull().default({}), // encrypted API keys, tokens
  oauthTokens: jsonb('oauth_tokens'), // { accessToken, refreshToken, expiresAt }
  status: text('status').notNull().default('active'), // active | revoked | expired | error
  metadata: jsonb('metadata').notNull().default({}),
  connectedAt: timestamp('connected_at').defaultNow().notNull(),
  lastUsedAt: timestamp('last_used_at'),
}, (table) => [
  index('integration_connections_user_id_idx').on(table.userId),
  index('integration_connections_tenant_id_idx').on(table.tenantId),
  index('integration_connections_integration_id_idx').on(table.integrationId),
]);

// ─── Webhooks ───────────────────────────────────────────────

export const webhooks = pgTable('webhooks', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  integrationId: text('integration_id').notNull(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  triggerName: text('trigger_name').notNull(),
  secret: text('secret').notNull(),
  url: text('url').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  lastTriggeredAt: timestamp('last_triggered_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('webhooks_user_id_idx').on(table.userId),
  index('webhooks_tenant_id_idx').on(table.tenantId),
  index('webhooks_integration_id_idx').on(table.integrationId),
]);

// ─── User Domain Preferences ────────────────────────────────

export const userDomainPreferences = pgTable('user_domain_preferences', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  activeDomains: jsonb('active_domains').notNull().default([]), // ['general', 'developer', 'healthcare']
  defaultDomain: text('default_domain').notNull().default('general'),
  customPersona: text('custom_persona'), // user-defined override persona
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('user_domain_preferences_user_id_idx').on(table.userId),
  index('user_domain_preferences_tenant_id_idx').on(table.tenantId),
]);
