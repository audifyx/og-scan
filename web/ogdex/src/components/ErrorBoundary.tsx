import { Component, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

// Prevents a single section's render error from blanking the whole app.
export default class ErrorBoundary extends Component<{ children: ReactNode; label?: string }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  componentDidCatch(err: Error) { try { console.error("OGDEX section error:", err); } catch { /* noop */ } }
  render() {
    if (this.state.err) {
      return (
        <div className="card p-6 text-center text-sm">
          <AlertTriangle className="w-5 h-5 text-down mx-auto mb-2" />
          <div className="text-white font-semibold mb-1">Couldn't load {this.props.label || "this section"}</div>
          <div className="text-muted text-xs mb-3">Something went wrong rendering this data. Try refreshing.</div>
          <button onClick={() => this.setState({ err: null })} className="btn bg-accent/15 text-accent">Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}
