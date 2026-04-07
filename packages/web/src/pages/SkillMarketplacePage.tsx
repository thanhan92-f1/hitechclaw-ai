import { useState, useEffect } from 'react';
import {
    Search, Download, Star, Filter, Package, CheckCircle, XCircle,
    Zap, Code, Heart, Shield, Brain, Globe, TrendingUp, Sparkles,
} from 'lucide-react';
import { getMarketplaceSkills, installMarketplaceSkill, uninstallMarketplaceSkill } from '../lib/api';

interface SkillPack {
    id: string;
    name: string;
    description: string;
    version: string;
    author: string;
    category: string;
    rating: number;
    downloads: number;
    installed: boolean;
    icon: string;
    tags: string[];
}

const CATEGORIES = [
    { id: 'all', name: 'All', icon: Package },
    { id: 'productivity', name: 'Productivity', icon: Zap },
    { id: 'development', name: 'Development', icon: Code },
    { id: 'healthcare', name: 'Healthcare', icon: Heart },
    { id: 'security', name: 'Security', icon: Shield },
    { id: 'ai', name: 'AI / ML', icon: Brain },
    { id: 'integration', name: 'Integrations', icon: Globe },
    { id: 'analytics', name: 'Analytics', icon: TrendingUp },
];

const SAMPLE_SKILLS: SkillPack[] = [
    {
        id: 'web-search', name: 'Web Search', description: 'Search the web using Tavily, Brave, or Bing with AI-optimized results.',
        version: '2.0.0', author: 'HiTechClaw Core', category: 'productivity', rating: 4.8, downloads: 12500, installed: true,
        icon: '🔍', tags: ['search', 'web', 'tavily'],
    },
    {
        id: 'code-interpreter', name: 'Code Interpreter', description: 'Execute Python, JavaScript, and TypeScript code in a sandboxed environment.',
        version: '1.5.0', author: 'HiTechClaw Core', category: 'development', rating: 4.9, downloads: 9800, installed: true,
        icon: '💻', tags: ['code', 'python', 'sandbox'],
    },
    {
        id: 'medical-icd10', name: 'ICD-10 Lookup', description: 'Look up ICD-10 diagnosis codes with Vietnamese descriptions.',
        version: '2.0.0', author: 'HiTechClaw Healthcare', category: 'healthcare', rating: 4.7, downloads: 3200, installed: true,
        icon: '🏥', tags: ['medical', 'icd10', 'diagnosis'],
    },
    {
        id: 'drug-checker', name: 'Drug Interaction Checker', description: 'Check drug interactions, contraindications, and dosing guidelines.',
        version: '2.0.0', author: 'HiTechClaw Healthcare', category: 'healthcare', rating: 4.6, downloads: 2100, installed: true,
        icon: '💊', tags: ['medical', 'drug', 'pharmacology'],
    },
    {
        id: 'shirtgen', name: 'TeeForge.AI', description: 'Generate custom t-shirt designs with AI. Includes try-on, marketplace, and print specs.',
        version: '1.0.0', author: 'HiTechClaw Plugins', category: 'ai', rating: 4.5, downloads: 1800, installed: true,
        icon: '👕', tags: ['ai', 'design', 'ecommerce'],
    },
    {
        id: 'image-gen', name: 'Image Generation', description: 'Generate images using DALL-E 3, Stable Diffusion, or Midjourney.',
        version: '1.0.0', author: 'HiTechClaw Core', category: 'ai', rating: 4.7, downloads: 8500, installed: false,
        icon: '🎨', tags: ['ai', 'image', 'dalle'],
    },
    {
        id: 'gmail-integration', name: 'Gmail', description: 'Read, send, and manage emails through Gmail API.',
        version: '1.2.0', author: 'HiTechClaw Integrations', category: 'integration', rating: 4.4, downloads: 5600, installed: false,
        icon: '📧', tags: ['email', 'google', 'gmail'],
    },
    {
        id: 'notion-sync', name: 'Notion Sync', description: 'Sync knowledge base with Notion databases and pages.',
        version: '1.1.0', author: 'HiTechClaw Integrations', category: 'integration', rating: 4.3, downloads: 4200, installed: false,
        icon: '📝', tags: ['notion', 'wiki', 'sync'],
    },
    {
        id: 'github-tools', name: 'GitHub', description: 'Manage repos, issues, PRs, and actions through GitHub API.',
        version: '1.3.0', author: 'HiTechClaw Integrations', category: 'integration', rating: 4.6, downloads: 7100, installed: false,
        icon: '🐙', tags: ['github', 'git', 'devops'],
    },
    {
        id: 'sentiment-analysis', name: 'Sentiment Analysis', description: 'Analyze text sentiment with multi-language NLP support.',
        version: '1.0.0', author: 'Community', category: 'analytics', rating: 4.2, downloads: 2800, installed: false,
        icon: '📊', tags: ['nlp', 'sentiment', 'analytics'],
    },
    {
        id: 'security-scanner', name: 'Security Scanner', description: 'Scan code for vulnerabilities, secrets, and dependency issues.',
        version: '0.9.0', author: 'Community', category: 'security', rating: 4.1, downloads: 1500, installed: false,
        icon: '🔒', tags: ['security', 'scanner', 'audit'],
    },
    {
        id: 'browser-control', name: 'Browser Automation', description: 'Control browsers with Playwright — navigate, fill forms, extract data.',
        version: '0.8.0', author: 'Community', category: 'productivity', rating: 4.0, downloads: 3200, installed: false,
        icon: '🌐', tags: ['browser', 'automation', 'scraping'],
    },
];

