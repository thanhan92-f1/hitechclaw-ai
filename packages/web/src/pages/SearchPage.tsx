import { useState, useEffect, type FormEvent } from 'react';
import { Search, Loader2, FileText, Zap, ArrowRight, Clock, FolderOpen } from 'lucide-react';
import { searchKnowledge, getCollections, getQueryHistory } from '../lib/api';

interface SearchResult {
    content: string;
    score: number;
    source: string;
    documentId: string;
    chunkIndex: number;
}

interface Collection {
    id: string;
    name: string;
    color: string;
}

interface HistoryEntry {
    id: string;
    query: string;
    resultCount: number;
    avgScore: number;
    timestamp: string;
}

export function SearchPage() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [context, setContext] = useState('');
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const [topK, setTopK] = useState(5);
    const [collectionId, setCollectionId] = useState('');
    const [collections, setCollections] = useState<Collection[]>([]);
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [showHistory, setShowHistory] = useState(false);

    useEffect(() => {
        Promise.all([
            getCollections().then((d) => setCollections(d.collections || [])),
            getQueryHistory(10).then((d) => setHistory(d.history || [])),
        ]).catch(() => { });
    }, []);

    const handleSearch = async (e?: FormEvent) => {
        e?.preventDefault();
        if (!query.trim()) return;
        setLoading(true);
        setSearched(true);
        try {
            const data = await searchKnowledge(query, topK, collectionId || undefined);
            setResults(data.results);
            setContext(data.context);
            getQueryHistory(10).then((d) => setHistory(d.history || [])).catch(() => { });
        } catch {
            setResults([]);
            setContext('');
        } finally {
            setLoading(false);
        }
    };

    const useHistoryQuery = (q: string) => {
        setQuery(q);
        setShowHistory(false);
    };

    return (
        <div className="h-full overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-fg)' }}>RAG Search</h1>
                        <p className="text-sm mt-1" style={{ color: 'var(--color-fg-muted)' }}>
                            Test retrieval quality — see what context the AI retrieves for any query
                        </p>
                    </div>
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs border cursor-pointer"
                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-fg-muted)' }}
                    >
                        <Clock size={14} /> History
                    </button>
                </div>

                {/* Search Form */}
                <form
                    onSubmit={handleSearch}
                    className="flex flex-col gap-3 mb-6 p-4 rounded-xl border"
                    style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}
                >
                    <div className="flex gap-3">
                        <div className="flex-1 relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-fg-muted)' }} />
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Enter a natural language query..."
                                className="w-full pl-9 pr-3 py-2.5 rounded-lg text-sm border outline-none"
                                style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading || !query.trim()}
                            className="px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-colors cursor-pointer disabled:opacity-40"
                            style={{ background: 'var(--color-primary)' }}
                        >
                            {loading ? <Loader2 size={16} className="animate-spin" /> : 'Search'}
                        </button>
                    </div>
                    <div className="flex gap-3">
                        {/* Collection Filter */}
                        <select
                            value={collectionId}
                            onChange={(e) => setCollectionId(e.target.value)}
                            className="px-3 py-2 rounded-lg text-xs border outline-none"
                            style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                        >
                            <option value="">All Collections</option>
                            {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <select
                            value={topK}
                            onChange={(e) => setTopK(Number(e.target.value))}
                            className="px-3 py-2 rounded-lg text-xs border outline-none"
                            style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                        >
                            <option value={3}>Top 3</option>
                            <option value={5}>Top 5</option>
                            <option value={10}>Top 10</option>
                            <option value={20}>Top 20</option>
                        </select>
                    </div>
                </form>

                {/* Query History Panel */}
                {showHistory && history.length > 0 && (
                    <div className="mb-6 p-4 rounded-xl border animate-fade-in" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                        <h3 className="text-xs font-semibold mb-2 uppercase" style={{ color: 'var(--color-fg-muted)' }}>Recent Queries</h3>
                        <div className="space-y-1">
                            {history.map((h) => (
                                <button
                                    key={h.id}
                                    onClick={() => useHistoryQuery(h.query)}
                                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-left cursor-pointer transition-colors hover:opacity-80"
                                    style={{ background: 'var(--color-bg)' }}
                                >
                                    <Clock size={12} style={{ color: 'var(--color-fg-muted)' }} />
                                    <span className="flex-1 truncate" style={{ color: 'var(--color-fg-soft)' }}>{h.query}</span>
                                    <span style={{ color: 'var(--color-fg-muted)' }}>{h.resultCount} results</span>
                                    <span style={{ color: 'var(--color-success)' }}>{Math.round(h.avgScore * 100)}%</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Results */}
                {searched && !loading && results.length === 0 && (
                    <div className="text-center py-16">
                        <Search size={40} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--color-fg-muted)' }} />
                        <p className="text-sm" style={{ color: 'var(--color-fg-muted)' }}>
                            No results found. Try uploading documents first.
                        </p>
                    </div>
                )}

                {results.length > 0 && (
                    <div className="space-y-6">
                        {/* RAG Context Preview */}
                        <div
                            className="p-4 rounded-xl border"
                            style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}
                        >
                            <div className="flex items-center gap-2 mb-3">
                                <Zap size={16} style={{ color: 'var(--color-warning)' }} />
                                <h3 className="text-sm font-semibold" style={{ color: 'var(--color-fg)' }}>
                                    RAG Context (sent to LLM)
                                </h3>
                            </div>
                            <pre
                                className="text-xs p-3 rounded-lg overflow-x-auto max-h-48 overflow-y-auto"
                                style={{ background: 'var(--color-bg)', color: 'var(--color-fg-soft)' }}
                            >
                                {context || 'No context generated'}
                            </pre>
                        </div>

                        {/* Individual chunks */}
                        <div>
                            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-fg)' }}>
                                Retrieved Chunks ({results.length})
                            </h3>
                            <div className="space-y-3">
                                {results.map((result, idx) => (
                                    <div
                                        key={idx}
                                        className="p-4 rounded-xl border animate-fade-in"
                                        style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}
                                    >
                                        <div className="flex items-center gap-3 mb-2">
                                            <div
                                                className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold"
                                                style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary-light)' }}
                                            >
                                                {idx + 1}
                                            </div>
                                            <div className="flex-1 flex items-center gap-3">
                                                <FileText size={14} style={{ color: 'var(--color-fg-muted)' }} />
                                                <span className="text-xs font-medium" style={{ color: 'var(--color-fg-soft)' }}>{result.source}</span>
                                                <span className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>chunk #{result.chunkIndex}</span>
                                            </div>
                                            <ScoreBadge score={result.score} />
                                        </div>
                                        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-fg-soft)' }}>
                                            {result.content}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* How it works */}
                {!searched && (
                    <div
                        className="p-6 rounded-xl border mt-6"
                        style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}
                    >
                        <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-fg)' }}>How RAG Search Works</h3>
                        <div className="flex flex-col md:flex-row gap-4">
                            {[
                                { step: '1', title: 'Query Embedding', desc: 'Your query is converted to a vector embedding' },
                                { step: '2', title: 'Similarity Search', desc: 'Finds most similar document chunks by cosine distance' },
                                { step: '3', title: 'Context Building', desc: 'Top chunks form the context for the LLM' },
                                { step: '4', title: 'Augmented Answer', desc: 'LLM generates answer grounded in retrieved context' },
                            ].map((s, i) => (
                                <div key={s.step} className="flex items-start gap-2 flex-1">
                                    <div
                                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                                        style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary-light)' }}
                                    >
                                        {s.step}
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium" style={{ color: 'var(--color-fg)' }}>{s.title}</p>
                                        <p className="text-xs mt-0.5" style={{ color: 'var(--color-fg-muted)' }}>{s.desc}</p>
                                    </div>
                                    {i < 3 && <ArrowRight size={14} className="hidden md:block shrink-0 mt-1" style={{ color: 'var(--color-fg-muted)' }} />}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function ScoreBadge({ score }: { score: number }) {
    const pct = Math.round(score * 100);
    const color = pct >= 70 ? 'var(--color-success)' : pct >= 40 ? 'var(--color-warning)' : 'var(--color-fg-muted)';
    return (
        <span
            className="text-xs font-mono px-2 py-0.5 rounded"
            style={{ background: `${color}20`, color }}
        >
            {pct}%
        </span>
    );
}
