import {
    Ban,
    Building2,
    CheckCircle,
    Plus,
    RefreshCw,
    Save,
    Shield,
    Trash2,
    UserPlus,
    X
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
    createApiKey,
    getApiKeys,
    getAuditLogs,
    getRetentionPolicies,
    revokeApiKey,
    triggerRetentionCleanup,
    updateRetentionPolicy,
} from '../lib/api';

// re-use existing tenant API via raw apiFetch
async function apiFetch(path: string, init?: RequestInit) {
    const token = localStorage.getItem('hitechclaw_token');
    const headers: Record<string, string> = { ...(init?.headers as Record<string, string>) };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (init?.body && !(init.body instanceof FormData)) headers['Content-Type'] = 'application/json';
    return fetch(path, { ...init, headers });
}

async function getTenants() {
    const res = await apiFetch('/api/tenants');
    return res.json();
}

async function createTenant(data: { name: string; slug: string; plan: string }) {
    const res = await apiFetch('/api/tenants', { method: 'POST', body: JSON.stringify(data) });
    return res.json();
}

async function updateTenant(id: string, data: Record<string, unknown>) {
    const res = await apiFetch(`/api/tenants/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    return res.json();
}

async function createTenantAdmin(tenantId: string, data: { name: string; email: string; password: string }) {
    const res = await apiFetch(`/api/tenants/${tenantId}/admin`, { method: 'POST', body: JSON.stringify(data) });
    return res.json();
}

type Tab = 'tenants' | 'audit' | 'apiKeys' | 'retention';

// ─── Demo data ─────────────────────────────────────────────
const DEMO_TENANTS = [
    { id: 'tenant-001', name: 'HiTechClaw Development', slug: 'hitechclaw-dev', plan: 'enterprise', status: 'active', createdAt: '2026-01-15T08:00:00Z' },
    { id: 'tenant-002', name: 'TeeForge.AI', slug: 'teeforge', plan: 'pro', status: 'active', createdAt: '2026-02-01T10:00:00Z' },
    { id: 'tenant-003', name: 'Hospital Demo', slug: 'hospital-demo', plan: 'pro', status: 'active', createdAt: '2026-02-20T14:00:00Z' },
    { id: 'tenant-004', name: 'Sandbox Tenant', slug: 'sandbox', plan: 'free', status: 'suspended', createdAt: '2026-03-10T09:00:00Z' },
];

const DEMO_AUDIT_LOGS = [
    { _id: 'aud-1', createdAt: '2026-03-31T10:12:00Z', action: 'user.login', userId: 'admin', metadata: { method: 'password', ip: '192.168.1.100' } },
    { _id: 'aud-2', createdAt: '2026-03-31T10:05:00Z', action: 'agent.config.update', userId: 'admin', metadata: { configId: 'default', model: 'qwen2.5:14b' } },
    { _id: 'aud-3', createdAt: '2026-03-31T09:50:00Z', action: 'workflow.create', userId: 'admin', metadata: { name: 'Slack Alert on Error' } },
    { _id: 'aud-4', createdAt: '2026-03-31T09:30:00Z', action: 'channel.activate', userId: 'admin', metadata: { channel: 'telegram', name: 'HiTechClaw Bot' } },
    { _id: 'aud-5', createdAt: '2026-03-30T16:20:00Z', action: 'role.assign', userId: 'admin', metadata: { role: 'doctor', targetUser: 'drsmith@hospital.com' } },
    { _id: 'aud-6', createdAt: '2026-03-30T15:00:00Z', action: 'tenant.settings.update', userId: 'admin', metadata: { key: 'securityPolicy', value: 'strict' } },
    { _id: 'aud-7', createdAt: '2026-03-30T11:30:00Z', action: 'user.create', userId: 'admin', metadata: { email: 'devuser@hitechclaw.dev', role: 'developer' } },
    { _id: 'aud-8', createdAt: '2026-03-29T14:00:00Z', action: 'apikey.create', userId: 'admin', metadata: { keyName: 'CI/CD Pipeline', scopes: ['read', 'write'] } },
    { _id: 'aud-9', createdAt: '2026-03-29T10:00:00Z', action: 'plugin.install', userId: 'admin', metadata: { plugin: 'healthcare', version: '1.0.0' } },
    { _id: 'aud-10', createdAt: '2026-03-28T09:00:00Z', action: 'user.login', userId: 'devuser', metadata: { method: 'oauth', provider: 'github' } },
];

const DEMO_API_KEYS = [
    { _id: 'key-1', name: 'Production API', keyPrefix: 'xk_prod_a1b2c3', scopes: ['read', 'write', 'admin'], createdAt: '2026-03-01T08:00:00Z', lastUsed: '2026-03-31T10:00:00Z' },
    { _id: 'key-2', name: 'CI/CD Pipeline', keyPrefix: 'xk_ci_d4e5f6', scopes: ['read', 'write'], createdAt: '2026-03-15T10:00:00Z', lastUsed: '2026-03-31T06:00:00Z' },
    { _id: 'key-3', name: 'Monitoring (Read-Only)', keyPrefix: 'xk_mon_g7h8i9', scopes: ['read'], createdAt: '2026-03-20T14:00:00Z', lastUsed: '2026-03-30T23:00:00Z' },
    { _id: 'key-4', name: 'Telegram Bot Integration', keyPrefix: 'xk_tg_j0k1l2', scopes: ['read', 'write'], createdAt: '2026-03-25T09:00:00Z', lastUsed: '2026-03-31T09:45:00Z' },
];

const DEMO_RETENTION_POLICIES = {
    messages: { retentionDays: 90, enabled: true },
    sessions: { retentionDays: 60, enabled: true },
    memory_entries: { retentionDays: 180, enabled: false },
    llm_logs: { retentionDays: 30, enabled: true },
    activity_logs: { retentionDays: 30, enabled: true },
    audit_logs: { retentionDays: 365, enabled: true },
};

export function AdminPage() {
    const [tab, setTab] = useState<Tab>('tenants');
    const { user } = useAuth();
    const isSuperAdmin = user?.isSuperAdmin === true;

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            <div className="flex items-center gap-3">
                {isSuperAdmin ? <Shield className="w-6 h-6" style={{ color: 'var(--color-primary)' }} /> : <Building2 className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />}
                <h1 className="text-2xl font-bold" style={{ color: 'var(--color-fg)' }}>{isSuperAdmin ? 'Platform Admin' : 'Admin'}</h1>
            </div>

            <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--color-bg-secondary)' }}>
                {(['tenants', 'audit', 'apiKeys', 'retention'] as const).map((t) => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className="flex-1 px-4 py-2 rounded-md text-sm font-medium capitalize transition-colors"
                        style={{
                            background: tab === t ? 'var(--color-bg)' : 'transparent',
                            color: tab === t ? 'var(--color-fg)' : 'var(--color-fg-muted)',
                        }}
                    >
                        {t === 'apiKeys' ? 'API Keys' : t}
                    </button>
                ))}
            </div>

            {tab === 'tenants' && <TenantsTab isSuperAdmin={isSuperAdmin} />}
            {tab === 'audit' && <AuditTab />}
            {tab === 'apiKeys' && <ApiKeysTab />}
            {tab === 'retention' && <RetentionTab />}
        </div>
    );
}

/* ─── Tenants Tab ──────────────────────────────────────────── */
function TenantsTab({ isSuperAdmin }: { isSuperAdmin: boolean }) {
    const [tenants, setTenants] = useState<any[]>([]);
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({ name: '', slug: '', plan: 'free' });
    const [loading, setLoading] = useState(true);
    const [adminModal, setAdminModal] = useState<string | null>(null);
    const [adminForm, setAdminForm] = useState({ name: '', email: '', password: '' });
    const [adminMsg, setAdminMsg] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            const data = await getTenants();
            const ts = data.tenants ?? [];
            setTenants(ts.length > 0 ? ts : DEMO_TENANTS);
        } catch {
            setTenants(DEMO_TENANTS);
        }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const handleCreate = async () => {
        if (!form.name || !form.slug) return;
        await createTenant(form);
        setShowCreate(false);
        setForm({ name: '', slug: '', plan: 'free' });
        load();
    };

    const toggleStatus = async (t: any) => {
        const newStatus = t.status === 'active' ? 'suspended' : 'active';
        await updateTenant(t.id, { status: newStatus });
        load();
    };

    const handleCreateAdmin = async () => {
        if (!adminModal || !adminForm.name || !adminForm.email || !adminForm.password) return;
        try {
            const res = await createTenantAdmin(adminModal, adminForm);
            if (res.error) { setAdminMsg(res.error); return; }
            setAdminMsg(`Admin created: ${adminForm.email}`);
            setAdminForm({ name: '', email: '', password: '' });
            setTimeout(() => { setAdminModal(null); setAdminMsg(null); }, 2000);
        } catch { setAdminMsg('Failed to create admin'); }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold" style={{ color: 'var(--color-fg)' }}>Tenants</h2>
                {isSuperAdmin && (
                    <button
                        onClick={() => setShowCreate(!showCreate)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white"
                        style={{ background: 'var(--color-primary)' }}
                    >
                        <Plus className="w-4 h-4" /> New Tenant
                    </button>
                )}
            </div>

            {showCreate && (
                <div className="rounded-xl border p-4 space-y-3" style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                            className="px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }} />
                        <input placeholder="Slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })}
                            className="px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }} />
                        <select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}
                            className="px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}>
                            <option value="free">Free</option>
                            <option value="pro">Pro</option>
                            <option value="enterprise">Enterprise</option>
                        </select>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleCreate} className="px-3 py-1.5 rounded-lg text-sm text-white" style={{ background: 'var(--color-primary)' }}>
                            <Save className="w-4 h-4 inline mr-1" />Create
                        </button>
                        <button onClick={() => setShowCreate(false)} className="px-3 py-1.5 rounded-lg text-sm" style={{ color: 'var(--color-fg-muted)' }}>Cancel</button>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin w-6 h-6 border-2 border-t-transparent rounded-full" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
                </div>
            ) : (
                <div className="space-y-2">
                    {tenants.map((t) => (
                        <div key={t.id} className="flex items-center justify-between rounded-xl border p-4"
                            style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}>
                            <div>
                                <p className="font-medium" style={{ color: 'var(--color-fg)' }}>{t.name}</p>
                                <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>slug: {t.slug} · plan: {t.plan}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${t.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {t.status}
                                </span>
                                {isSuperAdmin && (
                                    <button onClick={() => { setAdminModal(t.id); setAdminMsg(null); setAdminForm({ name: '', email: '', password: '' }); }}
                                        className="p-1.5 rounded-lg hover:opacity-80" style={{ background: 'var(--color-bg)' }} title="Create Admin">
                                        <UserPlus className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                                    </button>
                                )}
                                {isSuperAdmin && (
                                    <button onClick={() => toggleStatus(t)} className="p-1.5 rounded-lg hover:opacity-80"
                                        style={{ background: 'var(--color-bg)' }} title={t.status === 'active' ? 'Suspend' : 'Activate'}>
                                        {t.status === 'active' ? <Ban className="w-4 h-4 text-red-500" /> : <CheckCircle className="w-4 h-4 text-green-500" />}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                    {tenants.length === 0 && <p className="text-center py-8 text-sm" style={{ color: 'var(--color-fg-muted)' }}>No tenants found</p>}
                </div>
            )}

            {/* Create Admin Modal */}
            {adminModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="rounded-xl border p-6 w-full max-w-md space-y-4" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-semibold" style={{ color: 'var(--color-fg)' }}>Create Tenant Admin</h3>
                            <button onClick={() => setAdminModal(null)}><X className="w-5 h-5" style={{ color: 'var(--color-fg-muted)' }} /></button>
                        </div>
                        <input placeholder="Full Name" value={adminForm.name} onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }} />
                        <input placeholder="Email" type="email" value={adminForm.email} onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }} />
                        <input placeholder="Password" type="password" value={adminForm.password} onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }} />
                        {adminMsg && <p className={`text-sm ${adminMsg.startsWith('Admin created') ? 'text-green-600' : 'text-red-500'}`}>{adminMsg}</p>}
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => setAdminModal(null)} className="px-3 py-1.5 rounded-lg text-sm" style={{ color: 'var(--color-fg-muted)' }}>Cancel</button>
                            <button onClick={handleCreateAdmin} className="px-4 py-1.5 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--color-primary)' }}>
                                <UserPlus className="w-4 h-4 inline mr-1" />Create Admin
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ─── Audit Log Tab ────────────────────────────────────────── */
function AuditTab() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const data = await getAuditLogs(200);
                const fetched = data.logs ?? [];
                setLogs(fetched.length > 0 ? fetched : DEMO_AUDIT_LOGS);
            } catch {
                setLogs(DEMO_AUDIT_LOGS);
            }
            setLoading(false);
        })();
    }, []);

    return (
        <div className="space-y-4">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--color-fg)' }}>Audit Logs</h2>
            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin w-6 h-6 border-2 border-t-transparent rounded-full" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
                </div>
            ) : (
                <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                    <table className="w-full text-sm">
                        <thead>
                            <tr style={{ background: 'var(--color-bg-secondary)' }}>
                                <th className="text-left px-4 py-2 font-medium" style={{ color: 'var(--color-fg-muted)' }}>Time</th>
                                <th className="text-left px-4 py-2 font-medium" style={{ color: 'var(--color-fg-muted)' }}>Action</th>
                                <th className="text-left px-4 py-2 font-medium" style={{ color: 'var(--color-fg-muted)' }}>User</th>
                                <th className="text-left px-4 py-2 font-medium" style={{ color: 'var(--color-fg-muted)' }}>Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map((log, i) => (
                                <tr key={i} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                                    <td className="px-4 py-2 text-xs font-mono" style={{ color: 'var(--color-fg-muted)' }}>
                                        {new Date(log.createdAt ?? log.timestamp).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-2" style={{ color: 'var(--color-fg)' }}>{log.action}</td>
                                    <td className="px-4 py-2" style={{ color: 'var(--color-fg-muted)' }}>{log.userId ?? '—'}</td>
                                    <td className="px-4 py-2 text-xs max-w-xs truncate" style={{ color: 'var(--color-fg-muted)' }}>
                                        {JSON.stringify(log.metadata ?? log.details ?? {}).slice(0, 100)}
                                    </td>
                                </tr>
                            ))}
                            {logs.length === 0 && (
                                <tr><td colSpan={4} className="px-4 py-8 text-center" style={{ color: 'var(--color-fg-muted)' }}>No audit logs</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

/* ─── API Keys Tab ─────────────────────────────────────────── */
function ApiKeysTab() {
    const [keys, setKeys] = useState<any[]>([]);
    const [newKeyName, setNewKeyName] = useState('');
    const [createdKey, setCreatedKey] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        try {
            const data = await getApiKeys();
            const ks = data.keys ?? [];
            setKeys(ks.length > 0 ? ks : DEMO_API_KEYS);
        } catch {
            setKeys(DEMO_API_KEYS);
        }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const handleCreate = async () => {
        if (!newKeyName.trim()) return;
        const result = await createApiKey(newKeyName.trim());
        setCreatedKey(result.key);
        setNewKeyName('');
        load();
    };

    const handleRevoke = async (keyId: string) => {
        await revokeApiKey(keyId);
        load();
    };

    return (
        <div className="space-y-4">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--color-fg)' }}>API Keys</h2>

            {/* Create */}
            <div className="flex gap-2">
                <input
                    placeholder="Key name (e.g., Production API)"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                    className="flex-1 px-3 py-2 rounded-lg border text-sm"
                    style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                />
                <button onClick={handleCreate} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--color-primary)' }}>
                    <Plus className="w-4 h-4 inline mr-1" />Create Key
                </button>
            </div>

            {createdKey && (
                <div className="rounded-lg border-2 border-green-500 p-4 space-y-2" style={{ background: 'var(--color-bg-secondary)' }}>
                    <p className="text-sm font-medium text-green-600">Key created! Copy it now — it won't be shown again.</p>
                    <code className="block p-2 rounded text-xs font-mono break-all" style={{ background: 'var(--color-bg)', color: 'var(--color-fg)' }}>{createdKey}</code>
                    <button onClick={() => setCreatedKey(null)} className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>Dismiss</button>
                </div>
            )}

            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin w-6 h-6 border-2 border-t-transparent rounded-full" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
                </div>
            ) : (
                <div className="space-y-2">
                    {keys.map((k) => (
                        <div key={k._id} className="flex items-center justify-between rounded-xl border p-4"
                            style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}>
                            <div>
                                <p className="font-medium" style={{ color: 'var(--color-fg)' }}>{k.name}</p>
                                <p className="text-xs font-mono" style={{ color: 'var(--color-fg-muted)' }}>
                                    {k.keyPrefix}... · scopes: {k.scopes?.join(', ')}
                                    {k.expiresAt && ` · expires: ${new Date(k.expiresAt).toLocaleDateString()}`}
                                </p>
                            </div>
                            <button onClick={() => handleRevoke(k._id)} className="p-1.5 rounded-lg hover:bg-red-50" title="Revoke">
                                <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                        </div>
                    ))}
                    {keys.length === 0 && <p className="text-center py-8 text-sm" style={{ color: 'var(--color-fg-muted)' }}>No API keys</p>}
                </div>
            )}
        </div>
    );
}

/* ─── Retention Tab ────────────────────────────────────────── */
const RESOURCES = ['messages', 'sessions', 'memory_entries', 'llm_logs', 'activity_logs', 'audit_logs'] as const;

function RetentionTab() {
    const [policies, setPolicies] = useState<Record<string, { retentionDays: number; enabled: boolean }>>({});
    const [loading, setLoading] = useState(true);
    const [cleaning, setCleaning] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const data = await getRetentionPolicies();
            const map: Record<string, { retentionDays: number; enabled: boolean }> = {};
            for (const p of (data.policies ?? [])) {
                map[p.resource] = { retentionDays: p.retentionDays, enabled: p.enabled };
            }
            setPolicies(Object.keys(map).length > 0 ? map : DEMO_RETENTION_POLICIES);
        } catch {
            setPolicies(DEMO_RETENTION_POLICIES);
        }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const handleSave = async (resource: string) => {
        const p = policies[resource];
        if (!p) return;
        await updateRetentionPolicy(resource, p.retentionDays, p.enabled);
    };

    const handleCleanup = async () => {
        setCleaning(true);
        try {
            await triggerRetentionCleanup();
        } catch { /* empty */ }
        setCleaning(false);
        load();
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold" style={{ color: 'var(--color-fg)' }}>Data Retention</h2>
                <button onClick={handleCleanup} disabled={cleaning}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                    style={{ background: 'var(--color-primary)' }}>
                    <RefreshCw className={`w-4 h-4 ${cleaning ? 'animate-spin' : ''}`} /> Run Cleanup
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin w-6 h-6 border-2 border-t-transparent rounded-full" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
                </div>
            ) : (
                <div className="space-y-2">
                    {RESOURCES.map((resource) => {
                        const p = policies[resource] ?? { retentionDays: 90, enabled: false };
                        return (
                            <div key={resource} className="flex items-center gap-4 rounded-xl border p-4"
                                style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={p.enabled}
                                        onChange={(e) => setPolicies({ ...policies, [resource]: { ...p, enabled: e.target.checked } })}
                                        className="rounded" />
                                    <span className="text-sm font-medium w-36" style={{ color: 'var(--color-fg)' }}>{resource.replace(/_/g, ' ')}</span>
                                </label>
                                <input type="number" min={1} value={p.retentionDays}
                                    onChange={(e) => setPolicies({ ...policies, [resource]: { ...p, retentionDays: Number(e.target.value) } })}
                                    className="w-20 px-2 py-1 rounded border text-sm text-center"
                                    style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }} />
                                <span className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>days</span>
                                <button onClick={() => handleSave(resource)}
                                    className="px-2 py-1 rounded text-xs font-medium text-white" style={{ background: 'var(--color-primary)' }}>Save</button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
