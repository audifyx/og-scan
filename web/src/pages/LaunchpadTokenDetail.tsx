/**
 * LaunchpadTokenDetail — full detail view for one launched token.
 * Read-only: stats, description, protections. No wallet connect, no trading UI.
 * All actions (buy/sell) happen through the MCP.
 */
import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import LaunchpadComments from "@/components/LaunchpadComments";

interface TokenDetail {
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
  max_tx_pct: number | null;
  sniper_tax_bps: number | null;
  sniper_window_seconds: number | null;
  pool_type: string | null;
  initial_liquidity_usd: number | null;
}

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

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-xs font-bold uppercase tracking-widest text-white/30">{label}</p>
      <p className="mt-1.5 text-2xl font-black">{value}</p>
      {sub && <p className="mt-1 text-xs text-white/40">{sub}</p>}
    </div>
  );
}

function ProtectionRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="text-lg">{icon}</span>
        <span className="text-sm font-bold">{label}</span>
      </div>
      <span className="text-sm font-bold text-blue-300">{value}</span>
    </div>
  );
}

export default function LaunchpadTokenDetail() {
  const { mint } = useParams<{ mint: string }>();
  const [token, setToken] = useState<TokenDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!mint) { setNotFound(true); setLoading(false); return; }
      const { data } = await supabase
        .from("launchpad_tokens")
        .select("mint,name,symbol,description,image_url,status,price_usd,market_cap_usd,creator_username,created_at,max_tx_pct,sniper_tax_bps,sniper_window_seconds,pool_type,initial_liquidity_usd")
        .eq("mint", mint)
        .limit(1)
        .maybeSingle();
      if (!cancelled) {
        if (!data) setNotFound(true);
        else setToken(data as TokenDetail);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [mint]);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Back */}
        <Link
          to="/launchpad/live"
          className="inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-sm font-bold text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          ← Back to feed
        </Link>

        {loading ? (
          <div className="mt-8 space-y-4">
            <div className="h-32 animate-pulse rounded-2xl bg-white/5" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/5" />
              ))}
            </div>
          </div>
        ) : notFound || !token ? (
          <div className="mt-8 rounded-3xl border border-dashed border-white/10 p-16 text-center">
            <p className="text-xl font-bold text-white/60">Token not found</p>
            <p className="mt-2 text-sm text-white/40">This mint isn't on the launchpad</p>
          </div>
        ) : (
          <div className="mt-8">
            {/* Header */}
            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-blue-900/20 via-purple-900/10 to-black p-6 sm:p-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-blue-800 to-purple-800">
                  {token.image_url ? (
                    <img src={token.image_url} alt={token.symbol} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-4xl font-black text-white/60">
                      {token.symbol.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-3xl font-black tracking-tight">{token.name}</h1>
                    <span className="rounded-full bg-blue-500/20 px-3 py-1 text-xs font-bold text-blue-300">
                      ${token.symbol}
                    </span>
                    <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase ${statusColor(token.status)}`}>
                      {token.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-white/40">
                    {token.creator_username ? `by ${token.creator_username} · ` : ""}launched {timeAgo(token.created_at)}
                  </p>
                  <p className="mt-2 truncate font-mono text-xs text-white/30" title={token.mint}>
                    {token.mint}
                  </p>
                </div>
              </div>
            </div>

            {/* Stats grid */}
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard label="Price" value={fmtUsd(token.price_usd)} />
              <StatCard label="Market Cap" value={fmtUsd(token.market_cap_usd)} />
              <StatCard
                label="Liquidity"
                value={fmtUsd(token.initial_liquidity_usd)}
                sub={token.pool_type ? `${token.pool_type.toUpperCase()} pool` : undefined}
              />
              <StatCard label="Status" value={token.status} sub="via MCP launch" />
            </div>

            {/* Description */}
            {token.description && (
              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <h2 className="text-sm font-bold uppercase tracking-widest text-white/40">About</h2>
                <p className="mt-2 text-sm leading-relaxed text-white/70">{token.description}</p>
              </div>
            )}

            {/* Protections */}
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-sm font-bold uppercase tracking-widest text-white/40">Launch protections</h2>
              <div className="mt-4 space-y-2">
                <ProtectionRow
                  icon="🛡️"
                  label="Max tx size"
                  value={token.max_tx_pct != null ? `${token.max_tx_pct}% of supply` : "—"}
                />
                <ProtectionRow
                  icon="🎯"
                  label="Sniper tax"
                  value={
                    token.sniper_tax_bps != null
                      ? `${(token.sniper_tax_bps / 100).toFixed(0)}% for first ${
                          token.sniper_window_seconds != null ? Math.floor(token.sniper_window_seconds / 60) : 5
                        } min`
                      : "—"
                  }
                />
                <ProtectionRow icon="🚫" label="Anti-duplicate" value="Enforced" />
                <ProtectionRow
                  icon="💧"
                  label="Pool type"
                  value={token.pool_type ? token.pool_type.toUpperCase() : "—"}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a
                href={`https://dexscreener.com/solana/${token.mint}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 rounded-2xl bg-blue-600 px-6 py-4 text-center font-bold transition-colors hover:bg-blue-700"
              >
                View on DexScreener ↗
              </a>
            </div>

            {/* MCP hint */}
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5 text-center">
              <p className="text-sm text-white/40">
                Want to buy or sell <span className="font-bold text-white/70">${token.symbol}</span>? Do it through the MCP —{" "}
                <code className="rounded bg-white/5 px-2 py-0.5 text-xs text-blue-300">orbitx.world/api/mcp-launchpad</code>
              </p>
              <p className="mt-2 font-mono text-xs text-white/30">
                "Buy 0.5 SOL of ${token.symbol}" — your AI handles the rest
              </p>
            </div>

            {/* Comments */}
            <div className="mt-6">
              <LaunchpadComments mint={token.mint} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
