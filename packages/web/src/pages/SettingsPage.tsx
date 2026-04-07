import { useState, useEffect } from 'react';
import {
    Settings, RefreshCw, Server, Brain, Shield, Loader2, Cpu,
    Database, Globe, Plug, Palette, Activity, ChevronDown, ChevronRight,
    CheckCircle, AlertCircle, Clock, Zap, HardDrive, Languages, Save,
    Users, UserPlus, ShieldCheck, Mail, MoreVertical, Ban, CheckSquare, X,
} from 'lucide-react';
import { getHealth, getModels, getDomains, setActiveModel as apiSetActiveModel, getAISettings, updateAISettings, getRBACUsers, getRBACRoles, getRBACPermissions, inviteUser, updateUserStatus, assignUserRole, removeUserRole, createRole, deleteRole } from '../lib/api';
import { useSettingsStore } from '../stores/index.js';

type Tab = 'overview' | 'llm' | 'rag' | 'language' | 'domains' | 'users' | 'security';

const TABS: { id: Tab; label: string; icon: typeof Settings }[] = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'users', label: 'Users & RBAC', icon: Users },
    { id: 'llm', label: 'LLM / Models', icon: Brain },
    { id: 'language', label: 'Language', icon: Languages },
    { id: 'rag', label: 'RAG Engine', icon: Database },
    { id: 'domains', label: 'Domains', icon: Globe },
    { id: 'security', label: 'Security', icon: Shield },
];

