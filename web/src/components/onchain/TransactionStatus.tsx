import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { SolscanLink } from "./SolscanLink";

export type TxUiState = "idle" | "pending" | "confirmed" | "failed";

export function TransactionStatus({
  state,
  signature,
  error,
  onRetry,
}: {
  state: TxUiState;
  signature?: string | null;
  error?: string | null;
  onRetry?: () => void;
}) {
  if (state === "idle") return null;
  if (state === "pending") {
    return (
      <div className="flex items-center gap-2 text-sm text-white/80">
        <Loader2 className="h-4 w-4 animate-spin text-[#F0C75E]" />
        Transaction pending…
      </div>
    );
  }
  if (state === "failed") {
    return (
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-[#ff4d6d]">
          <AlertTriangle className="h-4 w-4" />
          Transaction failed
        </div>
        {error && <p className="break-all font-mono text-xs text-white/50">{error}</p>}
        {signature && <SolscanLink signature={signature} />}
        {onRetry && (
          <button type="button" onClick={onRetry} className="rounded-lg border border-white/20 px-3 py-1.5 text-xs">
            Retry
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-1 text-sm">
      <div className="flex items-center gap-2 text-[#60A5FA]">
        <CheckCircle2 className="h-4 w-4" />
        Transaction confirmed
      </div>
      {signature && <SolscanLink signature={signature} />}
    </div>
  );
}
