/**
 * LaunchpadLive — clean single-page token feed for the OrbitX Launchpad.
 * Read-only: shows coins and data. No wallet connect, no trading UI.
 * All actions (launch/buy/sell) happen through the MCP.
 */
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface LaunchToken {
  mint: string;
  name: string;
  symbol: string;
  description: string | null;
  image_url: string | null;
  status: string;
  price_usd: number | null;
  market_cap_usd: number | null;
  creator_username: string | null;
  created_at: string;
}

const FILTERS = ["all", "live", "trending", "graduated"] as const;

function fmtUsd(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function statusColor(status: string): string {
  switch (status) {
    case "live": return "bg-green-500/20 text-green-300 border-green-500/30";
    case "trending": return "bg-orange-500/20 text-orange-300 border-orange-500/30";
    case "graduated": return "bg-purple-500/20 text-purple-300 border-purple-500/30";
    default: return "bg-white/10 text-white/50 border-white/10";
  }
}

export default function LaunchpadLive() {
  const [tokens, setTokens] = useState<LaunchToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let query = supabase
        .from("launchpad_tokens")
        .select("mint,name,symbol,description,image_url,status,price_usd,market_cap_usd,creator_username,created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (filter !== "all") query = query.eq("status", filter);
      const { data } = await query;
      if (!cancelled) {
        setTokens((data || []) as LaunchToken[]);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [filter]);

  const visible = search.trim()
    ? tokens.filter((t) =>
        `${t.name} ${t.symbol}`.toLowerCase().includes(search.trim().toLowerCase())
      )
    : tokens;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 text-xl font-black">
              🚀
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">Launchpad</h1>
              <p className="text-sm text-white/40">Tokens launched via the OrbitX MCP — trade through your AI, not here</p>
            </div>
          </div>

          {/* Search + filters */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tokens…"
              className="w-full sm:max-w-xs rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none placeholder:text-white/30 focus:border-blue-500/50"
            />
            <div className="flex gap-2">
              {FILTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                    filter === s ? "bg-blue-600 text-white" : "bg-white/5 text-white/50 hover:bg-white/10"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Token grid */}
      <div className="mx-auto max-w-6xl px-4 py-8">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-36 animate-pulse rounded-2xl bg-white/5" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/10 p-16 text-center">
            <p className="text-xl font-bold text-white/60">
              {search ? "No matches" : "No tokens yet"}
            </p>
            <p className="mt-2 text-sm text-white/40">
              {search ? "Try a different search" : "Launch one through the MCP to get started"}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((t) => (
              <a
                key={t.mint}
                href={`https://dexscreener.com/solana/${t.mint}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-all hover:border-blue-500/30 hover:bg-white/[0.05]"
              >
                <div className="flex items-start gap-4">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-blue-800 to-purple-800">
                    {t.image_url ? (
                      <img src={t.image_url} alt={t.symbol} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xl font-black text-white/60">
                        {t.symbol.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-bold group-hover:text-blue-300">{t.name}</h3>
                      <span className="shrink-0 rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold text-blue-300">
                        ${t.symbol}
                      </span>
                    </div>
                    <span className={`mt-1.5 inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${statusColor(t.status)}`}>
                      {t.status}
                    </span>
                  </div>
                </div>

                {t.description && (
                  <p className="mt-3 line-clamp-2 text-xs text-white/40">{t.description}</p>
                )}

                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/5 pt-3 text-xs">
                  <div>
                    <p className="text-white/30">Price</p>
                    <p className="font-bold">{fmtUsd(t.price_usd)}</p>
                  </div>
                  <div>
                    <p className="text-white/30">MCap</p>
                    <p className="font-bold">{fmtUsd(t.market_cap_usd)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white/30">{timeAgo(t.created_at)}</p>
                    {t.creator_username && <p className="truncate text-white/50">by {t.creator_username}</p>}
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}

        {/* MCP hint footer */}
        <div className="mt-12 rounded-2xl border border-white/10 bg-white/[0.02] p-5 text-center">
          <p className="text-sm text-white/40">
            Want to launch or trade? Do it through the MCP —{" "}
            <code className="rounded bg-white/5 px-2 py-0.5 text-xs text-blue-300">orbitx.world/api/mcp-launchpad</code>
          </p>
        </div>
      </div>
    </div>
  );
}
