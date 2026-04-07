var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function () { return this; }, i;
    function awaitReturn(f) { return function (v) { return Promise.resolve(v).then(f, reject); }; }
    function verb(n, f) { if (g[n]) { i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; if (f) i[n] = f(i[n]); } }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
import { randomUUID } from 'node:crypto';
import { DocumentProcessor } from './document-processor.js';
import { LocalEmbeddingProvider } from './embedding-provider.js';
import { InMemoryVectorStore } from './vector-store.js';
import { WebCrawler } from './web-crawler.js';
import { CrossEncoderReranker } from './reranker.js';
// ─── RAG Engine ─────────────────────────────────────────────
export class RagEngine {
    constructor(embeddings, vectorStore, config) {
        var _a, _b, _c;
        this.documents = new Map();
        this.documentMeta = new Map();
        this.collections = new Map();
        this.queryHistory = [];
        this.reranker = new CrossEncoderReranker();
        this.processor = new DocumentProcessor();
        this.embeddings = embeddings !== null && embeddings !== void 0 ? embeddings : new LocalEmbeddingProvider();
        this.vectorStore = vectorStore !== null && vectorStore !== void 0 ? vectorStore : new InMemoryVectorStore();
        this.config = {
            chunkingOptions: (_a = config === null || config === void 0 ? void 0 : config.chunkingOptions) !== null && _a !== void 0 ? _a : { chunkSize: 512, chunkOverlap: 50, separator: '\n\n' },
            topK: (_b = config === null || config === void 0 ? void 0 : config.topK) !== null && _b !== void 0 ? _b : 5,
            scoreThreshold: (_c = config === null || config === void 0 ? void 0 : config.scoreThreshold) !== null && _c !== void 0 ? _c : 0.1,
        };
        const defaultCol = {
            id: 'default',
            name: 'General',
            description: 'Default knowledge collection',
            color: '#6366f1',
            documentCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        this.collections.set('default', defaultCol);
    }
    // ─── Collections ────────────────────────────────────────
    createCollection(name, description, color, tenantId) {
        const col = {
            id: randomUUID(),
            name,
            description: description !== null && description !== void 0 ? description : '',
            color: color !== null && color !== void 0 ? color : '#6366f1',
            documentCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            tenantId,
        };
        this.collections.set(col.id, col);
        return col;
    }
    updateCollection(id, updates) {
        const col = this.collections.get(id);
        if (!col)
            return null;
        if (updates.name !== undefined)
            col.name = updates.name;
        if (updates.description !== undefined)
            col.description = updates.description;
        if (updates.color !== undefined)
            col.color = updates.color;
        col.updatedAt = new Date().toISOString();
        return col;
    }
    deleteCollection(id) {
        if (id === 'default')
            return false;
        for (const [, meta] of this.documentMeta) {
            if (meta.collectionId === id)
                meta.collectionId = 'default';
        }
        this.collections.delete(id);
        this.refreshCollectionCounts();
        return true;
    }
    listCollections(tenantId) {
        this.refreshCollectionCounts();
        const all = Array.from(this.collections.values());
        if (!tenantId)
            return all;
        return all.filter((c) => !c.tenantId || c.tenantId === tenantId);
    }
    getCollection(id) {
        return this.collections.get(id);
    }
    refreshCollectionCounts() {
        var _a;
        for (const col of this.collections.values())
            col.documentCount = 0;
        for (const meta of this.documentMeta.values()) {
            const col = this.collections.get((_a = meta.collectionId) !== null && _a !== void 0 ? _a : 'default');
            if (col)
                col.documentCount++;
        }
    }
    // ─── Document Ingestion ─────────────────────────────────
    async ingestText(text, title, source, options) {
        var _a, _b, _c, _d;
        const chunkOpts = (_a = options === null || options === void 0 ? void 0 : options.chunkingOptions) !== null && _a !== void 0 ? _a : this.config.chunkingOptions;
        const meta = {
            enabled: true,
            tags: (_b = options === null || options === void 0 ? void 0 : options.tags) !== null && _b !== void 0 ? _b : [],
            collectionId: (_c = options === null || options === void 0 ? void 0 : options.collectionId) !== null && _c !== void 0 ? _c : 'default',
            customMetadata: (_d = options === null || options === void 0 ? void 0 : options.customMetadata) !== null && _d !== void 0 ? _d : {},
            chunkingOptions: chunkOpts,
            processingStatus: 'processing',
            wordCount: text.split(/\s+/).length,
            charCount: text.length,
            tenantId: options === null || options === void 0 ? void 0 : options.tenantId,
        };
        const doc = this.processor.processText(text, title, source !== null && source !== void 0 ? source : 'upload', chunkOpts);
        this.documents.set(doc.id, doc);
        this.documentMeta.set(doc.id, meta);
        try {
            const chunkTexts = doc.chunks.map((c) => c.content);
            if (chunkTexts.length > 0) {
                const embeddings = await this.embeddings.embed(chunkTexts);
                for (let i = 0; i < doc.chunks.length; i++) {
                    doc.chunks[i].embedding = embeddings[i];
                }
            }
            await this.vectorStore.add(doc.chunks);
            meta.processingStatus = 'completed';
        }
        catch (err) {
            meta.processingStatus = 'error';
            meta.processingError = err instanceof Error ? err.message : String(err);
        }
        this.refreshCollectionCounts();
        return doc;
    }
    async ingestUrl(url, title, options) {
        var _a;
        const res = await fetch(url);
        if (!res.ok)
            throw new Error(`Failed to fetch URL: ${res.status} ${res.statusText}`);
        const html = await res.text();
        const text = this.htmlToText(html);
        const pageTitle = (_a = title !== null && title !== void 0 ? title : this.extractTitle(html)) !== null && _a !== void 0 ? _a : new URL(url).hostname;
        return this.ingestText(text, pageTitle, url, Object.assign(Object.assign({}, options), { customMetadata: Object.assign(Object.assign({}, options === null || options === void 0 ? void 0 : options.customMetadata), { sourceUrl: url, importType: 'web' }) }));
    }
    htmlToText(html) {
        const text = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
            .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
            .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
            .replace(/<[^>]+>/g, '\n')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\n{3,}/g, '\n\n')
            .trim();
        return text.split('\n').filter((l) => l.trim().length > 2).join('\n');
    }
    extractTitle(html) {
        const match = html.match(/<title[^>]*>(.*?)<\/title>/i);
        return match ? match[1].trim() : null;
    }
    // ─── Document Management ────────────────────────────────
    async reindexDocument(documentId, newChunkingOptions) {
        const doc = this.documents.get(documentId);
        const meta = this.documentMeta.get(documentId);
        if (!doc || !meta)
            return null;
        await this.vectorStore.remove(documentId);
        const chunkOpts = newChunkingOptions !== null && newChunkingOptions !== void 0 ? newChunkingOptions : meta.chunkingOptions;
        meta.chunkingOptions = chunkOpts;
        meta.processingStatus = 'processing';
        doc.chunks = this.processor.chunkText(doc.content, doc.id, doc.title, doc.source, chunkOpts);
        doc.updatedAt = new Date().toISOString();
        doc.metadata = Object.assign(Object.assign({}, doc.metadata), { charCount: doc.content.length, chunkCount: doc.chunks.length });
        try {
            const chunkTexts = doc.chunks.map((c) => c.content);
            if (chunkTexts.length > 0) {
                const embeddings = await this.embeddings.embed(chunkTexts);
                for (let i = 0; i < doc.chunks.length; i++) {
                    doc.chunks[i].embedding = embeddings[i];
                }
            }
            await this.vectorStore.add(doc.chunks);
            meta.processingStatus = 'completed';
        }
        catch (err) {
            meta.processingStatus = 'error';
            meta.processingError = err instanceof Error ? err.message : String(err);
        }
        return doc;
    }
    setDocumentEnabled(documentId, enabled) {
        const meta = this.documentMeta.get(documentId);
        if (!meta)
            return false;
        meta.enabled = enabled;
        return true;
    }
    updateDocumentMeta(documentId, updates) {
        const doc = this.documents.get(documentId);
        const meta = this.documentMeta.get(documentId);
        if (!doc || !meta)
            return false;
        if (updates.title !== undefined)
            doc.title = updates.title;
        if (updates.tags !== undefined)
            meta.tags = updates.tags;
        if (updates.collectionId !== undefined)
            meta.collectionId = updates.collectionId;
        if (updates.customMetadata !== undefined)
            meta.customMetadata = Object.assign(Object.assign({}, meta.customMetadata), updates.customMetadata);
        doc.updatedAt = new Date().toISOString();
        this.refreshCollectionCounts();
        return true;
    }
    // ─── Chunk Management ───────────────────────────────────
    getDocumentChunks(documentId) {
        const doc = this.documents.get(documentId);
        return doc ? doc.chunks.map((c) => (Object.assign(Object.assign({}, c), { embedding: undefined }))) : null;
    }
    async updateChunk(documentId, chunkId, content) {
        const doc = this.documents.get(documentId);
        if (!doc)
            return false;
        const chunk = doc.chunks.find((c) => c.id === chunkId);
        if (!chunk)
            return false;
        chunk.content = content;
        try {
            const [embedding] = await this.embeddings.embed([content]);
            chunk.embedding = embedding;
            await this.vectorStore.remove(documentId);
            await this.vectorStore.add(doc.chunks);
        }
        catch ( /* non-fatal */_a) { /* non-fatal */ }
        doc.updatedAt = new Date().toISOString();
        return true;
    }
    async deleteChunk(documentId, chunkId) {
        const doc = this.documents.get(documentId);
        if (!doc)
            return false;
        const idx = doc.chunks.findIndex((c) => c.id === chunkId);
        if (idx === -1)
            return false;
        doc.chunks.splice(idx, 1);
        doc.chunks.forEach((c, i) => {
            c.metadata.chunkIndex = i;
            c.metadata.totalChunks = doc.chunks.length;
        });
        await this.vectorStore.remove(documentId);
        if (doc.chunks.length > 0)
            await this.vectorStore.add(doc.chunks);
        doc.updatedAt = new Date().toISOString();
        doc.metadata = Object.assign(Object.assign({}, doc.metadata), { chunkCount: doc.chunks.length });
        return true;
    }
    async addChunk(documentId, content) {
        const doc = this.documents.get(documentId);
        if (!doc)
            return null;
        const chunk = {
            id: randomUUID(),
            documentId,
            content,
            metadata: {
                source: doc.source,
                title: doc.title,
                chunkIndex: doc.chunks.length,
                totalChunks: doc.chunks.length + 1,
                charStart: 0,
                charEnd: content.length,
                createdAt: new Date().toISOString(),
                manual: true,
            },
        };
        try {
            const [embedding] = await this.embeddings.embed([content]);
            chunk.embedding = embedding;
        }
        catch ( /* non-fatal */_a) { /* non-fatal */ }
        doc.chunks.push(chunk);
        doc.chunks.forEach((c) => { c.metadata.totalChunks = doc.chunks.length; });
        await this.vectorStore.remove(documentId);
        await this.vectorStore.add(doc.chunks);
        doc.updatedAt = new Date().toISOString();
        doc.metadata = Object.assign(Object.assign({}, doc.metadata), { chunkCount: doc.chunks.length });
        return Object.assign(Object.assign({}, chunk), { embedding: undefined });
    }
    // ─── Retrieval ──────────────────────────────────────────
    async retrieve(query, topK, collectionId, tenantId) {
        const k = topK !== null && topK !== void 0 ? topK : this.config.topK;
        const [queryEmbedding] = await this.embeddings.embed([query]);
        let results = await this.vectorStore.search(queryEmbedding, k * 3);
        results = results.filter((r) => {
            const meta = this.documentMeta.get(r.chunk.documentId);
            return (meta === null || meta === void 0 ? void 0 : meta.enabled) !== false;
        });
        // Tenant isolation: only return documents owned by the requesting tenant
        if (tenantId) {
            results = results.filter((r) => {
                const meta = this.documentMeta.get(r.chunk.documentId);
                return (meta === null || meta === void 0 ? void 0 : meta.tenantId) === tenantId;
            });
        }
        if (collectionId) {
            results = results.filter((r) => {
                const meta = this.documentMeta.get(r.chunk.documentId);
                return (meta === null || meta === void 0 ? void 0 : meta.collectionId) === collectionId;
            });
        }
        const filtered = results
            .filter((r) => r.score >= this.config.scoreThreshold)
            .slice(0, k);
        const context = filtered
            .map((r, i) => `[Source ${i + 1}: ${r.chunk.metadata.title}]\n${r.chunk.content}`)
            .join('\n\n---\n\n');
        const entry = {
            id: randomUUID(),
            query,
            resultCount: filtered.length,
            avgScore: filtered.length > 0 ? filtered.reduce((s, r) => s + r.score, 0) / filtered.length : 0,
            topScore: filtered.length > 0 ? filtered[0].score : 0,
            timestamp: new Date().toISOString(),
            collectionId,
        };
        this.queryHistory.push(entry);
        if (this.queryHistory.length > 500)
            this.queryHistory.shift();
        return { chunks: filtered, context, query };
    }
    buildRagPrompt(basePrompt, context) {
        if (!context)
            return basePrompt;
        return `${basePrompt}

## Knowledge Base Context
The following information was retrieved from the knowledge base. Use it to answer the user's question accurately.

${context}

## Instructions
- Answer based on the provided context when relevant
- Cite sources when possible (e.g., [Source 1])
- If the context is insufficient, use your general knowledge but mention this
- Be concise and accurate`;
    }
    // ─── Document CRUD ──────────────────────────────────────
    async removeDocument(documentId) {
        if (!this.documents.has(documentId))
            return false;
        await this.vectorStore.remove(documentId);
        this.documents.delete(documentId);
        this.documentMeta.delete(documentId);
        this.refreshCollectionCounts();
        return true;
    }
    async batchRemoveDocuments(documentIds) {
        let removed = 0;
        for (const id of documentIds) {
            if (await this.removeDocument(id))
                removed++;
        }
        return removed;
    }
    async batchSetEnabled(documentIds, enabled) {
        let updated = 0;
        for (const id of documentIds) {
            if (this.setDocumentEnabled(id, enabled))
                updated++;
        }
        return updated;
    }
    async batchReindex(documentIds, chunkingOptions) {
        let reindexed = 0;
        for (const id of documentIds) {
            if (await this.reindexDocument(id, chunkingOptions))
                reindexed++;
        }
        return reindexed;
    }
    async batchMoveToCollection(documentIds, collectionId) {
        if (!this.collections.has(collectionId))
            return 0;
        let moved = 0;
        for (const id of documentIds) {
            const meta = this.documentMeta.get(id);
            if (meta) {
                meta.collectionId = collectionId;
                moved++;
            }
        }
        this.refreshCollectionCounts();
        return moved;
    }
    // ─── Stats & Analytics ─────────────────────────────────
    getStats(tenantId) {
        let docEntries = Array.from(this.documents.entries());
        if (tenantId) {
            docEntries = docEntries.filter(([id]) => { var _a; return ((_a = this.documentMeta.get(id)) === null || _a === void 0 ? void 0 : _a.tenantId) === tenantId; });
        }
        const docs = docEntries.map(([, d]) => ({
            id: d.id,
            title: d.title,
            source: d.source,
            chunkCount: d.chunks.length,
            createdAt: d.createdAt,
        }));
        const metaEntries = tenantId
            ? Array.from(this.documentMeta.entries()).filter(([, m]) => m.tenantId === tenantId)
            : Array.from(this.documentMeta.entries());
        return {
            totalDocuments: docs.length,
            totalChunks: docs.reduce((sum, d) => sum + d.chunkCount, 0),
            totalCollections: this.listCollections(tenantId).length,
            totalEnabledDocuments: metaEntries.filter(([, m]) => m.enabled).length,
            documents: docs,
        };
    }
    getDocument(id, tenantId) {
        const doc = this.documents.get(id);
        if (!doc)
            return undefined;
        if (tenantId) {
            const meta = this.documentMeta.get(id);
            if ((meta === null || meta === void 0 ? void 0 : meta.tenantId) && meta.tenantId !== tenantId)
                return undefined;
        }
        return doc;
    }
    getDocumentMeta(id, tenantId) {
        const meta = this.documentMeta.get(id);
        if (!meta)
            return undefined;
        if (tenantId && meta.tenantId && meta.tenantId !== tenantId)
            return undefined;
        return meta;
    }
    listDocuments(options) {
        let docs = Array.from(this.documents.entries());
        // Tenant isolation: only show documents owned by this tenant
        if (options === null || options === void 0 ? void 0 : options.tenantId) {
            docs = docs.filter(([id]) => { var _a; return ((_a = this.documentMeta.get(id)) === null || _a === void 0 ? void 0 : _a.tenantId) === options.tenantId; });
        }
        if (options === null || options === void 0 ? void 0 : options.collectionId) {
            docs = docs.filter(([id]) => { var _a; return ((_a = this.documentMeta.get(id)) === null || _a === void 0 ? void 0 : _a.collectionId) === options.collectionId; });
        }
        if (options === null || options === void 0 ? void 0 : options.tag) {
            docs = docs.filter(([id]) => { var _a; return (_a = this.documentMeta.get(id)) === null || _a === void 0 ? void 0 : _a.tags.includes(options.tag); });
        }
        if (options === null || options === void 0 ? void 0 : options.source) {
            docs = docs.filter(([, d]) => d.source === options.source);
        }
        if ((options === null || options === void 0 ? void 0 : options.enabled) !== undefined) {
            docs = docs.filter(([id]) => { var _a; return ((_a = this.documentMeta.get(id)) === null || _a === void 0 ? void 0 : _a.enabled) === options.enabled; });
        }
        if (options === null || options === void 0 ? void 0 : options.search) {
            const q = options.search.toLowerCase();
            docs = docs.filter(([, d]) => d.title.toLowerCase().includes(q) || d.content.toLowerCase().includes(q));
        }
        return docs.map(([id, d]) => ({
            id: d.id,
            title: d.title,
            content: d.content.slice(0, 300) + (d.content.length > 300 ? '...' : ''),
            mimeType: d.mimeType,
            source: d.source,
            createdAt: d.createdAt,
            updatedAt: d.updatedAt,
            metadata: d.metadata,
            chunkCount: d.chunks.length,
            meta: this.documentMeta.get(id),
        }));
    }
    getAllTags() {
        const tags = new Set();
        for (const meta of this.documentMeta.values()) {
            for (const tag of meta.tags)
                tags.add(tag);
        }
        return Array.from(tags).sort();
    }
    getAnalytics() {
        var _a, _b, _c, _d;
        const totalQueries = this.queryHistory.length;
        const avgResultCount = totalQueries > 0
            ? this.queryHistory.reduce((s, q) => s + q.resultCount, 0) / totalQueries : 0;
        const avgScore = totalQueries > 0
            ? this.queryHistory.reduce((s, q) => s + q.avgScore, 0) / totalQueries : 0;
        const queryMap = new Map();
        for (const entry of this.queryHistory) {
            const existing = queryMap.get(entry.query);
            if (existing) {
                existing.count++;
                existing.totalScore += entry.avgScore;
            }
            else
                queryMap.set(entry.query, { count: 1, totalScore: entry.avgScore });
        }
        const topQueries = Array.from(queryMap.entries())
            .map(([query, d]) => ({ query, count: d.count, avgScore: d.totalScore / d.count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
        const docsBySource = {};
        for (const doc of this.documents.values()) {
            docsBySource[doc.source] = ((_a = docsBySource[doc.source]) !== null && _a !== void 0 ? _a : 0) + 1;
        }
        const docsByCol = {};
        for (const meta of this.documentMeta.values()) {
            const col = this.collections.get((_b = meta.collectionId) !== null && _b !== void 0 ? _b : 'default');
            const name = (_c = col === null || col === void 0 ? void 0 : col.name) !== null && _c !== void 0 ? _c : 'Unknown';
            docsByCol[name] = ((_d = docsByCol[name]) !== null && _d !== void 0 ? _d : 0) + 1;
        }
        const chunkSizes = [];
        for (const doc of this.documents.values()) {
            for (const chunk of doc.chunks)
                chunkSizes.push(chunk.content.length);
        }
        chunkSizes.sort((a, b) => a - b);
        return {
            totalQueries,
            avgResultCount: Math.round(avgResultCount * 10) / 10,
            avgScore: Math.round(avgScore * 1000) / 1000,
            topQueries,
            recentQueries: this.queryHistory.slice(-20).reverse(),
            documentsBySource: docsBySource,
            documentsByCollection: docsByCol,
            chunkSizeDistribution: chunkSizes.length > 0
                ? {
                    min: chunkSizes[0],
                    max: chunkSizes[chunkSizes.length - 1],
                    avg: Math.round(chunkSizes.reduce((s, v) => s + v, 0) / chunkSizes.length),
                    median: chunkSizes[Math.floor(chunkSizes.length / 2)],
                }
                : { min: 0, max: 0, avg: 0, median: 0 },
        };
    }
    getQueryHistory(limit = 20) {
        return this.queryHistory.slice(-limit).reverse();
    }
    // ─── Web Crawling ──────────────────────────────────────
    /**
     * Crawl a website and ingest all discovered pages into the knowledge base.
     * Yields progress updates for streaming to the client.
     */
    crawlSite(startUrl, crawlOptions, ingestOptions) {
        return __asyncGenerator(this, arguments, function* crawlSite_1() {
            var _a, e_1, _b, _c;
            var _d;
            const crawler = new WebCrawler(crawlOptions);
            let ingested = 0;
            try {
                for (var _e = true, _f = __asyncValues(crawler.crawl(startUrl)), _g; _g = yield __await(_f.next()), _a = _g.done, !_a; _e = true) {
                    _c = _g.value;
                    _e = false;
                    const progress = _c;
                    // Ingest newly crawled pages
                    for (const page of progress.pages.slice(ingested)) {
                        if (page.content.length > 50) { // skip almost-empty pages
                            try {
                                yield __await(this.ingestText(page.content, page.title, page.url, {
                                    tags: [...((_d = ingestOptions === null || ingestOptions === void 0 ? void 0 : ingestOptions.tags) !== null && _d !== void 0 ? _d : []), 'web-crawl'],
                                    collectionId: ingestOptions === null || ingestOptions === void 0 ? void 0 : ingestOptions.collectionId,
                                    chunkingOptions: ingestOptions === null || ingestOptions === void 0 ? void 0 : ingestOptions.chunkingOptions,
                                    tenantId: ingestOptions === null || ingestOptions === void 0 ? void 0 : ingestOptions.tenantId,
                                    customMetadata: { sourceUrl: page.url, importType: 'web-crawl', crawlDepth: String(page.depth) },
                                }));
                            }
                            catch ( /* skip failed ingestion */_h) { /* skip failed ingestion */ }
                        }
                        ingested++;
                    }
                    yield yield __await(Object.assign(Object.assign({}, progress), { ingested }));
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_e && !_a && (_b = _f.return)) yield __await(_b.call(_f));
                }
                finally { if (e_1) throw e_1.error; }
            }
        });
    }
    // ─── Re-ranked Search ──────────────────────────────────
    async searchWithReranking(query, options) {
        var _a, _b;
        // Cast topK wider to get candidates for re-ranking
        const candidateK = Math.max(((_a = options === null || options === void 0 ? void 0 : options.topK) !== null && _a !== void 0 ? _a : 5) * 3, 15);
        const vectorResults = await this.vectorStore.search(await this.embeddings.embed([query]).then((e) => e[0]), candidateK);
        // Filter by tenant and collection
        let filteredResults = vectorResults;
        // Tenant isolation
        if (options === null || options === void 0 ? void 0 : options.tenantId) {
            filteredResults = filteredResults.filter((r) => {
                const meta = this.documentMeta.get(r.chunk.documentId);
                return (meta === null || meta === void 0 ? void 0 : meta.tenantId) === options.tenantId;
            });
        }
        if (options === null || options === void 0 ? void 0 : options.collectionId) {
            const docsInCol = new Set();
            for (const [docId, meta] of this.documentMeta.entries()) {
                if (meta.collectionId === options.collectionId && meta.enabled)
                    docsInCol.add(docId);
            }
            filteredResults = vectorResults.filter((r) => docsInCol.has(r.chunk.documentId));
        }
        return this.reranker.rerank(query, filteredResults.map((r) => ({ chunk: r.chunk, score: r.score })), Object.assign({ topK: (_b = options === null || options === void 0 ? void 0 : options.topK) !== null && _b !== void 0 ? _b : 5 }, options === null || options === void 0 ? void 0 : options.rerankerOptions));
    }
    // ─── Knowledge Refresh ─────────────────────────────────
    /**
     * Get documents that may need re-indexing (imported from web, older than maxAgeMs).
     */
    getStaleDocuments(maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
        var _a, _b;
        const now = Date.now();
        const stale = [];
        for (const [id, doc] of this.documents.entries()) {
            const meta = this.documentMeta.get(id);
            if (!meta || !meta.enabled)
                continue;
            const age = now - new Date(doc.updatedAt).getTime();
            if (age > maxAgeMs && (((_a = meta.customMetadata) === null || _a === void 0 ? void 0 : _a.importType) === 'web' || ((_b = meta.customMetadata) === null || _b === void 0 ? void 0 : _b.importType) === 'web-crawl')) {
                stale.push({ id, title: doc.title, source: doc.source, age });
            }
        }
        return stale.sort((a, b) => b.age - a.age);
    }
    /**
     * Re-fetch and re-ingest a web-sourced document from its source URL.
     */
    async refreshDocument(documentId) {
        var _a, _b;
        const doc = this.documents.get(documentId);
        const meta = this.documentMeta.get(documentId);
        if (!doc || !meta)
            return null;
        const sourceUrl = (_b = (_a = meta.customMetadata) === null || _a === void 0 ? void 0 : _a.sourceUrl) !== null && _b !== void 0 ? _b : doc.source;
        if (!sourceUrl.startsWith('http'))
            return null;
        try {
            const res = await fetch(sourceUrl, {
                headers: { 'User-Agent': 'HiTechClaw-Bot/1.0 (Knowledge Refresh)' },
            });
            if (!res.ok)
                throw new Error(`HTTP ${res.status}`);
            const html = await res.text();
            const newContent = this.htmlToText(html);
            // Only re-index if content actually changed
            if (newContent === doc.content) {
                doc.updatedAt = new Date().toISOString();
                return doc;
            }
            doc.content = newContent;
            doc.metadata = Object.assign(Object.assign({}, doc.metadata), { charCount: newContent.length, lastRefreshed: new Date().toISOString() });
            return await this.reindexDocument(documentId, meta.chunkingOptions);
        }
        catch (_c) {
            return null;
        }
    }
    // ─── Chunking Config ──────────────────────────────────
    getDefaultChunkingOptions() {
        return Object.assign({}, this.config.chunkingOptions);
    }
    setDefaultChunkingOptions(options) {
        if (options.chunkSize !== undefined)
            this.config.chunkingOptions.chunkSize = options.chunkSize;
        if (options.chunkOverlap !== undefined)
            this.config.chunkingOptions.chunkOverlap = options.chunkOverlap;
        if (options.separator !== undefined)
            this.config.chunkingOptions.separator = options.separator;
    }
}