export function SettingsPage() {
    const [health, setHealth] = useState<any>(null);
    const [models, setModels] = useState<any[]>([]);
    const [activeModel, setActiveModel] = useState('');
    const [domains, setDomains] = useState<any[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<Tab>('overview');
    const [switching, setSwitching] = useState<string | null>(null);

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

    const switchModel = async (name: string) => {
        setSwitching(name);
        try {
            await apiSetActiveModel(name);
            setActiveModel(name);
        } catch { /* ignore */ }
        setSwitching(null);
    };

    return (
        <div className="h-full overflow-y-auto">
            {/* Header */}
            <div className="px-6 pt-5 pb-0">
                <div className="max-w-5xl mx-auto">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-xl font-bold" style={{ color: 'var(--color-fg)' }}>Settings</h1>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--color-fg-muted)' }}>Platform configuration, status monitoring & domain management</p>
                        </div>
                        <button
                            onClick={refresh}
                            disabled={refreshing}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border cursor-pointer transition-colors"
                            style={{ borderColor: 'var(--color-border)', color: 'var(--color-fg-muted)', background: 'var(--color-bg-surface)' }}
                        >
                            {refreshing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                            Refresh
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-0.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                        {TABS.map(({ id, label, icon: Icon }) => (
                            <button
                                key={id}
                                onClick={() => setActiveTab(id)}
                                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer -mb-px"
                                style={{
                                    borderColor: activeTab === id ? 'var(--color-primary)' : 'transparent',
                                    color: activeTab === id ? 'var(--color-primary-light)' : 'var(--color-fg-muted)',
                                }}
                            >
                                <Icon size={13} />
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Tab Content */}
            <div className="px-6 py-5">
                <div className="max-w-5xl mx-auto">
                    {activeTab === 'overview' && <OverviewTab health={health} models={models} domains={domains} activeModel={activeModel} />}
                    {activeTab === 'users' && <UsersTab />}
                    {activeTab === 'llm' && <LLMTab models={models} activeModel={activeModel} switching={switching} onSwitch={switchModel} />}
                    {activeTab === 'language' && <LanguageTab />}
                    {activeTab === 'rag' && <RAGTab />}
                    {activeTab === 'domains' && <DomainsTab domains={domains} />}
                    {activeTab === 'security' && <SecurityTab />}
                </div>
            </div>
        </div>
    );
}

/* ─── Users & RBAC Tab ──────────────────────────────────── */
function UsersTab() {
    const [usersData, setUsersData] = useState<any[]>([]);
    const [rolesData, setRolesData] = useState<any[]>([]);
    const [permissionsData, setPermissionsData] = useState<Array<{ id: string; resource: string; action: string }>>([]);
    const [loading, setLoading] = useState(true);
    const [activeSubTab, setActiveSubTab] = useState<'users' | 'roles'>('users');

    // Invite form
    const [showInvite, setShowInvite] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteName, setInviteName] = useState('');
    const [inviteRole, setInviteRole] = useState('member');
    const [inviting, setInviting] = useState(false);

    // Create role form
    const [showCreateRole, setShowCreateRole] = useState(false);
    const [newRoleName, setNewRoleName] = useState('');
    const [newRoleDesc, setNewRoleDesc] = useState('');
    const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set());
    const [creatingRole, setCreatingRole] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const [u, r, p] = await Promise.all([
                getRBACUsers().catch(() => ({ users: [] })),
                getRBACRoles().catch(() => ({ roles: [] })),
                getRBACPermissions().catch(() => ({ permissions: [] })),
            ]);
            setUsersData(u.users || []);
            setRolesData(r.roles || []);
            setPermissionsData(p.permissions || []);
        } catch { /* ignore */ }
        setLoading(false);
    };

    useEffect(() => { loadData(); }, []);

    const handleInvite = async () => {
        if (!inviteEmail) return;
        setInviting(true);
        try {
            await inviteUser(inviteEmail, inviteName, inviteRole);
            setShowInvite(false);
            setInviteEmail('');
            setInviteName('');
            setInviteRole('member');
            await loadData();
        } catch { /* ignore */ }
        setInviting(false);
    };

    const handleStatusChange = async (userId: string, status: string) => {
        try {
            await updateUserStatus(userId, status);
            await loadData();
        } catch { /* ignore */ }
    };

    const handleCreateRole = async () => {
        if (!newRoleName) return;
        setCreatingRole(true);
        try {
            await createRole(newRoleName, newRoleDesc, Array.from(selectedPerms));
            setShowCreateRole(false);
            setNewRoleName('');
            setNewRoleDesc('');
            setSelectedPerms(new Set());
            await loadData();
        } catch { /* ignore */ }
        setCreatingRole(false);
    };

    const handleDeleteRole = async (roleId: string) => {
        try {
            await deleteRole(roleId);
            await loadData();
        } catch { /* ignore */ }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 size={20} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
            </div>
        );
    }

    // Group permissions by resource
    const permGroups: Record<string, Array<{ id: string; resource: string; action: string }>> = {};
    permissionsData.forEach((p) => {
        if (!permGroups[p.resource]) permGroups[p.resource] = [];
        permGroups[p.resource].push(p);
    });

    return (
        <div className="space-y-4">
            {/* Sub-tabs */}
            <div className="flex items-center gap-2">
                <button
                    onClick={() => setActiveSubTab('users')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                    style={{
                        background: activeSubTab === 'users' ? 'var(--color-primary)' : 'var(--color-bg)',
                        color: activeSubTab === 'users' ? 'white' : 'var(--color-fg-muted)',
                        border: activeSubTab === 'users' ? 'none' : '1px solid var(--color-border)',
                    }}
                >
                    <Users size={12} /> Users ({usersData.length})
                </button>
                <button
                    onClick={() => setActiveSubTab('roles')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                    style={{
                        background: activeSubTab === 'roles' ? 'var(--color-primary)' : 'var(--color-bg)',
                        color: activeSubTab === 'roles' ? 'white' : 'var(--color-fg-muted)',
                        border: activeSubTab === 'roles' ? 'none' : '1px solid var(--color-border)',
                    }}
                >
                    <ShieldCheck size={12} /> Roles ({rolesData.length})
                </button>
            </div>

            {activeSubTab === 'users' && (
                <>
                    {/* Invite button */}
                    <div className="flex justify-end">
                        <button
                            onClick={() => setShowInvite(!showInvite)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                            style={{ background: 'var(--color-primary)', color: 'white' }}
                        >
                            <UserPlus size={12} /> Invite User
                        </button>
                    </div>

                    {/* Invite form */}
                    {showInvite && (
                        <Section icon={UserPlus} title="Invite New User">
                            <div className="grid grid-cols-3 gap-3 mb-3">
                                <div>
                                    <label className="block text-[10px] font-medium mb-1" style={{ color: 'var(--color-fg-muted)' }}>Email *</label>
                                    <input
                                        type="email"
                                        value={inviteEmail}
                                        onChange={(e) => setInviteEmail(e.target.value)}
                                        placeholder="user@example.com"
                                        className="w-full px-2.5 py-1.5 rounded-lg border text-xs focus:outline-none"
                                        style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-medium mb-1" style={{ color: 'var(--color-fg-muted)' }}>Name</label>
                                    <input
                                        type="text"
                                        value={inviteName}
                                        onChange={(e) => setInviteName(e.target.value)}
                                        placeholder="Full name"
                                        className="w-full px-2.5 py-1.5 rounded-lg border text-xs focus:outline-none"
                                        style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-medium mb-1" style={{ color: 'var(--color-fg-muted)' }}>Role</label>
                                    <select
                                        value={inviteRole}
                                        onChange={(e) => setInviteRole(e.target.value)}
                                        className="w-full px-2.5 py-1.5 rounded-lg border text-xs focus:outline-none"
                                        style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                                    >
                                        {rolesData.map((r: any) => (
                                            <option key={r.name} value={r.name}>{r.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleInvite}
                                    disabled={inviting || !inviteEmail}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                                    style={{ background: 'var(--color-primary)', color: 'white', opacity: !inviteEmail ? 0.5 : 1 }}
                                >
                                    {inviting ? <Loader2 size={11} className="animate-spin" /> : <Mail size={11} />}
                                    Send Invite
                                </button>
                                <button
                                    onClick={() => setShowInvite(false)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs cursor-pointer border"
                                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-fg-muted)' }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </Section>
                    )}

                    {/* Users list */}
                    <Section icon={Users} title={`Team Members (${usersData.length})`}>
                        {usersData.length === 0 ? (
                            <p className="text-xs py-6 text-center" style={{ color: 'var(--color-fg-muted)' }}>No users found.</p>
                        ) : (
                            <div className="space-y-2">
                                {usersData.map((u: any) => (
                                    <div
                                        key={u.id}
                                        className="flex items-center gap-3 p-3 rounded-lg border transition-colors"
                                        style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
                                    >
                                        <div
                                            className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                                            style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary-light)' }}
                                        >
                                            {(u.name || u.email || '?')[0].toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate" style={{ color: 'var(--color-fg)' }}>
                                                {u.name || u.email}
                                            </p>
                                            <p className="text-[11px] truncate" style={{ color: 'var(--color-fg-muted)' }}>
                                                {u.email}
                                            </p>
                                        </div>
                                        {/* Roles */}
                                        <div className="flex gap-1 shrink-0">
                                            {(u.roles || []).map((role: string) => (
                                                <span
                                                    key={role}
                                                    className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                                                    style={{
                                                        background: role === 'owner' ? 'var(--color-primary-soft)' : role === 'admin' ? '#3b82f620' : 'var(--color-bg-soft)',
                                                        color: role === 'owner' ? 'var(--color-primary-light)' : role === 'admin' ? '#60a5fa' : 'var(--color-fg-muted)',
                                                    }}
                                                >
                                                    {role}
                                                </span>
                                            ))}
                                        </div>
                                        {/* Status */}
                                        <span
                                            className="text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0"
                                            style={{
                                                background: u.status === 'active' ? '#22c55e18' : u.status === 'invited' ? '#f59e0b18' : '#ef444418',
                                                color: u.status === 'active' ? '#4ade80' : u.status === 'invited' ? '#fbbf24' : '#f87171',
                                            }}
                                        >
                                            {u.status}
                                        </span>
                                        {/* Actions */}
                                        <div className="flex gap-1 shrink-0">
                                            {u.status === 'active' && (
                                                <button
                                                    onClick={() => handleStatusChange(u.id, 'suspended')}
                                                    title="Suspend user"
                                                    className="p-1.5 rounded-md cursor-pointer transition-colors hover:bg-red-500/10"
                                                    style={{ color: 'var(--color-fg-muted)' }}
                                                >
                                                    <Ban size={13} />
                                                </button>
                                            )}
                                            {u.status === 'suspended' && (
                                                <button
                                                    onClick={() => handleStatusChange(u.id, 'active')}
                                                    title="Reactivate user"
                                                    className="p-1.5 rounded-md cursor-pointer transition-colors hover:bg-green-500/10"
                                                    style={{ color: 'var(--color-fg-muted)' }}
                                                >
                                                    <CheckSquare size={13} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Section>
                </>
            )}

            {activeSubTab === 'roles' && (
                <>
                    {/* Create role button */}
                    <div className="flex justify-end">
                        <button
                            onClick={() => setShowCreateRole(!showCreateRole)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                            style={{ background: 'var(--color-primary)', color: 'white' }}
                        >
                            <ShieldCheck size={12} /> Create Role
                        </button>
                    </div>

                    {/* Create role form */}
                    {showCreateRole && (
                        <Section icon={ShieldCheck} title="Create New Role">
                            <div className="grid grid-cols-2 gap-3 mb-3">
                                <div>
                                    <label className="block text-[10px] font-medium mb-1" style={{ color: 'var(--color-fg-muted)' }}>Role Name *</label>
                                    <input
                                        type="text"
                                        value={newRoleName}
                                        onChange={(e) => setNewRoleName(e.target.value)}
                                        placeholder="e.g. developer"
                                        className="w-full px-2.5 py-1.5 rounded-lg border text-xs focus:outline-none"
                                        style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-medium mb-1" style={{ color: 'var(--color-fg-muted)' }}>Description</label>
                                    <input
                                        type="text"
                                        value={newRoleDesc}
                                        onChange={(e) => setNewRoleDesc(e.target.value)}
                                        placeholder="Role description"
                                        className="w-full px-2.5 py-1.5 rounded-lg border text-xs focus:outline-none"
                                        style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                                    />
                                </div>
                            </div>
                            <p className="text-[10px] font-medium mb-2" style={{ color: 'var(--color-fg-muted)' }}>PERMISSIONS</p>
                            <div className="grid grid-cols-2 gap-3 mb-3 max-h-52 overflow-y-auto">
                                {Object.entries(permGroups).map(([resource, perms]) => (
                                    <div key={resource} className="p-2 rounded-lg" style={{ background: 'var(--color-bg)' }}>
                                        <p className="text-[10px] font-semibold mb-1.5" style={{ color: 'var(--color-primary-light)' }}>{resource}</p>
                                        <div className="flex flex-wrap gap-1">
                                            {perms.map((perm) => {
                                                const selected = selectedPerms.has(perm.id);
                                                return (
                                                    <button
                                                        key={perm.id}
                                                        onClick={() => {
                                                            const next = new Set(selectedPerms);
                                                            if (selected) next.delete(perm.id); else next.add(perm.id);
                                                            setSelectedPerms(next);
                                                        }}
                                                        className="text-[10px] px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                                                        style={{
                                                            background: selected ? 'var(--color-primary)' : 'var(--color-bg-soft)',
                                                            color: selected ? 'white' : 'var(--color-fg-muted)',
                                                        }}
                                                    >
                                                        {perm.action}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleCreateRole}
                                    disabled={creatingRole || !newRoleName}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                                    style={{ background: 'var(--color-primary)', color: 'white', opacity: !newRoleName ? 0.5 : 1 }}
                                >
                                    {creatingRole ? <Loader2 size={11} className="animate-spin" /> : <ShieldCheck size={11} />}
                                    Create Role
                                </button>
                                <button
                                    onClick={() => setShowCreateRole(false)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs cursor-pointer border"
                                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-fg-muted)' }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </Section>
                    )}

                    {/* Roles list */}
                    <Section icon={ShieldCheck} title={`Roles (${rolesData.length})`}>
                        {rolesData.length === 0 ? (
                            <p className="text-xs py-6 text-center" style={{ color: 'var(--color-fg-muted)' }}>No roles found.</p>
                        ) : (
                            <div className="space-y-2">
                                {rolesData.map((role: any) => (
                                    <RoleCard key={role.id} role={role} onDelete={handleDeleteRole} />
                                ))}
                            </div>
                        )}
                    </Section>
                </>
            )}
        </div>
    );
}

function RoleCard({ role, onDelete }: { role: any; onDelete: (id: string) => void }) {
    const [expanded, setExpanded] = useState(false);
    const isSystem = role.isSystem;

    return (
        <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
            <div
                className="flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors"
                style={{ background: expanded ? 'var(--color-bg-soft)' : 'var(--color-bg)' }}
                onClick={() => setExpanded(!expanded)}
            >
                <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: isSystem ? 'var(--color-primary-soft)' : 'var(--color-bg-soft)' }}
                >
                    <ShieldCheck size={14} style={{ color: isSystem ? 'var(--color-primary)' : 'var(--color-fg-muted)' }} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: 'var(--color-fg)' }}>{role.name}</p>
                    <p className="text-[11px] truncate" style={{ color: 'var(--color-fg-muted)' }}>{role.description || 'No description'}</p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                    style={{
                        background: isSystem ? 'var(--color-primary-soft)' : '#f59e0b18',
                        color: isSystem ? 'var(--color-primary-light)' : '#fbbf24',
                    }}
                >
                    {isSystem ? 'system' : 'custom'}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                    style={{ background: 'var(--color-bg-soft)', color: 'var(--color-fg-muted)' }}
                >
                    {role.permissionCount ?? role.permissions?.length ?? 0} perms
                </span>
                {!isSystem && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(role.id); }}
                        className="p-1.5 rounded-md cursor-pointer transition-colors hover:bg-red-500/10"
                        style={{ color: 'var(--color-fg-muted)' }}
                        title="Delete role"
                    >
                        <X size={13} />
                    </button>
                )}
                {expanded ? <ChevronDown size={14} style={{ color: 'var(--color-fg-muted)' }} />
                    : <ChevronRight size={14} style={{ color: 'var(--color-fg-muted)' }} />}
            </div>
            {expanded && role.permissions && (
                <div className="px-3 py-2 border-t" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                    <div className="flex flex-wrap gap-1">
                        {role.permissions.map((p: string) => (
                            <span key={p} className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                                style={{ background: 'var(--color-bg)', color: 'var(--color-fg-muted)' }}
                            >
                                {p}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

/* ─── Overview Tab ──────────────────────────────────────── */
function OverviewTab({ health, models, domains, activeModel }: { health: any; models: any[]; domains: any[]; activeModel: string }) {
    return (
        <div className="space-y-4">
            {/* Status Cards */}
            <div className="grid grid-cols-4 gap-3">
                <StatusCard
                    icon={Server}
                    label="Server"
                    value={health?.status === 'ok' ? 'Online' : 'Offline'}
                    status={health?.status === 'ok' ? 'success' : 'error'}
                    detail={health ? `v${health.version}` : ''}
                />
                <StatusCard
                    icon={Cpu}
                    label="LLM Model"
                    value={activeModel || 'None'}
                    status={activeModel ? 'success' : 'warning'}
                    detail={`${models.length} available`}
                />
                <StatusCard
                    icon={Globe}
                    label="Domains"
                    value={`${domains.length}`}
                    status={domains.length > 0 ? 'success' : 'warning'}
                    detail={`${domains.reduce((s: number, d: any) => s + (d.skills?.length || 0), 0)} skills`}
                />
                <StatusCard
                    icon={Clock}
                    label="Uptime"
                    value={health ? formatUptime(health.uptime) : '—'}
                    status="neutral"
                    detail={health ? new Date(health.timestamp).toLocaleTimeString() : ''}
                />
            </div>

            {/* Server Details */}
            <Section icon={Server} title="Server Information">
                <div className="grid grid-cols-2 gap-2">
                    <InfoCell label="Status" value={health?.status ?? 'Unknown'} />
                    <InfoCell label="Version" value={health?.version ?? '—'} />
                    <InfoCell label="Uptime" value={health ? formatUptime(health.uptime) : '—'} />
                    <InfoCell label="Last Check" value={health ? new Date(health.timestamp).toLocaleString() : '—'} />
                    <InfoCell label="Platform" value="HiTechClaw v2" />
                    <InfoCell label="Runtime" value="Node.js + Hono" />
                </div>
            </Section>

            {/* Quick Info */}
            <div className="grid grid-cols-2 gap-3">
                <Section icon={Brain} title="Active LLM">
                    <div className="space-y-1.5">
                        <InfoCell label="Model" value={activeModel || 'Not configured'} />
                        <InfoCell label="Available Models" value={`${models.length}`} />
                        <InfoCell label="Total Size" value={`${models.reduce((s: number, m: any) => s + (m.sizeMB || 0), 0)} MB`} />
                    </div>
                </Section>
                <Section icon={Globe} title="Domain Packs">
                    <div className="space-y-1.5">
                        <InfoCell label="Loaded Domains" value={`${domains.length}`} />
                        <InfoCell label="Total Skills" value={`${domains.reduce((s: number, d: any) => s + (d.skills?.length || 0), 0)}`} />
                        <InfoCell label="Status" value={domains.length > 0 ? 'Active' : 'No domains loaded'} />
                    </div>
                </Section>
            </div>
        </div>
    );
}

/* ─── LLM Tab ──────────────────────────────────────────── */
function LLMTab({ models, activeModel, switching, onSwitch }: { models: any[]; activeModel: string; switching: string | null; onSwitch: (n: string) => void }) {
    return (
        <div className="space-y-4">
            <Section icon={Brain} title="LLM Configuration">
                <p className="text-xs mb-3" style={{ color: 'var(--color-fg-muted)' }}>
                    Configure LLM providers via environment variables. Switch active model below.
                </p>
                <div className="grid grid-cols-2 gap-2">
                    <EnvVar name="LLM_PROVIDER" desc="Provider backend" example="ollama | openai | anthropic" />
                    <EnvVar name="LLM_MODEL" desc="Default model name" example="llama3.1:8b" />
                    <EnvVar name="OPENAI_API_KEY" desc="OpenAI key" example="sk-proj-..." />
                    <EnvVar name="ANTHROPIC_API_KEY" desc="Anthropic key" example="sk-ant-..." />
                    <EnvVar name="OLLAMA_URL" desc="Ollama endpoint" example="http://localhost:11434" />
                    <EnvVar name="LLM_TEMPERATURE" desc="Sampling temperature" example="0.7" />
                </div>
            </Section>

            <Section icon={Cpu} title={`Available Models (${models.length})`}>
                {models.length === 0 ? (
                    <p className="text-xs py-6 text-center" style={{ color: 'var(--color-fg-muted)' }}>
                        No models detected. Ensure Ollama is running or an API key is configured.
                    </p>
                ) : (
                    <div className="grid grid-cols-1 gap-2">
                        {models.map((m) => (
                            <div
                                key={m.name}
                                className="flex items-center gap-3 p-3 rounded-lg border transition-colors"
                                style={{
                                    background: m.name === activeModel ? 'var(--color-primary-soft)' : 'var(--color-bg)',
                                    borderColor: m.name === activeModel ? 'var(--color-primary)' : 'var(--color-border)',
                                }}
                            >
                                <div
                                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                                    style={{ background: m.name === activeModel ? 'var(--color-primary)' : 'var(--color-bg-soft)' }}
                                >
                                    <Cpu size={14} style={{ color: m.name === activeModel ? 'white' : 'var(--color-fg-muted)' }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate" style={{ color: 'var(--color-fg)' }}>{m.name}</p>
                                    <p className="text-[11px]" style={{ color: 'var(--color-fg-muted)' }}>
                                        {m.parameterSize} · {m.family} · {m.sizeMB}MB
                                    </p>
                                </div>
                                {m.name === activeModel ? (
                                    <span className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-md font-medium"
                                        style={{ background: 'var(--color-primary)', color: 'white' }}
                                    >
                                        <CheckCircle size={11} /> Active
                                    </span>
                                ) : (
                                    <button
                                        onClick={() => onSwitch(m.name)}
                                        disabled={switching !== null}
                                        className="text-[11px] px-2.5 py-1 rounded-md border cursor-pointer transition-colors"
                                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-fg-muted)' }}
                                    >
                                        {switching === m.name ? <Loader2 size={11} className="animate-spin" /> : 'Activate'}
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </Section>
        </div>
    );
}

/* ─── Language Tab ─────────────────────────────────────── */
function LanguageTab() {
    const { aiLanguage, aiLanguageCustom, setAiLanguage, setAiLanguageCustom, applyFromAPI, loaded: settingsLoaded } = useSettingsStore();
    const [loading, setLoading] = useState(!settingsLoaded);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [languages, setLanguages] = useState<Array<{ code: string; name: string }>>([]);

    useEffect(() => {
        if (settingsLoaded) { setLoading(false); return; }
        getAISettings()
            .then((data) => {
                applyFromAPI(data as Record<string, unknown>);
                if (data.languages) setLanguages(data.languages);
            })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [settingsLoaded]);

    const handleSave = async () => {
        setSaving(true);
        setSaved(false);
        try {
            await updateAISettings({ aiLanguage, aiLanguageCustom });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch { /* ignore */ }
        setSaving(false);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 size={20} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <Section icon={Languages} title="AI Response Language">
                <p className="text-xs mb-4" style={{ color: 'var(--color-fg-muted)' }}>
                    Configure the language the AI uses to respond. When set to "Auto", the AI will try to respond in the same language as your message.
                </p>

                {/* Language Grid */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                    <button
                        onClick={() => setAiLanguage('auto')}
                        className="flex items-center gap-2 p-3 rounded-lg border text-left cursor-pointer transition-all"
                        style={{
                            background: aiLanguage === 'auto' ? 'var(--color-primary-soft)' : 'var(--color-bg)',
                            borderColor: aiLanguage === 'auto' ? 'var(--color-primary)' : 'var(--color-border)',
                        }}
                    >
                        <span className="text-lg">🌐</span>
                        <div>
                            <p className="text-xs font-medium" style={{ color: aiLanguage === 'auto' ? 'var(--color-primary-light)' : 'var(--color-fg)' }}>Auto Detect</p>
                            <p className="text-[10px]" style={{ color: 'var(--color-fg-muted)' }}>Match input language</p>
                        </div>
                        {aiLanguage === 'auto' && <CheckCircle size={14} className="ml-auto" style={{ color: 'var(--color-primary)' }} />}
                    </button>
                    {languages.map((lang) => {
                        const flags: Record<string, string> = { vi: '🇻🇳', en: '🇺🇸', ja: '🇯🇵', ko: '🇰🇷', zh: '🇨🇳', 'zh-tw': '🇹🇼', fr: '🇫🇷', de: '🇩🇪', es: '🇪🇸', pt: '🇧🇷', it: '🇮🇹', ru: '🇷🇺', th: '🇹🇭', id: '🇮🇩', ms: '🇲🇾', ar: '🇸🇦', hi: '🇮🇳' };
                        return (
                            <button
                                key={lang.code}
                                onClick={() => setAiLanguage(lang.code)}
                                className="flex items-center gap-2 p-3 rounded-lg border text-left cursor-pointer transition-all"
                                style={{
                                    background: aiLanguage === lang.code ? 'var(--color-primary-soft)' : 'var(--color-bg)',
                                    borderColor: aiLanguage === lang.code ? 'var(--color-primary)' : 'var(--color-border)',
                                }}
                            >
                                <span className="text-lg">{flags[lang.code] || '🏳️'}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium truncate" style={{ color: aiLanguage === lang.code ? 'var(--color-primary-light)' : 'var(--color-fg)' }}>{lang.name.split(' (')[0]}</p>
                                    <p className="text-[10px] truncate" style={{ color: 'var(--color-fg-muted)' }}>{lang.name.includes('(') ? lang.name.split('(')[1]?.replace(')', '') : lang.code}</p>
                                </div>
                                {aiLanguage === lang.code && <CheckCircle size={14} className="shrink-0" style={{ color: 'var(--color-primary)' }} />}
                            </button>
                        );
                    })}
                </div>
            </Section>

            <Section icon={Settings} title="Custom Language Instruction">
                <p className="text-xs mb-3" style={{ color: 'var(--color-fg-muted)' }}>
                    Override the default instruction with a custom prompt. Leave empty to use the preset above.
                </p>
                <textarea
                    value={aiLanguageCustom}
                    onChange={(e) => setAiLanguageCustom(e.target.value)}
                    placeholder="e.g., Always respond in Vietnamese. Use formal tone."
                    rows={3}
                    maxLength={500}
                    className="w-full px-3 py-2 rounded-lg border text-xs resize-none focus:outline-none"
                    style={{
                        background: 'var(--color-bg)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-fg)',
                    }}
                />
                <p className="text-[10px] mt-1 text-right" style={{ color: 'var(--color-fg-muted)' }}>
                    {aiLanguageCustom.length}/500
                </p>
            </Section>

            {/* Save Button */}
            <div className="flex items-center gap-3">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                    style={{ background: 'var(--color-primary)', color: 'white' }}
                >
                    {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                    Save Language Settings
                </button>
                {saved && (
                    <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-success)' }}>
                        <CheckCircle size={12} /> Saved!
                    </span>
                )}
            </div>
        </div>
    );
}

/* ─── RAG Tab ──────────────────────────────────────────── */
function RAGTab() {
    return (
        <div className="space-y-4">
            <Section icon={Database} title="RAG Engine Settings">
                <p className="text-xs mb-3" style={{ color: 'var(--color-fg-muted)' }}>
                    Retrieval-Augmented Generation configuration. Upload documents to the Knowledge Base for context-aware responses.
                </p>
                <div className="grid grid-cols-3 gap-2">
                    <ConfigCard label="Chunk Size" value="512" unit="chars" desc="Text chunk size for splitting" />
                    <ConfigCard label="Chunk Overlap" value="50" unit="chars" desc="Overlap between chunks" />
                    <ConfigCard label="Top-K Results" value="5" unit="docs" desc="Max context documents" />
                    <ConfigCard label="Score Threshold" value="0.1" unit="" desc="Minimum relevance score" />
                    <ConfigCard label="Embedding Model" value="Local" unit="" desc="Dev: local / Prod: OpenAI" />
                    <ConfigCard label="Vector Store" value="In-Memory" unit="" desc="Document vector storage" />
                </div>
            </Section>

            <Section icon={HardDrive} title="Supported File Types">
                <div className="flex flex-wrap gap-1.5">
                    {['PDF', 'DOC/DOCX', 'TXT', 'Markdown', 'CSV', 'JSON', 'HTML', 'XML'].map((t) => (
                        <span key={t} className="text-[11px] px-2.5 py-1 rounded-md border font-medium"
                            style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg-muted)' }}
                        >
                            {t}
                        </span>
                    ))}
                </div>
            </Section>

            <Section icon={Zap} title="Processing Pipeline">
                <div className="flex items-center gap-2">
                    {['Upload', 'Parse', 'Chunk', 'Embed', 'Store', 'Index'].map((step, i) => (
                        <div key={step} className="flex items-center gap-2">
                            <div className="text-[11px] px-2.5 py-1.5 rounded-lg font-medium"
                                style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary-light)' }}
                            >
                                {step}
                            </div>
                            {i < 5 && <ChevronRight size={12} style={{ color: 'var(--color-fg-muted)' }} />}
                        </div>
                    ))}
                </div>
            </Section>
        </div>
    );
}

/* ─── Domains Tab ──────────────────────────────────────── */
function DomainsTab({ domains }: { domains: any[] }) {
    const [expanded, setExpanded] = useState<string | null>(null);

    return (
        <div className="space-y-4">
            <Section icon={Globe} title={`Domain Packs (${domains.length})`}>
                <p className="text-xs mb-3" style={{ color: 'var(--color-fg-muted)' }}>
                    Multi-industry domain packs provide specialized personas, skills, and tools for different fields.
                </p>
                {domains.length === 0 ? (
                    <p className="text-xs py-6 text-center" style={{ color: 'var(--color-fg-muted)' }}>No domain packs loaded.</p>
                ) : (
                    <div className="space-y-2">
                        {domains.map((d) => (
                            <div key={d.id} className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                                <button
                                    onClick={() => setExpanded(expanded === d.id ? null : d.id)}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left cursor-pointer transition-colors"
                                    style={{ background: expanded === d.id ? 'var(--color-bg-soft)' : 'var(--color-bg)' }}
                                >
                                    <span className="text-lg">{d.icon}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium" style={{ color: 'var(--color-fg)' }}>{d.name}</p>
                                        <p className="text-[11px] truncate" style={{ color: 'var(--color-fg-muted)' }}>{d.description}</p>
                                    </div>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                                        style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary-light)' }}
                                    >
                                        {d.skills?.length || 0} skills
                                    </span>
                                    {expanded === d.id ? <ChevronDown size={14} style={{ color: 'var(--color-fg-muted)' }} />
                                        : <ChevronRight size={14} style={{ color: 'var(--color-fg-muted)' }} />}
                                </button>
                                {expanded === d.id && (
                                    <div className="px-3 py-2 border-t" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                                        {d.skills && d.skills.length > 0 ? (
                                            <div className="grid grid-cols-2 gap-1.5">
                                                {d.skills.map((sk: any) => (
                                                    <div key={sk.id || sk.name} className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs"
                                                        style={{ background: 'var(--color-bg)' }}
                                                    >
                                                        <Plug size={10} style={{ color: 'var(--color-primary)' }} />
                                                        <span style={{ color: 'var(--color-fg)' }}>{sk.name || sk.id}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-[11px] py-1" style={{ color: 'var(--color-fg-muted)' }}>No skills registered</p>
                                        )}
                                        {d.integrations && d.integrations.length > 0 && (
                                            <div className="mt-2 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
                                                <p className="text-[10px] font-semibold mb-1" style={{ color: 'var(--color-fg-muted)' }}>INTEGRATIONS</p>
                                                <div className="flex flex-wrap gap-1">
                                                    {d.integrations.map((int: string) => (
                                                        <span key={int} className="text-[10px] px-1.5 py-0.5 rounded"
                                                            style={{ background: 'var(--color-bg)', color: 'var(--color-fg-muted)' }}
                                                        >{int}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </Section>
        </div>
    );
}

/* ─── Security Tab ─────────────────────────────────────── */
function SecurityTab() {
    return (
        <div className="space-y-4">
            <Section icon={Shield} title="Authentication">
                <div className="grid grid-cols-2 gap-2">
                    <ConfigCard label="Method" value="JWT" unit="" desc="JSON Web Token HS256" />
                    <ConfigCard label="Token Expiry" value="24h" unit="" desc="Access token lifetime" />
                    <ConfigCard label="Issuer" value="HiTechClaw" unit="" desc="Token issuer claim" />
                    <ConfigCard label="Algorithm" value="HS256" unit="" desc="HMAC SHA-256 signing" />
                </div>
            </Section>

            <Section icon={Shield} title="Network & CORS">
                <div className="grid grid-cols-2 gap-2">
                    <ConfigCard label="CORS Origin" value="localhost:5173" unit="" desc="Allowed web origin" />
                    <ConfigCard label="API Port" value="3000" unit="" desc="Server listen port" />
                    <ConfigCard label="HTTPS" value="Optional" unit="" desc="TLS in production" />
                    <ConfigCard label="Rate Limiting" value="None" unit="" desc="No rate limit (dev)" />
                </div>
            </Section>

            <Section icon={Settings} title="Environment Variables">
                <div className="grid grid-cols-2 gap-2">
                    <EnvVar name="JWT_SECRET" desc="Token signing secret" example="(auto-generated)" />
                    <EnvVar name="PORT" desc="Server port" example="3000" />
                    <EnvVar name="NODE_ENV" desc="Environment mode" example="development | production" />
                    <EnvVar name="CORS_ORIGIN" desc="Allowed origin" example="http://localhost:5173" />
                </div>
            </Section>
        </div>
    );
}

/* ─── Shared Components ───────────────────────────────── */
function Section({ icon: Icon, title, children }: { icon: typeof Settings; title: string; children: React.ReactNode }) {
    return (
        <div className="p-4 rounded-xl border" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
            <div className="flex items-center gap-2 mb-3">
                <Icon size={15} style={{ color: 'var(--color-primary)' }} />
                <h3 className="text-xs font-semibold" style={{ color: 'var(--color-fg)' }}>{title}</h3>
            </div>
            {children}
        </div>
    );
}

function StatusCard({ icon: Icon, label, value, status, detail }: {
    icon: typeof Settings; label: string; value: string; status: 'success' | 'error' | 'warning' | 'neutral'; detail: string;
}) {
    const colors = { success: 'var(--color-success)', error: 'var(--color-destructive)', warning: '#f59e0b', neutral: 'var(--color-fg-muted)' };
    return (
        <div className="p-3.5 rounded-xl border" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
            <div className="flex items-center justify-between mb-2">
                <Icon size={14} style={{ color: colors[status] }} />
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: colors[status] }} />
            </div>
            <p className="text-sm font-bold truncate" style={{ color: 'var(--color-fg)' }}>{value}</p>
            <p className="text-[10px]" style={{ color: 'var(--color-fg-muted)' }}>{label}</p>
            {detail && <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-fg-muted)', opacity: 0.7 }}>{detail}</p>}
        </div>
    );
}

function InfoCell({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between py-1 text-xs">
            <span style={{ color: 'var(--color-fg-muted)' }}>{label}</span>
            <span className="font-medium" style={{ color: 'var(--color-fg)' }}>{value}</span>
        </div>
    );
}

function EnvVar({ name, desc, example }: { name: string; desc: string; example: string }) {
    return (
        <div className="p-2.5 rounded-lg" style={{ background: 'var(--color-bg)' }}>
            <code className="text-[11px] font-mono font-semibold" style={{ color: 'var(--color-primary-light)' }}>{name}</code>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-fg-muted)' }}>{desc}</p>
            <p className="text-[10px] mt-0.5 font-mono" style={{ color: 'var(--color-fg-muted)', opacity: 0.6 }}>{example}</p>
        </div>
    );
}

function ConfigCard({ label, value, unit, desc }: { label: string; value: string; unit: string; desc: string }) {
    return (
        <div className="p-2.5 rounded-lg" style={{ background: 'var(--color-bg)' }}>
            <p className="text-[10px]" style={{ color: 'var(--color-fg-muted)' }}>{label}</p>
            <p className="text-sm font-bold" style={{ color: 'var(--color-fg)' }}>
                {value} {unit && <span className="text-[10px] font-normal" style={{ color: 'var(--color-fg-muted)' }}>{unit}</span>}
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-fg-muted)', opacity: 0.6 }}>{desc}</p>
        </div>
    );
}

function formatUptime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}
