/**
 * Discover / LaunchPad — OG Scan's full-featured token discovery engine.
 *
 * Sections: All, Featured, Hot, New, Migrated, Gainers, Losers, Volume, Mine
 * Data: DexScreener APIs + pump_v5_submissions from Supabase
 * Style: OG hacker terminal aesthetic
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Search, Flame, TrendingUp, TrendingDown, Star, Zap, Filter, Eye,
  BarChart3, ArrowUpRight, ArrowDownRight, RefreshCw, Sparkles, Rocket,
  Plus, X, ExternalLink, Loader2, Copy, Check, ChevronRight,
  Activity, Shield, Target, Award, Users, Clock, Waves,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { fmtUsd, fmtNum } from "@/lib/og";
import { CoinDetailDialog } from "@/components/CoinDetailDialog";
import type { JupTokenInfo } from "@/lib/og";
import { getChain, isSolana } from "@/lib/chains";

/* ═══════════════════════ Types ═══════════════════════ */

interface LaunchToken {
  id: string;
  name: string;
  ticker: string;
  contract: string;
  logoUrl: string | null;
  venue: string;
  status: string;
  tags: string[];
  featured: boolean;
  hot: boolean;
  verified: boolean;
  createdAt: number;
  ownerId: string | null;
  price: number | null;
  change24hPct: number | null;
  liquidityUsd: number | null;
  marketCapUsd: number | null;
  volume24hUsd: number | null;
  holders: number | null;
  pairAddress: string | null;
  txns24h: number;
  upvotes: number;
  watchers: number;
  source: "dex" | "submission" | "boost";
  chainId?: string;
}

type Section = "all" | "featured" | "hot" | "new" | "migrated" | "gainers" | "losers" | "volume" | "whales" | "mine";

const SECTIONS: { id: Section; label: string; Icon: React.ComponentType<any> }[] = [
  { id: "all", label: "All", Icon: Sparkles },
  { id: "featured", label: "Featured", Icon: Star },
  { id: "hot", label: "Hot", Icon: Flame },
  { id: "new", label: "New", Icon: Zap },
  { id: "migrated", label: "Migrated", Icon: Rocket },
  { id: "gainers", label: "Gainers", Icon: TrendingUp },
  { id: "losers", label: "Losers", Icon: TrendingDown },
  { id: "volume", label: "Volume", Icon: BarChart3 },
  { id: "whales", label: "Whales", Icon: Waves },
  { id: "mine", label: "Mine", Icon: Users },
];

/* ═══════════════════════ Scoring ═══════════════════════ */

function heatScore(t: LaunchToken): number {
  return (
    (t.hot ? 1_000_000 : 0) +
    (t.verified ? 250_000 : 0) +
    (t.volume24hUsd ?? 0) * 0.72 +
    (t.liquidityUsd ?? 0) * 0.22 +
    Math.max(0, t.change24hPct ?? 0) * 15_000 +
    t.upvotes * 2_500 +
    t.watchers * 1_000
  );
}

function isSafeToken(t: LaunchToken): boolean {
  const mc = t.marketCapUsd ?? 0;
  const liq = t.liquidityUsd ?? 0;
  const vol = t.volume24hUsd ?? 0;
  if (mc <= 0 && liq <= 0 && vol <= 0) return false;
  if (typeof t.change24hPct === "number" && t.change24hPct <= -90) return false;
  const tags = (t.tags ?? []).map(x => x.toLowerCase());
  if (tags.some(x => /scam|honeypot|rug|blacklist|unsafe|fake/.test(x))) return false;
  return true;
}

function isMigrated(t: LaunchToken): boolean {
  const age = Date.now() - t.createdAt;
  const text = `${t.name} ${t.ticker} ${(t.tags ?? []).join(" ")}`.toLowerCase();
  return (
    isSafeToken(t) &&
    (t.venue === "pumpswap" || t.venue === "raydium" || t.venue === "meteora" ||
     /pump|migrated|graduate|graduated|bonding/i.test(text)) &&
    age >= 0 && age <= 72 * 60 * 60 * 1000 &&
    (t.liquidityUsd ?? 0) >= 15_000
  );
}

