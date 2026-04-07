// ============================================================
// Medical / Doctor Support Routes
// POST /api/medical/drug-interaction   — Check drug interactions
// POST /api/medical/icd10              — ICD-10 code lookup
// POST /api/medical/soap-note          — Generate SOAP note
// POST /api/medical/clinical-alert     — Check for clinical red flags
// GET  /api/medical/templates          — List medical templates
// POST /api/medical/templates/:id      — Fill a medical template
// ============================================================
import { Hono } from 'hono';
// ─── Drug Interaction Data (common critical interactions) ────
const CRITICAL_INTERACTIONS = [
    {
        drugs: ['warfarin', 'aspirin'],
        severity: 'critical',
        description: 'Increased risk of bleeding',
        mechanism: 'Both drugs affect coagulation. Aspirin inhibits platelet aggregation while warfarin inhibits clotting factors.',
        recommendation: 'Avoid combination or monitor INR closely. Consider alternative antiplatelet if needed.',
    },
    {
        drugs: ['metformin', 'contrast dye'],
        severity: 'critical',
        description: 'Risk of lactic acidosis',
        mechanism: 'Contrast media can impair renal function, reducing metformin clearance.',
        recommendation: 'Hold metformin 48 hours before and after contrast administration. Check renal function.',
    },
    {
        drugs: ['ssri', 'maoi'],
        severity: 'critical',
        description: 'Serotonin syndrome risk',
        mechanism: 'Both increase serotonin levels through different mechanisms.',
        recommendation: 'Contraindicated combination. Allow 14-day washout between agents.',
    },
    {
        drugs: ['ace inhibitor', 'potassium'],
        severity: 'major',
        description: 'Hyperkalemia risk',
        mechanism: 'ACE inhibitors reduce aldosterone, decreasing potassium excretion.',
        recommendation: 'Monitor serum potassium levels regularly. Avoid potassium supplements unless hypokalemia documented.',
    },
    {
        drugs: ['simvastatin', 'amiodarone'],
        severity: 'major',
        description: 'Increased risk of rhabdomyolysis',
        mechanism: 'Amiodarone inhibits CYP3A4, increasing statin levels.',
        recommendation: 'Limit simvastatin to 20mg/day with amiodarone. Consider alternative statin.',
    },
    {
        drugs: ['methotrexate', 'nsaid'],
        severity: 'major',
        description: 'Methotrexate toxicity',
        mechanism: 'NSAIDs reduce renal clearance of methotrexate.',
        recommendation: 'Avoid NSAIDs or monitor methotrexate levels closely.',
    },
    {
        drugs: ['lithium', 'nsaid'],
        severity: 'major',
        description: 'Lithium toxicity',
        mechanism: 'NSAIDs reduce renal lithium clearance.',
        recommendation: 'Monitor lithium levels. Consider acetaminophen as alternative.',
    },
    {
        drugs: ['digoxin', 'amiodarone'],
        severity: 'major',
        description: 'Digoxin toxicity',
        mechanism: 'Amiodarone reduces digoxin clearance by inhibiting P-glycoprotein.',
        recommendation: 'Reduce digoxin dose by 50% when starting amiodarone. Monitor levels.',
    },
    {
        drugs: ['clopidogrel', 'omeprazole'],
        severity: 'moderate',
        description: 'Reduced antiplatelet effect',
        mechanism: 'Omeprazole inhibits CYP2C19, reducing clopidogrel activation.',
        recommendation: 'Use pantoprazole or famotidine as alternative acid suppression.',
    },
    {
        drugs: ['ciprofloxacin', 'antacid'],
        severity: 'moderate',
        description: 'Reduced ciprofloxacin absorption',
        mechanism: 'Divalent cations in antacids chelate fluoroquinolones.',
        recommendation: 'Separate dosing by at least 2 hours.',
    },
];
// Drug class mappings for fuzzy matching
const DRUG_CLASSES = {
    'ssri': ['fluoxetine', 'sertraline', 'paroxetine', 'citalopram', 'escitalopram', 'fluvoxamine'],
    'maoi': ['phenelzine', 'tranylcypromine', 'isocarboxazid', 'selegiline'],
    'nsaid': ['ibuprofen', 'naproxen', 'diclofenac', 'celecoxib', 'meloxicam', 'indomethacin', 'ketorolac'],
    'ace inhibitor': ['lisinopril', 'enalapril', 'ramipril', 'captopril', 'benazepril', 'fosinopril'],
    'statin': ['simvastatin', 'atorvastatin', 'rosuvastatin', 'pravastatin', 'lovastatin'],
    'antacid': ['calcium carbonate', 'aluminum hydroxide', 'magnesium hydroxide'],
};
function getDrugClass(drug) {
    const lower = drug.toLowerCase();
    for (const [cls, members] of Object.entries(DRUG_CLASSES)) {
        if (members.some((m) => lower.includes(m)) || lower.includes(cls))
            return cls;
    }
    return lower;
}
// ─── ICD-10 Quick Reference ─────────────────────────────────
const ICD10_CODES = [
    { code: 'J06.9', description: 'Acute upper respiratory infection, unspecified', category: 'Respiratory', commonTerms: ['cold', 'uri', 'upper respiratory'] },
    { code: 'J18.9', description: 'Pneumonia, unspecified organism', category: 'Respiratory', commonTerms: ['pneumonia', 'lung infection'] },
    { code: 'J45.909', description: 'Unspecified asthma, uncomplicated', category: 'Respiratory', commonTerms: ['asthma'] },
    { code: 'I10', description: 'Essential (primary) hypertension', category: 'Cardiovascular', commonTerms: ['hypertension', 'high blood pressure', 'htn'] },
    { code: 'I25.10', description: 'Atherosclerotic heart disease of native coronary artery', category: 'Cardiovascular', commonTerms: ['coronary artery disease', 'cad', 'heart disease'] },
    { code: 'I50.9', description: 'Heart failure, unspecified', category: 'Cardiovascular', commonTerms: ['heart failure', 'chf', 'congestive'] },
    { code: 'E11.9', description: 'Type 2 diabetes mellitus without complications', category: 'Endocrine', commonTerms: ['diabetes', 'type 2', 'dm2', 'dm ii'] },
    { code: 'E11.65', description: 'Type 2 diabetes mellitus with hyperglycemia', category: 'Endocrine', commonTerms: ['diabetes hyperglycemia', 'high blood sugar'] },
    { code: 'E78.5', description: 'Hyperlipidemia, unspecified', category: 'Endocrine', commonTerms: ['high cholesterol', 'hyperlipidemia', 'dyslipidemia'] },
    { code: 'E03.9', description: 'Hypothyroidism, unspecified', category: 'Endocrine', commonTerms: ['hypothyroid', 'underactive thyroid', 'low thyroid'] },
    { code: 'M54.5', description: 'Low back pain', category: 'Musculoskeletal', commonTerms: ['back pain', 'lumbago', 'low back'] },
    { code: 'M79.3', description: 'Panniculitis, unspecified', category: 'Musculoskeletal', commonTerms: ['soft tissue pain'] },
    { code: 'G43.909', description: 'Migraine, unspecified, not intractable', category: 'Neurological', commonTerms: ['migraine', 'headache'] },
    { code: 'F32.9', description: 'Major depressive disorder, single episode, unspecified', category: 'Mental Health', commonTerms: ['depression', 'depressive', 'major depression'] },
    { code: 'F41.1', description: 'Generalized anxiety disorder', category: 'Mental Health', commonTerms: ['anxiety', 'gad', 'anxious'] },
    { code: 'F41.9', description: 'Anxiety disorder, unspecified', category: 'Mental Health', commonTerms: ['anxiety'] },
    { code: 'K21.0', description: 'Gastro-esophageal reflux disease with esophagitis', category: 'Gastrointestinal', commonTerms: ['gerd', 'acid reflux', 'heartburn'] },
    { code: 'K59.00', description: 'Constipation, unspecified', category: 'Gastrointestinal', commonTerms: ['constipation'] },
    { code: 'N39.0', description: 'Urinary tract infection, site not specified', category: 'Genitourinary', commonTerms: ['uti', 'urinary infection', 'bladder infection'] },
    { code: 'L50.9', description: 'Urticaria, unspecified', category: 'Dermatological', commonTerms: ['hives', 'urticaria', 'allergic rash'] },
    { code: 'R50.9', description: 'Fever, unspecified', category: 'Symptoms', commonTerms: ['fever', 'pyrexia'] },
    { code: 'R05.9', description: 'Cough, unspecified', category: 'Symptoms', commonTerms: ['cough'] },
    { code: 'R51.9', description: 'Headache, unspecified', category: 'Symptoms', commonTerms: ['headache'] },
    { code: 'R10.9', description: 'Unspecified abdominal pain', category: 'Symptoms', commonTerms: ['abdominal pain', 'stomach pain', 'belly pain'] },
    { code: 'Z00.00', description: 'Encounter for general adult medical examination', category: 'Encounters', commonTerms: ['checkup', 'physical exam', 'annual exam', 'wellness'] },
];
// ─── Clinical Red Flags ─────────────────────────────────────
const RED_FLAGS = [
    {
        keywords: ['chest pain', 'crushing', 'pressure', 'radiating arm', 'jaw pain', 'diaphoresis'],
        alert: 'Possible acute coronary syndrome',
        severity: 'emergency',
        recommendation: 'Immediate ECG, troponin, call cardiology. Consider STEMI protocol.',
    },
    {
        keywords: ['sudden headache', 'worst headache', 'thunderclap', 'neck stiffness', 'photophobia'],
        alert: 'Possible subarachnoid hemorrhage or meningitis',
        severity: 'emergency',
        recommendation: 'Urgent CT head without contrast. If negative, consider LP. Neurology consult.',
    },
    {
        keywords: ['stroke', 'facial droop', 'arm weakness', 'speech difficulty', 'slurred speech', 'sudden numbness'],
        alert: 'Possible stroke (CVA/TIA)',
        severity: 'emergency',
        recommendation: 'Activate stroke protocol. CT/CTA head, check last known well time. tPA window assessment.',
    },
    {
        keywords: ['anaphylaxis', 'tongue swelling', 'throat closing', 'stridor', 'severe allergic'],
        alert: 'Possible anaphylaxis',
        severity: 'emergency',
        recommendation: 'IM epinephrine 0.3mg immediately. Establish IV access. Monitor airway.',
    },
    {
        keywords: ['suicidal', 'kill myself', 'end my life', 'want to die', 'self-harm'],
        alert: 'Suicidal ideation detected',
        severity: 'emergency',
        recommendation: 'Immediate psychiatric evaluation. Assess safety, means, plan. 1:1 observation. Crisis intervention.',
    },
    {
        keywords: ['hematemesis', 'vomiting blood', 'melena', 'black stool', 'bloody stool'],
        alert: 'Possible GI hemorrhage',
        severity: 'urgent',
        recommendation: 'CBC, type & screen, coags, GI consult. NPO, IV access x2, PPI.',
    },
    {
        keywords: ['sudden vision loss', 'eye pain', 'curtain over eye'],
        alert: 'Possible retinal detachment or acute angle closure glaucoma',
        severity: 'urgent',
        recommendation: 'Emergency ophthalmology consult. Check IOP.',
    },
    {
        keywords: ['uncontrolled blood sugar', 'dka', 'ketoacidosis', 'blood sugar over 400'],
        alert: 'Possible diabetic ketoacidosis',
        severity: 'urgent',
        recommendation: 'Stat BMP, glucose, ABG, urinalysis. Start NS bolus, insulin drip protocol.',
    },
    {
        keywords: ['weight loss', 'night sweats', 'unexplained fever', 'lymphadenopathy'],
        alert: 'B-symptoms — rule out malignancy/infection',
        severity: 'warning',
        recommendation: 'CBC w/ differential, CMP, LDH, ESR, CRP. Consider CT chest/abdomen/pelvis.',
    },
    {
        keywords: ['progressive weakness', 'ascending paralysis', 'difficulty breathing', 'numbness spreading'],
        alert: 'Possible Guillain-Barré syndrome',
        severity: 'urgent',
        recommendation: 'Urgent neurology consult. Monitor respiratory function (FVC). Consider LP, nerve conduction studies.',
    },
];
// ─── Medical Templates ──────────────────────────────────────
const MEDICAL_TEMPLATES = [
    {
        id: 'soap-note',
        name: 'SOAP Note',
        category: 'Documentation',
        description: 'Standard SOAP format clinical note',
        fields: [
            { name: 'patient', label: 'Patient Name', type: 'text', required: true },
            { name: 'date', label: 'Date', type: 'date', required: true },
            { name: 'subjective', label: 'Subjective (Chief complaint, HPI)', type: 'textarea', required: true },
            { name: 'objective', label: 'Objective (Vitals, exam findings, labs)', type: 'textarea', required: true },
            { name: 'assessment', label: 'Assessment (Diagnosis, ICD-10)', type: 'textarea', required: true },
            { name: 'plan', label: 'Plan (Treatment, follow-up)', type: 'textarea', required: true },
        ],
        template: `# SOAP Note\n**Patient:** {{patient}}  \n**Date:** {{date}}\n\n## Subjective\n{{subjective}}\n\n## Objective\n{{objective}}\n\n## Assessment\n{{assessment}}\n\n## Plan\n{{plan}}`,
    },
    {
        id: 'prescription',
        name: 'Prescription',
        category: 'Orders',
        description: 'Standard prescription template',
        fields: [
            { name: 'patient', label: 'Patient Name', type: 'text', required: true },
            { name: 'dob', label: 'Date of Birth', type: 'date', required: true },
            { name: 'medication', label: 'Medication', type: 'text', required: true },
            { name: 'dose', label: 'Dose', type: 'text', required: true },
            { name: 'route', label: 'Route', type: 'select', options: ['PO', 'IV', 'IM', 'SC', 'Topical', 'Inhaled', 'Rectal', 'Sublingual'], required: true },
            { name: 'frequency', label: 'Frequency', type: 'select', options: ['QD', 'BID', 'TID', 'QID', 'Q4H', 'Q6H', 'Q8H', 'Q12H', 'PRN', 'QHS', 'STAT'], required: true },
            { name: 'duration', label: 'Duration', type: 'text', required: true },
            { name: 'quantity', label: 'Quantity', type: 'text', required: true },
            { name: 'refills', label: 'Refills', type: 'text' },
            { name: 'notes', label: 'Special Instructions', type: 'textarea' },
        ],
        template: `# Prescription\n**Patient:** {{patient}} (DOB: {{dob}})\n\n**Rx:** {{medication}} {{dose}}\n**Route:** {{route}}\n**Frequency:** {{frequency}}\n**Duration:** {{duration}}\n**Quantity:** {{quantity}}\n**Refills:** {{refills}}\n\n**Instructions:** {{notes}}`,
    },
    {
        id: 'referral',
        name: 'Referral Letter',
        category: 'Documentation',
        description: 'Specialist referral template',
        fields: [
            { name: 'patient', label: 'Patient Name', type: 'text', required: true },
            { name: 'dob', label: 'Date of Birth', type: 'date', required: true },
            { name: 'specialist', label: 'Refer to (Specialist/Department)', type: 'text', required: true },
            { name: 'reason', label: 'Reason for Referral', type: 'textarea', required: true },
            { name: 'history', label: 'Relevant History', type: 'textarea', required: true },
            { name: 'medications', label: 'Current Medications', type: 'textarea' },
            { name: 'urgency', label: 'Urgency', type: 'select', options: ['Routine', 'Urgent', 'Emergent'], required: true },
        ],
        template: `# Referral Letter\n**Date:** {{date}}\n**Patient:** {{patient}} (DOB: {{dob}})\n**Refer to:** {{specialist}}\n**Urgency:** {{urgency}}\n\n## Reason for Referral\n{{reason}}\n\n## Relevant History\n{{history}}\n\n## Current Medications\n{{medications}}`,
    },
    {
        id: 'discharge-summary',
        name: 'Discharge Summary',
        category: 'Documentation',
        description: 'Patient discharge summary template',
        fields: [
            { name: 'patient', label: 'Patient Name', type: 'text', required: true },
            { name: 'admitDate', label: 'Admission Date', type: 'date', required: true },
            { name: 'dischargeDate', label: 'Discharge Date', type: 'date', required: true },
            { name: 'diagnosis', label: 'Principal Diagnosis', type: 'text', required: true },
            { name: 'procedures', label: 'Procedures Performed', type: 'textarea' },
            { name: 'hospitalCourse', label: 'Hospital Course', type: 'textarea', required: true },
            { name: 'dischargeMeds', label: 'Discharge Medications', type: 'textarea', required: true },
            { name: 'followUp', label: 'Follow-up Instructions', type: 'textarea', required: true },
            { name: 'precautions', label: 'Discharge Precautions', type: 'textarea' },
        ],
        template: `# Discharge Summary\n**Patient:** {{patient}}\n**Admission Date:** {{admitDate}}\n**Discharge Date:** {{dischargeDate}}\n**Principal Diagnosis:** {{diagnosis}}\n\n## Procedures\n{{procedures}}\n\n## Hospital Course\n{{hospitalCourse}}\n\n## Discharge Medications\n{{dischargeMeds}}\n\n## Follow-up\n{{followUp}}\n\n## Precautions\n{{precautions}}`,
    },
];
// ============ Routes ============
export function createMedicalRoutes(ctx) {
    const app = new Hono();
    // POST /api/medical/drug-interaction — Check drug interactions
    app.post('/drug-interaction', async (c) => {
        var _a;
        const body = await c.req.json();
        if (!((_a = body.drugs) === null || _a === void 0 ? void 0 : _a.length) || body.drugs.length < 2) {
            return c.json({ error: 'At least 2 drugs are required' }, 400);
        }
        const drugClasses = body.drugs.map((d) => getDrugClass(d));
        const interactions = [];
        // Check all pairs
        for (let i = 0; i < drugClasses.length; i++) {
            for (let j = i + 1; j < drugClasses.length; j++) {
                const d1 = drugClasses[i];
                const d2 = drugClasses[j];
                for (const interaction of CRITICAL_INTERACTIONS) {
                    const [a, b] = interaction.drugs;
                    if ((d1.includes(a) && d2.includes(b)) ||
                        (d1.includes(b) && d2.includes(a)) ||
                        (d1 === a && d2 === b) ||
                        (d1 === b && d2 === a)) {
                        interactions.push({
                            drug1: body.drugs[i],
                            drug2: body.drugs[j],
                            severity: interaction.severity,
                            description: interaction.description,
                            mechanism: interaction.mechanism,
                            recommendation: interaction.recommendation,
                        });
                    }
                }
            }
        }
        // Also ask AI for additional context if Ollama is available
        let aiAnalysis = '';
        try {
            const prompt = `As a pharmacist, briefly analyze potential interactions between these medications: ${body.drugs.join(', ')}. Be concise (3-5 sentences). Focus on clinically significant interactions.`;
            aiAnalysis = await ctx.agent.chat(`medical-${Date.now()}`, prompt);
        }
        catch (_b) {
            // AI analysis is optional
        }
        return c.json({
            drugs: body.drugs,
            interactions,
            hasInteractions: interactions.length > 0,
            hasCritical: interactions.some((i) => i.severity === 'critical'),
            aiAnalysis: aiAnalysis || undefined,
        });
    });
    // POST /api/medical/icd10 — ICD-10 code lookup
    app.post('/icd10', async (c) => {
        const body = await c.req.json();
        if (!body.query && !body.category) {
            return c.json({ error: 'query or category is required' }, 400);
        }
        let results = ICD10_CODES;
        if (body.category) {
            results = results.filter((code) => code.category.toLowerCase() === body.category.toLowerCase());
        }
        if (body.query) {
            const query = body.query.toLowerCase();
            results = results.filter((code) => code.code.toLowerCase().includes(query) ||
                code.description.toLowerCase().includes(query) ||
                code.commonTerms.some((t) => t.includes(query)));
        }
        const categories = [...new Set(ICD10_CODES.map((c) => c.category))];
        return c.json({ results, total: results.length, categories });
    });
    // POST /api/medical/soap-note — Generate SOAP note with AI
    app.post('/soap-note', async (c) => {
        const body = await c.req.json();
        if (!body.chiefComplaint) {
            return c.json({ error: 'chiefComplaint is required' }, 400);
        }
        const prompt = `Generate a SOAP note based on the following:
Chief Complaint: ${body.chiefComplaint}
${body.patientContext ? `Patient Context: ${body.patientContext}` : ''}
${body.vitals ? `Vitals: ${body.vitals}` : ''}
${body.examFindings ? `Exam Findings: ${body.examFindings}` : ''}

Format as a proper SOAP note with Subjective, Objective, Assessment, and Plan sections. Include appropriate ICD-10 codes in the Assessment. Be thorough but concise.`;
        try {
            const result = await ctx.agent.chat(`soap-${Date.now()}`, prompt);
            return c.json({ soapNote: result, generatedAt: new Date().toISOString() });
        }
        catch (err) {
            return c.json({ error: 'Failed to generate SOAP note. Check LLM configuration.' }, 500);
        }
    });
    // POST /api/medical/clinical-alert — Check text for clinical red flags
    app.post('/clinical-alert', async (c) => {
        const body = await c.req.json();
        if (!body.text) {
            return c.json({ error: 'text is required' }, 400);
        }
        const textLower = body.text.toLowerCase();
        const alerts = [];
        for (const flag of RED_FLAGS) {
            const matched = flag.keywords.filter((kw) => textLower.includes(kw));
            if (matched.length > 0) {
                alerts.push({
                    alert: flag.alert,
                    severity: flag.severity,
                    recommendation: flag.recommendation,
                    matchedKeywords: matched,
                });
            }
        }
        // Sort by severity
        const severityOrder = { emergency: 0, urgent: 1, warning: 2 };
        alerts.sort((a, b) => { var _a, _b; return ((_a = severityOrder[a.severity]) !== null && _a !== void 0 ? _a : 3) - ((_b = severityOrder[b.severity]) !== null && _b !== void 0 ? _b : 3); });
        return c.json({
            text: body.text.slice(0, 200) + (body.text.length > 200 ? '...' : ''),
            alerts,
            hasAlerts: alerts.length > 0,
            hasEmergency: alerts.some((a) => a.severity === 'emergency'),
        });
    });
    // GET /api/medical/templates — List available templates
    app.get('/templates', async (c) => {
        const templates = MEDICAL_TEMPLATES.map(({ id, name, category, description, fields }) => ({
            id, name, category, description, fieldCount: fields.length,
        }));
        return c.json({ templates });
    });
    // GET /api/medical/templates/:id — Get template details
    app.get('/templates/:id', async (c) => {
        const tpl = MEDICAL_TEMPLATES.find((t) => t.id === c.req.param('id'));
        if (!tpl)
            return c.json({ error: 'Template not found' }, 404);
        return c.json(tpl);
    });
    // POST /api/medical/templates/:id — Fill a template
    app.post('/templates/:id', async (c) => {
        const tpl = MEDICAL_TEMPLATES.find((t) => t.id === c.req.param('id'));
        if (!tpl)
            return c.json({ error: 'Template not found' }, 404);
        const body = await c.req.json();
        let output = tpl.template;
        // Replace placeholders
        for (const field of tpl.fields) {
            const value = body[field.name] || '';
            output = output.replace(new RegExp(`\\{\\{${field.name}\\}\\}`, 'g'), value);
        }
        // Replace date placeholder with current date if present
        output = output.replace(/\{\{date\}\}/g, new Date().toISOString().split('T')[0]);
        return c.json({ result: output, templateId: tpl.id, templateName: tpl.name });
    });
    // GET /api/medical/icd10/categories — List ICD-10 categories
    app.get('/icd10/categories', async (c) => {
        const categories = [...new Set(ICD10_CODES.map((c) => c.category))];
        return c.json({ categories });
    });
    return app;
}
