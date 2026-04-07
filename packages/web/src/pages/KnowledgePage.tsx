import { useState, useEffect, useRef, type FormEvent } from 'react';
import {
    Upload,
    FileText,
    Trash2,
    Database,
    Plus,
    X,
    Loader2,
    FileUp,
    ChevronDown,
    FolderOpen,
    Tag,
    Link,
    ToggleLeft,
    ToggleRight,
    RefreshCw,
    CheckSquare,
    Square,
    MoreHorizontal,
    Globe,
    Settings2,
    BarChart3,
    Eye,
    Pencil,
} from 'lucide-react';
import {
    getKnowledge,
    uploadDocument,
    uploadDocumentFile,
    importUrl,
    deleteDocument,
    setDocumentEnabled,
    reindexDocument,
    getCollections,
    createCollection,
    deleteCollection,
    batchDeleteDocuments,
    batchSetEnabled,
    batchMoveToCollection,
    updateDocument,
    getAnalytics,
    crawlWebsite,
    getStaleDocuments,
    refreshDocument as apiRefreshDocument,
    refreshAllStaleDocuments,
} from '../lib/api';
import { useNavigate } from 'react-router-dom';

interface DocMeta {
    enabled: boolean;
    tags: string[];
    collectionId: string | null;
    customMetadata: Record<string, string>;
    processingStatus: string;
    wordCount: number;
    charCount: number;
}

interface DocInfo {
    id: string;
    title: string;
    content: string;
    source: string;
    chunkCount: number;
    createdAt: string;
    mimeType: string;
    metadata: Record<string, unknown>;
    meta: DocMeta;
}

interface Collection {
    id: string;
    name: string;
    description: string;
    color: string;
    documentCount: number;
}

interface KBState {
    documents: DocInfo[];
    stats: { totalDocuments: number; totalChunks: number; totalCollections: number; totalEnabledDocuments: number };
}

