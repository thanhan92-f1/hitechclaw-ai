import { z } from 'zod';
export declare const LLMProviderSchema: z.ZodEnum<["openai", "anthropic", "ollama", "google", "groq", "mistral", "huggingface", "custom"]>;
export declare const LLMConfigSchema: z.ZodObject<{
    provider: z.ZodEnum<["openai", "anthropic", "ollama", "google", "groq", "mistral", "huggingface", "custom"]>;
    model: z.ZodString;
    apiKey: z.ZodOptional<z.ZodString>;
    baseUrl: z.ZodOptional<z.ZodString>;
    temperature: z.ZodOptional<z.ZodNumber>;
    maxTokens: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    provider: "openai" | "anthropic" | "ollama" | "google" | "groq" | "mistral" | "huggingface" | "custom";
    model: string;
    apiKey?: string | undefined;
    baseUrl?: string | undefined;
    temperature?: number | undefined;
    maxTokens?: number | undefined;
}, {
    provider: "openai" | "anthropic" | "ollama" | "google" | "groq" | "mistral" | "huggingface" | "custom";
    model: string;
    apiKey?: string | undefined;
    baseUrl?: string | undefined;
    temperature?: number | undefined;
    maxTokens?: number | undefined;
}>;
export declare const ChatRequestSchema: z.ZodObject<{
    sessionId: z.ZodOptional<z.ZodString>;
    message: z.ZodString;
    stream: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    webSearch: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    domainId: z.ZodOptional<z.ZodString>;
    agentConfigId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    message: string;
    stream: boolean;
    webSearch: boolean;
    sessionId?: string | undefined;
    domainId?: string | undefined;
    agentConfigId?: string | undefined;
}, {
    message: string;
    sessionId?: string | undefined;
    stream?: boolean | undefined;
    webSearch?: boolean | undefined;
    domainId?: string | undefined;
    agentConfigId?: string | undefined;
}>;
export declare const ToolCallSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    arguments: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
}, {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
}>;
export declare const AgentConfigSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    persona: z.ZodString;
    systemPrompt: z.ZodString;
    llm: z.ZodObject<{
        provider: z.ZodEnum<["openai", "anthropic", "ollama", "google", "groq", "mistral", "huggingface", "custom"]>;
        model: z.ZodString;
        apiKey: z.ZodOptional<z.ZodString>;
        baseUrl: z.ZodOptional<z.ZodString>;
        temperature: z.ZodOptional<z.ZodNumber>;
        maxTokens: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        provider: "openai" | "anthropic" | "ollama" | "google" | "groq" | "mistral" | "huggingface" | "custom";
        model: string;
        apiKey?: string | undefined;
        baseUrl?: string | undefined;
        temperature?: number | undefined;
        maxTokens?: number | undefined;
    }, {
        provider: "openai" | "anthropic" | "ollama" | "google" | "groq" | "mistral" | "huggingface" | "custom";
        model: string;
        apiKey?: string | undefined;
        baseUrl?: string | undefined;
        temperature?: number | undefined;
        maxTokens?: number | undefined;
    }>;
    enabledSkills: z.ZodArray<z.ZodString, "many">;
    memory: z.ZodObject<{
        enabled: z.ZodBoolean;
        maxEntries: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        maxEntries: number;
    }, {
        enabled: boolean;
        maxEntries: number;
    }>;
    security: z.ZodObject<{
        requireApprovalForShell: z.ZodBoolean;
        requireApprovalForNetwork: z.ZodBoolean;
        blockedCommands: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        requireApprovalForShell: boolean;
        requireApprovalForNetwork: boolean;
        blockedCommands?: string[] | undefined;
    }, {
        requireApprovalForShell: boolean;
        requireApprovalForNetwork: boolean;
        blockedCommands?: string[] | undefined;
    }>;
    maxToolIterations: z.ZodDefault<z.ZodNumber>;
    toolTimeout: z.ZodDefault<z.ZodNumber>;
    subAgents: z.ZodOptional<z.ZodArray<z.ZodObject<{
        agentConfigId: z.ZodString;
        name: z.ZodString;
        description: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        agentConfigId: string;
        name: string;
        description: string;
    }, {
        agentConfigId: string;
        name: string;
        description: string;
    }>, "many">>;
    allowTransfer: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    memory: {
        enabled: boolean;
        maxEntries: number;
    };
    llm: {
        provider: "openai" | "anthropic" | "ollama" | "google" | "groq" | "mistral" | "huggingface" | "custom";
        model: string;
        apiKey?: string | undefined;
        baseUrl?: string | undefined;
        temperature?: number | undefined;
        maxTokens?: number | undefined;
    };
    id: string;
    name: string;
    persona: string;
    systemPrompt: string;
    enabledSkills: string[];
    security: {
        requireApprovalForShell: boolean;
        requireApprovalForNetwork: boolean;
        blockedCommands?: string[] | undefined;
    };
    maxToolIterations: number;
    toolTimeout: number;
    subAgents?: {
        agentConfigId: string;
        name: string;
        description: string;
    }[] | undefined;
    allowTransfer?: boolean | undefined;
}, {
    memory: {
        enabled: boolean;
        maxEntries: number;
    };
    llm: {
        provider: "openai" | "anthropic" | "ollama" | "google" | "groq" | "mistral" | "huggingface" | "custom";
        model: string;
        apiKey?: string | undefined;
        baseUrl?: string | undefined;
        temperature?: number | undefined;
        maxTokens?: number | undefined;
    };
    id: string;
    name: string;
    persona: string;
    systemPrompt: string;
    enabledSkills: string[];
    security: {
        requireApprovalForShell: boolean;
        requireApprovalForNetwork: boolean;
        blockedCommands?: string[] | undefined;
    };
    maxToolIterations?: number | undefined;
    toolTimeout?: number | undefined;
    subAgents?: {
        agentConfigId: string;
        name: string;
        description: string;
    }[] | undefined;
    allowTransfer?: boolean | undefined;
}>;
export declare const WorkflowAgentConfigSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    type: z.ZodEnum<["sequential", "parallel", "loop"]>;
    subAgentIds: z.ZodArray<z.ZodString, "many">;
    maxIterations: z.ZodOptional<z.ZodNumber>;
    escalationKey: z.ZodOptional<z.ZodString>;
    initialState: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    type: "sequential" | "parallel" | "loop";
    id: string;
    name: string;
    subAgentIds: string[];
    maxIterations?: number | undefined;
    escalationKey?: string | undefined;
    initialState?: Record<string, unknown> | undefined;
}, {
    type: "sequential" | "parallel" | "loop";
    id: string;
    name: string;
    subAgentIds: string[];
    maxIterations?: number | undefined;
    escalationKey?: string | undefined;
    initialState?: Record<string, unknown> | undefined;
}>;
export declare const A2ATaskSchema: z.ZodObject<{
    id: z.ZodString;
    message: z.ZodString;
    sessionId: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    message: string;
    id: string;
    sessionId?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
}, {
    message: string;
    id: string;
    sessionId?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
}>;
export declare const LoginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export declare const RegisterSchema: z.ZodObject<{
    name: z.ZodString;
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    name: string;
    password: string;
}, {
    email: string;
    name: string;
    password: string;
}>;
//# sourceMappingURL=schemas.d.ts.map