import { useState, useEffect } from 'react';
import { TrendingUp, Loader2, Eye, Heart, ShoppingCart, Flame, Star, ArrowUp } from 'lucide-react';
import { shirtgenGetTrending, shirtgenGetDesigns } from '../../lib/api';

interface TrendingItem {
    designId: string;
    trendingScore: number;
    category: string;
    rank: number;
    title: string;
    tags: string[];
}

interface DesignMap {
    [id: string]: {
        prompt: string;
        variations: Array<{ imageUrl: string }>;
        engagement: { views: number; likes: number; purchases: number };
        aesthetic: string;
    };
}

const CATEGORY_META: Record<string, { label: string; icon: typeof Flame; color: string }> = {
    'trending-now': { label: '🔥 Trending Now', icon: Flame, color: '#ef4444' },
    'hot-this-week': { label: '⭐ Hot This Week', icon: Star, color: '#f59e0b' },
    'rising': { label: '📈 Rising', icon: ArrowUp, color: '#10b981' },
};

export function ShirtGenTrending() {
    const [trending, setTrending] = useState<TrendingItem[]>([]);
    const [designMap, setDesignMap] = useState<DesignMap>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            shirtgenGetTrending().catch(() => ({ trending: [] })),
            shirtgenGetDesigns({ limit: 50 }).catch(() => ({ designs: [] })),
        ]).then(([trendData, designData]) => {
            setTrending(trendData.trending || []);
            const map: DesignMap = {};
            for (const d of (designData.designs || [])) {
                map[d.id] = d;
            }
            setDesignMap(map);
        }).finally(() => setLoading(false));
    }, []);

    const categories = [...new Set(trending.map(t => t.category))];

    return (
        <div className="h-full overflow-y-auto">
            <div className="px-6 pt-5 pb-4 border-b" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                <div className="max-w-6xl mx-auto">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.15)' }}>
                            <TrendingUp size={20} color="#ef4444" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold" style={{ color: 'var(--color-fg)' }}>Trending Designs</h1>
                            <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                                Most popular T-shirt designs across the marketplace
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 py-5">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
                    </div>
                ) : trending.length === 0 ? (
                    <div className="text-center py-20">
                        <TrendingUp size={48} className="mx-auto mb-3 opacity-20" />
                        <p className="text-sm" style={{ color: 'var(--color-fg-muted)' }}>No trending data yet</p>
                    </div>
                ) : (
                    categories.map(cat => {
                        const meta = CATEGORY_META[cat] || { label: cat, icon: Star, color: '#6366f1' };
                        const items = trending.filter(t => t.category === cat).sort((a, b) => a.rank - b.rank);

                        return (
                            <div key={cat} className="mb-8">
                                <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--color-fg)' }}>{meta.label}</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {items.map(item => {
                                        const design = designMap[item.designId];
                                        const imgUrl = design?.variations?.[0]?.imageUrl;

                                        return (
                                            <div key={`${item.designId}-${item.category}`}
                                                className="rounded-xl border overflow-hidden group"
                                                style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                                                {/* Image */}
                                                <div className="relative aspect-video overflow-hidden" style={{ background: 'var(--color-bg)' }}>
                                                    {imgUrl ? (
                                                        <img src={imgUrl} alt={item.title} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center">
                                                            <TrendingUp size={32} style={{ color: 'var(--color-fg-muted)', opacity: 0.2 }} />
                                                        </div>
                                                    )}
                                                    <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-bold"
                                                        style={{ background: 'rgba(0,0,0,0.7)', color: meta.color }}>
                                                        #{item.rank}
                                                    </div>
                                                    <div className="absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-medium"
                                                        style={{ background: 'rgba(0,0,0,0.7)', color: 'white' }}>
                                                        Score: {item.trendingScore}
                                                    </div>
                                                </div>
                                                <div className="p-3">
                                                    <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--color-fg)' }}>{item.title}</h3>
                                                    <div className="flex gap-1 flex-wrap mb-2">
                                                        {item.tags.map(t => (
                                                            <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full"
                                                                style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}>{t}</span>
                                                        ))}
                                                    </div>
                                                    {design && (
                                                        <div className="flex gap-3 text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                                                            <span className="flex items-center gap-1"><Eye size={12} />{design.engagement.views}</span>
                                                            <span className="flex items-center gap-1"><Heart size={12} />{design.engagement.likes}</span>
                                                            <span className="flex items-center gap-1"><ShoppingCart size={12} />{design.engagement.purchases}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
