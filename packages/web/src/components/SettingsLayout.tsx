import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
    Activity, Users, Brain, Languages, Database, Globe, Shield, Settings, RefreshCw, Loader2,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useI18n } from '../i18n';
import { getHealth, getModels, getDomains } from '../lib/api';

const MENU_ITEMS = [
    { to: '/settings', icon: Activity, key: 'settings.menu.overview' as const, end: true },
    { to: '/settings/users', icon: Users, key: 'settings.menu.users' as const, end: false },
    { to: '/settings/models', icon: Brain, key: 'settings.menu.models' as const, end: false },
    { to: '/settings/language', icon: Languages, key: 'settings.menu.language' as const, end: false },
    { to: '/settings/rag', icon: Database, key: 'settings.menu.rag' as const, end: false },
    { to: '/settings/domains', icon: Globe, key: 'settings.menu.domains' as const, end: false },
    { to: '/settings/security', icon: Shield, key: 'settings.menu.security' as const, end: false },
];

export interface SettingsContextData {
    health: any;
    models: any[];
    activeModel: string;
    domains: any[];
    refreshing: boolean;
    refresh: () => Promise<void>;
    setActiveModel: (m: string) => void;
}

// Shared settings data context — avoids re-fetching in every sub-page
import { createContext, useContext } from 'react';
const SettingsCtx = createContext<SettingsContextData | null>(null);
export function useSettingsData() {
    const ctx = useContext(SettingsCtx);
    if (!ctx) throw new Error('useSettingsData must be used inside SettingsLayout');
    return ctx;
}

export function SettingsLayout() {
    const { t } = useI18n();
    const location = useLocation();
    const [health, setHealth] = useState<any>(null);
    const [models, setModels] = useState<any[]>([]);
    const [activeModel, setActiveModel] = useState('');
    const [domains, setDomains] = useState<any[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    const refresh = async () => {
        setRefreshing(true);
        try {
            const [h, m, d] = await Promise.all([
                getHealth().catch(() => null),
                getModels().catch(() => ({ models: [], activeModel: '' })),
                getDomains().catch(() => ({ domains: [] })),
            ]);
            setHealth(h);
            if (m.models) setModels(m.models);
            if (m.activeModel) setActiveModel(m.activeModel);
            if (d.domains) setDomains(d.domains);
        } catch { /* ignore */ }
        setRefreshing(false);
    };

    useEffect(() => { refresh(); }, []);

    return (
        <SettingsCtx.Provider value={{ health, models, activeModel, domains, refreshing, refresh, setActiveModel }}>
            <div className="flex h-full overflow-hidden">
                {/* Settings Sidebar */}
                <aside
                    className="w-56 shrink-0 border-r flex flex-col"
                    style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}
                >
                    {/* Header */}
                    <div className="px-4 pt-5 pb-3">
                        <div className="flex items-center gap-2 mb-0.5">
                            <Settings size={16} style={{ color: 'var(--color-primary)' }} />
                            <h2 className="text-sm font-bold" style={{ color: 'var(--color-fg)' }}>{t('settings.title')}</h2>
                        </div>
                        <p className="text-[10px] pl-6" style={{ color: 'var(--color-fg-muted)' }}>{t('settings.subtitle')}</p>
                    </div>

                    {/* Menu */}
                    <nav className="flex-1 px-2 py-1 overflow-y-auto space-y-0.5">
                        {MENU_ITEMS.map(({ to, icon: Icon, key, end }) => (
                            <NavLink
                                key={to}
                                to={to}
                                end={end}
                                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors"
                                style={({ isActive }) => ({
                                    background: isActive ? 'var(--color-primary-soft)' : 'transparent',
                                    color: isActive ? 'var(--color-primary-light)' : 'var(--color-fg-muted)',
                                })}
                            >
                                <Icon size={15} />
                                {t(key)}
                            </NavLink>
                        ))}
                    </nav>

                    {/* Refresh button */}
                    <div className="px-3 py-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                        <button
                            onClick={refresh}
                            disabled={refreshing}
                            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border cursor-pointer transition-colors"
                            style={{ borderColor: 'var(--color-border)', color: 'var(--color-fg-muted)', background: 'var(--color-bg)' }}
                        >
                            {refreshing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                            {t('common.refresh')}
                        </button>
                    </div>
                </aside>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    <div className="px-6 py-5">
                        <div className="max-w-4xl mx-auto">
                            <Outlet />
                        </div>
                    </div>
                </div>
            </div>
        </SettingsCtx.Provider>
    );
}
