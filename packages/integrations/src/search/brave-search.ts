import { z } from 'zod';
import { defineIntegration } from '../base/define-integration.js';

const BRAVE_API = 'https://api.search.brave.com/res/v1';

async function braveGet(path: string, apiKey: string, params: Record<string, string>): Promise<any> {
  const url = new URL(`${BRAVE_API}${path}`);
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    headers: { 'X-Subscription-Token': apiKey, Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Brave API error ${res.status}`);
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
        const apiKey = ctx.credentials.apiKey;
        if (!apiKey) return { success: false, error: 'Brave Search API key not configured' };
        const data = await braveGet('/web/search', apiKey, { q: args.query, count: String(args.count), freshness: args.freshness ?? '' });
        const results = (data.web?.results ?? []).map((r: any) => ({ title: r.title, url: r.url, description: r.description }));
        return { success: true, data: { query: args.query, results, answer: data.summarizer?.key ?? '' } };
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
        const apiKey = ctx.credentials.apiKey;
        if (!apiKey) return { success: false, error: 'Brave Search API key not configured' };
        const data = await braveGet('/news/search', apiKey, { q: args.query, count: String(args.count), freshness: args.freshness ?? '' });
        const results = (data.results ?? []).map((r: any) => ({ title: r.title, url: r.url, description: r.description, age: r.age, source: r.meta_url?.hostname }));
        return { success: true, data: { query: args.query, results } };
      },
    },
  ],
});
