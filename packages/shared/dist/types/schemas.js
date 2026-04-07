import { z } from 'zod';
// ─── Runtime Validation Schemas (Zod) ───────────────────────
export const LLMProviderSchema = z.enum([
    'openai', 'anthropic', 'ollama', 'google', 'groq', 'mistral', 'huggingface', 'custom',
]);
export const LLMConfigSchema = z.object({
    provider: LLMProviderSchema,
    model: z.string().min(1),
    apiKey: z.string().optional(),
    baseUrl: z.string().url().optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().positive().optional(),
});
export const ChatRequestSchema = z.object({
    sessionId: z.string().optional(),
    message: z.string().min(1, 'message is required'),
    stream: z.boolean().optional().default(false),
    webSearch: z.boolean().optional().default(false),
    domainId: z.string().optional(),
    agentConfigId: z.string().optional(),
});
export const ToolCallSchema = z.object({
    id: z.string(),
    name: z.string(),
    arguments: z.record(z.unknown()),
});
export const AgentConfigSchema = z.object({
    id: z.string(),
    name: z.string(),
    persona: z.string(),
    systemPrompt: z.string(),
    llm: LLMConfigSchema,
    enabledSkills: z.array(z.string()),
    memory: z.object({
        enabled: z.boolean(),
        maxEntries: z.number().positive(),
    }),
    security: z.object({
        requireApprovalForShell: z.boolean(),
        requireApprovalForNetwork: z.boolean(),
        blockedCommands: z.array(z.string()).optional(),
    }),
    maxToolIterations: z.number().positive().default(10),
    toolTimeout: z.number().positive().default(30000),
    subAgents: z.array(z.object({
        agentConfigId: z.string(),
        name: z.string(),
        description: z.string(),
    })).optional(),
    allowTransfer: z.boolean().optional(),
});
export const WorkflowAgentConfigSchema = z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(['sequential', 'parallel', 'loop']),
    subAgentIds: z.array(z.string()).min(1),
    maxIterations: z.number().positive().optional(),
    escalationKey: z.string().optional(),
    initialState: z.record(z.unknown()).optional(),
});
export const A2ATaskSchema = z.object({
    id: z.string(),
    message: z.string().min(1),
    sessionId: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
});
// ─── Auth Schemas ───────────────────────────────────────────
export const LoginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
});
export const RegisterSchema = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8),
});
