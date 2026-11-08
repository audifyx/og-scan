/**
 * LaunchpadLive — clean single-page token feed for the OrbitX Launchpad.
 * Read-only: shows coins and data. No wallet connect, no trading UI.
 * All actions (launch/buy/sell) happen through the MCP.
 * Premium treatment: gold/black theme, OG score + bonding progress per card,
 * KHAN-style filter presets (fresh + under $50K mcap, and more).
 */
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Flame, Rocket, Search, Sparkles, TrendingUp, Trophy } from "lucide-react";
import { supabase } from "@/lib/supabase";
import LaunchpadTicker from "@/components/LaunchpadTicker";
import LaunchpadMcpGuide from "@/components/LaunchpadMcpGuide";
import LaunchpadUpvote from "@/components/LaunchpadUpvote";
import LaunchpadKingOfHill from "@/components/LaunchpadKingOfHill";
import LaunchpadSparkline from "@/components/LaunchpadSparkline";
import LaunchpadCommandPalette from "@/components/LaunchpadCommandPalette";
import LaunchpadTokenOfDay from "@/components/LaunchpadTokenOfDay";
import LaunchpadActivityFeed from "@/components/LaunchpadActivityFeed";

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

/** KHAN-style filter presets: same beginner filters as the KHAN preset in
 *  Migrations/PairTracker (fresh + max mcap $50K), plus siblings. */
const PRESETS = [
  { id: "all", label: "All launches", hint: "Everything, newest first" },
  { id: "khan", label: "KHAN · Fresh under $50K", hint: "Launched in the last 24h · mcap under $50K" },
  { id: "fresh", label: "Fresh · 24h", hint: "Launched in the last 24h" },
  { id: "micro", label: "Micro caps", hint: "Market cap under $50K" },
  { id: "gems", label: "High OG score", hint: "OG score 70+" },
] as const;
type PresetId = (typeof PRESETS)[number]["id"];

const KHAN_MAX_MCAP = 50_000;
const KHAN_MAX_AGE_MS = 24 * 3600_000;
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

function ageMs(iso: string): number {
  return Date.now() - new Date(iso).getTime();
}