/* ═══════════════════════ API Helpers ═══════════════════════ */

async function fetchDexScreenerBoosted(): Promise<LaunchToken[]> {
  try {
    const res = await fetch("https://api.dexscreener.com/token-boosts/top/v1");
    if (!res.ok) return [];
    const data = await res.json();
    const allTokens = (Array.isArray(data) ? data : [])
      .filter((t: any) => Boolean(t.tokenAddress))
      .slice(0, 30);

    const tokens: LaunchToken[] = [];
    // Batch fetch details
    const items = allTokens.map((t: any) => ({ addr: t.tokenAddress, chain: t.chainId || "solana", icon: t.icon })).filter((t: any) => t.addr);
    const batchSize = 5;
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const promises = batch.map(async (item: any) => {
        try {
          const r = await fetch(`https://api.dexscreener.com/tokens/v1/${item.chain}/${item.addr}`);
          if (!r.ok) return null;
          const d = await r.json();
          const pairs = Array.isArray(d) ? d : d?.pairs || [];
          const pair = pairs[0];
          if (!pair) return null;
          return pairToToken(pair, item.icon, "boost");
        } catch { return null; }
      });
      const results = await Promise.all(promises);
      results.forEach(t => { if (t) tokens.push(t); });
    }
    return tokens;
  } catch { return []; }
}

async function fetchDexScreenerLatest(): Promise<LaunchToken[]> {
  try {
    const res = await fetch("https://api.dexscreener.com/token-profiles/latest/v1");
    if (!res.ok) return [];
    const data = await res.json();
    const allTokens = (Array.isArray(data) ? data : [])
      .filter((t: any) => Boolean(t.tokenAddress))
      .slice(0, 30);

    const tokens: LaunchToken[] = [];
    const items = allTokens.map((t: any) => ({ addr: t.tokenAddress, chain: t.chainId || "solana", icon: t.icon })).filter((t: any) => t.addr);
    const batchSize = 5;
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const promises = batch.map(async (item: any) => {
        try {
          const r = await fetch(`https://api.dexscreener.com/tokens/v1/${item.chain}/${item.addr}`);
          if (!r.ok) return null;
          const d = await r.json();
          const pairs = Array.isArray(d) ? d : d?.pairs || [];
          const pair = pairs[0];
          if (!pair) return null;
          return pairToToken(pair, item.icon, "dex");
        } catch { return null; }
      });
      const results = await Promise.all(promises);
      results.forEach(t => { if (t) tokens.push(t); });
    }
    return tokens;
  } catch { return []; }
}

async function searchDexScreener(query: string): Promise<LaunchToken[]> {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const data = await res.json();
    const pairs = (data?.pairs || []).slice(0, 30);
    return pairs.map((p: any) => pairToToken(p, p.info?.imageUrl, "dex"));
  } catch { return []; }
}

async function fetchSubmissions(userId: string | null): Promise<LaunchToken[]> {
  try {
    const { data, error } = await supabase
      .from("pump_v5_submissions")
      .select("*")
      .order("created_at", { ascending: false });
    if (error || !data) return [];
    return data
      .filter((r: any) => {
        const status = String(r.status ?? "approved").toLowerCase();
        return status === "approved" || status === "live" || (!!userId && r.user_id === userId);
      })
      .map((r: any) => submissionToToken(r));
  } catch { return []; }
}

