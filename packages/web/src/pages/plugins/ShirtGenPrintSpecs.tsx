import { FileText, Ruler, Droplets, Maximize } from 'lucide-react';

const PRINT_METHODS = [
    { name: 'DTG (Direct-to-Garment)', dpi: 300, colors: 'Unlimited (CMYK)', best: 'Complex art, photos, gradients', cost: '$$' },
    { name: 'Screen Print', dpi: 200, colors: 'Up to 8 spot colors', best: 'Bold graphics, large runs', cost: '$' },
    { name: 'Sublimation', dpi: 300, colors: 'Unlimited (CMYK)', best: 'All-over prints, polyester', cost: '$$' },
    { name: 'Heat Transfer (DTF)', dpi: 300, colors: 'Unlimited (CMYK)', best: 'Small batches, vivid colors', cost: '$$' },
];

const PRINT_AREAS = [
    { area: 'Front Chest', width: 30, height: 40, unit: 'cm', desc: 'Standard logo / graphic placement' },
    { area: 'Back Full', width: 35, height: 45, unit: 'cm', desc: 'Full back print area' },
    { area: 'Left Chest Pocket', width: 9, height: 9, unit: 'cm', desc: 'Small logo / icon placement' },
    { area: 'Sleeve', width: 8, height: 12, unit: 'cm', desc: 'Arm branding area' },
];

const FILE_FORMATS = [
    { format: 'PNG', transparency: true, recommended: true, note: '300 DPI, sRGB' },
    { format: 'SVG', transparency: true, recommended: true, note: 'Vector, scalable' },
    { format: 'AI / EPS', transparency: true, recommended: false, note: 'Print-shop preferred' },
    { format: 'PSD', transparency: true, recommended: false, note: 'Layered source file' },
];

export function ShirtGenPrintSpecs() {
    return (
        <div className="h-full overflow-y-auto">
            <div className="px-6 pt-5 pb-4 border-b" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                <div className="max-w-5xl mx-auto">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(168,85,247,0.15)' }}>
                            <FileText size={20} color="#a855f7" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold" style={{ color: 'var(--color-fg)' }}>Print Specifications</h1>
                            <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>Technical requirements for production-ready prints</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-6 py-5 space-y-6">
                {/* Print Methods */}
                <div className="rounded-xl border" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                    <div className="px-5 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--color-border)' }}>
                        <Droplets size={16} style={{ color: 'var(--color-primary)' }} />
                        <h2 className="text-sm font-semibold" style={{ color: 'var(--color-fg)' }}>Print Methods</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                    {['Method', 'Min DPI', 'Colors', 'Best For', 'Cost'].map(h => (
                                        <th key={h} className="px-5 py-2 text-left text-xs font-medium" style={{ color: 'var(--color-fg-muted)' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {PRINT_METHODS.map(m => (
                                    <tr key={m.name} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                        <td className="px-5 py-3 font-medium" style={{ color: 'var(--color-fg)' }}>{m.name}</td>
                                        <td className="px-5 py-3" style={{ color: 'var(--color-fg-muted)' }}>{m.dpi} DPI</td>
                                        <td className="px-5 py-3" style={{ color: 'var(--color-fg-muted)' }}>{m.colors}</td>
                                        <td className="px-5 py-3" style={{ color: 'var(--color-fg-muted)' }}>{m.best}</td>
                                        <td className="px-5 py-3 font-bold" style={{ color: 'var(--color-fg-muted)' }}>{m.cost}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Print Areas */}
                <div className="rounded-xl border" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                    <div className="px-5 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--color-border)' }}>
                        <Maximize size={16} style={{ color: 'var(--color-primary)' }} />
                        <h2 className="text-sm font-semibold" style={{ color: 'var(--color-fg)' }}>Print Areas & Dimensions</h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5">
                        {PRINT_AREAS.map(a => (
                            <div key={a.area} className="rounded-lg border p-4" style={{ borderColor: 'var(--color-border)' }}>
                                <h4 className="text-sm font-semibold mb-1" style={{ color: 'var(--color-fg)' }}>{a.area}</h4>
                                <div className="flex items-center gap-2 mb-1">
                                    <Ruler size={14} style={{ color: 'var(--color-fg-muted)' }} />
                                    <span className="text-xs font-mono" style={{ color: 'var(--color-primary)' }}>
                                        {a.width} × {a.height} {a.unit}
                                    </span>
                                    <span className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                                        ({Math.round(a.width / 2.54 * 300)} × {Math.round(a.height / 2.54 * 300)} px @300DPI)
                                    </span>
                                </div>
                                <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>{a.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* File Formats */}
                <div className="rounded-xl border" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                    <div className="px-5 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--color-border)' }}>
                        <FileText size={16} style={{ color: 'var(--color-primary)' }} />
                        <h2 className="text-sm font-semibold" style={{ color: 'var(--color-fg)' }}>File Format Requirements</h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5">
                        {FILE_FORMATS.map(f => (
                            <div key={f.format} className="flex items-center gap-3 rounded-lg border p-3" style={{ borderColor: 'var(--color-border)' }}>
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold"
                                    style={{ background: f.recommended ? 'rgba(34,197,94,0.12)' : 'rgba(107,114,128,0.1)', color: f.recommended ? '#22c55e' : 'var(--color-fg-muted)' }}>
                                    {f.format.split(' ')[0]}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-semibold" style={{ color: 'var(--color-fg)' }}>{f.format}</span>
                                        {f.recommended && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>Recommended</span>}
                                    </div>
                                    <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>{f.note}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Quality Check */}
                <div className="rounded-xl border p-5" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                    <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-fg)' }}>Quality Checklist</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {[
                            'Resolution ≥ 300 DPI at final print size',
                            'Color space: sRGB for digital, CMYK for offset',
                            'Transparent background (PNG/SVG)',
                            'No visible compression artifacts',
                            'Text converted to outlines',
                            'Bleed area: 3mm on all sides',
                        ].map(item => (
                            <label key={item} className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg" style={{ color: 'var(--color-fg-muted)' }}>
                                <input type="checkbox" className="rounded" />
                                {item}
                            </label>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