/**
 * Launchpad OG score (0–100), estimated from the data this feed actually has:
 * market cap, age, and status. Not a price prediction — a quick read on how
 * far a launch has come.
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
  const ageH = ageMs(t.created_at) / 3600000;
  if (ageH > 24) s += 5;
  else if (ageH > 6) s += 3;
  return Math.min(100, Math.max(0, s));
}

function bondingProgress(t: LaunchToken): number {
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

function ogColor(score: number): string {
  if (score >= 70) return "text-[#f6d47c] border-[#e8b84a]/50 bg-[#e8b84a]/10";
  if (score >= 50) return "text-white/80 border-white/20 bg-white/5";
  return "text-white/50 border-white/10 bg-white/[0.03]";
}

function OgScoreBadge({ score }: { score: number }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black ${ogColor(score)}`} title="OG score — estimated from market cap, age & status">
      <Flame className="h-3 w-3" /> OG {score}
    </span>
  );
}

export default function LaunchpadLive() {
  const [tokens, setTokens] = useState<LaunchToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [preset, setPreset] = useState<PresetId>("all");
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

  const presetFiltered = tokens.filter((t) => {
    switch (preset) {
      case "khan":
        return t.market_cap_usd != null && t.market_cap_usd <= KHAN_MAX_MCAP && ageMs(t.created_at) <= KHAN_MAX_AGE_MS;
      case "fresh":
        return ageMs(t.created_at) <= KHAN_MAX_AGE_MS;
      case "micro":
        return t.market_cap_usd != null && t.market_cap_usd < KHAN_MAX_MCAP;
      case "gems":
        return ogScore(t) >= 70;
      default:
        return true;
    }
  });

  const visible = search.trim()
    ? presetFiltered.filter((t) =>
        `${t.name} ${t.symbol}`.toLowerCase().includes(search.trim().toLowerCase())
      )
    : presetFiltered;

  const activePreset = PRESETS.find((p) => p.id === preset);

  return (
    <div className="min-h-screen bg-black text-white">
      <LaunchpadTicker />
      <LaunchpadCommandPalette />
      {/* Header */}
      <div className="border-b border-white/10 bg-[radial-gradient(700px_240px_at_20%_0%,rgba(232,184,74,0.09),transparent_60%)]">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#e8b84a]/50 bg-gradient-to-br from-[#f6d47c]/25 to-[#e8b84a]/10 text-[#f6d47c]">
              <Rocket className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h1 className="font-[Syne,sans-serif] text-2xl font-black tracking-tight">Launchpad</h1>
              <p className="text-sm text-white/40">Tokens launched via the OrbitX MCP — trade through your AI, not here</p>
            </div>
          </div>

          {/* Section nav */}
          <nav className="mt-6 flex gap-2 overflow-x-auto pb-1">
            {[
              { to: "/launchpad/live", label: "Live", icon: <Flame className="h-3.5 w-3.5" /> },
              { to: "/launchpad/swipe", label: "Swipe", icon: <Sparkles className="h-3.5 w-3.5" /> },
              { to: "/launchpad/stats", label: "Stats", icon: <TrendingUp className="h-3.5 w-3.5" /> },
            ].map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/5 px-4 py-2 text-sm font-bold text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                {l.icon}{l.label}
              </Link>
            ))}
          </nav>

          {/* Search + status filters */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tokens…"
                className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm outline-none placeholder:text-white/30 focus:border-[#e8b84a]/60"
              />
            </div>
            <div className="flex gap-2">
              {FILTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                    filter === s ? "bg-[#e8b84a] text-black" : "bg-white/5 text-white/50 hover:bg-white/10"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* KHAN-style filter presets */}
          <div className="mt-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">Filter presets</p>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPreset(p.id)}
                  title={p.hint}
                  className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold transition-colors ${
                    preset === p.id
                      ? "border-[#e8b84a]/60 bg-[#e8b84a]/15 text-[#f6d47c]"
                      : "border-white/10 bg-white/[0.03] text-white/50 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {p.id === "khan" && <Trophy className="mr-1 inline h-3 w-3" />}{p.label}
                </button>
              ))}
            </div>
            {activePreset && preset !== "all" && (
              <p className="mt-1.5 text-xs text-white/40">{activePreset.hint} · {visible.length} match{visible.length === 1 ? "" : "es"}</p>
            )}
          </div>
        </div>
      </div>

      {/* Token of the Day */}
      <LaunchpadTokenOfDay />

      {/* Token grid */}
      <div className="mx-auto max-w-6xl px-4 py-8">
        <LaunchpadKingOfHill />
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-44 animate-pulse rounded-2xl bg-white/5" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/10 p-16 text-center">
            <p className="text-xl font-bold text-white/60">
              {search ? "No matches" : preset !== "all" ? "Nothing matches this preset" : "No tokens yet"}
            </p>
            <p className="mt-2 text-sm text-white/40">
              {search || preset !== "all" ? "Try a different search or preset" : "Launch one through the MCP to get started"}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((t) => {
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
                      <OgScoreBadge score={score} />
                    </div>
                    <div className="mt-2" onClick={(e) => e.preventDefault()}>
                      <LaunchpadUpvote mint={t.mint} />
                    </div>
                  </div>
                </div>

                {t.description && (
                  <p className="mt-3 line-clamp-2 text-xs text-white/40">{t.description}</p>
                )}

                {/* Bonding progress */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-white/30">
                    <span>Bonding curve</span>
                    <span className="text-white/50">{progress}%{t.status === "graduated" ? " · graduated" : ""}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#b98a1e] to-[#f6d47c]"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/5 pt-3 text-xs">
                  <div>
                    <p className="text-white/30">Price</p>
                    <p className="font-bold">{fmtUsd(t.price_usd)}</p>
                    <div className="mt-1"><LaunchpadSparkline mint={t.mint} /></div>
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
              </Link>
              );
            })}
          </div>
        )}

        {/* MCP hint footer */}
        <div className="mt-12 grid gap-6 lg:grid-cols-[1fr_320px]">
          <LaunchpadMcpGuide />
          <LaunchpadActivityFeed />
        </div>

        <p className="mt-8 text-center text-[11px] text-white/25">
          OG scores are estimates from market cap, age &amp; status — not a price prediction.
          Bonding progress is estimated against a ~$69K graduation market cap.
        </p>
      </div>
    </div>
  );
}
