import { defineDomainPack } from '../base/domain-pack.js';

export const salesDomain = defineDomainPack({
  id: 'sales',
  name: 'Sales & CRM',
  description: 'Lead management, sales pitches, proposal writing, follow-up automation, and pipeline tracking.',
  icon: '🤝',
  skills: [
    {
      id: 'sales-content',
      name: 'Sales Content',
      description: 'Create proposals, pitches, follow-up emails, and sales materials.',
      version: '1.0.0',
      category: 'sales',
      tools: [
        {
          name: 'generate_proposal',
          description: 'Generate a sales proposal or pitch deck outline.',
          parameters: {
            type: 'object',
            properties: {
              product: { type: 'string', description: 'Product or service name' },
              prospect: { type: 'string', description: 'Target company or audience' },
              painPoints: { type: 'array', items: { type: 'string' } },
              budget: { type: 'string' },
            },
            required: ['product', 'prospect'],
          },
          execute: async (params: any) => ({
            success: true,
            data: { _llmTool: true, toolPrompt: `Create a sales proposal for "${params.product}" targeting "${params.prospect}".${params.painPoints ? ` Key pain points: ${Array.isArray(params.painPoints) ? params.painPoints.join(', ') : params.painPoints}.` : ''}${params.budget ? ` Budget: ${params.budget}.` : ''} Include: executive summary, problem statement, proposed solution, pricing, ROI analysis, and next steps.` },
          }),
        },
        {
          name: 'generate_followup_email',
          description: 'Generate a follow-up email for a sales lead.',
          parameters: {
            type: 'object',
            properties: {
              context: { type: 'string', description: 'Previous interaction context' },
              tone: { type: 'string', description: 'warm, professional, urgent' },
              callToAction: { type: 'string' },
            },
            required: ['context'],
          },
          execute: async (params: any) => ({
            success: true,
            data: { _llmTool: true, toolPrompt: `Write a ${params.tone || 'professional'} follow-up email. Context: ${params.context}.${params.callToAction ? ` Call to action: ${params.callToAction}.` : ''} Keep it concise, warm, and action-oriented.` },
          }),
        },
      ],
    },
  ],
  agentPersona: `You are HiTechClaw Sales, an AI assistant for sales professionals. You help with proposal creation, pitch preparation, lead qualification, follow-up strategies, and pipeline management.

Sales principles:
- Focus on value proposition and solving customer pain points
- Use SPIN (Situation, Problem, Implication, Need-payoff) selling techniques
- Personalize communications based on prospect research
- Maintain professional, non-pushy tone`,
  recommendedIntegrations: ['gmail', 'google-calendar', 'slack-api', 'notion'],
});