export function KnowledgePage() {
    const navigate = useNavigate();
    const [kb, setKB] = useState<KBState | null>(null);
    const [collections, setCollections] = useState<Collection[]>([]);
    const [activeCollection, setActiveCollection] = useState<string | null>(null);
    const [searchFilter, setSearchFilter] = useState('');
    const [tagFilter, setTagFilter] = useState('');
    const [showUpload, setShowUpload] = useState(false);
    const [showNewCollection, setShowNewCollection] = useState(false);
    const [showAnalytics, setShowAnalytics] = useState(false);
    const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = async () => {
        try {
            const [data, colData] = await Promise.all([
                getKnowledge({
                    collectionId: activeCollection || undefined,
                    tag: tagFilter || undefined,
                    search: searchFilter || undefined,
                }),
                getCollections(),
            ]);
            setKB(data);
            setCollections(colData.collections);
        } catch {
            setError('Failed to load knowledge base');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [activeCollection, tagFilter]);

    const handleSearch = () => { setLoading(true); load(); };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this document?')) return;
        try { await deleteDocument(id); await load(); } catch { setError('Delete failed'); }
    };

    const handleToggleEnabled = async (id: string, enabled: boolean) => {
        try { await setDocumentEnabled(id, !enabled); await load(); } catch { setError('Toggle failed'); }
    };

    const handleReindex = async (id: string) => {
        try { await reindexDocument(id); await load(); } catch { setError('Reindex failed'); }
    };

    const toggleSelect = (id: string) => {
        setSelectedDocs((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const selectAll = () => {
        if (!kb) return;
        if (selectedDocs.size === kb.documents.length) setSelectedDocs(new Set());
        else setSelectedDocs(new Set(kb.documents.map((d) => d.id)));
    };

    const handleBatchDelete = async () => {
        if (!confirm(`Delete ${selectedDocs.size} documents?`)) return;
        try { await batchDeleteDocuments(Array.from(selectedDocs)); setSelectedDocs(new Set()); await load(); }
        catch { setError('Batch delete failed'); }
    };

    const handleBatchEnable = async (enabled: boolean) => {
        try { await batchSetEnabled(Array.from(selectedDocs), enabled); setSelectedDocs(new Set()); await load(); }
        catch { setError('Batch enable failed'); }
    };

    const handleBatchMove = async (collectionId: string) => {
        try { await batchMoveToCollection(Array.from(selectedDocs), collectionId); setSelectedDocs(new Set()); await load(); }
        catch { setError('Batch move failed'); }
    };

    const allTags = kb ? Array.from(new Set(kb.documents.flatMap((d) => d.meta?.tags || []))).sort() : [];

    return (
        <div className="h-full flex overflow-hidden">
            {/* Collections Sidebar */}
            <div
                className="w-64 shrink-0 border-r flex flex-col overflow-y-auto"
                style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
            >
                <div className="p-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--color-border)' }}>
                    <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-fg-muted)' }}>Collections</h3>
                    <button onClick={() => setShowNewCollection(true)} className="p-1 rounded cursor-pointer" style={{ color: 'var(--color-fg-muted)' }}>
                        <Plus size={14} />
                    </button>
                </div>

                <button
                    onClick={() => { setActiveCollection(null); setLoading(true); }}
                    className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-colors cursor-pointer w-full"
                    style={{
                        background: !activeCollection ? 'var(--color-primary-soft)' : 'transparent',
                        color: !activeCollection ? 'var(--color-primary-light)' : 'var(--color-fg-soft)',
                    }}
                >
                    <Database size={15} />
                    <span className="flex-1 truncate">All Documents</span>
                    <span className="text-xs opacity-60">{kb?.stats.totalDocuments ?? 0}</span>
                </button>

                {collections.map((col) => (
                    <CollectionItem
                        key={col.id}
                        col={col}
                        active={activeCollection === col.id}
                        onClick={() => { setActiveCollection(col.id); setLoading(true); }}
                        onDelete={col.id !== 'default' ? async () => {
                            await deleteCollection(col.id);
                            if (activeCollection === col.id) setActiveCollection(null);
                            load();
                        } : undefined}
                    />
                ))}

                {/* Tags Section */}
                {allTags.length > 0 && (
                    <>
                        <div className="p-3 border-t mt-auto" style={{ borderColor: 'var(--color-border)' }}>
                            <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-fg-muted)' }}>Tags</h3>
                            <div className="flex flex-wrap gap-1.5">
                                {allTags.map((tag) => (
                                    <button
                                        key={tag}
                                        onClick={() => setTagFilter(tagFilter === tag ? '' : tag)}
                                        className="px-2 py-0.5 rounded-full text-xs cursor-pointer transition-colors"
                                        style={{
                                            background: tagFilter === tag ? 'var(--color-primary-soft)' : 'var(--color-bg-surface)',
                                            color: tagFilter === tag ? 'var(--color-primary-light)' : 'var(--color-fg-muted)',
                                        }}
                                    >
                                        {tag}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-5xl mx-auto">
                    {/* Header Row */}
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <h1 className="text-2xl font-bold" style={{ color: 'var(--color-fg)' }}>Knowledge Base</h1>
                            <p className="text-sm mt-0.5" style={{ color: 'var(--color-fg-muted)' }}>
                                Manage documents, collections & chunks for RAG
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowAnalytics(true)}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border cursor-pointer"
                                style={{ borderColor: 'var(--color-border)', color: 'var(--color-fg-muted)' }}
                            >
                                <BarChart3 size={15} /> Analytics
                            </button>
                            <button
                                onClick={() => setShowUpload(true)}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors cursor-pointer"
                                style={{ background: 'var(--color-primary)' }}
                            >
                                <Plus size={16} /> Add Document
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="mb-4 px-4 py-3 rounded-lg text-sm flex items-center justify-between"
                            style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}
                        >
                            {error}
                            <button onClick={() => setError('')} className="cursor-pointer"><X size={14} /></button>
                        </div>
                    )}

                    {/* Stats Row */}
                    {kb && (
                        <div className="grid grid-cols-4 gap-3 mb-5">
                            <MiniStat label="Documents" value={kb.stats.totalDocuments} color="var(--color-primary)" />
                            <MiniStat label="Enabled" value={kb.stats.totalEnabledDocuments} color="var(--color-success)" />
                            <MiniStat label="Chunks" value={kb.stats.totalChunks} color="var(--color-accent)" />
                            <MiniStat label="Collections" value={kb.stats.totalCollections} color="var(--color-warning)" />
                        </div>
                    )}

                    {/* Search & Filter Bar */}
                    <div
                        className="flex items-center gap-3 mb-4 p-3 rounded-xl border"
                        style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}
                    >
                        <input
                            type="text"
                            value={searchFilter}
                            onChange={(e) => setSearchFilter(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            placeholder="Search documents..."
                            className="flex-1 px-3 py-2 rounded-lg text-sm border outline-none"
                            style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                        />
                        <button onClick={handleSearch} className="px-4 py-2 rounded-lg text-sm font-medium text-white cursor-pointer" style={{ background: 'var(--color-primary)' }}>
                            Search
                        </button>
                    </div>

                    {/* Batch Toolbar */}
                    {selectedDocs.size > 0 && (
                        <div
                            className="flex items-center gap-3 mb-4 p-3 rounded-xl border animate-fade-in"
                            style={{ background: 'var(--color-primary-soft)', borderColor: 'var(--color-primary)' }}
                        >
                            <span className="text-sm font-medium" style={{ color: 'var(--color-primary-light)' }}>
                                {selectedDocs.size} selected
                            </span>
                            <div className="flex-1" />
                            <button onClick={() => handleBatchEnable(true)} className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                                style={{ background: 'var(--color-bg)', color: 'var(--color-success)' }}>Enable</button>
                            <button onClick={() => handleBatchEnable(false)} className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                                style={{ background: 'var(--color-bg)', color: 'var(--color-warning)' }}>Disable</button>
                            {collections.length > 1 && (
                                <select
                                    onChange={(e) => e.target.value && handleBatchMove(e.target.value)}
                                    className="px-3 py-1.5 rounded-lg text-xs border outline-none cursor-pointer"
                                    style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                                    defaultValue=""
                                >
                                    <option value="" disabled>Move to...</option>
                                    {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            )}
                            <button onClick={handleBatchDelete} className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                                style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>Delete</button>
                            <button onClick={() => setSelectedDocs(new Set())} className="p-1 cursor-pointer" style={{ color: 'var(--color-fg-muted)' }}>
                                <X size={14} />
                            </button>
                        </div>
                    )}

                    {/* Document List */}
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
                        </div>
                    ) : kb?.documents.length === 0 ? (
                        <EmptyKB onUpload={() => setShowUpload(true)} />
                    ) : (
                        <>
                            <div className="flex items-center gap-2 mb-3">
                                <button onClick={selectAll} className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: 'var(--color-fg-muted)' }}>
                                    {selectedDocs.size === kb?.documents.length ? <CheckSquare size={14} /> : <Square size={14} />}
                                    Select all
                                </button>
                                <span className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                                    {kb?.documents.length} document{(kb?.documents.length ?? 0) !== 1 ? 's' : ''}
                                </span>
                            </div>
                            <div className="space-y-2">
                                {kb?.documents.map((doc) => (
                                    <DocumentCard
                                        key={doc.id}
                                        doc={doc}
                                        selected={selectedDocs.has(doc.id)}
                                        onSelect={() => toggleSelect(doc.id)}
                                        onDelete={() => handleDelete(doc.id)}
                                        onToggleEnabled={() => handleToggleEnabled(doc.id, doc.meta?.enabled)}
                                        onReindex={() => handleReindex(doc.id)}
                                        onView={() => navigate(`/knowledge/${doc.id}`)}
                                        collections={collections}
                                        onReload={load}
                                    />
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Modals */}
            {showUpload && (
                <UploadModal
                    collections={collections}
                    onClose={() => setShowUpload(false)}
                    onSuccess={() => { setShowUpload(false); load(); }}
                />
            )}
            {showNewCollection && (
                <NewCollectionModal
                    onClose={() => setShowNewCollection(false)}
                    onSuccess={() => { setShowNewCollection(false); load(); }}
                />
            )}
            {showAnalytics && (
                <AnalyticsModal onClose={() => setShowAnalytics(false)} />
            )}
        </div>
    );
}

// ─── Sub-components ────────────────────────────────────────

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div className="p-3 rounded-xl border" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
            <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>{label}</p>
            <p className="text-lg font-bold" style={{ color }}>{value}</p>
        </div>
    );
}

function CollectionItem({ col, active, onClick, onDelete }: {
    col: Collection; active: boolean; onClick: () => void; onDelete?: () => void;
}) {
    return (
        <div
            className="flex items-center gap-2.5 px-3 py-2.5 text-sm cursor-pointer transition-colors group"
            style={{
                background: active ? 'var(--color-primary-soft)' : 'transparent',
                color: active ? 'var(--color-primary-light)' : 'var(--color-fg-soft)',
            }}
            onClick={onClick}
        >
            <div className="w-3 h-3 rounded-full shrink-0" style={{ background: col.color }} />
            <span className="flex-1 truncate">{col.name}</span>
            <span className="text-xs opacity-60">{col.documentCount}</span>
            {onDelete && (
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded cursor-pointer"
                    style={{ color: 'var(--color-destructive)' }}
                >
                    <X size={12} />
                </button>
            )}
        </div>
    );
}

function DocumentCard({ doc, selected, onSelect, onDelete, onToggleEnabled, onReindex, onView, collections, onReload }: {
    doc: DocInfo;
    selected: boolean;
    onSelect: () => void;
    onDelete: () => void;
    onToggleEnabled: () => void;
    onReindex: () => void;
    onView: () => void;
    collections: Collection[];
    onReload: () => void;
}) {
    const [showMenu, setShowMenu] = useState(false);
    const [showTagEdit, setShowTagEdit] = useState(false);
    const meta = doc.meta;
    const col = collections.find((c) => c.id === meta?.collectionId);
    const isEnabled = meta?.enabled !== false;

    return (
        <div
            className="rounded-xl border overflow-hidden animate-fade-in transition-all"
            style={{
                background: 'var(--color-bg-surface)',
                borderColor: selected ? 'var(--color-primary)' : 'var(--color-border)',
                opacity: isEnabled ? 1 : 0.55,
            }}
        >
            <div className="flex items-center gap-3 px-4 py-3">
                {/* Checkbox */}
                <button onClick={onSelect} className="shrink-0 cursor-pointer" style={{ color: selected ? 'var(--color-primary)' : 'var(--color-fg-muted)' }}>
                    {selected ? <CheckSquare size={16} /> : <Square size={16} />}
                </button>

                {/* Icon */}
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--color-primary-soft)' }}>
                    {doc.source.startsWith('http') ? <Globe size={18} style={{ color: 'var(--color-primary)' }} /> : <FileText size={18} style={{ color: 'var(--color-primary)' }} />}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h4 className="text-sm font-medium truncate cursor-pointer hover:underline" style={{ color: 'var(--color-fg)' }} onClick={onView}>
                            {doc.title}
                        </h4>
                        {/* Status badge */}
                        <StatusBadge status={meta?.processingStatus || 'completed'} />
                        {!isEnabled && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                                Disabled
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <span className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>{doc.chunkCount} chunks</span>
                        <span className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>{meta?.wordCount ?? '?'} words</span>
                        {col && (
                            <span className="flex items-center gap-1 text-xs">
                                <span className="w-2 h-2 rounded-full inline-block" style={{ background: col.color }} />
                                <span style={{ color: 'var(--color-fg-muted)' }}>{col.name}</span>
                            </span>
                        )}
                        <span className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>{new Date(doc.createdAt).toLocaleDateString()}</span>
                    </div>
                    {/* Tags */}
                    {meta?.tags?.length > 0 && (
                        <div className="flex items-center gap-1 mt-1.5">
                            <Tag size={11} style={{ color: 'var(--color-fg-muted)' }} />
                            {meta.tags.map((t) => (
                                <span key={t} className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary-light)' }}>
                                    {t}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                    <button onClick={onToggleEnabled} className="p-1.5 rounded-lg cursor-pointer" title={isEnabled ? 'Disable' : 'Enable'}
                        style={{ color: isEnabled ? 'var(--color-success)' : 'var(--color-fg-muted)' }}>
                        {isEnabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                    </button>
                    <button onClick={onView} className="p-1.5 rounded-lg cursor-pointer" style={{ color: 'var(--color-fg-muted)' }} title="View details">
                        <Eye size={16} />
                    </button>
                    <div className="relative">
                        <button onClick={() => setShowMenu(!showMenu)} className="p-1.5 rounded-lg cursor-pointer" style={{ color: 'var(--color-fg-muted)' }}>
                            <MoreHorizontal size={16} />
                        </button>
                        {showMenu && (
                            <div
                                className="absolute right-0 top-8 w-44 py-1 rounded-lg border shadow-lg z-20"
                                style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}
                            >
                                <MenuBtn onClick={() => { setShowMenu(false); onReindex(); }}>
                                    <RefreshCw size={13} /> Re-index
                                </MenuBtn>
                                <MenuBtn onClick={() => { setShowMenu(false); setShowTagEdit(true); }}>
                                    <Tag size={13} /> Edit Tags
                                </MenuBtn>
                                <MenuBtn onClick={() => { setShowMenu(false); onDelete(); }} destructive>
                                    <Trash2 size={13} /> Delete
                                </MenuBtn>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {showTagEdit && (
                <TagEditor
                    docId={doc.id}
                    currentTags={meta?.tags || []}
                    onClose={() => setShowTagEdit(false)}
                    onSaved={() => { setShowTagEdit(false); onReload(); }}
                />
            )}
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const cfg: Record<string, { bg: string; fg: string; label: string }> = {
        completed: { bg: 'rgba(34,197,94,0.12)', fg: '#22c55e', label: 'Indexed' },
        processing: { bg: 'rgba(59,130,246,0.12)', fg: '#3b82f6', label: 'Processing' },
        error: { bg: 'rgba(239,68,68,0.12)', fg: '#ef4444', label: 'Error' },
        pending: { bg: 'rgba(234,179,8,0.12)', fg: '#eab308', label: 'Pending' },
    };
    const c = cfg[status] || cfg.completed;
    return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: c.bg, color: c.fg }}>{c.label}</span>;
}

function MenuBtn({ onClick, children, destructive }: { onClick: () => void; children: React.ReactNode; destructive?: boolean }) {
    return (
        <button
            onClick={onClick}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs cursor-pointer transition-colors hover:opacity-80"
            style={{ color: destructive ? '#ef4444' : 'var(--color-fg-soft)' }}
        >
            {children}
        </button>
    );
}

function TagEditor({ docId, currentTags, onClose, onSaved }: {
    docId: string; currentTags: string[]; onClose: () => void; onSaved: () => void;
}) {
    const [tags, setTags] = useState(currentTags.join(', '));
    const [saving, setSaving] = useState(false);

    const save = async () => {
        setSaving(true);
        try {
            await updateDocument(docId, { tags: tags.split(',').map((t) => t.trim()).filter(Boolean) });
            onSaved();
        } catch { /* ignore */ }
        setSaving(false);
    };

    return (
        <div className="px-4 py-3 border-t flex items-center gap-2" style={{ borderColor: 'var(--color-border)' }}>
            <Tag size={13} style={{ color: 'var(--color-fg-muted)' }} />
            <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="tag1, tag2, tag3..."
                className="flex-1 px-2 py-1 rounded text-xs border outline-none"
                style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                autoFocus
            />
            <button onClick={save} disabled={saving} className="px-2 py-1 rounded text-xs font-medium text-white cursor-pointer" style={{ background: 'var(--color-primary)' }}>
                {saving ? '...' : 'Save'}
            </button>
            <button onClick={onClose} className="px-2 py-1 rounded text-xs cursor-pointer" style={{ color: 'var(--color-fg-muted)' }}>Cancel</button>
        </div>
    );
}

function EmptyKB({ onUpload }: { onUpload: () => void }) {
    return (
        <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'var(--color-primary-soft)' }}>
                <Database size={32} style={{ color: 'var(--color-primary)' }} />
            </div>
            <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--color-fg)' }}>No Documents Yet</h3>
            <p className="text-sm mb-4 text-center max-w-xs" style={{ color: 'var(--color-fg-muted)' }}>
                Upload documents to build your knowledge base. Supports text, files, and web URLs.
            </p>
            <button onClick={onUpload} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white cursor-pointer" style={{ background: 'var(--color-primary)' }}>
                <Upload size={16} /> Upload First Document
            </button>
        </div>
    );
}

// ─── Upload Modal (Enhanced) ──────────────────────────────

function UploadModal({ collections, onClose, onSuccess }: {
    collections: Collection[];
    onClose: () => void;
    onSuccess: () => void;
}) {
    const [mode, setMode] = useState<'text' | 'file' | 'url' | 'crawl'>('text');
    const [title, setTitle] = useState('');
    const [text, setText] = useState('');
    const [url, setUrl] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [tags, setTags] = useState('');
    const [collectionId, setCollectionId] = useState('default');
    const [chunkSize, setChunkSize] = useState(512);
    const [chunkOverlap, setChunkOverlap] = useState(50);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [crawlResult, setCrawlResult] = useState<{ ingested: number; pages: number; errors: string[] } | null>(null);
    const [crawlMaxPages, setCrawlMaxPages] = useState(20);
    const [crawlMaxDepth, setCrawlMaxDepth] = useState(2);
    const [crawlSameDomain, setCrawlSameDomain] = useState(true);
    const fileRef = useRef<HTMLInputElement>(null);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setUploading(true);
        setError('');
        const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean);
        const opts = {
            tags: tagList.length ? tagList : undefined,
            collectionId: collectionId || undefined,
            chunkSize: showAdvanced ? chunkSize : undefined,
            chunkOverlap: showAdvanced ? chunkOverlap : undefined,
        };
        try {
            if (mode === 'text') {
                if (!text.trim()) throw new Error('Text is required');
                await uploadDocument(text, title || 'Untitled', opts);
            } else if (mode === 'file') {
                if (!file) throw new Error('File is required');
                await uploadDocumentFile(file, { title: title || file.name, ...opts });
            } else if (mode === 'url') {
                if (!url.trim()) throw new Error('URL is required');
                await importUrl(url, { title: title || undefined, ...opts });
            } else if (mode === 'crawl') {
                if (!url.trim()) throw new Error('URL is required');
                const result = await crawlWebsite(url, {
                    maxPages: crawlMaxPages,
                    maxDepth: crawlMaxDepth,
                    sameDomain: crawlSameDomain,
                    tags: tagList.length ? tagList : undefined,
                    collectionId: collectionId || undefined,
                    chunkSize: showAdvanced ? chunkSize : undefined,
                    chunkOverlap: showAdvanced ? chunkOverlap : undefined,
                });
                setCrawlResult({ ingested: result.ingested, pages: result.pages?.length ?? 0, errors: result.errors ?? [] });
                return;
            }
            onSuccess();
        } catch (err: any) {
            setError(err.message || 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="w-full max-w-lg mx-4 rounded-2xl border animate-slide-up max-h-[90vh] overflow-y-auto"
                style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--color-fg)' }}>Add Document</h3>
                    <button onClick={onClose} className="p-1 rounded-lg cursor-pointer" style={{ color: 'var(--color-fg-muted)' }}>
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    {/* Mode toggle */}
                    <div className="flex gap-2 flex-wrap">
                        <TabBtn active={mode === 'text'} onClick={() => setMode('text')}>Paste Text</TabBtn>
                        <TabBtn active={mode === 'file'} onClick={() => setMode('file')}>Upload File</TabBtn>
                        <TabBtn active={mode === 'url'} onClick={() => setMode('url')}>Web URL</TabBtn>
                        <TabBtn active={mode === 'crawl'} onClick={() => setMode('crawl')}>Crawl Site</TabBtn>
                    </div>

                    {/* Title */}
                    <InputField label="Title" value={title} onChange={setTitle} placeholder="Document title..." />

                    {/* Collection Select */}
                    <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-fg-muted)' }}>Collection</label>
                        <select
                            value={collectionId}
                            onChange={(e) => setCollectionId(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                            style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                        >
                            {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>

                    {/* Tags */}
                    <InputField label="Tags (comma-separated)" value={tags} onChange={setTags} placeholder="medical, guidelines, 2024..." />

                    {/* Content */}
                    {mode === 'text' ? (
                        <div>
                            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-fg-muted)' }}>Content</label>
                            <textarea
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                placeholder="Paste your document content here..."
                                rows={6}
                                className="w-full px-3 py-2 rounded-lg text-sm border outline-none resize-none"
                                style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                            />
                        </div>
                    ) : mode === 'file' ? (
                        <div
                            className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors"
                            style={{ borderColor: file ? 'var(--color-primary)' : 'var(--color-border)' }}
                            onClick={() => fileRef.current?.click()}
                        >
                            <input ref={fileRef} type="file" accept=".txt,.md,.csv,.json,.html" className="hidden"
                                onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                            <FileUp size={28} className="mx-auto mb-2" style={{ color: 'var(--color-fg-muted)' }} />
                            {file ? (
                                <p className="text-sm" style={{ color: 'var(--color-fg)' }}>{file.name} ({Math.round(file.size / 1024)} KB)</p>
                            ) : (
                                <>
                                    <p className="text-sm" style={{ color: 'var(--color-fg-muted)' }}>Click to upload</p>
                                    <p className="text-xs mt-1" style={{ color: 'var(--color-fg-muted)' }}>.txt, .md, .csv, .json, .html</p>
                                </>
                            )}
                        </div>
                    ) : mode === 'url' ? (
                        <div>
                            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-fg-muted)' }}>URL</label>
                            <div className="flex items-center gap-2">
                                <Globe size={16} style={{ color: 'var(--color-fg-muted)' }} />
                                <input
                                    type="url"
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    placeholder="https://example.com/article..."
                                    className="flex-1 px-3 py-2 rounded-lg text-sm border outline-none"
                                    style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                                />
                            </div>
                        </div>
                    ) : mode === 'crawl' ? (
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-fg-muted)' }}>Start URL</label>
                                <div className="flex items-center gap-2">
                                    <Globe size={16} style={{ color: 'var(--color-fg-muted)' }} />
                                    <input
                                        type="url"
                                        value={url}
                                        onChange={(e) => setUrl(e.target.value)}
                                        placeholder="https://example.com — will crawl linked pages"
                                        className="flex-1 px-3 py-2 rounded-lg text-sm border outline-none"
                                        style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs mb-1" style={{ color: 'var(--color-fg-muted)' }}>Max Pages</label>
                                    <input type="number" value={crawlMaxPages} onChange={(e) => setCrawlMaxPages(Number(e.target.value))} min={1} max={100}
                                        className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                                        style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }} />
                                </div>
                                <div>
                                    <label className="block text-xs mb-1" style={{ color: 'var(--color-fg-muted)' }}>Max Depth</label>
                                    <input type="number" value={crawlMaxDepth} onChange={(e) => setCrawlMaxDepth(Number(e.target.value))} min={1} max={5}
                                        className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                                        style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }} />
                                </div>
                                <div className="flex items-end pb-1">
                                    <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--color-fg-muted)' }}>
                                        <input type="checkbox" checked={crawlSameDomain} onChange={(e) => setCrawlSameDomain(e.target.checked)} />
                                        Same domain only
                                    </label>
                                </div>
                            </div>
                            {crawlResult && (
                                <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>
                                    Crawled {crawlResult.pages} pages, ingested {crawlResult.ingested} documents.
                                    {crawlResult.errors.length > 0 && (
                                        <span className="block mt-1" style={{ color: '#eab308' }}>
                                            {crawlResult.errors.length} error(s): {crawlResult.errors.slice(0, 3).join(', ')}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : null}

                    {/* Advanced Chunking Options */}
                    <div>
                        <button type="button" onClick={() => setShowAdvanced(!showAdvanced)}
                            className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: 'var(--color-fg-muted)' }}>
                            <Settings2 size={12} />
                            Chunking Settings
                            <ChevronDown size={12} style={{ transform: showAdvanced ? 'rotate(180deg)' : 'none', transition: '0.15s' }} />
                        </button>
                        {showAdvanced && (
                            <div className="mt-2 grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs mb-1" style={{ color: 'var(--color-fg-muted)' }}>Chunk Size</label>
                                    <input type="number" value={chunkSize} onChange={(e) => setChunkSize(Number(e.target.value))} min={100} max={4000} step={50}
                                        className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                                        style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }} />
                                </div>
                                <div>
                                    <label className="block text-xs mb-1" style={{ color: 'var(--color-fg-muted)' }}>Chunk Overlap</label>
                                    <input type="number" value={chunkOverlap} onChange={(e) => setChunkOverlap(Number(e.target.value))} min={0} max={500} step={10}
                                        className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                                        style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }} />
                                </div>
                            </div>
                        )}
                    </div>

                    {error && (
                        <p className="text-sm px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>{error}</p>
                    )}

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-medium border cursor-pointer"
                            style={{ borderColor: 'var(--color-border)', color: 'var(--color-fg-muted)' }}>Cancel</button>
                        <button type="submit" disabled={uploading} className="flex-1 py-2.5 rounded-lg text-sm font-medium text-white cursor-pointer disabled:opacity-50"
                            style={{ background: 'var(--color-primary)' }}>
                            {uploading ? <Loader2 size={16} className="animate-spin mx-auto" /> : mode === 'crawl' ? 'Crawl & Index' : 'Upload & Index'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function NewCollectionModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [color, setColor] = useState('#6366f1');
    const [saving, setSaving] = useState(false);

    const colors = ['#6366f1', '#3b82f6', '#22c55e', '#eab308', '#ef4444', '#ec4899', '#f97316', '#14b8a6'];

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        setSaving(true);
        try { await createCollection(name, description, color); onSuccess(); }
        catch { /* ignore */ }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <form onSubmit={handleSubmit} className="w-full max-w-sm mx-4 rounded-2xl border p-5 space-y-4"
                style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--color-fg)' }}>New Collection</h3>
                <InputField label="Name" value={name} onChange={setName} placeholder="Collection name..." />
                <InputField label="Description" value={description} onChange={setDescription} placeholder="Optional description..." />
                <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-fg-muted)' }}>Color</label>
                    <div className="flex gap-2">
                        {colors.map((c) => (
                            <button key={c} type="button" onClick={() => setColor(c)}
                                className="w-7 h-7 rounded-full cursor-pointer transition-transform"
                                style={{ background: c, outline: color === c ? '2px solid var(--color-fg)' : 'none', outlineOffset: '2px', transform: color === c ? 'scale(1.15)' : 'scale(1)' }}
                            />
                        ))}
                    </div>
                </div>
                <div className="flex gap-3">
                    <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg text-sm border cursor-pointer"
                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-fg-muted)' }}>Cancel</button>
                    <button type="submit" disabled={saving || !name.trim()} className="flex-1 py-2 rounded-lg text-sm font-medium text-white cursor-pointer disabled:opacity-50"
                        style={{ background: 'var(--color-primary)' }}>
                        {saving ? '...' : 'Create'}
                    </button>
                </div>
            </form>
        </div>
    );
}

