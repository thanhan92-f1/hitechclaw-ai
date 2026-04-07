import { useState, useEffect, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    FileText,
    Loader2,
    Trash2,
    Plus,
    Pencil,
    Save,
    X,
    RefreshCw,
    Tag,
    ToggleLeft,
    ToggleRight,
    Globe,
    Copy,
    Check,
    Settings2,
    Info,
    Layers,
} from 'lucide-react';
import {
    getDocument,
    getDocumentChunks,
    updateDocument,
    deleteDocument,
    setDocumentEnabled,
    reindexDocument,
    addChunk,
    updateChunk,
    deleteChunk,
    getCollections,
} from '../lib/api';

interface DocDetail {
    id: string;
    title: string;
    content: string;
    source: string;
    mimeType: string;
    chunkCount: number;
    createdAt: string;
    updatedAt: string;
    metadata: Record<string, unknown>;
    meta: {
        enabled: boolean;
        tags: string[];
        collectionId: string | null;
        customMetadata: Record<string, string>;
        chunkingOptions: { chunkSize: number; chunkOverlap: number };
        processingStatus: string;
        processingError?: string;
        wordCount: number;
        charCount: number;
    };
}

interface ChunkInfo {
    id: string;
    documentId: string;
    content: string;
    metadata: Record<string, unknown>;
}

interface Collection {
    id: string;
    name: string;
    color: string;
}

