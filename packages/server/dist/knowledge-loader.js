/**
 * Knowledge Pack Auto-Loader
 * Scans data/knowledge-packs/ and loads all JSON data into RAG engine on startup.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
const PACKS_DIR = resolve(process.cwd(), 'data/knowledge-packs');
/** Convert a JSON knowledge pack into text documents suitable for RAG ingestion */
function packToDocuments(fileName, pack) {
    var _a;
    const meta = (_a = pack._meta) !== null && _a !== void 0 ? _a : {};
    const docs = [];
    // Determine collection name from _meta description or filename
    const baseName = fileName.replace(/\.json$/, '');
    // Process known data arrays
    for (const [key, value] of Object.entries(pack)) {
        if (key === '_meta' || !Array.isArray(value))
            continue;
        for (const item of value) {
            if (typeof item !== 'object' || item === null)
                continue;
            const record = item;
            // Build a readable text representation
            const lines = [];
            for (const [k, v] of Object.entries(record)) {
                if (v === null || v === undefined)
                    continue;
                if (typeof v === 'object') {
                    lines.push(`${k}: ${JSON.stringify(v, null, 0)}`);
                }
                else {
                    lines.push(`${k}: ${v}`);
                }
            }
            const title = record.brandName ||
                record.genericName ||
                record.code ||
                record.chapterTitle ||
                record.id ||
                `${baseName}-${docs.length}`;
            docs.push({
                title,
                text: lines.join('\n'),
                tags: meta.locale ? [meta.locale, key] : [key],
            });
        }
    }
    // If no arrays found, ingest the whole file as a single document
    if (docs.length === 0) {
        docs.push({
            title: baseName,
            text: JSON.stringify(pack, null, 2),
            tags: meta.locale ? [meta.locale] : [],
        });
    }
    return docs;
}
/** Load all knowledge packs into the RAG engine */
export async function loadKnowledgePacks(rag) {
    let totalDocs = 0;
    let packDirs;
    try {
        packDirs = await readdir(PACKS_DIR);
    }
    catch (_a) {
        console.log('   Knowledge: No data/knowledge-packs/ directory found, skipping auto-load');
        return 0;
    }
    for (const dir of packDirs) {
        const dirPath = join(PACKS_DIR, dir);
        let files;
        try {
            files = await readdir(dirPath);
        }
        catch (_b) {
            // Not a directory, skip
            continue;
        }
        const jsonFiles = files.filter((f) => f.endsWith('.json'));
        for (const file of jsonFiles) {
            try {
                const raw = await readFile(join(dirPath, file), 'utf-8');
                const pack = JSON.parse(raw);
                const collectionId = dir; // Use directory name as collection
                const documents = packToDocuments(file, pack);
                for (const doc of documents) {
                    await rag.ingestText(doc.text, doc.title, `knowledge-pack://${dir}/${file}`, {
                        tags: doc.tags,
                        collectionId,
                    });
                    totalDocs++;
                }
                console.log(`   📦 ${dir}/${file}: ${documents.length} documents loaded`);
            }
            catch (err) {
                console.warn(`   ⚠️  Failed to load ${dir}/${file}:`, err instanceof Error ? err.message : err);
            }
        }
    }
    return totalDocs;
}
