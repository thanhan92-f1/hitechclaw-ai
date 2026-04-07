import type { AgentMemoryScope } from '@hitechclaw/shared';
export declare const AGENT_MEMORY_FILENAME = "MEMORY.md";
/** Max lines to load from MEMORY.md (prevents unbounded context growth) */
export declare const MAX_MEMORY_LINES = 200;
/** Max bytes to load from MEMORY.md */
export declare const MAX_MEMORY_BYTES = 25000;
export interface MemoryTruncationInfo {
    content: string;
    lineCount: number;
    byteCount: number;
    wasTruncated: boolean;
}
/**
 * Resolve the MEMORY.md path for an agent given its type and scope.
 */
export declare function resolveAgentMemoryPath(agentType: string, scope: AgentMemoryScope, projectRoot?: string): string;
/**
 * Truncate memory content to line and byte caps.
 * Line-truncates first (natural boundary), then byte-truncates.
 */
export declare function truncateMemoryContent(raw: string): MemoryTruncationInfo;
/**
 * AgentFileMemory — reads and writes a MEMORY.md file for an agent.
 *
 * Usage:
 *   const mem = new AgentFileMemory('researcher', 'project');
 *   const content = await mem.load();  // inject into system prompt
 *   await mem.append('- Learned: user prefers TypeScript');
 */
export declare class AgentFileMemory {
    private readonly filePath;
    private readonly scope;
    /** In-memory store for session scope */
    private sessionContent;
    constructor(agentType: string, scope?: AgentMemoryScope, projectRoot?: string);
    getPath(): string;
    /**
     * Load the MEMORY.md content, truncated to safe limits.
     * Returns empty string if file doesn't exist.
     */
    load(): Promise<string>;
    /**
     * Overwrite the MEMORY.md with new content.
     */
    save(content: string): Promise<void>;
    /**
     * Append a new entry to MEMORY.md.
     * Automatically prefixes with a timestamp.
     */
    append(entry: string): Promise<void>;
    /**
     * Build a system prompt fragment injecting memory context.
     * Returns empty string if memory is empty.
     */
    buildPromptFragment(): Promise<string>;
    /**
     * Clear all stored memory.
     */
    clear(): Promise<void>;
}
//# sourceMappingURL=agent-file-memory.d.ts.map