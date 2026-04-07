import { defineDomainPack } from '../base/domain-pack.js';
export const ecommerceDomain = defineDomainPack({
    id: 'ecommerce',
    name: 'E-Commerce',
    description: 'Product descriptions, inventory analysis, pricing strategies, customer support templates, and order tracking.',
    icon: '🛒',
    skills: [
        {
            id: 'product-content',
            name: 'Product Content',
            description: 'Generate product descriptions, titles, and marketing copy.',
            version: '1.0.0',
            category: 'ecommerce',
            tools: [
                {
                    name: 'generate_product_description',
                    description: 'Generate SEO-optimized product descriptions.',
                    parameters: {
                        type: 'object',
                        properties: {
                            productName: { type: 'string' },
                            features: { type: 'array', items: { type: 'string' } },
                            targetAudience: { type: 'string' },
                            platform: { type: 'string', description: 'shopify, amazon, ebay, etc.' },
                        },
                        required: ['productName', 'features'],
                    },
                    execute: async (params) => ({
                        success: true,
                        data: { _llmTool: true, toolPrompt: `Generate an SEO-optimized product description for "${params.productName}"${params.platform ? ` for ${params.platform}` : ''}. Features: ${Array.isArray(params.features) ? params.features.join(', ') : params.features}.${params.targetAudience ? ` Target audience: ${params.targetAudience}.` : ''} Include: title, bullet points, full description, and SEO keywords.` },
                    }),
                },
            ],
        },
        {
            id: 'customer-support',
            name: 'Customer Support Templates',
            description: 'Generate customer support responses and FAQ content.',
            version: '1.0.0',
            category: 'ecommerce',
            tools: [
                {
                    name: 'generate_support_response',
                    description: 'Generate a customer support response for common scenarios.',
                    parameters: {
                        type: 'object',
                        properties: {
                            scenario: { type: 'string', description: 'refund, shipping_delay, product_issue, general_inquiry' },
                            customerMessage: { type: 'string' },
                            tone: { type: 'string', description: 'empathetic, professional, friendly' },
                        },
                        required: ['scenario', 'customerMessage'],
                    },
                    execute: async (params) => ({
                        success: true,
                        data: { _llmTool: true, toolPrompt: `Generate a ${params.tone || 'empathetic'} customer support response for a ${params.scenario} scenario. Customer message: "${params.customerMessage}". Be helpful, solution-oriented, and maintain brand voice.` },
                    }),
                },
            ],
        },
    ],
    agentPersona: `You are HiTechClaw Commerce, an AI assistant for e-commerce businesses. You help with product content, customer support, inventory analysis, pricing strategies, and marketplace optimization.

Focus on:
- Conversion-optimized product copy
- SEO-friendly content
- Customer-centric support responses
- Data-driven pricing recommendations`,
    recommendedIntegrations: ['gmail', 'slack-api', 'notion'],
});
//# sourceMappingURL=ecommerce.js.map