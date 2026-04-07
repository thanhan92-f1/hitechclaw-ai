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
import { URL } from 'node:url';
// ─── Web Crawler ────────────────────────────────────────────
export class WebCrawler {
    constructor(options) {
        var _a, _b, _c, _d, _e, _f, _g;
        this.visited = new Set();
        this.options = {
            maxPages: (_a = options === null || options === void 0 ? void 0 : options.maxPages) !== null && _a !== void 0 ? _a : 20,
            maxDepth: (_b = options === null || options === void 0 ? void 0 : options.maxDepth) !== null && _b !== void 0 ? _b : 2,
            sameDomain: (_c = options === null || options === void 0 ? void 0 : options.sameDomain) !== null && _c !== void 0 ? _c : true,
            includePatterns: (_d = options === null || options === void 0 ? void 0 : options.includePatterns) !== null && _d !== void 0 ? _d : [],
            excludePatterns: (_e = options === null || options === void 0 ? void 0 : options.excludePatterns) !== null && _e !== void 0 ? _e : [],
            delayMs: (_f = options === null || options === void 0 ? void 0 : options.delayMs) !== null && _f !== void 0 ? _f : 500,
            timeout: (_g = options === null || options === void 0 ? void 0 : options.timeout) !== null && _g !== void 0 ? _g : 10000,
        };
    }
    /**
     * Crawl a website starting from a URL, following links up to maxDepth.
     * Yields progress updates for each page crawled.
     */
    crawl(startUrl) {
        return __asyncGenerator(this, arguments, function* crawl_1() {
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
                yield yield __await({
                    crawled: pages.length,
                    queued: queue.length,
                    total: pages.length + queue.length + 1,
                    currentUrl: normalized,
                    pages,
                    errors,
                });
                try {
                    const page = yield __await(this.fetchPage(normalized, item.depth));
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
                        yield __await(new Promise((r) => setTimeout(r, this.options.delayMs)));
                    }
                }
                catch (err) {
                    errors.push({ url: normalized, error: err instanceof Error ? err.message : String(err) });
                }
            }
            // Final progress
            yield yield __await({
                crawled: pages.length,
                queued: 0,
                total: pages.length,
                currentUrl: '',
                pages,
                errors,
            });
        });
    }
    /**
     * Fetch a single page and extract text + links.
     */
    async fetchPage(url, depth) {
        var _a;
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
            const title = (_a = this.extractTitle(html)) !== null && _a !== void 0 ? _a : new URL(url).pathname;
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
            catch ( /* invalid URL */_a) { /* invalid URL */ }
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
        catch (_a) {
            return url;
        }
    }
    shouldCrawl(url, startUrl) {
        var _a;
        try {
            const target = new URL(url);
            const origin = new URL(startUrl);
            // Same-domain check
            if (this.options.sameDomain && target.hostname !== origin.hostname)
                return false;
            // Skip non-HTML resources
            const ext = (_a = target.pathname.split('.').pop()) === null || _a === void 0 ? void 0 : _a.toLowerCase();
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
        catch (_b) {
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
