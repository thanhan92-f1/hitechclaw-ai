import { useState, useEffect, useCallback } from 'react';
import {
    Palette, Plus, Loader2, Search, Image, Eye, Heart, ShoppingCart,
    Sparkles, Filter, Grid3X3, List,
} from 'lucide-react';
import { shirtgenGetDesigns, shirtgenGenerate, shirtgenGetImageModels } from '../../lib/api';

interface Design {
    id: string;
    prompt: string;
    status: string;
    variations: Array<{ index: number; imageUrl: string; thumbnailUrl?: string; qualityScore?: number; printReady?: boolean }>;
    selectedVariation?: number;
    tshirt: { fit: string; size: string; color: string; fabricType: string; printArea: string };
    tags: string[];
    aesthetic: string;
    metadata?: { title?: string; description?: string; colorPalette?: string[] };
    engagement: { views: number; likes: number; shares: number; saves: number; purchases: number };
    createdAt: string;
}

interface ImageModel {
    id: string;
    name: string;
    quality: string;
    speed: string;
    cost: string;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    draft: { bg: 'rgba(148,163,184,0.15)', text: '#94a3b8' },
    generated: { bg: 'rgba(59,130,246,0.15)', text: '#3b82f6' },
    'print-ready': { bg: 'rgba(16,185,129,0.15)', text: '#10b981' },
    finalized: { bg: 'rgba(168,85,247,0.15)', text: '#a855f7' },
};

