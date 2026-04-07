import { Database, HardDrive, Zap, ChevronRight } from 'lucide-react';
import { useI18n } from '../../i18n';
import { Section, ConfigCard } from './shared';

export function SettingsRagPage() {
    const { t } = useI18n();

    return (
        <div className="space-y-4">
            <Section icon={Database} title={t('settings.rag.title')}>
                <p className="text-xs mb-3" style={{ color: 'var(--color-fg-muted)' }}>
                    {t('settings.rag.desc')}
                </p>
                <div className="grid grid-cols-3 gap-2">
                    <ConfigCard label={t('settings.rag.chunkSize')} value="512" unit="chars" desc="Text chunk size for splitting" />
                    <ConfigCard label={t('settings.rag.chunkOverlap')} value="50" unit="chars" desc="Overlap between chunks" />
                    <ConfigCard label={t('settings.rag.topK')} value="5" unit="docs" desc="Max context documents" />
                    <ConfigCard label={t('settings.rag.scoreThreshold')} value="0.1" unit="" desc="Minimum relevance score" />
                    <ConfigCard label={t('settings.rag.embeddingModel')} value="Local" unit="" desc="Dev: local / Prod: OpenAI" />
                    <ConfigCard label={t('settings.rag.vectorStore')} value="In-Memory" unit="" desc="Document vector storage" />
                </div>
            </Section>

            <Section icon={HardDrive} title={t('settings.rag.supportedFiles')}>
                <div className="flex flex-wrap gap-1.5">
                    {['PDF', 'DOC/DOCX', 'TXT', 'Markdown', 'CSV', 'JSON', 'HTML', 'XML'].map((ft) => (
                        <span key={ft} className="text-[11px] px-2.5 py-1 rounded-md border font-medium"
                            style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg-muted)' }}
                        >
                            {ft}
                        </span>
                    ))}
                </div>
            </Section>

            <Section icon={Zap} title={t('settings.rag.pipeline')}>
                <div className="flex items-center gap-2">
                    {['Upload', 'Parse', 'Chunk', 'Embed', 'Store', 'Index'].map((step, i) => (
                        <div key={step} className="flex items-center gap-2">
                            <div className="text-[11px] px-2.5 py-1.5 rounded-lg font-medium"
                                style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary-light)' }}
                            >
                                {step}
                            </div>
                            {i < 5 && <ChevronRight size={12} style={{ color: 'var(--color-fg-muted)' }} />}
                        </div>
                    ))}
                </div>
            </Section>
        </div>
    );
}