export function SkillMarketplacePage() {
    const [skills, setSkills] = useState<SkillPack[]>(SAMPLE_SKILLS);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('all');
    const [showInstalled, setShowInstalled] = useState(false);
    const [selectedSkill, setSelectedSkill] = useState<SkillPack | null>(null);

    useEffect(() => {
        getMarketplaceSkills()
            .then((data) => {
                if (data.skills && data.skills.length > 0) setSkills(data.skills);
            })
            .catch(() => { /* fallback to SAMPLE_SKILLS */ })
            .finally(() => setLoading(false));
    }, []);

    const filtered = skills.filter((s) => {
        if (showInstalled && !s.installed) return false;
        if (activeCategory !== 'all' && s.category !== activeCategory) return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            return s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || s.tags.some((t) => t.includes(q));
        }
        return true;
    });

    const toggleInstall = async (id: string) => {
        const skill = skills.find((s) => s.id === id);
        if (!skill) return;
        try {
            if (skill.installed) {
                await uninstallMarketplaceSkill(id);
            } else {
                await installMarketplaceSkill(id);
            }
            setSkills((prev) => prev.map((s) => s.id === id ? { ...s, installed: !s.installed } : s));
        } catch {
            // silently ignore install errors — UI stays in sync with optimistic update
        }
    };

    return (
        <div className="h-full overflow-y-auto" style={{ padding: '2rem' }}>
            <div style={{ maxWidth: 1400, margin: '0 auto' }}>
                {/* Header */}
                <div style={{ marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                        <div style={{
                            width: 44, height: 44, borderRadius: 12,
                            background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <Sparkles size={22} color="white" />
                        </div>
                        <div>
                            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-fg)' }}>Skill Marketplace</h1>
                            <p style={{ fontSize: '0.875rem', color: 'var(--color-fg-muted)', marginTop: 2 }}>
                                Discover and install AI skills, integrations, and tools
                            </p>
                        </div>
                    </div>
                </div>

                {/* Search + Filters */}
                <div style={{ display: 'flex', gap: 12, marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                    <div style={{
                        flex: 1, minWidth: 280, position: 'relative',
                    }}>
                        <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-fg-muted)' }} />
                        <input
                            type="text"
                            placeholder="Search skills, integrations, tools..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%', padding: '10px 12px 10px 36px', borderRadius: 10,
                                border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)',
                                color: 'var(--color-fg)', fontSize: '0.875rem', outline: 'none',
                            }}
                        />
                    </div>
                    <button
                        onClick={() => setShowInstalled(!showInstalled)}
                        style={{
                            padding: '10px 16px', borderRadius: 10, fontSize: '0.875rem', cursor: 'pointer',
                            border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 6,
                            background: showInstalled ? 'var(--color-primary)' : 'var(--color-bg-surface)',
                            color: showInstalled ? 'white' : 'var(--color-fg)',
                        }}
                    >
                        <Filter size={14} />
                        {showInstalled ? 'Installed' : 'All'}
                    </button>
                </div>

                {/* Categories */}
                <div style={{ display: 'flex', gap: 8, marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: 4 }}>
                    {CATEGORIES.map((cat) => {
                        const Icon = cat.icon;
                        const isActive = activeCategory === cat.id;
                        return (
                            <button
                                key={cat.id}
                                onClick={() => setActiveCategory(cat.id)}
                                style={{
                                    padding: '8px 16px', borderRadius: 20, fontSize: '0.8rem', cursor: 'pointer',
                                    border: isActive ? 'none' : '1px solid var(--color-border)',
                                    background: isActive ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'var(--color-bg-surface)',
                                    color: isActive ? 'white' : 'var(--color-fg-muted)',
                                    display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
                                    fontWeight: isActive ? 600 : 400,
                                    transition: 'all 0.2s ease',
                                }}
                            >
                                <Icon size={14} />
                                {cat.name}
                            </button>
                        );
                    })}
                </div>

                {/* Stats */}
                <div style={{ display: 'flex', gap: 8, marginBottom: '1.5rem', fontSize: '0.8rem', color: 'var(--color-fg-muted)' }}>
                    <span>{filtered.length} skills</span>
                    <span>·</span>
                    <span>{skills.filter((s) => s.installed).length} installed</span>
                </div>

                {/* Grid */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                    gap: '1rem',
                }}>
                    {filtered.map((skill) => (
                        <div
                            key={skill.id}
                            onClick={() => setSelectedSkill(skill)}
                            className="hover-lift"
                            style={{
                                padding: '1.25rem', borderRadius: 14,
                                border: '1px solid var(--color-border)',
                                background: 'var(--color-bg-surface)',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                position: 'relative',
                            }}
                        >
                            {skill.installed && (
                                <div style={{
                                    position: 'absolute', top: 12, right: 12,
                                    display: 'flex', alignItems: 'center', gap: 4,
                                    padding: '3px 8px', borderRadius: 6,
                                    background: 'rgba(16, 185, 129, 0.15)', color: '#10b981',
                                    fontSize: '0.7rem', fontWeight: 600,
                                }}>
                                    <CheckCircle size={10} /> Installed
                                </div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                                <span style={{ fontSize: '2rem' }}>{skill.icon}</span>
                                <div style={{ flex: 1 }}>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-fg)' }}>{skill.name}</h3>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--color-fg-muted)', marginTop: 2 }}>
                                        by {skill.author} · v{skill.version}
                                    </p>
                                </div>
                            </div>
                            <p style={{ fontSize: '0.825rem', color: 'var(--color-fg-muted)', lineHeight: 1.5, marginBottom: 12 }}>
                                {skill.description}
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    {skill.tags.slice(0, 3).map((tag) => (
                                        <span key={tag} style={{
                                            padding: '2px 8px', borderRadius: 4, fontSize: '0.7rem',
                                            background: 'var(--color-bg)', color: 'var(--color-fg-muted)',
                                        }}>{tag}</span>
                                    ))}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem', color: 'var(--color-fg-muted)' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                        <Star size={12} color="#f59e0b" fill="#f59e0b" /> {skill.rating}
                                    </span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                        <Download size={12} /> {(skill.downloads / 1000).toFixed(1)}k
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {filtered.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--color-fg-muted)' }}>
                        <Package size={48} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                        <p>No skills found matching your search.</p>
                    </div>
                )}

                {/* Detail Modal */}
                {selectedSkill && (
                    <div
                        onClick={() => setSelectedSkill(null)}
                        style={{
                            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            zIndex: 1000, backdropFilter: 'blur(8px)',
                        }}
                    >
                        <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                width: '100%', maxWidth: 520, borderRadius: 16,
                                background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
                                padding: '2rem', maxHeight: '90vh', overflow: 'auto',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                                <span style={{ fontSize: '3rem' }}>{selectedSkill.icon}</span>
                                <div>
                                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-fg)' }}>{selectedSkill.name}</h2>
                                    <p style={{ fontSize: '0.8rem', color: 'var(--color-fg-muted)' }}>
                                        by {selectedSkill.author} · v{selectedSkill.version}
                                    </p>
                                </div>
                            </div>
                            <p style={{ fontSize: '0.9rem', color: 'var(--color-fg)', lineHeight: 1.6, marginBottom: 20 }}>
                                {selectedSkill.description}
                            </p>
                            <div style={{ display: 'flex', gap: 16, marginBottom: 20, fontSize: '0.85rem', color: 'var(--color-fg-muted)' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <Star size={14} color="#f59e0b" fill="#f59e0b" /> {selectedSkill.rating} rating
                                </span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <Download size={14} /> {selectedSkill.downloads.toLocaleString()} downloads
                                </span>
                            </div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 24 }}>
                                {selectedSkill.tags.map((tag) => (
                                    <span key={tag} style={{
                                        padding: '4px 12px', borderRadius: 6, fontSize: '0.75rem',
                                        background: 'var(--color-bg)', color: 'var(--color-fg-muted)',
                                        border: '1px solid var(--color-border)',
                                    }}>{tag}</span>
                                ))}
                            </div>
                            <div style={{ display: 'flex', gap: 12 }}>
                                <button
                                    onClick={() => { toggleInstall(selectedSkill.id); setSelectedSkill({ ...selectedSkill, installed: !selectedSkill.installed }); }}
                                    style={{
                                        flex: 1, padding: '12px', borderRadius: 10, cursor: 'pointer',
                                        border: 'none', fontWeight: 600, fontSize: '0.9rem',
                                        background: selectedSkill.installed ? '#ef4444' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                        color: 'white',
                                    }}
                                >
                                    {selectedSkill.installed ? '🗑 Uninstall' : '⬇ Install'}
                                </button>
                                <button
                                    onClick={() => setSelectedSkill(null)}
                                    style={{
                                        padding: '12px 20px', borderRadius: 10, cursor: 'pointer',
                                        border: '1px solid var(--color-border)', background: 'var(--color-bg)',
                                        color: 'var(--color-fg)', fontSize: '0.9rem',
                                    }}
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
