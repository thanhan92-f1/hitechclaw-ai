import { defineDomainPack } from '../base/domain-pack.js';
export const developerDomain = defineDomainPack({
    id: 'developer',
    name: 'Software Development',
    description: 'Coding assistance, code review, architecture design, debugging, and DevOps workflows.',
    icon: '💻',
    skills: [
        {
            id: 'code-generation',
            name: 'Code Generation',
            description: 'Generate, refactor, and review code across languages.',
            version: '1.0.0',
            category: 'programming',
            tools: [
                {
                    name: 'generate_code',
                    description: 'Generate code from a natural language description.',
                    parameters: {
                        type: 'object',
                        properties: {
                            description: { type: 'string', description: 'What the code should do' },
                            language: { type: 'string', description: 'Programming language' },
                            framework: { type: 'string', description: 'Framework or library to use' },
                        },
                        required: ['description'],
                    },
                    execute: async (params) => ({
                        success: true,
                        data: { _llmTool: true, toolPrompt: `Generate ${params.language || 'TypeScript'} code${params.framework ? ` using ${params.framework}` : ''}: ${params.description}. Provide clean, production-ready code with comments.` },
                    }),
                },
                {
                    name: 'review_code',
                    description: 'Review code for bugs, security issues, and best practices.',
                    parameters: {
                        type: 'object',
                        properties: {
                            code: { type: 'string', description: 'Code to review' },
                            language: { type: 'string', description: 'Programming language' },
                        },
                        required: ['code'],
                    },
                    execute: async (params) => ({
                        success: true,
                        data: { _llmTool: true, toolPrompt: `Review this ${params.language || ''} code for bugs, security issues (OWASP Top 10), performance, and best practices. Provide specific, actionable feedback:\n\n\`\`\`\n${params.code}\n\`\`\`` },
                    }),
                },
            ],
        },
        {
            id: 'git-operations',
            name: 'Git Operations',
            description: 'Generate Git commands and workflows.',
            version: '1.0.0',
            category: 'programming',
            tools: [
                {
                    name: 'generate_gitignore',
                    description: 'Generate a .gitignore file for a project type.',
                    parameters: {
                        type: 'object',
                        properties: {
                            projectType: { type: 'string', description: 'Project type: node, python, java, go, rust, etc.' },
                            extras: { type: 'array', items: { type: 'string' }, description: 'Additional patterns to ignore' },
                        },
                        required: ['projectType'],
                    },
                    execute: async (params) => {
                        const templates = {
                            node: ['node_modules/', 'dist/', '.env', '.env.local', '*.log', 'coverage/', '.DS_Store', '.turbo/'],
                            python: ['__pycache__/', '*.py[cod]', '.env', 'venv/', '.venv/', 'dist/', '*.egg-info/', '.pytest_cache/'],
                            java: ['target/', '*.class', '*.jar', '.idea/', '*.iml', '.gradle/', 'build/'],
                            go: ['bin/', 'vendor/', '*.exe', '*.test', '*.out'],
                            rust: ['target/', 'Cargo.lock', '*.pdb'],
                        };
                        const base = templates[params.projectType?.toLowerCase()] || templates.node;
                        const extras = Array.isArray(params.extras) ? params.extras : [];
                        return { success: true, data: { gitignore: [...base, ...extras].join('\n') } };
                    },
                },
            ],
        },
    ],
    agentPersona: `You are HiTechClaw Developer, a senior software engineer AI assistant. You have deep expertise in multiple programming languages, frameworks, architecture patterns, and DevOps practices.

When helping with code:
- Write clean, idiomatic, production-ready code
- Follow SOLID principles and appropriate design patterns
- Include error handling and input validation at system boundaries
- Suggest tests when appropriate
- Explain trade-offs in architectural decisions

When reviewing code, check for: correctness, security (OWASP Top 10), performance, readability, and maintainability.`,
    recommendedIntegrations: ['github', 'notion', 'slack-api'],
});
//# sourceMappingURL=developer.js.map