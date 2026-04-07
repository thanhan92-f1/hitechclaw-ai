import { useState, useEffect } from 'react';
import {
    ShoppingBag, Loader2, Eye, Heart, Search, ShoppingCart, Star, Filter,
} from 'lucide-react';
import { shirtgenGetDesigns } from '../../lib/api';

interface Design {
    id: string;
    prompt: string;
    status: string;
    variations: Array<{ index: number; imageUrl: string; qualityScore?: number }>;
    selectedVariation?: number;
    tshirt: { fit: string; size: string; color: string };
    tags: string[];
    aesthetic: string;
    metadata?: { title?: string; description?: string; colorPalette?: string[] };
    engagement: { views: number; likes: number; shares: number; saves: number; purchases: number };
}

export function ShirtGenMarketplace() {
    const [designs, setDesigns] = useState<Design[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState<'popular' | 'newest' | 'likes'>('popular');

    useEffect(() => {
        shirtgenGetDesigns({ limit: 50 })
            .then((data) => setDesigns((data.designs || []).filter((d: Design) => ['generated', 'print-ready', 'finalized'].includes(d.status))))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    const sorted = [...designs]
        .filter(d => !search || d.prompt.toLowerCase().includes(search.toLowerCase()) || d.tags.some(t => t.includes(search.toLowerCase())))
        .sort((a, b) => {
            if (sortBy === 'popular') return b.engagement.purchases - a.engagement.purchases;
            if (sortBy === 'likes') return b.engagement.likes - a.engagement.likes;
            return 0; // newest is default order from API
        });

    return (
        <div className="h-full overflow-y-auto">
            <div className="px-6 pt-5 pb-4 border-b" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                <div className="max-w-6xl mx-auto">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(168,85,247,0.15)' }}>
                            <ShoppingBag size={20} color="#a855f7" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold" style={{ color: 'var(--color-fg)' }}>Marketplace</h1>
                            <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>Browse and discover T-shirt designs</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex-1 relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-fg-muted)' }} />
                            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search marketplace..."
                                className="w-full pl-9 pr-4 py-2 rounded-lg border text-sm outline-none"
                                style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }} />
                        </div>
                        <div className="flex gap-1 border rounded-lg px-1 py-0.5" style={{ borderColor: 'var(--color-border)' }}>
                            {(['popular', 'likes', 'newest'] as const).map(s => (
                                <button key={s} onClick={() => setSortBy(s)}
                                    className="px-3 py-1 rounded text-xs font-medium transition-colors"
                                    style={{
                                        background: sortBy === s ? 'var(--color-primary-soft)' : 'transparent',
                                        color: sortBy === s ? 'var(--color-primary)' : 'var(--color-fg-muted)',
                                    }}>
                                    {s === 'popular' ? '🔥 Popular' : s === 'likes' ? '❤️ Most Liked' : '🆕 Newest'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 py-5">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
                    </div>
                ) : sorted.length === 0 ? (
                    <div className="text-center py-20">
                        <ShoppingBag size={48} className="mx-auto mb-3 opacity-20" />
                        <p className="text-sm" style={{ color: 'var(--color-fg-muted)' }}>No designs in marketplace yet</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {sorted.map(design => {
                            const title = design.metadata?.title || design.prompt.slice(0, 40);
                            const imgUrl = design.variations?.[design.selectedVariation || 0]?.imageUrl;
                            const score = design.variations?.[design.selectedVariation || 0]?.qualityScore;

                            return (
                                <div key={design.id} className="rounded-xl border overflow-hidden group cursor-pointer"
                                    style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                                    <div className="relative aspect-square" style={{ background: 'var(--color-bg)' }}>
                                        {imgUrl ? (
                                            <img src={imgUrl} alt={title} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <ShoppingBag size={32} style={{ color: 'var(--color-fg-muted)', opacity: 0.15 }} />
                                            </div>
                                        )}
                                        {score && (
                                            <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                                                style={{ background: 'rgba(0,0,0,0.7)', color: score >= 90 ? '#22c55e' : '#f59e0b' }}>
                                                <Star size={10} /> {score}
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                                            <button className="w-full py-2 rounded-lg text-xs font-medium"
                                                style={{ background: 'var(--color-primary)', color: 'white' }}>
                                                View Details
                                            </button>
                                        </div>
                                    </div>
                                    <div className="p-3">
                                        <h3 className="text-sm font-semibold truncate" style={{ color: 'var(--color-fg)' }}>{title}</h3>
                                        <div className="flex items-center justify-between mt-2 text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                                            <div className="flex gap-2">
                                                <span className="flex items-center gap-0.5"><Eye size={11} />{design.engagement.views}</span>
                                                <span className="flex items-center gap-0.5"><Heart size={11} />{design.engagement.likes}</span>
                                            </div>
                                            <span className="px-1.5 py-0.5 rounded text-[10px]"
                                                style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}>
                                                {design.aesthetic}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
