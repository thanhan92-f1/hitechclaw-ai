// ============================================================
// @hitechclaw/doc-mcp — Document Store & Indexing Engine
// ============================================================
//
// File-based documentation knowledge base with full-text search.
// Reads Markdown files from a configurable docs directory,
// indexes them in memory for fast search, and supports
// category-based browsing.
//

import { readFileSync, readdirSync, statSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative, basename, extname, dirname } from 'node:path';

// ─── Types ──────────────────────────────────────────────────

export interface DocEntry {
    /** Unique ID derived from relative path */
    id: string;
    /** Document title (from first # heading or filename) */
    title: string;
    /** Category/folder path */
    category: string;
    /** Tags extracted from frontmatter or filename */
    tags: string[];
    /** Full content */
    content: string;
    /** Relative file path from docs root */
    filePath: string;
    /** Last modified timestamp */
    updatedAt: string;
    /** Word count */
    wordCount: number;
    /** Semantic version */
    version: string;
}

export interface DocVersion {
    version: string;
    updatedAt: string;
    wordCount: number;
    title: string;
}

export interface SearchResult {
    doc: DocEntry;
    /** Relevance score (higher = more relevant) */
    score: number;
    /** Matched snippet with context */
    snippet: string;
}

export interface DocStoreStats {
    totalDocs: number;
    categories: string[];
    tags: string[];
    totalWords: number;
}

// ─── Helpers ────────────────────────────────────────────────

