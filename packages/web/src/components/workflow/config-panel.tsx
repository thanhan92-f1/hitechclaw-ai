import { useState } from 'react';
import { X, Trash2, Copy, Plus } from 'lucide-react';
import { NODE_CATALOG } from './nodes';

// ─── Key-Value Pair Editor ──────────────────────────────────

function KeyValueEditor({ value, onChange, placeholder }: {
    value: Record<string, string>;
    onChange: (v: Record<string, string>) => void;
    placeholder?: string;
}) {
    const entries = Object.entries(value);

    const update = (oldKey: string, newKey: string, newVal: string) => {
        const next: Record<string, string> = {};
        for (const [k, v] of entries) {
            if (k === oldKey) next[newKey] = newVal;
            else next[k] = v;
        }
        onChange(next);
    };

    const add = () => onChange({ ...value, '': '' });

    const remove = (key: string) => {
        const next = { ...value };
        delete next[key];
        onChange(next);
    };

    const inputStyle = {
        background: 'var(--color-bg)',
        borderColor: 'var(--color-border)',
        color: 'var(--color-fg)',
    };

    return (
        <div className="space-y-1.5">
            {entries.map(([k, v], i) => (
                <div key={i} className="flex gap-1 items-center">
                    <input
                        type="text"
                        value={k}
                        onChange={(e) => update(k, e.target.value, v)}
                        placeholder="key"
                        className="flex-1 px-2 py-1 rounded text-[11px] border outline-none font-mono"
                        style={inputStyle}
                    />
                    <input
                        type="text"
                        value={v}
                        onChange={(e) => update(k, k, e.target.value)}
                        placeholder="value"
                        className="flex-1 px-2 py-1 rounded text-[11px] border outline-none font-mono"
                        style={inputStyle}
                    />
                    <button
                        onClick={() => remove(k)}
                        className="p-0.5 cursor-pointer rounded hover:bg-red-500/20"
                        style={{ color: '#ef4444' }}
                    >
                        <Trash2 size={12} />
                    </button>
                </div>
            ))}
            <button
                onClick={add}
                className="flex items-center gap-1 text-[10px] cursor-pointer px-2 py-1 rounded"
                style={{ color: 'var(--color-fg-muted)', border: '1px dashed var(--color-border)' }}
            >
                <Plus size={10} /> Add {placeholder ? '' : 'entry'}
            </button>
        </div>
    );
}

// ─── Cases Editor (for Switch node) ─────────────────────────

function CasesEditor({ value, onChange }: {
    value: Array<{ value: string; label: string }>;
    onChange: (v: Array<{ value: string; label: string }>) => void;
}) {
    const update = (i: number, field: 'value' | 'label', text: string) => {
        const next = value.map((c, idx) => idx === i ? { ...c, [field]: text } : c);
        onChange(next);
    };

    const add = () => onChange([...value, { value: '', label: '' }]);

    const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));

    const inputStyle = {
        background: 'var(--color-bg)',
        borderColor: 'var(--color-border)',
        color: 'var(--color-fg)',
    };

    return (
        <div className="space-y-1.5">
            {value.map((c, i) => (
                <div key={i} className="flex gap-1 items-center">
                    <input
                        type="text"
                        value={c.value}
                        onChange={(e) => update(i, 'value', e.target.value)}
                        placeholder="match value"
                        className="flex-1 px-2 py-1 rounded text-[11px] border outline-none font-mono"
                        style={inputStyle}
                    />
                    <span className="text-[10px]" style={{ color: 'var(--color-fg-muted)' }}>→</span>
                    <input
                        type="text"
                        value={c.label}
                        onChange={(e) => update(i, 'label', e.target.value)}
                        placeholder="label"
                        className="flex-1 px-2 py-1 rounded text-[11px] border outline-none"
                        style={inputStyle}
                    />
                    <button
                        onClick={() => remove(i)}
                        className="p-0.5 cursor-pointer rounded hover:bg-red-500/20"
                        style={{ color: '#ef4444' }}
                    >
                        <Trash2 size={12} />
                    </button>
                </div>
            ))}
            <button
                onClick={add}
                className="flex items-center gap-1 text-[10px] cursor-pointer px-2 py-1 rounded"
                style={{ color: 'var(--color-fg-muted)', border: '1px dashed var(--color-border)' }}
            >
                <Plus size={10} /> Add case
            </button>
        </div>
    );
}

