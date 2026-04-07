// ============================================================
// Gateway: /api/dev-docs — Developer Documentation CRUD
// ============================================================

import { Hono } from 'hono';
import { DocStore } from '@hitechclaw/doc-mcp';
import type { DocEntry, DocVersion } from '@hitechclaw/doc-mcp';
import { resolve } from 'node:path';

export function createDevDocsRoutes() {
    const app = new Hono();
    const docsRoot = resolve(process.env['DOCS_ROOT'] || './data/dev-docs');
    const store = new DocStore(docsRoot);

    // ─── LIST categories ────────────────────────────────────
    app.get('/categories', async (c) => {
        try {
            store.loadAll();
            const categories = store.listCategories();
            const result = categories.map(cat => {
                const docs = store.listDocs(cat);
                return { name: cat, docCount: docs.length };
            });
            return c.json({ ok: true, categories: result });
        } catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });

    // ─── LIST documents ─────────────────────────────────────
    app.get('/', async (c) => {
        try {
            store.loadAll();
            const category = c.req.query('category');
            const search = c.req.query('search');

            let docs: DocEntry[];
            if (search) {
                const results = store.search(search, 50);
                docs = results.map(r => r.doc);
            } else {
                docs = store.listDocs(category ?? undefined);
            }

            const stats = store.getStats();
            return c.json({
                ok: true,
                documents: docs.map(d => ({
                    id: d.id,
                    title: d.title,
                    category: d.category,
                    tags: d.tags,
                    filePath: d.filePath,
                    wordCount: d.wordCount,
                    updatedAt: d.updatedAt,
                    version: d.version,
                })),
                stats,
            });
        } catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });

    // ─── GET document by ID ─────────────────────────────────
    app.get('/doc/:id{.+}', async (c) => {
        try {
            store.loadAll();
            const id = c.req.param('id');
            const doc = store.getDoc(id);
            if (!doc) return c.json({ error: 'Document not found' }, 404);
            return c.json({ ok: true, document: doc });
        } catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });

    // ─── CREATE / UPDATE document ───────────────────────────
    app.post('/', async (c) => {
        try {
            const body = await c.req.json<{
                path: string;
                title: string;
                content: string;
                tags?: string[];
                category?: string;
                version?: string;
            }>();

            if (!body.path || !body.title || !body.content) {
                return c.json({ error: 'path, title, and content are required' }, 400);
            }

            // Validate path to prevent directory traversal
            const normalized = body.path.replace(/\\/g, '/');
            if (normalized.includes('..') || normalized.startsWith('/')) {
                return c.json({ error: 'Invalid path' }, 400);
            }

            const relPath = normalized.endsWith('.md') ? normalized : `${normalized}.md`;

            // Build content with frontmatter
            const tags = body.tags ?? [];
            const version = body.version ?? '1.0.0';
            const fullContent = [
                '---',
                `tags: [${tags.join(', ')}]`,
                `version: ${version}`,
                '---',
                '',
                `# ${body.title}`,
                '',
                body.content,
            ].join('\n');

            const doc = store.upsertDoc(relPath, fullContent, false);
            return c.json({ ok: true, document: { id: doc.id, title: doc.title, category: doc.category, version: doc.version } }, 201);
        } catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });

    // ─── UPDATE document content ────────────────────────────
    app.put('/doc/:id{.+}', async (c) => {
        try {
            store.loadAll();
            const id = c.req.param('id');
            const existing = store.getDoc(id);
            if (!existing) return c.json({ error: 'Document not found' }, 404);

            const body = await c.req.json<{
                content: string;
                title?: string;
                tags?: string[];
                versionBump?: 'major' | 'minor' | 'patch';
            }>();

            if (!body.content) {
                return c.json({ error: 'content is required' }, 400);
            }

            const tags = body.tags ?? existing.tags;
            const title = body.title ?? existing.title;
            // Bump version based on bump type (default: patch)
            const bumpType = body.versionBump ?? 'patch';
            const oldVersion = existing.version;
            const parts = oldVersion.split('.').map(Number);
            let newVersion: string;
            if (parts.length !== 3 || parts.some(isNaN)) {
                newVersion = '1.0.1';
            } else if (bumpType === 'major') {
                newVersion = `${parts[0] + 1}.0.0`;
            } else if (bumpType === 'minor') {
                newVersion = `${parts[0]}.${parts[1] + 1}.0`;
            } else {
                newVersion = `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
            }
            const fullContent = [
                '---',
                `tags: [${tags.join(', ')}]`,
                `version: ${newVersion}`,
                '---',
                '',
                `# ${title}`,
                '',
                body.content,
            ].join('\n');

            const doc = store.upsertDoc(existing.filePath, fullContent);
            return c.json({ ok: true, document: { id: doc.id, title: doc.title, category: doc.category, version: doc.version } });
        } catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });

    // ─── DELETE document ────────────────────────────────────
    app.delete('/doc/:id{.+}', async (c) => {
        try {
            store.loadAll();
            const id = c.req.param('id');
            const doc = store.getDoc(id);
            if (!doc) return c.json({ error: 'Document not found' }, 404);

            const { unlinkSync } = await import('node:fs');
            const fullPath = resolve(docsRoot, doc.filePath);
            unlinkSync(fullPath);

            return c.json({ ok: true });
        } catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });

    // ─── VERSION HISTORY ─────────────────────────────────────
    app.get('/versions/:id{.+}', async (c) => {
        try {
            store.loadAll();
            const id = c.req.param('id');
            const doc = store.getDoc(id);
            if (!doc) return c.json({ error: 'Document not found' }, 404);
            const history = store.getVersionHistory(id);
            return c.json({ ok: true, versions: history, currentVersion: doc.version });
        } catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });

    // ─── GET VERSION CONTENT ────────────────────────────────
    app.get('/version-content/:id{.+}', async (c) => {
        try {
            store.loadAll();
            const id = c.req.param('id');
            const version = c.req.query('v');
            if (!version) return c.json({ error: 'version query param (v) is required' }, 400);
            const content = store.getVersionContent(id, version);
            if (content === null) return c.json({ error: 'Version not found' }, 404);
            return c.json({ ok: true, content, version });
        } catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });

    // ─── SEARCH documents ───────────────────────────────────
    app.post('/search', async (c) => {
        try {
            store.loadAll();
            const body = await c.req.json<{ query: string; limit?: number }>();
            if (!body.query) return c.json({ error: 'query is required' }, 400);

            const results = store.search(body.query, body.limit ?? 10);
            return c.json({
                ok: true,
                results: results.map(r => ({
                    id: r.doc.id,
                    title: r.doc.title,
                    category: r.doc.category,
                    tags: r.doc.tags,
                    score: r.score,
                    snippet: r.snippet,
                    wordCount: r.doc.wordCount,
                })),
            });
        } catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });

    // ─── STATS ──────────────────────────────────────────────
    app.get('/stats', async (c) => {
        try {
            store.loadAll();
            return c.json({ ok: true, stats: store.getStats() });
        } catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });

    return app;
}
