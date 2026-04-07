import { URL } from 'node:url';
// ─── Web Crawler ────────────────────────────────────────────
export class WebCrawler {
    visited = new Set();
    options;
    constructor(options) {
        this.options = {
            maxPages: options?.maxPages ?? 20,
            maxDepth: options?.maxDepth ?? 2,
            sameDomain: options?.sameDomain ?? true,
            includePatterns: options?.includePatterns ?? [],
            excludePatterns: options?.excludePatterns ?? [],
            delayMs: options?.delayMs ?? 500,
            timeout: options?.timeout ?? 10000,
        };
    }
    /**
     * Crawl a website starting from a URL, following links up to maxDepth.
     * Yields progress updates for each page crawled.
     */
    async *crawl(startUrl) {
        this.visited.clear();
        const pages = [];
        const errors = [];
        const queue = [{ url: this.normalizeUrl(startUrl), depth: 0 }];
        while (queue.length > 0 && pages.length < this.options.maxPages) {
            const item = queue.shift();
            const normalized = this.normalizeUrl(item.url);
            if (this.visited.has(normalized))
                continue;
            this.visited.add(normalized);
            if (!this.shouldCrawl(normalized, startUrl))
                continue;
            yield {
                crawled: pages.length,
                queued: queue.length,
                total: pages.length + queue.length + 1,
                currentUrl: normalized,
                pages,
                errors,
            };
            try {
                const page = await this.fetchPage(normalized, item.depth);
                pages.push(page);
                // Extract and queue child links
                if (item.depth < this.options.maxDepth) {
                    for (const link of page.links) {
                        const linkNorm = this.normalizeUrl(link);
                        if (!this.visited.has(linkNorm)) {
                            queue.push({ url: linkNorm, depth: item.depth + 1 });
                        }
                    }
                }
                // Respect crawl delay
                if (this.options.delayMs > 0) {
                    await new Promise((r) => setTimeout(r, this.options.delayMs));
                }
            }
            catch (err) {
                errors.push({ url: normalized, error: err instanceof Error ? err.message : String(err) });
            }
        }
        // Final progress
        yield {
            crawled: pages.length,
            queued: 0,
            total: pages.length,
            currentUrl: '',
            pages,
            errors,
        };
    }
    /**
     * Fetch a single page and extract text + links.
     */
    async fetchPage(url, depth) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.options.timeout);
        try {
            const res = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'HiTechClaw-Bot/1.0 (Knowledge Crawler)',
                    'Accept': 'text/html,application/xhtml+xml',
                },
            });
            if (!res.ok) {
                throw new Error(`HTTP ${res.status} ${res.statusText}`);
            }
            const html = await res.text();
            const title = this.extractTitle(html) ?? new URL(url).pathname;
            const content = this.htmlToText(html);
            const links = this.extractLinks(html, url);
            return {
                url,
                title,
                content,
                depth,
                links,
                statusCode: res.status,
                byteSize: html.length,
            };
        }
        finally {
            clearTimeout(timer);
        }
    }
    htmlToText(html) {
        return html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
            .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
            .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
            .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
            .replace(/<!--[\s\S]*?-->/g, '')
            // Convert block elements to newlines
            .replace(/<(h[1-6]|p|div|section|article|li|tr|br)[^>]*>/gi, '\n')
            .replace(/<[^>]+>/g, ' ')
            // Decode entities
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
            .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec)))
            // Clean whitespace
            .replace(/[ \t]+/g, ' ')
            .replace(/\n[ \t]+/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim()
            .split('\n')
            .filter((l) => l.trim().length > 2)
            .join('\n');
    }
    extractTitle(html) {
        const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        return match ? match[1].trim().replace(/\s+/g, ' ') : null;
    }
    extractLinks(html, baseUrl) {
        const links = [];
        const regex = /<a[^>]+href=["']([^"'#]+)["']/gi;
        let match;
        while ((match = regex.exec(html)) !== null) {
            try {
                const resolved = new URL(match[1], baseUrl).href;
                // Only HTTP(S) links, skip mailto, tel, javascript
                if (resolved.startsWith('http://') || resolved.startsWith('https://')) {
                    links.push(resolved.split('?')[0]); // strip query params for dedup
                }
            }
            catch { /* invalid URL */ }
        }
        return [...new Set(links)];
    }
    normalizeUrl(url) {
        try {
            const u = new URL(url);
            // Remove trailing slash, fragment, common tracking params
            u.hash = '';
            const path = u.pathname.replace(/\/+$/, '') || '/';
            return `${u.protocol}//${u.host}${path}`;
        }
        catch {
            return url;
        }
    }
    shouldCrawl(url, startUrl) {
        try {
            const target = new URL(url);
            const origin = new URL(startUrl);
            // Same-domain check
            if (this.options.sameDomain && target.hostname !== origin.hostname)
                return false;
            // Skip non-HTML resources
            const ext = target.pathname.split('.').pop()?.toLowerCase();
            const skipExts = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'svg', 'mp4', 'mp3', 'zip', 'css', 'js', 'woff', 'woff2', 'ttf'];
            if (ext && skipExts.includes(ext))
                return false;
            // Include patterns
            if (this.options.includePatterns.length > 0) {
                const matched = this.options.includePatterns.some((p) => this.globMatch(target.pathname, p));
                if (!matched)
                    return false;
            }
            // Exclude patterns
            if (this.options.excludePatterns.length > 0) {
                const excluded = this.options.excludePatterns.some((p) => this.globMatch(target.pathname, p));
                if (excluded)
                    return false;
            }
            return true;
        }
        catch {
            return false;
        }
    }
    globMatch(path, pattern) {
        const regex = pattern
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.');
        return new RegExp(`^${regex}$`).test(path);
    }
}
//# sourceMappingURL=web-crawler.js.map