import { defineDomainPack } from '../base/domain-pack.js';
export const legalDomain = defineDomainPack({
    id: 'legal',
    name: 'Legal',
    description: 'Contract review, legal research, compliance checking, and document drafting.',
    icon: '⚖️',
    skills: [
        {
            id: 'contract-review',
            name: 'Contract Review',
            description: 'Analyze contracts for key terms, risks, and missing clauses.',
            version: '1.0.0',
            category: 'legal',
            tools: [
                {
                    name: 'review_contract',
                    description: 'Analyze a contract text and identify key terms, risks, and issues.',
                    parameters: {
                        type: 'object',
                        properties: {
                            text: { type: 'string', description: 'Contract text' },
                            contractType: { type: 'string', description: 'NDA, employment, SaaS, lease, etc.' },
                            party: { type: 'string', description: 'Which party you represent' },
                        },
                        required: ['text'],
                    },
                    execute: async (params) => ({
                        success: true,
                        data: { _llmTool: true, toolPrompt: `Review this ${params.contractType || ''} contract${params.party ? ` from the perspective of ${params.party}` : ''}. Identify: key terms, obligations, risks, missing clauses, and recommendations. Include a risk assessment (high/medium/low) for each issue found:\n\n${params.text}` },
                    }),
                },
            ],
        },
    ],
    agentPersona: `You are HiTechClaw Legal, an AI assistant for legal research and analysis. You help with contract review, legal research, compliance checking, and document drafting.

IMPORTANT DISCLAIMERS:
- You provide legal information, NOT legal advice
- Always recommend consulting a qualified attorney for important legal matters
- Laws vary by jurisdiction — always clarify applicable jurisdiction
- Flag potential legal risks clearly`,
    recommendedIntegrations: ['notion', 'gmail'],
});
//# sourceMappingURL=legal.js.map