export function ShirtGenDesigns() {
    const [designs, setDesigns] = useState<Design[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [generating, setGenerating] = useState(false);
    const [genPrompt, setGenPrompt] = useState('');
    const [showGenPanel, setShowGenPanel] = useState(false);
    const [models, setModels] = useState<ImageModel[]>([]);
    const [provider, setProvider] = useState('');

    const fetchDesigns = useCallback(() => {
        setLoading(true);
        shirtgenGetDesigns({ limit: 50, status: statusFilter || undefined })
            .then((data) => { setDesigns(data.designs || []); setTotal(data.total || 0); })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [statusFilter]);

    useEffect(() => { fetchDesigns(); }, [fetchDesigns]);

    useEffect(() => {
        shirtgenGetImageModels()
            .then((data) => { setModels(data.models || []); setProvider(data.provider || ''); })
            .catch(() => { });
    }, []);

    const handleGenerate = async () => {
        if (!genPrompt.trim()) return;
        setGenerating(true);
        try {
            await shirtgenGenerate(genPrompt, { count: 3 });
            setGenPrompt('');
            setShowGenPanel(false);
            fetchDesigns();
        } catch { /* ignore */ }
        setGenerating(false);
    };

    const filtered = designs.filter((d) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return d.prompt.toLowerCase().includes(q)
            || d.tags.some(t => t.toLowerCase().includes(q))
            || d.metadata?.title?.toLowerCase().includes(q);
    });

    const stats = {
        total,
        generated: designs.filter(d => d.status === 'generated').length,
        finalized: designs.filter(d => d.status === 'finalized').length,
        totalLikes: designs.reduce((s, d) => s + (d.engagement?.likes || 0), 0),
    };

    return (
        <div className="h-full overflow-y-auto">
            {/* Header */}
            <div className="px-6 pt-5 pb-4 border-b" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                <div className="max-w-6xl mx-auto">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--color-primary-soft)' }}>
                                <Palette size={20} style={{ color: 'var(--color-primary)' }} />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold" style={{ color: 'var(--color-fg)' }}>Design Studio</h1>
                                <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                                    AI-powered T-shirt design generation • {provider || 'placeholder'} provider
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowGenPanel(!showGenPanel)}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                            style={{ background: 'var(--color-primary)', color: 'white' }}
                        >
                            <Plus size={16} /> Generate Design
                        </button>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-4 gap-3 mt-4">
                        {[
                            { label: 'Total Designs', value: stats.total, icon: Image },
                            { label: 'Generated', value: stats.generated, icon: Sparkles },
                            { label: 'Finalized', value: stats.finalized, icon: ShoppingCart },
                            { label: 'Total Likes', value: stats.totalLikes, icon: Heart },
                        ].map(({ label, value, icon: Icon }) => (
                            <div key={label} className="flex items-center gap-3 p-3 rounded-lg border"
                                style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
                                <Icon size={16} style={{ color: 'var(--color-primary)' }} />
                                <div>
                                    <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>{label}</p>
                                    <p className="text-lg font-bold" style={{ color: 'var(--color-fg)' }}>{value}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 py-4">
                {/* Generate Panel */}
                {showGenPanel && (
                    <div className="mb-5 p-5 rounded-xl border" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-primary)' }}>
                        <div className="flex items-center gap-2 mb-3">
                            <Sparkles size={18} style={{ color: 'var(--color-primary)' }} />
                            <h3 className="font-semibold" style={{ color: 'var(--color-fg)' }}>Generate New Design</h3>
                        </div>
                        <div className="flex gap-3">
                            <input
                                type="text"
                                value={genPrompt}
                                onChange={(e) => setGenPrompt(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                                placeholder="Describe your T-shirt design... e.g. 'Cyberpunk samurai cat with neon katana'"
                                className="flex-1 px-4 py-2.5 rounded-lg border text-sm outline-none"
                                style={{
                                    background: 'var(--color-bg)',
                                    borderColor: 'var(--color-border)',
                                    color: 'var(--color-fg)',
                                }}
                            />
                            <button
                                onClick={handleGenerate}
                                disabled={generating || !genPrompt.trim()}
                                className="px-5 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-opacity disabled:opacity-50"
                                style={{ background: 'var(--color-primary)', color: 'white' }}
                            >
                                {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                {generating ? 'Generating...' : 'Generate'}
                            </button>
                        </div>
                        {models.length > 0 && (
                            <div className="mt-3 flex gap-2 flex-wrap">
                                <span className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>Models:</span>
                                {models.map(m => (
                                    <span key={m.id} className="text-xs px-2 py-0.5 rounded-full border"
                                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-fg-muted)' }}>
                                        {m.name} ({m.cost})
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Search & Filter Bar */}
                <div className="flex items-center gap-3 mb-4">
                    <div className="flex-1 relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-fg-muted)' }} />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search designs..."
                            className="w-full pl-9 pr-4 py-2 rounded-lg border text-sm outline-none"
                            style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                        />
                    </div>
                    <div className="flex items-center gap-1 border rounded-lg px-1 py-0.5" style={{ borderColor: 'var(--color-border)' }}>
                        {['', 'draft', 'generated', 'print-ready', 'finalized'].map((s) => (
                            <button key={s} onClick={() => setStatusFilter(s)}
                                className="px-2.5 py-1 rounded text-xs font-medium transition-colors"
                                style={{
                                    background: statusFilter === s ? 'var(--color-primary-soft)' : 'transparent',
                                    color: statusFilter === s ? 'var(--color-primary)' : 'var(--color-fg-muted)',
                                }}>
                                {s || 'All'}
                            </button>
                        ))}
                    </div>
                    <div className="flex border rounded-lg" style={{ borderColor: 'var(--color-border)' }}>
                        <button onClick={() => setViewMode('grid')} className="p-1.5 rounded-l-lg"
                            style={{ background: viewMode === 'grid' ? 'var(--color-primary-soft)' : 'transparent' }}>
                            <Grid3X3 size={16} style={{ color: viewMode === 'grid' ? 'var(--color-primary)' : 'var(--color-fg-muted)' }} />
                        </button>
                        <button onClick={() => setViewMode('list')} className="p-1.5 rounded-r-lg"
                            style={{ background: viewMode === 'list' ? 'var(--color-primary-soft)' : 'transparent' }}>
                            <List size={16} style={{ color: viewMode === 'list' ? 'var(--color-primary)' : 'var(--color-fg-muted)' }} />
                        </button>
                    </div>
                </div>

                {/* Loading */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-20">
                        <Image size={48} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--color-fg-muted)' }} />
                        <p className="text-sm" style={{ color: 'var(--color-fg-muted)' }}>No designs found. Generate your first design!</p>
                    </div>
                ) : viewMode === 'grid' ? (
                    /* Grid View */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filtered.map((design) => (
                            <DesignCard key={design.id} design={design} />
                        ))}
                    </div>
                ) : (
                    /* List View */
                    <div className="space-y-2">
                        {filtered.map((design) => (
                            <DesignRow key={design.id} design={design} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function DesignCard({ design }: { design: Design }) {
    const title = design.metadata?.title || design.prompt.slice(0, 50);
    const variation = design.variations?.[design.selectedVariation || 0];
    const statusStyle = STATUS_COLORS[design.status] || STATUS_COLORS.draft;

    return (
        <div className="rounded-xl border overflow-hidden transition-all hover:shadow-lg group"
            style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
            {/* Image Preview */}
            <div className="relative aspect-square overflow-hidden" style={{ background: 'var(--color-bg)' }}>
                {variation?.imageUrl ? (
                    <img src={variation.imageUrl} alt={title} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <div className="text-center">
                            <Palette size={40} className="mx-auto mb-2 opacity-20" style={{ color: 'var(--color-fg-muted)' }} />
                            <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>{design.variations.length} variation{design.variations.length !== 1 ? 's' : ''}</p>
                        </div>
                    </div>
                )}
                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <button className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors">
                        <Eye size={18} color="white" />
                    </button>
                    <button className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors">
                        <Heart size={18} color="white" />
                    </button>
                </div>
                {/* Status badge */}
                <span className="absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: statusStyle.bg, color: statusStyle.text }}>
                    {design.status}
                </span>
            </div>

            {/* Info */}
            <div className="p-3">
                <h3 className="text-sm font-semibold truncate mb-1" style={{ color: 'var(--color-fg)' }}>{title}</h3>
                <p className="text-xs truncate mb-2" style={{ color: 'var(--color-fg-muted)' }}>{design.prompt}</p>

                {/* Tags */}
                <div className="flex gap-1 flex-wrap mb-2">
                    {design.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full"
                            style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}>
                            {tag}
                        </span>
                    ))}
                    {design.tags.length > 3 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                            style={{ background: 'var(--color-bg)', color: 'var(--color-fg-muted)' }}>
                            +{design.tags.length - 3}
                        </span>
                    )}
                </div>

                {/* Engagement */}
                <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                    <span className="flex items-center gap-1"><Eye size={12} /> {design.engagement.views}</span>
                    <span className="flex items-center gap-1"><Heart size={12} /> {design.engagement.likes}</span>
                    <span className="flex items-center gap-1"><ShoppingCart size={12} /> {design.engagement.purchases}</span>
                    <span className="ml-auto" style={{ color: design.tshirt.color, textShadow: '0 0 2px rgba(0,0,0,0.5)' }}>●</span>
                    <span>{design.tshirt.size}</span>
                </div>
            </div>
        </div>
    );
}

function DesignRow({ design }: { design: Design }) {
    const title = design.metadata?.title || design.prompt.slice(0, 60);
    const statusStyle = STATUS_COLORS[design.status] || STATUS_COLORS.draft;

    return (
        <div className="flex items-center gap-4 p-3 rounded-lg border transition-colors hover:border-[var(--color-primary)]"
            style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
            {/* Thumbnail */}
            <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0" style={{ background: 'var(--color-bg)' }}>
                {design.variations?.[0]?.imageUrl ? (
                    <img src={design.variations[0].imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <Palette size={20} style={{ color: 'var(--color-fg-muted)', opacity: 0.3 }} />
                    </div>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium truncate" style={{ color: 'var(--color-fg)' }}>{title}</h3>
                <div className="flex items-center gap-2 mt-1">
                    {design.tags.slice(0, 3).map(t => (
                        <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full"
                            style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}>{t}</span>
                    ))}
                </div>
            </div>
            <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                <span className="flex items-center gap-1"><Eye size={12} />{design.engagement.views}</span>
                <span className="flex items-center gap-1"><Heart size={12} />{design.engagement.likes}</span>
                <span>{design.variations.length} var</span>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: statusStyle.bg, color: statusStyle.text }}>
                {design.status}
            </span>
        </div>
    );
}
