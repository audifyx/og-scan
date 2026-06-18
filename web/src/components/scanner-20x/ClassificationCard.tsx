/**
 * ClassificationCard — OG Scan 4-tier explainable verdict (spec sections 5[2] & 6).
 * Renders the tier, 0-100 confidence, composite risk, rationale, and a
 * progressive-disclosure signal trace. Presentational only — pass in the
 * result of classifyToken().
 */
import { useState } from "react";
import {
  ShieldCheck, ShieldAlert, ShieldX, AlertTriangle,
  ChevronDown, ChevronUp, ArrowUpRight, ArrowDownRight, Minus, Info,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { OgClassification, OgTier, SignalDirection } from "@/lib/classification";
import { tierIntent } from "@/lib/classification";

interface Props {
  result: OgClassification;
  symbol?: string | null;
  className?: string;
}

const TIER_STYLE: Record<OgTier, { ring: string; text: string; bg: string; icon: React.ReactNode }> = {
  OG_TOKEN:        { ring: "ring-emerald-500/40", text: "text-emerald-400", bg: "bg-emerald-500/10", icon: <ShieldCheck className="h-5 w-5" /> },
  SAFE_CLONE:      { ring: "ring-sky-500/40",     text: "text-sky-400",     bg: "bg-sky-500/10",     icon: <ShieldCheck className="h-5 w-5" /> },
  RISKY_TOKEN:     { ring: "ring-amber-500/40",   text: "text-amber-400",   bg: "bg-amber-500/10",   icon: <ShieldAlert className="h-5 w-5" /> },
  DANGEROUS_TOKEN: { ring: "ring-red-500/40",     text: "text-red-400",     bg: "bg-red-500/10",     icon: <ShieldX className="h-5 w-5" /> },
};

function dirIcon(dir: SignalDirection) {
  if (dir === "positive") return <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />;
  if (dir === "negative") return <ArrowDownRight className="h-3.5 w-3.5 text-red-400" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

export function ClassificationCard({ result, symbol, className }: Props) {
  const [open, setOpen] = useState(true);
  const style = TIER_STYLE[result.tier];

  return (
    <div className={cn("rounded-xl border bg-card/60 p-4 ring-1", style.ring, className)}>
      {/* Verdict header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", style.bg, style.text)}>
            {style.icon}
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Classification</div>
            <div className={cn("text-lg font-bold leading-tight", style.text)}>
              {result.tierLabel}{symbol ? <span className="ml-1.5 text-sm font-normal text-muted-foreground">${symbol}</span> : null}
            </div>
          </div>
        </div>
        <Badge variant="outline" className={cn("shrink-0", style.text)}>
          {result.confidence}% confidence
        </Badge>
      </div>

      {/* Confidence + risk meters */}
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>Confidence</span><span>{result.confidence}/100</span>
          </div>
          <Progress value={result.confidence} className="h-2" />
        </div>
        <div>
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>Risk</span><span>{result.riskScore}/100</span>
          </div>
          <Progress value={result.riskScore} className="h-2" />
        </div>
      </div>

      {/* Rationale */}
      <div className="mt-4 flex gap-2 rounded-lg bg-muted/40 p-3 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="text-muted-foreground">{result.rationale}</p>
      </div>

      {result.dataCompleteness < 50 && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5" />
          Limited on-chain data ({result.dataCompleteness}% complete) — verdict confidence is reduced.
        </div>
      )}

      {/* Progressive disclosure: signal trace */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-3 flex w-full items-center justify-between rounded-lg px-1 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <span>Detection signals ({result.signals.length})</span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <ul className="space-y-1.5">
          {result.signals.length === 0 && (
            <li className="px-1 py-2 text-xs text-muted-foreground">No signals available for this token.</li>
          )}
          {result.signals.map((s) => (
            <li key={s.id} className="flex items-start gap-2 rounded-md bg-background/40 px-2.5 py-2">
              <span className="mt-0.5">{dirIcon(s.direction)}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{s.label}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">w{s.weight}</span>
                </div>
                <p className="text-xs text-muted-foreground">{s.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default ClassificationCard;

// keep tierIntent referenced for consumers that want colour intents
export { tierIntent };
