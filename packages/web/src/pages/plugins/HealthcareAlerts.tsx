import { useState } from 'react';
import { AlertTriangle, Loader2, ShieldAlert } from 'lucide-react';
import { healthcareCheckClinicalAlert } from '../../lib/api';

interface Alert {
    type: string;
    severity: string;
    message: string;
    recommendation?: string;
}

const SEV_COLORS: Record<string, { bg: string; fg: string }> = {
    critical: { bg: 'rgba(239,68,68,0.12)', fg: '#ef4444' },
    high: { bg: 'rgba(245,158,11,0.12)', fg: '#f59e0b' },
    moderate: { bg: 'rgba(59,130,246,0.12)', fg: '#3b82f6' },
    low: { bg: 'rgba(34,197,94,0.12)', fg: '#22c55e' },
};

export function HealthcareAlerts() {
    const [text, setText] = useState('');
    const [alerts, setAlerts] = useState<Alert[] | null>(null);
    const [loading, setLoading] = useState(false);

    const check = () => {
        if (!text.trim()) return;
        setLoading(true);
        healthcareCheckClinicalAlert(text.trim())
            .then(d => setAlerts(d.alerts || []))
            .catch(() => setAlerts([]))
            .finally(() => setLoading(false));
    };

    return (
        <div className="h-full overflow-y-auto">
            <div className="px-6 pt-5 pb-4 border-b" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                <div className="max-w-4xl mx-auto">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.12)' }}>
                            <ShieldAlert size={20} color="#ef4444" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold" style={{ color: 'var(--color-fg)' }}>Clinical Alerts</h1>
                            <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>Check clinical text for red flags and safety alerts</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-6 py-5 space-y-5">
                <div className="rounded-xl border p-5" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                    <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-fg)' }}>Clinical Text</h3>
                    <textarea
                        className="w-full h-32 px-3 py-2 rounded-lg border text-sm outline-none resize-none"
                        style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                        placeholder="Paste clinical notes, prescriptions, or patient history for red-flag analysis..."
                        value={text}
                        onChange={e => setText(e.target.value)}
                    />
                    <button onClick={check} disabled={!text.trim() || loading}
                        className="mt-3 px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-40 flex items-center gap-2"
                        style={{ background: '#ef4444', color: '#fff' }}>
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <><AlertTriangle size={14} /> Analyze for Red Flags</>}
                    </button>
                </div>

                {alerts !== null && (
                    <div className="rounded-xl border p-5" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-fg)' }}>
                            {alerts.length > 0 ? `${alerts.length} Alert(s) Detected` : 'No alerts detected'}
                        </h3>
                        {alerts.length === 0 && (
                            <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>No red flags found in the provided text.</p>
                        )}
                        <div className="space-y-3">
                            {alerts.map((a, i) => {
                                const sev = SEV_COLORS[a.severity] || SEV_COLORS.moderate;
                                return (
                                    <div key={i} className="rounded-lg border p-4" style={{ borderColor: 'var(--color-border)' }}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <AlertTriangle size={16} style={{ color: sev.fg }} />
                                            <span className="text-sm font-semibold" style={{ color: 'var(--color-fg)' }}>{a.type}</span>
                                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase"
                                                style={{ background: sev.bg, color: sev.fg }}>{a.severity}</span>
                                        </div>
                                        <p className="text-xs mb-1" style={{ color: 'var(--color-fg)' }}>{a.message}</p>
                                        {a.recommendation && (
                                            <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                                                <strong>Recommendation:</strong> {a.recommendation}
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
