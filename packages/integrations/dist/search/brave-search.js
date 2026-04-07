import { z } from 'zod';
import { defineIntegration } from '../base/define-integration.js';
const BRAVE_API = 'https://api.search.brave.com/res/v1';
async function braveGet(path, apiKey, params) {
    const url = new URL(`${BRAVE_API}${path}`);
    for (const [k, v] of Object.entries(params))
        if (v)
            url.searchParams.set(k, v);
    const res = await fetch(url.toString(), {
        headers: { 'X-Subscription-Token': apiKey, Accept: 'application/json' },
        signal: AbortSignal.timeout(10000),
    });
    if (!res.ok)
        throw new Error(`Brave API error ${res.status}`);
    return res.json();
}
export const braveSearchIntegration = defineIntegration({
    id: 'brave-search',
    name: 'Brave Search',
    description: 'Search the web using Brave Search API',
    icon: '🔍',
    category: 'search',
    auth: {
        type: 'api-key',
        fields: [
            {
                key: 'apiKey',
                label: 'Brave Search API Key',
                type: 'secret',
                required: true,
                envVar: 'BRAVE_SEARCH_API_KEY',
            },
        ],
    },
    actions: [
        {
            name: 'web_search',
            description: 'Search the web using Brave Search',
            parameters: z.object({
                query: z.string().describe('Search query'),
                count: z.number().default(5).describe('Number of results'),
                freshness: z.enum(['pd', 'pw', 'pm', 'py']).optional().describe('pd=past day, pw=past week, pm=past month'),
            }),
            riskLevel: 'safe',
            execute: async (args, ctx) => {
                var _a, _b, _c, _d, _e;
                const apiKey = ctx.credentials.apiKey;
                if (!apiKey)
                    return { success: false, error: 'Brave Search API key not configured' };
                const data = await braveGet('/web/search', apiKey, { q: args.query, count: String(args.count), freshness: (_a = args.freshness) !== null && _a !== void 0 ? _a : '' });
                const results = ((_c = (_b = data.web) === null || _b === void 0 ? void 0 : _b.results) !== null && _c !== void 0 ? _c : []).map((r) => ({ title: r.title, url: r.url, description: r.description }));
                return { success: true, data: { query: args.query, results, answer: (_e = (_d = data.summarizer) === null || _d === void 0 ? void 0 : _d.key) !== null && _e !== void 0 ? _e : '' } };
            },
        },
        {
            name: 'news_search',
            description: 'Search news articles using Brave Search',
            parameters: z.object({
                query: z.string().describe('News search query'),
                count: z.number().default(5),
                freshness: z.enum(['pd', 'pw', 'pm']).optional(),
            }),
            riskLevel: 'safe',
            execute: async (args, ctx) => {
                var _a, _b;
                const apiKey = ctx.credentials.apiKey;
                if (!apiKey)
                    return { success: false, error: 'Brave Search API key not configured' };
                const data = await braveGet('/news/search', apiKey, { q: args.query, count: String(args.count), freshness: (_a = args.freshness) !== null && _a !== void 0 ? _a : '' });
                const results = ((_b = data.results) !== null && _b !== void 0 ? _b : []).map((r) => { var _a; return ({ title: r.title, url: r.url, description: r.description, age: r.age, source: (_a = r.meta_url) === null || _a === void 0 ? void 0 : _a.hostname }); });
                return { success: true, data: { query: args.query, results } };
            },
        },
    ],
});
