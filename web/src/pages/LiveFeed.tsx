import { useState, useEffect, useCallback } from "react";
import { Zap, TrendingUp, Clock, ExternalLink, RefreshCw, Filter, Sparkles, Rocket, Globe, Play, Pause, Copy, ArrowUpRight, ArrowDownRight, Repeat, Search, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

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
  tokenSymbol?: string;
  tokenName?: string;
  amount?: number;
  usdValue?: number;
  walletAddress: string;
  walletLabel?: string;
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

const LAUNCH_PLATFORMS = [
  { id: "all", name: "All Platforms", icon: Globe },
  { id: "pump.fun", name: "Pump.fun", icon: Rocket },
  { id: "raydium", name: "Raydium", icon: Zap },
  { id: "jupiter", name: "Jupiter", icon: TrendingUp },
];

const detectLaunchPlatform = (dexId: string, url: string): string => {
  if (url.includes("pump.fun") || dexId.includes("pump")) return "pump.fun";
  if (dexId.includes("raydium")) return "raydium";
  if (dexId.includes("orca")) return "orca";
  if (dexId.includes("meteora")) return "meteora";
  if (dexId.includes("phoenix")) return "phoenix";
  return dexId || "Unknown";
};

const getPlatformColor = (platform: string): string => {
  switch (platform.toLowerCase()) {
    case "pump.fun": return "bg-pink-500/10 text-pink-400 border-pink-500/30";
    case "raydium": return "bg-purple-500/10 text-purple-400 border-purple-500/30";
    case "jupiter": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
    default: return "bg-white/5 text-white/40 border-white/10";
  }
};

const getActivityIcon = (type: string) => {
  const t = type.toLowerCase();
  if (t.includes('buy') || t.includes('swap_in')) return <ArrowUpRight className="h-3.5 w-3.5 text-og-lime" />;
  if (t.includes('sell') || t.includes('swap_out')) return <ArrowDownRight className="h-3.5 w-3.5 text-red-400" />;
  if (t.includes('transfer')) return <Repeat className="h-3.5 w-3.5 text-og-gold" />;
  return <Zap className="h-3.5 w-3.5 text-og-cyan" />;
};

const LiveFeed = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("launches");
  const [tokens, setTokens] = useState<NewToken[]>([]);
  const [activities, setActivities] = useState<WalletActivity[]>([]);
  const [trackedWallets, setTrackedWallets] = useState<TrackedWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [minLiquidity, setMinLiquidity] = useState<string>("0");

  const fetchTrackedWallets = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.from('tracked_wallets').select('*').eq('user_id', user.id);
      if (!error) setTrackedWallets(data || []);
    } catch {}
  }, [user]);

  const fetchWalletActivities = useCallback(async () => {
    if (trackedWallets.length === 0) { setActivities([]); return; }
    setLoading(true);
    try {
      const allActivities: WalletActivity[] = [];
      for (const wallet of trackedWallets.slice(0, 5)) {
        const { data, error } = await supabase.functions.invoke('solana-tracker', {
          body: { action: 'getTransactions', walletAddress: wallet.wallet_address, limit: 10 }
        });
        if (!error && data?.transactions) {
          const walletActivities = data.transactions.map((tx: any) => ({
            signature: tx.signature, type: tx.type || 'UNKNOWN',
            timestamp: tx.timestamp ? new Date(tx.timestamp * 1000).toISOString() : new Date().toISOString(),
            description: tx.description || tx.type || 'Transaction',
            tokenSymbol: tx.tokenTransfers?.[0]?.tokenStandard === 'Fungible' ? tx.tokenTransfers?.[0]?.mint?.substring(0, 4) : undefined,
            amount: tx.tokenTransfers?.[0]?.tokenAmount,
            usdValue: tx.nativeTransfers?.[0]?.amount ? (tx.nativeTransfers[0].amount / 1e9) * 200 : undefined,
            walletAddress: wallet.wallet_address, walletLabel: wallet.label,
          }));
          allActivities.push(...walletActivities);
        }
      }
      allActivities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setActivities(allActivities.slice(0, 50));
    } catch {} finally { setLoading(false); }
  }, [trackedWallets]);

  const fetchNewTokens = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("https://api.dexscreener.com/token-profiles/latest/v1");
      const profilesData = await response.json();
      const solanaTokens = profilesData.filter((p: any) => p.chainId === "solana").slice(0, 20);
      const tokensWithPairs: NewToken[] = [];
      for (const profile of solanaTokens) {
        try {
          const pairResponse = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${profile.tokenAddress}`);
          const pairData = await pairResponse.json();
          if (pairData.pairs?.length > 0) {
            const pair = pairData.pairs[0];
            tokensWithPairs.push({
              id: profile.tokenAddress, address: profile.tokenAddress,
              name: pair.baseToken?.name || profile.name || "Unknown",
              symbol: pair.baseToken?.symbol || profile.symbol || "???",
              pairAddress: pair.pairAddress, chainId: pair.chainId, dexId: pair.dexId,
              priceUsd: pair.priceUsd || "0", priceChange24h: pair.priceChange?.h24 || 0,
              volume24h: pair.volume?.h24 || 0, liquidity: pair.liquidity?.usd || 0,
              fdv: pair.fdv || 0, pairCreatedAt: pair.pairCreatedAt || Date.now(),
              url: pair.url, imageUrl: profile.icon, launchPlatform: detectLaunchPlatform(pair.dexId, pair.url),
            });
          }
        } catch {}
      }
      setTokens(tokensWithPairs);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { if (user) fetchTrackedWallets(); fetchNewTokens(); }, [user, fetchTrackedWallets, fetchNewTokens]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      if (activeTab === "tracked") fetchWalletActivities();
      else fetchNewTokens();
    }, 15000);
    return () => clearInterval(interval);
  }, [autoRefresh, activeTab, fetchWalletActivities, fetchNewTokens]);

  const filteredTokens = tokens.filter((t) => {
    const minLiq = parseInt(minLiquidity) || 0;
    if (t.liquidity < minLiq) return false;
    if (filter === "gainers" && t.priceChange24h <= 0) return false;
    if (platformFilter !== "all" && t.launchPlatform?.toLowerCase() !== platformFilter.toLowerCase()) return false;
    return true;
  });

  const formatNumber = (num: number) => {
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(1)}K`;
    return `$${num.toFixed(0)}`;
  };

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
             <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all",
                autoRefresh 
                  ? "bg-og-lime/10 text-og-lime border-og-lime/30" 
                  : "bg-white/5 text-white/30 border-white/10"
              )}
            >
              <div className={cn("h-1.5 w-1.5 rounded-full", autoRefresh ? "bg-og-lime animate-pulse" : "bg-white/20")} />
              {autoRefresh ? "LIVE STREAMING" : "PAUSED"}
            </button>
            <button
              onClick={activeTab === "tracked" ? fetchWalletActivities : fetchNewTokens}
              disabled={loading}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/40 hover:text-white transition-all disabled:opacity-50"
            >
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
                { id: "tracked", label: "Tracked Wallets", icon: Zap },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={cn(
                    "flex items-center gap-2 border-b-2 px-1 py-4 text-[11px] font-black uppercase tracking-widest transition-all",
                    activeTab === t.id
                      ? "border-og-cyan text-white"
                      : "border-transparent text-white/20 hover:text-white/40"
                  )}
                >
                  <t.icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1">
             {/* Feed Controls */}
            {activeTab === "launches" && (
                <div className="p-3 border-b border-white/[0.07] flex flex-wrap gap-2">
                   <div className="flex-1 min-w-[150px]">
                      <Select value={platformFilter} onValueChange={setPlatformFilter}>
                        <SelectTrigger className="h-9 rounded-lg bg-white/5 border-white/10 text-[10px] uppercase font-black tracking-widest">
                          <SelectValue placeholder="PLATFORM" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#070d14] border-white/10 text-[10px] font-black uppercase">
                          {LAUNCH_PLATFORMS.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                   </div>
                   <div className="flex-1 min-w-[150px]">
                     <Select value={minLiquidity} onValueChange={setMinLiquidity}>
                        <SelectTrigger className="h-9 rounded-lg bg-white/5 border-white/10 text-[10px] uppercase font-black tracking-widest">
                          <SelectValue placeholder="LIQUIDITY" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#070d14] border-white/10 text-[10px] font-black uppercase">
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
              {loading && tokens.length === 0 ? (
                 <div className="flex items-center justify-center py-32">
                    <div className="flex flex-col items-center gap-4 opacity-20">
                      <div className="h-12 w-12 rounded-full border-2 border-og-cyan border-t-transparent animate-spin" />
                      <p className="text-[10px] font-black uppercase tracking-[0.2em]">Syncing Feed...</p>
                    </div>
                 </div>
              ) : activeTab === "launches" ? (
                <div className="divide-y divide-white/[0.05]">
                  {filteredTokens.map((token, i) => (
                    <div key={token.id} className="p-4 hover:bg-white/[0.03] transition-all group">
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
                                  <span className="text-[10px] text-white/30 truncate hidden sm:inline">{token.name}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                   <span className="text-[9px] font-mono text-white/20 tracking-tighter truncate">{token.address}</span>
                                   <button onClick={() => { navigator.clipboard.writeText(token.address); toast.success("Copied"); }} className="opacity-0 group-hover:opacity-100 transition-opacity"><Copy className="h-3 w-3 text-white/20 hover:text-white" /></button>
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
                             <a href={token.url} target="_blank" rel="noreferrer" className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100">
                                <ExternalLink className="h-3.5 w-3.5 text-white/40" />
                             </a>
                          </div>
                       </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center">
                   <div className="h-16 w-16 rounded-full border-2 border-dashed border-white/10 flex items-center justify-center mx-auto mb-4">
                      <Zap className="h-6 w-6 text-white/10" />
                   </div>
                   <h4 className="text-xs font-black uppercase tracking-widest text-white/40">No wallet activity found</h4>
                   <p className="text-[10px] text-white/20 mt-2 uppercase tracking-tighter">Add wallets to your watchlist to start forensic monitoring.</p>
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        {/* Right: Intelligence Panels */}
        <div className="space-y-4">
           {/* Global Stats */}
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
                   { label: "High Vol", val: tokens.filter(t => t.volume24h > 50000).length, col: "text-white/60" },
                 ].map((s, i) => (
                   <div key={i} className="p-3 rounded-xl border border-white/5 bg-white/[0.01]">
                      <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest mb-1">{s.label}</p>
                      <p className={cn("text-lg font-black font-mono", s.col)}>{s.val}</p>
                   </div>
                 ))}
              </div>
           </div>

           {/* Watchlist Quick Add */}
           <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 lg:p-5">
              <div className="flex items-center gap-2 mb-4">
                <Star className="h-4 w-4 text-og-gold" />
                <span className="text-[11px] font-black uppercase tracking-widest text-white">Quick Watch</span>
              </div>
              <div className="space-y-3">
                 <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/20" />
                    <input 
                      type="text" 
                      placeholder="PASTE WALLET ADDRESS"
                      className="h-10 w-full rounded-xl bg-white/5 border border-white/10 pl-9 pr-4 text-[10px] font-mono text-white placeholder:text-white/10 focus:border-og-gold/40 transition-all uppercase"
                    />
                 </div>
                 <button className="w-full h-10 rounded-xl bg-og-gold text-[#070d14] text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all shadow-[0_0_15px_rgba(234,179,8,0.1)]">
                    Add to Watchlist
                 </button>
              </div>
           </div>

           {/* Security notice */}
           <div className="rounded-2xl border border-og-lime/20 bg-og-lime/5 p-4 flex gap-3">
              <Shield className="h-5 w-5 text-og-lime shrink-0" />
              <div>
                <p className="text-[10px] font-black text-og-lime uppercase tracking-widest">Forensic Screening active</p>
                <p className="text-[9px] font-bold text-og-lime/60 uppercase tracking-tighter mt-0.5 leading-tight">Every token in this feed is being pre-scanned for major rug indicators and developer provenance.</p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

// Simplified icon helper using Lucide
const Radio = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M7.76 16.24a6 6 0 0 1 0-8.49"/><path d="M4.93 19.07a10 10 0 0 1 0-14.14"/></svg>;
const Shield = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>;
const Activity = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>;

export default LiveFeed;
