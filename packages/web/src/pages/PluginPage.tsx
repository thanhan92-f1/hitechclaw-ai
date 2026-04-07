import { useState, useEffect, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { getPlugins } from '../lib/api';
import { ShirtGenDesigns } from './plugins/ShirtGenDesigns';
import { ShirtGenTrending } from './plugins/ShirtGenTrending';
import { ShirtGenMarketplace } from './plugins/ShirtGenMarketplace';
import { ShirtGenTryOn } from './plugins/ShirtGenTryOn';
import { ShirtGenPrintSpecs } from './plugins/ShirtGenPrintSpecs';
import { HealthcarePatients } from './plugins/HealthcarePatients';
import { HealthcareDrugChecker } from './plugins/HealthcareDrugChecker';
import { HealthcareClinicalNotes } from './plugins/HealthcareClinicalNotes';
import { HealthcareIcd10 } from './plugins/HealthcareIcd10';
import { HealthcareAlerts } from './plugins/HealthcareAlerts';
import { HealthcareTemplates } from './plugins/HealthcareTemplates';

const PLUGIN_PAGE_COMPONENTS: Record<string, Record<string, () => ReactNode>> = {
    shirtgen: {
        designs: () => <ShirtGenDesigns />,
        trending: () => <ShirtGenTrending />,
        marketplace: () => <ShirtGenMarketplace />,
        'try-on': () => <ShirtGenTryOn />,
        'print-specs': () => <ShirtGenPrintSpecs />,
    },
    healthcare: {
        patients: () => <HealthcarePatients />,
        'drug-checker': () => <HealthcareDrugChecker />,
        'clinical-notes': () => <HealthcareClinicalNotes />,
        icd10: () => <HealthcareIcd10 />,
        alerts: () => <HealthcareAlerts />,
        templates: () => <HealthcareTemplates />,
    },
};

interface PluginInfo {
    id: string;
    name: string;
    version: string;
    description: string;
    icon: string;
    status: string;
    pages: Array<{ path: string; title: string; icon: string }>;
    collections: string[];
}

export function PluginPage() {
    const { pluginId, '*': subPath } = useParams();
    const [plugin, setPlugin] = useState<PluginInfo | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getPlugins()
            .then((data) => {
                const found = data.plugins?.find((p: PluginInfo) => p.id === pluginId);
                setPlugin(found || null);
            })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [pluginId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full" style={{ background: 'var(--color-bg)' }}>
                <div className="animate-spin w-6 h-6 border-2 border-t-transparent rounded-full"
                    style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
            </div>
        );
    }

    if (!plugin) {
        return (
            <div className="flex items-center justify-center h-full" style={{ background: 'var(--color-bg)', color: 'var(--color-fg-muted)' }}>
                <p>Plugin not found</p>
            </div>
        );
    }

    const currentPage = plugin.pages?.find((p) => p.path === subPath);
    const pageTitle = currentPage?.title || plugin.name;
    const pageIcon = currentPage?.icon || plugin.icon;

    // Render dedicated sub-page component full-bleed (no generic wrapper)
    if (subPath && pluginId && PLUGIN_PAGE_COMPONENTS[pluginId]?.[subPath]) {
        return (
            <div className="h-full" style={{ background: 'var(--color-bg)' }}>
                {PLUGIN_PAGE_COMPONENTS[pluginId][subPath]()}
            </div>
        );
    }

    return (
        <div className="h-full overflow-auto p-6" style={{ background: 'var(--color-bg)' }}>
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <div className="flex items-center gap-3 mb-2">
                        <span className="text-3xl">{pageIcon}</span>
                        <div>
                            <h1 className="text-2xl font-bold" style={{ color: 'var(--color-fg)' }}>{pageTitle}</h1>
                            <p className="text-sm" style={{ color: 'var(--color-fg-muted)' }}>
                                {plugin.name} v{plugin.version} — {plugin.description}
                            </p>
                        </div>
                        <span className="ml-auto text-xs px-2 py-1 rounded-full font-medium"
                            style={{
                                background: plugin.status === 'active' ? 'var(--color-success-soft, rgba(34,197,94,0.15))' : 'var(--color-bg-soft)',
                                color: plugin.status === 'active' ? 'var(--color-success, #22c55e)' : 'var(--color-fg-muted)',
                            }}>
                            {plugin.status}
                        </span>
                    </div>
                </div>

                {/* Plugin Pages Grid */}
                {!subPath && plugin.pages && plugin.pages.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                        {plugin.pages.map((page) => (
                            <a
                                key={page.path}
                                href={`/plugins/${pluginId}/${page.path}`}
                                className="p-4 rounded-xl border transition-colors hover:border-[var(--color-primary)]"
                                style={{
                                    background: 'var(--color-bg-surface)',
                                    borderColor: 'var(--color-border)',
                                }}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">{page.icon}</span>
                                    <span className="font-medium" style={{ color: 'var(--color-fg)' }}>{page.title}</span>
                                </div>
                            </a>
                        ))}
                    </div>
                )}

                {/* Plugin Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <StatCard label="Pages" value={plugin.pages?.length || 0} />
                    <StatCard label="Collections" value={plugin.collections?.length || 0} />
                    <StatCard label="Status" value={plugin.status} />
                    <StatCard label="Version" value={plugin.version} />
                </div>

                {/* Current Page Content (fallback for plugins without dedicated UI) */}
                {subPath && (
                    <div className="rounded-xl border p-8 text-center"
                        style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                        <span className="text-4xl mb-4 block">{pageIcon}</span>
                        <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-fg)' }}>{pageTitle}</h2>
                        <p className="text-sm" style={{ color: 'var(--color-fg-muted)' }}>
                            Plugin page content will be rendered here.
                            <br />
                            API endpoint: <code className="px-1.5 py-0.5 rounded text-xs" style={{ background: 'var(--color-bg-soft)' }}>
                                /api/plugins/{pluginId}/api/*
                            </code>
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
    return (
        <div className="rounded-xl border p-4"
            style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
            <p className="text-xs mb-1" style={{ color: 'var(--color-fg-muted)' }}>{label}</p>
            <p className="text-lg font-bold" style={{ color: 'var(--color-fg)' }}>{String(value)}</p>
        </div>
    );
}
