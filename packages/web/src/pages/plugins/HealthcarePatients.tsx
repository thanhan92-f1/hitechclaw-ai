import { useState, useEffect } from 'react';
import { Users, Search, Heart, AlertTriangle, Pill, Loader2 } from 'lucide-react';
import { healthcareGetPatients } from '../../lib/api';

interface Patient {
    id: string;
    name: string;
    dob: string;
    gender: string;
    allergies: string[];
    medications: string[];
    conditions: string[];
    notes?: string;
}

export function HealthcarePatients() {
    const [patients, setPatients] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        healthcareGetPatients({ limit: 50 })
            .then(d => setPatients(d.patients || []))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    const filtered = patients.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.conditions.some(c => c.toLowerCase().includes(search.toLowerCase()))
    );

    return (
        <div className="h-full overflow-y-auto">
            <div className="px-6 pt-5 pb-4 border-b" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                <div className="max-w-6xl mx-auto">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.12)' }}>
                            <Users size={20} color="#22c55e" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold" style={{ color: 'var(--color-fg)' }}>Patient Records</h1>
                            <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>{patients.length} patients</p>
                        </div>
                    </div>
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-fg-muted)' }} />
                        <input
                            className="w-full pl-9 pr-4 py-2 rounded-lg border text-sm outline-none"
                            style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                            placeholder="Search patients or conditions..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 py-5">
                {loading ? (
                    <div className="flex justify-center py-20"><Loader2 className="animate-spin" size={24} style={{ color: 'var(--color-fg-muted)' }} /></div>
                ) : filtered.length === 0 ? (
                    <p className="text-center py-20 text-sm" style={{ color: 'var(--color-fg-muted)' }}>No patients found</p>
                ) : (
                    <div className="space-y-3">
                        {filtered.map(p => (
                            <div key={p.id} className="rounded-xl border p-4 hover:border-[var(--color-primary)] transition-colors"
                                style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-fg)' }}>{p.name}</h3>
                                        <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                                            {p.gender} &bull; DOB: {p.dob}
                                        </p>
                                    </div>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-mono" style={{ background: 'var(--color-bg)', color: 'var(--color-fg-muted)' }}>
                                        {p.id.slice(0, 8)}
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {/* Conditions */}
                                    <div>
                                        <div className="flex items-center gap-1 mb-1">
                                            <Heart size={12} color="#ef4444" />
                                            <span className="text-[10px] font-medium" style={{ color: 'var(--color-fg-muted)' }}>CONDITIONS</span>
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {p.conditions.length > 0 ? p.conditions.map(c => (
                                                <span key={c} className="text-[11px] px-1.5 py-0.5 rounded"
                                                    style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>{c}</span>
                                            )) : <span className="text-[11px]" style={{ color: 'var(--color-fg-muted)' }}>None</span>}
                                        </div>
                                    </div>

                                    {/* Medications */}
                                    <div>
                                        <div className="flex items-center gap-1 mb-1">
                                            <Pill size={12} color="#3b82f6" />
                                            <span className="text-[10px] font-medium" style={{ color: 'var(--color-fg-muted)' }}>MEDICATIONS</span>
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {p.medications.length > 0 ? p.medications.map(m => (
                                                <span key={m} className="text-[11px] px-1.5 py-0.5 rounded"
                                                    style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>{m}</span>
                                            )) : <span className="text-[11px]" style={{ color: 'var(--color-fg-muted)' }}>None</span>}
                                        </div>
                                    </div>

                                    {/* Allergies */}
                                    <div>
                                        <div className="flex items-center gap-1 mb-1">
                                            <AlertTriangle size={12} color="#f59e0b" />
                                            <span className="text-[10px] font-medium" style={{ color: 'var(--color-fg-muted)' }}>ALLERGIES</span>
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {p.allergies.length > 0 ? p.allergies.map(a => (
                                                <span key={a} className="text-[11px] px-1.5 py-0.5 rounded"
                                                    style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>{a}</span>
                                            )) : <span className="text-[11px]" style={{ color: 'var(--color-fg-muted)' }}>None</span>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
