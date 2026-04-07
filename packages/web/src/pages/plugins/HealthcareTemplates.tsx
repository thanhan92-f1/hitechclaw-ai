import { useState, useEffect } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { healthcareGetTemplates } from '../../lib/api';

interface Template {
    id: string;
    name: string;
    description?: string;
    type?: string;
    fields?: Array<{ name: string; type: string; required?: boolean }>;
}

export function HealthcareTemplates() {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        healthcareGetTemplates()
            .then(d => setTemplates(d.templates || []))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="h-full overflow-y-auto">
            <div className="px-6 pt-5 pb-4 border-b" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                <div className="max-w-5xl mx-auto">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.12)' }}>
                            <FileText size={20} color="#10b981" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold" style={{ color: 'var(--color-fg)' }}>Medical Templates</h1>
                            <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>Standardized medical document templates</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-6 py-5">
                {loading ? (
                    <div className="flex justify-center py-20"><Loader2 className="animate-spin" size={24} style={{ color: 'var(--color-fg-muted)' }} /></div>
                ) : templates.length === 0 ? (
                    <p className="text-center py-20 text-sm" style={{ color: 'var(--color-fg-muted)' }}>No templates available</p>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {templates.map(t => (
                            <div key={t.id} className="rounded-xl border p-4 hover:border-[var(--color-primary)] transition-colors"
                                style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                                <div className="flex items-center gap-2 mb-2">
                                    <FileText size={16} style={{ color: '#10b981' }} />
                                    <h3 className="text-sm font-semibold" style={{ color: 'var(--color-fg)' }}>{t.name}</h3>
                                </div>
                                {t.description && <p className="text-xs mb-3" style={{ color: 'var(--color-fg-muted)' }}>{t.description}</p>}
                                {t.type && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                                        style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>{t.type}</span>
                                )}
                                {t.fields && (
                                    <p className="text-[10px] mt-2" style={{ color: 'var(--color-fg-muted)' }}>{t.fields.length} fields</p>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
