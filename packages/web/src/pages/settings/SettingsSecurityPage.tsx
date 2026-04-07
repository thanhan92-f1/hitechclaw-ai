import { Shield, Settings } from 'lucide-react';
import { useI18n } from '../../i18n';
import { Section, ConfigCard, EnvVar } from './shared';

export function SettingsSecurityPage() {
    const { t } = useI18n();

    return (
        <div className="space-y-4">
            <Section icon={Shield} title={t('settings.security.auth')}>
                <div className="grid grid-cols-2 gap-2">
                    <ConfigCard label={t('settings.security.method')} value="JWT" unit="" desc="JSON Web Token HS256" />
                    <ConfigCard label={t('settings.security.tokenExpiry')} value="24h" unit="" desc="Access token lifetime" />
                    <ConfigCard label={t('settings.security.issuer')} value="HiTechClaw" unit="" desc="Token issuer claim" />
                    <ConfigCard label={t('settings.security.algorithm')} value="HS256" unit="" desc="HMAC SHA-256 signing" />
                </div>
            </Section>

            <Section icon={Shield} title={t('settings.security.network')}>
                <div className="grid grid-cols-2 gap-2">
                    <ConfigCard label={t('settings.security.corsOrigin')} value="localhost:5173" unit="" desc="Allowed web origin" />
                    <ConfigCard label={t('settings.security.apiPort')} value="3000" unit="" desc="Server listen port" />
                    <ConfigCard label={t('settings.security.https')} value="Optional" unit="" desc="TLS in production" />
                    <ConfigCard label={t('settings.security.rateLimit')} value="None" unit="" desc="No rate limit (dev)" />
                </div>
            </Section>

            <Section icon={Settings} title={t('settings.security.envVars')}>
                <div className="grid grid-cols-2 gap-2">
                    <EnvVar name="JWT_SECRET" desc="Token signing secret" example="(auto-generated)" />
                    <EnvVar name="PORT" desc="Server port" example="3000" />
                    <EnvVar name="NODE_ENV" desc="Environment mode" example="development | production" />
                    <EnvVar name="CORS_ORIGIN" desc="Allowed origin" example="http://localhost:5173" />
                </div>
            </Section>
        </div>
    );
}