function pairToToken(pair: any, icon?: string, source: "dex" | "boost" = "dex"): LaunchToken {
  const created = pair.pairCreatedAt ? new Date(pair.pairCreatedAt).getTime() : Date.now();
  const dexId = pair.dexId?.toLowerCase() ?? "";
  let venue = "other";
  if (dexId.includes("pump")) venue = "pumpfun";
  else if (dexId.includes("raydium")) venue = "raydium";
  else if (dexId.includes("meteora")) venue = "meteora";
  else if (dexId.includes("moonshot")) venue = "moonshot";
  else if (dexId.includes("uniswap")) venue = "uniswap";
  else if (dexId.includes("pancakeswap")) venue = "pancakeswap";
  else if (dexId.includes("sushiswap")) venue = "sushiswap";
  else if (dexId.includes("camelot")) venue = "camelot";
  else if (dexId.includes("aerodrome")) venue = "aerodrome";

  return {
    id: pair.baseToken?.address || pair.pairAddress || Math.random().toString(),
    name: pair.baseToken?.name || "Unknown",
    ticker: (pair.baseToken?.symbol || "???").replace("$", "").toUpperCase(),
    contract: pair.baseToken?.address || "",
    logoUrl: icon || pair.info?.imageUrl || null,
    venue,
    status: "live",
    tags: [],
    featured: source === "boost",
    hot: (pair.volume?.h24 || 0) > 500_000,
    verified: false,
    createdAt: created,
    ownerId: null,
    price: parseFloat(pair.priceUsd || "0") || null,
    change24hPct: pair.priceChange?.h24 ?? null,
    liquidityUsd: pair.liquidity?.usd ?? null,
    marketCapUsd: pair.marketCap || pair.fdv || null,
    volume24hUsd: pair.volume?.h24 ?? null,
    holders: null,
    pairAddress: pair.pairAddress || null,
    txns24h: (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0),
    upvotes: 0,
    watchers: 0,
    source,
    chainId: pair.chainId ?? "solana",
  };
}

function submissionToToken(row: any): LaunchToken {
  const tags = Array.isArray(row.tags) ? row.tags.map(String) : [];
  const venueTag = tags.find((t: string) => t.toLowerCase().startsWith("venue:"));
  const venue = venueTag?.slice(6) ?? row.launch_platform ?? "other";
  return {
    id: row.id || row.contract_address,
    name: row.token_name || "Unnamed",
    ticker: (row.symbol || "TOKEN").replace("$", "").toUpperCase(),
    contract: row.contract_address || "",
    logoUrl: (row.logo_url && !row.logo_url.startsWith("file:")) ? row.logo_url : null,
    venue,
    status: row.status || "approved",
    tags: tags.filter((t: string) => !t.toLowerCase().startsWith("venue:")),
    featured: Boolean(row.is_featured),
    hot: Boolean(row.is_hot),
    verified: Boolean(row.is_verified),
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    ownerId: row.user_id || null,
    price: row.price_usd ? Number(row.price_usd) : null,
    change24hPct: row.change_24h_pct != null ? Number(row.change_24h_pct) : null,
    liquidityUsd: row.liquidity_usd ? Number(row.liquidity_usd) : null,
    marketCapUsd: row.market_cap ? Number(row.market_cap) : null,
    volume24hUsd: row.volume_24h_usd ? Number(row.volume_24h_usd) : null,
    holders: row.holders ?? row.holder_count ?? null,
    pairAddress: null,
    txns24h: 0,
    upvotes: row.upvotes ?? 0,
    watchers: row.watchers ?? 0,
    source: "submission",
  };
}

