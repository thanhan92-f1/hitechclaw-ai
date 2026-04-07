export declare const tavilySearchIntegration: import("../index.js").IntegrationDefinition;
/**
 * Standalone Tavily web search helper — used by chat.ts for inline web search.
 * Falls back to empty results if no API key or if Tavily fails.
 */
export declare function tavilyWebSearch(query: string, apiKey: string, maxResults?: number): Promise<Array<{
    title: string;
    url: string;
    snippet: string;
}>>;
//# sourceMappingURL=tavily-search.d.ts.map