import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
    MessageSquare,
    Database,
    LayoutDashboard,
    Settings,
    LogOut,
    Search,

    Cpu,
    Shield,
    ChevronDown,
    Boxes,
    BrainCircuit,
    Globe,
    Menu,
    X,
    Plug,
    Bot,
    Workflow,
    Radio,
    Palette,
    ShoppingBag,
    Shirt,
    TrendingUp,
    Printer,
    Pill,
    FileCode,
    ClipboardList,
    FileText,
    Users,
    AlertTriangle,
    BarChart3,
    FlaskConical,
    Building2,
    Wand2,
    BookOpen,
    ScrollText,
    type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useI18n } from '../i18n';
import { getDomains, getPluginPages } from '../lib/api';

const PLUGIN_ICON_MAP: Record<string, LucideIcon> = {
    'palette': Palette,
    'shopping-bag': ShoppingBag,
    'shirt': Shirt,
    'trending-up': TrendingUp,
    'printer': Printer,
    'pill': Pill,
    'file-code': FileCode,
    'clipboard-list': ClipboardList,
    'file-text': FileText,
    'users': Users,
    'alert-triangle': AlertTriangle,
};

interface DomainInfo {
    id: string;
    name: string;
    icon: string;
    skillCount: number;
}

interface PluginPageGroup {
    pluginId: string;
    pluginName: string;
    pluginIcon: string;
    pages: Array<{
        path: string;
        title: string;
        icon: string;
        sidebar?: boolean;
        sidebarGroup?: string;
    }>;
}

const MAIN_NAV = [
    { to: '/', icon: LayoutDashboard, key: 'nav.dashboard' as const },
    { to: '/chat', icon: MessageSquare, key: 'nav.chat' as const },
];

const KNOWLEDGE_NAV = [
    { to: '/knowledge', icon: Database, key: 'nav.knowledgeBase' as const },
    { to: '/search', icon: Search, key: 'nav.ragSearch' as const },
    { to: '/dev-docs', icon: BookOpen, key: 'nav.devDocs' as const },
];

const AGENTS_NAV = [
    { to: '/agents', icon: Bot, label: 'Agents' },
    { to: '/channels', icon: Radio, label: 'Channels' },
    { to: '/workflows', icon: Workflow, label: 'Workflows' },
    { to: '/marketplace', icon: Boxes, label: 'Marketplace' },
    { to: '/analytics', icon: BarChart3, label: 'Analytics' },
    { to: '/prompt-lab', icon: FlaskConical, label: 'Prompt Lab' },
    { to: '/agent-builder', icon: Wand2, label: 'Agent Builder' },
];

const ADMIN_NAV = [
    { to: '/admin', icon: Building2, label: 'Admin' },
];

const TOOLS_NAV = [
    { to: '/models', icon: Cpu, key: 'nav.ollamaModels' as const },
    { to: '/ml', icon: BrainCircuit, key: 'nav.mlAutoml' as const },
    { to: '/medical', icon: Shield, key: 'nav.medicalTools' as const },
    { to: '/mcp', icon: Plug, key: 'nav.mcpServers' as const },
];