function AnalyticsModal({ onClose }: { onClose: () => void }) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getAnalytics().then(setData).catch(() => { }).finally(() => setLoading(false));
    }, []);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="w-full max-w-lg mx-4 rounded-2xl border max-h-[85vh] overflow-y-auto"
                style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
                    <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--color-fg)' }}>
                        <BarChart3 size={16} /> Knowledge Base Analytics
                    </h3>
                    <button onClick={onClose} className="p-1 cursor-pointer" style={{ color: 'var(--color-fg-muted)' }}><X size={18} /></button>
                </div>
                <div className="p-5 space-y-4">
                    {loading ? (
                        <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin" style={{ color: 'var(--color-primary)' }} /></div>
                    ) : data ? (
                        <>
                            <div className="grid grid-cols-3 gap-3">
                                <MiniStat label="Total Queries" value={data.totalQueries} color="var(--color-primary)" />
                                <MiniStat label="Avg Results" value={data.avgResultCount} color="var(--color-accent)" />
                                <MiniStat label="Avg Score" value={Math.round(data.avgScore * 100)} color="var(--color-success)" />
                            </div>

                            {data.topQueries?.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-semibold mb-2 uppercase" style={{ color: 'var(--color-fg-muted)' }}>Top Queries</h4>
                                    <div className="space-y-1">
                                        {data.topQueries.slice(0, 5).map((q: any, i: number) => (
                                            <div key={i} className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg" style={{ background: 'var(--color-bg)' }}>
                                                <span className="flex-1 truncate" style={{ color: 'var(--color-fg-soft)' }}>{q.query}</span>
                                                <span style={{ color: 'var(--color-fg-muted)' }}>{q.count}x</span>
                                                <span style={{ color: 'var(--color-success)' }}>{Math.round(q.avgScore * 100)}%</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {data.chunkSizeDistribution && (
                                <div>
                                    <h4 className="text-xs font-semibold mb-2 uppercase" style={{ color: 'var(--color-fg-muted)' }}>Chunk Stats</h4>
                                    <div className="grid grid-cols-4 gap-2 text-xs">
                                        <div className="px-3 py-2 rounded-lg text-center" style={{ background: 'var(--color-bg)' }}>
                                            <p style={{ color: 'var(--color-fg-muted)' }}>Min</p>
                                            <p className="font-mono font-bold" style={{ color: 'var(--color-fg)' }}>{data.chunkSizeDistribution.min}</p>
                                        </div>
                                        <div className="px-3 py-2 rounded-lg text-center" style={{ background: 'var(--color-bg)' }}>
                                            <p style={{ color: 'var(--color-fg-muted)' }}>Max</p>
                                            <p className="font-mono font-bold" style={{ color: 'var(--color-fg)' }}>{data.chunkSizeDistribution.max}</p>
                                        </div>
                                        <div className="px-3 py-2 rounded-lg text-center" style={{ background: 'var(--color-bg)' }}>
                                            <p style={{ color: 'var(--color-fg-muted)' }}>Avg</p>
                                            <p className="font-mono font-bold" style={{ color: 'var(--color-fg)' }}>{data.chunkSizeDistribution.avg}</p>
                                        </div>
                                        <div className="px-3 py-2 rounded-lg text-center" style={{ background: 'var(--color-bg)' }}>
                                            <p style={{ color: 'var(--color-fg-muted)' }}>Median</p>
                                            <p className="font-mono font-bold" style={{ color: 'var(--color-fg)' }}>{data.chunkSizeDistribution.median}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {Object.keys(data.documentsByCollection || {}).length > 0 && (
                                <div>
                                    <h4 className="text-xs font-semibold mb-2 uppercase" style={{ color: 'var(--color-fg-muted)' }}>By Collection</h4>
                                    <div className="space-y-1">
                                        {Object.entries(data.documentsByCollection).map(([name, count]) => (
                                            <div key={name} className="flex items-center justify-between text-xs px-3 py-2 rounded-lg" style={{ background: 'var(--color-bg)' }}>
                                                <span style={{ color: 'var(--color-fg-soft)' }}>{name}</span>
                                                <span className="font-mono" style={{ color: 'var(--color-fg-muted)' }}>{count as number}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <p className="text-sm text-center" style={{ color: 'var(--color-fg-muted)' }}>No analytics data</p>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Utilities ─────────────────────────────────────────────

function InputField({ label, value, onChange, placeholder }: {
    label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
    return (
        <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-fg-muted)' }}>{label}</label>
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
            />
        </div>
    );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
            style={{
                background: active ? 'var(--color-primary-soft)' : 'var(--color-bg)',
                color: active ? 'var(--color-primary-light)' : 'var(--color-fg-muted)',
            }}
        >
            {children}
        </button>
    );
}
