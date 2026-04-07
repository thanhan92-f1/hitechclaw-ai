import { useState } from 'react';
import { Search, Loader2, FileCode } from 'lucide-react';
import { healthcareLookupIcd10, healthcareGetIcd10Categories } from '../../lib/api';
import { useEffect } from 'react';

interface IcdResult {
    code: string;
    description: string;
    category?: string;
}

export function HealthcareIcd10() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<IcdResult[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        healthcareGetIcd10Categories()
            .then(d => setCategories(d.categories || []))
            .catch(() => { });
    }, []);

    const search = () => {
        if (!query.trim()) return;
        setLoading(true);
        healthcareLookupIcd10(query.trim())
            .then(d => setResults(d.results || d.codes || []))
            .catch(() => setResults([]))
            .finally(() => setLoading(false));
    };

    return (
        <div className="h-full overflow-y-auto">
            <div className="px-6 pt-5 pb-4 border-b" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                <div className="max-w-5xl mx-auto">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(6,182,212,0.12)' }}>
                            <FileCode size={20} color="#06b6d4" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold" style={{ color: 'var(--color-fg)' }}>ICD-10 Code Lookup</h1>
                            <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>Search diagnosis codes by description or code</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-fg-muted)' }} />
                            <input
                                className="w-full pl-9 pr-4 py-2 rounded-lg border text-sm outline-none"
                                style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                                placeholder="Search code or description (e.g. E11, diabetes, hypertension)..."
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && search()}
                            />
                        </div>
                        <button onClick={search} disabled={loading || !query.trim()}
                            className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-40"
                            style={{ background: 'var(--color-primary)', color: '#fff' }}>
                            {loading ? <Loader2 size={16} className="animate-spin" /> : 'Search'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-6 py-5">
                {results.length > 0 && (
                    <div className="space-y-2 mb-6">
                        <h3 className="text-xs font-medium mb-2" style={{ color: 'var(--color-fg-muted)' }}>{results.length} result(s)</h3>
                        {results.map(r => (
                            <div key={r.code} className="flex items-start gap-3 rounded-lg border p-3 hover:border-[var(--color-primary)] transition-colors"
                                style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                                <span className="text-xs font-mono font-bold px-2 py-1 rounded" style={{ background: 'rgba(6,182,212,0.12)', color: '#06b6d4' }}>
                                    {r.code}
                                </span>
                                <div>
                                    <p className="text-sm" style={{ color: 'var(--color-fg)' }}>{r.description}</p>
                                    {r.category && <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-fg-muted)' }}>{r.category}</p>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {results.length === 0 && !loading && categories.length > 0 && (
                    <div>
                        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-fg)' }}>ICD-10 Categories</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {categories.map(c => (
                                <button key={c} onClick={() => { setQuery(c); }}
                                    className="text-left px-3 py-2 rounded-lg border text-xs hover:border-[var(--color-primary)] transition-colors"
                                    style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}>
                                    {c}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
