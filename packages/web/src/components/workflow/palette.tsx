import { type DragEvent } from 'react';
import { NODE_CATALOG, CATEGORY_LABELS } from './nodes';

// ─── Draggable Node Palette (left sidebar) ─────────────────

export function NodePalette() {
    const categories = Object.entries(CATEGORY_LABELS);

    const onDragStart = (e: DragEvent, nodeType: string) => {
        e.dataTransfer.setData('application/hitechclaw-node-type', nodeType);
        e.dataTransfer.effectAllowed = 'move';
    };

    return (
        <div className="h-full overflow-y-auto py-3 px-2 space-y-3">
            <div className="px-2">
                <h3 className="text-xs font-bold" style={{ color: 'var(--color-fg)' }}>
                    Node Palette
                </h3>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-fg-muted)' }}>
                    Drag nodes onto the canvas
                </p>
            </div>

            {categories.map(([catKey, catMeta]) => {
                const nodes = Object.entries(NODE_CATALOG).filter(([, m]) => m.category === catKey);
                if (nodes.length === 0) return null;

                return (
                    <div key={catKey}>
                        <div className="px-2 mb-1.5">
                            <span className="text-[10px] font-semibold tracking-wide" style={{ color: catMeta.color }}>
                                {catMeta.label.toUpperCase()}
                            </span>
                        </div>
                        <div className="space-y-1">
                            {nodes.map(([type, meta]) => (
                                <div
                                    key={type}
                                    draggable
                                    onDragStart={(e) => onDragStart(e, type)}
                                    className="flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-grab active:cursor-grabbing transition-all hover:scale-[1.02]"
                                    style={{
                                        background: 'var(--color-bg)',
                                        border: '1px solid var(--color-border)',
                                    }}
                                    title={meta.description}
                                >
                                    <span
                                        className="w-7 h-7 flex items-center justify-center rounded-md text-sm"
                                        style={{ background: `${meta.color}20` }}
                                    >
                                        {meta.icon}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <span className="text-[11px] font-medium block" style={{ color: 'var(--color-fg)' }}>
                                            {meta.label}
                                        </span>
                                        <span className="text-[9px] block truncate" style={{ color: 'var(--color-fg-muted)' }}>
                                            {meta.description}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
