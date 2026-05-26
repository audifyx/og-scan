import { useState, useEffect, useCallback, useRef } from "react";
import { Zap, TrendingUp, ExternalLink, RefreshCw, Rocket, Globe, Copy, ArrowUpRight, ArrowDownRight, Repeat, Search, Plus, Trash2, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { heliusTxs, type HeliusTx, HELIUS_API_KEY, type JupTokenInfo } from "@/lib/og";
import { CoinDetailDialog } from "@/components/CoinDetailDialog";
import { chainFromDexSlug, type ChainConfig } from "@/lib/chains";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

interface TrackedWallet {
  id: string;
  wallet_address: string;
  label: string | null;
}

interface WalletActivity {
  signature: string;
  type: string;
  timestamp: string;
  description: string;
  tokenMint?: string;
  tokenAmount?: number;
  solAmount?: number;
  walletAddress: string;
  walletLabel?: string;
  fee?: number;
}

interface NewToken {
  id: string;
  name: string;
  symbol: string;
  address: string;
  pairAddress: string;
  chainId: string;
  dexId: string;
  priceUsd: string;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
  fdv: number;
  pairCreatedAt: number;
  url: string;
  imageUrl?: string;
  launchPlatform?: string;
}

/* ═══════════════════════════════════════════════════════════════
   Constants & helpers
   ═══════════════════════════════════════════════════════════════ */

const LAUNCH_PLATFORMS = [
  { id: "all", name: "All Platforms", icon: Globe },
  { id: "pump.fun", name: "Pump.fun", icon: Rocket },
  { id: "raydium", name: "Raydium", icon: Zap },
  { id: "jupiter", name: "Jupiter", icon: TrendingUp },
  { id: "uniswap", name: "Uniswap", icon: Repeat },
  { id: "pancakeswap", name: "PancakeSwap", icon: Zap },
  { id: "aerodrome", name: "Aerodrome", icon: TrendingUp },
];

const detectLaunchPlatform = (dexId: string, url: string): string => {
  const d = (dexId || "").toLowerCase();
  if (url?.includes("pump.fun") || d.includes("pump")) return "pump.fun";
  if (d.includes("raydium")) return "raydium";
  if (d.includes("orca")) return "orca";
  if (d.includes("meteora")) return "meteora";
  if (d.includes("uniswap")) return "uniswap";
  if (d.includes("pancakeswap") || d.includes("pancake")) return "pancakeswap";
  if (d.includes("aerodrome")) return "aerodrome";
  if (d.includes("sushiswap") || d.includes("sushi")) return "sushiswap";
  if (d.includes("camelot")) return "camelot";
  if (d.includes("trader_joe") || d.includes("traderjoe")) return "traderjoe";
  return dexId || "Unknown";
};

const getPlatformColor = (platform: string): string => {
  switch (platform?.toLowerCase()) {
    case "pump.fun": return "bg-pink-500/10 text-pink-400 border-pink-500/30";
    case "raydium": return "bg-purple-500/10 text-purple-400 border-purple-500/30";
    case "jupiter": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
    case "uniswap": return "bg-pink-400/10 text-pink-300 border-pink-400/30";
    case "pancakeswap": return "bg-amber-500/10 text-amber-400 border-amber-500/30";
    case "aerodrome": return "bg-blue-500/10 text-blue-400 border-blue-500/30";
    case "sushiswap": return "bg-indigo-500/10 text-indigo-400 border-indigo-500/30";
    default: return "bg-white/5 text-white/40 border-white/10";
  }
};

const getActivityIcon = (type: string) => {
  const t = (type || "").toLowerCase();
  if (t.includes("swap") || t.includes("buy")) return <ArrowUpRight className="h-3.5 w-3.5 text-og-lime" />;
  if (t.includes("sell")) return <ArrowDownRight className="h-3.5 w-3.5 text-red-400" />;
  if (t.includes("transfer")) return <Repeat className="h-3.5 w-3.5 text-og-gold" />;
  return <Zap className="h-3.5 w-3.5 text-og-cyan" />;
};

const getActivityColor = (type: string): string => {
  const t = (type || "").toLowerCase();
  if (t.includes("swap") || t.includes("buy")) return "text-og-lime";
  if (t.includes("sell")) return "text-red-400";
  if (t.includes("transfer")) return "text-og-gold";
  return "text-og-cyan";
};

const shortAddr = (addr: string) => addr ? `${addr.slice(0, 4)}...${addr.slice(-4)}` : "";

const formatNumber = (num: number) => {
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `$${(num / 1e3).toFixed(1)}K`;
  return `$${num.toFixed(0)}`;
};

const formatSol = (lamports: number) => {
  const sol = lamports / 1e9;
  if (sol >= 1000) return `${(sol / 1000).toFixed(1)}K SOL`;
  if (sol >= 1) return `${sol.toFixed(2)} SOL`;
  return `${sol.toFixed(4)} SOL`;
};

/* ═══════════════════════════════════════════════════════════════
   Helius wallet activity parsing
   ═══════════════════════════════════════════════════════════════ */

function parseHeliusTx(tx: HeliusTx, walletAddress: string, walletLabel?: string | null): WalletActivity {
  const solTransferred = (tx.nativeTransfers ?? []).reduce((sum, nt) => {
    if (nt.fromUserAccount === walletAddress) return sum - (nt.amount ?? 0);
    if (nt.toUserAccount === walletAddress) return sum + (nt.amount ?? 0);
    return sum;
  }, 0);

  const tokenTx = (tx.tokenTransfers ?? [])[0];

  return {
    signature: tx.signature,
    type: tx.type || "UNKNOWN",
    timestamp: tx.timestamp ? new Date(tx.timestamp * 1000).toISOString() : new Date().toISOString(),
    description: tx.description || tx.type || "Transaction",
    tokenMint: tokenTx?.mint,
    tokenAmount: tokenTx?.tokenAmount,
    solAmount: Math.abs(solTransferred),
    walletAddress,
    walletLabel: walletLabel || undefined,
    fee: tx.fee,
  };
}

/* ═══════════════════════════════════════════════════════════════
   Batch DexScreener fetch — one request per 30 addresses
   ═══════════════════════════════════════════════════════════════ */

async function fetchNewTokensBatch(): Promise<NewToken[]> {
  const res = await fetch("https://api.dexscreener.com/token-profiles/latest/v1");
  if (!res.ok) return [];
  const profiles: any[] = await res.json();
  if (!Array.isArray(profiles) || profiles.length === 0) return [];

  // Group profiles by chainId (all chains, not just Solana)
  const byChain = new Map<string, any[]>();
  for (const p of profiles) {
    if (!p.chainId || !p.tokenAddress) continue;
    const list = byChain.get(p.chainId) ?? [];
    list.push(p);
    byChain.set(p.chainId, list);
  }

  // Fetch pairs per chain in parallel (DexScreener supports max 30 addresses per call)
  const iconMap = new Map(profiles.map((p: any) => [`${p.chainId}:${p.tokenAddress}`, p.icon]));
  const allPairs: any[] = [];

  const chainFetches = Array.from(byChain.entries()).map(async ([chainId, chainProfiles]) => {
    // Take up to 30 per chain
    const batch = chainProfiles.slice(0, 30);
    const addresses = batch.map((p: any) => p.tokenAddress).join(",");
    try {
      const pairRes = await fetch(`https://api.dexscreener.com/tokens/v1/${chainId}/${addresses}`);
      if (!pairRes.ok) return [];
      const pairs = await pairRes.json();
      return Array.isArray(pairs) ? pairs : [];
    } catch {
      return [];
    }
  });

  const results = await Promise.allSettled(chainFetches);
  for (const r of results) {
    if (r.status === "fulfilled") allPairs.push(...r.value);
  }

  // Group pairs by (chainId + base address), take best pair per token
  const bestPairByToken = new Map<string, any>();
  for (const pair of allPairs) {
    const addr = pair.baseToken?.address;
    const chain = pair.chainId;
    if (!addr || !chain) continue;
    const key = `${chain}:${addr}`;
    const existing = bestPairByToken.get(key);
    if (!existing || (pair.liquidity?.usd ?? 0) > (existing.liquidity?.usd ?? 0)) {
      bestPairByToken.set(key, pair);
    }
  }

  return Array.from(bestPairByToken.entries()).map(([key, pair]) => {
    const addr = pair.baseToken?.address;
    return {
      id: key,
      address: addr,
      name: pair.baseToken?.name || "Unknown",
      symbol: pair.baseToken?.symbol || "???",
      pairAddress: pair.pairAddress,
      chainId: pair.chainId,
      dexId: pair.dexId,
      priceUsd: pair.priceUsd || "0",
      priceChange24h: pair.priceChange?.h24 || 0,
      volume24h: pair.volume?.h24 || 0,
      liquidity: pair.liquidity?.usd || 0,
      fdv: pair.fdv || 0,
      pairCreatedAt: pair.pairCreatedAt || Date.now(),
      url: pair.url,
      imageUrl: iconMap.get(key),
      launchPlatform: detectLaunchPlatform(pair.dexId, pair.url),
    };
  });
}

/* ═══════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════ */

const LiveFeed = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("launches");
  const [tokens, setTokens] = useState<NewToken[]>([]);
  const [activities, setActivities] = useState<WalletActivity[]>([]);
  const [trackedWallets, setTrackedWallets] = useState<TrackedWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [chainFilter, setChainFilter] = useState<string>("all");
  const [minLiquidity, setMinLiquidity] = useState<string>("0");
  const [walletInput, setWalletInput] = useState("");
  const [walletLabel, setWalletLabel] = useState("");
  const [addingWallet, setAddingWallet] = useState(false);

  /* ── Fetch tracked wallets from DB ── */
  const fetchTrackedWallets = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.from("tracked_wallets").select("*").eq("user_id", user.id);
      if (!error) setTrackedWallets(data || []);
    } catch {}
  }, [user]);

  /* ── Fetch wallet activities using Helius ── */
  const fetchWalletActivities = useCallback(async () => {
    if (trackedWallets.length === 0) { setActivities([]); return; }
    setLoading(true);
    try {
      const allActivities: WalletActivity[] = [];

      // Fetch in parallel (max 5 wallets)
      const results = await Promise.allSettled(
        trackedWallets.slice(0, 5).map(async (wallet) => {
          const txs = await heliusTxs(wallet.wallet_address, 15);
          return txs.map(tx => parseHeliusTx(tx, wallet.wallet_address, wallet.label));
        })
      );

      for (const result of results) {
        if (result.status === "fulfilled") allActivities.push(...result.value);
      }

      allActivities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setActivities(allActivities.slice(0, 100));
    } catch (err) {
      console.error("[LiveFeed] Helius fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [trackedWallets]);

  /* ── Fetch new token launches (batched) ── */
  const fetchNewTokens = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchNewTokensBatch();
      setTokens(result);
    } catch {} finally { setLoading(false); }
  }, []);

  /* ── Add wallet to watchlist ── */
  const addWallet = async () => {
    if (!user || !walletInput.trim()) return;
    const addr = walletInput.trim();
    if (addr.length < 32 || addr.length > 44) {
      toast.error("Invalid Solana address"); return;
    }
    if (trackedWallets.some(w => w.wallet_address === addr)) {
      toast.error("Already tracking this wallet"); return;
    }
    setAddingWallet(true);
    try {
      const { error } = await supabase.from("tracked_wallets").insert({
        user_id: user.id, wallet_address: addr, label: walletLabel.trim() || null,
      });
      if (error) throw error;
      toast.success("Wallet added to watchlist");
      setWalletInput(""); setWalletLabel("");
      await fetchTrackedWallets();
    } catch (e: any) {
      toast.error(e.message || "Failed to add wallet");
    } finally { setAddingWallet(false); }
  };

  /* ── Remove wallet from watchlist ── */
  const removeWallet = async (id: string) => {
    try {
      await supabase.from("tracked_wallets").delete().eq("id", id);
      setTrackedWallets(prev => prev.filter(w => w.id !== id));
      toast.success("Wallet removed");
    } catch {}
  };

  /* ── Effects ── */
  useEffect(() => { if (user) fetchTrackedWallets(); fetchNewTokens(); }, [user, fetchTrackedWallets, fetchNewTokens]);
  useEffect(() => { if (trackedWallets.length > 0 && activeTab === "tracked") fetchWalletActivities(); }, [trackedWallets, activeTab, fetchWalletActivities]);
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      if (activeTab === "tracked") fetchWalletActivities();
      else fetchNewTokens();
    }, 20000);
    return () => clearInterval(interval);
  }, [autoRefresh, activeTab, fetchWalletActivities, fetchNewTokens]);

  /* ── Filters ── */
  const filteredTokens = tokens.filter((t) => {
    const minLiq = parseInt(minLiquidity) || 0;
    if (t.liquidity < minLiq) return false;
    if (platformFilter !== "all" && t.launchPlatform?.toLowerCase() !== platformFilter.toLowerCase()) return false;
    if (chainFilter !== "all" && t.chainId !== chainFilter) return false;
    return true;
  });

  /* ═══════════════════════════════════════════════════════════
     JSX
     ═══════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 lg:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-og-cyan/20 bg-og-cyan/5 text-og-cyan">
              <Radio className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-white">Live Feed</h3>
              <p className="text-[10px] uppercase tracking-widest text-white/30">Real-time market activity & wallet tracking</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setAutoRefresh(!autoRefresh)}
              className={cn("flex items-center gap-2 rounded-xl border px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all",
                autoRefresh ? "bg-og-lime/10 text-og-lime border-og-lime/30" : "bg-white/5 text-white/30 border-white/10")}>
              <div className={cn("h-1.5 w-1.5 rounded-full", autoRefresh ? "bg-og-lime animate-pulse" : "bg-white/20")} />
              {autoRefresh ? "LIVE" : "PAUSED"}
            </button>
            <button onClick={activeTab === "tracked" ? fetchWalletActivities : fetchNewTokens} disabled={loading}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/40 hover:text-white transition-all disabled:opacity-50">
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Layout ── */}
      <div className="flex flex-col lg:grid lg:grid-cols-[1fr_360px] gap-4">
        {/* Left: Main Feed */}
        <div className="flex flex-col rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
          <div className="border-b border-white/[0.07] bg-white/[0.01]">
            <div className="flex gap-4 px-4 overflow-x-auto no-scrollbar">
              {[
                { id: "launches", label: "New Launches", icon: Rocket },
                { id: "tracked", label: "Tracked Wallets", icon: Eye },
              ].map((t) => (
                <button key={t.id} onClick={() => setActiveTab(t.id)}
                  className={cn("flex items-center gap-2 border-b-2 px-1 py-4 text-[11px] font-black uppercase tracking-widest transition-all",
                    activeTab === t.id ? "border-og-cyan text-white" : "border-transparent text-white/20 hover:text-white/40")}>
                  <t.icon className="h-3.5 w-3.5" />
                  {t.label}
                  {t.id === "tracked" && trackedWallets.length > 0 && (
                    <span className="text-[9px] bg-og-cyan/20 text-og-cyan px-1.5 py-0.5 rounded-full">{trackedWallets.length}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1">
            {/* Feed Controls */}
            {activeTab === "launches" && (
              <div className="p-3 border-b border-white/[0.07] flex flex-wrap gap-2">
                <div className="flex-1 min-w-[120px]">
                  <Select value={platformFilter} onValueChange={setPlatformFilter}>
                    <SelectTrigger className="h-9 rounded-lg bg-white/5 border-white/10 text-[10px] uppercase font-black tracking-widest">
                      <SelectValue placeholder="PLATFORM" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-white/10 text-[10px] font-black uppercase">
                      {LAUNCH_PLATFORMS.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 min-w-[120px]">
                  <Select value={chainFilter} onValueChange={setChainFilter}>
                    <SelectTrigger className="h-9 rounded-lg bg-white/5 border-white/10 text-[10px] uppercase font-black tracking-widest">
                      <SelectValue placeholder="CHAIN" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-white/10 text-[10px] font-black uppercase">
                      <SelectItem value="all">All Chains</SelectItem>
                      <SelectItem value="solana">Solana</SelectItem>
                      <SelectItem value="ethereum">Ethereum</SelectItem>
                      <SelectItem value="base">Base</SelectItem>
                      <SelectItem value="bsc">BNB Chain</SelectItem>
                      <SelectItem value="arbitrum">Arbitrum</SelectItem>
                      <SelectItem value="polygon">Polygon</SelectItem>
                      <SelectItem value="avalanche">Avalanche</SelectItem>
                      <SelectItem value="optimism">Optimism</SelectItem>
                      <SelectItem value="blast">Blast</SelectItem>
                      <SelectItem value="sonic">Sonic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 min-w-[120px]">
                  <Select value={minLiquidity} onValueChange={setMinLiquidity}>
                    <SelectTrigger className="h-9 rounded-lg bg-white/5 border-white/10 text-[10px] uppercase font-black tracking-widest">
                      <SelectValue placeholder="LIQUIDITY" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-white/10 text-[10px] font-black uppercase">
                      <SelectItem value="0">Any Depth</SelectItem>
                      <SelectItem value="1000">$1K+</SelectItem>
                      <SelectItem value="10000">$10K+</SelectItem>
                      <SelectItem value="50000">$50K+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <ScrollArea className="h-[600px]">
              {loading && tokens.length === 0 && activities.length === 0 ? (
                <div className="flex items-center justify-center py-32">
                  <div className="flex flex-col items-center gap-4 opacity-20">
                    <div className="h-12 w-12 rounded-full border-2 border-og-cyan border-t-transparent animate-spin" />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em]">Syncing Feed...</p>
                  </div>
                </div>
              ) : activeTab === "launches" ? (
                <div className="divide-y divide-white/[0.05]">
                  {filteredTokens.map((token) => {
                    const chain: ChainConfig | undefined = chainFromDexSlug(token.chainId);
                    const jupToken: JupTokenInfo = {
                      id: token.address,
                      name: token.name,
                      symbol: token.symbol,
                      icon: token.imageUrl,
                      decimals: 9,
                      chainId: chain?.id,
                      usdPrice: parseFloat(token.priceUsd) || 0,
                      fdv: token.fdv,
                      liquidity: token.liquidity,
                      stats24h: { priceChange: token.priceChange24h },
                      firstPool: { createdAt: token.pairCreatedAt ? new Date(token.pairCreatedAt).toISOString() : undefined },
                    };
                    return (
                    <CoinDetailDialog key={token.id} token={jupToken} trigger={
                    <div className="p-4 hover:bg-white/[0.03] transition-all group cursor-pointer">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="relative shrink-0">
                            {token.imageUrl ? (
                              <img src={token.imageUrl} alt={token.symbol} className="h-11 w-11 rounded-xl object-cover border border-white/10" />
                            ) : (
                              <div className="h-11 w-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-xs font-black text-og-cyan">
                                {token.symbol.slice(0, 2)}
                              </div>
                            )}
                            <div className="absolute -bottom-1 -right-1">
                              <Badge className={cn("text-[8px] px-1 py-0 border font-black", getPlatformColor(token.launchPlatform || ""))}>
                                {token.launchPlatform?.toUpperCase()}
                              </Badge>
                            </div>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black text-white">{token.symbol}</span>
                              {chain && chain.id !== "solana" && (
                                <Badge className="text-[7px] px-1 py-0 bg-white/5 text-white/40 border-white/10 font-black">
                                  {chain.shortName}
                                </Badge>
                              )}
                              <span className="text-[10px] text-white/30 truncate hidden sm:inline">{token.name}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[9px] font-mono text-white/20 tracking-tighter truncate">{token.address}</span>
                              <button onClick={() => { navigator.clipboard.writeText(token.address); toast.success("Copied"); }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity">
                                <Copy className="h-3 w-3 text-white/20 hover:text-white" />
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <p className="text-xs font-black font-mono text-white/80">${parseFloat(token.priceUsd).toFixed(8)}</p>
                            <p className={cn("text-[10px] font-black", token.priceChange24h >= 0 ? "text-og-lime" : "text-red-400")}>
                              {token.priceChange24h >= 0 ? "+" : ""}{token.priceChange24h.toFixed(1)}%
                            </p>
                          </div>
                          <div className="hidden md:block text-right min-w-[70px]">
                            <p className="text-[11px] font-black text-white/60">{formatNumber(token.liquidity)}</p>
                            <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest leading-none mt-0.5">Liquidity</p>
                          </div>
                          <div className="text-right min-w-[60px]">
                            <p className="text-[10px] font-bold text-white/40">{formatDistanceToNow(token.pairCreatedAt, { addSuffix: false })}</p>
                            <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest leading-none mt-0.5">Age</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    } />
                  );})}
                  {filteredTokens.length === 0 && !loading && (
                    <div className="p-12 text-center">
                      <p className="text-xs text-white/30 font-bold uppercase">No tokens matching filters</p>
                    </div>
                  )}
                </div>
              ) : activities.length > 0 ? (
                <div className="divide-y divide-white/[0.05]">
                  {activities.map((a) => (
                    <div key={a.signature} className="p-4 hover:bg-white/[0.03] transition-all group">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03]">
                          {getActivityIcon(a.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={cn("text-xs font-black uppercase", getActivityColor(a.type))}>{a.type.replace(/_/g, " ")}</span>
                            {a.walletLabel && (
                              <Badge className="text-[8px] bg-og-gold/10 text-og-gold border-og-gold/20">{a.walletLabel}</Badge>
                            )}
                          </div>
                          <p className="text-[10px] text-white/30 mt-0.5 truncate">{a.description}</p>
                        </div>
                        <div className="text-right shrink-0">
                          {a.solAmount != null && a.solAmount > 0 && (
                            <p className="text-xs font-black font-mono text-white/70">{formatSol(a.solAmount)}</p>
                          )}
                          {a.tokenAmount != null && a.tokenAmount > 0 && (
                            <p className="text-[10px] font-mono text-white/40">{a.tokenAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} tokens</p>
                          )}
                          <p className="text-[9px] text-white/15 mt-0.5">{formatDistanceToNow(new Date(a.timestamp), { addSuffix: true })}</p>
                        </div>
                        <a href={`https://solscan.io/tx/${a.signature}`} target="_blank" rel="noreferrer"
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100 shrink-0">
                          <ExternalLink className="h-3 w-3 text-white/30" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center">
                  <div className="h-16 w-16 rounded-full border-2 border-dashed border-white/10 flex items-center justify-center mx-auto mb-4">
                    <Eye className="h-6 w-6 text-white/10" />
                  </div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-white/40">
                    {trackedWallets.length === 0 ? "No wallets tracked" : "No activity found"}
                  </h4>
                  <p className="text-[10px] text-white/20 mt-2 uppercase tracking-tighter">
                    {trackedWallets.length === 0 ? "Add a wallet address to start monitoring." : "Transactions will appear here as they happen."}
                  </p>
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        {/* Right: Sidebar Panels */}
        <div className="space-y-4">
          {/* Market Radar */}
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 lg:p-5">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-4 w-4 text-og-gold" />
              <span className="text-[11px] font-black uppercase tracking-widest text-white">Market Radar</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "New Launches", val: tokens.length, col: "text-og-cyan" },
                { label: "Tracked", val: trackedWallets.length, col: "text-og-gold" },
                { label: "Gainers", val: tokens.filter(t => t.priceChange24h > 0).length, col: "text-og-lime" },
                { label: "Activities", val: activities.length, col: "text-white/60" },
              ].map((s, i) => (
                <div key={i} className="p-3 rounded-xl border border-white/5 bg-white/[0.01]">
                  <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest mb-1">{s.label}</p>
                  <p className={cn("text-lg font-black font-mono", s.col)}>{s.val}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Wallet Watchlist Manager */}
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 lg:p-5">
            <div className="flex items-center gap-2 mb-4">
              <Search className="h-4 w-4 text-og-gold" />
              <span className="text-[11px] font-black uppercase tracking-widest text-white">Wallet Watchlist</span>
            </div>
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/20" />
                <input type="text" value={walletInput} onChange={e => setWalletInput(e.target.value)}
                  placeholder="PASTE WALLET ADDRESS"
                  className="h-10 w-full rounded-xl bg-white/5 border border-white/10 pl-9 pr-4 text-[10px] font-mono text-white placeholder:text-white/10 focus:border-og-gold/40 transition-all uppercase" />
              </div>
              <input type="text" value={walletLabel} onChange={e => setWalletLabel(e.target.value)}
                placeholder="LABEL (OPTIONAL)"
                className="h-9 w-full rounded-xl bg-white/5 border border-white/10 px-4 text-[10px] font-mono text-white placeholder:text-white/10 focus:border-og-gold/40 transition-all uppercase" />
              <button onClick={addWallet} disabled={addingWallet || !walletInput.trim()}
                className="w-full h-10 rounded-xl bg-og-gold text-background text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all shadow-[0_0_15px_rgba(234,179,8,0.1)] disabled:opacity-40 flex items-center justify-center gap-2">
                <Plus className="h-3.5 w-3.5" />
                {addingWallet ? "Adding..." : "Add to Watchlist"}
              </button>
            </div>

            {/* Current tracked wallets */}
            {trackedWallets.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest">Tracking {trackedWallets.length} wallet{trackedWallets.length !== 1 ? "s" : ""}</p>
                {trackedWallets.map(w => (
                  <div key={w.id} className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/[0.05] group">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-black text-white/60 truncate">{w.label || shortAddr(w.wallet_address)}</p>
                      <p className="text-[8px] font-mono text-white/20 truncate">{w.wallet_address}</p>
                    </div>
                    <a href={`https://solscan.io/account/${w.wallet_address}`} target="_blank" rel="noreferrer"
                      className="p-1 rounded text-white/15 hover:text-white/40 transition-colors">
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <button onClick={() => removeWallet(w.id)}
                      className="p-1 rounded text-white/10 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Helius powered notice */}
          <div className="rounded-2xl border border-og-lime/20 bg-og-lime/5 p-4 flex gap-3">
            <Shield className="h-5 w-5 text-og-lime shrink-0" />
            <div>
              <p className="text-[10px] font-black text-og-lime uppercase tracking-widest">Powered by Helius RPC</p>
              <p className="text-[9px] font-bold text-og-lime/60 uppercase tracking-tighter mt-0.5 leading-tight">
                Wallet activity is fetched directly from Solana via Helius enhanced transactions API. Real-time, on-chain data.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Icon helpers ── */
const Radio = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M7.76 16.24a6 6 0 0 1 0-8.49"/><path d="M4.93 19.07a10 10 0 0 1 0-14.14"/></svg>;
const Shield = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>;
const Activity = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>;

export default LiveFeed;
