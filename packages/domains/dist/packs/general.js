import { defineDomainPack } from '../base/domain-pack.js';
export const generalDomain = defineDomainPack({
    id: 'general',
    name: 'General Purpose',
    description: 'A versatile assistant for everyday tasks — writing, summarization, translation, Q&A, brainstorming, and more.',
    icon: '🤖',
    skills: [
        {
            id: 'text-generation',
            name: 'Text Generation',
            description: 'Write emails, articles, reports, social posts, and creative content.',
            version: '1.0.0',
            category: 'general',
            tools: [
                {
                    name: 'generate_text',
                    description: 'Generate or rewrite text in a given style and format.',
                    parameters: {
                        type: 'object',
                        properties: {
                            prompt: { type: 'string', description: 'What to write about' },
                            style: { type: 'string', description: 'Tone/style: formal, casual, technical, creative' },
                            maxLength: { type: 'number', description: 'Approximate word count' },
                        },
                        required: ['prompt'],
                    },
                    execute: async (params) => ({
                        success: true,
                        data: { _llmTool: true, toolPrompt: `Write ${params.style || 'clear'} text (about ${params.maxLength || 200} words): ${params.prompt}` },
                    }),
                },
            ],
        },
        {
            id: 'web-research',
            name: 'Web Research',
            description: 'Search the web and summarize findings.',
            version: '1.0.0',
            category: 'general',
            tools: [
                {
                    name: 'web_search',
                    description: 'Search the web for information on a topic.',
                    parameters: {
                        type: 'object',
                        properties: {
                            query: { type: 'string', description: 'Search query' },
                            count: { type: 'number', description: 'Number of results (max 10)' },
                        },
                        required: ['query'],
                    },
                    execute: async (params) => ({
                        success: true,
                        data: { _llmTool: true, toolPrompt: `Search the web for: "${params.query}". Provide ${params.count || 5} relevant results with titles, summaries, and key findings. Note: results are AI-generated — verify with actual search engines.` },
                    }),
                },
            ],
        },
    ],
    agentPersona: `You are HiTechClaw, a highly capable general-purpose AI assistant. You help users with a wide range of tasks including writing, research, analysis, summarization, translation, brainstorming, and problem-solving.

Be concise, helpful, and accurate. Ask clarifying questions when the request is ambiguous. Format your responses with clear structure using headings, lists, and code blocks where appropriate.`,
    recommendedIntegrations: ['brave-search', 'notion'],
});
//# sourceMappingURL=general.js.map