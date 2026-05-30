import { useState, useCallback, useEffect, useRef } from "react";
import { Plus, Eye, Trash2, RefreshCw, Send, Copy, ExternalLink, Zap, Clock, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownLeft, Coins, Globe, Twitter, MessageCircle, Link as LinkIcon, Play, Pause, BarChart3, Droplets, Users, Shield, Check, Wallet, ChevronDown, ChevronUp, Activity, DollarSign } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { ConnectedWalletTab } from "@/components/wallet/ConnectedWalletTab";
import { WalletSearch } from "@/components/WalletSearch";
import { PortfolioOverview } from "@/components/PortfolioOverview";
import { TokenList } from "@/components/TokenList";
import { NFTGallery } from "@/components/NFTGallery";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WalletCalloutButton } from "@/components/webhooks/WalletCalloutButton";
import { CoinDetailDialog } from "@/components/CoinDetailDialog";
// CreditBalance removed — credits system disabled
import { getWalletOverview, getAssets, getTransactions, WalletOverview, TokenAsset, Transaction, formatAddress, formatUsd } from "@/lib/solana-api";
import { toast } from "@/hooks/use-toast";
// supabase import removed — wallet page uses direct APIs now
import { formatDistanceToNow } from "date-fns";

interface TrackedWallet {
  address: string;
  label?: string;
  overview?: WalletOverview;
}

interface TokenWithLinks {
  address: string;
  symbol: string;
  name: string;
  balance: number;
  value: number;
  price: number;
  priceChange24h: number;
  image?: string;
  links?: {
    website?: string;
    twitter?: string;
    telegram?: string;
    discord?: string;
    dex?: string;
    explorer?: string;
  };
}

interface EnrichedTransaction {
  signature: string;
  type: string;
  timestamp?: number;
  description?: string;
  fee?: number;
  feePayer?: string;
  tokenName?: string;
  tokenSymbol?: string;
  tokenImage?: string;
  tokenMint?: string;
  amount?: string;
  amountUsd?: string;
  isIncoming?: boolean;
  isOutgoing?: boolean;
}

