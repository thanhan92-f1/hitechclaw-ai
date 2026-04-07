import { useState, useEffect } from 'react';
import { ClipboardList, Loader2, FileText } from 'lucide-react';
import { healthcareGetClinicalNotes } from '../../lib/api';

interface ClinicalNote {
    id: string;
    patientId: string;
    type: string;
    content: string;
    author: string;
    createdAt: string;
}

const TYPE_COLORS: Record<string, { bg: string; fg: string }> = {
    soap: { bg: 'rgba(59,130,246,0.12)', fg: '#3b82f6' },
    discharge: { bg: 'rgba(34,197,94,0.12)', fg: '#22c55e' },
    referral: { bg: 'rgba(168,85,247,0.12)', fg: '#a855f7' },
    progress: { bg: 'rgba(245,158,11,0.12)', fg: '#f59e0b' },
    prescription: { bg: 'rgba(239,68,68,0.12)', fg: '#ef4444' },
};

export function HealthcareClinicalNotes() {
    const [notes, setNotes] = useState<ClinicalNote[]>([]);
    const [loading, setLoading] = useState(true);
    const [typeFilter, setTypeFilter] = useState('');

    useEffect(() => {
        healthcareGetClinicalNotes()
            .then(d => setNotes(d.notes || []))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    const types = [...new Set(notes.map(n => n.type))];
    const filtered = typeFilter ? notes.filter(n => n.type === typeFilter) : notes;

    return (
        <div className="h-full overflow-y-auto">
            <div className="px-6 pt-5 pb-4 border-b" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                <div className="max-w-5xl mx-auto">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.12)' }}>
                            <ClipboardList size={20} color="#3b82f6" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold" style={{ color: 'var(--color-fg)' }}>Clinical Notes</h1>
                            <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>{notes.length} notes</p>
                        </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        <button onClick={() => setTypeFilter('')}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                            style={{
                                background: !typeFilter ? 'var(--color-primary-soft)' : 'var(--color-bg)',
                                color: !typeFilter ? 'var(--color-primary)' : 'var(--color-fg-muted)',
                                borderColor: !typeFilter ? 'var(--color-primary)' : 'var(--color-border)',
                            }}>All</button>
                        {types.map(t => (
                            <button key={t} onClick={() => setTypeFilter(t)}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium border capitalize transition-colors"
                                style={{
                                    background: typeFilter === t ? (TYPE_COLORS[t]?.bg || 'var(--color-primary-soft)') : 'var(--color-bg)',
                                    color: typeFilter === t ? (TYPE_COLORS[t]?.fg || 'var(--color-primary)') : 'var(--color-fg-muted)',
                                    borderColor: typeFilter === t ? (TYPE_COLORS[t]?.fg || 'var(--color-primary)') : 'var(--color-border)',
                                }}>{t}</button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-6 py-5">
                {loading ? (
                    <div className="flex justify-center py-20"><Loader2 className="animate-spin" size={24} style={{ color: 'var(--color-fg-muted)' }} /></div>
                ) : filtered.length === 0 ? (
                    <p className="text-center py-20 text-sm" style={{ color: 'var(--color-fg-muted)' }}>No clinical notes found</p>
                ) : (
                    <div className="space-y-3">
                        {filtered.map(n => {
                            const tc = TYPE_COLORS[n.type] || TYPE_COLORS.progress;
                            return (
                                <div key={n.id} className="rounded-xl border p-4" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <FileText size={14} style={{ color: tc.fg }} />
                                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase" style={{ background: tc.bg, color: tc.fg }}>{n.type}</span>
                                        <span className="text-[10px] ml-auto" style={{ color: 'var(--color-fg-muted)' }}>
                                            {n.author} &bull; {new Date(n.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--color-fg)' }}>
                                        {n.content.length > 300 ? n.content.slice(0, 300) + '...' : n.content}
                                    </p>
                                    <p className="text-[10px] mt-2 font-mono" style={{ color: 'var(--color-fg-muted)' }}>Patient: {n.patientId.slice(0, 8)}</p>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
