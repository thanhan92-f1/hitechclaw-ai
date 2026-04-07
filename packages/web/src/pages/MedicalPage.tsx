import { useState, useEffect } from 'react';
import { Pill, Search, FileText, AlertTriangle, ClipboardList, Loader2, ChevronRight, X, Shield, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import {
    checkDrugInteraction,
    searchICD10,
    generateSOAPNote,
    checkClinicalAlert,
    getMedicalTemplates,
    getMedicalTemplate,
    fillMedicalTemplate,
} from '../lib/api';

type Tab = 'drug-interaction' | 'icd10' | 'soap-note' | 'clinical-alert' | 'templates';

export function MedicalPage() {
    const [activeTab, setActiveTab] = useState<Tab>('drug-interaction');

    const tabs: { id: Tab; label: string; icon: typeof Pill }[] = [
        { id: 'drug-interaction', label: 'Drug Interactions', icon: Pill },
        { id: 'icd10', label: 'ICD-10 Lookup', icon: Search },
        { id: 'soap-note', label: 'SOAP Notes', icon: FileText },
        { id: 'clinical-alert', label: 'Clinical Alerts', icon: AlertTriangle },
        { id: 'templates', label: 'Templates', icon: ClipboardList },
    ];

    return (
        <div className="flex flex-col h-full">
            <div
                className="flex items-center gap-2 px-6 h-14 border-b shrink-0"
                style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}
            >
                <Shield size={20} style={{ color: 'var(--color-primary)' }} />
                <h2 className="text-sm font-semibold" style={{ color: 'var(--color-fg)' }}>Medical Tools</h2>
                <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary-light)' }}>
                    Doctor Support
                </span>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 px-6 py-2 border-b overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
                        style={{
                            background: activeTab === tab.id ? 'var(--color-primary-soft)' : 'transparent',
                            color: activeTab === tab.id ? 'var(--color-primary-light)' : 'var(--color-fg-muted)',
                        }}
                    >
                        <tab.icon size={14} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-4xl mx-auto">
                    {activeTab === 'drug-interaction' && <DrugInteractionPanel />}
                    {activeTab === 'icd10' && <ICD10Panel />}
                    {activeTab === 'soap-note' && <SOAPNotePanel />}
                    {activeTab === 'clinical-alert' && <ClinicalAlertPanel />}
                    {activeTab === 'templates' && <TemplatesPanel />}
                </div>
            </div>
        </div>
    );
}

// ─── Drug Interaction Panel ─────────────────────────────────

