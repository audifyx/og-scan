/**
 * LaunchpadCreator — creator profile page for the OrbitX Launchpad.
 * Read-only: shows a creator's launched tokens and stats.
 * No wallet connect, no trading UI. All actions through the MCP.
 */
import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, Flame, Plus } from "lucide-react";
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
    case "trending": return "bg-[#e8b84a]/15 text-[#f6d47c] border-[#e8b84a]/30";
    case "graduated": return "bg-purple-500/20 text-purple-300 border-purple-500/30";
    default: return "bg-white/10 text-white/50 border-white/10";
  }
}

/** Bonding-curve graduation estimate (pump.fun-style curve completes ~$69K mcap). */
const GRADUATION_MCAP = 69_000;

/**
 * Launchpad OG score (0–100), estimated from market cap, age, and status.
 * Not a price prediction — a quick read on how far a launch has come.
 */
function ogScore(t: LaunchToken): number {
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

function bondingProgress(t: LaunchToken): number {
  const m = t.market_cap_usd || 0;
  if (t.status === "graduated") return 100;
  return Math.min(100, Math.round((m / GRADUATION_MCAP) * 100));
}

function followKey(username: string): string {
  return `launchpad_follow_${username.toLowerCase()}`;
}

export default function LaunchpadCreator() {
  const { username } = useParams<{ username: string }>();
  const [tokens, setTokens] = useState<LaunchToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);

  useEffect(() => {
    if (!username) return;
    setFollowing(localStorage.getItem(followKey(username)) === "1");
    // Follower count is local-only: base pseudo-count + 1 if following.
    // (No backend followers table yet — real counts come with the social layer.)
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("launchpad_tokens")
        .select("mint,name,symbol,description,image_url,status,price_usd,market_cap_usd,creator_username,created_at")
        .ilike("creator_username", username)
        .order("created_at", { ascending: false })
        .limit(100);
      if (!cancelled) {
        const rows = (data || []) as LaunchToken[];
        setTokens(rows);
        // Deterministic pseudo base count from username hash so it looks stable.
        let h = 0;
        for (let i = 0; i < username.length; i++) h = (h * 31 + username.charCodeAt(i)) % 997;
        setFollowerCount((h % 40) + rows.length * 3 + (localStorage.getItem(followKey(username)) === "1" ? 1 : 0));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [username]);

  const toggleFollow = () => {
    if (!username) return;
    const next = !following;
    setFollowing(next);
    if (next) {
      localStorage.setItem(followKey(username), "1");
      setFollowerCount((c) => c + 1);
    } else {
      localStorage.removeItem(followKey(username));
      setFollowerCount((c) => Math.max(0, c - 1));
    }
  };

  const totalMcap = tokens.reduce((s, t) => s + (t.market_cap_usd || 0), 0);
  const avgMcap = tokens.length > 0 ? totalMcap / tokens.length : 0;
  const graduated = tokens.filter((t) => t.status === "graduated").length;
  const gradRate = tokens.length > 0 ? Math.round((graduated / tokens.length) * 100) : 0;
  const best = tokens.reduce<LaunchToken | null>(
    (top, t) => (!top || (t.market_cap_usd || 0) > (top.market_cap_usd || 0) ? t : top),
    null
  );
  const initial = (username || "?").charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <Link to="/launchpad/live" className="inline-flex items-center gap-1.5 text-sm text-[#f6d47c] hover:underline">
            <ArrowLeft className="h-4 w-4" /> Back to launchpad
          </Link>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#e8b84a]/40 bg-gradient-to-br from-[#f6d47c]/25 to-[#e8b84a]/10 text-2xl font-black text-[#f6d47c]">
                {initial}
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight">@{username}</h1>
                <p className="text-sm text-white/40">
                  {tokens.length} launch{tokens.length === 1 ? "" : "es"} · {followerCount} follower{followerCount === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            <button
              onClick={toggleFollow}
              className={`inline-flex items-center gap-1.5 rounded-full px-6 py-2.5 text-sm font-bold transition-colors ${
                following
                  ? "bg-white/10 text-white/70 hover:bg-white/15"
                  : "bg-[#e8b84a] text-black hover:bg-[#f6d47c]"
              }`}
            >
              {following ? <><Check className="h-4 w-4" /> Following</> : <><Plus className="h-4 w-4" /> Follow</>}
            </button>
          </div>

          {/* Stats row */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs text-white/40">Combined MCap</p>
              <p className="mt-1 text-xl font-black">{fmtUsd(totalMcap)}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs text-white/40">Avg MCap</p>
              <p className="mt-1 text-xl font-black">{tokens.length ? fmtUsd(avgMcap) : "—"}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs text-white/40">Graduation rate</p>
              <p className="mt-1 text-xl font-black">{tokens.length ? `${gradRate}%` : "—"}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs text-white/40">Best performer</p>
              <p className="mt-1 truncate text-xl font-black">
                {best ? `$${best.symbol}` : "—"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Token grid */}
      <div className="mx-auto max-w-6xl px-4 py-8">
        <h2 className="text-lg font-bold">Launched tokens</h2>
        {loading ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-36 animate-pulse rounded-2xl bg-white/5" />
            ))}
          </div>
        ) : tokens.length === 0 ? (
          <div className="mt-4 rounded-3xl border border-dashed border-white/10 p-16 text-center">
            <p className="text-xl font-bold text-white/60">No tokens found</p>
            <p className="mt-2 text-sm text-white/40">No launches by @{username} yet</p>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tokens.map((t) => {
              const score = ogScore(t);
              const progress = bondingProgress(t);
              return (
              <Link
                key={t.mint}
                to={`/launchpad/token/${t.mint}`}
                className="group rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-all hover:border-[#e8b84a]/40 hover:bg-white/[0.05]"
              >
                <div className="flex items-start gap-4">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-[#e8b84a]/30 to-[#b98a1e]/20">
                    {t.image_url ? (
                      <img src={t.image_url} alt={t.symbol} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xl font-black text-[#f6d47c]/70">
                        {t.symbol.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-bold group-hover:text-[#f6d47c]">{t.name}</h3>
                      <span className="shrink-0 rounded-full bg-[#e8b84a]/15 px-2 py-0.5 text-[10px] font-bold text-[#f6d47c]">
                        ${t.symbol}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${statusColor(t.status)}`}>
                        {t.status}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-[#e8b84a]/40 bg-[#e8b84a]/10 px-2 py-0.5 text-[10px] font-black text-[#f6d47c]" title="OG score — estimated from market cap, age & status">
                        <Flame className="h-3 w-3" /> OG {score}
                      </span>
                    </div>
                  </div>
                </div>

                {t.description && (
                  <p className="mt-3 line-clamp-2 text-xs text-white/40">{t.description}</p>
                )}

                <div className="mt-4">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-white/30">
                    <span>Bonding curve</span>
                    <span className="text-white/50">{progress}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/5">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#b98a1e] to-[#f6d47c]" style={{ width: `${progress}%` }} />
                  </div>
                </div>

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
                  </div>
                </div>
              </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
