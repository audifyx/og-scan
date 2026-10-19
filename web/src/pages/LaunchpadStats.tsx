/**
 * LaunchpadStats — stats dashboard for the OrbitX Launchpad.
 * Read-only aggregates over launchpad_tokens. No wallet, no trading.
 */
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface LaunchToken {
  mint: string;
  name: string;
  symbol: string;
  image_url: string | null;
  status: string;
  price_usd: number | null;
  market_cap_usd: number | null;
  creator_username: string | null;
  created_at: string;
}

function fmtUsd(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function fmtNum(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return `${n}`;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function dayLabel(d: Date): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return days[d.getDay()];
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-xs font-bold uppercase tracking-widest text-white/40">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-tight">{value}</p>
      {sub && <p className="mt-1 text-xs text-white/40">{sub}</p>}
    </div>
  );
}

export default function LaunchpadStats() {
  const [tokens, setTokens] = useState<LaunchToken[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("launchpad_tokens")
        .select("mint,name,symbol,image_url,status,price_usd,market_cap_usd,creator_username,created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (!cancelled) {
        setTokens((data || []) as LaunchToken[]);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const total = tokens.length;
  const byStatus = {
    live: tokens.filter((t) => t.status === "live").length,
    trending: tokens.filter((t) => t.status === "trending").length,
    graduated: tokens.filter((t) => t.status === "graduated").length,
  };
  const totalMcap = tokens.reduce((s, t) => s + (t.market_cap_usd || 0), 0);
  const avgMcap = total > 0 ? totalMcap / total : 0;

  const top5 = [...tokens]
    .sort((a, b) => (b.market_cap_usd || 0) - (a.market_cap_usd || 0))
    .slice(0, 5);

  // Launches per day, last 7 days
  const days: { date: Date; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    days.push({ date: d, count: 0 });
  }
  const dayMap = new Map(days.map((d) => [dayKey(d.date), d]));
  for (const t of tokens) {
    const k = dayKey(new Date(t.created_at));
    const d = dayMap.get(k);
    if (d) d.count++;
  }
  const maxDay = Math.max(1, ...days.map((d) => d.count));

  // Top creators
  const creatorCounts = new Map<string, number>();
  for (const t of tokens) {
    const c = t.creator_username || "anonymous";
    creatorCounts.set(c, (creatorCounts.get(c) || 0) + 1);
  }
  const topCreators = [...creatorCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const maxCreator = Math.max(1, ...topCreators.map(([, c]) => c));

  const statusSegments = [
    { label: "Live", count: byStatus.live, color: "bg-green-500" },
    { label: "Trending", count: byStatus.trending, color: "bg-orange-500" },
    { label: "Graduated", count: byStatus.graduated, color: "bg-purple-500" },
  ];
  const other = total - byStatus.live - byStatus.trending - byStatus.graduated;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 text-xl font-black">
              📊
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">Launchpad Stats</h1>
              <p className="text-sm text-white/40">Live aggregates across all launched tokens</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-2xl bg-white/5" />
            ))}
          </div>
        ) : (
          <>
            {/* Top-line stats */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Total launched" value={fmtNum(total)} sub="all-time tokens" />
              <StatCard label="Total market cap" value={fmtUsd(totalMcap)} sub="combined across all tokens" />
              <StatCard label="Avg mcap / token" value={fmtUsd(avgMcap)} sub="mean market cap" />
              <StatCard label="Graduated" value={fmtNum(byStatus.graduated)} sub={`${total > 0 ? ((byStatus.graduated / total) * 100).toFixed(1) : 0}% of launches`} />
            </div>

            {/* Status breakdown */}
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-lg font-bold">By status</h2>
              {total > 0 ? (
                <>
                  <div className="mt-4 flex h-4 w-full overflow-hidden rounded-full bg-white/5">
                    {statusSegments.map((s) => (
                      <div
                        key={s.label}
                        className={`${s.color} h-full`}
                        style={{ width: `${(s.count / total) * 100}%` }}
                        title={`${s.label}: ${s.count}`}
                      />
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-4">
                    {statusSegments.map((s) => (
                      <div key={s.label} className="flex items-center gap-2 text-sm">
                        <span className={`h-3 w-3 rounded-full ${s.color}`} />
                        <span className="text-white/60">{s.label}</span>
                        <span className="font-bold">{s.count}</span>
                      </div>
                    ))}
                    {other > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="h-3 w-3 rounded-full bg-white/20" />
                        <span className="text-white/60">Other</span>
                        <span className="font-bold">{other}</span>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <p className="mt-4 text-sm text-white/40">No tokens yet</p>
              )}
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              {/* Top 5 by mcap */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <h2 className="text-lg font-bold">Top 5 by market cap</h2>
                <div className="mt-4 space-y-3">
                  {top5.length === 0 && <p className="text-sm text-white/40">No tokens yet</p>}
                  {top5.map((t, i) => (
                    <a
                      key={t.mint}
                      href={`https://dexscreener.com/solana/${t.mint}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-xl bg-white/[0.02] p-3 transition-colors hover:bg-white/[0.05]"
                    >
                      <span className="w-6 text-center text-sm font-black text-white/30">#{i + 1}</span>
                      <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-blue-800 to-purple-800">
                        {t.image_url ? (
                          <img src={t.image_url} alt={t.symbol} className="h-full w-full object-cover" loading="lazy" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs font-black text-white/60">
                            {t.symbol.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">{t.name}</p>
                        <p className="text-xs text-white/40">${t.symbol}</p>
                      </div>
                      <p className="shrink-0 text-sm font-bold text-blue-300">{fmtUsd(t.market_cap_usd)}</p>
                    </a>
                  ))}
                </div>
              </div>

              {/* Top creators */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <h2 className="text-lg font-bold">Top creators</h2>
                <div className="mt-4 space-y-3">
                  {topCreators.length === 0 && <p className="text-sm text-white/40">No tokens yet</p>}
                  {topCreators.map(([name, count], i) => (
                    <div key={name} className="flex items-center gap-3">
                      <span className="w-6 text-center text-sm font-black text-white/30">#{i + 1}</span>
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-800 to-purple-800 text-sm font-black text-white/70">
                        {name.charAt(0).toUpperCase()}
                      </div>
                      <p className="flex-1 truncate text-sm font-bold">{name}</p>
                      <div className="flex w-32 items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
                            style={{ width: `${(count / maxCreator) * 100}%` }}
                          />
                        </div>
                        <span className="w-8 text-right text-xs font-bold text-white/60">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Launches per day */}
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-lg font-bold">Launches per day — last 7 days</h2>
              <div className="mt-6 flex items-end justify-between gap-2 sm:gap-4" style={{ height: 160 }}>
                {days.map((d, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center justify-end gap-2">
                    <span className="text-xs font-bold text-white/60">{d.count}</span>
                    <div
                      className="w-full rounded-t-lg bg-gradient-to-t from-blue-700 to-purple-500 transition-all"
                      style={{ height: `${Math.max(4, (d.count / maxDay) * 120)}px` }}
                      title={`${d.count} launches`}
                    />
                    <span className="text-[10px] font-bold uppercase text-white/40">{dayLabel(d.date)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* MCP hint footer */}
            <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-5 text-center">
              <p className="text-sm text-white/40">
                Stats update live as tokens launch via the MCP —{" "}
                <code className="rounded bg-white/5 px-2 py-0.5 text-xs text-blue-300">orbitx.world/api/mcp-launchpad</code>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
