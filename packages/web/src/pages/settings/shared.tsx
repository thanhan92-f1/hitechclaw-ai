import type { ReactNode } from 'react';
import type { Settings } from 'lucide-react';

export function Section({ icon: Icon, title, children }: { icon: typeof Settings; title: string; children: ReactNode }) {
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

export function StatusCard({ icon: Icon, label, value, status, detail }: {
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

export function InfoCell({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between py-1 text-xs">
            <span style={{ color: 'var(--color-fg-muted)' }}>{label}</span>
            <span className="font-medium" style={{ color: 'var(--color-fg)' }}>{value}</span>
        </div>
    );
}

export function EnvVar({ name, desc, example }: { name: string; desc: string; example: string }) {
    return (
        <div className="p-2.5 rounded-lg" style={{ background: 'var(--color-bg)' }}>
            <code className="text-[11px] font-mono font-semibold" style={{ color: 'var(--color-primary-light)' }}>{name}</code>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-fg-muted)' }}>{desc}</p>
            <p className="text-[10px] mt-0.5 font-mono" style={{ color: 'var(--color-fg-muted)', opacity: 0.6 }}>{example}</p>
        </div>
    );
}

export function ConfigCard({ label, value, unit, desc }: { label: string; value: string; unit: string; desc: string }) {
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

export function formatUptime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}
