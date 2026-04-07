// ============================================================
// CLI: docs — Manage developer documentation knowledge base
// ============================================================
import { readFileSync, readdirSync, statSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
const DEFAULT_DOCS_ROOT = resolve(process.cwd(), 'data/dev-docs');
function getDocsRoot() {
    return process.env['DOCS_ROOT'] || DEFAULT_DOCS_ROOT;
}
/** List all documentation files */
export function docsList(category) {
    const docsRoot = getDocsRoot();
    if (!existsSync(docsRoot)) {
        console.log('📂 No dev-docs directory found at:', docsRoot);
        console.log('   Run: hitechclaw docs init');
        return;
    }
    const files = walkMarkdown(docsRoot).map(f => f.replace(docsRoot + '/', ''));
    const filtered = category ? files.filter(f => f.startsWith(category + '/')) : files;
    if (filtered.length === 0) {
        console.log(category ? `No docs in category "${category}"` : 'No docs found');
        return;
    }
    console.log(`\n📚 Developer Documentation (${filtered.length} files):\n`);
    const byCat = new Map();
    for (const f of filtered) {
        const [cat] = f.split('/');
        if (!byCat.has(cat))
            byCat.set(cat, []);
        byCat.get(cat).push(f);
    }
    for (const [cat, docs] of byCat) {
        console.log(`  📁 ${cat}/`);
        for (const doc of docs) {
            console.log(`     - ${doc}`);
        }
    }
}
/** Search documentation */
export function docsSearch(query) {
    const docsRoot = getDocsRoot();
    if (!existsSync(docsRoot)) {
        console.log('📂 No dev-docs directory found. Run: hitechclaw docs init');
        return;
    }
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const files = walkMarkdown(docsRoot);
    const results = [];
    for (const file of files) {
        const content = readFileSync(file, 'utf-8');
        const relPath = file.replace(docsRoot + '/', '');
        const lower = content.toLowerCase();
        let score = 0;
        for (const term of terms) {
            let idx = 0;
            while ((idx = lower.indexOf(term, idx)) !== -1) {
                score++;
                idx += term.length;
            }
        }
        if (score > 0) {
            const titleMatch = content.match(/^#\s+(.+)$/m);
            const title = titleMatch ? titleMatch[1] : relPath;
            results.push({ path: relPath, score, title });
        }
    }
    results.sort((a, b) => b.score - a.score);
    if (results.length === 0) {
        console.log(`🔍 No results for "${query}"`);
        return;
    }
    console.log(`\n🔍 Search results for "${query}" (${results.length} matches):\n`);
    for (const r of results.slice(0, 10)) {
        console.log(`  📄 ${r.title} (score: ${r.score})`);
        console.log(`     ${r.path}`);
    }
}
/** Add a new document */
export function docsAdd(relPath, title, tags) {
    const docsRoot = getDocsRoot();
    const fullPath = resolve(docsRoot, relPath.endsWith('.md') ? relPath : relPath + '.md');
    const dir = dirname(fullPath);
    if (existsSync(fullPath)) {
        console.log(`⚠️  File already exists: ${fullPath}`);
        return;
    }
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
    const tagList = tags ? tags.split(',').map(t => t.trim()) : [];
    const content = [
        '---',
        `tags: [${tagList.join(', ')}]`,
        '---',
        '',
        `# ${title}`,
        '',
        '<!-- Write your documentation here -->',
        '',
    ].join('\n');
    writeFileSync(fullPath, content, 'utf-8');
    console.log(`✅ Created: ${fullPath}`);
    console.log(`   Edit the file and add your documentation.`);
}
/** Initialize dev-docs directory with structure */
export function docsInit() {
    const docsRoot = getDocsRoot();
    const dirs = ['conventions', 'architecture', 'guides', 'api', 'troubleshooting', 'examples'];
    for (const dir of dirs) {
        const path = resolve(docsRoot, dir);
        if (!existsSync(path)) {
            mkdirSync(path, { recursive: true });
            console.log(`📁 Created: ${dir}/`);
        }
    }
    // Create README
    const readmePath = resolve(docsRoot, 'README.md');
    if (!existsSync(readmePath)) {
        writeFileSync(readmePath, [
            '# HiTechClaw Developer Documentation',
            '',
            'Kho tài liệu dành cho developer, được AI code assistants truy cập qua MCP.',
            '',
            '## Categories',
            '',
            '- `conventions/` — Coding conventions & patterns',
            '- `architecture/` — Architecture decisions & design',
            '- `guides/` — How-to guides & tutorials',
            '- `api/` — API documentation',
            '- `troubleshooting/` — Common issues & solutions',
            '- `examples/` — Code examples & snippets',
            '',
            '## Usage',
            '',
            'Docs được serve qua MCP server (`packages/doc-mcp`). VS Code AI agents',
            'tự động truy vấn kho tài liệu khi code thông qua MCP tools:',
            '',
            '- `search_docs` — Tìm kiếm tài liệu',
            '- `get_doc` — Đọc full nội dung document',
            '- `list_doc_categories` — Duyệt categories',
            '- `list_docs` — Liệt kê docs trong category',
            '',
        ].join('\n'), 'utf-8');
        console.log('📄 Created: README.md');
    }
    console.log('\n✅ Dev docs initialized at:', docsRoot);
}
// ─── Helpers ────────────────────────────────────────────────
function walkMarkdown(dir) {
    const results = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            results.push(...walkMarkdown(full));
        }
        else if (entry.endsWith('.md') || entry.endsWith('.mdx')) {
            results.push(full);
        }
    }
    return results;
}
//# sourceMappingURL=docs.js.map