function DrugInteractionPanel() {
    const [drugs, setDrugs] = useState<string[]>(['', '']);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{
        interactions: Array<{
            drug1: string; drug2: string; severity: string;
            description: string; mechanism: string; recommendation: string;
        }>;
        hasCritical: boolean;
        aiAnalysis?: string;
    } | null>(null);

    const addDrug = () => setDrugs((prev) => [...prev, '']);
    const removeDrug = (i: number) => setDrugs((prev) => prev.filter((_, idx) => idx !== i));
    const updateDrug = (i: number, val: string) => setDrugs((prev) => prev.map((d, idx) => idx === i ? val : d));

    const check = async () => {
        const validDrugs = drugs.filter((d) => d.trim());
        if (validDrugs.length < 2) return;
        setLoading(true);
        try {
            const data = await checkDrugInteraction(validDrugs);
            setResult(data);
        } catch { /* ignore */ }
        setLoading(false);
    };

    const severityColor: Record<string, string> = {
        critical: '#ef4444',
        major: '#f97316',
        moderate: '#eab308',
        minor: '#22c55e',
    };

    return (
        <div className="space-y-4">
            <p className="text-sm" style={{ color: 'var(--color-fg-muted)' }}>
                Enter medications to check for potential drug-drug interactions.
            </p>

            <div className="space-y-2">
                {drugs.map((drug, i) => (
                    <div key={i} className="flex gap-2">
                        <input
                            value={drug}
                            onChange={(e) => updateDrug(i, e.target.value)}
                            placeholder={`Drug ${i + 1} (e.g., warfarin, aspirin, lisinopril)`}
                            className="flex-1 px-3 py-2 rounded-lg text-sm border outline-none"
                            style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                        />
                        {drugs.length > 2 && (
                            <button onClick={() => removeDrug(i)} className="p-2 cursor-pointer" style={{ color: 'var(--color-fg-muted)' }}>
                                <X size={16} />
                            </button>
                        )}
                    </div>
                ))}
            </div>

            <div className="flex gap-2">
                <button onClick={addDrug} className="text-xs px-3 py-1.5 rounded-lg cursor-pointer" style={{ background: 'var(--color-bg-soft)', color: 'var(--color-fg-muted)' }}>
                    + Add Drug
                </button>
                <button
                    onClick={check}
                    disabled={loading || drugs.filter((d) => d.trim()).length < 2}
                    className="text-xs px-4 py-1.5 rounded-lg cursor-pointer disabled:opacity-40"
                    style={{ background: 'var(--color-primary)', color: 'white' }}
                >
                    {loading ? <Loader2 size={14} className="animate-spin" /> : 'Check Interactions'}
                </button>
            </div>

            {result && (
                <div className="space-y-3 mt-4">
                    {result.interactions.length === 0 ? (
                        <div className="p-4 rounded-lg text-sm" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                            No known interactions found between these medications.
                        </div>
                    ) : (
                        result.interactions.map((ix, i) => (
                            <div
                                key={i}
                                className="p-4 rounded-lg border-l-4"
                                style={{
                                    background: 'var(--color-bg-soft)',
                                    borderLeftColor: severityColor[ix.severity] || '#888',
                                }}
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <AlertTriangle size={16} style={{ color: severityColor[ix.severity] }} />
                                    <span className="text-xs font-bold uppercase" style={{ color: severityColor[ix.severity] }}>
                                        {ix.severity}
                                    </span>
                                    <span className="text-sm font-medium" style={{ color: 'var(--color-fg)' }}>
                                        {ix.drug1} + {ix.drug2}
                                    </span>
                                </div>
                                <p className="text-sm mb-1" style={{ color: 'var(--color-fg)' }}>{ix.description}</p>
                                <p className="text-xs mb-1" style={{ color: 'var(--color-fg-muted)' }}>
                                    <strong>Mechanism:</strong> {ix.mechanism}
                                </p>
                                <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                                    <strong>Recommendation:</strong> {ix.recommendation}
                                </p>
                            </div>
                        ))
                    )}

                    {result.aiAnalysis && (
                        <div className="p-4 rounded-lg border" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
                            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-primary-light)' }}>AI Analysis</p>
                            <div className="text-sm prose-chat" style={{ color: 'var(--color-fg)' }}>
                                <ReactMarkdown>{result.aiAnalysis}</ReactMarkdown>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── ICD-10 Lookup ──────────────────────────────────────────

function ICD10Panel() {
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState('');
    const [results, setResults] = useState<Array<{ code: string; description: string; category: string; commonTerms: string[] }>>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    const search = async () => {
        if (!query && !category) return;
        setLoading(true);
        try {
            const data = await searchICD10(query, category || undefined);
            setResults(data.results);
            if (data.categories) setCategories(data.categories);
        } catch { /* ignore */ }
        setLoading(false);
    };

    useEffect(() => {
        searchICD10('', '').then((data) => {
            if (data.categories) setCategories(data.categories);
            setResults(data.results);
        }).catch(() => { });
    }, []);

    return (
        <div className="space-y-4">
            <p className="text-sm" style={{ color: 'var(--color-fg-muted)' }}>
                Search ICD-10 codes by description, code, or common terms.
            </p>

            <div className="flex gap-2">
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && search()}
                    placeholder="Search (e.g., diabetes, J06.9, chest pain)"
                    className="flex-1 px-3 py-2 rounded-lg text-sm border outline-none"
                    style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                />
                <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="px-3 py-2 rounded-lg text-sm border outline-none"
                    style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                >
                    <option value="">All Categories</option>
                    {categories.map((c) => (
                        <option key={c} value={c}>{c}</option>
                    ))}
                </select>
                <button
                    onClick={search}
                    disabled={loading}
                    className="px-4 py-2 rounded-lg text-sm cursor-pointer disabled:opacity-40"
                    style={{ background: 'var(--color-primary)', color: 'white' }}
                >
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                </button>
            </div>

            <div className="space-y-2">
                {results.map((code) => (
                    <div
                        key={code.code}
                        className="flex items-start gap-3 p-3 rounded-lg border transition-colors"
                        style={{ background: 'var(--color-bg-soft)', borderColor: 'var(--color-border)' }}
                    >
                        <div
                            className="px-2 py-1 rounded text-xs font-mono font-bold shrink-0"
                            style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary-light)' }}
                        >
                            {code.code}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium" style={{ color: 'var(--color-fg)' }}>{code.description}</p>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--color-bg)', color: 'var(--color-fg-muted)' }}>
                                    {code.category}
                                </span>
                                {code.commonTerms.slice(0, 3).map((term) => (
                                    <span key={term} className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                                        {term}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
                {results.length === 0 && !loading && query && (
                    <p className="text-sm text-center py-6" style={{ color: 'var(--color-fg-muted)' }}>No results found.</p>
                )}
            </div>
        </div>
    );
}

// ─── SOAP Note Generator ────────────────────────────────────

function SOAPNotePanel() {
    const [chiefComplaint, setChiefComplaint] = useState('');
    const [patientContext, setPatientContext] = useState('');
    const [vitals, setVitals] = useState('');
    const [examFindings, setExamFindings] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState('');

    const generate = async () => {
        if (!chiefComplaint.trim()) return;
        setLoading(true);
        try {
            const data = await generateSOAPNote({
                chiefComplaint,
                patientContext: patientContext || undefined,
                vitals: vitals || undefined,
                examFindings: examFindings || undefined,
            });
            setResult(data.soapNote);
        } catch {
            setResult('Failed to generate SOAP note. Check LLM configuration.');
        }
        setLoading(false);
    };

    return (
        <div className="space-y-4">
            <p className="text-sm" style={{ color: 'var(--color-fg-muted)' }}>
                Generate an AI-assisted SOAP note from clinical information.
            </p>

            <div className="space-y-3">
                <div>
                    <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-fg-muted)' }}>Chief Complaint *</label>
                    <textarea
                        value={chiefComplaint}
                        onChange={(e) => setChiefComplaint(e.target.value)}
                        placeholder="e.g., 45yo male presents with 3 days of productive cough, fever, and malaise"
                        rows={2}
                        className="w-full px-3 py-2 rounded-lg text-sm border outline-none resize-none"
                        style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                    />
                </div>
                <div>
                    <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-fg-muted)' }}>Patient Context</label>
                    <input
                        value={patientContext}
                        onChange={(e) => setPatientContext(e.target.value)}
                        placeholder="e.g., PMH: HTN, DM2. Allergies: PCN."
                        className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                        style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                    />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-fg-muted)' }}>Vitals</label>
                        <textarea
                            value={vitals}
                            onChange={(e) => setVitals(e.target.value)}
                            placeholder="e.g., BP 130/80, HR 92, T 101.2F, RR 20, SpO2 95%"
                            rows={2}
                            className="w-full px-3 py-2 rounded-lg text-sm border outline-none resize-none"
                            style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-fg-muted)' }}>Exam Findings</label>
                        <textarea
                            value={examFindings}
                            onChange={(e) => setExamFindings(e.target.value)}
                            placeholder="e.g., Lungs: crackles RLL. Heart: RRR, no murmur."
                            rows={2}
                            className="w-full px-3 py-2 rounded-lg text-sm border outline-none resize-none"
                            style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                        />
                    </div>
                </div>
            </div>

            <button
                onClick={generate}
                disabled={loading || !chiefComplaint.trim()}
                className="px-4 py-2 rounded-lg text-sm cursor-pointer disabled:opacity-40"
                style={{ background: 'var(--color-primary)', color: 'white' }}
            >
                {loading ? <Loader2 size={14} className="animate-spin inline mr-1" /> : null}
                Generate SOAP Note
            </button>

            {result && (
                <div
                    className="p-4 rounded-lg border prose-chat"
                    style={{ background: 'var(--color-bg-soft)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                >
                    <ReactMarkdown>{result}</ReactMarkdown>
                </div>
            )}
        </div>
    );
}

// ─── Clinical Alert Panel ───────────────────────────────────

function ClinicalAlertPanel() {
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{
        alerts: Array<{
            alert: string; severity: string;
            recommendation: string; matchedKeywords: string[];
        }>;
        hasEmergency: boolean;
    } | null>(null);

    const check = async () => {
        if (!text.trim()) return;
        setLoading(true);
        try {
            const data = await checkClinicalAlert(text);
            setResult(data);
        } catch { /* ignore */ }
        setLoading(false);
    };

    const severityConfig: Record<string, { color: string; bg: string; icon: typeof AlertTriangle }> = {
        emergency: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', icon: AlertCircle },
        urgent: { color: '#f97316', bg: 'rgba(249,115,22,0.1)', icon: AlertTriangle },
        warning: { color: '#eab308', bg: 'rgba(234,179,8,0.1)', icon: AlertTriangle },
    };

    return (
        <div className="space-y-4">
            <p className="text-sm" style={{ color: 'var(--color-fg-muted)' }}>
                Paste clinical notes or patient symptoms to check for red flags and emergency alerts.
            </p>

            <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="e.g., Patient reports sudden onset worst headache of life with neck stiffness and photophobia..."
                rows={4}
                className="w-full px-3 py-2 rounded-lg text-sm border outline-none resize-none"
                style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
            />

            <button
                onClick={check}
                disabled={loading || !text.trim()}
                className="px-4 py-2 rounded-lg text-sm cursor-pointer disabled:opacity-40"
                style={{ background: 'var(--color-primary)', color: 'white' }}
            >
                {loading ? <Loader2 size={14} className="animate-spin inline mr-1" /> : null}
                Check for Red Flags
            </button>

            {result && (
                <div className="space-y-3">
                    {result.alerts.length === 0 ? (
                        <div className="p-4 rounded-lg text-sm" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                            No clinical red flags detected.
                        </div>
                    ) : (
                        result.alerts.map((alert, i) => {
                            const cfg = severityConfig[alert.severity] || severityConfig.warning;
                            return (
                                <div key={i} className="p-4 rounded-lg border-l-4" style={{ background: cfg.bg, borderLeftColor: cfg.color }}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <AlertTriangle size={16} style={{ color: cfg.color }} />
                                        <span className="text-xs font-bold uppercase" style={{ color: cfg.color }}>
                                            {alert.severity}
                                        </span>
                                        <span className="text-sm font-medium" style={{ color: 'var(--color-fg)' }}>
                                            {alert.alert}
                                        </span>
                                    </div>
                                    <p className="text-sm mb-2" style={{ color: 'var(--color-fg)' }}>{alert.recommendation}</p>
                                    <div className="flex flex-wrap gap-1">
                                        {alert.matchedKeywords.map((kw) => (
                                            <span key={kw} className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.1)', color: cfg.color }}>
                                                {kw}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Templates Panel ────────────────────────────────────────

function TemplatesPanel() {
    const [templates, setTemplates] = useState<Array<{ id: string; name: string; category: string; description: string; fieldCount: number }>>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<{
        id: string; name: string; fields: Array<{ name: string; label: string; type: string; options?: string[]; required?: boolean }>;
    } | null>(null);
    const [formData, setFormData] = useState<Record<string, string>>({});
    const [result, setResult] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        getMedicalTemplates().then((data) => setTemplates(data.templates)).catch(() => { });
    }, []);

    const selectTemplate = async (id: string) => {
        try {
            const tpl = await getMedicalTemplate(id);
            setSelectedTemplate(tpl);
            setFormData({});
            setResult('');
        } catch { /* ignore */ }
    };

    const submit = async () => {
        if (!selectedTemplate) return;
        setLoading(true);
        try {
            const data = await fillMedicalTemplate(selectedTemplate.id, formData);
            setResult(data.result);
        } catch { /* ignore */ }
        setLoading(false);
    };

    if (selectedTemplate) {
        return (
            <div className="space-y-4">
                <button
                    onClick={() => { setSelectedTemplate(null); setResult(''); }}
                    className="flex items-center gap-1 text-xs cursor-pointer"
                    style={{ color: 'var(--color-fg-muted)' }}
                >
                    &larr; Back to templates
                </button>
                <h3 className="text-lg font-semibold" style={{ color: 'var(--color-fg)' }}>{selectedTemplate.name}</h3>

                <div className="space-y-3">
                    {selectedTemplate.fields.map((field) => (
                        <div key={field.name}>
                            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-fg-muted)' }}>
                                {field.label} {field.required && '*'}
                            </label>
                            {field.type === 'textarea' ? (
                                <textarea
                                    value={formData[field.name] || ''}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, [field.name]: e.target.value }))}
                                    rows={3}
                                    className="w-full px-3 py-2 rounded-lg text-sm border outline-none resize-none"
                                    style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                                />
                            ) : field.type === 'select' ? (
                                <select
                                    value={formData[field.name] || ''}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, [field.name]: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                                    style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                                >
                                    <option value="">Select...</option>
                                    {field.options?.map((opt) => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    type={field.type === 'date' ? 'date' : 'text'}
                                    value={formData[field.name] || ''}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, [field.name]: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                                    style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                                />
                            )}
                        </div>
                    ))}
                </div>

                <button
                    onClick={submit}
                    disabled={loading}
                    className="px-4 py-2 rounded-lg text-sm cursor-pointer disabled:opacity-40"
                    style={{ background: 'var(--color-primary)', color: 'white' }}
                >
                    {loading ? <Loader2 size={14} className="animate-spin inline mr-1" /> : null}
                    Generate Document
                </button>

                {result && (
                    <div
                        className="p-4 rounded-lg border prose-chat"
                        style={{ background: 'var(--color-bg-soft)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                    >
                        <ReactMarkdown>{result}</ReactMarkdown>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <p className="text-sm" style={{ color: 'var(--color-fg-muted)' }}>
                Select a medical template to fill out and generate documentation.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {templates.map((tpl) => (
                    <button
                        key={tpl.id}
                        onClick={() => selectTemplate(tpl.id)}
                        className="flex items-center gap-3 p-4 rounded-lg border text-left transition-colors cursor-pointer"
                        style={{ background: 'var(--color-bg-soft)', borderColor: 'var(--color-border)' }}
                    >
                        <ClipboardList size={24} style={{ color: 'var(--color-primary)' }} />
                        <div className="flex-1">
                            <p className="text-sm font-medium" style={{ color: 'var(--color-fg)' }}>{tpl.name}</p>
                            <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>{tpl.description}</p>
                            <p className="text-xs mt-1" style={{ color: 'var(--color-fg-muted)' }}>
                                {tpl.category} · {tpl.fieldCount} fields
                            </p>
                        </div>
                        <ChevronRight size={16} style={{ color: 'var(--color-fg-muted)' }} />
                    </button>
                ))}
            </div>
        </div>
    );
}
