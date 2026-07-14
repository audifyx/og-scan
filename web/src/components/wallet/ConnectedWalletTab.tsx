/**
 * ConnectedWalletTab — Full on-chain wallet terminal powered by Phantom.
 * Features: connect, portfolio, inline charts, live data feed per token,
 * buys/sells, PnL dashboard, volume tracker, tx history.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import {
  Copy, ExternalLink, RefreshCw, TrendingUp, TrendingDown,
  ArrowUpRight, ArrowDownLeft, Coins, Clock, Zap, ChevronDown,
  BarChart3, Wallet, Check, X, AlertTriangle, Search, ArrowLeftRight,
  Shield, DollarSign, Activity, Target, Trophy, Skull, Flame, ChevronUp,
  Globe, Twitter, MessageCircle, Filter, Eye, Layers, PieChart, Volume2,
  Plus, Minus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import {
  getWalletOverview, getAssets, getTransactions, parseTransactions, enrichTxsWithMetadata,
  enrichTokenPrices, computeWalletPnL, fetchSolPrice,
  WalletOverview, TokenAsset, Transaction, ParsedTransaction, TokenPnL, WalletPnLSummary,
  formatAddress, formatUsd
} from "@/lib/solana-api";
import { HELIUS_RPC, HELIUS_API_KEY, SOL_MINT, JUPITER_BASE, JUPITER_API_KEY } from "@/lib/og";
import { PLATFORM_FEE_BPS, PLATFORM_FEE_ENABLED, deriveFeeAccount } from "@/lib/platformFee";
import { formatDistanceToNow } from "date-fns";
import { VersionedTransaction } from "@solana/web3.js";

/* ─── Types ─────────────────────────────────────────────────────── */
interface RichToken {
  mint: string;
  symbol: string;
  name: string;
  balance: number;
  decimals: number;
  price: number;
  value: number;
  change24h: number;
  volume24h?: number;
  liquidity?: number;
  mcap?: number;
  image?: string;
  verified?: boolean;
  website?: string;
  twitter?: string;
  telegram?: string;
  pairAddress?: string;
}

// Use ParsedTransaction from solana-api for tx display
type EnrichedTx = ParsedTransaction & {
  tokenName?: string;
  tokenSymbol?: string;
  tokenImage?: string;
};

// Re-export WalletPnLSummary type alias
type WalletPnL = WalletPnLSummary;

/* ─── Phantom native swap ────────────────────────────────────────── */
function base64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function phantomSwap(
  fromMint: string, toMint: string, amountLamports: number,
  slippageBps: number, userPublicKey: string
): Promise<string> {
  const phantom = (window as any).phantom?.solana;
  if (!phantom?.isPhantom) throw new Error("Phantom wallet not detected");
  const quoteRes = await fetch(
    `${JUPITER_BASE}/swap/v1/quote?inputMint=${fromMint}&outputMint=${toMint}&amount=${amountLamports}&slippageBps=${slippageBps}&restrictIntermediateTokens=true${PLATFORM_FEE_ENABLED ? `&platformFeeBps=${PLATFORM_FEE_BPS}` : ""}`,
    { headers: { "Authorization": `Bearer ${JUPITER_API_KEY}` } }
  );
  if (!quoteRes.ok) throw new Error("Failed to get swap quote");
  const quote = await quoteRes.json();
  const swapRes = await fetch(`${JUPITER_BASE}/swap/v1/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${JUPITER_API_KEY}` },
    body: JSON.stringify({ quoteResponse: quote, userPublicKey, wrapAndUnwrapSol: true, dynamicComputeUnitLimit: true, prioritizationFeeLamports: "auto", ...(PLATFORM_FEE_ENABLED ? { feeAccount: deriveFeeAccount(toMint) } : {}) }),
  });
  if (!swapRes.ok) throw new Error("Failed to build swap transaction");
  const { swapTransaction } = await swapRes.json();
  return swapTransaction;
}

/* ─── Helpers ───────────────────────────────────────────────────── */
function getTypeIcon(tx: EnrichedTx) {
  if (tx.isBuy) return <ArrowDownLeft className="h-4 w-4 text-green-400" />;
  if (tx.isSell) return <ArrowUpRight className="h-4 w-4 text-red-400" />;
  if (tx.isSwap) return <ArrowLeftRight className="h-4 w-4 text-[#22d3ee]" />;
  if (tx.isIncoming) return <ArrowDownLeft className="h-4 w-4 text-green-400" />;
  if (tx.isOutgoing) return <ArrowUpRight className="h-4 w-4 text-red-400" />;
  if (tx.type === "SWAP" || tx.type === "BUY" || tx.type === "SELL") return <ArrowLeftRight className="h-4 w-4 text-[#22d3ee]" />;
  return <Zap className="h-4 w-4 text-white/40" />;
}

function getTypeBg(tx: EnrichedTx) {
  if (tx.isBuy || tx.isIncoming) return "bg-green-500/10 border border-green-500/20";
  if (tx.isSell || tx.isOutgoing) return "bg-red-500/10 border border-red-500/20";
  if (tx.isSwap || tx.type === "SWAP") return "bg-[#22d3ee]/10 border border-[#22d3ee]/20";
  return "bg-white/[0.06] border border-white/[0.08]";
}

function getTxLabel(tx: EnrichedTx): string {
  if (tx.isBuy) return "Bought";
  if (tx.isSell) return "Sold";
  if (tx.isSwap) return "Swapped";
  if (tx.isIncoming) return "Received";
  if (tx.isOutgoing) return "Sent";
  const t = tx.type?.replace(/_/g, " ").toLowerCase();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "Unknown";
}

function getTxTokenMint(tx: EnrichedTx): string | undefined {
  return tx.isBuy ? tx.receivedMint : tx.isSell ? tx.spentMint : tx.receivedMint ?? tx.spentMint;
}

function formatPnl(val: number) {
  const sign = val >= 0 ? "+" : "";
  return `${sign}${formatUsd(val)}`;
}

function fmtNum(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return formatUsd(n);
}

