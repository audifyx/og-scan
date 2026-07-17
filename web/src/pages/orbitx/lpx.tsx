// OrbitX Launchpad V3 — shared HUD primitives + REAL-data hooks.
// Every number rendered through these hooks comes from a live source:
//   • orbitx_tokens registry (Supabase)        → launches, lanes, flags
//   • DexScreener                              → mcap / liquidity / volume / Δ
//   • Solana RPC (Helius)                      → slot, TPS, RPC latency
//   • CoinGecko (via fee lib, 60s cache)       → SOL/USD
// Nothing here is mocked. All hooks fail soft (null → UI renders "—").
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { HELIUS_RPC, dexPairsForMints } from "@/lib/og";
import { getSolUsd } from "@/lib/orbitx/fee";
import { listTokens, type OrbitxToken } from "@/lib/orbitx/registry";

/* ────────────────────────── formatting ────────────────────────── */

export const fmtCompactUsd = (v?: number | null): string => {
  if (v == null || !Number.isFinite(v)) return "—";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(v >= 1 ? 2 : 4)}`;
};

export const fmtInt = (v?: number | null): string =>
  v == null || !Number.isFinite(v) ? "—" : Math.round(v).toLocaleString();

/* ─────────────────────── Solana telemetry ─────────────────────── */

export interface ChainTelemetry {
  ok: boolean;
  slot: number | null;
  tps: number | null;
  latencyMs: number | null;
}

async function rpc<T>(method: string, params: unknown[] = []): Promise<T | null> {
  try {
    const r = await fetch(HELIUS_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { result?: T };
    return j.result ?? null;
  } catch {
    return null;
  }
}

/** Live chain telemetry straight from mainnet RPC. Polls every 15s. */
export function useChainTelemetry() {
  return useQuery<ChainTelemetry>({
    queryKey: ["lpx-telemetry"],
    refetchInterval: 15_000,
    queryFn: async () => {
      const t0 = performance.now();
      const slot = await rpc<number>("getSlot", [{ commitment: "processed" }]);
      const latencyMs = Math.round(performance.now() - t0);
      let tps: number | null = null;
      const samples = await rpc<Array<{ numTransactions: number; samplePeriodSecs: number }>>(
        "getRecentPerformanceSamples",
        [4],
      );
      if (samples && samples.length > 0) {
        const tx = samples.reduce((a, s) => a + (s.numTransactions || 0), 0);
        const secs = samples.reduce((a, s) => a + (s.samplePeriodSecs || 0), 0);
        if (secs > 0) tps = Math.round(tx / secs);
      }
      return { ok: typeof slot === "number", slot, tps, latencyMs: slot == null ? null : latencyMs };
    },
  });
}

/** Live SOL/USD (60s cache inside fee lib). */
export function useSolUsd() {
  return useQuery({
    queryKey: ["lpx-solusd"],
    refetchInterval: 60_000,
    queryFn: () => getSolUsd(),
  });
}

/* ─────────────────────── registry aggregate ───────────────────── */

export function useAllLaunches() {
  return useQuery({
    queryKey: ["lpx-launches-all"],
    refetchInterval: 30_000,
    queryFn: () => listTokens("all", 100),
  });
}

export interface LaunchStats {
  total: number;
  last24h: number;
  graduated: number;
  flagged: number;
  pump: number;
  custom: number;
}

export function launchStats(tokens: OrbitxToken[] | undefined): LaunchStats {
  const t = tokens ?? [];
  const dayAgo = Date.now() - 86_400_000;
  return {
    total: t.length,
    last24h: t.filter((x) => new Date(x.created_at).getTime() >= dayAgo).length,
    graduated: t.filter((x) => x.lp_pool_address).length,
    flagged: t.filter((x) => x.is_vamp).length,
    pump: t.filter((x) => x.launch_type === "pump").length,
    custom: t.filter((x) => x.launch_type === "custom").length,
  };
}

/* ─────────────────────── DexScreener market ───────────────────── */

export interface MarketRow {
  mcap: number | null;
  liq: number | null;
  vol24: number | null;
  ch24: number | null;
  ch6: number | null;
  ch1: number | null;
  ch5m: number | null;
  url: string | null;
}

/** Best pair per mint from DexScreener — real mcap / liq / vol / Δ. */
export function useMarketMap(mints: string[]) {
  const key = useMemo(() => mints.slice().sort().join(","), [mints]);
  return useQuery({
    queryKey: ["lpx-market", key],
    enabled: mints.length > 0,
    refetchInterval: 60_000,
    queryFn: async (): Promise<Record<string, MarketRow>> => {
      const out: Record<string, MarketRow> = {};
      try {
        const pairs = await dexPairsForMints(mints);
        for (const p of pairs) {
          const addr = p.baseToken?.address;
          if (!addr) continue;
          const mcap = (p.marketCap ?? p.fdv) || null;
          const liq = p.liquidity?.usd ?? null;
          const vol24 = p.volume?.h24 ?? null;
          const prev = out[addr];
          if (prev && (prev.liq ?? 0) >= (liq ?? 0)) continue; // keep deepest pool
          out[addr] = {
            mcap,
            liq,
            vol24,
            ch24: p.priceChange?.h24 ?? null,
            ch6: p.priceChange?.h6 ?? null,
            ch1: p.priceChange?.h1 ?? null,
            ch5m: p.priceChange?.m5 ?? null,
            url: p.url ?? null,
          };
        }
      } catch {
        /* fail soft */
      }
      return out;
    },
  });
}

/** Sum of real pool liquidity across all launched tokens. */
export function totalLpUsd(market: Record<string, MarketRow> | undefined): number | null {
  if (!market) return null;
  const vals = Object.values(market).map((m) => m.liq ?? 0);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0);
}

/* ──────────────────────── HUD primitives ──────────────────────── */

export function Panel({
  title,
  icon,
  right,
  tone,
  hot,
  className = "",
  bodyClassName = "",
  children,
}: {
  title?: React.ReactNode;
  icon?: React.ReactNode;
  right?: React.ReactNode;
  tone?: "gold";
  hot?: boolean;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`lpx-panel ${tone === "gold" ? "lpx-panel--gold" : ""} ${hot ? "lpx-panel--hot" : ""} ${className}`}
    >
      {title != null && (
        <header className={`lpx-panel-title ${tone === "gold" ? "!text-[hsl(var(--og-gold))]" : ""}`}>
          {icon}
          <span className="flex-1">{title}</span>
          {right}
        </header>
      )}
      <div className={bodyClassName || "p-3"}>{children}</div>
    </section>
  );
}

/** Real 24h → now micro-trend rebuilt from DexScreener Δ% checkpoints. */
export function Spark({ m, width = 72, height = 22 }: { m?: MarketRow | null; width?: number; height?: number }) {
  const pts = useMemo(() => {
    if (!m) return null;
    const now = 1;
    const at = (ch: number | null) => (ch == null ? null : now / (1 + ch / 100));
    const series = [at(m.ch24), at(m.ch6), at(m.ch1), at(m.ch5m), now].filter(
      (v): v is number => v != null && Number.isFinite(v) && v > 0,
    );
    if (series.length < 2) return null;
    const min = Math.min(...series);
    const max = Math.max(...series);
    const span = max - min || 1;
    return series
      .map((v, i) => {
        const x = (i / (series.length - 1)) * (width - 2) + 1;
        const y = height - 3 - ((v - min) / span) * (height - 6);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [m, width, height]);

  const up = (m?.ch24 ?? 0) >= 0;
  if (!pts)
    return (
      <svg width={width} height={height} className="opacity-25">
        <line x1="2" y1={height / 2} x2={width - 2} y2={height / 2} stroke="currentColor" strokeDasharray="3 3" strokeWidth="1" />
      </svg>
    );
  return (
    <svg width={width} height={height}>
      <polyline
        points={pts}
        fill="none"
        stroke={up ? "hsl(132 100% 54%)" : "hsl(0 92% 62%)"}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 3px ${up ? "hsl(132 100% 54% / 0.8)" : "hsl(0 92% 62% / 0.8)"})` }}
      />
    </svg>
  );
}