// ─── Node Config Panel (right sidebar) ─────────────────────

interface ConfigPanelProps {
    nodeId: string;
    nodeType: string;
    data: { label: string; description?: string; config: Record<string, unknown> };
    onChange: (nodeId: string, data: Record<string, unknown>) => void;
    onDelete: (nodeId: string) => void;
    onDuplicate: (nodeId: string) => void;
    onClose: () => void;
}

export function ConfigPanel({ nodeId, nodeType, data, onChange, onDelete, onDuplicate, onClose }: ConfigPanelProps) {
    const meta = NODE_CATALOG[nodeType];
    if (!meta) return null;

    const [label, setLabel] = useState(data.label || meta.label);
    const [description, setDescription] = useState(data.description || '');
    const [config, setConfig] = useState<Record<string, any>>(data.config || {});

    const commit = (newLabel?: string, newDesc?: string, newConfig?: Record<string, any>) => {
        onChange(nodeId, {
            label: newLabel ?? label,
            description: newDesc ?? description,
            config: newConfig ?? config,
            nodeType,
        });
    };

    const updateConfig = (key: string, value: any) => {
        const next = { ...config, [key]: value };
        setConfig(next);
        commit(undefined, undefined, next);
    };

    return (
        <div className="h-full flex flex-col" style={{ background: 'var(--color-bg-surface)' }}>
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
                <span
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-base"
                    style={{ background: `${meta.color}20` }}
                >
                    {meta.icon}
                </span>
                <div className="flex-1 min-w-0">
                    <span className="text-xs font-bold block" style={{ color: meta.color }}>
                        {meta.label}
                    </span>
                    <span className="text-[10px]" style={{ color: 'var(--color-fg-muted)' }}>
                        {meta.description}
                    </span>
                </div>
                <button onClick={onClose} className="p-1 cursor-pointer" style={{ color: 'var(--color-fg-muted)' }}>
                    <X size={14} />
                </button>
            </div>

            {/* Form */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
                {/* Label */}
                <div>
                    <label className="block text-[10px] font-semibold mb-1" style={{ color: 'var(--color-fg-muted)' }}>
                        NODE NAME
                    </label>
                    <input
                        type="text"
                        value={label}
                        onChange={(e) => { setLabel(e.target.value); commit(e.target.value); }}
                        className="w-full px-3 py-1.5 rounded-lg text-xs border outline-none focus:ring-1"
                        style={{
                            background: 'var(--color-bg)',
                            borderColor: 'var(--color-border)',
                            color: 'var(--color-fg)',
                        }}
                    />
                </div>

                {/* Description */}
                <div>
                    <label className="block text-[10px] font-semibold mb-1" style={{ color: 'var(--color-fg-muted)' }}>
                        DESCRIPTION
                    </label>
                    <input
                        type="text"
                        value={description}
                        onChange={(e) => { setDescription(e.target.value); commit(undefined, e.target.value); }}
                        placeholder="Optional description"
                        className="w-full px-3 py-1.5 rounded-lg text-xs border outline-none focus:ring-1"
                        style={{
                            background: 'var(--color-bg)',
                            borderColor: 'var(--color-border)',
                            color: 'var(--color-fg)',
                        }}
                    />
                </div>

                {/* Config fields */}
                {meta.configFields.length > 0 && (
                    <div>
                        <div className="text-[10px] font-semibold mb-2" style={{ color: 'var(--color-fg-muted)' }}>
                            CONFIGURATION
                        </div>
                        <div className="space-y-3">
                            {meta.configFields.map((field) => (
                                <div key={field.key}>
                                    <label className="block text-[10px] font-medium mb-1" style={{ color: 'var(--color-fg-muted)' }}>
                                        {field.label}
                                        {field.required && <span style={{ color: '#ef4444' }}> *</span>}
                                    </label>

                                    {field.type === 'text' && (
                                        <input
                                            type="text"
                                            value={(config[field.key] as string) || ''}
                                            onChange={(e) => updateConfig(field.key, e.target.value)}
                                            placeholder={field.placeholder}
                                            className="w-full px-3 py-1.5 rounded-lg text-xs border outline-none focus:ring-1"
                                            style={{
                                                background: 'var(--color-bg)',
                                                borderColor: 'var(--color-border)',
                                                color: 'var(--color-fg)',
                                            }}
                                        />
                                    )}

                                    {field.type === 'number' && (
                                        <input
                                            type="number"
                                            value={(config[field.key] as number) ?? ''}
                                            onChange={(e) => updateConfig(field.key, Number(e.target.value))}
                                            placeholder={field.placeholder}
                                            className="w-full px-3 py-1.5 rounded-lg text-xs border outline-none focus:ring-1"
                                            style={{
                                                background: 'var(--color-bg)',
                                                borderColor: 'var(--color-border)',
                                                color: 'var(--color-fg)',
                                            }}
                                        />
                                    )}

                                    {field.type === 'textarea' && (
                                        <textarea
                                            value={(config[field.key] as string) || ''}
                                            onChange={(e) => updateConfig(field.key, e.target.value)}
                                            placeholder={field.placeholder}
                                            rows={3}
                                            className="w-full px-3 py-1.5 rounded-lg text-xs border outline-none focus:ring-1 resize-none font-mono"
                                            style={{
                                                background: 'var(--color-bg)',
                                                borderColor: 'var(--color-border)',
                                                color: 'var(--color-fg)',
                                            }}
                                        />
                                    )}

                                    {field.type === 'code' && (
                                        <textarea
                                            value={(config[field.key] as string) || ''}
                                            onChange={(e) => updateConfig(field.key, e.target.value)}
                                            placeholder={field.placeholder}
                                            rows={5}
                                            className="w-full px-3 py-1.5 rounded-lg text-[11px] border outline-none focus:ring-1 resize-y font-mono"
                                            style={{
                                                background: '#1e1e2e',
                                                borderColor: 'var(--color-border)',
                                                color: '#c6d0f5',
                                            }}
                                            spellCheck={false}
                                        />
                                    )}

                                    {field.type === 'select' && (
                                        <select
                                            value={(config[field.key] as string) || field.options?.[0]?.value || ''}
                                            onChange={(e) => updateConfig(field.key, e.target.value)}
                                            className="w-full px-3 py-1.5 rounded-lg text-xs border outline-none"
                                            style={{
                                                background: 'var(--color-bg)',
                                                borderColor: 'var(--color-border)',
                                                color: 'var(--color-fg)',
                                            }}
                                        >
                                            {field.options?.map((opt) => (
                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                            ))}
                                        </select>
                                    )}

                                    {field.type === 'key-value' && (
                                        <KeyValueEditor
                                            value={(config[field.key] as Record<string, string>) || {}}
                                            onChange={(v) => updateConfig(field.key, v)}
                                            placeholder={field.placeholder}
                                        />
                                    )}

                                    {field.type === 'cases' && (
                                        <CasesEditor
                                            value={(config[field.key] as Array<{ value: string; label: string }>) || []}
                                            onChange={(v) => updateConfig(field.key, v)}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Variables hint */}
                <div className="rounded-lg p-2.5" style={{ background: 'var(--color-bg)', border: '1px dashed var(--color-border)' }}>
                    <p className="text-[9px] font-medium mb-1" style={{ color: 'var(--color-fg-muted)' }}>
                        💡 Template Variables
                    </p>
                    <p className="text-[9px]" style={{ color: 'var(--color-fg-muted)', opacity: 0.7 }}>
                        Use {'{{inputs.key}}'} to reference upstream node outputs, {'{{_trigger}}'} for trigger data, {'{{variables.name}}'} for workflow variables.
                    </p>
                </div>
            </div>

            {/* Actions */}
            <div className="px-4 py-3 border-t flex gap-2" style={{ borderColor: 'var(--color-border)' }}>
                <button
                    onClick={() => onDuplicate(nodeId)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] cursor-pointer border"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-fg-muted)' }}
                >
                    <Copy size={12} /> Duplicate
                </button>
                <button
                    onClick={() => onDelete(nodeId)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] cursor-pointer"
                    style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}
                >
                    <Trash2 size={12} /> Delete
                </button>
            </div>
        </div>
    );
}
