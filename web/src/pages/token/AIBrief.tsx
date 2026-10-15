import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, Brain } from "lucide-react";
import type { AvatarStats } from "./LivingAvatar";
import { fmtUsdShort } from "./TokenWidgets";

function fmtPrice(p: number | null | undefined): string {
  if (p == null || !isFinite(p) || p <= 0) return "—";
  if (p < 0.0001) return `$${p.toExponential(2)}`;
  return `$${p.toFixed(6)}`;
}

/** Generates an analyst-style briefing from live stats. */
function buildBrief(s: AvatarStats, burned: number | null): string[] {
  const lines: string[] = [];
  const chg = s.change24h ?? 0;
  const mcap = s.mcap ?? 0;
  const liq = s.liquidity ?? 0;
  const vol = 0; // volume not in AvatarStats; skip

  // trend
  if (chg >= 15) lines.push(`Momentum is violent to the upside — ORBITX is up ${chg.toFixed(1)}% in 24h. This is breakout behavior, not drift.`);
  else if (chg >= 5) lines.push(`Strong session — up ${chg.toFixed(1)}% in 24h with buyers clearly in control.`);
  else if (chg >= 0) lines.push(`Holding steady at ${fmtPrice(s.price)}, up ${chg.toFixed(1)}% on the day. Coiled, not weak.`);
  else if (chg > -10) lines.push(`Cooling off — down ${Math.abs(chg).toFixed(1)}% in 24h. Dips at this market cap are where positions get built.`);
  else lines.push(`Deep red day — down ${Math.abs(chg).toFixed(1)}%. Volatility is the price of admission this early.`);

  // liquidity health
  if (mcap > 0 && liq > 0) {
    const ratio = liq / mcap;
    if (ratio >= 0.4) lines.push(`Liquidity is deep at ${fmtUsdShort(liq)} (${(ratio * 100).toFixed(0)}% of mcap) — slippage stays low even on size.`);
    else if (ratio >= 0.15) lines.push(`Liquidity at ${fmtUsdShort(liq)} is workable — ${(ratio * 100).toFixed(0)}% of mcap. Fine for normal flow.`);
    else lines.push(`Liquidity is thin at ${fmtUsdShort(liq)} — size your entries, this thing moves fast.`);
  }

  // burns
  if (burned != null && burned > 0) {
    lines.push(`${fmtUsdShort(burned)} ORBITX burned forever. Supply only goes one direction.`);
  }

  // stage outlook
  const mins = [0, 10_000, 25_000, 100_000, 500_000, 2_000_000];
  const worlds = ["Pod", "Office", "Studio", "Headquarters", "Sky Tower", "Metropolis"];
  let stage = 0;
  for (let i = 5; i >= 0; i--) if (mcap >= mins[i]) { stage = i; break; }
  if (stage < 5) {
    const toGo = mins[stage + 1] - mcap;
    lines.push(`${fmtUsdShort(toGo)} of market cap unlocks ${worlds[stage + 1]} — the city literally grows as you buy.`);
  } else {
    lines.push(`Metropolis achieved. Orbit runs a full city now — 7 agents on duty.`);
  }
  void vol;
  return lines;
}

/** AI analyst brief with typing effect. */
export function AIBrief({ stats, burned }: { stats: AvatarStats; burned: number | null }) {
  const lines = useMemo(() => buildBrief(stats, burned), [stats, burned]);
  const full = useMemo(() => lines.join("\n\n"), [lines]);
  const [shown, setShown] = useState(0);
  const key = useMemo(() => `${stats.price}-${stats.mcap}-${stats.change24h}`, [stats.price, stats.mcap, stats.change24h]);

  useEffect(() => {
    setShown(0);
    let i = 0;
    const id = setInterval(() => {
      i += 3;
      setShown(i);
      if (i >= full.length) clearInterval(id);
    }, 24);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const text = full.slice(0, shown);
  const done = shown >= full.length;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-violet-300/20 bg-gradient-to-br from-violet-500/[0.08] via-transparent to-teal-500/[0.06] p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-400/15 text-violet-300">
          <Brain className="h-4 w-4" />
        </span>
        <div>
          <p className="flex items-center gap-1.5 text-sm font-extrabold">
            Orbit AI brief <Sparkles className="h-3.5 w-3.5 text-violet-300" />
          </p>
          <p className="text-[11px] text-white/45">Live analysis · updates with the market</p>
        </div>
        <span className="ml-auto flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold text-emerald-300">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> LIVE
        </span>
      </div>
      <div className="mt-3 min-h-[120px] whitespace-pre-wrap text-[13px] leading-relaxed text-white/80">
        {text}
        {!done && <span className="ml-0.5 inline-block h-4 w-2 animate-pulse bg-violet-300/80" />}
      </div>
    </div>
  );
}
