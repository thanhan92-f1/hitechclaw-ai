/**
 * Knowledge Pack Auto-Loader
 * Scans data/knowledge-packs/ and loads all JSON data into RAG engine on startup.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { RagEngine } from '@hitechclaw/core';

interface KnowledgePack {
  _meta: {
    description?: string;
    source?: string;
    locale?: string;
    version?: string;
    totalEntries?: number;
  };
  [key: string]: unknown;
}

const PACKS_DIR = resolve(process.cwd(), 'data/knowledge-packs');

/** Convert a JSON knowledge pack into text documents suitable for RAG ingestion */
function packToDocuments(
  fileName: string,
  pack: KnowledgePack,
): { title: string; text: string; tags: string[] }[] {
  const meta = pack._meta ?? {};
  const docs: { title: string; text: string; tags: string[] }[] = [];

  // Determine collection name from _meta description or filename
  const baseName = fileName.replace(/\.json$/, '');

  // Process known data arrays
  for (const [key, value] of Object.entries(pack)) {
    if (key === '_meta' || !Array.isArray(value)) continue;

    for (const item of value) {
      if (typeof item !== 'object' || item === null) continue;
      const record = item as Record<string, unknown>;

      // Build a readable text representation
      const lines: string[] = [];
      for (const [k, v] of Object.entries(record)) {
        if (v === null || v === undefined) continue;
        if (typeof v === 'object') {
          lines.push(`${k}: ${JSON.stringify(v, null, 0)}`);
        } else {
          lines.push(`${k}: ${v}`);
        }
      }

      const title =
        (record.brandName as string) ||
        (record.genericName as string) ||
        (record.code as string) ||
        (record.chapterTitle as string) ||
        (record.id as string) ||
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
export async function loadKnowledgePacks(rag: RagEngine): Promise<number> {
  let totalDocs = 0;

  let packDirs: string[];
  try {
    packDirs = await readdir(PACKS_DIR);
  } catch {
    console.log('   Knowledge: No data/knowledge-packs/ directory found, skipping auto-load');
    return 0;
  }

  for (const dir of packDirs) {
    const dirPath = join(PACKS_DIR, dir);
    let files: string[];
    try {
      files = await readdir(dirPath);
    } catch {
      // Not a directory, skip
      continue;
    }

    const jsonFiles = files.filter((f) => f.endsWith('.json'));
    for (const file of jsonFiles) {
      try {
        const raw = await readFile(join(dirPath, file), 'utf-8');
        const pack = JSON.parse(raw) as KnowledgePack;
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
      } catch (err) {
        console.warn(`   ⚠️  Failed to load ${dir}/${file}:`, err instanceof Error ? err.message : err);
      }
    }
  }

  return totalDocs;
}
