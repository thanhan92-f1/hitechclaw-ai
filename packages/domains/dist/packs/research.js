import { defineDomainPack } from '../base/domain-pack.js';
export const researchDomain = defineDomainPack({
    id: 'research',
    name: 'Research & Academic',
    description: 'Literature review, paper summarization, citation management, data analysis, and academic writing.',
    icon: '🔬',
    skills: [
        {
            id: 'paper-analysis',
            name: 'Paper Analysis',
            description: 'Summarize, compare, and extract key findings from research papers.',
            version: '1.0.0',
            category: 'research',
            tools: [
                {
                    name: 'summarize_paper',
                    description: 'Generate a structured summary of a research paper.',
                    parameters: {
                        type: 'object',
                        properties: {
                            text: { type: 'string', description: 'Paper text or abstract' },
                            format: { type: 'string', description: 'summary, tldr, key_findings, methodology' },
                        },
                        required: ['text'],
                    },
                    execute: async (params) => ({
                        success: true,
                        data: { _llmTool: true, toolPrompt: `Provide a structured ${params.format || 'summary'} of this research paper/text. Include: key findings, methodology, limitations, and implications:\n\n${params.text}` },
                    }),
                },
                {
                    name: 'search_papers',
                    description: 'Search for academic papers on a topic.',
                    parameters: {
                        type: 'object',
                        properties: {
                            query: { type: 'string' },
                            yearFrom: { type: 'number' },
                            yearTo: { type: 'number' },
                            maxResults: { type: 'number' },
                        },
                        required: ['query'],
                    },
                    execute: async (params) => ({
                        success: true,
                        data: { _llmTool: true, toolPrompt: `Search for academic papers about "${params.query}"${params.yearFrom ? ` from ${params.yearFrom}` : ''}${params.yearTo ? ` to ${params.yearTo}` : ''}. List ${params.maxResults || 5} relevant papers with: title, authors, year, journal, and brief summary. Note: These are AI-generated suggestions — verify with Google Scholar or PubMed.` },
                    }),
                },
            ],
        },
    ],
    agentPersona: `You are HiTechClaw Researcher, an AI assistant for academic research and scientific inquiry. You help with literature reviews, paper analysis, academic writing, statistical analysis, and research methodology.

Follow academic standards:
- Cite sources properly
- Distinguish between correlation and causation
- Note limitations and potential biases
- Use precise, measured language
- Present multiple perspectives on contested findings`,
    recommendedIntegrations: ['brave-search', 'notion', 'github'],
});
//# sourceMappingURL=research.js.map