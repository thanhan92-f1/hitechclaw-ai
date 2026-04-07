import { z } from 'zod';
import { defineIntegration } from '../base/define-integration.js';
const GITHUB_API = 'https://api.github.com';
async function ghFetch(path, token, options = {}) {
    const res = await fetch(`${GITHUB_API}${path}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json',
            ...(options.headers ?? {}),
        },
        signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `GitHub API error ${res.status}`);
    }
    return res.status === 204 ? {} : res.json();
}
export const githubIntegration = defineIntegration({
    id: 'github',
    name: 'GitHub',
    description: 'Manage repositories, issues, pull requests, and code on GitHub',
    icon: '🐙',
    category: 'developer',
    auth: {
        type: 'bearer',
        fields: [
            {
                key: 'token',
                label: 'Personal Access Token',
                type: 'secret',
                required: true,
                envVar: 'GITHUB_TOKEN',
                placeholder: 'ghp_...',
            },
        ],
    },
    actions: [
        {
            name: 'list_repos',
            description: 'List repositories for the authenticated user',
            parameters: z.object({
                type: z.enum(['all', 'owner', 'member']).default('owner'),
                sort: z.enum(['created', 'updated', 'pushed', 'full_name']).default('updated'),
                perPage: z.number().default(10),
            }),
            riskLevel: 'safe',
            execute: async (args, ctx) => {
                const token = ctx.credentials.token;
                if (!token)
                    return { success: false, error: 'GitHub token not configured' };
                const repos = await ghFetch(`/user/repos?type=${args.type}&sort=${args.sort}&per_page=${args.perPage}`, token);
                return { success: true, data: repos.map((r) => ({ id: r.id, name: r.full_name, description: r.description, private: r.private, url: r.html_url, language: r.language, stars: r.stargazers_count, updatedAt: r.updated_at })) };
            },
        },
        {
            name: 'create_issue',
            description: 'Create a new issue in a GitHub repository',
            parameters: z.object({
                owner: z.string().describe('Repository owner'),
                repo: z.string().describe('Repository name'),
                title: z.string().describe('Issue title'),
                body: z.string().optional().describe('Issue body (markdown)'),
                labels: z.array(z.string()).optional(),
                assignees: z.array(z.string()).optional(),
            }),
            riskLevel: 'moderate',
            execute: async (args, ctx) => {
                const token = ctx.credentials.token;
                if (!token)
                    return { success: false, error: 'GitHub token not configured' };
                const issue = await ghFetch(`/repos/${args.owner}/${args.repo}/issues`, token, {
                    method: 'POST',
                    body: JSON.stringify({ title: args.title, body: args.body, labels: args.labels, assignees: args.assignees }),
                });
                return { success: true, data: { number: issue.number, url: issue.html_url, title: issue.title } };
            },
        },
        {
            name: 'list_issues',
            description: 'List issues in a GitHub repository',
            parameters: z.object({
                owner: z.string().describe('Repository owner'),
                repo: z.string().describe('Repository name'),
                state: z.enum(['open', 'closed', 'all']).default('open'),
                labels: z.string().optional().describe('Comma-separated label names'),
                perPage: z.number().default(10),
            }),
            riskLevel: 'safe',
            execute: async (args, ctx) => {
                const token = ctx.credentials.token;
                if (!token)
                    return { success: false, error: 'GitHub token not configured' };
                const params = new URLSearchParams({ state: args.state, per_page: String(args.perPage) });
                if (args.labels)
                    params.set('labels', args.labels);
                const issues = await ghFetch(`/repos/${args.owner}/${args.repo}/issues?${params}`, token);
                return { success: true, data: issues.map((i) => ({ number: i.number, title: i.title, state: i.state, url: i.html_url, labels: i.labels.map((l) => l.name), assignees: i.assignees.map((a) => a.login), createdAt: i.created_at })) };
            },
        },
        {
            name: 'create_pull_request',
            description: 'Create a pull request',
            parameters: z.object({
                owner: z.string(),
                repo: z.string(),
                title: z.string(),
                body: z.string().optional(),
                head: z.string().describe('Branch with changes'),
                base: z.string().default('main').describe('Target branch'),
            }),
            riskLevel: 'moderate',
            requiresApproval: true,
            execute: async (args, ctx) => {
                const token = ctx.credentials.token;
                if (!token)
                    return { success: false, error: 'GitHub token not configured' };
                const pr = await ghFetch(`/repos/${args.owner}/${args.repo}/pulls`, token, {
                    method: 'POST',
                    body: JSON.stringify({ title: args.title, body: args.body, head: args.head, base: args.base }),
                });
                return { success: true, data: { number: pr.number, url: pr.html_url, title: pr.title, state: pr.state } };
            },
        },
        {
            name: 'get_file_contents',
            description: 'Get contents of a file from a repository',
            parameters: z.object({
                owner: z.string(),
                repo: z.string(),
                path: z.string().describe('File path in the repository'),
                ref: z.string().optional().describe('Branch, tag, or commit SHA'),
            }),
            riskLevel: 'safe',
            execute: async (args, ctx) => {
                const token = ctx.credentials.token;
                if (!token)
                    return { success: false, error: 'GitHub token not configured' };
                const params = args.ref ? `?ref=${encodeURIComponent(args.ref)}` : '';
                const file = await ghFetch(`/repos/${args.owner}/${args.repo}/contents/${args.path}${params}`, token);
                const content = file.encoding === 'base64' ? Buffer.from(file.content, 'base64').toString('utf-8') : file.content;
                return { success: true, data: { name: file.name, path: file.path, content, size: file.size, sha: file.sha, url: file.html_url } };
            },
        },
    ],
    triggers: [
        {
            name: 'push',
            description: 'Fires when code is pushed to a repository',
            eventSchema: z.object({
                ref: z.string(),
                repository: z.string(),
                pusher: z.string(),
                commits: z.array(z.object({
                    message: z.string(),
                    author: z.string(),
                })),
            }),
        },
        {
            name: 'issue_opened',
            description: 'Fires when a new issue is opened',
            eventSchema: z.object({
                action: z.string(),
                issueNumber: z.number(),
                title: z.string(),
                body: z.string().optional(),
                author: z.string(),
                repository: z.string(),
            }),
        },
    ],
});
//# sourceMappingURL=github.js.map