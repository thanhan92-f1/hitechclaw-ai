import { Server, Cpu, Globe, Clock, Brain } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useSettingsData } from '../../components/SettingsLayout';
import { Section, StatusCard, InfoCell, formatUptime } from './shared';

export function SettingsOverviewPage() {
    const { t } = useI18n();
    const { health, models, domains, activeModel } = useSettingsData();

    return (
        <div className="space-y-4">
            {/* Status Cards */}
            <div className="grid grid-cols-4 gap-3">
                <StatusCard
                    icon={Server}
                    label={t('settings.overview.server')}
                    value={health?.status === 'ok' ? t('dashboard.online') : t('dashboard.offline')}
                    status={health?.status === 'ok' ? 'success' : 'error'}
                    detail={health ? `v${health.version}` : ''}
                />
                <StatusCard
                    icon={Cpu}
                    label={t('settings.overview.llmModel')}
                    value={activeModel || 'None'}
                    status={activeModel ? 'success' : 'warning'}
                    detail={`${models.length} ${t('settings.overview.available')}`}
                />
                <StatusCard
                    icon={Globe}
                    label={t('settings.overview.domains')}
                    value={`${domains.length}`}
                    status={domains.length > 0 ? 'success' : 'warning'}
                    detail={`${domains.reduce((s: number, d: any) => s + (d.skills?.length || 0), 0)} ${t('settings.overview.skills')}`}
                />
                <StatusCard
                    icon={Clock}
                    label={t('settings.overview.uptime')}
                    value={health ? formatUptime(health.uptime) : '—'}
                    status="neutral"
                    detail={health ? new Date(health.timestamp).toLocaleTimeString() : ''}
                />
            </div>

            {/* Server Details */}
            <Section icon={Server} title={t('settings.overview.serverInfo')}>
                <div className="grid grid-cols-2 gap-2">
                    <InfoCell label={t('settings.overview.status')} value={health?.status ?? 'Unknown'} />
                    <InfoCell label={t('settings.overview.version')} value={health?.version ?? '—'} />
                    <InfoCell label={t('settings.overview.uptime')} value={health ? formatUptime(health.uptime) : '—'} />
                    <InfoCell label={t('settings.overview.lastCheck')} value={health ? new Date(health.timestamp).toLocaleString() : '—'} />
                    <InfoCell label={t('settings.overview.platform')} value="HiTechClaw v2" />
                    <InfoCell label={t('settings.overview.runtime')} value="Node.js + Hono" />
                </div>
            </Section>

            {/* Quick Info */}
            <div className="grid grid-cols-2 gap-3">
                <Section icon={Brain} title={t('settings.overview.activeLlm')}>
                    <div className="space-y-1.5">
                        <InfoCell label={t('settings.overview.model')} value={activeModel || 'Not configured'} />
                        <InfoCell label={t('settings.overview.availableModels')} value={`${models.length}`} />
                        <InfoCell label={t('settings.overview.totalSize')} value={`${models.reduce((s: number, m: any) => s + (m.sizeMB || 0), 0)} MB`} />
                    </div>
                </Section>
                <Section icon={Globe} title={t('settings.overview.domainPacks')}>
                    <div className="space-y-1.5">
                        <InfoCell label={t('settings.overview.loadedDomains')} value={`${domains.length}`} />
                        <InfoCell label={t('settings.overview.totalSkills')} value={`${domains.reduce((s: number, d: any) => s + (d.skills?.length || 0), 0)}`} />
                        <InfoCell label={t('settings.overview.domainStatus')} value={domains.length > 0 ? t('common.active') : t('settings.overview.noDomains')} />
                    </div>
                </Section>
            </div>
        </div>
    );
}
