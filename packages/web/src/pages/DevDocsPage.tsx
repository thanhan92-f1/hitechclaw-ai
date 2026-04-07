import { useState, useEffect, useCallback } from 'react';
import {
    BookOpen,
    Search,
    Plus,
    Trash2,
    Edit3,
    FolderOpen,
    Tag,
    FileText,
    X,
    Loader2,
    Save,
    Eye,
    ChevronDown,
    BarChart3,
    History,
    type LucideIcon,
} from 'lucide-react';
import {
    getDevDocs,
    getDevDocCategories,
    getDevDoc,
    createDevDoc,
    updateDevDoc,
    deleteDevDoc,
    searchDevDocs,
    getDocVersionHistory,
    getDocVersionContent,
    type DevDocSummary,
    type DevDocFull,
    type DevDocCategory,
    type DevDocStats,
    type DevDocSearchResult,
    type DevDocVersion,
} from '../lib/api';

// ─── Category icon mapping ──────────────────────────────────

const CATEGORY_ICONS: Record<string, string> = {
    conventions: '📏',
    architecture: '🏗️',
    guides: '📖',
    api: '🔌',
    troubleshooting: '🔧',
    examples: '💡',
    root: '📄',
};

// ─── Main Page ──────────────────────────────────────────────

export function DevDocsPage() {
    const [documents, setDocuments] = useState<DevDocSummary[]>([]);
    const [categories, setCategories] = useState<DevDocCategory[]>([]);
    const [stats, setStats] = useState<DevDocStats | null>(null);
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<DevDocSearchResult[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Modal states
    const [showCreate, setShowCreate] = useState(false);
    const [viewDoc, setViewDoc] = useState<DevDocFull | null>(null);
    const [editDoc, setEditDoc] = useState<DevDocFull | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [versionHistoryDocId, setVersionHistoryDocId] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError('');
            const [docsRes, catsRes] = await Promise.all([
                getDevDocs(activeCategory ? { category: activeCategory } : undefined),
                getDevDocCategories(),
            ]);
            setDocuments(docsRes.documents);
            setStats(docsRes.stats);
            setCategories(catsRes.categories);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load');
        } finally {
            setLoading(false);
        }
    }, [activeCategory]);

    useEffect(() => { load(); }, [load]);

    const handleSearch = async () => {
        if (!searchQuery.trim()) {
            setSearchResults(null);
            return;
        }
        try {
            const res = await searchDevDocs(searchQuery.trim());
            setSearchResults(res.results);
        } catch {
            setError('Search failed');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteDevDoc(id);
            setDeleteConfirm(null);
            load();
        } catch {
            setError('Delete failed');
        }
    };

    const openView = async (id: string) => {
        try {
            const res = await getDevDoc(id);
            setViewDoc(res.document);
        } catch {
            setError('Failed to load document');
        }
    };

    const openEdit = async (id: string) => {
        try {
            const res = await getDevDoc(id);
            setEditDoc(res.document);
        } catch {
            setError('Failed to load document');
        }
    };

    const displayDocs = searchResults
        ? searchResults.map(r => ({
            id: r.id,
            title: r.title,
            category: r.category,
            tags: r.tags,
            filePath: '',
            wordCount: r.wordCount,
            updatedAt: '',
            version: '',
            score: r.score,
            snippet: r.snippet,
        }))
        : documents;

    return (
        <div className="h-full flex flex-col overflow-hidden" style={{ color: 'var(--color-fg)' }}>
            {/* Header */}
            <div className="shrink-0 px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <BookOpen size={24} style={{ color: 'var(--color-primary)' }} />
                        <div>
                            <h1 className="text-xl font-bold" style={{ color: 'var(--color-fg)' }}>
                                Dev Docs Knowledge Base
                            </h1>
                            <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                                Kho tài liệu dùng chung — AI code assistants tự động truy vấn qua MCP
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {stats && (
                            <div className="flex items-center gap-3 mr-4 text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                                <span className="flex items-center gap-1"><FileText size={13} /> {stats.totalDocs} docs</span>
                                <span className="flex items-center gap-1"><FolderOpen size={13} /> {stats.categories.length} categories</span>
                                <span className="flex items-center gap-1"><BarChart3 size={13} /> {stats.totalWords.toLocaleString()} words</span>
                            </div>
                        )}
                        <button
                            onClick={() => setShowCreate(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                            style={{ background: 'var(--color-primary)', color: '#fff' }}
                        >
                            <Plus size={15} /> Tạo mới
                        </button>
                    </div>
                </div>

                {/* Search */}
                <div className="flex gap-2">
                    <div className="flex-1 relative">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-fg-muted)' }} />
                        <input
                            value={searchQuery}
                            onChange={e => { setSearchQuery(e.target.value); if (!e.target.value) setSearchResults(null); }}
                            onKeyDown={e => e.key === 'Enter' && handleSearch()}
                            placeholder="Tìm kiếm tài liệu... (Enter)"
                            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none"
                            style={{
                                background: 'var(--color-bg-soft)',
                                border: '1px solid var(--color-border)',
                                color: 'var(--color-fg)',
                            }}
                        />
                    </div>
                    {searchResults && (
                        <button
                            onClick={() => { setSearchQuery(''); setSearchResults(null); }}
                            className="px-3 py-2 rounded-lg text-xs cursor-pointer"
                            style={{ background: 'var(--color-bg-soft)', color: 'var(--color-fg-muted)' }}
                        >
                            Xoá lọc
                        </button>
                    )}
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 flex overflow-hidden">
                {/* Category sidebar */}
                <div className="w-52 shrink-0 border-r overflow-y-auto py-3 px-2" style={{ borderColor: 'var(--color-border)' }}>
                    <div className="text-[10px] font-semibold uppercase tracking-wider mb-2 px-2" style={{ color: 'var(--color-fg-muted)' }}>
                        Categories
                    </div>
                    <button
                        onClick={() => setActiveCategory(null)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer mb-0.5"
                        style={{
                            background: activeCategory === null ? 'var(--color-primary-soft)' : 'transparent',
                            color: activeCategory === null ? 'var(--color-primary-light)' : 'var(--color-fg-muted)',
                        }}
                    >
                        <FolderOpen size={14} />
                        <span className="flex-1 text-left">Tất cả</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--color-bg-soft)' }}>
                            {stats?.totalDocs ?? 0}
                        </span>
                    </button>
                    {categories.map(cat => (
                        <button
                            key={cat.name}
                            onClick={() => setActiveCategory(cat.name)}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer mb-0.5"
                            style={{
                                background: activeCategory === cat.name ? 'var(--color-primary-soft)' : 'transparent',
                                color: activeCategory === cat.name ? 'var(--color-primary-light)' : 'var(--color-fg-muted)',
                            }}
                        >
                            <span>{CATEGORY_ICONS[cat.name] ?? '📁'}</span>
                            <span className="flex-1 text-left truncate">{cat.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--color-bg-soft)' }}>
                                {cat.docCount}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Document list */}
                <div className="flex-1 overflow-y-auto p-4">
                    {error && (
                        <div className="mb-4 px-4 py-2 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
                            {error}
                        </div>
                    )}

                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
                        </div>
                    ) : displayDocs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20" style={{ color: 'var(--color-fg-muted)' }}>
                            <BookOpen size={48} className="mb-4 opacity-30" />
                            <p className="text-sm">Không có tài liệu nào</p>
                            <p className="text-xs mt-1">Nhấn "Tạo mới" để thêm tài liệu đầu tiên</p>
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {searchResults && (
                                <div className="text-xs mb-1" style={{ color: 'var(--color-fg-muted)' }}>
                                    {searchResults.length} kết quả cho "{searchQuery}"
                                </div>
                            )}
                            {displayDocs.map(doc => (
                                <DocCard
                                    key={doc.id}
                                    doc={doc}
                                    onView={() => openView(doc.id)}
                                    onEdit={() => openEdit(doc.id)}
                                    onDelete={() => setDeleteConfirm(doc.id)}
                                    onHistory={() => setVersionHistoryDocId(doc.id)}
                                    isSearchResult={'score' in doc}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
            {showCreate && (
                <CreateDocModal
                    categories={categories.map(c => c.name)}
                    onClose={() => setShowCreate(false)}
                    onCreated={() => { setShowCreate(false); load(); }}
                />
            )}

            {viewDoc && (
                <ViewDocModal
                    doc={viewDoc}
                    onClose={() => setViewDoc(null)}
                    onEdit={() => { setEditDoc(viewDoc); setViewDoc(null); }}
                />
            )}

            {editDoc && (
                <EditDocModal
                    doc={editDoc}
                    onClose={() => setEditDoc(null)}
                    onSaved={() => { setEditDoc(null); load(); }}
                />
            )}

            {deleteConfirm && (
                <ConfirmDeleteModal
                    docId={deleteConfirm}
                    onClose={() => setDeleteConfirm(null)}
                    onConfirm={() => handleDelete(deleteConfirm)}
                />
            )}

            {versionHistoryDocId && (
                <VersionHistoryModal
                    docId={versionHistoryDocId}
                    onClose={() => setVersionHistoryDocId(null)}
                />
            )}
        </div>
    );
}

// ─── Doc Card ───────────────────────────────────────────────

function DocCard({ doc, onView, onEdit, onDelete, onHistory, isSearchResult }: {
    doc: DevDocSummary & { score?: number; snippet?: string };
    onView: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onHistory: () => void;
    isSearchResult: boolean;
}) {
    return (
        <div
            className="flex items-start gap-4 p-4 rounded-xl border transition-all hover:shadow-sm cursor-pointer"
            style={{
                background: 'var(--color-bg-soft)',
                borderColor: 'var(--color-border)',
            }}
            onClick={onView}
        >
            <div className="text-2xl shrink-0 mt-0.5">
                {CATEGORY_ICONS[doc.category] ?? '📄'}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold truncate" style={{ color: 'var(--color-fg)' }}>
                        {doc.title}
                    </h3>
                    {doc.version && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0"
                            style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80' }}>
                            v{doc.version}
                        </span>
                    )}
                    {isSearchResult && doc.score && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                            style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8' }}>
                            score: {doc.score}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3 text-[11px] mb-1.5" style={{ color: 'var(--color-fg-muted)' }}>
                    <span className="flex items-center gap-1"><FolderOpen size={11} /> {doc.category}</span>
                    <span>{doc.wordCount} words</span>
                    {doc.updatedAt && <span>{new Date(doc.updatedAt).toLocaleDateString()}</span>}
                </div>
                {doc.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {doc.tags.map(tag => (
                            <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full"
                                style={{ background: 'var(--color-bg)', color: 'var(--color-fg-muted)', border: '1px solid var(--color-border)' }}>
                                {tag}
                            </span>
                        ))}
                    </div>
                )}
                {isSearchResult && doc.snippet && (
                    <p className="text-xs mt-2 leading-relaxed line-clamp-2" style={{ color: 'var(--color-fg-muted)' }}>
                        {doc.snippet}
                    </p>
                )}
            </div>
            <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                <IconButton icon={Eye} title="Xem" onClick={onView} />
                <IconButton icon={History} title="Lịch sử" onClick={onHistory} />
                <IconButton icon={Edit3} title="Sửa" onClick={onEdit} />
                <IconButton icon={Trash2} title="Xoá" onClick={onDelete} danger />
            </div>
        </div>
    );
}

// ─── Icon Button ────────────────────────────────────────────

function IconButton({ icon: Icon, title, onClick, danger }: {
    icon: LucideIcon; title: string; onClick: () => void; danger?: boolean;
}) {
    return (
        <button
            onClick={onClick}
            title={title}
            className="p-1.5 rounded-lg transition-colors cursor-pointer"
            style={{
                color: danger ? '#f87171' : 'var(--color-fg-muted)',
                background: 'transparent',
            }}
            onMouseEnter={e => { (e.target as HTMLElement).style.background = 'var(--color-bg)'; }}
            onMouseLeave={e => { (e.target as HTMLElement).style.background = 'transparent'; }}
        >
            <Icon size={14} />
        </button>
    );
}

// ─── Create Doc Modal ───────────────────────────────────────

function CreateDocModal({ categories, onClose, onCreated }: {
    categories: string[];
    onClose: () => void;
    onCreated: () => void;
}) {
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState(categories[0] ?? 'guides');
    const [customCategory, setCustomCategory] = useState('');
    const [tags, setTags] = useState('');
    const [content, setContent] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSave = async () => {
        if (!title.trim() || !content.trim()) {
            setError('Tiêu đề và nội dung là bắt buộc');
            return;
        }
        try {
            setSaving(true);
            const cat = customCategory.trim() || category;
            const filename = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            await createDevDoc({
                path: `${cat}/${filename}`,
                title: title.trim(),
                content: content.trim(),
                tags: tags.split(',').map(t => t.trim()).filter(Boolean),
                category: cat,
            });
            onCreated();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal onClose={onClose} title="Tạo tài liệu mới" wide>
            {error && <div className="mb-3 px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>{error}</div>}

            <div className="grid grid-cols-2 gap-3 mb-3">
                <Field label="Tiêu đề *">
                    <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ví dụ: REST API Conventions"
                        className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                        style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-fg)' }} />
                </Field>
                <Field label="Category">
                    <div className="flex gap-2">
                        <select value={category} onChange={e => setCategory(e.target.value)}
                            className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                            style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-fg)' }}>
                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                            <option value="__custom">+ Mới...</option>
                        </select>
                        {category === '__custom' && (
                            <input value={customCategory} onChange={e => setCustomCategory(e.target.value)}
                                placeholder="custom-category"
                                className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                                style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-fg)' }} />
                        )}
                    </div>
                </Field>
            </div>

            <Field label="Tags (phân cách bằng dấu phẩy)">
                <input value={tags} onChange={e => setTags(e.target.value)} placeholder="api, typescript, gateway"
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-fg)' }} />
            </Field>

            <Field label="Nội dung (Markdown) *" className="mt-3">
                <textarea value={content} onChange={e => setContent(e.target.value)} rows={14}
                    placeholder="Viết tài liệu bằng Markdown..."
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono resize-y"
                    style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-fg)' }} />
            </Field>

            <div className="flex justify-end gap-2 mt-4">
                <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm cursor-pointer" style={{ color: 'var(--color-fg-muted)' }}>
                    Huỷ
                </button>
                <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
                    style={{ background: 'var(--color-primary)', color: '#fff', opacity: saving ? 0.6 : 1 }}>
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    {saving ? 'Đang lưu...' : 'Lưu'}
                </button>
            </div>
        </Modal>
    );
}

