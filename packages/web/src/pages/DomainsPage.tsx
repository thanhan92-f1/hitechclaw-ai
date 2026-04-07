import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Globe, Search, Loader2, Plug, ArrowRight, Sparkles, Download, Trash2, Check, Package,
} from 'lucide-react';
import { getDomains, installDomain, uninstallDomain } from '../lib/api';
import { useDomainsStore } from '../stores/index.js';
import type { DomainPack } from '../stores/index.js';

type FilterMode = 'all' | 'installed' | 'available';

export function DomainsPage() {
    const { domains, setDomains, markInstalled, markUninstalled } = useDomainsStore();
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<FilterMode>('all');
    const [installing, setInstalling] = useState<string | null>(null);
    const navigate = useNavigate();

    const fetchDomains = useCallback(() => {
        getDomains()
            .then((data) => { if (data.domains) setDomains(data.domains as DomainPack[]); })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [setDomains]);

    useEffect(() => { fetchDomains(); }, [fetchDomains]);

    const handleInstall = async (id: string) => {
        setInstalling(id);
        try {
            await installDomain(id);
            markInstalled(id);
            setDomains(domains.map((d) => d.id === id ? { ...d, installed: true } : d) as DomainPack[]);
        } catch { /* ignore */ }
        setInstalling(null);
    };

    const handleUninstall = async (id: string) => {
        if (id === 'general') return;
        setInstalling(id);
        try {
            await uninstallDomain(id);
            markUninstalled(id);
            setDomains(domains.map((d) => d.id === id ? { ...d, installed: false } : d) as DomainPack[]);
        } catch { /* ignore */ }
        setInstalling(null);
    };

    const filtered = domains.filter((d) => {
        if (filter === 'installed' && !d.installed) return false;
        if (filter === 'available' && d.installed) return false;
        if (search) {
            const q = search.toLowerCase();
            return d.name.toLowerCase().includes(q) || d.description.toLowerCase().includes(q);
        }
        return true;
    });

    const installedCount = domains.filter((d) => d.installed).length;
    const totalSkills = domains.reduce((s, d) => s + (d.skills?.length || 0), 0);
    const filters: { key: FilterMode; label: string; count: number }[] = [
        { key: 'all', label: 'All', count: domains.length },
        { key: 'installed', label: 'Installed', count: installedCount },
        { key: 'available', label: 'Available', count: domains.length - installedCount },
    ];

    return (
        <div className="h-full overflow-y-auto">
            {/* Header */}
            <div className="px-6 pt-5 pb-4 border-b" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                <div className="max-w-5xl mx-auto">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <div className="flex items-center gap-2 mb-0.5">
                                <Package size={18} style={{ color: 'var(--color-primary)' }} />
                                <h1 className="text-xl font-bold" style={{ color: 'var(--color-fg)' }}>Domain Store</h1>
                            </div>
                            <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                                Browse & install AI domain specializations — {installedCount}/{domains.length} installed · {totalSkills} skills total
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Filter tabs */}
                        <div className="flex items-center gap-1">
                            {filters.map((f) => (
                                <button
                                    key={f.key}
                                    onClick={() => setFilter(f.key)}
                                    className="text-xs px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                                    style={{
                                        background: filter === f.key ? 'var(--color-primary-soft)' : 'transparent',
                                        color: filter === f.key ? 'var(--color-primary-light)' : 'var(--color-fg-muted)',
                                        fontWeight: filter === f.key ? 600 : 400,
                                    }}
                                >
                                    {f.label} ({f.count})
                                </button>
                            ))}
                        </div>
                        {/* Search */}
                        <div className="relative flex-1">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-fg-muted)' }} />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search domains..."
                                className="w-full pl-9 pr-3 py-2 rounded-lg text-sm border outline-none"
                                style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Grid */}
            <div className="px-6 py-5">
                <div className="max-w-5xl mx-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-20">
                            <Globe size={32} style={{ color: 'var(--color-fg-muted)', opacity: 0.3 }} className="mx-auto mb-2" />
                            <p className="text-sm" style={{ color: 'var(--color-fg-muted)' }}>
                                {search ? 'No domains match your search.' : 'No domain packs available.'}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 gap-3">
                            {filtered.map((d) => (
                                <DomainCard
                                    key={d.id}
                                    domain={d}
                                    installing={installing === d.id}
                                    onDetail={() => navigate(`/domains/${d.id}`)}
                                    onInstall={() => handleInstall(d.id)}
                                    onUninstall={() => handleUninstall(d.id)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function DomainCard({ domain, installing, onDetail, onInstall, onUninstall }: {
    domain: DomainPack;
    installing: boolean;
    onDetail: () => void;
    onInstall: () => void;
    onUninstall: () => void;
}) {
    const isGeneral = domain.id === 'general';

    return (
        <div
            className="relative p-4 rounded-xl border transition-all group"
            style={{
                background: 'var(--color-bg-surface)',
                borderColor: domain.installed ? 'var(--color-primary)' : 'var(--color-border)',
            }}
        >
            {/* Installed badge */}
            {domain.installed && (
                <div
                    className="absolute top-3 right-3 flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                    style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary-light)' }}
                >
                    <Check size={9} /> Installed
                </div>
            )}

            <div className="flex items-start mb-2">
                <span className="text-2xl">{domain.icon}</span>
            </div>
            <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--color-fg)' }}>{domain.name}</h3>
            <p className="text-[11px] line-clamp-2 mb-3" style={{ color: 'var(--color-fg-muted)' }}>{domain.description}</p>

            <div className="flex items-center gap-2 flex-wrap mb-3">
                <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium"
                    style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary-light)' }}
                >
                    <Sparkles size={9} /> {domain.skills?.length || 0} skills
                </span>
                {domain.integrations && domain.integrations.length > 0 && (
                    <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium"
                        style={{ background: 'var(--color-bg)', color: 'var(--color-fg-muted)' }}
                    >
                        <Plug size={9} /> {domain.integrations.length}
                    </span>
                )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
                <button
                    onClick={onDetail}
                    className="flex-1 flex items-center justify-center gap-1 text-[11px] py-1.5 rounded-lg border transition-colors cursor-pointer font-medium"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-fg-muted)', background: 'var(--color-bg)' }}
                >
                    Details <ArrowRight size={10} />
                </button>
                {domain.installed ? (
                    isGeneral ? (
                        <button
                            disabled
                            className="flex-1 flex items-center justify-center gap-1 text-[11px] py-1.5 rounded-lg transition-colors font-medium opacity-50"
                            style={{ background: 'var(--color-bg-soft)', color: 'var(--color-fg-muted)' }}
                        >
                            <Check size={10} /> Default
                        </button>
                    ) : (
                        <button
                            onClick={onUninstall}
                            disabled={installing}
                            className="flex-1 flex items-center justify-center gap-1 text-[11px] py-1.5 rounded-lg transition-colors cursor-pointer font-medium"
                            style={{ background: 'rgba(239,68,68,0.08)', color: 'rgb(239,68,68)' }}
                        >
                            {installing ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                            Uninstall
                        </button>
                    )
                ) : (
                    <button
                        onClick={onInstall}
                        disabled={installing}
                        className="flex-1 flex items-center justify-center gap-1 text-[11px] py-1.5 rounded-lg transition-colors cursor-pointer font-medium"
                        style={{ background: 'var(--color-primary)', color: 'white' }}
                    >
                        {installing ? <Loader2 size={10} className="animate-spin" /> : <Download size={10} />}
                        Install
                    </button>
                )}
            </div>
        </div>
    );
}
