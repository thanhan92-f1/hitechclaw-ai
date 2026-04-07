import { useState } from 'react';
import { Pill, Search, AlertTriangle, Loader2, Plus, X } from 'lucide-react';
import { healthcareCheckDrugInteraction } from '../../lib/api';

interface Interaction {
    drug1: string;
    drug2: string;
    severity: 'high' | 'moderate' | 'low';
    description: string;
}

const SEVERITY_COLORS: Record<string, { bg: string; fg: string }> = {
    high: { bg: 'rgba(239,68,68,0.12)', fg: '#ef4444' },
    moderate: { bg: 'rgba(245,158,11,0.12)', fg: '#f59e0b' },
    low: { bg: 'rgba(59,130,246,0.12)', fg: '#3b82f6' },
};

export function HealthcareDrugChecker() {
    const [drugs, setDrugs] = useState<string[]>([]);
    const [input, setInput] = useState('');
    const [results, setResults] = useState<Interaction[] | null>(null);
    const [loading, setLoading] = useState(false);

    const addDrug = () => {
        const d = input.trim();
        if (d && !drugs.includes(d)) {
            setDrugs([...drugs, d]);
            setInput('');
        }
    };

    const removeDrug = (drug: string) => setDrugs(drugs.filter(d => d !== drug));

    const check = () => {
        if (drugs.length < 2) return;
        setLoading(true);
        healthcareCheckDrugInteraction(drugs)
            .then(d => setResults(d.interactions || []))
            .catch(() => setResults([]))
            .finally(() => setLoading(false));
    };

    return (
        <div className="h-full overflow-y-auto">
            <div className="px-6 pt-5 pb-4 border-b" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                <div className="max-w-4xl mx-auto">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(168,85,247,0.15)' }}>
                            <Pill size={20} color="#a855f7" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold" style={{ color: 'var(--color-fg)' }}>Drug Interaction Checker</h1>
                            <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>Check for potential interactions between medications</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-6 py-5 space-y-5">
                {/* Input */}
                <div className="rounded-xl border p-5" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                    <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-fg)' }}>Add Medications</h3>
                    <div className="flex gap-2 mb-3">
                        <input
                            className="flex-1 px-3 py-2 rounded-lg border text-sm outline-none"
                            style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                            placeholder="Type drug name (e.g. Metformin)..."
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addDrug()}
                        />
                        <button onClick={addDrug} className="px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1"
                            style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}>
                            <Plus size={16} /> Add
                        </button>
                    </div>

                    {drugs.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                            {drugs.map(d => (
                                <span key={d} className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg"
                                    style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}>
                                    {d}
                                    <button onClick={() => removeDrug(d)} className="hover:opacity-70"><X size={14} /></button>
                                </span>
                            ))}
                        </div>
                    )}

                    <button onClick={check} disabled={drugs.length < 2 || loading}
                        className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-40"
                        style={{ background: 'var(--color-primary)', color: '#fff' }}>
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <><Search size={14} className="inline mr-1" /> Check Interactions ({drugs.length} drugs)</>}
                    </button>
                </div>

                {/* Results */}
                {results !== null && (
                    <div className="rounded-xl border p-5" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-fg)' }}>
                            {results.length > 0 ? `${results.length} Interaction(s) Found` : 'No interactions found'}
                        </h3>
                        {results.length === 0 && (
                            <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>No known interactions between these medications.</p>
                        )}
                        <div className="space-y-3">
                            {results.map((r, i) => {
                                const sev = SEVERITY_COLORS[r.severity] || SEVERITY_COLORS.low;
                                return (
                                    <div key={i} className="rounded-lg border p-4" style={{ borderColor: 'var(--color-border)' }}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <AlertTriangle size={16} style={{ color: sev.fg }} />
                                            <span className="text-sm font-semibold" style={{ color: 'var(--color-fg)' }}>
                                                {r.drug1} + {r.drug2}
                                            </span>
                                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase"
                                                style={{ background: sev.bg, color: sev.fg }}>{r.severity}</span>
                                        </div>
                                        <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>{r.description}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
