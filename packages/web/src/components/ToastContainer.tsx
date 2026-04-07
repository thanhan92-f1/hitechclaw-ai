import { useToastStore } from '../stores/useToastStore';
import { CheckCircle, XCircle, Info, X, Loader2 } from 'lucide-react';

const icons = {
    info: Info,
    success: CheckCircle,
    error: XCircle,
    progress: Loader2,
};

const colors = {
    info: '#3b82f6',
    success: '#22c55e',
    error: '#ef4444',
    progress: 'var(--color-primary)',
};

export function ToastContainer() {
    const toasts = useToastStore((s) => s.toasts);
    const removeToast = useToastStore((s) => s.removeToast);

    if (toasts.length === 0) return null;

    return (
        <div
            style={{
                position: 'fixed',
                bottom: 16,
                right: 16,
                zIndex: 99999,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                maxWidth: 380,
                width: '100%',
                pointerEvents: 'none',
            }}
        >
            {toasts.map((toast) => {
                const Icon = icons[toast.type];
                const color = colors[toast.type];
                return (
                    <div
                        key={toast.id}
                        style={{
                            pointerEvents: 'auto',
                            background: 'var(--color-bg-surface, #1e1e2e)',
                            border: '1px solid var(--color-border, #333)',
                            borderRadius: 10,
                            padding: '10px 14px',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4,
                            animation: 'toast-slide-in 0.25s ease-out',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Icon
                                size={16}
                                style={{ color, flexShrink: 0 }}
                                className={toast.type === 'progress' ? 'animate-spin' : ''}
                            />
                            <span
                                style={{
                                    flex: 1,
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: 'var(--color-fg, #e0e0e0)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {toast.title}
                            </span>
                            <button
                                onClick={() => removeToast(toast.id)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    padding: 2,
                                    cursor: 'pointer',
                                    color: 'var(--color-fg-muted, #888)',
                                    flexShrink: 0,
                                }}
                            >
                                <X size={14} />
                            </button>
                        </div>
                        {toast.message && (
                            <span
                                style={{
                                    fontSize: 12,
                                    color: 'var(--color-fg-muted, #888)',
                                    paddingLeft: 24,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {toast.message}
                            </span>
                        )}
                        {toast.type === 'progress' && typeof toast.percent === 'number' && (
                            <div style={{ paddingLeft: 24, paddingTop: 2 }}>
                                <div
                                    style={{
                                        width: '100%',
                                        height: 4,
                                        borderRadius: 2,
                                        background: 'var(--color-border, #333)',
                                    }}
                                >
                                    <div
                                        style={{
                                            width: `${Math.min(toast.percent, 100)}%`,
                                            height: '100%',
                                            borderRadius: 2,
                                            background: color,
                                            transition: 'width 0.3s ease',
                                        }}
                                    />
                                </div>
                                <span
                                    style={{
                                        fontSize: 11,
                                        color: 'var(--color-fg-muted, #888)',
                                        display: 'block',
                                        textAlign: 'right',
                                        marginTop: 2,
                                    }}
                                >
                                    {toast.percent.toFixed(0)}%
                                </span>
                            </div>
                        )}
                    </div>
                );
            })}
            <style>{`
        @keyframes toast-slide-in {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
        </div>
    );
}
