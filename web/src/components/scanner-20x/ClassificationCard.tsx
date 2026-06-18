/**
 * ClassificationCard — OG Scan 4-tier explainable verdict, glass-themed.
 */
import { useState } from "react";
import {
  ShieldCheck, ShieldAlert, ShieldX, AlertTriangle,
  ChevronDown, ChevronUp, ArrowUpRight, ArrowDownRight, Minus, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { OgClassification, OgTier, SignalDirection } from "@/lib/classification";
import { tierIntent } from "@/lib/classification";

interface Props {
  result: OgClassification;
  symbol?: string | null;
  className?: string;
}

const TIER_STYLE: Record<OgTier, { text: string; ring: string; bar: string; icon: React.ReactNode }> = {
  OG_TOKEN:        { text: "text-og-lime",  ring: "border-og-lime/40",  bar: "bg-og-lime",  icon: <ShieldCheck className="h-5 w-5" /> },
  SAFE_CLONE:      { text: "text-og-cyan",  ring: "border-og-cyan/40",  bar: "bg-og-cyan",  icon: <ShieldCheck className="h-5 w-5" /> },
  RISKY_TOKEN:     { text: "text-og-gold",  ring: "border-og-gold/40",  bar: "bg-og-gold",  icon: <ShieldAlert className="h-5 w-5" /> },
  DANGEROUS_TOKEN: { text: "text-og-blood", ring: "border-og-blood/40", bar: "bg-og-blood", icon: <ShieldX className="h-5 w-5" /> },
};

function dirIcon(dir: SignalDirection) {
  if (dir === "positive") return <ArrowUpRight className="h-3.5 w-3.5 text-og-lime" />;
  if (dir === "negative") return <ArrowDownRight className="h-3.5 w-3.5 text-og-blood" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

function Bar({ value, className }: { value: number; className?: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
      <div className={cn("h-full rounded-full transition-all", className)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function ClassificationCard({ result, symbol, className }: Props) {
  const [open, setOpen] = useState(true);
  const style = TIER_STYLE[result.tier];
  void tierIntent;

  return (
    <div className={cn("glass-card border p-4", style.ring, className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5", style.text)}>
            {style.icon}
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Classification</div>
            <div className={cn("font-display text-xl font-black leading-tight", style.text)}>
              {result.tierLabel}{symbol ? <span className="ml-1.5 text-sm font-normal text-muted-foreground">${symbol}</span> : null}
            </div>
          </div>
        </div>
        <span className={cn("shrink-0 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest", style.text)}>
          {result.confidence}% conf
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <div className="mb-1 flex justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground"><span>Confidence</span><span>{result.confidence}/100</span></div>
          <Bar value={result.confidence} className={style.bar} />
        </div>
        <div>
          <div className="mb-1 flex justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground"><span>Risk</span><span>{result.riskScore}/100</span></div>
          <Bar value={result.riskScore} className={result.riskScore >= 60 ? "bg-og-blood" : result.riskScore >= 35 ? "bg-og-gold" : "bg-og-lime"} />
        </div>
      </div>

      <div className="mt-4 flex gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="text-muted-foreground">{result.rationale}</p>
      </div>

      {result.dataCompleteness < 50 && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-og-gold">
          <AlertTriangle className="h-3.5 w-3.5" />
          Limited on-chain data ({result.dataCompleteness}% complete) — confidence reduced.
        </div>
      )}

      <button type="button" onClick={() => setOpen((v) => !v)} className="mt-3 flex w-full items-center justify-between rounded-lg px-1 py-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground">
        <span>Detection signals ({result.signals.length})</span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <ul className="space-y-1.5">
          {result.signals.length === 0 && <li className="px-1 py-2 text-xs text-muted-foreground">No signals available.</li>}
          {result.signals.map((s) => (
            <li key={s.id} className="flex items-start gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-2">
              <span className="mt-0.5">{dirIcon(s.direction)}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{s.label}</span>
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">w{s.weight}</span>
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
export { tierIntent };