export function DocumentDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [doc, setDoc] = useState<DocDetail | null>(null);
    const [chunks, setChunks] = useState<ChunkInfo[]>([]);
    const [collections, setCollections] = useState<Collection[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [tab, setTab] = useState<'chunks' | 'content' | 'metadata'>('chunks');
    const [editingTitle, setEditingTitle] = useState(false);
    const [titleVal, setTitleVal] = useState('');
    const [editingTags, setEditingTags] = useState(false);
    const [tagsVal, setTagsVal] = useState('');

    const load = async () => {
        if (!id) return;
        try {
            const [docData, chunkData, colData] = await Promise.all([
                getDocument(id),
                getDocumentChunks(id),
                getCollections(),
            ]);
            setDoc(docData);
            setChunks(chunkData.chunks || []);
            setCollections(colData.collections || []);
            setTitleVal(docData.title);
            setTagsVal((docData.meta?.tags || []).join(', '));
        } catch {
            setError('Failed to load document');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [id]);

    const handleSaveTitle = async () => {
        if (!id) return;
        await updateDocument(id, { title: titleVal });
        setEditingTitle(false);
        load();
    };

    const handleSaveTags = async () => {
        if (!id) return;
        await updateDocument(id, { tags: tagsVal.split(',').map((t) => t.trim()).filter(Boolean) });
        setEditingTags(false);
        load();
    };

    const handleToggleEnabled = async () => {
        if (!id || !doc) return;
        await setDocumentEnabled(id, !doc.meta.enabled);
        load();
    };

    const handleReindex = async () => {
        if (!id) return;
        await reindexDocument(id);
        load();
    };

    const handleDelete = async () => {
        if (!id || !confirm('Delete this document permanently?')) return;
        await deleteDocument(id);
        navigate('/knowledge');
    };

    const handleCollectionChange = async (colId: string) => {
        if (!id) return;
        await updateDocument(id, { collectionId: colId });
        load();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
            </div>
        );
    }

    if (!doc) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-3">
                <p style={{ color: 'var(--color-fg-muted)' }}>{error || 'Document not found'}</p>
                <button onClick={() => navigate('/knowledge')} className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--color-primary)' }}>
                    <ArrowLeft size={14} /> Back to Knowledge Base
                </button>
            </div>
        );
    }

    const col = collections.find((c) => c.id === doc.meta?.collectionId);

    return (
        <div className="h-full overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 z-10 border-b px-6 py-3" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
                <div className="max-w-5xl mx-auto flex items-center gap-3">
                    <button onClick={() => navigate('/knowledge')} className="p-1.5 rounded-lg cursor-pointer" style={{ color: 'var(--color-fg-muted)' }}>
                        <ArrowLeft size={18} />
                    </button>

                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--color-primary-soft)' }}>
                        {doc.source.startsWith('http') ? <Globe size={18} style={{ color: 'var(--color-primary)' }} /> : <FileText size={18} style={{ color: 'var(--color-primary)' }} />}
                    </div>

                    <div className="flex-1 min-w-0">
                        {editingTitle ? (
                            <div className="flex items-center gap-2">
                                <input value={titleVal} onChange={(e) => setTitleVal(e.target.value)} autoFocus
                                    className="text-sm font-semibold px-2 py-1 rounded border outline-none"
                                    style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
                                />
                                <button onClick={handleSaveTitle} className="p-1 cursor-pointer" style={{ color: 'var(--color-success)' }}><Save size={14} /></button>
                                <button onClick={() => setEditingTitle(false)} className="p-1 cursor-pointer" style={{ color: 'var(--color-fg-muted)' }}><X size={14} /></button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <h1 className="text-sm font-semibold truncate" style={{ color: 'var(--color-fg)' }}>{doc.title}</h1>
                                <button onClick={() => setEditingTitle(true)} className="p-0.5 cursor-pointer opacity-50 hover:opacity-100" style={{ color: 'var(--color-fg-muted)' }}>
                                    <Pencil size={12} />
                                </button>
                            </div>
                        )}
                        <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                            <span>{chunks.length} chunks</span>
                            <span>{doc.meta?.wordCount ?? 0} words</span>
                            {col && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: col.color }} />{col.name}</span>}
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <button onClick={handleToggleEnabled} className="p-2 rounded-lg cursor-pointer" title={doc.meta.enabled ? 'Disable' : 'Enable'}
                            style={{ color: doc.meta.enabled ? 'var(--color-success)' : 'var(--color-fg-muted)' }}>
                            {doc.meta.enabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                        </button>
                        <button onClick={handleReindex} className="p-2 rounded-lg cursor-pointer" style={{ color: 'var(--color-fg-muted)' }} title="Re-index">
                            <RefreshCw size={16} />
                        </button>
                        <button onClick={handleDelete} className="p-2 rounded-lg cursor-pointer" style={{ color: 'var(--color-destructive)' }} title="Delete">
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto p-6">
                {error && (
                    <div className="mb-4 px-4 py-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>{error}</div>
                )}

                {/* Info Bar */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                    <InfoCard label="Status" value={doc.meta.processingStatus} />
                    <InfoCard label="Source" value={doc.source} />
                    <InfoCard label="Created" value={new Date(doc.createdAt).toLocaleDateString()} />
                    <InfoCard label="Characters" value={String(doc.meta.charCount)} />
                </div>

                {/* Tags */}
                <div className="mb-5 flex items-center gap-2 flex-wrap">
                    <Tag size={13} style={{ color: 'var(--color-fg-muted)' }} />
                    {editingTags ? (
                        <>
                            <input value={tagsVal} onChange={(e) => setTagsVal(e.target.value)} autoFocus placeholder="tag1, tag2..."
                                className="px-2 py-1 rounded text-xs border outline-none"
                                style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                                onKeyDown={(e) => e.key === 'Enter' && handleSaveTags()}
                            />
                            <button onClick={handleSaveTags} className="text-xs cursor-pointer" style={{ color: 'var(--color-success)' }}>Save</button>
                            <button onClick={() => setEditingTags(false)} className="text-xs cursor-pointer" style={{ color: 'var(--color-fg-muted)' }}>Cancel</button>
                        </>
                    ) : (
                        <>
                            {doc.meta.tags.length > 0 ? doc.meta.tags.map((t) => (
                                <span key={t} className="px-2 py-0.5 rounded-full text-xs" style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary-light)' }}>{t}</span>
                            )) : <span className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>No tags</span>}
                            <button onClick={() => setEditingTags(true)} className="p-0.5 cursor-pointer opacity-50 hover:opacity-100" style={{ color: 'var(--color-fg-muted)' }}>
                                <Pencil size={11} />
                            </button>
                        </>
                    )}
                </div>

                {/* Collection Selector */}
                <div className="mb-5 flex items-center gap-2">
                    <span className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>Collection:</span>
                    <select
                        value={doc.meta.collectionId ?? 'default'}
                        onChange={(e) => handleCollectionChange(e.target.value)}
                        className="px-2 py-1 rounded text-xs border outline-none cursor-pointer"
                        style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                    >
                        {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 mb-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
                    <TabButton active={tab === 'chunks'} onClick={() => setTab('chunks')}>
                        <Layers size={13} /> Chunks ({chunks.length})
                    </TabButton>
                    <TabButton active={tab === 'content'} onClick={() => setTab('content')}>
                        <FileText size={13} /> Full Content
                    </TabButton>
                    <TabButton active={tab === 'metadata'} onClick={() => setTab('metadata')}>
                        <Info size={13} /> Metadata
                    </TabButton>
                </div>

                {/* Tab Content */}
                {tab === 'chunks' && (
                    <ChunksPanel documentId={doc.id} chunks={chunks} onReload={load} />
                )}
                {tab === 'content' && (
                    <div className="rounded-xl border p-4" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                        <pre className="text-xs leading-relaxed whitespace-pre-wrap max-h-[60vh] overflow-y-auto"
                            style={{ color: 'var(--color-fg-soft)' }}>
                            {doc.content}
                        </pre>
                    </div>
                )}
                {tab === 'metadata' && (
                    <MetadataPanel doc={doc} />
                )}
            </div>
        </div>
    );
}

