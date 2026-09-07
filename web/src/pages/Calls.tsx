/**
 * /calls — every token call made through OrbitX MCP, Telegram, and web tools.
 * Reads public.orbitx_calls + orbitx_calls_top (RLS public read) and prices
 * the leaderboard live from DexScreener.
 */
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Activity, Clock, Flame, Loader2, Megaphone, TrendingDown, TrendingUp } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { dexPairsForMints, fmtUsd, shortAddr } from "@/lib/og";

type CallRow = {
  id: string;
  source: string;
  tool: string;
  chain: string;
  mint: string;
  symbol: string | null;
  name: string | null;
  price_usd: number | null;
  mc_usd: number | null;
  verdict: string | null;
  created_at: string;
};

type TopRow = {
  mint: string;
  chain: string;
  symbol: string | null;
  name: string | null;
  calls: number;
  calls_24h: number;
  first_called_at: string;
  last_called_at: string;
  first_price_usd: number | null;
  last_mc_usd: number | null;
};

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

const toolLabel = (t: string) => t.replace(/^orbitx_/, "").replace(/_/g, " ");

export default function Calls() {
  const feed = useQuery({
    queryKey: ["orbitx-calls-feed"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orbitx_calls")
        .select("id,source,tool,chain,mint,symbol,name,price_usd,mc_usd,verdict,created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as CallRow[];
    },
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  const top = useQuery({
    queryKey: ["orbitx-calls-top"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orbitx_calls_top")
        .select("*")
        .order("calls_24h", { ascending: false })
        .order("calls", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data || []) as TopRow[];
    },
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

  const topMints = useMemo(() => (top.data || []).filter((r) => r.chain === "solana").map((r) => r.mint), [top.data]);
  const live = useQuery({
    queryKey: ["orbitx-calls-live", topMints.join(",")],
    enabled: topMints.length > 0,
    queryFn: async () => {
      const pairs = await dexPairsForMints(topMints);
      const byMint = new Map<string, { price: number; mc: number }>();
      for (const p of pairs) {
        const mint = p.baseToken?.address;
        if (!mint || byMint.has(mint)) continue;
        byMint.set(mint, { price: Number(p.priceUsd) || 0, mc: Number(p.marketCap ?? p.fdv) || 0 });
      }
      return byMint;
    },
    refetchInterval: 30_000,
  });

  const total = feed.data?.length ?? 0;
  const last24 = (feed.data || []).filter((r) => Date.now() - new Date(r.created_at).getTime() < 86_400_000).length;

  return (
    <div className="relative mx-auto max-w-5xl px-4 py-8">
      <div className="pointer-events-none absolute -top-40 left-[20%] h-[500px] w-[500px] rounded-full bg-og-cyan/10 blur-[140px]" />
      <header className="relative mb-6">
        <div className="font-mono text-xs uppercase tracking-[0.2em] text-og-cyan">live tape</div>
        <h1 className="font-display text-3xl font-black text-white text-glow">OrbitX Calls</h1>
        <p className="mt-1 text-sm text-white/60">
          Every token pulled through the OrbitX MCP, Telegram bot, and web intel tools. Tracked on-chain-time, priced live.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Stat icon={<Activity className="h-3.5 w-3.5" />} label="Tracked" value={total >= 100 ? "100+" : String(total)} />
          <Stat icon={<Flame className="h-3.5 w-3.5" />} label="Last 24h" value={String(last24)} />
          <Stat icon={<Megaphone className="h-3.5 w-3.5" />} label="Tokens" value={String(top.data?.length ?? 0)} />
        </div>
      </header>

      <section className="glass-card mb-6 rounded-xl border border-white/10 p-4">
        <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.16em] text-white/60">Most called</h2>
        {top.isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-white/50" />
        ) : !top.data?.length ? (
          <p className="text-sm text-white/50">No calls tracked yet. Run <code>/get_token</code> in @theorbitxmcpbot or call <code>orbitx_get_token</code> from any MCP client.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {top.data.map((r) => {
              const now = live.data?.get(r.mint);
              const mult = now?.price && r.first_price_usd ? now.price / r.first_price_usd : null;
              const up = mult != null && mult >= 1;
              return (
                <Link
                  key={r.mint}
                  to={`/ORBITX_DEX/token/${r.mint}`}
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 transition hover:border-og-cyan/40"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-white">{r.symbol || r.name || shortAddr(r.mint)}</div>
                    <div className="font-mono text-[11px] text-white/50">{shortAddr(r.mint)} · {r.calls} calls · {r.calls_24h} today</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm text-white">{now?.price ? fmtUsd(now.price) : r.first_price_usd ? fmtUsd(r.first_price_usd) : "—"}</div>
                    {mult != null && (
                      <div className={`flex items-center justify-end gap-1 font-mono text-[11px] ${up ? "text-og-lime" : "text-og-blood"}`}>
                        {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {mult.toFixed(2)}x since first call
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="glass-card rounded-xl border border-white/10 p-4">
        <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.16em] text-white/60">Latest calls</h2>
        {feed.isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-white/50" />
        ) : feed.error ? (
          <p className="text-sm text-og-blood">Could not load calls: {String((feed.error as Error).message)}</p>
        ) : !feed.data?.length ? (
          <p className="text-sm text-white/50">Nothing yet.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {feed.data.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <Link to={`/ORBITX_DEX/token/${c.mint}`} className="truncate text-sm font-semibold text-white hover:text-og-cyan">
                    {c.symbol || c.name || shortAddr(c.mint)}
                  </Link>
                  <div className="truncate font-mono text-[11px] text-white/50">
                    {shortAddr(c.mint)} · {c.source} · {toolLabel(c.tool)}
                    {c.verdict ? ` · ${c.verdict}` : ""}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-mono text-xs text-white">{c.price_usd ? fmtUsd(c.price_usd) : c.mc_usd ? `${fmtUsd(c.mc_usd)} mc` : ""}</div>
                  <div className="flex items-center justify-end gap-1 font-mono text-[11px] text-white/40">
                    <Clock className="h-3 w-3" /> {timeAgo(c.created_at)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5">
      <span className="text-og-cyan">{icon}</span>
      <span className="font-mono text-[11px] uppercase tracking-wider text-white/50">{label}</span>
      <span className="font-mono text-sm font-bold text-white">{value}</span>
    </div>
  );
}
