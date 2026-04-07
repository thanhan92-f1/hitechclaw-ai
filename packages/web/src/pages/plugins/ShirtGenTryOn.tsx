import { useState } from 'react';
import { Shirt, Upload, Loader2, Palette } from 'lucide-react';

const TSHIRT_COLORS = [
    { name: 'Black', hex: '#1a1a1a' },
    { name: 'White', hex: '#ffffff' },
    { name: 'Navy', hex: '#1e3a5f' },
    { name: 'Red', hex: '#dc2626' },
    { name: 'Forest', hex: '#166534' },
    { name: 'Charcoal', hex: '#374151' },
    { name: 'Pink', hex: '#ec4899' },
    { name: 'Sand', hex: '#d4a574' },
];

const FITS = ['Regular', 'Oversize', 'Slim', 'Crop'];
const SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];

export function ShirtGenTryOn() {
    const [selectedColor, setSelectedColor] = useState(TSHIRT_COLORS[0]);
    const [selectedFit, setSelectedFit] = useState('Regular');
    const [selectedSize, setSelectedSize] = useState('M');
    const [designImage, setDesignImage] = useState<string | null>(null);
    const [printArea, setPrintArea] = useState<'front-chest' | 'back' | 'left-sleeve'>('front-chest');

    return (
        <div className="h-full overflow-y-auto">
            <div className="px-6 pt-5 pb-4 border-b" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                <div className="max-w-6xl mx-auto">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.15)' }}>
                            <Shirt size={20} color="#3b82f6" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold" style={{ color: 'var(--color-fg)' }}>Virtual Try-On</h1>
                            <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>Preview your design on different T-shirt styles</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 py-5">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Preview */}
                    <div className="rounded-xl border p-6 flex flex-col items-center"
                        style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                        <div className="relative w-80 h-96 rounded-2xl flex items-center justify-center"
                            style={{ background: selectedColor.hex === '#ffffff' ? '#f1f5f9' : selectedColor.hex }}>
                            {/* T-shirt silhouette */}
                            <svg viewBox="0 0 200 240" className="w-full h-full p-6 drop-shadow-lg" fill={selectedColor.hex} stroke="rgba(0,0,0,0.1)" strokeWidth="0.5">
                                <path d="M40,25 L25,40 L15,75 L35,80 L40,55 L40,210 L160,210 L160,55 L165,80 L185,75 L175,40 L160,25 L130,15 C125,25 75,25 70,15 Z" />
                            </svg>
                            {/* Design placement */}
                            <div className="absolute flex items-center justify-center"
                                style={{
                                    top: printArea === 'front-chest' ? '30%' : printArea === 'back' ? '35%' : '25%',
                                    left: printArea === 'left-sleeve' ? '15%' : '50%',
                                    transform: printArea === 'left-sleeve' ? 'translateY(-50%)' : 'translate(-50%, -50%)',
                                    width: printArea === 'left-sleeve' ? '15%' : '40%',
                                    aspectRatio: '1',
                                }}>
                                {designImage ? (
                                    <img src={designImage} alt="Design" className="w-full h-full object-contain rounded-lg opacity-90" />
                                ) : (
                                    <div className="w-full h-full border-2 border-dashed rounded-lg flex items-center justify-center"
                                        style={{ borderColor: selectedColor.hex === '#ffffff' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.3)' }}>
                                        <Upload size={24} style={{ color: selectedColor.hex === '#ffffff' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.3)' }} />
                                    </div>
                                )}
                            </div>
                        </div>

                        <p className="mt-3 text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                            {selectedFit} Fit • Size {selectedSize} • {selectedColor.name} • {printArea}
                        </p>
                    </div>

                    {/* Controls */}
                    <div className="space-y-5">
                        {/* Color */}
                        <div className="rounded-xl border p-4" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--color-fg)' }}>
                                <Palette size={16} /> T-Shirt Color
                            </h3>
                            <div className="flex gap-2 flex-wrap">
                                {TSHIRT_COLORS.map(c => (
                                    <button key={c.hex}
                                        onClick={() => setSelectedColor(c)}
                                        className="w-10 h-10 rounded-lg border-2 transition-transform hover:scale-110"
                                        style={{
                                            background: c.hex,
                                            borderColor: selectedColor.hex === c.hex ? 'var(--color-primary)' : c.hex === '#ffffff' ? 'var(--color-border)' : 'transparent',
                                        }}
                                        title={c.name}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Fit */}
                        <div className="rounded-xl border p-4" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-fg)' }}>Fit Style</h3>
                            <div className="flex gap-2">
                                {FITS.map(f => (
                                    <button key={f} onClick={() => setSelectedFit(f)}
                                        className="px-4 py-2 rounded-lg text-sm font-medium transition-colors border"
                                        style={{
                                            background: selectedFit === f ? 'var(--color-primary-soft)' : 'var(--color-bg)',
                                            color: selectedFit === f ? 'var(--color-primary)' : 'var(--color-fg-muted)',
                                            borderColor: selectedFit === f ? 'var(--color-primary)' : 'var(--color-border)',
                                        }}>
                                        {f}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Size */}
                        <div className="rounded-xl border p-4" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-fg)' }}>Size</h3>
                            <div className="flex gap-2">
                                {SIZES.map(s => (
                                    <button key={s} onClick={() => setSelectedSize(s)}
                                        className="w-10 h-10 rounded-lg text-xs font-bold transition-colors border"
                                        style={{
                                            background: selectedSize === s ? 'var(--color-primary-soft)' : 'var(--color-bg)',
                                            color: selectedSize === s ? 'var(--color-primary)' : 'var(--color-fg-muted)',
                                            borderColor: selectedSize === s ? 'var(--color-primary)' : 'var(--color-border)',
                                        }}>
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Print Area */}
                        <div className="rounded-xl border p-4" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-fg)' }}>Print Area</h3>
                            <div className="flex gap-2">
                                {[
                                    { key: 'front-chest', label: 'Front' },
                                    { key: 'back', label: 'Back' },
                                    { key: 'left-sleeve', label: 'Sleeve' },
                                ].map(p => (
                                    <button key={p.key} onClick={() => setPrintArea(p.key as typeof printArea)}
                                        className="px-4 py-2 rounded-lg text-sm font-medium transition-colors border"
                                        style={{
                                            background: printArea === p.key ? 'var(--color-primary-soft)' : 'var(--color-bg)',
                                            color: printArea === p.key ? 'var(--color-primary)' : 'var(--color-fg-muted)',
                                            borderColor: printArea === p.key ? 'var(--color-primary)' : 'var(--color-border)',
                                        }}>
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
