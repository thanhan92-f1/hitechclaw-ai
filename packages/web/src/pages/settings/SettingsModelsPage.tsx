import { useState } from 'react';
import { Brain, Cpu, Loader2, CheckCircle } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useSettingsData } from '../../components/SettingsLayout';
import { Section, EnvVar } from './shared';
import { setActiveModel as apiSetActiveModel } from '../../lib/api';

export function SettingsModelsPage() {
    const { t } = useI18n();
    const { models, activeModel, setActiveModel } = useSettingsData();
    const [switching, setSwitching] = useState<string | null>(null);

    const switchModel = async (name: string) => {
        setSwitching(name);
        try {
            await apiSetActiveModel(name);
            setActiveModel(name);
        } catch { /* ignore */ }
        setSwitching(null);
    };

    return (
        <div className="space-y-4">
            <Section icon={Brain} title={t('settings.models.title')}>
                <p className="text-xs mb-3" style={{ color: 'var(--color-fg-muted)' }}>
                    {t('settings.models.configDesc')}
                </p>
                <div className="grid grid-cols-2 gap-2">
                    <EnvVar name="LLM_PROVIDER" desc={t('settings.models.provider')} example="ollama | openai | anthropic" />
                    <EnvVar name="LLM_MODEL" desc={t('settings.models.defaultModel')} example="llama3.1:8b" />
                    <EnvVar name="OPENAI_API_KEY" desc={t('settings.models.openaiKey')} example="sk-proj-..." />
                    <EnvVar name="ANTHROPIC_API_KEY" desc={t('settings.models.anthropicKey')} example="sk-ant-..." />
                    <EnvVar name="OLLAMA_URL" desc={t('settings.models.ollamaUrl')} example="http://localhost:11434" />
                    <EnvVar name="LLM_TEMPERATURE" desc={t('settings.models.temperature')} example="0.7" />
                </div>
            </Section>

            <Section icon={Cpu} title={`${t('settings.models.availableModels')} (${models.length})`}>
                {models.length === 0 ? (
                    <p className="text-xs py-6 text-center" style={{ color: 'var(--color-fg-muted)' }}>
                        {t('settings.models.noModels')}
                    </p>
                ) : (
                    <div className="grid grid-cols-1 gap-2">
                        {models.map((m) => (
                            <div
                                key={m.name}
                                className="flex items-center gap-3 p-3 rounded-lg border transition-colors"
                                style={{
                                    background: m.name === activeModel ? 'var(--color-primary-soft)' : 'var(--color-bg)',
                                    borderColor: m.name === activeModel ? 'var(--color-primary)' : 'var(--color-border)',
                                }}
                            >
                                <div
                                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                                    style={{ background: m.name === activeModel ? 'var(--color-primary)' : 'var(--color-bg-soft)' }}
                                >
                                    <Cpu size={14} style={{ color: m.name === activeModel ? 'white' : 'var(--color-fg-muted)' }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate" style={{ color: 'var(--color-fg)' }}>{m.name}</p>
                                    <p className="text-[11px]" style={{ color: 'var(--color-fg-muted)' }}>
                                        {m.parameterSize} · {m.family} · {m.sizeMB}MB
                                    </p>
                                </div>
                                {m.name === activeModel ? (
                                    <span className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-md font-medium"
                                        style={{ background: 'var(--color-primary)', color: 'white' }}
                                    >
                                        <CheckCircle size={11} /> Active
                                    </span>
                                ) : (
                                    <button
                                        onClick={() => switchModel(m.name)}
                                        disabled={switching !== null}
                                        className="text-[11px] px-2.5 py-1 rounded-md border cursor-pointer transition-colors"
                                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-fg-muted)' }}
                                    >
                                        {switching === m.name ? <Loader2 size={11} className="animate-spin" /> : t('settings.models.activate')}
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </Section>
        </div>
    );
}
