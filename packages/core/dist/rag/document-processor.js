import { randomUUID } from 'node:crypto';
// ─── Document Processor ─────────────────────────────────────
export class DocumentProcessor {
    constructor() {
        this.defaultOptions = {
            chunkSize: 512,
            chunkOverlap: 50,
            separator: '\n\n',
        };
    }
    /**
     * Process raw text into a RagDocument with chunks.
     */
    processText(text, title, source, options) {
        const docId = randomUUID();
        const now = new Date().toISOString();
        const chunks = this.chunkText(text, docId, title, source, options);
        return {
            id: docId,
            title,
            content: text,
            mimeType: 'text/plain',
            source,
            chunks,
            createdAt: now,
            updatedAt: now,
            metadata: { charCount: text.length, chunkCount: chunks.length },
        };
    }
    /**
     * Process HTML content, extracting tables, code blocks, and images
     * as separate annotated chunks alongside regular text.
     */
    processHTML(html, title, source, options) {
        const segments = this.extractMultiModalContent(html);
        const docId = randomUUID();
        const now = new Date().toISOString();
        const allChunks = [];
        let chunkIdx = 0;
        for (const segment of segments) {
            if (segment.type === 'table') {
                // Tables get their own dedicated chunk to preserve structure
                allChunks.push({
                    id: randomUUID(),
                    documentId: docId,
                    content: segment.content,
                    metadata: Object.assign({ source,
                        title, chunkIndex: chunkIdx++, totalChunks: 0, charStart: 0, charEnd: segment.content.length, createdAt: now, contentType: 'table' }, segment.metadata),
                });
            }
            else if (segment.type === 'image') {
                // Image references stored with alt text description
                allChunks.push({
                    id: randomUUID(),
                    documentId: docId,
                    content: segment.content,
                    metadata: Object.assign({ source,
                        title, chunkIndex: chunkIdx++, totalChunks: 0, charStart: 0, charEnd: segment.content.length, createdAt: now, contentType: 'image' }, segment.metadata),
                });
            }
            else if (segment.type === 'code') {
                allChunks.push({
                    id: randomUUID(),
                    documentId: docId,
                    content: segment.content,
                    metadata: Object.assign({ source,
                        title, chunkIndex: chunkIdx++, totalChunks: 0, charStart: 0, charEnd: segment.content.length, createdAt: now, contentType: 'code' }, segment.metadata),
                });
            }
            else {
                // Regular text — apply standard chunking
                const textChunks = this.chunkText(segment.content, docId, title, source, options);
                for (const tc of textChunks) {
                    tc.metadata.chunkIndex = chunkIdx++;
                    allChunks.push(tc);
                }
            }
        }
        // Update totalChunks
        for (const c of allChunks)
            c.metadata.totalChunks = allChunks.length;
        const plainText = segments.map((s) => s.content).join('\n\n');
        return {
            id: docId,
            title,
            content: plainText,
            mimeType: 'text/html',
            source,
            chunks: allChunks,
            createdAt: now,
            updatedAt: now,
            metadata: {
                charCount: plainText.length,
                chunkCount: allChunks.length,
                multiModal: true,
                tables: segments.filter((s) => s.type === 'table').length,
                images: segments.filter((s) => s.type === 'image').length,
                codeBlocks: segments.filter((s) => s.type === 'code').length,
            },
        };
    }
    /**
     * Extract structured segments from HTML: tables, images, code blocks, and text.
     */
    extractMultiModalContent(html) {
        const segments = [];
        let remaining = html;
        // Pattern to match tables, code blocks, images
        const patterns = [
            { type: 'table', regex: /<table[^>]*>([\s\S]*?)<\/table>/gi },
            { type: 'code', regex: /<(?:pre|code)[^>]*>([\s\S]*?)<\/(?:pre|code)>/gi },
            { type: 'image', regex: /<img[^>]+(?:src=["']([^"']+)["'])[^>]*(?:alt=["']([^"']*?)["'])?[^>]*\/?>/gi },
        ];
        // Collect all matches with positions
        const matches = [];
        for (const { type, regex } of patterns) {
            let m;
            while ((m = regex.exec(html)) !== null) {
                let content;
                let metadata;
                if (type === 'table') {
                    content = this.tableToText(m[0]);
                }
                else if (type === 'image') {
                    const src = m[1] || '';
                    const alt = m[2] || '';
                    content = alt ? `[Image: ${alt}] (${src})` : `[Image] (${src})`;
                    metadata = { imageUrl: src, altText: alt };
                }
                else {
                    content = m[1].replace(/<[^>]+>/g, '').trim();
                    metadata = { language: this.detectCodeLanguage(m[0]) };
                }
                if (content.trim()) {
                    matches.push({ type, start: m.index, end: m.index + m[0].length, content, metadata });
                }
            }
        }
        // Sort by position
        matches.sort((a, b) => a.start - b.start);
        // Interleave text between structured segments
        let cursor = 0;
        for (const match of matches) {
            if (match.start > cursor) {
                const textBetween = this.stripHtml(remaining.slice(cursor, match.start)).trim();
                if (textBetween)
                    segments.push({ type: 'text', content: textBetween });
            }
            segments.push({ type: match.type, content: match.content, metadata: match.metadata });
            cursor = match.end;
        }
        // Trailing text
        if (cursor < remaining.length) {
            const trailing = this.stripHtml(remaining.slice(cursor)).trim();
            if (trailing)
                segments.push({ type: 'text', content: trailing });
        }
        // If no structured content found, return full text
        if (segments.length === 0) {
            const text = this.stripHtml(html).trim();
            if (text)
                segments.push({ type: 'text', content: text });
        }
        return segments;
    }
    tableToText(tableHtml) {
        const rows = [];
        const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
        let rowMatch;
        while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
            const cellRegex = /<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;
            const cells = [];
            let cellMatch;
            while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
                cells.push(cellMatch[1].replace(/<[^>]+>/g, '').trim());
            }
            rows.push(cells.join(' | '));
        }
        return rows.join('\n');
    }
    stripHtml(html) {
        return html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/\s+/g, ' ')
            .trim();
    }
    detectCodeLanguage(codeHtml) {
        const classMatch = codeHtml.match(/class=["'][^"']*language-(\w+)/i);
        return (classMatch === null || classMatch === void 0 ? void 0 : classMatch[1]) || 'unknown';
    }
    /**
     * Split text into overlapping chunks using recursive splitting.
     */
    chunkText(text, documentId, title, source, options) {
        const opts = Object.assign(Object.assign({}, this.defaultOptions), options);
        const { chunkSize, chunkOverlap } = opts;
        // Recursive separators: paragraph → sentence → word → char
        const separators = ['\n\n', '\n', '. ', ' ', ''];
        const rawChunks = this.recursiveSplit(text, separators, chunkSize, chunkOverlap);
        const now = new Date().toISOString();
        let charOffset = 0;
        return rawChunks.map((chunk, idx) => {
            const charStart = text.indexOf(chunk, charOffset);
            const actualStart = charStart >= 0 ? charStart : charOffset;
            charOffset = actualStart + chunk.length - chunkOverlap;
            return {
                id: randomUUID(),
                documentId,
                content: chunk.trim(),
                metadata: {
                    source,
                    title,
                    chunkIndex: idx,
                    totalChunks: rawChunks.length,
                    charStart: actualStart,
                    charEnd: actualStart + chunk.length,
                    createdAt: now,
                },
            };
        });
    }
    recursiveSplit(text, separators, chunkSize, overlap) {
        var _a;
        if (text.length <= chunkSize)
            return [text];
        const sep = (_a = separators.find((s) => text.includes(s))) !== null && _a !== void 0 ? _a : '';
        const parts = sep ? text.split(sep) : [text];
        const chunks = [];
        let current = '';
        for (const part of parts) {
            const candidate = current ? current + sep + part : part;
            if (candidate.length > chunkSize && current) {
                chunks.push(current);
                // Keep overlap from end of current
                const overlapText = current.slice(-overlap);
                current = overlapText + sep + part;
            }
            else {
                current = candidate;
            }
        }
        if (current)
            chunks.push(current);
        // If any chunk is still too large, split further
        const result = [];
        for (const chunk of chunks) {
            if (chunk.length > chunkSize * 1.5 && separators.length > 1) {
                result.push(...this.recursiveSplit(chunk, separators.slice(1), chunkSize, overlap));
            }
            else {
                result.push(chunk);
            }
        }
        return result;
    }
}
