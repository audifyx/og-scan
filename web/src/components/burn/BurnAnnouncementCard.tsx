import { Flame, X, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface BurnAnnouncementData {
  id: string;
  mint: string;
  tokenName: string;
  tokenSymbol: string;
  tokenLogoUrl?: string | null;
  wallet: string;
  amountBurned: number;
  supplyBefore: number;
  supplyAfter: number;
  percentOfSupply: number;
  txSignature: string;
  createdAt: string;
}

const short = (a: string) => (a && a.length > 10 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a);

const fmt = (n: number) =>
  n.toLocaleString(undefined, { maximumFractionDigits: n < 1 ? 6 : 2 });

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

/**
 * High-visibility "thanks for burning" toast-card. Self-contained, pure CSS
 * animation (no framer-motion dependency in this project). Designed to be
 * stacked by BurnAnnouncementListener and auto-dismissed by the caller.
 */
export function BurnAnnouncementCard({
  data,
  onDismiss,
  closing,
}: {
  data: BurnAnnouncementData;
  onDismiss: () => void;
  closing?: boolean;
}) {
  return (
    <div
      className={`pointer-events-auto relative w-[92vw] max-w-sm overflow-hidden rounded-2xl border border-[hsl(var(--og-blood))]/40 bg-black/90 p-4 shadow-2xl backdrop-blur-xl animate-burn-glow-pulse ${
        closing ? "animate-burn-card-out" : "animate-burn-card-in"
      }`}
      role="status"
    >
      {/* expanding ring pulse behind the flame icon */}
      <div className="pointer-events-none absolute left-4 top-4 h-9 w-9">
        <span className="absolute inset-0 rounded-full border border-[hsl(var(--og-blood))]/60 animate-burn-ring-expand" />
      </div>

      {/* rising embers */}
      <div className="pointer-events-none absolute bottom-0 left-8 h-16 w-24 overflow-hidden opacity-70">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            style={{
              left: `${8 + i * 6}px`,
              animationDelay: `${i * 0.35}s`,
              // @ts-expect-error css var
              "--ember-drift": `${(i % 2 === 0 ? 1 : -1) * (6 + i * 4)}px`,
            }}
            className="absolute bottom-1 h-1 w-1 rounded-full bg-[hsl(var(--og-gold))] animate-burn-ember-rise"
          />
        ))}
      </div>

      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="absolute right-3 top-3 rounded-full p-1 text-white/30 transition hover:bg-white/10 hover:text-white/70"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="relative flex items-start gap-3">
        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[hsl(var(--og-blood))]/50 bg-[hsl(var(--og-blood))]/15">
          {data.tokenLogoUrl ? (
            <img src={data.tokenLogoUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <Flame className="h-4 w-4 text-[hsl(var(--og-blood))]" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Flame className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--og-blood))]" />
            <p className="truncate text-sm font-bold text-white">
              Thanks for burning, <span className="text-[hsl(var(--og-gold))]">{short(data.wallet)}</span>!
            </p>
          </div>

          <p className="mt-0.5 text-xs text-white/50">
            Burned <span className="font-mono font-semibold text-white">{fmt(data.amountBurned)}</span>{" "}
            <span className="font-semibold text-white">${data.tokenSymbol}</span>
            <span className="text-white/35"> ({data.tokenName})</span> on {fmtDay(data.createdAt)}
          </p>

          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5">
              <div className="text-[9px] uppercase tracking-widest text-white/35">% of supply burnt</div>
              <div className="font-mono text-sm font-bold text-[hsl(var(--og-blood))]">
                {data.percentOfSupply.toFixed(4)}%
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5">
              <div className="text-[9px] uppercase tracking-widest text-white/35">Tokens burnt</div>
              <div className="font-mono text-sm font-bold text-white">{fmt(data.amountBurned)}</div>
            </div>
            <div className="col-span-2 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5">
              <div className="text-[9px] uppercase tracking-widest text-white/35">Supply remaining</div>
              <div className="font-mono text-sm font-bold text-[hsl(var(--og-lime))]">
                {fmt(data.supplyAfter)} ${data.tokenSymbol}
              </div>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between">
            <Badge variant="outline" className="border-white/15 text-[9px] text-muted-foreground">
              verified on-chain
            </Badge>
            <a
              href={`https://solscan.io/tx/${data.txSignature}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-white/40 underline-offset-2 hover:text-white/70 hover:underline"
            >
              view tx <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
