import { defineDomainPack } from '../base/domain-pack.js';
export const hrDomain = defineDomainPack({
    id: 'hr',
    name: 'Human Resources',
    description: 'Job descriptions, interview prep, employee onboarding, policy drafting, and performance reviews.',
    icon: '👥',
    skills: [
        {
            id: 'recruitment',
            name: 'Recruitment Assistant',
            description: 'Create job descriptions, screen resumes, and prepare interview questions.',
            version: '1.0.0',
            category: 'hr',
            tools: [
                {
                    name: 'generate_job_description',
                    description: 'Generate a professional job description.',
                    parameters: {
                        type: 'object',
                        properties: {
                            title: { type: 'string' },
                            department: { type: 'string' },
                            level: { type: 'string', description: 'junior, mid, senior, lead, manager' },
                            skills: { type: 'array', items: { type: 'string' } },
                            remote: { type: 'boolean' },
                        },
                        required: ['title'],
                    },
                    execute: async (params) => ({
                        success: true,
                        data: { _llmTool: true, toolPrompt: `Generate a professional job description for "${params.title}"${params.department ? ` in ${params.department}` : ''} at ${params.level || 'mid'} level.${params.remote ? ' This is a remote position.' : ''} Required skills: ${Array.isArray(params.skills) ? params.skills.join(', ') : 'relevant skills'}. Include: overview, responsibilities, requirements, benefits, and equal opportunity statement.` },
                    }),
                },
                {
                    name: 'generate_interview_questions',
                    description: 'Generate interview questions for a role.',
                    parameters: {
                        type: 'object',
                        properties: {
                            role: { type: 'string' },
                            type: { type: 'string', description: 'behavioral, technical, situational' },
                            count: { type: 'number' },
                        },
                        required: ['role'],
                    },
                    execute: async (params) => ({
                        success: true,
                        data: { _llmTool: true, toolPrompt: `Generate ${params.count || 10} ${params.type || 'behavioral'} interview questions for a ${params.role} role. Include evaluation criteria for each question.` },
                    }),
                },
            ],
        },
    ],
    agentPersona: `You are HiTechClaw HR, an AI assistant for human resources and talent management. You help with recruitment, employee onboarding, policy creation, performance management, and workplace culture.

Follow HR best practices:
- Use inclusive, non-discriminatory language
- Comply with labor law guidelines
- Focus on competency-based assessment
- Protect employee privacy and confidentiality`,
    recommendedIntegrations: ['gmail', 'google-calendar', 'notion', 'slack-api'],
});
//# sourceMappingURL=hr.js.map