import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, Brain } from "lucide-react";
import type { AvatarStats } from "./LivingAvatar";
import { fmtUsdShort, fmtPriceSmart } from "./TokenWidgets";

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
  else if (chg >= 0) lines.push(`Holding steady at ${fmtPriceSmart(s.price)}, up ${chg.toFixed(1)}% on the day. Coiled, not weak.`);
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
    const b = burned >= 1_000_000 ? `${(burned / 1_000_000).toFixed(2)}M` : burned >= 1_000 ? `${(burned / 1_000).toFixed(1)}k` : burned.toFixed(0);
    lines.push(`${b} ORBITX burned forever. Supply only goes one direction.`);
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

const STAGE_MINS = [0, 10_000, 25_000, 100_000, 500_000, 2_000_000];

/** Semantic key — only changes when the *meaning* of the brief changes, not on every price tick. */
function semanticKey(s: AvatarStats, burned: number | null): string {
  const chg = s.change24h ?? 0;
  const trend = chg >= 15 ? "moon" : chg >= 5 ? "strong" : chg >= 0 ? "steady" : chg > -10 ? "cool" : "red";
  const mcap = s.mcap ?? 0;
  const liq = s.liquidity ?? 0;
  const lr = mcap > 0 && liq > 0 ? liq / mcap : 0;
  const liqb = lr >= 0.4 ? "deep" : lr >= 0.15 ? "ok" : "thin";
  let stage = 0;
  for (let i = 5; i >= 0; i--) if (mcap >= STAGE_MINS[i]) { stage = i; break; }
  const burnM = burned != null && burned > 0 ? Math.floor(burned / 5_000_000) : 0;
  return `${trend}|${liqb}|${stage}|${burnM}`;
}

/** AI analyst brief with typing effect. Only re-types when the story changes. */
export function AIBrief({ stats, burned }: { stats: AvatarStats; burned: number | null }) {
  const lines = useMemo(() => buildBrief(stats, burned), [stats, burned]);
  const full = useMemo(() => lines.join("\n\n"), [lines]);
  const key = useMemo(() => semanticKey(stats, burned), [stats, burned]);
  const [shown, setShown] = useState(0);
  const keyRef = useRef(key);
  const fullRef = useRef(full);
  fullRef.current = full;

  // A new story -> restart typing from zero. Same story, new numbers -> no flash.
  useEffect(() => {
    if (key !== keyRef.current) {
      keyRef.current = key;
      setShown(0);
    }
  }, [key]);

  // Numbers ticked but story is the same: if we already finished typing,
  // snap to the new end instantly instead of replaying.
  const prevLenRef = useRef(full.length);
  useEffect(() => {
    setShown((s) => (s >= prevLenRef.current ? full.length : s));
    prevLenRef.current = full.length;
  }, [full]);

  // Steady typing toward the current end.
  useEffect(() => {
    const id = setInterval(() => {
      setShown((s) => Math.min(s + 5, fullRef.current.length));
    }, 24);
    return () => clearInterval(id);
  }, []);

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
