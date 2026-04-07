import { useState, useEffect } from 'react';
import { Languages, Settings, Save, Loader2, CheckCircle, Globe2 } from 'lucide-react';
import { useI18n, type Locale } from '../../i18n';
import { Section } from './shared';
import { getAISettings, updateAISettings } from '../../lib/api';

const UI_LANGUAGES: { code: Locale; label: string; flag: string }[] = [
    { code: 'en', label: 'English', flag: '🇺🇸' },
    { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
];

export function SettingsLanguagePage() {
    const { t, locale, setLocale } = useI18n();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [aiLanguage, setAiLanguage] = useState('auto');
    const [aiLanguageCustom, setAiLanguageCustom] = useState('');
    const [languages, setLanguages] = useState<Array<{ code: string; name: string }>>([]);

    useEffect(() => {
        getAISettings()
            .then((data) => {
                setAiLanguage(data.aiLanguage || 'auto');
                setAiLanguageCustom(data.aiLanguageCustom || '');
                if (data.languages) setLanguages(data.languages);
            })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        setSaving(true);
        setSaved(false);
        try {
            await updateAISettings({ aiLanguage, aiLanguageCustom });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch { /* ignore */ }
        setSaving(false);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 size={20} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
            </div>
        );
    }

    const flags: Record<string, string> = { vi: '🇻🇳', en: '🇺🇸', ja: '🇯🇵', ko: '🇰🇷', zh: '🇨🇳', 'zh-tw': '🇹🇼', fr: '🇫🇷', de: '🇩🇪', es: '🇪🇸', pt: '🇧🇷', it: '🇮🇹', ru: '🇷🇺', th: '🇹🇭', id: '🇮🇩', ms: '🇲🇾', ar: '🇸🇦', hi: '🇮🇳' };

    return (
        <div className="space-y-4">
            {/* UI Language Switcher */}
            <Section icon={Globe2} title={t('settings.language.uiLanguage')}>
                <p className="text-xs mb-3" style={{ color: 'var(--color-fg-muted)' }}>
                    {t('settings.language.uiLanguageDesc')}
                </p>
                <div className="flex gap-2">
                    {UI_LANGUAGES.map((lang) => (
                        <button
                            key={lang.code}
                            onClick={() => setLocale(lang.code)}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border text-left cursor-pointer transition-all"
                            style={{
                                background: locale === lang.code ? 'var(--color-primary-soft)' : 'var(--color-bg)',
                                borderColor: locale === lang.code ? 'var(--color-primary)' : 'var(--color-border)',
                            }}
                        >
                            <span className="text-lg">{lang.flag}</span>
                            <span className="text-xs font-medium" style={{ color: locale === lang.code ? 'var(--color-primary-light)' : 'var(--color-fg)' }}>
                                {lang.label}
                            </span>
                            {locale === lang.code && <CheckCircle size={14} style={{ color: 'var(--color-primary)' }} />}
                        </button>
                    ))}
                </div>
            </Section>

            {/* AI Response Language */}
            <Section icon={Languages} title={t('settings.language.aiResponseLang')}>
                <p className="text-xs mb-4" style={{ color: 'var(--color-fg-muted)' }}>
                    {t('settings.language.aiResponseDesc')}
                </p>
                <div className="grid grid-cols-3 gap-2 mb-4">
                    <button
                        onClick={() => setAiLanguage('auto')}
                        className="flex items-center gap-2 p-3 rounded-lg border text-left cursor-pointer transition-all"
                        style={{
                            background: aiLanguage === 'auto' ? 'var(--color-primary-soft)' : 'var(--color-bg)',
                            borderColor: aiLanguage === 'auto' ? 'var(--color-primary)' : 'var(--color-border)',
                        }}
                    >
                        <span className="text-lg">🌐</span>
                        <div>
                            <p className="text-xs font-medium" style={{ color: aiLanguage === 'auto' ? 'var(--color-primary-light)' : 'var(--color-fg)' }}>{t('settings.language.autoDetect')}</p>
                            <p className="text-[10px]" style={{ color: 'var(--color-fg-muted)' }}>{t('settings.language.autoDetectDesc')}</p>
                        </div>
                        {aiLanguage === 'auto' && <CheckCircle size={14} className="ml-auto" style={{ color: 'var(--color-primary)' }} />}
                    </button>
                    {languages.map((lang) => (
                        <button
                            key={lang.code}
                            onClick={() => setAiLanguage(lang.code)}
                            className="flex items-center gap-2 p-3 rounded-lg border text-left cursor-pointer transition-all"
                            style={{
                                background: aiLanguage === lang.code ? 'var(--color-primary-soft)' : 'var(--color-bg)',
                                borderColor: aiLanguage === lang.code ? 'var(--color-primary)' : 'var(--color-border)',
                            }}
                        >
                            <span className="text-lg">{flags[lang.code] || '🏳️'}</span>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate" style={{ color: aiLanguage === lang.code ? 'var(--color-primary-light)' : 'var(--color-fg)' }}>{lang.name.split(' (')[0]}</p>
                                <p className="text-[10px] truncate" style={{ color: 'var(--color-fg-muted)' }}>{lang.name.includes('(') ? lang.name.split('(')[1]?.replace(')', '') : lang.code}</p>
                            </div>
                            {aiLanguage === lang.code && <CheckCircle size={14} className="shrink-0" style={{ color: 'var(--color-primary)' }} />}
                        </button>
                    ))}
                </div>
            </Section>

            <Section icon={Settings} title={t('settings.language.customInstruction')}>
                <p className="text-xs mb-3" style={{ color: 'var(--color-fg-muted)' }}>
                    {t('settings.language.customDesc')}
                </p>
                <textarea
                    value={aiLanguageCustom}
                    onChange={(e) => setAiLanguageCustom(e.target.value)}
                    placeholder={t('settings.language.customPlaceholder')}
                    rows={3}
                    maxLength={500}
                    className="w-full px-3 py-2 rounded-lg border text-xs resize-none focus:outline-none"
                    style={{
                        background: 'var(--color-bg)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-fg)',
                    }}
                />
                <p className="text-[10px] mt-1 text-right" style={{ color: 'var(--color-fg-muted)' }}>
                    {aiLanguageCustom.length}/500
                </p>
            </Section>

            <div className="flex items-center gap-3">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                    style={{ background: 'var(--color-primary)', color: 'white' }}
                >
                    {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                    {t('settings.language.saveSettings')}
                </button>
                {saved && (
                    <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-success)' }}>
                        <CheckCircle size={12} /> {t('settings.language.saved')}
                    </span>
                )}
            </div>
        </div>
    );
}
