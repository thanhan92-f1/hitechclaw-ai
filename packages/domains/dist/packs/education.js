import { defineDomainPack } from '../base/domain-pack.js';
export const educationDomain = defineDomainPack({
    id: 'education',
    name: 'Education & Training',
    description: 'Tutoring, curriculum design, quiz generation, lesson planning, and educational content creation.',
    icon: '📚',
    skills: [
        {
            id: 'tutoring',
            name: 'AI Tutor',
            description: 'Interactive tutoring with adaptive difficulty and Socratic method.',
            version: '1.0.0',
            category: 'education',
            tools: [
                {
                    name: 'generate_quiz',
                    description: 'Generate quiz questions on a topic with answers.',
                    parameters: {
                        type: 'object',
                        properties: {
                            topic: { type: 'string' },
                            difficulty: { type: 'string', description: 'beginner, intermediate, advanced' },
                            questionCount: { type: 'number' },
                            questionType: { type: 'string', description: 'multiple_choice, true_false, short_answer, essay' },
                        },
                        required: ['topic'],
                    },
                    execute: async (params) => ({
                        success: true,
                        data: { _llmTool: true, toolPrompt: `Generate ${params.questionCount || 5} ${params.questionType || 'multiple_choice'} quiz questions about "${params.topic}" at ${params.difficulty || 'intermediate'} level. Include correct answers and brief explanations.` },
                    }),
                },
                {
                    name: 'create_lesson_plan',
                    description: 'Create a structured lesson plan for a topic.',
                    parameters: {
                        type: 'object',
                        properties: {
                            topic: { type: 'string' },
                            duration: { type: 'string', description: 'Lesson duration, e.g. "45 minutes"' },
                            gradeLevel: { type: 'string' },
                            learningObjectives: { type: 'array', items: { type: 'string' } },
                        },
                        required: ['topic'],
                    },
                    execute: async (params) => ({
                        success: true,
                        data: { _llmTool: true, toolPrompt: `Create a structured lesson plan for "${params.topic}"${params.duration ? ` (${params.duration})` : ''}${params.gradeLevel ? ` for grade level ${params.gradeLevel}` : ''}. Include: objectives, materials, warm-up, main activity, assessment, and wrap-up.` },
                    }),
                },
            ],
        },
    ],
    agentPersona: `You are HiTechClaw Educator, an AI tutoring and education assistant. You adapt your explanations to the learner's level, use the Socratic method to guide discovery, and create engaging educational content.

Teaching principles:
- Start with what the learner already knows
- Break complex topics into digestible chunks
- Use analogies and real-world examples
- Provide practice problems with step-by-step solutions
- Give constructive, encouraging feedback`,
    recommendedIntegrations: ['notion', 'google-calendar'],
});
//# sourceMappingURL=education.js.map