function extractTitle(content: string, filePath: string): string {
    const headingMatch = content.match(/^#\s+(.+)$/m);
    if (headingMatch) return headingMatch[1].trim();
    return basename(filePath, extname(filePath))
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}

function extractFrontmatterTags(content: string): string[] {
    const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!fmMatch) return [];
    const tagsLine = fmMatch[1].match(/^tags:\s*\[?(.*?)\]?\s*$/m);
    if (!tagsLine) return [];
    return tagsLine[1].split(',').map(t => t.trim().replace(/['"]/g, '')).filter(Boolean);
}

function extractFrontmatterVersion(content: string): string {
    const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!fmMatch) return '1.0.0';
    const versionLine = fmMatch[1].match(/^version:\s*(.+)$/m);
    if (!versionLine) return '1.0.0';
    return versionLine[1].trim().replace(/["']/g, '');
}

function bumpVersion(version: string, type: 'major' | 'minor' | 'patch' = 'patch'): string {
    const parts = version.split('.').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return '1.0.1';
    if (type === 'major') return `${parts[0] + 1}.0.0`;
    if (type === 'minor') return `${parts[0]}.${parts[1] + 1}.0`;
    return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
}

function extractSnippet(content: string, query: string, contextChars = 200): string {
    const lower = content.toLowerCase();
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

    // Find the best position where most terms cluster
    let bestPos = 0;
    let bestScore = 0;
    for (let i = 0; i < lower.length; i += 50) {
        const window = lower.substring(i, i + contextChars);
        const score = terms.reduce((s, t) => s + (window.includes(t) ? 1 : 0), 0);
        if (score > bestScore) {
            bestScore = score;
            bestPos = i;
        }
    }

    const start = Math.max(0, bestPos - 50);
    const end = Math.min(content.length, bestPos + contextChars);
    let snippet = content.substring(start, end).trim();
    if (start > 0) snippet = '...' + snippet;
    if (end < content.length) snippet = snippet + '...';
    return snippet;
}

// ─── DocStore ───────────────────────────────────────────────

export class DocStore {
    private docs: Map<string, DocEntry> = new Map();
    private docsRoot: string;

    constructor(docsRoot: string) {
        this.docsRoot = docsRoot;
        if (!existsSync(docsRoot)) {
            mkdirSync(docsRoot, { recursive: true });
        }
    }

    /** Load/reload all docs from the file system */
    loadAll(): void {
        this.docs.clear();
        this.indexDirectory(this.docsRoot);
    }

    private indexDirectory(dir: string): void {
        if (!existsSync(dir)) return;
        const entries = readdirSync(dir);
        for (const entry of entries) {
            const fullPath = join(dir, entry);
            const stat = statSync(fullPath);
            if (stat.isDirectory()) {
                this.indexDirectory(fullPath);
            } else if (entry.endsWith('.md') || entry.endsWith('.mdx')) {
                this.indexFile(fullPath);
            }
        }
    }

    private indexFile(filePath: string): void {
        const content = readFileSync(filePath, 'utf-8');
        const relPath = relative(this.docsRoot, filePath);
        const id = relPath.replace(/\\/g, '/').replace(/\.mdx?$/, '');
        const category = dirname(relPath).replace(/\\/g, '/');
        const tags = extractFrontmatterTags(content);
        const title = extractTitle(content, filePath);
        const wordCount = content.split(/\s+/).filter(Boolean).length;

        const version = extractFrontmatterVersion(content);

        this.docs.set(id, {
            id,
            title,
            category: category === '.' ? 'root' : category,
            tags,
            content,
            filePath: relPath,
            updatedAt: new Date().toISOString(),
            wordCount,
            version,
        });
    }

    /** Full-text search across all documents */
    search(query: string, limit = 10): SearchResult[] {
        const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
        if (terms.length === 0) return [];

        const results: SearchResult[] = [];

        for (const doc of this.docs.values()) {
            const lower = (doc.title + '\n' + doc.content + '\n' + doc.tags.join(' ')).toLowerCase();
            let score = 0;

            for (const term of terms) {
                // Title match (high weight)
                if (doc.title.toLowerCase().includes(term)) score += 10;
                // Tag match (medium weight)
                if (doc.tags.some(t => t.toLowerCase().includes(term))) score += 5;
                // Category match
                if (doc.category.toLowerCase().includes(term)) score += 3;
                // Content match (count occurrences, capped)
                const contentLower = doc.content.toLowerCase();
                let idx = 0;
                let count = 0;
                while ((idx = contentLower.indexOf(term, idx)) !== -1 && count < 20) {
                    count++;
                    idx += term.length;
                }
                score += Math.min(count, 10);
            }

            if (score > 0) {
                results.push({
                    doc,
                    score,
                    snippet: extractSnippet(doc.content, query),
                });
            }
        }

        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }

    /** Get a document by ID */
    getDoc(id: string): DocEntry | undefined {
        return this.docs.get(id);
    }

    /** List all documents, optionally filtered by category */
    listDocs(category?: string): DocEntry[] {
        const all = Array.from(this.docs.values());
        if (!category) return all;
        return all.filter(d => d.category === category || d.category.startsWith(category + '/'));
    }

    /** List all categories */
    listCategories(): string[] {
        const cats = new Set<string>();
        for (const doc of this.docs.values()) {
            cats.add(doc.category);
        }
        return Array.from(cats).sort();
    }

    /** Get statistics */
    getStats(): DocStoreStats {
        const allTags = new Set<string>();
        let totalWords = 0;
        for (const doc of this.docs.values()) {
            doc.tags.forEach(t => allTags.add(t));
            totalWords += doc.wordCount;
        }
        return {
            totalDocs: this.docs.size,
            categories: this.listCategories(),
            tags: Array.from(allTags).sort(),
            totalWords,
        };
    }

    /** Add or update a document, optionally saving a version snapshot */
    upsertDoc(relPath: string, content: string, saveVersion = true): DocEntry {
        const fullPath = join(this.docsRoot, relPath);
        const dir = dirname(fullPath);
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }

        // Save version snapshot before overwriting (if file exists)
        if (saveVersion && existsSync(fullPath)) {
            const oldContent = readFileSync(fullPath, 'utf-8');
            const oldVersion = extractFrontmatterVersion(oldContent);
            const versionsDir = join(this.docsRoot, '.versions', relPath.replace(/\.mdx?$/, ''));
            if (!existsSync(versionsDir)) mkdirSync(versionsDir, { recursive: true });
            writeFileSync(join(versionsDir, `v${oldVersion}.md`), oldContent, 'utf-8');
        }

        writeFileSync(fullPath, content, 'utf-8');
        this.indexFile(fullPath);
        const id = relPath.replace(/\\/g, '/').replace(/\.mdx?$/, '');
        return this.docs.get(id)!;
    }

    /** Get version history for a document */
    getVersionHistory(id: string): DocVersion[] {
        const doc = this.docs.get(id);
        if (!doc) return [];
        const versionsDir = join(this.docsRoot, '.versions', id);
        if (!existsSync(versionsDir)) {
            return [{ version: doc.version, updatedAt: doc.updatedAt, wordCount: doc.wordCount, title: doc.title }];
        }
        const files = readdirSync(versionsDir).filter(f => f.startsWith('v') && f.endsWith('.md')).sort();
        const history: DocVersion[] = files.map(f => {
            const content = readFileSync(join(versionsDir, f), 'utf-8');
            const version = f.replace(/^v/, '').replace(/\.md$/, '');
            const title = extractTitle(content, f);
            const wordCount = content.split(/\s+/).filter(Boolean).length;
            const stat = statSync(join(versionsDir, f));
            return { version, updatedAt: stat.mtime.toISOString(), wordCount, title };
        });
        // Add current version
        history.push({ version: doc.version, updatedAt: doc.updatedAt, wordCount: doc.wordCount, title: doc.title });
        return history;
    }

    /** Get content of a specific version */
    getVersionContent(id: string, version: string): string | null {
        const doc = this.docs.get(id);
        if (!doc) return null;
        if (doc.version === version) return doc.content;
        const versionFile = join(this.docsRoot, '.versions', id, `v${version}.md`);
        if (!existsSync(versionFile)) return null;
        return readFileSync(versionFile, 'utf-8');
    }

    get docsPath(): string {
        return this.docsRoot;
    }
}
