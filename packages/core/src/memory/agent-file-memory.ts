// ============================================================
// AgentFileMemory — File-based per-agent MEMORY.md
// Inspired by claude-code memdir/ + agentMemory.ts pattern
//
// Maintains a MEMORY.md file per agent type in one of three scopes:
//   user    → ~/.hitechclaw/agent-memory/<agentType>/MEMORY.md
//   project → <cwd>/.hitechclaw/agent-memory/<agentType>/MEMORY.md
//   session → in-memory only (not persisted to disk)
// ============================================================

import type { AgentMemoryScope } from '@hitechclaw/shared';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, normalize } from 'node:path';

export const AGENT_MEMORY_FILENAME = 'MEMORY.md';
/** Max lines to load from MEMORY.md (prevents unbounded context growth) */
export const MAX_MEMORY_LINES = 200;
/** Max bytes to load from MEMORY.md */
export const MAX_MEMORY_BYTES = 25_000;

export interface MemoryTruncationInfo {
  content: string;
  lineCount: number;
  byteCount: number;
  wasTruncated: boolean;
}

/**
 * Sanitize an agent type name for use as a safe directory name.
 * Replaces colons (plugin-namespaced types like "my-plugin:my-agent") with dashes.
 * Strips any path traversal characters.
 */
function sanitizeAgentTypeForPath(agentType: string): string {
  return agentType
    .replace(/:/g, '-')
    .replace(/[/\\..]/g, '_')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 64);
}

/**
 * Resolve the MEMORY.md path for an agent given its type and scope.
 */
export function resolveAgentMemoryPath(
  agentType: string,
  scope: AgentMemoryScope,
  projectRoot?: string,
): string {
  const safeName = sanitizeAgentTypeForPath(agentType);

  if (scope === 'user') {
    return join(homedir(), '.hitechclaw', 'agent-memory', safeName, AGENT_MEMORY_FILENAME);
  }
  if (scope === 'project') {
    const base = projectRoot ?? process.cwd();
    return join(base, '.hitechclaw', 'agent-memory', safeName, AGENT_MEMORY_FILENAME);
  }
  // session scope — in-memory only, this path is never written to disk
  return join('/tmp', 'hitechclaw-session-memory', safeName, AGENT_MEMORY_FILENAME);
}

/**
 * Truncate memory content to line and byte caps.
 * Line-truncates first (natural boundary), then byte-truncates.
 */
export function truncateMemoryContent(raw: string): MemoryTruncationInfo {
  const trimmed = raw.trim();
  const lines = trimmed.split('\n');
  let content = trimmed;
  let wasTruncated = false;

  if (lines.length > MAX_MEMORY_LINES) {
    content = lines.slice(0, MAX_MEMORY_LINES).join('\n');
    wasTruncated = true;
  }

  if (content.length > MAX_MEMORY_BYTES) {
    // Byte-truncate at last newline before cap
    const sliced = content.slice(0, MAX_MEMORY_BYTES);
    const lastNl = sliced.lastIndexOf('\n');
    content = lastNl > 0 ? sliced.slice(0, lastNl) : sliced;
    wasTruncated = true;
  }

  return {
    content,
    lineCount: content.split('\n').length,
    byteCount: content.length,
    wasTruncated,
  };
}

/**
 * AgentFileMemory — reads and writes a MEMORY.md file for an agent.
 *
 * Usage:
 *   const mem = new AgentFileMemory('researcher', 'project');
 *   const content = await mem.load();  // inject into system prompt
 *   await mem.append('- Learned: user prefers TypeScript');
 */
export class AgentFileMemory {
  private readonly filePath: string;
  private readonly scope: AgentMemoryScope;
  /** In-memory store for session scope */
  private sessionContent = '';

  constructor(
    agentType: string,
    scope: AgentMemoryScope = 'project',
    projectRoot?: string,
  ) {
    this.scope = scope;
    this.filePath = resolveAgentMemoryPath(agentType, scope, projectRoot);
  }

  getPath(): string {
    return this.filePath;
  }

  /**
   * Load the MEMORY.md content, truncated to safe limits.
   * Returns empty string if file doesn't exist.
   */
  async load(): Promise<string> {
    if (this.scope === 'session') {
      return this.sessionContent;
    }

    try {
      const raw = await readFile(this.filePath, 'utf-8');
      const { content, wasTruncated } = truncateMemoryContent(raw);
      if (wasTruncated) {
        return content + '\n\n_[Memory truncated to fit context window]_';
      }
      return content;
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return '';
      }
      throw err;
    }
  }

  /**
   * Overwrite the MEMORY.md with new content.
   */
  async save(content: string): Promise<void> {
    if (this.scope === 'session') {
      this.sessionContent = content;
      return;
    }

    const dir = normalize(this.filePath).replace(/[^/\\]*$/, '');
    await mkdir(dir, { recursive: true });
    await writeFile(this.filePath, content, 'utf-8');
  }

  /**
   * Append a new entry to MEMORY.md.
   * Automatically prefixes with a timestamp.
   */
  async append(entry: string): Promise<void> {
    const current = await this.load();
    const timestamp = new Date().toISOString().slice(0, 10);
    const line = `\n- [${timestamp}] ${entry.trim()}`;
    await this.save(current + line);
  }

  /**
   * Build a system prompt fragment injecting memory context.
   * Returns empty string if memory is empty.
   */
  async buildPromptFragment(): Promise<string> {
    const content = await this.load();
    if (!content.trim()) {
      return '';
    }
    return `## Agent Memory\nThe following notes were saved from previous sessions:\n\n${content}`;
  }

  /**
   * Clear all stored memory.
   */
  async clear(): Promise<void> {
    if (this.scope === 'session') {
      this.sessionContent = '';
      return;
    }
    await this.save('');
  }
}