export function Layout() {
    const { user, logout } = useAuth();
    const { t } = useI18n();
    const location = useLocation();
    const [domains, setDomains] = useState<DomainInfo[]>([]);
    const [domainsOpen, setDomainsOpen] = useState(false);
    const [collapsed, setCollapsed] = useState(false);
    const [pluginPages, setPluginPages] = useState<PluginPageGroup[]>([]);
    const [pluginGroupsOpen, setPluginGroupsOpen] = useState<Record<string, boolean>>({});

    useEffect(() => {
        getDomains()
            .then((data) => {
                if (data.domains) setDomains(data.domains);
            })
            .catch(() => { });
        getPluginPages()
            .then((data) => {
                if (data.pages) setPluginPages(data.pages);
            })
            .catch(() => { });
    }, []);

    useEffect(() => {
        if (location.pathname.startsWith('/domains')) {
            setDomainsOpen(true);
        }
    }, [location.pathname]);

    return (
        <div className="flex h-screen overflow-hidden" style={{ background: 'var(--color-bg)' }}>
            {/* Sidebar */}
            <aside
                className="glass-sidebar relative flex flex-col shrink-0 border-r transition-all duration-300 ease-in-out"
                style={{
                    borderColor: 'rgba(255, 255, 255, 0.06)',
                    width: collapsed ? '56px' : '248px',
                }}
            >
                {/* Gradient accent line */}
                <div
                    className="absolute left-0 top-0 bottom-0 w-[2px]"
                    style={{ background: 'linear-gradient(180deg, #6366f1 0%, #8b5cf6 30%, #06b6d4 60%, #10b981 100%)', opacity: 0.6 }}
                />

                {/* Logo */}
                <div className="flex items-center gap-2.5 px-3 h-14 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    {!collapsed && (
                        <>
                            <img
                                src="/logo.png"
                                alt="HiTechClaw"
                                className="w-8 h-8 rounded-lg"
                                style={{ boxShadow: '0 2px 10px rgba(99,102,241,0.25)' }}
                            />
                            <span className="text-lg font-bold tracking-tight" style={{ color: '#f4f4f5' }}>HiTechClaw</span>
                            <span
                                className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                                style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8' }}
                            >
                                v2
                            </span>
                        </>
                    )}
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className="ml-auto p-1.5 rounded-lg transition-all duration-200 cursor-pointer"
                        style={{ color: '#a1a1aa' }}
                        title={collapsed ? 'Expand' : 'Collapse'}
                    >
                        {collapsed ? <Menu size={18} /> : <X size={14} />}
                    </button>
                </div>

                {/* Nav */}
                <nav className="flex-1 py-2 px-2 overflow-y-auto space-y-1">
                    <NavSection label={t('nav.main')} collapsed={collapsed}>
                        {MAIN_NAV.map((item) => (
                            <SidebarLink key={item.to} to={item.to} icon={item.icon} label={t(item.key)} collapsed={collapsed} />
                        ))}
                    </NavSection>

                    <NavSection label={t('nav.knowledge')} collapsed={collapsed}>
                        {KNOWLEDGE_NAV.map((item) => (
                            <SidebarLink key={item.to} to={item.to} icon={item.icon} label={t(item.key)} collapsed={collapsed} />
                        ))}
                    </NavSection>

                    {/* Domain Packs */}
                    {domains.length > 0 && (
                        <NavSection label={t('nav.domains')} collapsed={collapsed}>
                            {!collapsed ? (
                                <>
                                    <button
                                        onClick={() => setDomainsOpen(!domainsOpen)}
                                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                                        style={{ color: 'var(--color-fg-muted)' }}
                                    >
                                        <Globe size={15} />
                                        <span className="flex-1 text-left">{t('nav.allDomains')}</span>
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                                            style={{ background: 'var(--color-bg-soft)', color: 'var(--color-fg-muted)' }}>
                                            {domains.length}
                                        </span>
                                        <ChevronDown
                                            size={12}
                                            className="transition-transform"
                                            style={{ transform: domainsOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                                        />
                                    </button>
                                    {domainsOpen && (
                                        <div className="ml-1 space-y-0.5 animate-fade-in">
                                            <SidebarLink to="/domains" icon={Boxes} label={t('nav.domainHub')} collapsed={collapsed} />
                                            {domains.slice(0, 8).map((d) => (
                                                <NavLink
                                                    key={d.id}
                                                    to={`/domains/${d.id}`}
                                                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors"
                                                    style={({ isActive }) => ({
                                                        background: isActive ? 'var(--color-primary-soft)' : 'transparent',
                                                        color: isActive ? 'var(--color-primary-light)' : 'var(--color-fg-muted)',
                                                    })}
                                                >
                                                    <span className="text-sm w-5 text-center">{d.icon}</span>
                                                    <span className="truncate">{d.name}</span>
                                                    <span className="ml-auto text-[10px] opacity-50">{d.skillCount}</span>
                                                </NavLink>
                                            ))}
                                            {domains.length > 8 && (
                                                <NavLink
                                                    to="/domains"
                                                    className="flex items-center gap-2 px-2 py-1 rounded-lg text-[11px] transition-colors"
                                                    style={{ color: 'var(--color-primary-light)' }}
                                                >
                                                    +{domains.length - 8} more...
                                                </NavLink>
                                            )}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <SidebarLink to="/domains" icon={Globe} label={t('nav.allDomains')} collapsed={collapsed} />
                            )}
                        </NavSection>
                    )}

                    <NavSection label="Agents" collapsed={collapsed}>
                        {AGENTS_NAV.map((item) => (
                            <SidebarLink key={item.to} to={item.to} icon={item.icon} label={item.label} collapsed={collapsed} />
                        ))}
                    </NavSection>

                    {/* Admin section — visible to owner, admin, super_admin */}
                    {(user?.isSuperAdmin || user?.role === 'owner' || user?.role === 'admin') && (
                        <NavSection label={user?.isSuperAdmin ? 'PLATFORM' : 'ADMIN'} collapsed={collapsed}>
                            {ADMIN_NAV.map((item) => (
                                <SidebarLink key={item.to} to={item.to} icon={item.icon} label={user?.isSuperAdmin ? 'Platform Admin' : item.label} collapsed={collapsed} />
                            ))}
                        </NavSection>
                    )}

                    <NavSection label={t('nav.tools')} collapsed={collapsed}>
                        {TOOLS_NAV.map((item) => (
                            <SidebarLink key={item.to} to={item.to} icon={item.icon} label={t(item.key)} collapsed={collapsed} />
                        ))}
                    </NavSection>

                    {/* Plugin Pages */}
                    {pluginPages.length > 0 && pluginPages.map((group) => {
                        const sidebarPages = group.pages.filter((p) => p.sidebar !== false);
                        if (sidebarPages.length === 0) return null;
                        const groupLabel = sidebarPages[0]?.sidebarGroup || group.pluginName;
                        const isOpen = pluginGroupsOpen[group.pluginId] ?? false;
                        return (
                            <NavSection key={group.pluginId} label={`${group.pluginIcon} ${groupLabel}`} collapsed={collapsed}>
                                {!collapsed ? (
                                    <>
                                        <button
                                            onClick={() => setPluginGroupsOpen((prev) => ({ ...prev, [group.pluginId]: !prev[group.pluginId] }))}
                                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                                            style={{ color: 'var(--color-fg-muted)' }}
                                        >
                                            <span className="text-sm">{group.pluginIcon}</span>
                                            <span className="flex-1 text-left">{group.pluginName}</span>
                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                                                style={{ background: 'var(--color-bg-soft)', color: 'var(--color-fg-muted)' }}>
                                                {sidebarPages.length}
                                            </span>
                                            <ChevronDown
                                                size={12}
                                                className="transition-transform"
                                                style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                                            />
                                        </button>
                                        {isOpen && (
                                            <div className="ml-1 space-y-0.5 animate-fade-in">
                                                {sidebarPages.map((page) => (
                                                    <NavLink
                                                        key={page.path}
                                                        to={`/plugins/${group.pluginId}/${page.path}`}
                                                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors"
                                                        style={({ isActive }) => ({
                                                            background: isActive ? 'var(--color-primary-soft)' : 'transparent',
                                                            color: isActive ? 'var(--color-primary-light)' : 'var(--color-fg-muted)',
                                                        })}
                                                    >
                                                        {(() => {
                                                            const IconComp = PLUGIN_ICON_MAP[page.icon];
                                                            return IconComp ? <IconComp size={15} /> : <span className="text-sm w-5 text-center">{page.icon}</span>;
                                                        })()}
                                                        <span className="truncate">{page.title}</span>
                                                    </NavLink>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <NavLink
                                        to={`/plugins/${group.pluginId}`}
                                        className="flex items-center justify-center py-2 rounded-lg text-sm transition-colors"
                                        style={{ color: 'var(--color-fg-muted)' }}
                                        title={group.pluginName}
                                    >
                                        {group.pluginIcon}
                                    </NavLink>
                                )}
                            </NavSection>
                        );
                    })}

                    <NavSection label={t('nav.system')} collapsed={collapsed}>
                        <SidebarLink to="/logs" icon={ScrollText} label="Logs" collapsed={collapsed} />
                        <SidebarLink to="/settings" icon={Settings} label={t('nav.settings')} collapsed={collapsed} />
                    </NavSection>
                </nav>

                {/* User */}
                <div
                    className="flex items-center gap-2.5 px-3 py-3 border-t"
                    style={{
                        borderColor: 'rgba(255,255,255,0.06)',
                        background: 'rgba(255,255,255,0.02)',
                    }}
                >
                    <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{
                            background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.15))',
                            color: '#818cf8',
                            border: '2px solid rgba(99,102,241,0.25)',
                            boxShadow: '0 0 12px rgba(99,102,241,0.1)',
                        }}
                    >
                        {user?.email?.charAt(0).toUpperCase() ?? 'U'}
                    </div>
                    {!collapsed && (
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate" style={{ color: '#e4e4e7' }}>{user?.email ?? 'Guest'}</p>
                            <p className="text-[10px] capitalize" style={{ color: user?.isSuperAdmin ? '#818cf8' : '#71717a' }}>
                                {user?.isSuperAdmin ? '⚡ Super Admin' : (user?.role ?? 'user')}
                            </p>
                        </div>
                    )}
                    <button
                        onClick={logout}
                        className="p-1.5 rounded-lg transition-all duration-200 cursor-pointer hover:bg-[rgba(239,68,68,0.1)]"
                        style={{ color: '#71717a' }}
                        title="Logout"
                    >
                        <LogOut size={14} />
                    </button>
                </div>
            </aside>

            {/* Main */}
            <main className="flex-1 overflow-hidden">
                <Outlet />
            </main>
        </div>
    );
}

function NavSection({ label, collapsed, children }: { label: string; collapsed: boolean; children: React.ReactNode }) {
    return (
        <div className="mb-1">
            {!collapsed && (
                <div className="px-2 pt-3 pb-1">
                    <span className="text-[10px] font-semibold tracking-wider" style={{ color: 'var(--color-fg-muted)', opacity: 0.5 }}>
                        {label}
                    </span>
                </div>
            )}
            {collapsed && <div className="pt-1" />}
            <div className="space-y-0.5">{children}</div>
        </div>
    );
}

function SidebarLink({
    to, icon: Icon, label, collapsed,
}: {
    to: string; icon: typeof LayoutDashboard; label: string; collapsed: boolean;
}) {
    return (
        <NavLink
            to={to}
            end={to === '/' || to === '/domains'}
            className={({ isActive }) =>
                `sidebar-link flex items-center gap-2.5 px-2 py-2 rounded-lg text-[13px] font-medium${isActive ? ' sidebar-link-active' : ''}`
            }
            style={({ isActive }) => ({
                color: isActive ? '#a5b4fc' : '#a1a1aa',
            })}
            title={collapsed ? label : undefined}
        >
            <Icon size={17} className="shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
        </NavLink>
    );
}
