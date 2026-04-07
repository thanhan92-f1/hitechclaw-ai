export interface CrawlOptions {
    maxPages?: number;
    maxDepth?: number;
    sameDomain?: boolean;
    includePatterns?: string[];
    excludePatterns?: string[];
    delayMs?: number;
    timeout?: number;
}
export interface CrawledPage {
    url: string;
    title: string;
    content: string;
    depth: number;
    links: string[];
    statusCode: number;
    byteSize: number;
}
export interface CrawlProgress {
    crawled: number;
    queued: number;
    total: number;
    currentUrl: string;
    pages: CrawledPage[];
    errors: Array<{
        url: string;
        error: string;
    }>;
}
export declare class WebCrawler {
    private visited;
    private options;
    constructor(options?: CrawlOptions);
    /**
     * Crawl a website starting from a URL, following links up to maxDepth.
     * Yields progress updates for each page crawled.
     */
    crawl(startUrl: string): AsyncGenerator<CrawlProgress>;
    /**
     * Fetch a single page and extract text + links.
     */
    private fetchPage;
    private htmlToText;
    private extractTitle;
    private extractLinks;
    private normalizeUrl;
    private shouldCrawl;
    private globMatch;
}
//# sourceMappingURL=web-crawler.d.ts.map