/**
 * QueryStates — reusable loading / error / empty state components
 * Use these in any component that fetches data so the UI always shows
 * something meaningful instead of blank space.
 *
 * Usage:
 *   const { data, isLoading, isError, refetch } = useQuery(...)
 *   if (isLoading) return <QueryLoading />
 *   if (isError)   return <QueryError onRetry={refetch} />
 *   if (!data?.length) return <QueryEmpty message="No tokens found." />
 */

import { Loader2, AlertTriangle, SearchX, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

/* ─── Loading ─────────────────────────────────────────── */

interface QueryLoadingProps {
  /** Number of skeleton rows to show (default: 5) */
  rows?: number;
  /** Use a centred spinner instead of skeleton rows */
  spinner?: boolean;
  className?: string;
}

export function QueryLoading({ rows = 5, spinner = false, className = "" }: QueryLoadingProps) {
  if (spinner) {
    return (
      <div className={`flex min-h-[160px] items-center justify-center ${className}`}>
        <Loader2 className="h-6 w-6 animate-spin text-og-lime/60" />
      </div>
    );
  }

  return (
    <div className={`space-y-3 p-4 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 shrink-0 rounded-full bg-white/5" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/3 bg-white/5" />
            <Skeleton className="h-3 w-2/3 bg-white/5" />
          </div>
          <Skeleton className="h-3 w-16 bg-white/5" />
        </div>
      ))}
    </div>
  );
}

/* ─── Error ────────────────────────────────────────────── */

interface QueryErrorProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function QueryError({
  message = "Failed to load data.",
  onRetry,
  className = "",
}: QueryErrorProps) {
  return (
    <div
      className={`flex min-h-[160px] flex-col items-center justify-center gap-3 rounded-lg border border-red-900/30 bg-red-950/10 p-6 text-center ${className}`}
    >
      <AlertTriangle className="h-8 w-8 text-red-400/70" />
      <p className="text-sm text-red-300">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-1.5 rounded border border-og-lime/30 bg-og-lime/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-og-lime transition hover:bg-og-lime/20"
        >
          <RefreshCw className="h-3 w-3" />
          Retry
        </button>
      )}
    </div>
  );
}

/* ─── Empty ────────────────────────────────────────────── */

interface QueryEmptyProps {
  message?: string;
  /** Optional action button label + handler */
  action?: { label: string; onClick: () => void };
  className?: string;
}

export function QueryEmpty({
  message = "Nothing here yet.",
  action,
  className = "",
}: QueryEmptyProps) {
  return (
    <div
      className={`flex min-h-[160px] flex-col items-center justify-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-6 text-center ${className}`}
    >
      <SearchX className="h-8 w-8 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">{message}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="rounded border border-og-lime/30 bg-og-lime/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-og-lime transition hover:bg-og-lime/20"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
