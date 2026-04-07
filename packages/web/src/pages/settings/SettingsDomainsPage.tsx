import { useState } from 'react';
import { Globe, ChevronDown, ChevronRight, Plug } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useSettingsData } from '../../components/SettingsLayout';
import { Section } from './shared';

export function SettingsDomainsPage() {
    const { t } = useI18n();
    const { domains } = useSettingsData();
    const [expanded, setExpanded] = useState<string | null>(null);

    return (
        <div className="space-y-4">
            <Section icon={Globe} title={`${t('settings.domains.title')} (${domains.length})`}>
                <p className="text-xs mb-3" style={{ color: 'var(--color-fg-muted)' }}>
                    {t('settings.domains.desc')}
                </p>
                {domains.length === 0 ? (
                    <p className="text-xs py-6 text-center" style={{ color: 'var(--color-fg-muted)' }}>{t('settings.overview.noDomains')}</p>
                ) : (
                    <div className="space-y-2">
                        {domains.map((d: any) => (
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
                                        {d.skills?.length || 0} {t('settings.overview.skills')}
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
                                            <p className="text-[11px] py-1" style={{ color: 'var(--color-fg-muted)' }}>{t('settings.domains.noSkills')}</p>
                                        )}
                                        {d.integrations && d.integrations.length > 0 && (
                                            <div className="mt-2 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
                                                <p className="text-[10px] font-semibold mb-1" style={{ color: 'var(--color-fg-muted)' }}>{t('settings.domains.integrations')}</p>
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