const Wallets = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [activeWallet, setActiveWallet] = useState<string | null>(null);
  const [trackedWallets, setTrackedWallets] = useState<TrackedWallet[]>([]);
  const [overview, setOverview] = useState<WalletOverview | null>(null);
  const [assets, setAssets] = useState<TokenAsset[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [enrichedTxs, setEnrichedTxs] = useState<EnrichedTransaction[]>([]);
  const [tokensWithLinks, setTokensWithLinks] = useState<TokenWithLinks[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [selectedToken, setSelectedToken] = useState<{ address: string; name: string; symbol: string } | null>(null);
  const [expandedWatchToken, setExpandedWatchToken] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeWalletRef = useRef<string | null>(null);

  useEffect(() => {
    activeWalletRef.current = activeWallet;
  }, [activeWallet]);

  useEffect(() => {
    if (autoRefresh && activeWallet) {
      refreshIntervalRef.current = setInterval(() => {
        if (activeWalletRef.current) {
          loadWalletData(activeWalletRef.current, true);
        }
      }, 10000);
    }
    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, [autoRefresh, activeWallet]);

  const enrichTransactions = useCallback(async (txs: Transaction[], wallet: string) => {
    const enriched: EnrichedTransaction[] = txs.map((tx) => {
      const type = tx.type || 'UNKNOWN';
      const nativeTransfer = tx.nativeTransfers?.[0];
      const tokenTransfer = tx.tokenTransfers?.[0];
      const isIncoming = nativeTransfer?.toUserAccount?.toLowerCase() === wallet.toLowerCase();
      const isOutgoing = nativeTransfer?.fromUserAccount?.toLowerCase() === wallet.toLowerCase();

      let amount = '';
      let tokenMint = '';
      let tokenSymbol = '';

      if (tokenTransfer) {
        amount = `${tokenTransfer.tokenAmount?.toFixed(4) || '0'} tokens`;
        tokenMint = tokenTransfer.mint || '';
      } else if (nativeTransfer?.amount) {
        amount = `${(nativeTransfer.amount / 1e9).toFixed(4)} SOL`;
      }

      return {
        signature: tx.signature,
        type,
        timestamp: tx.timestamp,
        description: tx.description,
        fee: tx.fee,
        feePayer: tx.feePayer,
        tokenMint,
        tokenSymbol,
        amount,
        isIncoming,
        isOutgoing,
      };
    });

    // Enrich token transfers with names/images from DexScreener (batch first 10 unique mints)
    const uniqueMints = [...new Set(enriched.filter(e => e.tokenMint).map(e => e.tokenMint!))].slice(0, 10);
    const mintData: Record<string, { name: string; symbol: string; image?: string }> = {};

    await Promise.all(uniqueMints.map(async (mint) => {
      try {
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
        const data = await res.json();
        const pair = data.pairs?.[0];
        if (pair) {
          mintData[mint] = {
            name: pair.baseToken?.name || 'Unknown',
            symbol: pair.baseToken?.symbol || '???',
            image: pair.info?.imageUrl,
          };
        }
      } catch { /* skip */ }
    }));

    return enriched.map(tx => ({
      ...tx,
      tokenName: tx.tokenMint ? mintData[tx.tokenMint]?.name : (tx.type === 'TRANSFER' ? 'SOL' : undefined),
      tokenSymbol: tx.tokenMint ? mintData[tx.tokenMint]?.symbol : (tx.type === 'TRANSFER' ? 'SOL' : undefined),
      tokenImage: tx.tokenMint ? mintData[tx.tokenMint]?.image : undefined,
    }));
  }, []);

  const loadWalletData = useCallback(async (address: string, silent = false) => {
    if (!silent) setIsLoading(true);
    setActiveWallet(address);
    
    try {
      const [overviewData, assetsData, txData] = await Promise.all([
        getWalletOverview(address),
        getAssets(address),
        getTransactions(address, 50),
      ]);

      setOverview(overviewData);
      setAssets(assetsData.items || []);
      setTransactions(txData || []);
      setLastRefresh(new Date());

      // Enrich transactions with token data
      const enriched = await enrichTransactions(txData || [], address);
      setEnrichedTxs(enriched);
      
      // Process tokens with real links from DexScreener
      const tokens = (assetsData.items || [])
        .filter((a: any) => a.interface === 'FungibleToken' || a.interface === 'FungibleAsset')
        .slice(0, 30);

      const tokensData: TokenWithLinks[] = [];
      
      for (const asset of tokens) {
        const tokenAddress = asset.id;
        const symbol = asset.content?.metadata?.symbol || '???';
        const name = asset.content?.metadata?.name || 'Unknown';
        const balance = (asset.token_info?.balance || 0) / Math.pow(10, asset.token_info?.decimals || 0);
        const value = asset.token_info?.price_info?.total_price || 0;
        const price = asset.token_info?.price_info?.price_per_token || 0;
        const image = asset.content?.links?.image;

        let links: TokenWithLinks['links'] = {
          dex: `https://dexscreener.com/solana/${tokenAddress}`,
          explorer: `https://solscan.io/token/${tokenAddress}`,
        };
        let priceChange24h = 0;

        try {
          const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
          const dexData = await dexRes.json();
          const pair = dexData.pairs?.[0];
          if (pair) {
            priceChange24h = pair.priceChange?.h24 || 0;
            if (pair.info?.websites?.[0]?.url) links.website = pair.info.websites[0].url;
            if (pair.info?.socials) {
              const twitter = pair.info.socials.find((s: any) => s.type === 'twitter');
              const telegram = pair.info.socials.find((s: any) => s.type === 'telegram');
              const discord = pair.info.socials.find((s: any) => s.type === 'discord');
              if (twitter) links.twitter = twitter.url;
              if (telegram) links.telegram = telegram.url;
              if (discord) links.discord = discord.url;
            }
          }
        } catch (e) { /* skip */ }

        tokensData.push({ address: tokenAddress, symbol, name, balance, value, price, priceChange24h, image, links });
      }

      setTokensWithLinks(tokensData);
      setTrackedWallets(prev => prev.map(w => w.address === address ? { ...w, overview: overviewData } : w));
      if (!silent) toast({ title: "Data refreshed" });
    } catch (error) {
      console.error('Error fetching wallet data:', error);
      if (!silent) toast({ title: "Error loading wallet", description: error instanceof Error ? error.message : "Failed to fetch wallet data", variant: "destructive" });
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [enrichTransactions]);

  const handleSearch = useCallback(async (address: string) => {
    if (!trackedWallets.find(w => w.address === address)) {
      setTrackedWallets(prev => [...prev, { address }]);
    }
    await loadWalletData(address);
    toast({ title: "Wallet tracked", description: `Now tracking ${formatAddress(address)}` });
  }, [trackedWallets, loadWalletData]);

  const removeWallet = (address: string) => {
    setTrackedWallets(prev => prev.filter(w => w.address !== address));
    if (activeWallet === address) {
      setActiveWallet(null); setOverview(null); setAssets([]); setTransactions([]); setTokensWithLinks([]); setEnrichedTxs([]);
    }
    toast({ title: "Wallet removed" });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
    toast({ title: `${label} copied` });
  };

  const pushTokenToDiscord = async (token: TokenWithLinks) => {
    toast({ title: "Coming Soon", description: "Discord sharing is coming soon!" });
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toFixed(2);
  };

  const getTypeIcon = (tx: EnrichedTransaction) => {
    const t = tx.type?.toUpperCase() || '';
    if (t === 'SWAP') return <RefreshCw className="h-4 w-4 text-[#eab308]" />;
    if (t === 'TRANSFER' && tx.isIncoming) return <ArrowDownLeft className="h-4 w-4 text-green-500" />;
    if (t === 'TRANSFER' && tx.isOutgoing) return <ArrowUpRight className="h-4 w-4 text-red-500" />;
    if (t.includes('BUY')) return <ArrowDownLeft className="h-4 w-4 text-green-500" />;
    if (t.includes('SELL')) return <ArrowUpRight className="h-4 w-4 text-red-500" />;
    return <Coins className="h-4 w-4 text-white/40" />;
  };

  const getTypeLabel = (tx: EnrichedTransaction) => {
    const t = tx.type?.toUpperCase() || 'UNKNOWN';
    if (t === 'TRANSFER' && tx.isIncoming) return 'Received';
    if (t === 'TRANSFER' && tx.isOutgoing) return 'Sent';
    if (t === 'SWAP') return 'Swap';
    return t.replace(/_/g, ' ');
  };

  const getTypeBg = (tx: EnrichedTransaction) => {
    const t = tx.type?.toUpperCase() || '';
    if (tx.isIncoming) return 'bg-green-500/10';
    if (tx.isOutgoing) return 'bg-red-500/10';
    if (t === 'SWAP') return 'bg-secondary/10';
    return 'bg-muted/50';
  };

  return (
    <AppLayout>
      <PageHeader title="Wallet" description="Connect your wallet or track any Solana address">
        <div className="flex items-center gap-2">
          {activeWallet && (
            <Badge className={`gap-1.5 ${autoRefresh ? "bg-primary/15 text-primary border-primary/25" : "bg-white/[0.05]"}`}>
              <div className={`w-2 h-2 rounded-full ${autoRefresh ? "bg-primary animate-pulse" : "bg-white/30"}`} />
              {autoRefresh ? "Live" : "Paused"}
            </Badge>
          )}
        </div>
      </PageHeader>

      <div className="p-4 lg:p-6 space-y-4">
        {/* Top-level tab: My Wallet vs Watch Mode */}
        <Tabs defaultValue="my-wallet" className="w-full">
          <TabsList className="inline-flex bg-white/[0.04] border border-white/[0.07] rounded-2xl mb-4">
            <TabsTrigger value="my-wallet" className="gap-2 data-[state=active]:bg-[hsl(var(--og-lime))/0.12] data-[state=active]:text-[hsl(var(--og-lime))]">
              <Wallet className="h-4 w-4" />My Wallet
            </TabsTrigger>
            <TabsTrigger value="watch" className="gap-2">
              <Eye className="h-4 w-4" />Watch Mode
            </TabsTrigger>
          </TabsList>

          {/* MY WALLET TAB */}
          <TabsContent value="my-wallet">
            <ConnectedWalletTab />
          </TabsContent>

          {/* WATCH MODE TAB */}
          <TabsContent value="watch">
        <WalletSearch onSearch={handleSearch} isLoading={isLoading} />

        {trackedWallets.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-white/40">Tracked Wallets</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {trackedWallets.map((wallet) => (
                <Card key={wallet.address} className={`glass-card cursor-pointer transition-all hover:border-primary/50 ${activeWallet === wallet.address ? 'border-primary/40 bg-primary/8' : ''}`} onClick={() => loadWalletData(wallet.address)}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-sm truncate">{formatAddress(wallet.address, 6)}</p>
                        {wallet.overview && <p className="text-lg font-bold text-primary mt-1">${wallet.overview.totalUsdValue.toFixed(2)}</p>}
                      </div>
                      <div className="flex gap-1">
                        <WalletCalloutButton walletAddress={wallet.address} size="icon" showLabel={false} />
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); loadWalletData(wallet.address); }}><RefreshCw className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); removeWallet(wallet.address); }}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {isLoading && <LoadingSkeleton />}

        {!isLoading && overview && activeWallet && (
          <div className="space-y-6 animate-fade-in">
            {/* Live Tracking Controls */}
            <Card className="og-glass-frame">
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-primary/10"><Zap className="h-5 w-5 text-primary" /></div>
                    <div>
                      <p className="font-semibold">Live Tracking</p>
                      {lastRefresh && <p className="text-xs text-white/40">Last updated {formatDistanceToNow(lastRefresh, { addSuffix: true })}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant={autoRefresh ? "default" : "outline"} size="sm" onClick={() => setAutoRefresh(!autoRefresh)} className="rounded-xl gap-2">
                      {autoRefresh ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      {autoRefresh ? "Pause" : "Resume"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => loadWalletData(activeWallet)} className="rounded-xl gap-2"><RefreshCw className="h-4 w-4" />Refresh</Button>
                    <Button variant="ghost" size="icon" onClick={() => copyToClipboard(activeWallet, "Address")} className="rounded-xl"><Copy className="h-4 w-4" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Wallet Metrics Summary */}
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {[
                { icon: BarChart3, label: "Portfolio", value: formatUsd(overview.totalUsdValue), color: "text-primary" },
                { icon: Coins, label: "SOL", value: `${(overview.balance || 0).toFixed(2)}`, color: "text-primary" },
                { icon: TrendingUp, label: "24h", value: `${overview.priceChange24h >= 0 ? '+' : ''}${overview.priceChange24h.toFixed(1)}%`, color: overview.priceChange24h >= 0 ? "text-green-500" : "text-red-500" },
                { icon: Coins, label: "Tokens", value: String(overview.tokenCount), color: "text-[#eab308]" },
                { icon: Shield, label: "NFTs", value: String(overview.nftCount), color: "text-primary" },
                { icon: Users, label: "Assets", value: String(overview.totalAssets), color: "text-primary" },
              ].map((s, i) => (
                <Card key={i} className="og-glass-card">
                  <CardContent className="p-3 text-center">
                    <s.icon className={`h-4 w-4 mx-auto mb-1 ${s.color}`} />
                    <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-[10px] text-white/40">{s.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <PortfolioOverview data={overview} walletAddress={activeWallet} onRefresh={() => loadWalletData(activeWallet)} />

            <Tabs defaultValue="tokens" className="w-full">
              <div className="overflow-x-auto">
                <TabsList className="inline-flex w-auto min-w-full sm:min-w-0 bg-white/[0.04] border border-white/[0.07] rounded-2xl">
                  <TabsTrigger value="tokens" className="gap-1"><Coins className="h-4 w-4" />Tokens</TabsTrigger>
                  <TabsTrigger value="links" className="gap-1"><LinkIcon className="h-4 w-4" />Links</TabsTrigger>
                  <TabsTrigger value="nfts">NFTs</TabsTrigger>
                  <TabsTrigger value="history" className="gap-1"><Clock className="h-4 w-4" />History</TabsTrigger>
                </TabsList>
              </div>
              
              <div className="mt-4">
                <TabsContent value="tokens">
                  {tokensWithLinks.length === 0 ? (
                    <TokenList tokens={assets} />
                  ) : (
                    <div className="space-y-2">
                      {tokensWithLinks.map((token) => {
                        const isExpanded = expandedWatchToken === token.address;
                        return (
                          <Card key={token.address} className={`og-glass-card overflow-hidden transition-all ${isExpanded ? "border-primary/30" : ""}`}>
                            <CardContent className="p-0">
                              {/* Token row */}
                              <div className="flex items-center gap-3 px-3.5 py-3">
                                {token.image ? (
                                  <img src={token.image} alt={token.symbol} className="h-10 w-10 rounded-xl object-cover shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                ) : (
                                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#22d3ee] to-[#eab308] flex items-center justify-center text-xs font-bold text-[hsl(var(--og-ink))] shrink-0">{token.symbol.slice(0, 2)}</div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-bold text-sm">{token.symbol}</p>
                                    <Badge className={token.priceChange24h >= 0 ? "bg-green-500/10 text-green-400 border-green-500/20 text-[9px]" : "bg-red-500/10 text-red-400 border-red-500/20 text-[9px]"}>
                                      {token.priceChange24h >= 0 ? "+" : ""}{token.priceChange24h.toFixed(1)}%
                                    </Badge>
                                  </div>
                                  <p className="text-[11px] text-white/35 truncate">{token.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })} {token.symbol}</p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="font-mono text-sm font-semibold text-primary">${token.value.toFixed(2)}</p>
                                  <p className="text-[11px] text-white/30">${token.price < 0.01 ? token.price.toExponential(2) : token.price.toFixed(5)}</p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0 ml-1">
                                  <Button variant="outline" size="sm" onClick={() => setSelectedToken({ address: token.address, name: token.name, symbol: token.symbol })}
                                    className="h-6 px-2 text-[10px]">Analyze</Button>
                                  <Button variant="ghost" size="sm"
                                    className={`h-6 w-6 p-0 transition-colors ${isExpanded ? "text-primary" : "text-white/30 hover:text-white/60"}`}
                                    onClick={() => setExpandedWatchToken(isExpanded ? null : token.address)}>
                                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                  </Button>
                                </div>
                              </div>

                              {/* Expanded detail panel */}
                              {isExpanded && (
                                <div className="border-t border-white/[0.07] bg-black/20">
                                  {/* Live stats strip */}
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/[0.05]">
                                    {[
                                      { label: "Price", value: `$${token.price < 0.0001 ? token.price.toExponential(3) : token.price.toFixed(6)}` },
                                      { label: "24h Change", value: `${token.priceChange24h >= 0 ? "+" : ""}${token.priceChange24h.toFixed(2)}%` },
                                      { label: "Balance", value: `${token.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${token.symbol}` },
                                      { label: "Value", value: `$${token.value.toFixed(2)}` },
                                    ].map((stat, i) => (
                                      <div key={i} className="bg-black/30 p-3 text-center">
                                        <p className="text-[10px] text-white/30 mb-0.5">{stat.label}</p>
                                        <p className="text-xs font-bold text-white">{stat.value}</p>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="p-3 space-y-3">
                                    {/* Social links */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-[10px] text-white/30">Links:</span>
                                      {token.links?.website && (
                                        <a href={token.links.website} target="_blank" rel="noopener noreferrer"
                                          className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-lg bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.12] text-white/60 transition-colors">
                                          <Globe className="h-2.5 w-2.5" />Website
                                        </a>
                                      )}
                                      {token.links?.twitter && (
                                        <a href={token.links.twitter} target="_blank" rel="noopener noreferrer"
                                          className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-lg bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.12] text-white/60 transition-colors">
                                          <Twitter className="h-2.5 w-2.5" />Twitter
                                        </a>
                                      )}
                                      {token.links?.telegram && (
                                        <a href={token.links.telegram} target="_blank" rel="noopener noreferrer"
                                          className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-lg bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.12] text-white/60 transition-colors">
                                          <MessageCircle className="h-2.5 w-2.5" />Telegram
                                        </a>
                                      )}
                                      <a href={token.links?.dex || `https://dexscreener.com/solana/${token.address}`} target="_blank" rel="noopener noreferrer"
                                        className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-lg bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.12] text-primary transition-colors">
                                        <TrendingUp className="h-2.5 w-2.5" />DexScreener
                                      </a>
                                      <a href={token.links?.explorer || `https://solscan.io/token/${token.address}`} target="_blank" rel="noopener noreferrer"
                                        className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-lg bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.12] text-white/60 transition-colors">
                                        <ExternalLink className="h-2.5 w-2.5" />Solscan
                                      </a>
                                    </div>
                                    {/* Inline DexScreener chart */}
                                    <div>
                                      <p className="text-[10px] text-white/30 mb-2 flex items-center gap-1.5">
                                        <BarChart3 className="h-3 w-3" />Live Chart & Trade Feed
                                      </p>
                                      <iframe
                                        src={`https://dexscreener.com/solana/${token.address}?embed=1&theme=dark&trades=1&info=1`}
                                        className="w-full rounded-xl border border-white/[0.07]"
                                        style={{ height: "480px" }}
                                        title={`${token.symbol} live chart`}
                                      />
                                    </div>
                                    {/* Quick action buttons */}
                                    <div className="flex gap-2">
                                      <Button variant="outline" size="sm" onClick={() => setSelectedToken({ address: token.address, name: token.name, symbol: token.symbol })}
                                        className="flex-1 gap-1.5 border-primary/30 text-primary hover:bg-primary/10">
                                        <Activity className="h-3.5 w-3.5" />Full Analysis
                                      </Button>
                                      <Button variant="outline" size="sm" onClick={() => copyToClipboard(token.address, "Address")}
                                        className="gap-1.5">
                                        {copied === token.address ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                                        Copy CA
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="links">
                  <Card className="og-glass-card">
                    <CardContent className="p-0">
                      <ScrollArea className="h-[500px]">
                        {tokensWithLinks.length === 0 ? (
                          <div className="text-center py-12">
                            <LinkIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                            <p className="text-white/40">No tokens with links found</p>
                          </div>
                        ) : (
                          <div className="divide-y divide-border/50">
                            {tokensWithLinks.map((token) => (
                              <div key={token.address} className="p-4 hover:bg-white/[0.04] transition-colors">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex items-center gap-3 min-w-0 flex-1">
                                    {token.image ? (
                                      <img src={token.image} alt={token.symbol} className="h-10 w-10 rounded-xl object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                    ) : (
                                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#22d3ee] to-[#eab308] flex items-center justify-center text-xs font-bold text-[hsl(var(--og-ink))]">{token.symbol.slice(0, 2)}</div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2">
                                        <p className="font-bold truncate">{token.symbol}</p>
                                        <Badge className={token.priceChange24h >= 0 ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-red-500/10 text-red-500 border-red-500/20"}>
                                          {token.priceChange24h >= 0 ? "+" : ""}{token.priceChange24h.toFixed(1)}%
                                        </Badge>
                                      </div>
                                      <p className="text-xs text-muted-foreground truncate">{token.name}</p>
                                      <p className="text-xs font-mono text-primary">${token.price < 0.01 ? token.price.toExponential(2) : token.price.toFixed(4)} • {token.balance.toFixed(2)} held • ${token.value.toFixed(2)}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 flex-wrap justify-end">
                                    {token.links?.website && <Button variant="ghost" size="icon" className="h-8 w-8" asChild><a href={token.links.website} target="_blank" rel="noopener noreferrer"><Globe className="h-4 w-4" /></a></Button>}
                                    {token.links?.twitter && <Button variant="ghost" size="icon" className="h-8 w-8" asChild><a href={token.links.twitter} target="_blank" rel="noopener noreferrer"><Twitter className="h-4 w-4" /></a></Button>}
                                    {token.links?.telegram && <Button variant="ghost" size="icon" className="h-8 w-8" asChild><a href={token.links.telegram} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-4 w-4" /></a></Button>}
                                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild><a href={token.links?.dex} target="_blank" rel="noopener noreferrer"><TrendingUp className="h-4 w-4" /></a></Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild><a href={token.links?.explorer} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a></Button>
                                    <Button variant="outline" size="sm" onClick={() => pushTokenToDiscord(token)} className="gap-1 bg-[#5865F2]/10 border-[#5865F2]/30 hover:bg-[#5865F2]/20 text-[#5865F2]"><Send className="h-3 w-3" />Push</Button>
                                    <Button variant="outline" size="sm" onClick={() => setSelectedToken({ address: token.address, name: token.name, symbol: token.symbol })}>Analyze</Button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="nfts"><NFTGallery assets={assets} /></TabsContent>

                {/* Enhanced History Tab */}
                <TabsContent value="history">
                  <Card className="og-glass-card">
                    <CardContent className="p-0">
                      <div className="p-4 border-b border-white/[0.07] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Clock className="h-5 w-5 text-primary" />
                          <h3 className="font-semibold">Transaction History</h3>
                          <Badge variant="outline">{enrichedTxs.length} txns</Badge>
                        </div>
                      </div>
                      <ScrollArea className="h-[600px]">
                        {enrichedTxs.length === 0 ? (
                          <div className="text-center py-12">
                            <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                            <p className="text-white/40">No recent transactions found</p>
                          </div>
                        ) : (
                          <div className="divide-y divide-border/50">
                            {enrichedTxs.map((tx, index) => {
                              const timestamp = tx.timestamp 
                                ? formatDistanceToNow(new Date(tx.timestamp * 1000), { addSuffix: true })
                                : 'Unknown time';
                              const fullDate = tx.timestamp ? new Date(tx.timestamp * 1000).toLocaleString() : '';

                              return (
                                <div key={tx.signature} className="p-4 hover:bg-white/[0.04] transition-colors">
                                  <div className="flex items-center gap-3">
                                    {/* Token Image or Type Icon */}
                                    <div className="relative shrink-0">
                                      {tx.tokenImage ? (
                                        <img src={tx.tokenImage} alt="" className="h-10 w-10 rounded-xl object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                      ) : (
                                        <div className={`p-2.5 rounded-xl ${getTypeBg(tx)}`}>
                                          {getTypeIcon(tx)}
                                        </div>
                                      )}
                                    </div>

                                    {/* Details */}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <p className="font-semibold text-sm capitalize">{getTypeLabel(tx)}</p>
                                        {tx.tokenName && (
                                          <Badge variant="outline" className="text-[10px]">{tx.tokenName}</Badge>
                                        )}
                                        {tx.tokenSymbol && !tx.tokenName && (
                                          <Badge variant="outline" className="text-[10px]">{tx.tokenSymbol}</Badge>
                                        )}
                                        <Badge variant="secondary" className="text-[10px]">{tx.type}</Badge>
                                      </div>
                                      <p className="text-xs text-white/40" title={fullDate}>{timestamp}</p>
                                      {tx.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{tx.description}</p>}
                                    </div>

                                    {/* Amount */}
                                    <div className="text-right shrink-0">
                                      {tx.amount && tx.amount !== 'undefined tokens' && tx.amount !== '0 tokens' && (
                                        <p className={`font-mono text-sm font-semibold ${tx.isIncoming ? 'text-green-500' : tx.isOutgoing ? 'text-red-500' : ''}`}>
                                          {tx.isIncoming ? '+' : tx.isOutgoing ? '-' : ''}{tx.amount}
                                        </p>
                                      )}
                                      {tx.fee && <p className="text-[10px] text-white/40">Fee: {(tx.fee / 1e9).toFixed(5)} SOL</p>}
                                    </div>

                                    {/* Actions - always visible on mobile */}
                                    <div className="flex items-center gap-1 shrink-0">
                                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyToClipboard(tx.signature, "TX hash")}>
                                        {copied === tx.signature ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                                      </Button>
                                      <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                                        <a href={`https://solscan.io/tx/${tx.signature}`} target="_blank" rel="noopener noreferrer">
                                          <ExternalLink className="h-3 w-3" />
                                        </a>
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </TabsContent>
              </div>
            </Tabs>
          </div>
        )}

        {!isLoading && !activeWallet && trackedWallets.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 rounded-full bg-white/[0.06] mb-4"><Eye className="h-8 w-8 text-white/40" /></div>
            <h3 className="text-lg font-medium mb-2">No wallets tracked</h3>
            <p className="text-sm text-muted-foreground max-w-sm">Search for a Solana wallet address above to start tracking holdings and transactions.</p>
          </div>
        )}
          </TabsContent>
          {/* end Watch Mode */}
        </Tabs>
      </div>

      {selectedToken && (
        <CoinDetailDialog
          key={selectedToken.address}
          token={{ id: selectedToken.address, name: selectedToken.name, symbol: selectedToken.symbol, decimals: 9 }}
          defaultOpen
          onOpenChange={(open) => { if (!open) setSelectedToken(null); }}
        />
      )}
    </AppLayout>
  );
};

export default Wallets;
