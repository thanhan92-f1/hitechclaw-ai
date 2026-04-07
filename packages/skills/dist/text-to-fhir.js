// ─── Text-to-FHIR Skill ─────────────────────────────────────
// Converts natural language questions into FHIR API calls.
// The LLM chooses which tool to invoke; each tool calls the
// external HIS REST API and returns structured data that the
// LLM formats into a human-readable answer.
// ─────────────────────────────────────────────────────────────
import { defineSkill } from '@hitechclaw/core';
// Base URL is resolved at runtime (env var or default)
function hisBaseUrl() {
    return process.env.HIS_API_BASE_URL || 'http://localhost:4000';
}
async function hisGet(path) {
    const res = await fetch(`${hisBaseUrl()}${path}`);
    if (!res.ok)
        throw new Error(`HIS API ${path}: ${res.status}`);
    return res.json();
}
// ─── Skill Definition ────────────────────────────────────────
export const textToFhirSkill = defineSkill({
    manifest: {
        id: 'text-to-fhir',
        name: 'Text-to-FHIR Query',
        version: '1.0.0',
        description: 'Query hospital FHIR data via natural language. Provides tools to retrieve patients, encounters, prescriptions, allergies, medications, and aggregate statistics from the Hospital Information System.',
        author: 'HiTechClaw',
        category: 'healthcare',
        tags: ['fhir', 'his', 'hospital', 'text-to-sql', 'query', 'healthcare'],
        tools: [], // filled below for manifest only
        triggers: [],
        config: [
            { key: 'hisApiBaseUrl', label: 'HIS API Base URL', type: 'string', description: 'HIS API base URL', required: false, default: 'http://localhost:4000' },
        ],
    },
    tools: [
        // ── 1. Overview / stats ───────────────────────────────
        {
            definition: {
                name: 'his_get_stats',
                description: 'Get aggregated statistics from the Hospital Information System: total patient count, total prescriptions, medication count, alert count, etc. Use this when the user asks about overall numbers, summary, or dashboard-level information such as "how many patients today", "total prescriptions", "overview of the hospital".',
                category: 'healthcare',
                parameters: [],
            },
            handler: async () => {
                const data = await hisGet('/api/his/stats');
                return data;
            },
        },
        // ── 2. List / search patients ─────────────────────────
        {
            definition: {
                name: 'his_list_patients',
                description: 'List or search patients in the HIS. Returns patient name, age, gender, ID, phone, conditions. Use when the user asks about patient lists, specific patient lookup, pregnant patients, patients with specific conditions, or patient demographics.',
                category: 'healthcare',
                parameters: [
                    { name: 'query', type: 'string', description: 'Optional search query (name or patient ID). Leave empty to list all patients.', required: false },
                ],
            },
            handler: async (args) => {
                const q = args.query ? `?q=${encodeURIComponent(String(args.query))}` : '';
                const data = await hisGet(`/api/his/patients${q}`);
                return data;
            },
        },
        // ── 3. Patient detail ─────────────────────────────────
        {
            definition: {
                name: 'his_get_patient',
                description: 'Get detailed information about a specific patient by their ID. Returns full FHIR Patient resource including name, birthDate, gender, phone, address, conditions. Use when the user mentions a specific patient ID.',
                category: 'healthcare',
                parameters: [
                    { name: 'patientId', type: 'string', description: 'The patient ID (e.g. "p-001")', required: true },
                ],
            },
            handler: async (args) => {
                const id = String(args.patientId);
                const data = await hisGet(`/api/his/patients/${encodeURIComponent(id)}`);
                return data;
            },
        },
        // ── 4. Patient allergies ──────────────────────────────
        {
            definition: {
                name: 'his_get_patient_allergies',
                description: 'Get allergy information for a specific patient. Returns allergen, criticality, reaction type and severity. Use when asking about a specific patient\'s allergies. For all severe allergies across the system, use his_list_all_allergies instead.',
                category: 'healthcare',
                parameters: [
                    { name: 'patientId', type: 'string', description: 'The patient ID (e.g. "p-001")', required: true },
                ],
            },
            handler: async (args) => {
                const id = String(args.patientId);
                const data = await hisGet(`/api/his/patients/${encodeURIComponent(id)}/allergies`);
                return data;
            },
        },
        // ── 5. All encountered (SOAP notes) ───────────────────
        {
            definition: {
                name: 'his_list_encounters',
                description: 'List clinical encounters (SOAP notes) in the HIS. Returns encounter date, patient name, diagnosis/assessment, plan, status. Optionally filter by patientId. Use when asking about visits, consultations, clinical notes, follow-up needs, or appointment history.',
                category: 'healthcare',
                parameters: [
                    { name: 'patientId', type: 'string', description: 'Optional: filter encounters by patient ID', required: false },
                ],
            },
            handler: async (args) => {
                const q = args.patientId ? `?patientId=${encodeURIComponent(String(args.patientId))}` : '';
                const data = await hisGet(`/api/his/encounters${q}`);
                return data;
            },
        },
        // ── 6. Prescriptions ──────────────────────────────────
        {
            definition: {
                name: 'his_list_prescriptions',
                description: 'List medication prescriptions (MedicationRequest). Returns medication name, patient, status (active/completed), dosage, date. Optionally filter by patientId. Use when asking about active prescriptions, medication orders, what drugs a patient is taking, or polypharmacy concerns.',
                category: 'healthcare',
                parameters: [
                    { name: 'patientId', type: 'string', description: 'Optional: filter prescriptions by patient ID', required: false },
                ],
            },
            handler: async (args) => {
                const q = args.patientId ? `?patientId=${encodeURIComponent(String(args.patientId))}` : '';
                const data = await hisGet(`/api/his/prescriptions${q}`);
                return data;
            },
        },
        // ── 7. Medications catalog ────────────────────────────
        {
            definition: {
                name: 'his_list_medications',
                description: 'List medications available in the hospital pharmacy / formulary. Returns medication name, code, ingredients, form. Use when asking about available drugs, medication lookup, or which medications are in the system.',
                category: 'healthcare',
                parameters: [
                    { name: 'query', type: 'string', description: 'Optional: search by medication name or ingredient', required: false },
                ],
            },
            handler: async (args) => {
                const q = args.query ? `?q=${encodeURIComponent(String(args.query))}` : '';
                const data = await hisGet(`/api/his/medications${q}`);
                return data;
            },
        },
        // ── 8. Clinical alerts ────────────────────────────────
        {
            definition: {
                name: 'his_list_alerts',
                description: 'List clinical safety alerts (allergy-drug conflicts, drug interactions detected). Returns alert type, severity, patient, medication involved, timestamp. Use when asking about warnings, safety alerts, drug interaction alerts, or clinical risks.',
                category: 'healthcare',
                parameters: [
                    { name: 'patientId', type: 'string', description: 'Optional: filter alerts by patient ID', required: false },
                ],
            },
            handler: async (args) => {
                const q = args.patientId ? `?patientId=${encodeURIComponent(String(args.patientId))}` : '';
                const data = await hisGet(`/api/his/alerts${q}`);
                return data;
            },
        },
    ],
});
