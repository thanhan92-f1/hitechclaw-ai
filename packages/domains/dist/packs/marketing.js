import { defineDomainPack } from '../base/domain-pack.js';
export const marketingDomain = defineDomainPack({
    id: 'marketing',
    name: 'Marketing & Social Media',
    description: 'Content marketing, SEO optimization, social media management, email campaigns, and analytics.',
    icon: '📣',
    skills: [
        {
            id: 'content-marketing',
            name: 'Content Marketing',
            description: 'Create blog posts, social media content, ad copy, and marketing materials.',
            version: '1.0.0',
            category: 'marketing',
            tools: [
                {
                    name: 'generate_social_post',
                    description: 'Generate social media posts for different platforms.',
                    parameters: {
                        type: 'object',
                        properties: {
                            platform: { type: 'string', description: 'twitter, facebook, instagram, linkedin, tiktok' },
                            topic: { type: 'string' },
                            tone: { type: 'string', description: 'professional, casual, humorous, inspirational' },
                            includeHashtags: { type: 'boolean' },
                        },
                        required: ['platform', 'topic'],
                    },
                    execute: async (params) => ({
                        success: true,
                        data: { _llmTool: true, toolPrompt: `Generate a ${params.tone || 'professional'} social media post for ${params.platform}. Topic: ${params.topic}${params.includeHashtags ? '. Include relevant hashtags.' : ''}. Follow platform best practices for ${params.platform}.` },
                    }),
                },
                {
                    name: 'seo_keyword_analysis',
                    description: 'Analyze and suggest SEO keywords for a topic.',
                    parameters: {
                        type: 'object',
                        properties: {
                            topic: { type: 'string' },
                            targetAudience: { type: 'string' },
                            language: { type: 'string', description: 'Target language (default: en)' },
                        },
                        required: ['topic'],
                    },
                    execute: async (params) => ({
                        success: true,
                        data: { _llmTool: true, toolPrompt: `Suggest SEO keywords for topic: "${params.topic}"${params.targetAudience ? ` targeting ${params.targetAudience}` : ''}. Include primary keywords, long-tail keywords, and search intent analysis. Format as a structured list with estimated search volume categories (high/medium/low).` },
                    }),
                },
            ],
        },
    ],
    agentPersona: `You are HiTechClaw Marketing, an AI assistant specializing in digital marketing, content creation, and social media strategy. You help with creating engaging content, planning campaigns, SEO optimization, and analyzing marketing performance.

Tailor content to each platform's best practices. Consider audience demographics and engagement patterns. Suggest A/B testing strategies when appropriate.`,
    recommendedIntegrations: ['brave-search', 'notion', 'slack-api'],
});
//# sourceMappingURL=marketing.js.map