import { useEffect, useState } from "react";
import { ExternalLink, Flame } from "lucide-react";
import { fetchRpcSupply, shortSig, timeAgo, useRpcTrades } from "./rpcFeed";
import { cn } from "@/lib/utils";

interface Props {
  mint: string;
}

const INITIAL_SUPPLY = 1_000_000_000;

export function BurnTracker({ mint }: Props) {
  const { burns, loading } = useRpcTrades(mint, 40, 60000);
  const [supply, setSupply] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    fetchRpcSupply(mint).then((s) => { if (alive) setSupply(s); });
    const id = setInterval(() => { fetchRpcSupply(mint).then((s) => { if (alive) setSupply(s); }); }, 120000);
    return () => { alive = false; clearInterval(id); };
  }, [mint]);

  const burned = supply != null ? Math.max(0, INITIAL_SUPPLY - supply) : null;
  const burnPct = burned != null ? (burned / INITIAL_SUPPLY) * 100 : null;

  return (
    <div className="space-y-5">
      {/* burn hero */}
      <div className="relative overflow-hidden rounded-3xl border border-orange-500/25 bg-gradient-to-b from-orange-500/15 via-red-500/[0.07] to-transparent p-6 text-center">
        <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_50%_0%,rgba(249,115,22,0.4),transparent_60%)]" />
        <Flame className="relative mx-auto h-10 w-10 text-orange-400" />
        <p className="relative mt-2 text-3xl font-extrabold tracking-tight">
          {burned != null ? burned.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—"}
        </p>
        <p className="relative text-xs font-semibold uppercase tracking-[0.2em] text-orange-200/70">ORBITX burned forever</p>
        {burnPct != null && (
          <div className="relative mx-auto mt-4 max-w-xs">
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-red-500" style={{ width: `${Math.min(100, Math.max(0.5, burnPct))}%` }} />
            </div>
            <p className="mt-1.5 text-[11px] text-white/45">{burnPct.toFixed(3)}% of the 1B supply destroyed</p>
          </div>
        )}
        <div className="relative mt-4 flex justify-center gap-6 text-center">
          <div>
            <p className="text-sm font-bold">{supply != null ? supply.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—"}</p>
            <p className="text-[10px] uppercase tracking-[0.14em] text-white/40">Circulating</p>
          </div>
          <div>
            <p className="text-sm font-bold">{burns.length}</p>
            <p className="text-[10px] uppercase tracking-[0.14em] text-white/40">Burn txs tracked</p>
          </div>
        </div>
      </div>

      <p className="text-[13px] leading-relaxed text-white/55">
        Every burn permanently removes ORBITX from the 1&nbsp;billion fixed supply. Burn transactions are
        detected on-chain and linked below — verify each one yourself on Solscan.
      </p>

      {/* burn feed */}
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/5" />)}
        </div>
      ) : burns.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <Flame className="mx-auto h-8 w-8 text-white/20" />
          <p className="mt-3 text-sm font-semibold text-white/60">No burns in the recent window</p>
          <p className="mt-1 text-xs text-white/35">Burns appear here automatically when they're detected on-chain.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {burns.map((b) => (
            <a
              key={b.signature}
              href={`https://solscan.io/tx/${b.signature}`}
              target="_blank" rel="noreferrer"
              className={cn("flex items-center gap-3 rounded-2xl border border-orange-500/20 bg-orange-500/[0.06] p-3.5 transition hover:bg-orange-500/[0.1]")}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-red-600 shadow-[0_0_16px_rgba(249,115,22,0.4)]">
                <Flame className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-orange-100">
                  🔥 {b.tokenAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} ORBITX
                </p>
                <p className="truncate font-mono text-[11px] text-white/40">{shortSig(b.signature)} · {timeAgo(b.timestamp)}</p>
              </div>
              <ExternalLink className="h-4 w-4 shrink-0 text-white/40" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
