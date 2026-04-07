import { z } from 'zod';
import { defineIntegration } from '../base/define-integration.js';
const TAVILY_API_URL = 'https://api.tavily.com';
async function tavilyFetch(endpoint, body, apiKey) {
    const res = await fetch(`${TAVILY_API_URL}/${endpoint}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Tavily API error ${res.status}: ${text}`);
    }
    return res.json();
}
export const tavilySearchIntegration = defineIntegration({
    id: 'tavily-search',
    name: 'Tavily Search',
    description: 'AI-optimized web search via Tavily API — returns clean, relevant results for LLM consumption',
    icon: '🔎',
    category: 'search',
    auth: {
        type: 'api-key',
        fields: [
            {
                key: 'apiKey',
                label: 'Tavily API Key',
                type: 'secret',
                required: true,
                envVar: 'TAVILY_API_KEY',
                placeholder: 'tvly-...',
            },
        ],
    },
    actions: [
        {
            name: 'search',
            description: 'Search the web using Tavily — optimized for AI agents with clean extracted content',
            parameters: z.object({
                query: z.string().describe('Search query'),
                search_depth: z
                    .enum(['basic', 'advanced'])
                    .default('basic')
                    .describe('basic = fast, advanced = deeper with more content'),
                max_results: z.number().min(1).max(20).default(5).describe('Number of results (1-20)'),
                include_answer: z
                    .boolean()
                    .default(false)
                    .describe('Include AI-generated answer summary'),
                include_raw_content: z
                    .boolean()
                    .default(false)
                    .describe('Include full page raw content'),
                topic: z
                    .enum(['general', 'news'])
                    .default('general')
                    .describe('Search topic category'),
                days: z
                    .number()
                    .optional()
                    .describe('Only return results from the last N days (for news)'),
                include_domains: z
                    .array(z.string())
                    .optional()
                    .describe('Only include results from these domains'),
                exclude_domains: z
                    .array(z.string())
                    .optional()
                    .describe('Exclude results from these domains'),
            }),
            riskLevel: 'safe',
            execute: async (args, ctx) => {
                var _a, _b;
                const params = args;
                const apiKey = ctx.credentials.apiKey;
                try {
                    const data = await tavilyFetch('search', Object.assign(Object.assign(Object.assign({ query: params.query, search_depth: params.search_depth, max_results: params.max_results, include_answer: params.include_answer, include_raw_content: params.include_raw_content, topic: params.topic }, (params.days && { days: params.days })), (((_a = params.include_domains) === null || _a === void 0 ? void 0 : _a.length) && { include_domains: params.include_domains })), (((_b = params.exclude_domains) === null || _b === void 0 ? void 0 : _b.length) && { exclude_domains: params.exclude_domains })), apiKey);
                    return {
                        success: true,
                        data: {
                            query: data.query,
                            answer: data.answer,
                            results: data.results.map((r) => ({
                                title: r.title,
                                url: r.url,
                                content: r.content,
                                score: r.score,
                            })),
                            response_time: data.response_time,
                        },
                    };
                }
                catch (err) {
                    return {
                        success: false,
                        error: err instanceof Error ? err.message : 'Tavily search failed',
                    };
                }
            },
        },
        {
            name: 'extract',
            description: 'Extract clean content from URLs using Tavily Extract API',
            parameters: z.object({
                urls: z
                    .array(z.string().url())
                    .min(1)
                    .max(5)
                    .describe('URLs to extract content from (max 5)'),
            }),
            riskLevel: 'safe',
            execute: async (args, ctx) => {
                const { urls } = args;
                const apiKey = ctx.credentials.apiKey;
                try {
                    const res = await fetch(`${TAVILY_API_URL}/extract`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${apiKey}`,
                        },
                        body: JSON.stringify({ urls }),
                        signal: AbortSignal.timeout(20000),
                    });
                    if (!res.ok) {
                        const text = await res.text().catch(() => '');
                        throw new Error(`Tavily Extract error ${res.status}: ${text}`);
                    }
                    const data = (await res.json());
                    return {
                        success: true,
                        data: data.results.map((r) => {
                            var _a;
                            return ({
                                url: r.url,
                                content: (_a = r.raw_content) === null || _a === void 0 ? void 0 : _a.slice(0, 10000),
                            });
                        }),
                    };
                }
                catch (err) {
                    return {
                        success: false,
                        error: err instanceof Error ? err.message : 'Tavily extract failed',
                    };
                }
            },
        },
    ],
});
/**
 * Standalone Tavily web search helper — used by chat.ts for inline web search.
 * Falls back to empty results if no API key or if Tavily fails.
 */
export async function tavilyWebSearch(query, apiKey, maxResults = 5) {
    if (!apiKey)
        return [];
    try {
        const data = await tavilyFetch('search', {
            query,
            search_depth: 'basic',
            max_results: maxResults,
            include_answer: false,
            topic: 'general',
        }, apiKey);
        return data.results.map((r) => ({
            title: r.title,
            url: r.url,
            snippet: r.content.slice(0, 500),
        }));
    }
    catch (_a) {
        return [];
    }
}
