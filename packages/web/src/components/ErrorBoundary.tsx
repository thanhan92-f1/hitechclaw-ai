import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false, error: null };

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;

            return (
                <div className="flex flex-col items-center justify-center p-12 gap-4" style={{ color: 'var(--color-fg-muted)' }}>
                    <AlertTriangle size={40} style={{ color: 'var(--color-warning, #f59e0b)' }} />
                    <h2 className="text-lg font-semibold" style={{ color: 'var(--color-fg)' }}>
                        Something went wrong
                    </h2>
                    <p className="text-sm max-w-md text-center">
                        {this.state.error?.message || 'An unexpected error occurred'}
                    </p>
                    <button
                        onClick={this.handleReset}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                        style={{ background: 'var(--color-primary)', color: '#fff' }}
                    >
                        <RefreshCw size={14} />
                        Try again
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
