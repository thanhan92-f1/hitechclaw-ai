interface SkeletonProps {
    className?: string;
    style?: React.CSSProperties;
}

function Bone({ className = '', style }: SkeletonProps) {
    return (
        <div
            className={`animate-pulse rounded ${className}`}
            style={{ background: 'var(--color-bg-soft)', ...style }}
        />
    );
}

export function PageSkeleton() {
    return (
        <div className="p-6 space-y-6">
            {/* Title */}
            <Bone className="h-8 w-48" />
            {/* Subtitle */}
            <Bone className="h-4 w-72" />
            {/* Stat cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="p-4 rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
                        <Bone className="h-4 w-24 mb-3" />
                        <Bone className="h-8 w-16" />
                    </div>
                ))}
            </div>
            {/* Content area */}
            <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                    <Bone key={i} className="h-12 w-full" />
                ))}
            </div>
        </div>
    );
}

export function CardSkeleton() {
    return (
        <div className="p-4 rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
            <Bone className="h-5 w-32 mb-3" />
            <Bone className="h-4 w-full mb-2" />
            <Bone className="h-4 w-3/4" />
        </div>
    );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
    return (
        <div className="space-y-2">
            <Bone className="h-10 w-full" />
            {Array.from({ length: rows }, (_, i) => (
                <Bone key={i} className="h-12 w-full" />
            ))}
        </div>
    );
}
