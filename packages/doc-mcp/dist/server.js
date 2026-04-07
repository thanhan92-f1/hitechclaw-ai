// ============================================================
// @hitechclaw/doc-mcp — MCP Server for Dev Documentation
// ============================================================
//
// Exposes developer documentation knowledge base as MCP tools.
// VS Code AI agents (Copilot, Claude, etc.) connect to this
// server to retrieve project documentation, coding conventions,
// architecture decisions, and code examples during development.
//
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { DocStore } from './doc-store.js';
const searchDocsInputSchema = {
    query: z.string().describe('Search query — can be keywords, questions, or topics. Examples: "gateway route pattern", "drizzle schema", "MCP integration", "ESM import convention"'),
    limit: z.number().optional().default(5).describe('Maximum number of results to return (default: 5)'),
};
const getDocInputSchema = {
    id: z.string().describe('Document ID (path without extension). Example: "conventions/typescript", "architecture/overview"'),
};
const listDocsInputSchema = {
    category: z.string().optional().describe('Category name to filter by. Omit to list all documents. Example: "conventions", "architecture"'),
};
export function createDocMcpServer(options) {
    const { docsRoot, name = 'hitechclaw-dev-docs', version = '1.0.0', } = options;
    const store = new DocStore(docsRoot);
    store.loadAll();
    const server = new McpServer({ name, version });
    const registerTool = server.registerTool.bind(server);
    // ─── Tool: search_docs ──────────────────────────────────
    registerTool('search_docs', {
        description: 'Search the HiTechClaw developer documentation knowledge base. Use this to find coding conventions, architecture patterns, API documentation, code examples, and troubleshooting guides. Returns matched documents with relevance scores and snippets.',
        inputSchema: searchDocsInputSchema,
    }, async ({ query, limit }) => {
        store.loadAll(); // Reload to pick up any changes
        const results = store.search(query, limit);
        if (results.length === 0) {
            return {
                content: [{
                        type: 'text',
                        text: `No documentation found for "${query}". Try different keywords or use list_doc_categories to browse available topics.`,
                    }],
            };
        }
        const formatted = results.map((r, i) => [
            `## ${i + 1}. ${r.doc.title}`,
            `**Category:** ${r.doc.category} | **Score:** ${r.score} | **Tags:** ${r.doc.tags.join(', ') || 'none'}`,
            `**Path:** ${r.doc.filePath}`,
            '',
            r.snippet,
            '',
        ].join('\n')).join('\n---\n\n');
        return {
            content: [{
                    type: 'text',
                    text: `Found ${results.length} document(s) for "${query}":\n\n${formatted}`,
                }],
        };
    });
    // ─── Tool: get_doc ──────────────────────────────────────
    registerTool('get_doc', {
        description: 'Retrieve the full content of a specific documentation page by its ID or path. Use after search_docs to get complete documentation.',
        inputSchema: getDocInputSchema,
    }, async ({ id }) => {
        store.loadAll();
        const doc = store.getDoc(id);
        if (!doc) {
            return {
                content: [{
                        type: 'text',
                        text: `Document "${id}" not found. Use search_docs or list_doc_categories to find available documents.`,
                    }],
            };
        }
        return {
            content: [{
                    type: 'text',
                    text: [
                        `# ${doc.title}`,
                        `> Category: ${doc.category} | Tags: ${doc.tags.join(', ') || 'none'} | Words: ${doc.wordCount}`,
                        '',
                        doc.content,
                    ].join('\n'),
                }],
        };
    });
    // ─── Tool: list_doc_categories ──────────────────────────
    registerTool('list_doc_categories', {
        description: 'List all documentation categories and their document counts. Use this to discover what documentation is available before searching.',
    }, async () => {
        store.loadAll();
        const stats = store.getStats();
        const categories = store.listCategories();
        const catList = categories.map(cat => {
            const docs = store.listDocs(cat);
            return `- **${cat}/** (${docs.length} docs): ${docs.map(d => d.title).join(', ')}`;
        }).join('\n');
        return {
            content: [{
                    type: 'text',
                    text: [
                        `# HiTechClaw Dev Documentation`,
                        `Total: ${stats.totalDocs} documents | ${stats.totalWords.toLocaleString()} words`,
                        `Tags: ${stats.tags.join(', ') || 'none'}`,
                        '',
                        '## Categories',
                        catList,
                    ].join('\n'),
                }],
        };
    });
    // ─── Tool: list_docs ────────────────────────────────────
    registerTool('list_docs', {
        description: 'List all documents in a specific category. Returns titles, IDs, and tags for each document.',
        inputSchema: listDocsInputSchema,
    }, async ({ category }) => {
        store.loadAll();
        const docs = store.listDocs(category);
        if (docs.length === 0) {
            return {
                content: [{
                        type: 'text',
                        text: category
                            ? `No documents in category "${category}". Use list_doc_categories to see available categories.`
                            : 'No documents in the knowledge base. Add Markdown files to the dev-docs directory.',
                    }],
            };
        }
        const list = docs.map(d => `- **${d.title}** (id: \`${d.id}\`) — ${d.category} | ${d.wordCount} words${d.tags.length ? ' | tags: ' + d.tags.join(', ') : ''}`).join('\n');
        return {
            content: [{
                    type: 'text',
                    text: `${docs.length} document(s)${category ? ` in "${category}"` : ''}:\n\n${list}`,
                }],
        };
    });
    // ─── Resource: docs-overview ────────────────────────────
    server.resource('docs-overview', 'docs://overview', { description: 'Overview of all available developer documentation', mimeType: 'text/markdown' }, async () => {
        store.loadAll();
        const stats = store.getStats();
        const categories = store.listCategories();
        const overview = [
            '# HiTechClaw Developer Documentation Knowledge Base',
            '',
            `Total documents: ${stats.totalDocs}`,
            `Categories: ${categories.join(', ')}`,
            `Tags: ${stats.tags.join(', ') || 'none'}`,
            '',
            '## How to Use',
            '- **search_docs**: Search by keywords or questions',
            '- **get_doc**: Read full documentation by ID',
            '- **list_doc_categories**: Browse categories',
            '- **list_docs**: List docs in a category',
            '',
            '## Categories',
            ...categories.map(cat => {
                const docs = store.listDocs(cat);
                return `\n### ${cat}\n` + docs.map(d => `- ${d.title} (\`${d.id}\`)`).join('\n');
            }),
        ].join('\n');
        return {
            contents: [{
                    uri: 'docs://overview',
                    text: overview,
                    mimeType: 'text/markdown',
                }],
        };
    });
    return server;
}
//# sourceMappingURL=server.js.map