/* ═══════════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════════ */
export function ConnectedWalletTab() {
  const { publicKey, connect, disconnect, connected, wallet, wallets, select } = useWallet();
  const { connection } = useConnection();

  const [overview, setOverview] = useState<WalletOverview | null>(null);
  const [tokens, setTokens] = useState<RichToken[]>([]);
  const [txs, setTxs] = useState<EnrichedTx[]>([]);
  const [walletPnl, setWalletPnl] = useState<WalletPnL | null>(null);
  const [loading, setLoading] = useState(false);
  const [pnlLoading, setPnlLoading] = useState(false);
  const [txsLoading, setTxsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("portfolio");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [solPrice, setSolPrice] = useState(150);

  // Swap state
  const [swapOpen, setSwapOpen] = useState(false);
  const [swapToken, setSwapToken] = useState<RichToken | null>(null);
  const [swapMode, setSwapMode] = useState<"buy" | "sell">("buy");
  const [swapAmount, setSwapAmount] = useState("");
  const [swapLoading, setSwapLoading] = useState(false);
  const [swapQuote, setSwapQuote] = useState<{ outAmount: number; outSymbol: string; priceImpact: number; platformFee: number } | null>(null);
  const [slippage, setSlippage] = useState(100);

  // Chart / expanded token state
  const [expandedToken, setExpandedToken] = useState<string | null>(null);
  const [tokenTradesMap, setTokenTradesMap] = useState<Record<string, Array<{ signature: string; timestamp?: number; side: "buy" | "sell"; tokenAmount: number; solAmount: number; usdValue: number; pricePerToken: number }>>>({});
  const [tokenTradesLoading, setTokenTradesLoading] = useState<string | null>(null);

  // Token search & sort
  const [tokenSearch, setTokenSearch] = useState("");
  const [sortBy, setSortBy] = useState<"value" | "change" | "volume" | "pnl">("value");

  const address = publicKey?.toBase58() ?? "";

  /* ── Fetch token market data from DexScreener ── */
  const enrichTokensWithMarketData = useCallback(async (richTokens: RichToken[]): Promise<RichToken[]> => {
    const topTokens = richTokens.slice(0, 20);
    const enriched = await Promise.all(topTokens.map(async (t) => {
      try {
        const dexRes = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${t.mint}`);
        const pairs = await dexRes.json() as Array<{
          priceChange?: { h24?: number };
          volume?: { h24?: number };
          liquidity?: { usd?: number };
          marketCap?: number;
          pairAddress?: string;
          info?: { socials?: Array<{ type: string; url: string }>; websites?: Array<{ url: string }>; imageUrl?: string };
        }>;
        const pair = Array.isArray(pairs) ? pairs[0] : null;
        if (pair) {
          const socials = pair.info?.socials || [];
          const twitter = socials.find((s) => s.type === "twitter")?.url;
          const telegram = socials.find((s) => s.type === "telegram")?.url;
          const website = pair.info?.websites?.[0]?.url;
          const image = pair.info?.imageUrl;
          return {
            ...t,
            image: t.image || image,
            change24h: pair.priceChange?.h24 ?? t.change24h,
            volume24h: pair.volume?.h24 ?? 0,
            liquidity: pair.liquidity?.usd ?? 0,
            mcap: pair.marketCap ?? 0,
            twitter, telegram, website,
            pairAddress: pair.pairAddress,
          };
        }
      } catch { /* skip */ }
      return t;
    }));
    return [...enriched, ...richTokens.slice(20)];
  }, []);

  /* ── Load wallet data ── */
  const loadData = useCallback(async (addr: string, silent = false) => {
    if (!addr) return;
    if (!silent) setLoading(true);
    setTxsLoading(true);
    try {
      // Load overview + assets + transactions in parallel
      const [ov, assetData, { price: currentSolPrice }, rawTxs] = await Promise.all([
        getWalletOverview(addr),
        getAssets(addr, 1, 100),
        fetchSolPrice(),
        getTransactions(addr, 75),
      ]);
      setOverview(ov);
      setSolPrice(currentSolPrice);

      // Build initial rich token list from DAS
      const rawRich: RichToken[] = assetData.items
        .map((a: TokenAsset) => {
          const meta = a.content?.metadata ?? {};
          const info = a.token_info ?? {};
          const decimals = info.decimals ?? 0;
          const raw = info.balance ?? 0;
          const balance = raw / Math.pow(10, decimals);
          const price = info.price_info?.price_per_token ?? 0;
          const value = info.price_info?.total_price ?? 0;
          return {
            mint: a.id,
            symbol: meta.symbol ?? "?",
            name: meta.name ?? "Unknown",
            balance, decimals, price, value,
            change24h: 0,
            image: a.content?.links?.image,
          };
        })
        .filter((t: RichToken) => t.balance > 0)
        .sort((a: RichToken, b: RichToken) => b.value - a.value);

      setTokens(rawRich);

      // Enrich zero-price tokens with Jupiter prices (pump.fun, new launches)
      const priceEnrichedItems = await enrichTokenPrices(assetData.items, currentSolPrice);
      const rich: RichToken[] = priceEnrichedItems
        .map((a: TokenAsset) => {
          const meta = a.content?.metadata ?? {};
          const info = a.token_info ?? {};
          const decimals = info.decimals ?? 0;
          const raw = info.balance ?? 0;
          const balance = raw / Math.pow(10, decimals);
          const price = info.price_info?.price_per_token ?? 0;
          const value = info.price_info?.total_price ?? 0;
          return {
            mint: a.id,
            symbol: meta.symbol ?? "?",
            name: meta.name ?? "Unknown",
            balance, decimals, price, value,
            change24h: 0,
            image: a.content?.links?.image,
          };
        })
        .filter((t: RichToken) => t.balance > 0)
        .sort((a: RichToken, b: RichToken) => b.value - a.value);

      setTokens(rich);

      // Parse + classify transactions using new comprehensive parser
      const parsed = await parseTransactions(rawTxs, addr);

      // Enrich with token metadata from DexScreener
      const enriched = await enrichTxsWithMetadata(parsed);
      setTxs(enriched as EnrichedTx[]);
      setTxsLoading(false);
      setLastRefresh(new Date());

      // Enrich tokens with market data (DexScreener: volume, liquidity, mcap, links)
      enrichTokensWithMarketData(rich).then(setTokens);

    } catch (e) {
      if (!silent) toast({ title: "Failed to load wallet", description: String(e), variant: "destructive" });
    } finally {
      setLoading(false);
      setTxsLoading(false);
    }
  }, [enrichTokensWithMarketData]);

  /* ── Compute PnL from on-chain transaction history ── */
  const computePnL = useCallback(async (addr: string) => {
    setPnlLoading(true);
    try {
      // Use the new computeWalletPnL which:
      // - Fetches 200 txs for better accuracy
      // - Handles pump.fun, Jupiter, Raydium, Orca via events.swap + accountData
      // - Uses Jupiter Price API for accurate USD values
      // - Falls back to DexScreener for metadata
      const pnlResult = await computeWalletPnL(
        addr,
        tokens.map(t => ({
          mint: t.mint,
          symbol: t.symbol,
          name: t.name,
          image: t.image,
          price: t.price,
          value: t.value,
          balance: t.balance,
        })),
        200
      );

      // Build tokenTradesMap for the holdings expanded panels
      const newTradesMap: Record<string, Array<{ signature: string; timestamp?: number; side: "buy" | "sell"; tokenAmount: number; solAmount: number; usdValue: number; pricePerToken: number }>> = {};
      for (const t of pnlResult.tokens) {
        if (t.trades.length > 0) newTradesMap[t.mint] = t.trades;
      }
      setTokenTradesMap(newTradesMap);
      setWalletPnl(pnlResult);
    } catch (e) {
      console.error("PnL computation failed:", e);
      toast({ title: "PnL calculation failed", description: String(e), variant: "destructive" });
    } finally {
      setPnlLoading(false);
    }
  }, [tokens]);

  useEffect(() => {
    if (connected && address) {
      loadData(address);
    } else {
      setOverview(null); setTokens([]); setTxs([]); setWalletPnl(null);
    }
  }, [connected, address, loadData]);

  useEffect(() => {
    if (connected && address && activeTab === "pnl" && !walletPnl && !pnlLoading) {
      computePnL(address);
    }
  }, [activeTab, connected, address, walletPnl, pnlLoading, computePnL]);

  // Auto-refresh every 15s
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (connected && address) {
      intervalRef.current = setInterval(() => loadData(address, true), 15000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [connected, address, loadData]);

  /* ── Swap quote fetch ── */
  useEffect(() => {
    if (!swapOpen || !swapToken || !swapAmount || isNaN(Number(swapAmount))) { setSwapQuote(null); return; }
    const timeout = setTimeout(async () => {
      try {
        const inputMint = swapMode === "buy" ? SOL_MINT : swapToken.mint;
        const outputMint = swapMode === "buy" ? swapToken.mint : SOL_MINT;
        const decimals = swapMode === "buy" ? 9 : swapToken.decimals;
        const amountLamports = Math.floor(Number(swapAmount) * Math.pow(10, decimals));
        if (amountLamports <= 0) return;
        const res = await fetch(
          `${JUPITER_BASE}/swap/v1/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountLamports}&slippageBps=${slippage}${PLATFORM_FEE_ENABLED ? `&platformFeeBps=${PLATFORM_FEE_BPS}` : ""}`,
          { headers: { "Authorization": `Bearer ${JUPITER_API_KEY}` } }
        );
        const q = await res.json();
        if (q.outAmount) {
          const outDecimals = swapMode === "buy" ? swapToken.decimals : 9;
          const outSymbol = swapMode === "buy" ? swapToken.symbol : "SOL";
          const platformFee = q.platformFee ? Number(q.platformFee.amount) / Math.pow(10, outDecimals) : 0;
          setSwapQuote({ outAmount: Number(q.outAmount) / Math.pow(10, outDecimals), outSymbol, priceImpact: parseFloat(q.priceImpactPct ?? "0") * 100, platformFee });
        }
      } catch { /* ignore */ }
    }, 600);
    return () => clearTimeout(timeout);
  }, [swapOpen, swapToken, swapAmount, swapMode, slippage]);

  /* ── Execute swap ── */
  const executeSwap = async () => {
    if (!swapToken || !swapAmount || !publicKey) return;
    setSwapLoading(true);
    try {
      const phantom = (window as any).phantom?.solana;
      if (!phantom?.isPhantom) throw new Error("Phantom wallet not found. Please install Phantom.");
      const inputMint = swapMode === "buy" ? SOL_MINT : swapToken.mint;
      const outputMint = swapMode === "buy" ? swapToken.mint : SOL_MINT;
      const decimals = swapMode === "buy" ? 9 : swapToken.decimals;
      const amountLamports = Math.floor(Number(swapAmount) * Math.pow(10, decimals));
      const swapTxBase64 = await phantomSwap(inputMint, outputMint, amountLamports, slippage, publicKey.toBase58());
      const txBytes = base64ToUint8Array(swapTxBase64);
      const tx = VersionedTransaction.deserialize(txBytes);
      const { signature: sig } = await phantom.signAndSendTransaction(tx);
      toast({ title: `${swapMode === "buy" ? "Buy" : "Sell"} submitted! ✅`, description: `TX: ${formatAddress(sig, 6)}` });
      setSwapOpen(false); setSwapAmount("");
      setTimeout(() => loadData(address, true), 3000);
    } catch (e: any) {
      toast({ title: "Swap failed", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setSwapLoading(false);
    }
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(address);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  // Sorted + filtered tokens
  const sortedTokens = [...tokens]
    .filter(t => !tokenSearch || t.symbol.toLowerCase().includes(tokenSearch.toLowerCase()) || t.name.toLowerCase().includes(tokenSearch.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "value") return b.value - a.value;
      if (sortBy === "change") return (b.change24h || 0) - (a.change24h || 0);
      if (sortBy === "volume") return (b.volume24h || 0) - (a.volume24h || 0);
      return b.value - a.value;
    });

  /* ════════════════════════════════════════════════════════════════
     NOT CONNECTED VIEW
     ════════════════════════════════════════════════════════════════ */
  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8 px-4">
        <div className="og-glass-card rounded-3xl p-8 max-w-md w-full text-center space-y-6">
          <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-[hsl(var(--og-lime))] to-[#22d3ee] flex items-center justify-center shadow-lg shadow-[hsl(var(--og-lime))/0.3]">
            <Wallet className="h-10 w-10 text-[hsl(var(--og-ink))]" />
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
            <p className="text-white/50 text-sm leading-relaxed">
              Connect Phantom or Solflare to view your portfolio, trade tokens, track PnL, volume, and full live data feeds — all inside OrbitX.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {wallets.filter(w => ["Phantom", "Solflare"].includes(w.adapter.name)).map(w => (
              <button key={w.adapter.name} onClick={() => { select(w.adapter.name as any); setTimeout(() => connect().catch(() => {}), 100); }}
                className="flex items-center gap-3 w-full px-5 py-3.5 rounded-2xl bg-white/[0.06] border border-white/[0.1] hover:bg-white/[0.1] hover:border-[hsl(var(--og-lime))/0.4] transition-all group">
                {w.adapter.icon && <img src={w.adapter.icon} alt={w.adapter.name} className="w-7 h-7 rounded-lg" />}
                <span className="font-semibold text-sm">{w.adapter.name}</span>
                <span className="ml-auto text-[10px] text-white/30 group-hover:text-[hsl(var(--og-lime))] transition-colors">Connect →</span>
              </button>
            ))}
            {wallets.filter(w => ["Phantom", "Solflare"].includes(w.adapter.name)).length === 0 && (
              <div className="text-center text-sm text-white/40 py-4">
                <AlertTriangle className="h-5 w-5 mx-auto mb-2 text-yellow-500" />
                No wallets detected. Install <a href="https://phantom.app" target="_blank" rel="noopener noreferrer" className="text-[hsl(var(--og-lime))] underline">Phantom</a> first.
              </div>
            )}
          </div>
          <p className="text-[11px] text-white/25">Your keys never leave your wallet. OrbitX only reads on-chain data.</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2 max-w-sm">
          {["Portfolio overview", "Buy & sell tokens", "Per-token live feeds", "PnL tracker", "Volume analytics", "Trade history"].map(f => (
            <span key={f} className="text-xs px-3 py-1 rounded-full bg-white/[0.05] border border-white/[0.08] text-white/50">{f}</span>
          ))}
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════════
     CONNECTED VIEW
     ════════════════════════════════════════════════════════════════ */
  const totalValue = overview?.totalUsdValue ?? 0;
  const solValue = (overview?.balance ?? 0) * (overview?.solPrice ?? 0);

  return (
    <div className="space-y-4 pb-8">

      {/* ── Header bar ── */}
      <div className="og-glass-card rounded-2xl p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            {wallet?.adapter.icon ? (
              <img src={wallet.adapter.icon} alt="" className="w-9 h-9 rounded-xl border border-white/10" />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[hsl(var(--og-lime))] to-[#22d3ee] flex items-center justify-center">
                <Wallet className="h-4 w-4 text-[hsl(var(--og-ink))]" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-semibold">{formatAddress(address, 6)}</span>
                <button onClick={copyAddress} className="text-white/40 hover:text-white/80 transition-colors">
                  {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
                <a href={`https://solscan.io/account/${address}`} target="_blank" rel="noopener noreferrer" className="text-white/40 hover:text-white/80 transition-colors">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
              <div className="text-[11px] text-white/35">{wallet?.adapter.name ?? "Wallet"} • Solana Mainnet</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => loadData(address)} disabled={loading} className="gap-1.5 text-white/50 hover:text-white h-8">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              {lastRefresh ? formatDistanceToNow(lastRefresh, { addSuffix: true }) : ""}
            </Button>
            <Button variant="outline" size="sm" onClick={() => disconnect()} className="h-8 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10">Disconnect</Button>
          </div>
        </div>
      </div>

      {/* ── Portfolio summary cards ── */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: BarChart3, label: "Total Value", color: "text-[hsl(var(--og-lime))]", value: formatUsd(totalValue), sub: `${tokens.length} tokens` },
            { icon: Coins, label: "SOL Balance", color: "text-[#22d3ee]", value: `${(overview.balance ?? 0).toFixed(4)} SOL`, sub: formatUsd(solValue) },
            { icon: overview.priceChange24h >= 0 ? TrendingUp : TrendingDown, label: "SOL 24h", color: overview.priceChange24h >= 0 ? "text-green-400" : "text-red-400", value: `${overview.priceChange24h >= 0 ? "+" : ""}${(overview.priceChange24h ?? 0).toFixed(2)}%`, sub: `$${(overview.solPrice ?? 0).toFixed(2)}/SOL` },
            { icon: Shield, label: "NFTs", color: "text-purple-400", value: String(overview.nftCount ?? 0), sub: `${overview.totalAssets ?? 0} total assets` },
          ].map((s, i) => (
            <Card key={i} className="og-glass-card">
              <CardContent className="p-3.5">
                <div className="flex items-center gap-2 mb-1">
                  <s.icon className={`h-3.5 w-3.5 ${s.color}`} />
                  <span className="text-[11px] text-white/40">{s.label}</span>
                </div>
                <p className={`text-base font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[11px] text-white/30">{s.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Main tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto">
          <TabsList className="inline-flex w-auto min-w-full sm:min-w-0 bg-white/[0.04] border border-white/[0.07] rounded-2xl">
            <TabsTrigger value="portfolio" className="gap-1.5"><Coins className="h-3.5 w-3.5" />Holdings</TabsTrigger>
            <TabsTrigger value="pnl" className="gap-1.5"><DollarSign className="h-3.5 w-3.5" />P&L</TabsTrigger>
            <TabsTrigger value="volume" className="gap-1.5"><Activity className="h-3.5 w-3.5" />Volume</TabsTrigger>
            <TabsTrigger value="trade" className="gap-1.5"><ArrowLeftRight className="h-3.5 w-3.5" />Trade</TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5"><Clock className="h-3.5 w-3.5" />History</TabsTrigger>
          </TabsList>
        </div>

        {/* ══════════════════════════════════════════════════════
            HOLDINGS TAB — full per-token expanded panels
            ══════════════════════════════════════════════════════ */}
        <TabsContent value="portfolio" className="mt-4 space-y-3">
          {/* Controls row */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
              <Input placeholder="Search tokens..." value={tokenSearch} onChange={e => setTokenSearch(e.target.value)}
                className="pl-9 bg-white/[0.04] border-white/[0.08] rounded-xl h-9 text-sm" />
            </div>
            <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.07] rounded-xl p-0.5">
              {(["value", "change", "volume"] as const).map(s => (
                <button key={s} onClick={() => setSortBy(s)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${sortBy === s ? "bg-white/[0.1] text-white" : "text-white/35 hover:text-white/60"}`}>
                  {s === "value" ? "Value" : s === "change" ? "24h%" : "Volume"}
                </button>
              ))}
            </div>
          </div>

          {/* SOL row */}
          <Card className="og-glass-card">
            <CardContent className="p-0">
              <div className="flex items-center gap-3 p-3.5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center shrink-0">
                  <span className="text-xs font-black text-white">SOL</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">Solana</p>
                    <Badge className="text-[9px] px-1.5 py-0 h-4 bg-[#9945FF]/20 text-[#9945FF] border-[#9945FF]/30">Native</Badge>
                  </div>
                  <p className="text-[11px] text-white/40">{(overview?.balance ?? 0).toFixed(6)} SOL</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono text-sm font-semibold text-[hsl(var(--og-lime))]">{formatUsd(solValue)}</p>
                  <p className={`text-[11px] ${(overview?.priceChange24h ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {(overview?.priceChange24h ?? 0) >= 0 ? "+" : ""}{(overview?.priceChange24h ?? 0).toFixed(2)}%
                  </p>
                </div>
                <Button size="sm" variant="outline"
                  className="h-7 text-[11px] ml-1 border-[hsl(var(--og-lime))/0.3] text-[hsl(var(--og-lime))] hover:bg-[hsl(var(--og-lime))/0.1]"
                  onClick={() => { setSwapToken({ mint: SOL_MINT, symbol: "SOL", name: "Solana", balance: overview?.balance ?? 0, decimals: 9, price: overview?.solPrice ?? 0, value: solValue, change24h: overview?.priceChange24h ?? 0 }); setSwapMode("sell"); setSwapOpen(true); }}>
                  Sell
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Token list with expandable detail panels */}
          {loading && tokens.length === 0 ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-20 rounded-2xl bg-white/[0.04] animate-pulse" />)}</div>
          ) : sortedTokens.length === 0 ? (
            <div className="text-center py-12 text-white/30 text-sm">{tokenSearch ? "No tokens match" : "No tokens found"}</div>
          ) : (
            <div className="space-y-2">
              {sortedTokens.map((token) => {
                const isExpanded = expandedToken === token.mint;
                const tokenTrades = tokenTradesMap[token.mint] || [];
                const recentBuys = tokenTrades.filter(t => t.side === "buy").slice(0, 5);
                const recentSells = tokenTrades.filter(t => t.side === "sell").slice(0, 5);

                return (
                  <Card key={token.mint} className={`og-glass-card overflow-hidden transition-all ${isExpanded ? "border-[hsl(var(--og-lime))/0.3]" : ""}`}>
                    {/* Token row — always visible */}
                    <CardContent className="p-0">
                      <div className="flex items-center gap-3 px-3.5 py-3">
                        {/* Token image */}
                        {token.image ? (
                          <img src={token.image} alt={token.symbol} className="w-10 h-10 rounded-xl object-cover shrink-0"
                            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[hsl(var(--og-lime))/0.3] to-[#22d3ee]/0.3 border border-white/[0.08] flex items-center justify-center shrink-0">
                            <span className="text-[10px] font-black text-white/70">{token.symbol.slice(0, 3)}</span>
                          </div>
                        )}

                        {/* Name + balance */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-semibold text-sm">{token.symbol}</p>
                            {token.change24h !== 0 && (
                              <Badge className={`text-[9px] px-1.5 py-0 h-4 ${token.change24h >= 0 ? "bg-green-500/15 text-green-400 border-green-500/25" : "bg-red-500/15 text-red-400 border-red-500/25"}`}>
                                {token.change24h >= 0 ? "+" : ""}{token.change24h.toFixed(1)}%
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-white/35 truncate">
                            {token.balance < 0.01 ? token.balance.toExponential(2) : token.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })} {token.symbol}
                          </p>
                        </div>

                        {/* Value + price */}
                        <div className="text-right shrink-0">
                          <p className="font-mono text-sm font-semibold">{token.value > 0 ? formatUsd(token.value) : "—"}</p>
                          <p className="text-[11px] text-white/30">${token.price < 0.001 ? token.price.toExponential(2) : token.price.toFixed(5)}</p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0 ml-1">
                          <Button size="sm" variant="outline"
                            className="h-6 px-2 text-[10px] border-green-500/30 text-green-400 hover:bg-green-500/10"
                            onClick={() => { setSwapToken(token); setSwapMode("buy"); setSwapOpen(true); }}>
                            <Plus className="h-2.5 w-2.5 mr-0.5" />Buy
                          </Button>
                          <Button size="sm" variant="outline"
                            className="h-6 px-2 text-[10px] border-red-500/30 text-red-400 hover:bg-red-500/10"
                            onClick={() => { setSwapToken(token); setSwapMode("sell"); setSwapOpen(true); }}>
                            <Minus className="h-2.5 w-2.5 mr-0.5" />Sell
                          </Button>
                          <Button size="sm" variant="ghost"
                            className={`h-6 w-6 p-0 transition-colors ${isExpanded ? "text-[hsl(var(--og-lime))]" : "text-white/30 hover:text-white/60"}`}
                            onClick={() => setExpandedToken(isExpanded ? null : token.mint)}>
                            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      </div>

                      {/* ── Expanded Detail Panel ── */}
                      {isExpanded && (
                        <div className="border-t border-white/[0.07] bg-black/20">
                          {/* Live stats strip */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/[0.05]">
                            {[
                              { label: "Price", value: `$${token.price < 0.0001 ? token.price.toExponential(3) : token.price.toFixed(6)}` },
                              { label: "24h Volume", value: token.volume24h ? fmtNum(token.volume24h) : "N/A" },
                              { label: "Liquidity", value: token.liquidity ? fmtNum(token.liquidity) : "N/A" },
                              { label: "Market Cap", value: token.mcap ? fmtNum(token.mcap) : "N/A" },
                            ].map((stat, i) => (
                              <div key={i} className="bg-black/30 p-3 text-center">
                                <p className="text-[10px] text-white/30 mb-0.5">{stat.label}</p>
                                <p className="text-xs font-bold text-white">{stat.value}</p>
                              </div>
                            ))}
                          </div>

                          {/* Chart + tabs */}
                          <div className="p-3 space-y-3">
                            {/* Social links */}
                            {(token.website || token.twitter || token.telegram) && (
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] text-white/30">Links:</span>
                                {token.website && (
                                  <a href={token.website} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-lg bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.12] text-white/60 transition-colors">
                                    <Globe className="h-2.5 w-2.5" />Website
                                  </a>
                                )}
                                {token.twitter && (
                                  <a href={token.twitter} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-lg bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.12] text-white/60 transition-colors">
                                    <Twitter className="h-2.5 w-2.5" />Twitter
                                  </a>
                                )}
                                {token.telegram && (
                                  <a href={token.telegram} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-lg bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.12] text-white/60 transition-colors">
                                    <MessageCircle className="h-2.5 w-2.5" />Telegram
                                  </a>
                                )}
                                <a href={`https://dexscreener.com/solana/${token.mint}`} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-lg bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.12] text-[hsl(var(--og-lime))] transition-colors">
                                  <TrendingUp className="h-2.5 w-2.5" />DexScreener
                                </a>
                                <a href={`https://solscan.io/token/${token.mint}`} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-lg bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.12] text-white/60 transition-colors">
                                  <ExternalLink className="h-2.5 w-2.5" />Solscan
                                </a>
                              </div>
                            )}

                            {/* Inline DexScreener chart */}
                            <div>
                              <p className="text-[10px] text-white/30 mb-2 flex items-center gap-1.5">
                                <BarChart3 className="h-3 w-3" />Live Chart
                              </p>
                              <iframe
                                src={`https://dexscreener.com/solana/${token.mint}?embed=1&theme=dark&trades=1&info=0`}
                                className="w-full rounded-xl border border-white/[0.07]"
                                style={{ height: "400px" }}
                                title={`${token.symbol} live chart`}
                              />
                            </div>

                            {/* Live Trade Feed — buys and sells */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {/* Recent Buys */}
                              <div>
                                <p className="text-[10px] text-white/30 mb-2 flex items-center gap-1.5">
                                  <ArrowDownLeft className="h-3 w-3 text-green-400" />Your Recent Buys
                                </p>
                                {recentBuys.length === 0 ? (
                                  <p className="text-[10px] text-white/20 italic">No buy trades in history</p>
                                ) : (
                                  <div className="space-y-1">
                                    {recentBuys.map(trade => (
                                      <div key={trade.signature} className="flex items-center gap-2 p-2 rounded-lg bg-green-500/5 border border-green-500/10">
                                        <div className="flex-1 min-w-0">
                                          <p className="text-[10px] font-semibold text-green-400">+{trade.tokenAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} {token.symbol}</p>
                                          <p className="text-[9px] text-white/30">{trade.solAmount.toFixed(4)} SOL · {trade.timestamp ? formatDistanceToNow(new Date(trade.timestamp * 1000), { addSuffix: true }) : "—"}</p>
                                        </div>
                                        <div className="text-right">
                                          <p className="text-[10px] text-white/60">{formatUsd(trade.usdValue)}</p>
                                          {trade.pricePerToken > 0 && <p className="text-[9px] text-white/25">${trade.pricePerToken.toExponential(2)}/token</p>}
                                        </div>
                                        <a href={`https://solscan.io/tx/${trade.signature}`} target="_blank" rel="noopener noreferrer">
                                          <ExternalLink className="h-2.5 w-2.5 text-white/20 hover:text-white/60" />
                                        </a>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Recent Sells */}
                              <div>
                                <p className="text-[10px] text-white/30 mb-2 flex items-center gap-1.5">
                                  <ArrowUpRight className="h-3 w-3 text-red-400" />Your Recent Sells
                                </p>
                                {recentSells.length === 0 ? (
                                  <p className="text-[10px] text-white/20 italic">No sell trades in history</p>
                                ) : (
                                  <div className="space-y-1">
                                    {recentSells.map(trade => (
                                      <div key={trade.signature} className="flex items-center gap-2 p-2 rounded-lg bg-red-500/5 border border-red-500/10">
                                        <div className="flex-1 min-w-0">
                                          <p className="text-[10px] font-semibold text-red-400">-{trade.tokenAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} {token.symbol}</p>
                                          <p className="text-[9px] text-white/30">{trade.solAmount.toFixed(4)} SOL · {trade.timestamp ? formatDistanceToNow(new Date(trade.timestamp * 1000), { addSuffix: true }) : "—"}</p>
                                        </div>
                                        <div className="text-right">
                                          <p className="text-[10px] text-white/60">{formatUsd(trade.usdValue)}</p>
                                          {trade.pricePerToken > 0 && <p className="text-[9px] text-white/25">${trade.pricePerToken.toExponential(2)}/token</p>}
                                        </div>
                                        <a href={`https://solscan.io/tx/${trade.signature}`} target="_blank" rel="noopener noreferrer">
                                          <ExternalLink className="h-2.5 w-2.5 text-white/20 hover:text-white/60" />
                                        </a>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Note about loading trade history */}
                            {tokenTrades.length === 0 && (
                              <div className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                                <Activity className="h-3.5 w-3.5 text-white/20 shrink-0" />
                                <p className="text-[10px] text-white/30">Switch to the <strong className="text-white/50">P&L tab</strong> and click "Calculate" to load full trade history for this token.</p>
                              </div>
                            )}
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

        {/* ══════════════════════════════════════════════════════
            P&L TAB
            ══════════════════════════════════════════════════════ */}
        <TabsContent value="pnl" className="mt-4 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base">Profit & Loss</h3>
              <p className="text-[11px] text-white/35">Based on your last 100 transactions</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => computePnL(address)} disabled={pnlLoading}
              className="h-8 gap-1.5 border-[hsl(var(--og-lime))/0.3] text-[hsl(var(--og-lime))] hover:bg-[hsl(var(--og-lime))/0.1]">
              <RefreshCw className={`h-3.5 w-3.5 ${pnlLoading ? "animate-spin" : ""}`} />
              {pnlLoading ? "Calculating..." : "Recalculate"}
            </Button>
          </div>

          {pnlLoading && (
            <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-2xl bg-white/[0.04] animate-pulse" />)}</div>
          )}

          {!pnlLoading && !walletPnl && (
            <Card className="og-glass-card">
              <CardContent className="p-12 text-center">
                <DollarSign className="h-12 w-12 text-white/15 mx-auto mb-4" />
                <p className="text-white/40 text-sm">Click "Recalculate" to compute your P&L from on-chain history</p>
              </CardContent>
            </Card>
          )}

          {walletPnl && !pnlLoading && (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Total P&L", value: formatPnl(walletPnl.totalPnl), color: walletPnl.totalPnl >= 0 ? "text-green-400" : "text-red-400", icon: walletPnl.totalPnl >= 0 ? TrendingUp : TrendingDown },
                  { label: "Realized", value: formatPnl(walletPnl.totalRealized), color: walletPnl.totalRealized >= 0 ? "text-green-400" : "text-red-400", icon: Target },
                  { label: "Unrealized", value: formatPnl(walletPnl.totalUnrealized), color: walletPnl.totalUnrealized >= 0 ? "text-[hsl(var(--og-lime))]" : "text-orange-400", icon: PieChart },
                  { label: "Win Rate", value: `${walletPnl.winCount + walletPnl.lossCount > 0 ? Math.round(walletPnl.winCount / (walletPnl.winCount + walletPnl.lossCount) * 100) : 0}%`, color: "text-[#22d3ee]", icon: Trophy },
                ].map((s, i) => (
                  <Card key={i} className="og-glass-card">
                    <CardContent className="p-3.5">
                      <div className="flex items-center gap-2 mb-1">
                        <s.icon className={`h-3.5 w-3.5 ${s.color}`} />
                        <span className="text-[11px] text-white/40">{s.label}</span>
                      </div>
                      <p className={`text-base font-bold ${s.color}`}>{s.value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Win / loss tally */}
              <div className="grid grid-cols-2 gap-3">
                {walletPnl.biggestWin && (
                  <Card className="og-glass-card border-green-500/20">
                    <CardContent className="p-3.5 flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-green-500/10"><Trophy className="h-4 w-4 text-green-400" /></div>
                      <div>
                        <p className="text-[10px] text-white/35">Best Win</p>
                        <p className="font-bold text-sm text-green-400">{walletPnl.biggestWin.symbol}</p>
                        <p className="text-[10px] text-green-400/70">{formatPnl(walletPnl.biggestWin.pnl)}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
                {walletPnl.biggestLoss && (
                  <Card className="og-glass-card border-red-500/20">
                    <CardContent className="p-3.5 flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-red-500/10"><Skull className="h-4 w-4 text-red-400" /></div>
                      <div>
                        <p className="text-[10px] text-white/35">Biggest Loss</p>
                        <p className="font-bold text-sm text-red-400">{walletPnl.biggestLoss.symbol}</p>
                        <p className="text-[10px] text-red-400/70">{formatPnl(walletPnl.biggestLoss.pnl)}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Per-token PnL breakdown */}
              <Card className="og-glass-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Layers className="h-4 w-4 text-[hsl(var(--og-lime))]" />
                    Token P&L Breakdown
                    <Badge variant="outline" className="text-[10px] ml-auto">{walletPnl.tokens.length} tokens</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[480px]">
                    <div className="divide-y divide-white/[0.04]">
                      {walletPnl.tokens.map(t => (
                        <div key={t.mint} className="px-4 py-3 hover:bg-white/[0.02] transition-colors">
                          <div className="flex items-center gap-3">
                            {t.image ? (
                              <img src={t.image} className="w-9 h-9 rounded-xl object-cover shrink-0" alt="" onError={e => (e.target as HTMLImageElement).style.display = "none"} />
                            ) : (
                              <div className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center shrink-0 text-[10px] font-bold text-white/40">{t.symbol.slice(0, 2)}</div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold text-sm">{t.symbol}</p>
                                <Badge className={`text-[9px] px-1.5 h-4 ${t.totalPnl >= 0 ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"}`}>
                                  {t.roi.toFixed(0)}% ROI
                                </Badge>
                              </div>
                              <div className="flex items-center gap-3 mt-0.5">
                                <span className="text-[10px] text-white/30">Bought: {formatUsd(t.totalBought)}</span>
                                <span className="text-[10px] text-white/30">Sold: {formatUsd(t.totalSold)}</span>
                                <span className="text-[10px] text-white/30">Held: {formatUsd(t.currentValue)}</span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className={`font-mono font-bold text-sm ${t.totalPnl >= 0 ? "text-green-400" : "text-red-400"}`}>{formatPnl(t.totalPnl)}</p>
                              <p className="text-[10px] text-white/30">{t.trades.length} trades</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ══════════════════════════════════════════════════════
            VOLUME TAB
            ══════════════════════════════════════════════════════ */}
        <TabsContent value="volume" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base">Volume Analytics</h3>
              <p className="text-[11px] text-white/35">All your buys, sells and total activity</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => computePnL(address)} disabled={pnlLoading}
              className="h-8 gap-1.5 border-[hsl(var(--og-lime))/0.3] text-[hsl(var(--og-lime))] hover:bg-[hsl(var(--og-lime))/0.1]">
              <RefreshCw className={`h-3.5 w-3.5 ${pnlLoading ? "animate-spin" : ""}`} />
              {pnlLoading ? "Loading..." : "Load"}
            </Button>
          </div>

          {!walletPnl && !pnlLoading && (
            <Card className="og-glass-card">
              <CardContent className="p-12 text-center">
                <Volume2 className="h-12 w-12 text-white/15 mx-auto mb-4" />
                <p className="text-white/40 text-sm">Click "Load" to analyze your trading volume</p>
              </CardContent>
            </Card>
          )}

          {pnlLoading && <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-2xl bg-white/[0.04] animate-pulse" />)}</div>}

          {walletPnl && !pnlLoading && (
            <>
              {/* Volume summary */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Total Volume", value: fmtNum(walletPnl.totalVolume), icon: Activity, color: "text-[hsl(var(--og-lime))]" },
                  { label: "Buy Volume", value: fmtNum(walletPnl.totalBuyVolume), icon: ArrowDownLeft, color: "text-green-400" },
                  { label: "Sell Volume", value: fmtNum(walletPnl.totalSellVolume), icon: ArrowUpRight, color: "text-red-400" },
                ].map((s, i) => (
                  <Card key={i} className="og-glass-card">
                    <CardContent className="p-3.5">
                      <div className="flex items-center gap-2 mb-1">
                        <s.icon className={`h-3.5 w-3.5 ${s.color}`} />
                        <span className="text-[11px] text-white/40">{s.label}</span>
                      </div>
                      <p className={`text-base font-bold ${s.color}`}>{s.value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Buy/Sell ratio bar */}
              {walletPnl.totalVolume > 0 && (
                <Card className="og-glass-card">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-white/40">Buy / Sell Ratio</span>
                      <span className="text-xs text-white/40">{Math.round(walletPnl.totalBuyVolume / walletPnl.totalVolume * 100)}% buys</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-red-500/30 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-green-500 to-[hsl(var(--og-lime))] rounded-full"
                        style={{ width: `${Math.round(walletPnl.totalBuyVolume / walletPnl.totalVolume * 100)}%` }} />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[10px] text-green-400">Buys {fmtNum(walletPnl.totalBuyVolume)}</span>
                      <span className="text-[10px] text-red-400">Sells {fmtNum(walletPnl.totalSellVolume)}</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Per-token volume table */}
              <Card className="og-glass-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Flame className="h-4 w-4 text-orange-400" />
                    Most Traded Tokens
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[420px]">
                    <div className="divide-y divide-white/[0.04]">
                      {[...walletPnl.tokens]
                        .sort((a, b) => (b.totalBought + b.totalSold) - (a.totalBought + a.totalSold))
                        .map((t, idx) => {
                          const totalVol = t.totalBought + t.totalSold;
                          const pct = walletPnl.totalVolume > 0 ? (totalVol / walletPnl.totalVolume * 100) : 0;
                          return (
                            <div key={t.mint} className="px-4 py-3 hover:bg-white/[0.02] transition-colors">
                              <div className="flex items-center gap-3">
                                <span className="text-[11px] text-white/20 w-5 text-center">{idx + 1}</span>
                                {t.image ? (
                                  <img src={t.image} className="w-8 h-8 rounded-lg object-cover shrink-0" alt="" onError={e => (e.target as HTMLImageElement).style.display = "none"} />
                                ) : (
                                  <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0 text-[9px] font-bold text-white/40">{t.symbol.slice(0, 2)}</div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between mb-1">
                                    <p className="font-semibold text-sm">{t.symbol}</p>
                                    <p className="text-xs font-mono text-white/70">{fmtNum(totalVol)}</p>
                                  </div>
                                  <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-[hsl(var(--og-lime))/0.7] to-[hsl(var(--og-lime))] rounded-full"
                                      style={{ width: `${pct}%` }} />
                                  </div>
                                  <div className="flex gap-3 mt-1">
                                    <span className="text-[9px] text-green-400">B: {fmtNum(t.totalBought)}</span>
                                    <span className="text-[9px] text-red-400">S: {fmtNum(t.totalSold)}</span>
                                    <span className="text-[9px] text-white/25">{t.trades.length} trades</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ══ TRADE TAB ══ */}
        <TabsContent value="trade" className="mt-4">
          <Card className="og-glass-card max-w-md mx-auto">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowLeftRight className="h-4 w-4 text-[hsl(var(--og-lime))]" />Swap Tokens
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="og-glass-card rounded-xl p-3 space-y-2">
                  <p className="text-[11px] text-white/40 uppercase tracking-wide">You Pay</p>
                  <div className="flex items-center gap-2">
                    <Input type="number" placeholder="0.00" value={swapAmount} onChange={e => setSwapAmount(e.target.value)}
                      className="bg-transparent border-none text-2xl font-bold p-0 h-auto focus-visible:ring-0 text-white" />
                    <button className="flex items-center gap-2 bg-white/[0.08] border border-white/[0.1] rounded-xl px-3 py-2 hover:bg-white/[0.12] transition-colors shrink-0">
                      <span className="text-sm font-semibold">{swapMode === "buy" ? "SOL" : (swapToken?.symbol ?? "Token")}</span>
                      <ChevronDown className="h-3 w-3 text-white/50" />
                    </button>
                  </div>
                  {swapMode === "buy" && overview && <p className="text-[11px] text-white/30">Balance: {(overview.balance ?? 0).toFixed(4)} SOL</p>}
                  {swapMode === "sell" && swapToken && <p className="text-[11px] text-white/30">Balance: {swapToken.balance.toFixed(4)} {swapToken.symbol}</p>}
                </div>
                <div className="flex justify-center">
                  <button onClick={() => setSwapMode(m => m === "buy" ? "sell" : "buy")}
                    className="p-2 rounded-xl bg-white/[0.06] border border-white/[0.08] hover:bg-[hsl(var(--og-lime))/0.1] hover:border-[hsl(var(--og-lime))/0.3] transition-all">
                    <ArrowLeftRight className="h-4 w-4 text-white/50" />
                  </button>
                </div>
                <div className="og-glass-card rounded-xl p-3 space-y-2">
                  <p className="text-[11px] text-white/40 uppercase tracking-wide">You Receive</p>
                  <div className="flex items-center gap-2">
                    <div className="text-2xl font-bold text-white/60 flex-1">{swapQuote ? swapQuote.outAmount.toFixed(4) : "—"}</div>
                    <div className="flex items-center gap-2 bg-white/[0.08] border border-white/[0.1] rounded-xl px-3 py-2 shrink-0">
                      <span className="text-sm font-semibold">{swapMode === "buy" ? (swapToken?.symbol ?? "Token") : "SOL"}</span>
                    </div>
                  </div>
                  {swapQuote && (
                    <p className={`text-[11px] ${Math.abs(swapQuote.priceImpact) > 3 ? "text-red-400" : "text-white/30"}`}>
                      Price impact: {swapQuote.priceImpact.toFixed(2)}%{Math.abs(swapQuote.priceImpact) > 3 && " ⚠️ High"}
                    </p>
                  )}
                </div>
              </div>
              {swapMode === "buy" && (
                <div className="space-y-2">
                  <p className="text-[11px] text-white/40 uppercase tracking-wide">Select token to buy</p>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
                    <Input placeholder="Search your tokens..." value={tokenSearch} onChange={e => setTokenSearch(e.target.value)}
                      className="pl-8 bg-white/[0.04] border-white/[0.08] rounded-xl h-8 text-xs" />
                  </div>
                  <ScrollArea className="h-32">
                    <div className="space-y-1">
                      {sortedTokens.slice(0, 20).map(t => (
                        <button key={t.mint} onClick={() => setSwapToken(t)}
                          className={`flex items-center gap-2 w-full px-3 py-2 rounded-xl text-left hover:bg-white/[0.06] transition-colors ${swapToken?.mint === t.mint ? "bg-[hsl(var(--og-lime))/0.1] border border-[hsl(var(--og-lime))/0.3]" : ""}`}>
                          {t.image && <img src={t.image} className="w-5 h-5 rounded-md" alt="" />}
                          <span className="text-xs font-semibold">{t.symbol}</span>
                          <span className="text-[10px] text-white/30 truncate flex-1">{t.name}</span>
                          <span className="text-[10px] text-white/50">{formatUsd(t.value)}</span>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/40">Slippage</span>
                <div className="flex items-center gap-1">
                  {[50, 100, 300].map(s => (
                    <button key={s} onClick={() => setSlippage(s)}
                      className={`text-[11px] px-2 py-0.5 rounded-lg transition-colors ${slippage === s ? "bg-[hsl(var(--og-lime))] text-[hsl(var(--og-ink))] font-semibold" : "bg-white/[0.06] text-white/40 hover:bg-white/[0.1]"}`}>
                      {s / 100}%
                    </button>
                  ))}
                </div>
              </div>
              <Button
                className="w-full h-12 text-sm font-bold bg-gradient-to-r from-[hsl(var(--og-lime))] to-[#22d3ee] text-[hsl(var(--og-ink))] hover:opacity-90 rounded-2xl"
                disabled={!swapToken || !swapAmount || swapLoading || !swapQuote}
                onClick={executeSwap}>
                {swapLoading ? <><RefreshCw className="h-4 w-4 animate-spin mr-2" />Signing...</> : <><Zap className="h-4 w-4 mr-2" />{swapMode === "buy" ? `Buy ${swapToken?.symbol ?? "Token"}` : `Sell ${swapToken?.symbol ?? "Token"}`}</>}
              </Button>
              <p className="text-center text-[10px] text-white/25">Powered by Jupiter · Signed by your wallet</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══ HISTORY TAB ══ */}
        <TabsContent value="history" className="mt-4">
          <Card className="og-glass-card">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[hsl(var(--og-lime))]" />
                  Transaction History
                  {txsLoading
                    ? <Badge variant="outline" className="text-[10px] animate-pulse">Loading…</Badge>
                    : <Badge variant="outline" className="text-[10px]">{txs.length} txs</Badge>
                  }
                </CardTitle>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-white/40" onClick={() => loadData(address)}>
                  <RefreshCw className={`h-3 w-3 mr-1 ${txsLoading ? "animate-spin" : ""}`} />Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[560px]">
                {txs.length === 0 ? (
                  <div className="text-center py-16 text-white/30 text-sm">
                    <Clock className="h-8 w-8 mx-auto mb-3 text-white/20" />No transactions found
                  </div>
                ) : (
                  <div className="divide-y divide-white/[0.04]">
                    {txs.map(tx => {
                      const ts = tx.timestamp ? formatDistanceToNow(new Date(tx.timestamp * 1000), { addSuffix: true }) : "Unknown";
                      const label = getTxLabel(tx);
                      const mainMint = getTxTokenMint(tx);
                      const displayAmt = tx.displayAmount || "";
                      const usdStr = tx.usdValue && tx.usdValue > 0 ? `~${formatUsd(tx.usdValue)}` : "";
                      return (
                        <div key={tx.signature} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors">
                          <div className={`p-2 rounded-xl shrink-0 ${getTypeBg(tx)}`}>
                            {getTypeIcon(tx)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-semibold capitalize">{label}</span>
                              {/* Token name/symbol if available */}
                              {(tx.tokenName || tx.tokenSymbol) && (
                                <Badge variant="outline" className="text-[9px] px-1.5 h-4 font-semibold">
                                  {tx.tokenSymbol ?? tx.tokenName}
                                </Badge>
                              )}
                              {/* Mint address if no name */}
                              {!tx.tokenName && !tx.tokenSymbol && mainMint && mainMint !== SOL_MINT && (
                                <Badge variant="outline" className="text-[9px] px-1.5 h-4 font-mono">{mainMint.slice(0, 6)}…</Badge>
                              )}
                              {/* Source badge */}
                              {tx.source && tx.source !== "UNKNOWN" && (
                                <Badge variant="secondary" className="text-[9px] px-1 h-4 bg-white/[0.06] text-white/40">
                                  {tx.source}
                                </Badge>
                              )}
                            </div>
                            <p className="text-[11px] text-white/35 mt-0.5" title={tx.timestamp ? new Date(tx.timestamp * 1000).toLocaleString() : ""}>{ts}</p>
                            {!tx.isBuy && !tx.isSell && tx.description && (
                              <p className="text-[10px] text-white/25 truncate mt-0.5">{tx.description}</p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            {displayAmt && (
                              <p className={`font-mono text-sm font-semibold ${tx.isBuy || tx.isIncoming ? "text-green-400" : tx.isSell || tx.isOutgoing ? "text-red-400" : "text-white/70"}`}>
                                {displayAmt}
                              </p>
                            )}
                            {usdStr && <p className="text-[10px] text-white/30">{usdStr}</p>}
                            {tx.fee != null && <p className="text-[10px] text-white/20">{(tx.fee / 1e9).toFixed(5)} SOL fee</p>}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <a href={`https://solscan.io/tx/${tx.signature}`} target="_blank" rel="noopener noreferrer">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-white/25 hover:text-white">
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                            </a>
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
      </Tabs>

      {/* ══ SWAP DIALOG ══ */}
      <Dialog open={swapOpen} onOpenChange={setSwapOpen}>
        <DialogContent className="bg-[hsl(var(--background))] border border-white/[0.1] rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              {swapMode === "buy" ? <ArrowDownLeft className="h-4 w-4 text-green-400" /> : <ArrowUpRight className="h-4 w-4 text-red-400" />}
              {swapMode === "buy" ? "Buy" : "Sell"} {swapToken?.symbol ?? "Token"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            {swapToken && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                {swapToken.image && <img src={swapToken.image} className="w-10 h-10 rounded-xl object-cover" alt="" />}
                <div className="flex-1">
                  <p className="font-semibold">{swapToken.name}</p>
                  <p className="text-[11px] text-white/40">Balance: {swapToken.balance.toFixed(4)} {swapToken.symbol}</p>
                </div>
                <div className="text-right"><p className="font-mono text-sm">{formatUsd(swapToken.value)}</p></div>
              </div>
            )}
            <div className="space-y-1">
              <p className="text-xs text-white/40">{swapMode === "buy" ? "Amount in SOL" : `Amount in ${swapToken?.symbol ?? "tokens"}`}</p>
              <Input type="number" placeholder="0.00" value={swapAmount} onChange={e => setSwapAmount(e.target.value)}
                className="bg-white/[0.04] border-white/[0.1] rounded-xl text-lg font-bold h-12" autoFocus />
              <div className="flex gap-2 mt-1">
                {swapMode === "buy"
                  ? ["0.1", "0.5", "1", "All"].map(v => (
                    <button key={v} onClick={() => setSwapAmount(v === "All" ? (overview?.balance ?? 0).toFixed(4) : v)}
                      className="flex-1 text-[11px] py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] transition-colors text-white/60">{v === "All" ? "Max" : `${v} SOL`}</button>
                  ))
                  : ["25%", "50%", "75%", "100%"].map(v => (
                    <button key={v} onClick={() => setSwapAmount((swapToken!.balance * parseInt(v) / 100).toFixed(4))}
                      className="flex-1 text-[11px] py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] transition-colors text-white/60">{v}</button>
                  ))
                }
              </div>
            </div>
            {swapQuote && (
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-white/40">You receive</span>
                  <span className="font-semibold text-[hsl(var(--og-lime))]">{swapQuote.outAmount.toFixed(4)} {swapQuote.outSymbol}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-white/40">Platform fee (1%)</span>
                  <span className="text-white/60">{(swapQuote.platformFee ?? 0).toFixed(4)} {swapQuote.outSymbol}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-white/40">Network fee</span>
                  <span className="text-white/60">~0.00001 SOL</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-white/40">Price impact</span>
                  <span className={Math.abs(swapQuote.priceImpact) > 3 ? "text-red-400 font-semibold" : "text-white/60"}>
                    {swapQuote.priceImpact.toFixed(2)}%{Math.abs(swapQuote.priceImpact) > 3 && " ⚠️"}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-white/40">Slippage</span><span className="text-white/60">{slippage / 100}%</span>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/40">Max slippage</span>
              <div className="flex gap-1">
                {[50, 100, 300].map(s => (
                  <button key={s} onClick={() => setSlippage(s)}
                    className={`text-[11px] px-2.5 py-1 rounded-lg transition-colors ${slippage === s ? "bg-[hsl(var(--og-lime))] text-[hsl(var(--og-ink))] font-bold" : "bg-white/[0.06] text-white/40"}`}>
                    {s / 100}%
                  </button>
                ))}
              </div>
            </div>
            <Button
              className={`w-full h-12 font-bold text-sm rounded-2xl ${swapMode === "buy" ? "bg-gradient-to-r from-green-500 to-[hsl(var(--og-lime))] text-[hsl(var(--og-ink))]" : "bg-gradient-to-r from-red-500 to-orange-500 text-white"} hover:opacity-90`}
              disabled={!swapAmount || swapLoading || !swapQuote} onClick={executeSwap}>
              {swapLoading ? <><RefreshCw className="h-4 w-4 animate-spin mr-2" />Sending to wallet...</> : <><Zap className="h-4 w-4 mr-2" />{swapMode === "buy" ? `Buy ${swapToken?.symbol}` : `Sell ${swapToken?.symbol}`}</>}
            </Button>
            <p className="text-center text-[10px] text-white/20">Powered by Jupiter · Signed by your wallet extension</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