// ─── Sub-components ────────────────────────────────────────

function InfoCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="px-3 py-2 rounded-lg border" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
            <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-fg-muted)' }}>{label}</p>
            <p className="text-xs font-medium truncate" style={{ color: 'var(--color-fg)' }}>{value}</p>
        </div>
    );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            onClick={onClick}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium cursor-pointer border-b-2 -mb-px transition-colors"
            style={{
                borderColor: active ? 'var(--color-primary)' : 'transparent',
                color: active ? 'var(--color-primary-light)' : 'var(--color-fg-muted)',
            }}
        >
            {children}
        </button>
    );
}

function ChunksPanel({ documentId, chunks, onReload }: { documentId: string; chunks: ChunkInfo[]; onReload: () => void }) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState('');
    const [showAdd, setShowAdd] = useState(false);
    const [newContent, setNewContent] = useState('');
    const [saving, setSaving] = useState(false);

    const handleSaveEdit = async () => {
        if (!editingId) return;
        setSaving(true);
        try {
            await updateChunk(documentId, editingId, editContent);
            setEditingId(null);
            onReload();
        } catch { /* ignore */ }
        setSaving(false);
    };

    const handleDeleteChunk = async (chunkId: string) => {
        if (!confirm('Delete this chunk?')) return;
        await deleteChunk(documentId, chunkId);
        onReload();
    };

    const handleAddChunk = async () => {
        if (!newContent.trim()) return;
        setSaving(true);
        try {
            await addChunk(documentId, newContent);
            setNewContent('');
            setShowAdd(false);
            onReload();
        } catch { /* ignore */ }
        setSaving(false);
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>{chunks.length} chunks</span>
                <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                    style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary-light)' }}>
                    <Plus size={12} /> Add Chunk
                </button>
            </div>

            {showAdd && (
                <div className="rounded-xl border p-3 space-y-2 animate-fade-in" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-primary)' }}>
                    <textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} rows={4} placeholder="New chunk content..."
                        className="w-full px-3 py-2 rounded-lg text-xs border outline-none resize-none"
                        style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }} />
                    <div className="flex gap-2 justify-end">
                        <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 rounded text-xs cursor-pointer" style={{ color: 'var(--color-fg-muted)' }}>Cancel</button>
                        <button onClick={handleAddChunk} disabled={saving || !newContent.trim()} className="px-3 py-1.5 rounded text-xs font-medium text-white cursor-pointer disabled:opacity-50"
                            style={{ background: 'var(--color-primary)' }}>{saving ? '...' : 'Add'}</button>
                    </div>
                </div>
            )}

            {chunks.map((chunk, idx) => (
                <div key={chunk.id} className="rounded-xl border overflow-hidden" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                    <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary-light)' }}>
                            #{idx}
                        </span>
                        <span className="text-[10px] flex-1" style={{ color: 'var(--color-fg-muted)' }}>
                            {chunk.content.length} chars
                            {chunk.metadata?.manual && ' (manual)'}
                        </span>
                        <CopyButton text={chunk.content} />
                        <button onClick={() => { setEditingId(chunk.id); setEditContent(chunk.content); }} className="p-1 cursor-pointer"
                            style={{ color: 'var(--color-fg-muted)' }} title="Edit"><Pencil size={12} /></button>
                        <button onClick={() => handleDeleteChunk(chunk.id)} className="p-1 cursor-pointer"
                            style={{ color: 'var(--color-destructive)' }} title="Delete"><Trash2 size={12} /></button>
                    </div>

                    {editingId === chunk.id ? (
                        <div className="p-3 space-y-2">
                            <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={5}
                                className="w-full px-3 py-2 rounded-lg text-xs border outline-none resize-none font-mono"
                                style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }} />
                            <div className="flex gap-2 justify-end">
                                <button onClick={() => setEditingId(null)} className="px-3 py-1.5 rounded text-xs cursor-pointer" style={{ color: 'var(--color-fg-muted)' }}>Cancel</button>
                                <button onClick={handleSaveEdit} disabled={saving} className="px-3 py-1.5 rounded text-xs font-medium text-white cursor-pointer disabled:opacity-50"
                                    style={{ background: 'var(--color-primary)' }}>{saving ? '...' : 'Save'}</button>
                            </div>
                        </div>
                    ) : (
                        <div className="px-3 py-2">
                            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-fg-soft)' }}>{chunk.content}</p>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

function MetadataPanel({ doc }: { doc: DocDetail }) {
    const meta = doc.meta;
    const entries: [string, string][] = [
        ['ID', doc.id],
        ['Source', doc.source],
        ['MIME Type', doc.mimeType || 'text/plain'],
        ['Status', meta.processingStatus],
        ['Enabled', meta.enabled ? 'Yes' : 'No'],
        ['Word Count', String(meta.wordCount)],
        ['Character Count', String(meta.charCount)],
        ['Chunk Size', String(meta.chunkingOptions.chunkSize)],
        ['Chunk Overlap', String(meta.chunkingOptions.chunkOverlap)],
        ['Collection', meta.collectionId ?? 'default'],
        ['Tags', meta.tags.join(', ') || '(none)'],
        ['Created', new Date(doc.createdAt).toLocaleString()],
        ['Updated', new Date(doc.updatedAt).toLocaleString()],
    ];

    if (meta.processingError) entries.push(['Error', meta.processingError]);
    for (const [k, v] of Object.entries(meta.customMetadata || {})) {
        entries.push([`custom.${k}`, v]);
    }

    return (
        <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
            {entries.map(([label, value], i) => (
                <div key={label} className="flex items-center border-b last:border-b-0 px-4 py-2.5" style={{ borderColor: 'var(--color-border)' }}>
                    <span className="text-xs font-medium w-36 shrink-0" style={{ color: 'var(--color-fg-muted)' }}>{label}</span>
                    <span className="text-xs font-mono truncate" style={{ color: 'var(--color-fg-soft)' }}>{value}</span>
                </div>
            ))}
        </div>
    );
}

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };
    return (
        <button onClick={copy} className="p-1 cursor-pointer" style={{ color: copied ? 'var(--color-success)' : 'var(--color-fg-muted)' }} title="Copy">
            {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
    );
}
