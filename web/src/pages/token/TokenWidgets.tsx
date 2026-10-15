import { useEffect, useRef, useState } from "react";
import { Rocket } from "lucide-react";
import { cn } from "@/lib/utils";

/** Smoothly animates toward a numeric target. */
export function useCountUp(target: number | null | undefined, duration = 900): number | null {
  const [val, setVal] = useState<number | null>(target ?? null);
  const fromRef = useRef<number | null>(null);
  const rafRef = useRef(0);
  useEffect(() => {
    if (target == null || !isFinite(target)) { setVal(null); return; }
    const from = fromRef.current ?? target;
    if (from === target) { setVal(target); return; }
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      setVal(from + (target - from) * e);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);
  return val;
}

export function fmtUsdShort(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

/** Animated stat card with count-up value. */
export function StatCard({ label, value, sub, subUp }: { label: string; value: string; sub?: string | null; subUp?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-2 py-3 text-center transition-colors hover:border-teal-300/25">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">{label}</p>
      <p className="mt-1 truncate text-[15px] font-extrabold tabular-nums">{value}</p>
      {sub && <p className={cn("text-[11px] font-bold tabular-nums", subUp ? "text-emerald-400" : "text-rose-400")}>{sub}</p>}
    </div>
  );
}

/** Scrolling live-stats ticker tape. */
export function TickerTape({ items }: { items: string[] }) {
  const row = [...items, ...items];
  return (
    <div className="relative overflow-hidden border-y border-white/10 bg-black/60 py-2">
      <div className="flex w-max animate-[ticker_28s_linear_infinite] gap-8 whitespace-nowrap px-4">
        {row.map((t, i) => (
          <span key={i} className="text-xs font-semibold tracking-wide text-teal-200/80">{t}</span>
        ))}
      </div>
      <style>{`@keyframes ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
    </div>
  );
}

const STAGE_NAMES = ["Egg", "Sprout", "Whelp", "Guardian", "Titan", "Cosmic"];
const WORLD_NAMES = ["Pod", "Office", "Studio", "Headquarters", "Sky Tower", "Metropolis"];
const STAGE_MIN = [0, 10_000, 25_000, 100_000, 500_000, 2_000_000];

/** Evolution progress: current stage -> next, animated bar. */
export function StageProgress({ mcap, stage }: { mcap: number | null | undefined; stage: number }) {
  const animated = useCountUp(mcap ?? null, 1200) ?? 0;
  const isMax = stage >= 5;
  const min = STAGE_MIN[stage];
  const max = isMax ? null : STAGE_MIN[stage + 1];
  const pct = max == null ? 100 : Math.min(100, Math.max(0, ((animated - min) / (max - min)) * 100));
  const toGo = max == null ? 0 : Math.max(0, max - (mcap ?? 0));

  return (
    <div className="relative overflow-hidden rounded-3xl border border-teal-300/20 bg-gradient-to-br from-teal-500/[0.08] via-transparent to-violet-500/[0.08] p-4">
      <div className="pointer-events-none absolute inset-0 animate-[shimmer_3.5s_linear_infinite] bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />
      <style>{`@keyframes shimmer { from { transform: translateX(-100%); } to { transform: translateX(100%); } }`}</style>
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-400/15 text-teal-300">
            <Rocket className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-extrabold">World evolution</p>
            <p className="text-[11px] text-white/45">{WORLD_NAMES[stage]} · {STAGE_NAMES[stage]}</p>
          </div>
        </div>
        {!isMax && (
          <div className="text-right">
            <p className="text-sm font-extrabold text-teal-300">{fmtUsdShort(toGo)}</p>
            <p className="text-[11px] text-white/45">to {WORLD_NAMES[stage + 1]}</p>
          </div>
        )}
        {isMax && <p className="text-sm font-extrabold text-amber-300">MAXIMUM POWER</p>}
      </div>
      {/* stage dots */}
      <div className="relative mt-3 flex items-center justify-between px-0.5">
        {STAGE_NAMES.map((n, i) => (
          <div key={n} className="flex flex-col items-center gap-1">
            <span className={cn(
              "h-2.5 w-2.5 rounded-full transition-all",
              i < stage && "bg-teal-400",
              i === stage && "animate-pulse bg-teal-300 shadow-[0_0_10px_2px_rgba(45,212,191,0.6)]",
              i > stage && "bg-white/15",
            )} />
          </div>
        ))}
        <div className="absolute left-1 right-1 top-[5px] -z-0 h-0.5 bg-white/10" />
      </div>
      {/* progress bar */}
      <div className="relative mt-2 h-2.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-teal-400 via-cyan-300 to-violet-400 transition-[width] duration-1000"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="relative mt-1.5 text-center text-[11px] font-semibold text-white/40">
        {isMax ? "Orbit's metropolis is complete. The city is his now." : `${pct.toFixed(1)}% to ${WORLD_NAMES[stage + 1]} · every buy builds the city`}
      </p>
    </div>
  );
}
