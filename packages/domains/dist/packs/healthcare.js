import { defineDomainPack } from '../base/domain-pack.js';
// Common drug interaction database (simplified)
const DRUG_INTERACTIONS = [
    { drugs: ['warfarin', 'aspirin'], severity: 'high', description: 'Increased bleeding risk. Monitor INR closely.' },
    { drugs: ['warfarin', 'ibuprofen'], severity: 'high', description: 'NSAIDs increase anticoagulant effect and GI bleeding risk.' },
    { drugs: ['metformin', 'alcohol'], severity: 'moderate', description: 'Increased risk of lactic acidosis.' },
    { drugs: ['ssri', 'maoi'], severity: 'critical', description: 'Risk of serotonin syndrome. Contraindicated combination.' },
    { drugs: ['fluoxetine', 'tramadol'], severity: 'high', description: 'Increased risk of serotonin syndrome and seizures.' },
    { drugs: ['lisinopril', 'potassium'], severity: 'moderate', description: 'Risk of hyperkalemia. Monitor potassium levels.' },
    { drugs: ['simvastatin', 'amlodipine'], severity: 'moderate', description: 'Increased risk of myopathy. Limit simvastatin to 20mg.' },
    { drugs: ['methotrexate', 'ibuprofen'], severity: 'high', description: 'NSAIDs reduce methotrexate clearance, increasing toxicity.' },
    { drugs: ['ciprofloxacin', 'theophylline'], severity: 'high', description: 'Ciprofloxacin increases theophylline levels. Monitor closely.' },
    { drugs: ['omeprazole', 'clopidogrel'], severity: 'moderate', description: 'PPI may reduce antiplatelet effect. Consider pantoprazole instead.' },
    { drugs: ['amoxicillin', 'methotrexate'], severity: 'moderate', description: 'Amoxicillin may increase methotrexate toxicity.' },
    { drugs: ['digoxin', 'amiodarone'], severity: 'high', description: 'Amiodarone increases digoxin levels. Reduce digoxin dose by 50%.' },
];
// Common ICD-10 codes
const ICD10_DB = [
    { code: 'J06.9', description: 'Acute upper respiratory infection, unspecified', keywords: ['cold', 'uri', 'upper respiratory', 'cough', 'sore throat'] },
    { code: 'J18.9', description: 'Pneumonia, unspecified organism', keywords: ['pneumonia', 'lung infection'] },
    { code: 'E11.9', description: 'Type 2 diabetes mellitus without complications', keywords: ['diabetes', 'type 2', 'dm2', 'hyperglycemia'] },
    { code: 'I10', description: 'Essential (primary) hypertension', keywords: ['hypertension', 'high blood pressure', 'htn'] },
    { code: 'M54.5', description: 'Low back pain', keywords: ['back pain', 'lumbago', 'lower back'] },
    { code: 'K21.0', description: 'Gastro-esophageal reflux disease with esophagitis', keywords: ['gerd', 'reflux', 'heartburn', 'acid reflux'] },
    { code: 'F32.9', description: 'Major depressive disorder, single episode, unspecified', keywords: ['depression', 'depressive', 'mood'] },
    { code: 'F41.1', description: 'Generalized anxiety disorder', keywords: ['anxiety', 'gad', 'anxious'] },
    { code: 'J45.909', description: 'Unspecified asthma, uncomplicated', keywords: ['asthma', 'wheezing', 'bronchospasm'] },
    { code: 'N39.0', description: 'Urinary tract infection, site not specified', keywords: ['uti', 'urinary', 'bladder infection'] },
    { code: 'R50.9', description: 'Fever, unspecified', keywords: ['fever', 'pyrexia', 'temperature'] },
    { code: 'R51', description: 'Headache', keywords: ['headache', 'cephalalgia', 'migraine'] },
    { code: 'L30.9', description: 'Dermatitis, unspecified', keywords: ['dermatitis', 'eczema', 'skin rash', 'rash'] },
    { code: 'M79.3', description: 'Panniculitis, unspecified', keywords: ['inflammation', 'subcutaneous'] },
    { code: 'R10.9', description: 'Unspecified abdominal pain', keywords: ['abdominal pain', 'stomach ache', 'belly pain'] },
];
export const healthcareDomain = defineDomainPack({
    id: 'healthcare',
    name: 'Healthcare & Medical',
    description: 'Clinical decision support, drug interaction checking, ICD-10 coding, medical literature search, and patient documentation.',
    icon: '🏥',
    skills: [
        {
            id: 'drug-interaction-check',
            name: 'Drug Interaction Checker',
            description: 'Check for potential drug-drug interactions and contraindications.',
            version: '1.0.0',
            category: 'healthcare',
            tools: [
                {
                    name: 'check_drug_interactions',
                    description: 'Check interactions between a list of medications.',
                    parameters: {
                        type: 'object',
                        properties: {
                            drugs: { type: 'array', items: { type: 'string' }, description: 'List of medication names (comma-separated)' },
                            patientAge: { type: 'number', description: 'Patient age in years' },
                            conditions: { type: 'array', items: { type: 'string' }, description: 'Pre-existing conditions (comma-separated)' },
                        },
                        required: ['drugs'],
                    },
                    execute: async (params) => {
                        const drugList = Array.isArray(params.drugs)
                            ? params.drugs.map((d) => d.toLowerCase().trim())
                            : String(params.drugs).split(',').map((d) => d.toLowerCase().trim());
                        const interactions = [];
                        for (let i = 0; i < drugList.length; i++) {
                            for (let j = i + 1; j < drugList.length; j++) {
                                for (const entry of DRUG_INTERACTIONS) {
                                    const pair = entry.drugs.map(d => d.toLowerCase());
                                    if ((drugList[i].includes(pair[0]) || pair[0].includes(drugList[i])) &&
                                        (drugList[j].includes(pair[1]) || pair[1].includes(drugList[j])) ||
                                        (drugList[i].includes(pair[1]) || pair[1].includes(drugList[i])) &&
                                            (drugList[j].includes(pair[0]) || pair[0].includes(drugList[j]))) {
                                        interactions.push({
                                            drug1: drugList[i], drug2: drugList[j],
                                            severity: entry.severity, description: entry.description,
                                        });
                                    }
                                }
                            }
                        }
                        return {
                            success: true,
                            data: {
                                drugCount: drugList.length,
                                drugs: drugList,
                                interactionCount: interactions.length,
                                interactions,
                                disclaimer: '⚠️ This is a simplified reference tool. Always verify with official drug interaction databases (e.g., Lexicomp, Micromedex).',
                            },
                        };
                    },
                },
            ],
        },
        {
            id: 'icd10-coding',
            name: 'ICD-10 Coding Assistant',
            description: 'Suggest ICD-10 codes from clinical descriptions.',
            version: '1.0.0',
            category: 'healthcare',
            tools: [
                {
                    name: 'suggest_icd10_codes',
                    description: 'Given a clinical description, suggest relevant ICD-10 codes.',
                    parameters: {
                        type: 'object',
                        properties: {
                            description: { type: 'string', description: 'Clinical description or diagnosis' },
                            maxResults: { type: 'number', description: 'Number of suggestions (default 5)' },
                        },
                        required: ['description'],
                    },
                    execute: async (params) => {
                        const query = String(params.description).toLowerCase();
                        const max = Number(params.maxResults) || 5;
                        const scored = ICD10_DB.map(entry => {
                            let score = 0;
                            for (const kw of entry.keywords) {
                                if (query.includes(kw))
                                    score += 2;
                                else if (kw.split(' ').some(w => query.includes(w)))
                                    score += 1;
                            }
                            if (entry.description.toLowerCase().includes(query))
                                score += 3;
                            return { ...entry, score };
                        }).filter(e => e.score > 0).sort((a, b) => b.score - a.score).slice(0, max);
                        return {
                            success: true,
                            data: {
                                query: params.description,
                                suggestions: scored.map(s => ({ code: s.code, description: s.description, relevance: s.score })),
                                disclaimer: '⚠️ ICD-10 suggestions are approximate. Verify with official WHO ICD-10 classification.',
                            },
                        };
                    },
                },
            ],
        },
        {
            id: 'clinical-notes',
            name: 'Clinical Notes Generator',
            description: 'Generate structured clinical notes (SOAP, discharge summaries, referral letters).',
            version: '1.0.0',
            category: 'healthcare',
            tools: [
                {
                    name: 'generate_clinical_note',
                    description: 'Generate a structured clinical note from raw input.',
                    parameters: {
                        type: 'object',
                        properties: {
                            type: { type: 'string', description: 'Note type: soap, discharge, referral, progress' },
                            rawInput: { type: 'string', description: 'Raw clinical observations' },
                            patientId: { type: 'string', description: 'Patient identifier (optional)' },
                        },
                        required: ['type', 'rawInput'],
                    },
                    execute: async (params) => {
                        const noteType = String(params.type || 'soap').toLowerCase();
                        const raw = String(params.rawInput);
                        const pid = params.patientId || 'N/A';
                        const now = new Date().toISOString().split('T')[0];
                        let template = '';
                        if (noteType === 'soap') {
                            template = `# SOAP Note\n**Date:** ${now} | **Patient:** ${pid}\n\n## Subjective\n${raw}\n\n## Objective\n[Vital signs, physical exam findings]\n\n## Assessment\n[Clinical impression / differential diagnosis]\n\n## Plan\n[Treatment plan, follow-up instructions]`;
                        }
                        else if (noteType === 'discharge') {
                            template = `# Discharge Summary\n**Date:** ${now} | **Patient:** ${pid}\n\n## Admission Diagnosis\n[Primary diagnosis]\n\n## Hospital Course\n${raw}\n\n## Discharge Diagnosis\n[Final diagnosis]\n\n## Discharge Medications\n[List medications]\n\n## Follow-up Instructions\n[Follow-up appointments, precautions]`;
                        }
                        else if (noteType === 'referral') {
                            template = `# Referral Letter\n**Date:** ${now} | **Patient:** ${pid}\n\n## Reason for Referral\n${raw}\n\n## Clinical History\n[Relevant medical history]\n\n## Current Medications\n[List medications]\n\n## Requested Action\n[What the specialist should evaluate]`;
                        }
                        else {
                            template = `# Progress Note\n**Date:** ${now} | **Patient:** ${pid}\n\n## Clinical Update\n${raw}\n\n## Current Status\n[Patient condition]\n\n## Plan\n[Next steps]`;
                        }
                        return { success: true, data: { type: noteType, note: template } };
                    },
                },
            ],
        },
    ],
    agentPersona: `You are HiTechClaw Medical, a clinical decision support AI assistant. You help healthcare professionals with drug interaction checking, ICD-10 coding, clinical documentation, and medical literature review.

IMPORTANT DISCLAIMERS:
- You are a decision SUPPORT tool, not a replacement for clinical judgment
- Always recommend verification through official drug databases and clinical guidelines
- Flag high-severity interactions with clear urgency markers
- Indicate confidence levels in your assessments
- Never provide direct patient care advice to non-professionals

When generating clinical notes, follow standard medical documentation practices (SOAP format, structured discharge summaries, etc.).`,
    recommendedIntegrations: ['brave-search'],
    knowledgePacks: ['icd10-drug-interactions', 'vn-drug-formulary'],
});
//# sourceMappingURL=healthcare.js.map