// ─── View Doc Modal ─────────────────────────────────────────

function ViewDocModal({ doc, onClose, onEdit }: {
    doc: DevDocFull;
    onClose: () => void;
    onEdit: () => void;
}) {
    return (
        <Modal onClose={onClose} title={doc.title} wide>
            <div className="flex items-center gap-3 mb-4 text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                <span className="flex items-center gap-1"><FolderOpen size={12} /> {doc.category}</span>
                <span>{doc.wordCount} words</span>
                {doc.tags.length > 0 && (
                    <div className="flex gap-1">
                        {doc.tags.map(t => (
                            <span key={t} className="px-1.5 py-0.5 rounded-full"
                                style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                                {t}
                            </span>
                        ))}
                    </div>
                )}
            </div>
            <div className="prose prose-sm max-w-none overflow-y-auto" style={{ maxHeight: '60vh' }}>
                <pre className="whitespace-pre-wrap text-sm leading-relaxed font-mono px-4 py-3 rounded-lg"
                    style={{ background: 'var(--color-bg)', color: 'var(--color-fg)', border: '1px solid var(--color-border)' }}>
                    {doc.content}
                </pre>
            </div>
            <div className="flex justify-end gap-2 mt-4">
                <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm cursor-pointer" style={{ color: 'var(--color-fg-muted)' }}>
                    Đóng
                </button>
                <button onClick={onEdit} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
                    style={{ background: 'var(--color-primary)', color: '#fff' }}>
                    <Edit3 size={14} /> Sửa
                </button>
            </div>
        </Modal>
    );
}

