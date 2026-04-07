import { useState, useEffect, type FormEvent } from 'react';
import { Loader2, Sparkles, Zap, Shield, Globe, Building2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useI18n } from '../i18n';
import { getTenantList, register as registerUser } from '../lib/api';

type AuthMode = 'login' | 'register';

const FEATURES = [
    { icon: Sparkles, label: 'Multi-LLM AI Engine', desc: 'OpenAI, Anthropic, Ollama & more' },
    { icon: Zap, label: 'RAG-Powered Search', desc: 'Semantic knowledge retrieval' },
    { icon: Shield, label: 'Enterprise Security', desc: 'RBAC with 60+ permissions' },
    { icon: Globe, label: '13 Domain Packs', desc: 'Industry-specialized solutions' },
];

export function LoginPage() {
    const { login } = useAuth();
    const { t } = useI18n();
    const [mode, setMode] = useState<AuthMode>('login');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [registerRole, setRegisterRole] = useState<'member' | 'owner'>('member');
    const [tenantName, setTenantName] = useState('');
    const [tenantSlug, setTenantSlug] = useState('');
    const [tenants, setTenants] = useState<Array<{ slug: string; name: string }>>([]);
    const [isSuperAdmin, setIsSuperAdmin] = useState(true);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        getTenantList().then(setTenants).catch(() => { });
    }, []);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');

        if (mode === 'login') {
            if (!isSuperAdmin && !tenantSlug) {
                setError(t('auth.selectTenant'));
                return;
            }

            setLoading(true);
            try {
                await login(email.trim(), password, isSuperAdmin ? undefined : tenantSlug);
            } catch {
                setError(t('auth.invalidCredentials'));
            } finally {
                setLoading(false);
            }
            return;
        }

        const normalizedTenantSlug = tenantSlug.trim().toLowerCase();
        if (!name.trim()) {
            setError('Name is required');
            return;
        }
        if (!normalizedTenantSlug) {
            setError('Tenant slug is required');
            return;
        }
        if (registerRole === 'owner' && !tenantName.trim()) {
            setError('Tenant name is required for owner registration');
            return;
        }
        if (password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);
        try {
            await registerUser({
                name: name.trim(),
                email: email.trim(),
                password,
                tenantSlug: normalizedTenantSlug,
                roleName: registerRole,
                tenantName: registerRole === 'owner' ? tenantName.trim() : undefined,
            });

            await login(
                email.trim(),
                password,
                registerRole === 'member' ? normalizedTenantSlug : undefined,
            );
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-bg flex items-center justify-center">
            {/* Animated gradient blobs */}
            <div className="login-blob login-blob-1" />
            <div className="login-blob login-blob-2" />
            <div className="login-blob login-blob-3" />
            <div className="login-blob login-blob-4" />

            {/* Floating orbs */}
            <div className="login-orb login-orb-1" />
            <div className="login-orb login-orb-2" />
            <div className="login-orb login-orb-3" />
            <div className="login-orb login-orb-4" />
            <div className="login-orb login-orb-5" />

            {/* Main content */}
            <div className="relative z-10 w-full max-w-[920px] mx-4 grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-0">

                {/* Left — Branding panel */}
                <div
                    className="hidden md:flex flex-col justify-center p-10"
                    style={{ animation: 'hero-text-appear 0.6s ease-out' }}
                >
                    {/* Logo */}
                    <div className="flex items-center gap-3 mb-8">
                        <img
                            src="/logo.png"
                            alt="HiTechClaw Logo"
                            className="w-12 h-12 rounded-2xl"
                            style={{ boxShadow: '0 4px 20px rgba(99, 102, 241, 0.3)' }}
                        />
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#f4f4f5' }}>
                                HiTechClaw
                            </h1>
                            <span
                                className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                                style={{
                                    background: 'rgba(99, 102, 241, 0.15)',
                                    color: '#818cf8',
                                }}
                            >
                                v2.0
                            </span>
                        </div>
                    </div>

                    <h2
                        className="text-lg font-semibold mb-2"
                        style={{ color: '#f4f4f5' }}
                    >
                        AI Agent Platform
                    </h2>
                    <p
                        className="text-sm leading-relaxed mb-8"
                        style={{ color: '#a1a1aa' }}
                    >
                        Open-source, multi-industry AI platform with RAG, workflow automation, and enterprise-grade security.
                    </p>

                    {/* Feature list */}
                    <div className="space-y-4">
                        {FEATURES.map((f, i) => (
                            <div
                                key={f.label}
                                className="flex items-center gap-3"
                                style={{
                                    animation: `hero-text-appear 0.5s ease-out ${0.2 + i * 0.1}s both`,
                                }}
                            >
                                <div
                                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                                    style={{ background: 'rgba(99, 102, 241, 0.1)' }}
                                >
                                    <f.icon size={16} style={{ color: '#818cf8' }} />
                                </div>
                                <div>
                                    <p className="text-[13px] font-medium" style={{ color: '#e4e4e7' }}>
                                        {f.label}
                                    </p>
                                    <p className="text-[11px]" style={{ color: '#71717a' }}>
                                        {f.desc}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right — Login card */}
                <div className="flex items-center justify-center p-4 md:p-6">
                    <div className="login-card w-full max-w-sm rounded-2xl p-8 transition-all duration-500">
                        {/* Mobile logo (hidden on md+) */}
                        <div className="flex flex-col items-center mb-8 md:hidden">
                            <img
                                src="/logo.png"
                                alt="HiTechClaw Logo"
                                className="w-14 h-14 rounded-2xl mb-3"
                                style={{ boxShadow: '0 4px 20px rgba(99, 102, 241, 0.3)' }}
                            />
                            <h1 className="text-xl font-bold" style={{ color: '#f4f4f5' }}>HiTechClaw</h1>
                        </div>

                        {/* Desktop card header */}
                        <div className="hidden md:block mb-8">
                            <h2 className="text-lg font-bold" style={{ color: '#f4f4f5' }}>
                                {t('auth.signIn')}
                            </h2>
                            <p className="text-[13px] mt-1" style={{ color: '#71717a' }}>
                                {t('auth.platform')}
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* Auth mode toggle */}
                            <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
                                <button
                                    type="button"
                                    onClick={() => { setMode('login'); setError(''); }}
                                    className="flex-1 px-3 py-2 rounded-md text-[12px] font-medium transition-all"
                                    style={{
                                        background: mode === 'login' ? 'rgba(99,102,241,0.15)' : 'transparent',
                                        color: mode === 'login' ? '#818cf8' : '#71717a',
                                    }}
                                >
                                    {t('auth.signIn')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setMode('register'); setError(''); setIsSuperAdmin(false); }}
                                    className="flex-1 px-3 py-2 rounded-md text-[12px] font-medium transition-all"
                                    style={{
                                        background: mode === 'register' ? 'rgba(99,102,241,0.15)' : 'transparent',
                                        color: mode === 'register' ? '#818cf8' : '#71717a',
                                    }}
                                >
                                    Register
                                </button>
                            </div>

                            {/* Login type toggle */}
                            {mode === 'login' && (
                                <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
                                    <button
                                        type="button"
                                        onClick={() => { setIsSuperAdmin(true); }}
                                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-[12px] font-medium transition-all"
                                        style={{
                                            background: isSuperAdmin ? 'rgba(99,102,241,0.15)' : 'transparent',
                                            color: isSuperAdmin ? '#818cf8' : '#71717a',
                                        }}
                                    >
                                        <Shield size={13} />
                                        Super Admin
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setIsSuperAdmin(false); }}
                                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-[12px] font-medium transition-all"
                                        style={{
                                            background: !isSuperAdmin ? 'rgba(99,102,241,0.15)' : 'transparent',
                                            color: !isSuperAdmin ? '#818cf8' : '#71717a',
                                        }}
                                    >
                                        <Building2 size={13} />
                                        Tenant
                                    </button>
                                </div>
                            )}

                            {/* Register role toggle */}
                            {mode === 'register' && (
                                <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
                                    <button
                                        type="button"
                                        onClick={() => setRegisterRole('member')}
                                        className="flex-1 px-3 py-2 rounded-md text-[12px] font-medium transition-all"
                                        style={{
                                            background: registerRole === 'member' ? 'rgba(99,102,241,0.15)' : 'transparent',
                                            color: registerRole === 'member' ? '#818cf8' : '#71717a',
                                        }}
                                    >
                                        Member
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setRegisterRole('owner')}
                                        className="flex-1 px-3 py-2 rounded-md text-[12px] font-medium transition-all"
                                        style={{
                                            background: registerRole === 'owner' ? 'rgba(99,102,241,0.15)' : 'transparent',
                                            color: registerRole === 'owner' ? '#818cf8' : '#71717a',
                                        }}
                                    >
                                        Owner
                                    </button>
                                </div>
                            )}

                            {/* Tenant selector (shown only for tenant login) */}
                            {mode === 'login' && !isSuperAdmin && (
                                <div>
                                    <label
                                        className="block text-[11px] font-semibold tracking-wider mb-2"
                                        style={{ color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                                    >
                                        {t('auth.tenant')}
                                    </label>
                                    <select
                                        value={tenantSlug}
                                        onChange={(e) => setTenantSlug(e.target.value)}
                                        className="login-input w-full px-4 py-3 rounded-xl text-sm outline-none"
                                        style={{ appearance: 'none' }}
                                    >
                                        <option value="">{t('auth.selectTenant')}</option>
                                        {tenants.map((t) => (
                                            <option key={t.slug} value={t.slug}>{t.name} ({t.slug})</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Registration fields */}
                            {mode === 'register' && (
                                <>
                                    <div>
                                        <label
                                            className="block text-[11px] font-semibold tracking-wider mb-2"
                                            style={{ color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                                        >
                                            Name
                                        </label>
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className="login-input w-full px-4 py-3 rounded-xl text-sm outline-none"
                                            placeholder="Your full name"
                                            required
                                        />
                                    </div>

                                    {registerRole === 'owner' && (
                                        <div>
                                            <label
                                                className="block text-[11px] font-semibold tracking-wider mb-2"
                                                style={{ color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                                            >
                                                Tenant Name
                                            </label>
                                            <input
                                                type="text"
                                                value={tenantName}
                                                onChange={(e) => setTenantName(e.target.value)}
                                                className="login-input w-full px-4 py-3 rounded-xl text-sm outline-none"
                                                placeholder="Acme Corp"
                                                required
                                            />
                                        </div>
                                    )}

                                    <div>
                                        <label
                                            className="block text-[11px] font-semibold tracking-wider mb-2"
                                            style={{ color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                                        >
                                            Tenant Slug
                                        </label>
                                        <input
                                            type="text"
                                            value={tenantSlug}
                                            onChange={(e) => setTenantSlug(e.target.value.toLowerCase())}
                                            className="login-input w-full px-4 py-3 rounded-xl text-sm outline-none"
                                            placeholder="your-tenant-slug"
                                            required
                                        />
                                    </div>
                                </>
                            )}

                            <div>
                                <label
                                    className="block text-[11px] font-semibold tracking-wider mb-2"
                                    style={{ color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                                >
                                    {t('auth.email')}
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="login-input w-full px-4 py-3 rounded-xl text-sm outline-none"
                                    placeholder="admin@hitechclaw.io"
                                    required
                                />
                            </div>

                            {mode === 'register' && (
                                <div>
                                    <label
                                        className="block text-[11px] font-semibold tracking-wider mb-2"
                                        style={{ color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                                    >
                                        Confirm Password
                                    </label>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="login-input w-full px-4 py-3 rounded-xl text-sm outline-none"
                                        placeholder="••••••••"
                                        required
                                    />
                                </div>
                            )}
                            <div>
                                <label
                                    className="block text-[11px] font-semibold tracking-wider mb-2"
                                    style={{ color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                                >
                                    {t('auth.password')}
                                </label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="login-input w-full px-4 py-3 rounded-xl text-sm outline-none"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>

                            {error && (
                                <div
                                    className="text-sm px-4 py-3 rounded-xl flex items-center gap-2"
                                    style={{
                                        background: 'rgba(239, 68, 68, 0.1)',
                                        color: '#f87171',
                                        border: '1px solid rgba(239, 68, 68, 0.15)',
                                    }}
                                >
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="login-btn w-full py-3 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <Loader2 size={18} className="animate-spin mx-auto" />
                                ) : (
                                    mode === 'login' ? t('auth.signIn') : 'Register'
                                )}
                            </button>
                        </form>

                        {/* Bottom decoration */}
                        <div className="mt-8 pt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                            <p className="text-[11px] text-center" style={{ color: '#52525b' }}>
                                Powered by HiTechClaw AI Platform • v2.0
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