function mergeTokens(lists: LaunchToken[][]): LaunchToken[] {
  const map = new Map<string, LaunchToken>();
  for (const list of lists) {
    for (const t of list) {
      const key = t.contract || t.id;
      if (!key) continue;
      const existing = map.get(key);
      if (existing) {
        // Merge: prefer non-null values from newer source
        map.set(key, {
          ...existing,
          ...t,
          price: t.price ?? existing.price,
          change24hPct: t.change24hPct ?? existing.change24hPct,
          volume24hUsd: t.volume24hUsd ?? existing.volume24hUsd,
          liquidityUsd: t.liquidityUsd ?? existing.liquidityUsd,
          marketCapUsd: t.marketCapUsd ?? existing.marketCapUsd,
          featured: t.featured || existing.featured,
          hot: t.hot || existing.hot,
        });
      } else {
        map.set(key, t);
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
}

function tokenToJup(t: LaunchToken): JupTokenInfo {
  return {
    id: t.contract,
    name: t.name,
    symbol: t.ticker,
    icon: t.logoUrl ?? undefined,
    decimals: 9,
    usdPrice: t.price ?? 0,
    fdv: t.marketCapUsd ?? undefined,
    liquidity: t.liquidityUsd ?? undefined,
    pairAddress: t.pairAddress ?? undefined,
    stats24h: { priceChange: t.change24hPct ?? undefined },
    firstPool: { createdAt: t.createdAt ? new Date(t.createdAt).toISOString() : undefined },
  };
}

function tokenAge(createdAt: number): string {
  const ms = Math.max(0, Date.now() - createdAt);
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${Math.max(1, mins)}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/* ═══════════════════════ Component ═══════════════════════ */

const Discover = ({ inline = false }: { inline?: boolean }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [allTokens, setAllTokens] = useState<LaunchToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [section, setSection] = useState<Section>("all");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<LaunchToken[] | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const fetchAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [boosted, latest, submissions] = await Promise.allSettled([
        fetchDexScreenerBoosted(),
        fetchDexScreenerLatest(),
        fetchSubmissions(user?.id ?? null),
      ]);
      const b = boosted.status === "fulfilled" ? boosted.value : [];
      const l = latest.status === "fulfilled" ? latest.value : [];
      const s = submissions.status === "fulfilled" ? submissions.value : [];
      setAllTokens(mergeTokens([b, l, s]));
    } catch (e) {
      console.error("[discover] fetch failed", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Search handler
  useEffect(() => {
    if (!query.trim()) { setSearchResults(null); return; }
    const timeout = setTimeout(async () => {
      const results = await searchDexScreener(query.trim());
      setSearchResults(results);
    }, 400);
    return () => clearTimeout(timeout);
  }, [query]);

  // Filtered display
  const safeTokens = useMemo(() => allTokens.filter(isSafeToken), [allTokens]);

  const filtered = useMemo(() => {
    if (searchResults) return searchResults;
    let items = safeTokens.slice();
    switch (section) {
      case "featured": items = items.filter(t => t.featured); break;
      case "hot": items = items.filter(t => heatScore(t) > 0).sort((a, b) => heatScore(b) - heatScore(a)); break;
      case "new": items = items.sort((a, b) => b.createdAt - a.createdAt).slice(0, 30); break;
      case "migrated": items = items.filter(isMigrated).sort((a, b) => b.createdAt - a.createdAt); break;
      case "gainers": items = items.filter(t => (t.change24hPct ?? 0) > 0).sort((a, b) => (b.change24hPct ?? 0) - (a.change24hPct ?? 0)); break;
      case "losers": items = items.filter(t => (t.change24hPct ?? 0) < 0).sort((a, b) => (a.change24hPct ?? 0) - (b.change24hPct ?? 0)); break;
      case "volume": items = items.filter(t => (t.volume24hUsd ?? 0) > 0).sort((a, b) => (b.volume24hUsd ?? 0) - (a.volume24hUsd ?? 0)); break;
      case "whales": items = items.filter(t => (t.holders ?? 0) > 100 || (t.volume24hUsd ?? 0) > 50_000).sort((a, b) => (b.volume24hUsd ?? 0) - (a.volume24hUsd ?? 0)); break;
      case "mine": items = allTokens.filter(t => !!user?.id && t.ownerId === user.id); break;
      default: items = items.sort((a, b) => heatScore(b) - heatScore(a)); break;
    }
    return items;
  }, [safeTokens, allTokens, section, searchResults, user?.id]);

  // Precomputed carousels
  const featuredSpotlight = useMemo(
    () => safeTokens.filter(t => t.featured || (t.change24hPct ?? 0) >= 50 && (t.volume24hUsd ?? 0) >= 50_000)
      .sort((a, b) => (b.change24hPct ?? 0) - (a.change24hPct ?? 0)).slice(0, 8),
    [safeTokens]
  );
  const topGainers = useMemo(
    () => safeTokens.filter(t => (t.change24hPct ?? 0) > 0).sort((a, b) => (b.change24hPct ?? 0) - (a.change24hPct ?? 0)).slice(0, 5),
    [safeTokens]
  );
  const topLosers = useMemo(
    () => safeTokens.filter(t => (t.change24hPct ?? 0) < 0).sort((a, b) => (a.change24hPct ?? 0) - (b.change24hPct ?? 0)).slice(0, 5),
    [safeTokens]
  );
  const stats = useMemo(() => ({
    total: safeTokens.length,
    hot: safeTokens.filter(t => t.hot).length,
    featured: safeTokens.filter(t => t.featured).length,
    totalVol: safeTokens.reduce((s, t) => s + (t.volume24hUsd ?? 0), 0),
    totalLiq: safeTokens.reduce((s, t) => s + (t.liquidityUsd ?? 0), 0),
  }), [safeTokens]);

  const copyCA = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopied(addr);
    setTimeout(() => setCopied(null), 1500);
    toast.success("Contract copied");
  };

  const isFiltering = !!searchResults || section !== "all";

  const content = (
    <>
      {!inline && (
        <PageHeader title="LaunchPad" description="Token discovery, trending launches & market intel">
          <div className="flex items-center gap-2">
            <Badge className="bg-primary/20 text-primary border-primary/30 gap-1 font-mono text-[9px]">
              <Activity className="h-3 w-3 animate-pulse" /> LIVE
            </Badge>
            <span className="text-[10px] text-white/20 font-mono">{stats.total} tokens</span>
          </div>
        </PageHeader>
      )}

      <div className={inline ? "" : "h-[calc(100vh-120px)] overflow-y-auto"}>
        <div className="p-4 lg:p-6 space-y-5">

          {/* ── Stats bar ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: "TOKENS", value: String(stats.total), icon: Target, color: "text-primary" },
              { label: "24H VOLUME", value: fmtUsd(stats.totalVol), icon: BarChart3, color: "text-emerald-400" },
              { label: "LIQUIDITY", value: fmtUsd(stats.totalLiq), icon: Waves, color: "text-cyan-400" },
              { label: "HOT", value: String(stats.hot), icon: Flame, color: "text-orange-400" },
            ].map((s, i) => (
              <div key={i} className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <s.icon className={cn("h-3 w-3", s.color)} />
                  <span className="text-[8px] text-white/20 uppercase tracking-wider font-mono">{s.label}</span>
                </div>
                <p className="text-sm font-black text-white font-mono">{s.value}</p>
              </div>
            ))}
          </div>

          {/* ── Featured spotlight carousel ── */}
          {!isFiltering && featuredSpotlight.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Star className="h-4 w-4 text-yellow-400" />
                <h3 className="text-xs font-black text-white/70 uppercase tracking-wider">Spotlight</h3>
                <div className="h-px flex-1 bg-white/[0.06]" />
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {featuredSpotlight.map(t => (
                  <CoinDetailDialog key={t.id} token={tokenToJup(t)} trigger={
                    <div className="shrink-0 w-[200px] rounded-xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] p-3 cursor-pointer hover:border-primary/30 transition-all group">
                      <div className="flex items-center gap-2 mb-2">
                        {t.logoUrl ? (
                          <img src={t.logoUrl} className="w-8 h-8 rounded-full object-cover" alt="" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                            {t.ticker?.charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-black text-white truncate">${t.ticker}</p>
                          <p className="text-[9px] text-white/20 truncate">{t.name}</p>
                        </div>
                        {t.chainId && !isSolana(t.chainId) && (
                          <span className="text-[8px] text-og-cyan/70 shrink-0" title={getChain(t.chainId).name}>{getChain(t.chainId).emoji}</span>
                        )}
                        {t.featured && <Star className="h-3 w-3 text-yellow-400 fill-yellow-400 shrink-0" />}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-white/60">
                          {t.price != null ? fmtUsd(t.price) : "—"}
                        </span>
                        <span className={cn("text-[10px] font-bold flex items-center gap-0.5",
                          (t.change24hPct ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"
                        )}>
                          {(t.change24hPct ?? 0) >= 0 ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
                          {Math.abs(t.change24hPct ?? 0).toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between mt-1.5 text-[8px] text-white/15 font-mono">
                        <span>MC {fmtUsd(t.marketCapUsd)}</span>
                        <span>Vol {fmtUsd(t.volume24hUsd)}</span>
                      </div>
                    </div>
                  } />
                ))}
              </div>
            </div>
          )}

          {/* ── Gainers / Losers mini strip ── */}
          {!isFiltering && (topGainers.length > 0 || topLosers.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {topGainers.length > 0 && (
                <div className="rounded-xl bg-emerald-500/[0.03] border border-emerald-500/10 p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <TrendingUp className="h-3 w-3 text-emerald-400" />
                    <span className="text-[9px] font-black text-emerald-400/70 uppercase tracking-wider">Top Gainers</span>
                  </div>
                  <div className="space-y-1.5">
                    {topGainers.map(t => (
                      <CoinDetailDialog key={t.id} token={tokenToJup(t)} trigger={
                        <div className="flex items-center justify-between py-1 cursor-pointer hover:bg-white/[0.02] rounded px-1 -mx-1">
                          <div className="flex items-center gap-2 min-w-0">
                            {t.logoUrl ? (
                              <img src={t.logoUrl} className="w-5 h-5 rounded-full" alt="" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-white/[0.06] text-[7px] font-bold text-white/20 flex items-center justify-center">{t.ticker?.[0]}</div>
                            )}
                            <span className="text-[10px] font-bold text-white truncate">${t.ticker}</span>
                          </div>
                          <span className="text-[10px] font-bold text-emerald-400">+{(t.change24hPct ?? 0).toFixed(1)}%</span>
                        </div>
                      } />
                    ))}
                  </div>
                </div>
              )}
              {topLosers.length > 0 && (
                <div className="rounded-xl bg-red-500/[0.03] border border-red-500/10 p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <TrendingDown className="h-3 w-3 text-red-400" />
                    <span className="text-[9px] font-black text-red-400/70 uppercase tracking-wider">Top Losers</span>
                  </div>
                  <div className="space-y-1.5">
                    {topLosers.map(t => (
                      <CoinDetailDialog key={t.id} token={tokenToJup(t)} trigger={
                        <div className="flex items-center justify-between py-1 cursor-pointer hover:bg-white/[0.02] rounded px-1 -mx-1">
                          <div className="flex items-center gap-2 min-w-0">
                            {t.logoUrl ? (
                              <img src={t.logoUrl} className="w-5 h-5 rounded-full" alt="" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-white/[0.06] text-[7px] font-bold text-white/20 flex items-center justify-center">{t.ticker?.[0]}</div>
                            )}
                            <span className="text-[10px] font-bold text-white truncate">${t.ticker}</span>
                          </div>
                          <span className="text-[10px] font-bold text-red-400">{(t.change24hPct ?? 0).toFixed(1)}%</span>
                        </div>
                      } />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Search ── */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search ticker, name, or paste contract address..."
              className="pl-10 pr-10 rounded-xl bg-white/[0.02] border-white/[0.08] font-mono text-xs placeholder:text-white/15"
            />
            {query && (
              <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="h-3.5 w-3.5 text-white/20 hover:text-white/40" />
              </button>
            )}
          </div>

          {/* ── Section tabs ── */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            {SECTIONS.map(s => {
              const active = section === s.id && !searchResults;
              return (
                <button key={s.id} onClick={() => { setSection(s.id); setQuery(""); setSearchResults(null); }}
                  className={cn(
                    "shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold transition-all whitespace-nowrap border",
                    active
                      ? "bg-primary/10 text-primary border-primary/20"
                      : "text-white/20 hover:text-white/40 border-transparent hover:border-white/[0.06]"
                  )}>
                  <s.Icon className="h-3 w-3" />
                  {s.label}
                </button>
              );
            })}
          </div>

          {/* ── Filter header ── */}
          {isFiltering && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white/50">
                  {searchResults ? `${filtered.length} results for "${query}"` : `${filtered.length} tokens`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => fetchAll(true)} className="flex items-center gap-1 text-[10px] text-white/20 hover:text-white/40">
                  <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} />
                </button>
              </div>
            </div>
          )}

          {/* ── Token list ── */}
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.01] overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[1fr_80px_80px_70px] sm:grid-cols-[1fr_90px_90px_90px_70px_32px] gap-1 px-3 py-2.5 border-b border-white/[0.06]">
              <span className="text-[8px] text-white/15 uppercase tracking-wider font-mono">Token</span>
              <span className="text-[8px] text-white/15 uppercase tracking-wider font-mono text-right">Price</span>
              <span className="text-[8px] text-white/15 uppercase tracking-wider font-mono text-right hidden sm:block">MCap</span>
              <span className="text-[8px] text-white/15 uppercase tracking-wider font-mono text-right">Volume</span>
              <span className="text-[8px] text-white/15 uppercase tracking-wider font-mono text-right">24h</span>
              <span className="hidden sm:block" />
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-6 w-6 text-primary/30 animate-spin" />
                  <span className="text-[10px] text-white/15 font-mono">SCANNING...</span>
                </div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center">
                <Rocket className="h-8 w-8 text-white/[0.06] mx-auto mb-3" />
                <p className="text-xs text-white/20 font-mono">
                  {searchResults ? "No tokens match your search" : "No tokens in this section"}
                </p>
                {isFiltering && (
                  <button onClick={() => { setSection("all"); setQuery(""); setSearchResults(null); }}
                    className="mt-2 text-[10px] text-primary hover:text-primary/80">
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-white/[0.03] max-h-[600px] overflow-y-auto">
                {filtered.map((t, i) => (
                  <CoinDetailDialog key={t.id + i} token={tokenToJup(t)} trigger={
                    <div className="w-full grid grid-cols-[1fr_80px_80px_70px] sm:grid-cols-[1fr_90px_90px_90px_70px_32px] gap-1 px-3 py-2.5 hover:bg-white/[0.02] transition-colors text-left items-center cursor-pointer group">
                      {/* Token info */}
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[9px] text-white/10 w-4 font-mono shrink-0">{i + 1}</span>
                        {t.logoUrl ? (
                          <img src={t.logoUrl} className="w-7 h-7 rounded-full shrink-0 object-cover" alt="" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary shrink-0">
                            {t.ticker?.charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-[11px] font-black text-white truncate">${t.ticker}</p>
                            {t.featured && <Star className="h-2.5 w-2.5 text-yellow-400 fill-yellow-400 shrink-0" />}
                            {t.hot && <Flame className="h-2.5 w-2.5 text-orange-400 shrink-0" />}
                            {t.verified && <Shield className="h-2.5 w-2.5 text-primary shrink-0" />}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <p className="text-[9px] text-white/15 truncate">{t.name}</p>
                            {t.createdAt && <span className="text-[8px] text-white/10 shrink-0">{tokenAge(t.createdAt)}</span>}
                          </div>
                        </div>
                      </div>
                      {/* Price */}
                      <span className="text-[10px] text-white/60 text-right font-mono">
                        {t.price != null && t.price > 0 ? (t.price < 0.01 ? `$${t.price.toFixed(8)}` : fmtUsd(t.price)) : "—"}
                      </span>
                      {/* MCap */}
                      <span className="text-[10px] text-white/40 text-right hidden sm:block font-mono">
                        {fmtUsd(t.marketCapUsd)}
                      </span>
                      {/* Volume */}
                      <span className="text-[10px] text-white/40 text-right font-mono">
                        {fmtUsd(t.volume24hUsd)}
                      </span>
                      {/* 24h change */}
                      <span className={cn("text-[10px] font-bold text-right flex items-center justify-end gap-0.5",
                        (t.change24hPct ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"
                      )}>
                        {t.change24hPct != null ? (
                          <>
                            {t.change24hPct >= 0 ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
                            {Math.abs(t.change24hPct).toFixed(1)}%
                          </>
                        ) : "—"}
                      </span>
                      {/* Copy CA */}
                      <button
                        className="hidden sm:flex h-6 w-6 items-center justify-center rounded-md bg-white/[0.03] border border-white/[0.06] opacity-0 group-hover:opacity-100 transition-all hover:bg-white/[0.08]"
                        onClick={(e) => { e.stopPropagation(); copyCA(t.contract); }}
                        title="Copy contract address"
                      >
                        {copied === t.contract ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3 text-white/30" />}
                      </button>
                    </div>
                  } />
                ))}
              </div>
            )}
          </div>

          {/* ── Refresh bar ── */}
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-white/10 font-mono">
              Data: DexScreener + OG Scan submissions
            </span>
            <button onClick={() => fetchAll(true)} className="flex items-center gap-1.5 text-[10px] text-white/20 hover:text-primary transition-colors">
              <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} />
              <span className="font-mono">Refresh</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );

  return inline ? content : <AppLayout>{content}</AppLayout>;
};

export default Discover;