// ─── Edit Doc Modal ─────────────────────────────────────────

function EditDocModal({ doc, onClose, onSaved }: {
    doc: DevDocFull;
    onClose: () => void;
    onSaved: () => void;
}) {
    // Strip frontmatter and title line for editing pure content
    const rawContent = doc.content
        .replace(/^---[\s\S]*?---\s*/, '')
        .replace(/^#\s+.*\n\s*/, '')
        .trim();

    const [title, setTitle] = useState(doc.title);
    const [tags, setTags] = useState(doc.tags.join(', '));
    const [content, setContent] = useState(rawContent);
    const [versionBump, setVersionBump] = useState<'patch' | 'minor' | 'major'>('patch');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSave = async () => {
        if (!content.trim()) { setError('Nội dung là bắt buộc'); return; }
        try {
            setSaving(true);
            await updateDevDoc(doc.id, {
                content: content.trim(),
                title: title.trim() || undefined,
                tags: tags.split(',').map(t => t.trim()).filter(Boolean),
                versionBump,
            });
            onSaved();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal onClose={onClose} title={`Sửa: ${doc.title}`} wide>
            {error && <div className="mb-3 px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>{error}</div>}

            <div className="grid grid-cols-2 gap-3 mb-3">
                <Field label="Tiêu đề">
                    <input value={title} onChange={e => setTitle(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                        style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-fg)' }} />
                </Field>
                <Field label="Tags">
                    <input value={tags} onChange={e => setTags(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                        style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-fg)' }} />
                </Field>
            </div>

            <Field label="Version bump" className="mb-3">
                <div className="flex gap-2">
                    {(['patch', 'minor', 'major'] as const).map(b => (
                        <button key={b} type="button" onClick={() => setVersionBump(b)}
                            className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer"
                            style={{
                                background: versionBump === b ? 'rgba(99,102,241,0.15)' : 'var(--color-bg)',
                                border: `1px solid ${versionBump === b ? '#6366f1' : 'var(--color-border)'}`,
                                color: versionBump === b ? '#818cf8' : 'var(--color-fg-muted)',
                            }}>
                            {b.charAt(0).toUpperCase() + b.slice(1)}
                        </button>
                    ))}
                </div>
            </Field>

            <Field label="Nội dung (Markdown)">
                <textarea value={content} onChange={e => setContent(e.target.value)} rows={16}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono resize-y"
                    style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-fg)' }} />
            </Field>

            <div className="flex justify-end gap-2 mt-4">
                <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm cursor-pointer" style={{ color: 'var(--color-fg-muted)' }}>
                    Huỷ
                </button>
                <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
                    style={{ background: 'var(--color-primary)', color: '#fff', opacity: saving ? 0.6 : 1 }}>
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    {saving ? 'Đang lưu...' : 'Cập nhật'}
                </button>
            </div>
        </Modal>
    );
}

// ─── Confirm Delete Modal ───────────────────────────────────

function ConfirmDeleteModal({ docId, onClose, onConfirm }: {
    docId: string;
    onClose: () => void;
    onConfirm: () => void;
}) {
    return (
        <Modal onClose={onClose} title="Xác nhận xoá">
            <p className="text-sm mb-1" style={{ color: 'var(--color-fg)' }}>
                Bạn có chắc muốn xoá tài liệu này?
            </p>
            <p className="text-xs mb-4" style={{ color: 'var(--color-fg-muted)' }}>
                ID: <code className="px-1 py-0.5 rounded" style={{ background: 'var(--color-bg)' }}>{docId}</code>
            </p>
            <div className="flex justify-end gap-2">
                <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm cursor-pointer" style={{ color: 'var(--color-fg-muted)' }}>
                    Huỷ
                </button>
                <button onClick={onConfirm} className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
                    style={{ background: '#ef4444', color: '#fff' }}>
                    Xoá
                </button>
            </div>
        </Modal>
    );
}

// ─── Version History Modal ──────────────────────────────────

function VersionHistoryModal({ docId, onClose }: {
    docId: string;
    onClose: () => void;
}) {
    const [versions, setVersions] = useState<DevDocVersion[]>([]);
    const [currentVersion, setCurrentVersion] = useState('');
    const [loading, setLoading] = useState(true);
    const [viewContent, setViewContent] = useState<{ version: string; content: string } | null>(null);

    useEffect(() => {
        getDocVersionHistory(docId)
            .then(res => {
                setVersions(res.versions);
                setCurrentVersion(res.currentVersion);
            })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [docId]);

    const loadVersionContent = async (version: string) => {
        try {
            const res = await getDocVersionContent(docId, version);
            setViewContent({ version: res.version, content: res.content });
        } catch { /* ignore */ }
    };

    return (
        <Modal onClose={onClose} title="Lịch sử phiên bản" wide>
            {loading ? (
                <div className="flex items-center justify-center py-10">
                    <Loader2 size={20} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
                </div>
            ) : viewContent ? (
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium" style={{ color: 'var(--color-fg)' }}>
                            Phiên bản v{viewContent.version}
                        </span>
                        <button onClick={() => setViewContent(null)}
                            className="text-xs px-3 py-1 rounded-lg cursor-pointer"
                            style={{ color: 'var(--color-primary)', background: 'var(--color-bg)' }}>
                            ← Quay lại
                        </button>
                    </div>
                    <pre className="whitespace-pre-wrap text-sm leading-relaxed font-mono px-4 py-3 rounded-lg overflow-y-auto"
                        style={{ background: 'var(--color-bg)', color: 'var(--color-fg)', border: '1px solid var(--color-border)', maxHeight: '50vh' }}>
                        {viewContent.content}
                    </pre>
                </div>
            ) : versions.length === 0 ? (
                <p className="text-sm py-6 text-center" style={{ color: 'var(--color-fg-muted)' }}>
                    Chưa có lịch sử phiên bản
                </p>
            ) : (
                <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                    {versions.map(v => (
                        <div key={v.version}
                            className="flex items-center justify-between p-3 rounded-lg border"
                            style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium" style={{ color: 'var(--color-fg)' }}>
                                        v{v.version}
                                    </span>
                                    {v.version === currentVersion && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                                            style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80' }}>
                                            current
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-3 text-[11px] mt-0.5" style={{ color: 'var(--color-fg-muted)' }}>
                                    {v.title && <span>{v.title}</span>}
                                    <span>{v.wordCount} words</span>
                                    <span>{new Date(v.updatedAt).toLocaleString()}</span>
                                </div>
                            </div>
                            <button onClick={() => loadVersionContent(v.version)}
                                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
                                style={{ color: 'var(--color-primary)', background: 'rgba(99,102,241,0.08)' }}>
                                <Eye size={12} /> Xem
                            </button>
                        </div>
                    ))}
                </div>
            )}
            <div className="flex justify-end mt-4">
                <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm cursor-pointer" style={{ color: 'var(--color-fg-muted)' }}>
                    Đóng
                </button>
            </div>
        </Modal>
    );
}

// ─── Shared Components ──────────────────────────────────────

function Modal({ children, onClose, title, wide }: {
    children: React.ReactNode;
    onClose: () => void;
    title: string;
    wide?: boolean;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={onClose}>
            <div
                className="rounded-xl p-6 shadow-2xl overflow-y-auto"
                style={{
                    background: 'var(--color-bg-soft)',
                    border: '1px solid var(--color-border)',
                    maxHeight: '90vh',
                    width: wide ? '720px' : '480px',
                    maxWidth: '95vw',
                }}
                onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold" style={{ color: 'var(--color-fg)' }}>{title}</h2>
                    <button onClick={onClose} className="p-1 rounded-lg cursor-pointer" style={{ color: 'var(--color-fg-muted)' }}>
                        <X size={16} />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
    return (
        <div className={className}>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-fg-muted)' }}>
                {label}
            </label>
            {children}
        </div>
    );
}