export function Delta({ v }: { v?: number | null }) {
  if (v == null || !Number.isFinite(v)) return <span className="font-mono text-[10px] text-muted-foreground">—</span>;
  const up = v >= 0;
  return (
    <span className={`font-mono text-[10px] font-bold ${up ? "text-[hsl(var(--og-lime))]" : "text-[hsl(var(--og-blood))]"}`}>
      {up ? "▲" : "▼"} {Math.abs(v).toFixed(1)}%
    </span>
  );
}

export function KV({ k, v, tone }: { k: string; v: React.ReactNode; tone?: "lime" | "gold" | "dim" }) {
  const c =
    tone === "gold"
      ? "text-[hsl(var(--og-gold))]"
      : tone === "dim"
        ? "text-muted-foreground"
        : "text-[hsl(var(--og-lime))]";
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{k}</span>
      <span className={`font-mono text-[11px] font-bold ${c}`}>{v}</span>
    </div>
  );
}

/* ── Shared confetti burst (success screens) ── */
const LPX_CONFETTI_COLORS = [
  "hsl(132 100% 54%)", "hsl(44 96% 56%)", "hsl(158 92% 48%)",
  "hsl(300 100% 62%)", "#ffffff",
];

export function Confetti({ count = 40 }: { count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: `${6 + Math.random() * 88}%`,
        top: `${15 + Math.random() * 35}%`,
        dx: `${(Math.random() - 0.5) * 240}px`,
        dy: `${-60 - Math.random() * 170}px`,
        rot: `${Math.random() * 720 - 360}deg`,
        t: `${1 + Math.random() * 1.2}s`,
        d: `${Math.random() * 0.4}s`,
        color: LPX_CONFETTI_COLORS[i % LPX_CONFETTI_COLORS.length],
      })),
    [count],
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="lpx-confetti-piece"
          style={{
            left: p.left, top: p.top, background: p.color,
            "--dx": p.dx, "--dy": p.dy, "--rot": p.rot, "--t": p.t, "--d": p.d,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
