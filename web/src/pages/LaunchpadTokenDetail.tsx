/**
 * LaunchpadTokenDetail — full detail view for one launched token.
 * Read-only: stats, description, protections. No wallet connect, no trading UI.
 * All actions (buy/sell) happen through the MCP.
 * Premium treatment: gold/black theme, OG score + bonding progress, SVG icons.
 */
import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Copy, Check, ExternalLink, Flame, ShieldCheck, Target, Droplets, Ban, Rocket } from "lucide-react";
import { supabase } from "@/lib/supabase";
import LaunchpadComments from "@/components/LaunchpadComments";
import LaunchpadShareButton from "@/components/LaunchpadShareButton";

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

/** Bonding-curve graduation estimate (pump.fun-style curve completes ~$69K mcap). */
const GRADUATION_MCAP = 69_000;

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

/**
 * Launchpad OG score (0–100), estimated from the data this page actually has:
 * market cap, age, and status. Not a price prediction — a quick read on how
 * far a launch has come.
 */
function ogScore(t: TokenDetail): number {
  let s = 30;
  const m = t.market_cap_usd || 0;
  if (m >= 1e6) s += 35;
  else if (m >= 200_000) s += 28;
  else if (m >= GRADUATION_MCAP) s += 20;
  else if (m >= 10_000) s += 12;
  else if (m > 0) s += 5;
  if (t.status === "graduated") s += 15;
  else if (t.status === "trending") s += 8;
  const ageH = (Date.now() - new Date(t.created_at).getTime()) / 3600000;
  if (ageH > 24) s += 5;
  else if (ageH > 6) s += 3;
  return Math.min(100, Math.max(0, s));
}

function bondingProgress(t: TokenDetail): number {
  const m = t.market_cap_usd || 0;
  if (t.status === "graduated") return 100;
  return Math.min(100, Math.round((m / GRADUATION_MCAP) * 100));
}

function statusColor(status: string): string {
  switch (status) {
    case "live": return "bg-green-500/20 text-green-300 border-green-500/30";
    case "trending": return "bg-[#e8b84a]/15 text-[#f6d47c] border-[#e8b84a]/30";
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

function ProtectionRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="text-[#f6d47c]">{icon}</span>
        <span className="text-sm font-bold">{label}</span>
      </div>
      <span className="text-sm font-bold text-[#f6d47c]">{value}</span>
    </div>
  );
}

export default function LaunchpadTokenDetail() {
  const { mint } = useParams<{ mint: string }>();
  const [token, setToken] = useState<TokenDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const copyMint = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token.mint);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  };

  const score = token ? ogScore(token) : 0;
  const progress = token ? bondingProgress(token) : 0;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Back */}
        <Link
          to="/launchpad/live"
          className="inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-sm font-bold text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Back to feed
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
            <div className="rounded-3xl border border-[#e8b84a]/25 bg-gradient-to-br from-[#e8b84a]/10 via-black to-black p-6 sm:p-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-[#e8b84a]/30 to-[#b98a1e]/20">
                  {token.image_url ? (
                    <img src={token.image_url} alt={token.symbol} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-4xl font-black text-[#f6d47c]/70">
                      {token.symbol.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="font-[Syne,sans-serif] text-3xl font-black tracking-tight">{token.name}</h1>
                    <span className="rounded-full bg-[#e8b84a]/15 px-3 py-1 text-xs font-bold text-[#f6d47c]">
                      ${token.symbol}
                    </span>
                    <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase ${statusColor(token.status)}`}>
                      {token.status}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#e8b84a]/50 bg-[#e8b84a]/10 px-3 py-1 text-xs font-black text-[#f6d47c]" title="OG score — estimated from market cap, age & status">
                      <Flame className="h-3.5 w-3.5" /> OG {score}
                    </span>
                    <LaunchpadShareButton
                      token={{
                        name: token.name,
                        symbol: token.symbol,
                        price_usd: token.price_usd,
                        market_cap_usd: token.market_cap_usd,
                        mint: token.mint,
                      }}
                    />
                  </div>
                  <p className="mt-2 text-sm text-white/40">
                    {token.creator_username ? `by ${token.creator_username} · ` : ""}launched {timeAgo(token.created_at)}
                  </p>
                  <button onClick={copyMint} className="mt-2 flex items-center gap-1.5 truncate font-mono text-xs text-white/30 hover:text-[#f6d47c]" title="Copy mint address">
                    <span className="truncate">{token.mint}</span>
                    {copied ? <Check className="h-3.5 w-3.5 shrink-0 text-green-400" /> : <Copy className="h-3.5 w-3.5 shrink-0" />}
                  </button>
                </div>
              </div>

              {/* Bonding progress */}
              <div className="mt-6">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-white/30">
                  <span className="inline-flex items-center gap-1.5"><Rocket className="h-3 w-3" /> Bonding curve</span>
                  <span className="text-white/50">{progress}%{token.status === "graduated" ? " · graduated" : ` · ${fmtUsd(GRADUATION_MCAP - (token.market_cap_usd || 0))} to graduation (est.)`}</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#b98a1e] to-[#f6d47c]"
                    style={{ width: `${progress}%` }}
                  />
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
              <StatCard label="OG Score" value={`${score}/100`} sub="from mcap, age & status" />
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
                  icon={<ShieldCheck className="h-5 w-5" />}
                  label="Max tx size"
                  value={token.max_tx_pct != null ? `${token.max_tx_pct}% of supply` : "—"}
                />
                <ProtectionRow
                  icon={<Target className="h-5 w-5" />}
                  label="Sniper tax"
                  value={
                    token.sniper_tax_bps != null
                      ? `${(token.sniper_tax_bps / 100).toFixed(0)}% for first ${
                          token.sniper_window_seconds != null ? Math.floor(token.sniper_window_seconds / 60) : 5
                        } min`
                      : "—"
                  }
                />
                <ProtectionRow icon={<Ban className="h-5 w-5" />} label="Anti-duplicate" value="Enforced" />
                <ProtectionRow
                  icon={<Droplets className="h-5 w-5" />}
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
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#e8b84a] px-6 py-4 font-bold text-black transition-colors hover:bg-[#f6d47c]"
              >
                View on DexScreener <ExternalLink className="h-4 w-4" />
              </a>
            </div>

            {/* MCP hint */}
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5 text-center">
              <p className="text-sm text-white/40">
                Want to buy or sell <span className="font-bold text-white/70">${token.symbol}</span>? Do it through the MCP —{" "}
                <code className="rounded bg-white/5 px-2 py-0.5 text-xs text-[#f6d47c]">orbitx.world/api/mcp-launchpad</code>
              </p>
              <p className="mt-2 font-mono text-xs text-white/30">
                "Buy 0.5 SOL of ${token.symbol}" — your AI handles the rest
              </p>
            </div>

            <p className="mt-6 text-center text-[11px] text-white/25">
              OG score and bonding progress are estimates from market cap, age &amp; status — not price predictions.
            </p>

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
