import { z } from 'zod';
import { defineIntegration } from '../base/define-integration.js';
const NOTION_API = 'https://api.notion.com/v1';
async function notionFetch(path, token, options = {}) {
    const res = await fetch(`${NOTION_API}${path}`, {
        method: options.method ?? 'GET',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Notion-Version': '2022-06-28',
        },
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Notion API error ${res.status}: ${err}`);
    }
    return res.json();
}
export const notionIntegration = defineIntegration({
    id: 'notion',
    name: 'Notion',
    description: 'Search, read, and create pages and databases in Notion',
    icon: '📝',
    category: 'productivity',
    auth: {
        type: 'bearer',
        fields: [
            {
                key: 'token',
                label: 'Internal Integration Token',
                type: 'secret',
                required: true,
                envVar: 'NOTION_TOKEN',
                placeholder: 'secret_...',
            },
        ],
    },
    actions: [
        {
            name: 'search',
            description: 'Search pages and databases in Notion',
            parameters: z.object({
                query: z.string().describe('Search query'),
                filter: z.enum(['page', 'database']).optional(),
                pageSize: z.number().default(10),
            }),
            riskLevel: 'safe',
            execute: async (args, ctx) => {
                const token = ctx.credentials.token;
                if (!token)
                    return { success: false, error: 'Notion token not configured' };
                try {
                    const body = { query: args.query, page_size: args.pageSize };
                    if (args.filter)
                        body.filter = { value: args.filter, property: 'object' };
                    const data = await notionFetch('/search', token, { method: 'POST', body });
                    return { success: true, data };
                }
                catch (err) {
                    return { success: false, error: err instanceof Error ? err.message : 'Notion search failed' };
                }
            },
        },
        {
            name: 'get_page',
            description: 'Get a Notion page by ID',
            parameters: z.object({
                pageId: z.string().describe('Notion page ID'),
            }),
            riskLevel: 'safe',
            execute: async (args, ctx) => {
                const token = ctx.credentials.token;
                if (!token)
                    return { success: false, error: 'Notion token not configured' };
                try {
                    const data = await notionFetch(`/pages/${args.pageId}`, token);
                    return { success: true, data };
                }
                catch (err) {
                    return { success: false, error: err instanceof Error ? err.message : 'Notion get_page failed' };
                }
            },
        },
        {
            name: 'create_page',
            description: 'Create a new page in Notion',
            parameters: z.object({
                parentId: z.string().describe('Parent page or database ID'),
                title: z.string().describe('Page title'),
                content: z.string().optional().describe('Page content (markdown)'),
            }),
            riskLevel: 'moderate',
            execute: async (args, ctx) => {
                const token = ctx.credentials.token;
                if (!token)
                    return { success: false, error: 'Notion token not configured' };
                try {
                    const body = {
                        parent: { page_id: args.parentId },
                        properties: {
                            title: { title: [{ text: { content: args.title } }] },
                        },
                    };
                    if (args.content) {
                        body.children = [{
                                object: 'block',
                                type: 'paragraph',
                                paragraph: { rich_text: [{ type: 'text', text: { content: args.content } }] },
                            }];
                    }
                    const data = await notionFetch('/pages', token, { method: 'POST', body });
                    return { success: true, data };
                }
                catch (err) {
                    return { success: false, error: err instanceof Error ? err.message : 'Notion create_page failed' };
                }
            },
        },
        {
            name: 'query_database',
            description: 'Query a Notion database with filters',
            parameters: z.object({
                databaseId: z.string().describe('Database ID'),
                filter: z.record(z.unknown()).optional().describe('Filter object'),
                pageSize: z.number().default(20),
            }),
            riskLevel: 'safe',
            execute: async (args, ctx) => {
                const token = ctx.credentials.token;
                if (!token)
                    return { success: false, error: 'Notion token not configured' };
                try {
                    const body = { page_size: args.pageSize };
                    if (args.filter)
                        body.filter = args.filter;
                    const data = await notionFetch(`/databases/${args.databaseId}/query`, token, { method: 'POST', body });
                    return { success: true, data };
                }
                catch (err) {
                    return { success: false, error: err instanceof Error ? err.message : 'Notion query_database failed' };
                }
            },
        },
    ],
});
//# sourceMappingURL=notion.js.map