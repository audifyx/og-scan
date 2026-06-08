import { Component, type ReactNode, type ErrorInfo } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Optional custom fallback — if omitted, the default OGScan UI is shown */
  fallback?: ReactNode;
  /** Label for the reset button (default: "Try again") */
  resetLabel?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Global error boundary.
 * Wraps any subtree; if a component throws, the rest of the page stays alive
 * and the user sees a friendly "something went wrong" panel with a reset button.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <SomeComponent />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log to console in dev; Sentry will pick this up in production
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-4 rounded-lg border border-red-900/40 bg-red-950/20 p-8 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-full border border-red-800 bg-red-900/30">
          <AlertTriangle className="h-6 w-6 text-red-400" />
        </div>
        <div>
          <p className="font-semibold text-red-300">Something went wrong</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {this.state.error?.message ?? "An unexpected error occurred."}
          </p>
        </div>
        <button
          onClick={this.reset}
          className="flex items-center gap-2 rounded border border-og-lime/40 bg-og-lime/10 px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-og-lime transition hover:bg-og-lime/20"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {this.props.resetLabel ?? "Try again"}
        </button>
      </div>
    );
  }
}

/**
 * Convenience wrapper — same as <ErrorBoundary> but accepts an `onReset` callback
 * so parent components can also respond to the reset.
 */
export function SafeZone({
  children,
  label,
}: {
  children: ReactNode;
  label?: string;
}) {
  return <ErrorBoundary resetLabel={label}>{children}</ErrorBoundary>;
}
