import { useState, useEffect } from 'react';
import {
    Users, UserPlus, ShieldCheck, Mail, Ban, CheckSquare, X, Loader2, ChevronDown, ChevronRight,
} from 'lucide-react';
import { useI18n } from '../../i18n';
import { Section } from './shared';
import {
    getRBACUsers, getRBACRoles, getRBACPermissions,
    inviteUser, updateUserStatus, createRole, deleteRole,
} from '../../lib/api';

export function SettingsUsersPage() {
    const { t } = useI18n();
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
                    <Users size={12} /> {t('settings.users.teamMembers')} ({usersData.length})
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
                    <ShieldCheck size={12} /> {t('settings.users.roles')} ({rolesData.length})
                </button>
            </div>

            {activeSubTab === 'users' && (
                <>
                    <div className="flex justify-end">
                        <button
                            onClick={() => setShowInvite(!showInvite)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                            style={{ background: 'var(--color-primary)', color: 'white' }}
                        >
                            <UserPlus size={12} /> {t('settings.users.inviteUser')}
                        </button>
                    </div>

                    {showInvite && (
                        <Section icon={UserPlus} title={t('settings.users.inviteNew')}>
                            <div className="grid grid-cols-3 gap-3 mb-3">
                                <div>
                                    <label className="block text-[10px] font-medium mb-1" style={{ color: 'var(--color-fg-muted)' }}>{t('settings.users.emailRequired')}</label>
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
                                    <label className="block text-[10px] font-medium mb-1" style={{ color: 'var(--color-fg-muted)' }}>{t('settings.users.fullName')}</label>
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
                                    <label className="block text-[10px] font-medium mb-1" style={{ color: 'var(--color-fg-muted)' }}>{t('settings.users.role')}</label>
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
                                    {t('settings.users.sendInvite')}
                                </button>
                                <button
                                    onClick={() => setShowInvite(false)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs cursor-pointer border"
                                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-fg-muted)' }}
                                >
                                    {t('common.cancel')}
                                </button>
                            </div>
                        </Section>
                    )}

                    <Section icon={Users} title={`${t('settings.users.teamMembers')} (${usersData.length})`}>
                        {usersData.length === 0 ? (
                            <p className="text-xs py-6 text-center" style={{ color: 'var(--color-fg-muted)' }}>{t('settings.users.noUsers')}</p>
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
                                            <p className="text-sm font-medium truncate" style={{ color: 'var(--color-fg)' }}>{u.name || u.email}</p>
                                            <p className="text-[11px] truncate" style={{ color: 'var(--color-fg-muted)' }}>{u.email}</p>
                                        </div>
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
                                        <span
                                            className="text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0"
                                            style={{
                                                background: u.status === 'active' ? '#22c55e18' : u.status === 'invited' ? '#f59e0b18' : '#ef444418',
                                                color: u.status === 'active' ? '#4ade80' : u.status === 'invited' ? '#fbbf24' : '#f87171',
                                            }}
                                        >
                                            {t(`common.${u.status}` as any)}
                                        </span>
                                        <div className="flex gap-1 shrink-0">
                                            {u.status === 'active' && (
                                                <button
                                                    onClick={() => handleStatusChange(u.id, 'suspended')}
                                                    title={t('settings.users.suspend')}
                                                    className="p-1.5 rounded-md cursor-pointer transition-colors hover:bg-red-500/10"
                                                    style={{ color: 'var(--color-fg-muted)' }}
                                                >
                                                    <Ban size={13} />
                                                </button>
                                            )}
                                            {u.status === 'suspended' && (
                                                <button
                                                    onClick={() => handleStatusChange(u.id, 'active')}
                                                    title={t('settings.users.reactivate')}
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
                    <div className="flex justify-end">
                        <button
                            onClick={() => setShowCreateRole(!showCreateRole)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                            style={{ background: 'var(--color-primary)', color: 'white' }}
                        >
                            <ShieldCheck size={12} /> {t('settings.users.createRole')}
                        </button>
                    </div>

                    {showCreateRole && (
                        <Section icon={ShieldCheck} title={t('settings.users.createRole')}>
                            <div className="grid grid-cols-2 gap-3 mb-3">
                                <div>
                                    <label className="block text-[10px] font-medium mb-1" style={{ color: 'var(--color-fg-muted)' }}>{t('settings.users.roleName')}</label>
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
                                    <label className="block text-[10px] font-medium mb-1" style={{ color: 'var(--color-fg-muted)' }}>{t('settings.users.roleDesc')}</label>
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
                            <p className="text-[10px] font-medium mb-2" style={{ color: 'var(--color-fg-muted)' }}>{t('settings.users.permissions')}</p>
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
                                    {t('settings.users.createRole')}
                                </button>
                                <button
                                    onClick={() => setShowCreateRole(false)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs cursor-pointer border"
                                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-fg-muted)' }}
                                >
                                    {t('common.cancel')}
                                </button>
                            </div>
                        </Section>
                    )}

                    <Section icon={ShieldCheck} title={`${t('settings.users.roles')} (${rolesData.length})`}>
                        {rolesData.length === 0 ? (
                            <p className="text-xs py-6 text-center" style={{ color: 'var(--color-fg-muted)' }}>{t('settings.users.noRoles')}</p>
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
    const { t } = useI18n();
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
                    <p className="text-[11px] truncate" style={{ color: 'var(--color-fg-muted)' }}>{role.description || t('settings.users.noDescription')}</p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                    style={{
                        background: isSystem ? 'var(--color-primary-soft)' : '#f59e0b18',
                        color: isSystem ? 'var(--color-primary-light)' : '#fbbf24',
                    }}
                >
                    {isSystem ? t('common.system') : t('common.custom')}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                    style={{ background: 'var(--color-bg-soft)', color: 'var(--color-fg-muted)' }}
                >
                    {role.permissionCount ?? role.permissions?.length ?? 0} {t('common.perms')}
                </span>
                {!isSystem && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(role.id); }}
                        className="p-1.5 rounded-md cursor-pointer transition-colors hover:bg-red-500/10"
                        style={{ color: 'var(--color-fg-muted)' }}
                        title={t('settings.users.deleteRole')}
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
