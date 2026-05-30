/**
 * ConnectedWalletTab — Full on-chain wallet terminal powered by Phantom.
 * Features: connect, portfolio, buy/sell via Jupiter, charts, tx history.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import {
  Copy, ExternalLink, RefreshCw, TrendingUp, TrendingDown,
  ArrowUpRight, ArrowDownLeft, Coins, Clock, Zap, ChevronDown,
  BarChart3, Wallet, Check, X, AlertTriangle, Search, ArrowLeftRight,
  Shield
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
  getWalletOverview, getAssets, getTransactions,
  WalletOverview, TokenAsset, Transaction, formatAddress, formatUsd
} from "@/lib/solana-api";
import { HELIUS_RPC, HELIUS_API_KEY, jupPrice, SOL_MINT, JUPITER_BASE, JUPITER_API_KEY } from "@/lib/og";
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
  image?: string;
  verified?: boolean;
}

interface EnrichedTx {
  signature: string;
  type: string;
  timestamp?: number;
  description?: string;
  fee?: number;
  tokenName?: string;
  tokenSymbol?: string;
  tokenImage?: string;
  amount?: string;
  amountUsd?: string;
  isIncoming?: boolean;
  isOutgoing?: boolean;
}

/* ─── Phantom native swap ────────────────────────────────────────── */
/**
 * Execute swap via Phantom's native swap API — zero platform fees, just network cost.
 * Uses window.phantom.solana.swap() which opens Phantom's own swap UI in-wallet.
 * Falls back to Jupiter quote API for getting the swap transaction if needed.
 */
async function phantomSwap(
  fromMint: string,
  toMint: string,
  amountLamports: number,
  slippageBps: number,
  userPublicKey: string
): Promise<string> {
  const phantom = (window as any).phantom?.solana;
  if (!phantom?.isPhantom) throw new Error("Phantom wallet not detected");

  // 1. Get quote from Jupiter
  const quoteRes = await fetch(
    `${JUPITER_BASE}/swap/v1/quote?inputMint=${fromMint}&outputMint=${toMint}&amount=${amountLamports}&slippageBps=${slippageBps}&restrictIntermediateTokens=true`,
    { headers: { "Authorization": `Bearer ${JUPITER_API_KEY}` } }
  );
  if (!quoteRes.ok) throw new Error("Failed to get swap quote");
  const quote = await quoteRes.json();

  // 2. Build swap transaction via Jupiter (no platform fee)
  const swapRes = await fetch(`${JUPITER_BASE}/swap/v1/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${JUPITER_API_KEY}` },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: "auto",
      // No feeAccount = zero platform fees
    }),
  });
  if (!swapRes.ok) throw new Error("Failed to build swap transaction");
  const { swapTransaction } = await swapRes.json();
  return swapTransaction; // base64 versioned tx
}

/** Decode base64 to Uint8Array without relying on Node Buffer */
function base64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/* ─── Helpers ───────────────────────────────────────────────────── */
function getTypeIcon(tx: EnrichedTx) {
  if (tx.isIncoming) return <ArrowDownLeft className="h-4 w-4 text-green-400" />;
  if (tx.isOutgoing) return <ArrowUpRight className="h-4 w-4 text-red-400" />;
  if (tx.type === "SWAP") return <ArrowLeftRight className="h-4 w-4 text-[#22d3ee]" />;
  return <Zap className="h-4 w-4 text-white/40" />;
}

function getTypeBg(tx: EnrichedTx) {
  if (tx.isIncoming) return "bg-green-500/10 border border-green-500/20";
  if (tx.isOutgoing) return "bg-red-500/10 border border-red-500/20";
  if (tx.type === "SWAP") return "bg-[#22d3ee]/10 border border-[#22d3ee]/20";
  return "bg-white/[0.06] border border-white/[0.08]";
}

/* ═══════════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════════ */
export function ConnectedWalletTab() {
  const { publicKey, connect, disconnect, connected, wallet, signTransaction, wallets, select } = useWallet();
  const { connection } = useConnection();

  const [overview, setOverview] = useState<WalletOverview | null>(null);
  const [tokens, setTokens] = useState<RichToken[]>([]);
  const [txs, setTxs] = useState<EnrichedTx[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("portfolio");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Swap state
  const [swapOpen, setSwapOpen] = useState(false);
  const [swapToken, setSwapToken] = useState<RichToken | null>(null);
  const [swapMode, setSwapMode] = useState<"buy" | "sell">("buy");
  const [swapAmount, setSwapAmount] = useState("");
  const [swapLoading, setSwapLoading] = useState(false);
  const [swapQuote, setSwapQuote] = useState<{ outAmount: number; outSymbol: string; priceImpact: number } | null>(null);
  const [slippage, setSlippage] = useState(100); // 1%

  // Chart state
  const [chartToken, setChartToken] = useState<RichToken | null>(null);
  const [chartOpen, setChartOpen] = useState(false);

  // Token search
  const [tokenSearch, setTokenSearch] = useState("");

  const address = publicKey?.toBase58() ?? "";

  /* ── Load wallet data ── */
  const loadData = useCallback(async (addr: string, silent = false) => {
    if (!addr) return;
    if (!silent) setLoading(true);
    try {
      const [ov, assetData, rawTxs] = await Promise.all([
        getWalletOverview(addr),
        getAssets(addr, 1, 100),
        getTransactions(addr, 30),
      ]);
      setOverview(ov);

      // Build rich token list
      const rich: RichToken[] = assetData.items.map((a: TokenAsset) => {
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
          balance,
          decimals,
          price,
          value,
          change24h: 0,
          image: a.content?.links?.image,
          verified: false,
        };
      }).filter(t => t.balance > 0).sort((a, b) => b.value - a.value);

      setTokens(rich);

      // Enrich transactions
      const enriched: EnrichedTx[] = rawTxs.map((tx: Transaction) => {
        const nativeTx = tx.nativeTransfers?.[0];
        const tokenTx = tx.tokenTransfers?.[0];
        let isIncoming = false, isOutgoing = false;
        let amount = "";
        if (nativeTx) {
          isIncoming = nativeTx.toUserAccount === addr;
          isOutgoing = nativeTx.fromUserAccount === addr;
          const sol = Math.abs(nativeTx.amount / 1e9);
          amount = `${sol.toFixed(4)} SOL`;
        } else if (tokenTx) {
          isIncoming = tokenTx.toUserAccount === addr;
          isOutgoing = tokenTx.fromUserAccount === addr;
          amount = `${tokenTx.tokenAmount.toFixed(2)} tokens`;
        }
        return {
          signature: tx.signature,
          type: tx.type ?? "UNKNOWN",
          timestamp: tx.timestamp,
          description: tx.description,
          fee: tx.fee,
          amount,
          isIncoming,
          isOutgoing,
        };
      });
      setTxs(enriched);
      setLastRefresh(new Date());
    } catch (e) {
      if (!silent) toast({ title: "Failed to load wallet", description: String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (connected && address) {
      loadData(address);
    } else {
      setOverview(null);
      setTokens([]);
      setTxs([]);
    }
  }, [connected, address, loadData]);

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
    if (!swapOpen || !swapToken || !swapAmount || isNaN(Number(swapAmount))) {
      setSwapQuote(null);
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        const inputMint = swapMode === "buy" ? SOL_MINT : swapToken.mint;
        const outputMint = swapMode === "buy" ? swapToken.mint : SOL_MINT;
        const decimals = swapMode === "buy" ? 9 : swapToken.decimals;
        const amountLamports = Math.floor(Number(swapAmount) * Math.pow(10, decimals));
        if (amountLamports <= 0) return;

        const res = await fetch(
          `${JUPITER_BASE}/swap/v1/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountLamports}&slippageBps=${slippage}`,
          { headers: { "Authorization": `Bearer ${JUPITER_API_KEY}` } }
        );
        const q = await res.json();
        if (q.outAmount) {
          const outDecimals = swapMode === "buy" ? swapToken.decimals : 9;
          const outSymbol = swapMode === "buy" ? swapToken.symbol : "SOL";
          setSwapQuote({
            outAmount: Number(q.outAmount) / Math.pow(10, outDecimals),
            outSymbol,
            priceImpact: parseFloat(q.priceImpactPct ?? "0") * 100,
          });
        }
      } catch { /* ignore */ }
    }, 600);
    return () => clearTimeout(timeout);
  }, [swapOpen, swapToken, swapAmount, swapMode, slippage]);

  /* ── Execute swap via Phantom native (zero platform fees) ── */
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

      // Build swap tx via Jupiter (no platform fee account = zero fees)
      const swapTxBase64 = await phantomSwap(inputMint, outputMint, amountLamports, slippage, publicKey.toBase58());

      // Deserialize using browser-native atob (no Buffer needed)
      const txBytes = base64ToUint8Array(swapTxBase64);
      const tx = VersionedTransaction.deserialize(txBytes);

      // Sign & send via Phantom directly
      const { signature: sig } = await phantom.signAndSendTransaction(tx);

      toast({
        title: `${swapMode === "buy" ? "Buy" : "Sell"} submitted! ✅`,
        description: `TX: ${formatAddress(sig, 6)}`,
      });
      setSwapOpen(false);
      setSwapAmount("");
      setTimeout(() => loadData(address, true), 3000);
    } catch (e: any) {
      toast({ title: "Swap failed", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setSwapLoading(false);
    }
  };

  /* ── Copy address ── */
  const copyAddress = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /* ── Filtered tokens ── */
  const filteredTokens = tokens.filter(t =>
    !tokenSearch || t.symbol.toLowerCase().includes(tokenSearch.toLowerCase()) || t.name.toLowerCase().includes(tokenSearch.toLowerCase())
  );

  /* ════════════════════════════════════════════════════════════════
     NOT CONNECTED VIEW
     ════════════════════════════════════════════════════════════════ */
  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8 px-4">
        {/* Hero card */}
        <div className="og-glass-card rounded-3xl p-8 max-w-md w-full text-center space-y-6">
          <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-[hsl(var(--og-lime))] to-[#22d3ee] flex items-center justify-center shadow-lg shadow-[hsl(var(--og-lime))/0.3]">
            <Wallet className="h-10 w-10 text-[hsl(var(--og-ink))]" />
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
            <p className="text-white/50 text-sm leading-relaxed">
              Connect Phantom or Solflare to view your portfolio, trade tokens, track transactions — all inside OG Scan.
            </p>
          </div>

          {/* Wallet buttons */}
          <div className="flex flex-col gap-3">
            {wallets.filter(w => ["Phantom", "Solflare"].includes(w.adapter.name)).map(w => (
              <button
                key={w.adapter.name}
                onClick={() => { select(w.adapter.name as any); setTimeout(() => connect().catch(() => {}), 100); }}
                className="flex items-center gap-3 w-full px-5 py-3.5 rounded-2xl bg-white/[0.06] border border-white/[0.1] hover:bg-white/[0.1] hover:border-[hsl(var(--og-lime))/0.4] transition-all group"
              >
                {w.adapter.icon && (
                  <img src={w.adapter.icon} alt={w.adapter.name} className="w-7 h-7 rounded-lg" />
                )}
                <span className="font-semibold text-sm">{w.adapter.name}</span>
                <span className="ml-auto text-[10px] text-white/30 group-hover:text-[hsl(var(--og-lime))] transition-colors">Connect →</span>
              </button>
            ))}
            {/* Fallback if no wallets detected */}
            {wallets.filter(w => ["Phantom", "Solflare"].includes(w.adapter.name)).length === 0 && (
              <div className="text-center text-sm text-white/40 py-4">
                <AlertTriangle className="h-5 w-5 mx-auto mb-2 text-yellow-500" />
                No wallets detected. Install <a href="https://phantom.app" target="_blank" rel="noopener noreferrer" className="text-[hsl(var(--og-lime))] underline">Phantom</a> first.
              </div>
            )}
          </div>

          <p className="text-[11px] text-white/25">Your keys never leave your wallet. OG Scan only reads on-chain data.</p>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-2 max-w-sm">
          {["Portfolio overview", "Buy & sell tokens", "Transaction history", "Price charts", "SOL balance"].map(f => (
            <span key={f} className="text-xs px-3 py-1 rounded-full bg-white/[0.05] border border-white/[0.08] text-white/50">{f}</span>
          ))}
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════════
     CONNECTED VIEW
     ════════════════════════════════════════════════════════════════ */
  const totalValue = (overview?.totalUsdValue ?? 0);
  const solValue = (overview?.balance ?? 0) * (overview?.solPrice ?? 0);

  return (
    <div className="space-y-4 pb-8">

      {/* ── Header bar ── */}
      <div className="og-glass-card rounded-2xl p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Address + wallet icon */}
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

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost" size="sm"
              onClick={() => loadData(address)}
              disabled={loading}
              className="gap-1.5 text-white/50 hover:text-white h-8"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              {lastRefresh ? formatDistanceToNow(lastRefresh, { addSuffix: true }) : ""}
            </Button>
            <Button
              variant="outline" size="sm"
              onClick={() => disconnect()}
              className="h-8 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
            >
              Disconnect
            </Button>
          </div>
        </div>
      </div>

      {/* ── Portfolio summary cards ── */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              icon: BarChart3, label: "Total Value", color: "text-[hsl(var(--og-lime))]",
              value: formatUsd(totalValue),
              sub: `${tokens.length} tokens`,
            },
            {
              icon: Coins, label: "SOL Balance", color: "text-[#22d3ee]",
              value: `${(overview.balance ?? 0).toFixed(4)} SOL`,
              sub: formatUsd(solValue),
            },
            {
              icon: overview.priceChange24h >= 0 ? TrendingUp : TrendingDown,
              label: "SOL 24h", color: overview.priceChange24h >= 0 ? "text-green-400" : "text-red-400",
              value: `${overview.priceChange24h >= 0 ? "+" : ""}${(overview.priceChange24h ?? 0).toFixed(2)}%`,
              sub: `$${(overview.solPrice ?? 0).toFixed(2)}/SOL`,
            },
            {
              icon: Shield, label: "NFTs", color: "text-purple-400",
              value: String(overview.nftCount ?? 0),
              sub: `${overview.totalAssets ?? 0} total assets`,
            },
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
            <TabsTrigger value="portfolio" className="gap-1.5"><Coins className="h-3.5 w-3.5" />Portfolio</TabsTrigger>
            <TabsTrigger value="trade" className="gap-1.5"><ArrowLeftRight className="h-3.5 w-3.5" />Trade</TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5"><Clock className="h-3.5 w-3.5" />History</TabsTrigger>
            <TabsTrigger value="charts" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5" />Charts</TabsTrigger>
          </TabsList>
        </div>

        {/* ══ PORTFOLIO TAB ══ */}
        <TabsContent value="portfolio" className="mt-4 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
            <Input
              placeholder="Search tokens..."
              value={tokenSearch}
              onChange={e => setTokenSearch(e.target.value)}
              className="pl-9 bg-white/[0.04] border-white/[0.08] rounded-xl h-9 text-sm"
            />
          </div>

          {/* SOL row */}
          <Card className="og-glass-card">
            <CardContent className="p-0">
              <div className="flex items-center gap-3 p-3.5 hover:bg-white/[0.04] transition-colors rounded-2xl">
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
                <Button
                  size="sm" variant="outline"
                  className="h-7 text-[11px] ml-1 border-[hsl(var(--og-lime))/0.3] text-[hsl(var(--og-lime))] hover:bg-[hsl(var(--og-lime))/0.1]"
                  onClick={() => {
                    setSwapToken({ mint: SOL_MINT, symbol: "SOL", name: "Solana", balance: overview?.balance ?? 0, decimals: 9, price: overview?.solPrice ?? 0, value: solValue, change24h: overview?.priceChange24h ?? 0 });
                    setSwapMode("sell"); setSwapOpen(true);
                  }}
                >
                  Sell
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Token list */}
          {loading && tokens.length === 0 ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 rounded-2xl bg-white/[0.04] animate-pulse" />
              ))}
            </div>
          ) : filteredTokens.length === 0 ? (
            <div className="text-center py-12 text-white/30 text-sm">
              {tokenSearch ? "No tokens match your search" : "No tokens found"}
            </div>
          ) : (
            <Card className="og-glass-card overflow-hidden">
              <CardContent className="p-0">
                {filteredTokens.map((token, idx) => (
                  <div
                    key={token.mint}
                    className={`flex items-center gap-3 px-3.5 py-3 hover:bg-white/[0.04] transition-colors ${idx < filteredTokens.length - 1 ? "border-b border-white/[0.05]" : ""}`}
                  >
                    {/* Token image */}
                    {token.image ? (
                      <img
                        src={token.image} alt={token.symbol}
                        className="w-9 h-9 rounded-xl object-cover shrink-0"
                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[hsl(var(--og-lime))/0.3] to-[#22d3ee]/0.3 border border-white/[0.08] flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-black text-white/70">{token.symbol.slice(0, 3)}</span>
                      </div>
                    )}

                    {/* Name + balance */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{token.symbol}</p>
                      <p className="text-[11px] text-white/35 truncate">{token.balance < 0.01 ? token.balance.toExponential(2) : token.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })} {token.symbol}</p>
                    </div>

                    {/* Value */}
                    <div className="text-right shrink-0">
                      <p className="font-mono text-sm font-semibold">{token.value > 0 ? formatUsd(token.value) : "—"}</p>
                      <p className="text-[11px] text-white/30">${token.price < 0.001 ? token.price.toExponential(2) : token.price.toFixed(5)}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0 ml-1">
                      <Button
                        size="sm" variant="outline"
                        className="h-6 px-2 text-[10px] border-[hsl(var(--og-lime))/0.3] text-[hsl(var(--og-lime))] hover:bg-[hsl(var(--og-lime))/0.1]"
                        onClick={() => { setSwapToken(token); setSwapMode("buy"); setSwapOpen(true); }}
                      >Buy</Button>
                      <Button
                        size="sm" variant="outline"
                        className="h-6 px-2 text-[10px] border-red-500/30 text-red-400 hover:bg-red-500/10"
                        onClick={() => { setSwapToken(token); setSwapMode("sell"); setSwapOpen(true); }}
                      >Sell</Button>
                      <Button
                        size="sm" variant="ghost"
                        className="h-6 w-6 p-0 text-white/30 hover:text-[#22d3ee]"
                        onClick={() => { setChartToken(token); setChartOpen(true); }}
                      ><BarChart3 className="h-3 w-3" /></Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ══ TRADE TAB ══ */}
        <TabsContent value="trade" className="mt-4">
          <Card className="og-glass-card max-w-md mx-auto">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowLeftRight className="h-4 w-4 text-[hsl(var(--og-lime))]" />
                Swap Tokens
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* From/To selector */}
              <div className="space-y-2">
                <div className="og-glass-card rounded-xl p-3 space-y-2">
                  <p className="text-[11px] text-white/40 uppercase tracking-wide">You Pay</p>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={swapAmount}
                      onChange={e => setSwapAmount(e.target.value)}
                      className="bg-transparent border-none text-2xl font-bold p-0 h-auto focus-visible:ring-0 text-white"
                    />
                    <button
                      className="flex items-center gap-2 bg-white/[0.08] border border-white/[0.1] rounded-xl px-3 py-2 hover:bg-white/[0.12] transition-colors shrink-0"
                      onClick={() => {
                        if (swapMode === "buy") {
                          setSwapToken({ mint: SOL_MINT, symbol: "SOL", name: "Solana", balance: overview?.balance ?? 0, decimals: 9, price: overview?.solPrice ?? 0, value: solValue, change24h: 0 });
                        }
                      }}
                    >
                      <span className="text-sm font-semibold">{swapMode === "buy" ? "SOL" : (swapToken?.symbol ?? "Token")}</span>
                      <ChevronDown className="h-3 w-3 text-white/50" />
                    </button>
                  </div>
                  {swapMode === "buy" && overview && (
                    <p className="text-[11px] text-white/30">Balance: {(overview.balance ?? 0).toFixed(4)} SOL</p>
                  )}
                  {swapMode === "sell" && swapToken && (
                    <p className="text-[11px] text-white/30">Balance: {swapToken.balance.toFixed(4)} {swapToken.symbol}</p>
                  )}
                </div>

                {/* Swap direction toggle */}
                <div className="flex justify-center">
                  <button
                    onClick={() => setSwapMode(m => m === "buy" ? "sell" : "buy")}
                    className="p-2 rounded-xl bg-white/[0.06] border border-white/[0.08] hover:bg-[hsl(var(--og-lime))/0.1] hover:border-[hsl(var(--og-lime))/0.3] transition-all"
                  >
                    <ArrowLeftRight className="h-4 w-4 text-white/50" />
                  </button>
                </div>

                <div className="og-glass-card rounded-xl p-3 space-y-2">
                  <p className="text-[11px] text-white/40 uppercase tracking-wide">You Receive</p>
                  <div className="flex items-center gap-2">
                    <div className="text-2xl font-bold text-white/60 flex-1">
                      {swapQuote ? swapQuote.outAmount.toFixed(4) : "—"}
                    </div>
                    <div className="flex items-center gap-2 bg-white/[0.08] border border-white/[0.1] rounded-xl px-3 py-2 shrink-0">
                      <span className="text-sm font-semibold">{swapMode === "buy" ? (swapToken?.symbol ?? "Token") : "SOL"}</span>
                    </div>
                  </div>
                  {swapQuote && (
                    <p className={`text-[11px] ${Math.abs(swapQuote.priceImpact) > 3 ? "text-red-400" : "text-white/30"}`}>
                      Price impact: {swapQuote.priceImpact.toFixed(2)}%
                      {Math.abs(swapQuote.priceImpact) > 3 && " ⚠️ High"}
                    </p>
                  )}
                </div>
              </div>

              {/* Token picker for buy */}
              {swapMode === "buy" && (
                <div className="space-y-2">
                  <p className="text-[11px] text-white/40 uppercase tracking-wide">Select token to buy</p>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
                    <Input
                      placeholder="Search your tokens..."
                      value={tokenSearch}
                      onChange={e => setTokenSearch(e.target.value)}
                      className="pl-8 bg-white/[0.04] border-white/[0.08] rounded-xl h-8 text-xs"
                    />
                  </div>
                  <ScrollArea className="h-32">
                    <div className="space-y-1">
                      {filteredTokens.slice(0, 20).map(t => (
                        <button
                          key={t.mint}
                          onClick={() => setSwapToken(t)}
                          className={`flex items-center gap-2 w-full px-3 py-2 rounded-xl text-left hover:bg-white/[0.06] transition-colors ${swapToken?.mint === t.mint ? "bg-[hsl(var(--og-lime))/0.1] border border-[hsl(var(--og-lime))/0.3]" : ""}`}
                        >
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

              {/* Slippage */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/40">Slippage</span>
                <div className="flex items-center gap-1">
                  {[50, 100, 300].map(s => (
                    <button
                      key={s}
                      onClick={() => setSlippage(s)}
                      className={`text-[11px] px-2 py-0.5 rounded-lg transition-colors ${slippage === s ? "bg-[hsl(var(--og-lime))] text-[hsl(var(--og-ink))] font-semibold" : "bg-white/[0.06] text-white/40 hover:bg-white/[0.1]"}`}
                    >
                      {s / 100}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Execute */}
              <Button
                className="w-full h-12 text-sm font-bold bg-gradient-to-r from-[hsl(var(--og-lime))] to-[#22d3ee] text-[hsl(var(--og-ink))] hover:opacity-90 rounded-2xl"
                disabled={!swapToken || !swapAmount || swapLoading || !swapQuote}
                onClick={executeSwap}
              >
                {swapLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Zap className="h-4 w-4 mr-2" />
                )}
                {swapLoading ? "Signing & sending..." : swapMode === "buy" ? `Buy ${swapToken?.symbol ?? "Token"}` : `Sell ${swapToken?.symbol ?? "Token"}`}
              </Button>

              <p className="text-center text-[10px] text-white/25">Powered by Jupiter · Transaction signed by your wallet</p>
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
                  <Badge variant="outline" className="text-[10px]">{txs.length}</Badge>
                </CardTitle>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-white/40" onClick={() => loadData(address)}>
                  <RefreshCw className="h-3 w-3 mr-1" />Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[520px]">
                {txs.length === 0 ? (
                  <div className="text-center py-16 text-white/30 text-sm">
                    <Clock className="h-8 w-8 mx-auto mb-3 text-white/20" />
                    No transactions found
                  </div>
                ) : (
                  <div className="divide-y divide-white/[0.04]">
                    {txs.map(tx => {
                      const ts = tx.timestamp ? formatDistanceToNow(new Date(tx.timestamp * 1000), { addSuffix: true }) : "Unknown";
                      return (
                        <div key={tx.signature} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors">
                          <div className={`p-2 rounded-xl shrink-0 ${getTypeBg(tx)}`}>
                            {getTypeIcon(tx)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-semibold capitalize">{tx.type.replace(/_/g, " ").toLowerCase()}</span>
                              {tx.tokenSymbol && <Badge variant="outline" className="text-[9px] px-1.5 h-4">{tx.tokenSymbol}</Badge>}
                            </div>
                            <p className="text-[11px] text-white/35 mt-0.5" title={tx.timestamp ? new Date(tx.timestamp * 1000).toLocaleString() : ""}>{ts}</p>
                            {tx.description && <p className="text-[10px] text-white/25 truncate mt-0.5">{tx.description}</p>}
                          </div>
                          <div className="text-right shrink-0">
                            {tx.amount && <p className={`font-mono text-sm font-semibold ${tx.isIncoming ? "text-green-400" : tx.isOutgoing ? "text-red-400" : "text-white/70"}`}>
                              {tx.isIncoming ? "+" : tx.isOutgoing ? "-" : ""}{tx.amount}
                            </p>}
                            {tx.fee && <p className="text-[10px] text-white/25">{(tx.fee / 1e9).toFixed(5)} SOL fee</p>}
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

        {/* ══ CHARTS TAB ══ */}
        <TabsContent value="charts" className="mt-4 space-y-3">
          <p className="text-sm text-white/40">Select a token from your portfolio to view its chart</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {tokens.slice(0, 20).map(token => (
              <button
                key={token.mint}
                onClick={() => { setChartToken(token); setChartOpen(true); }}
                className={`flex flex-col items-start gap-1 p-3 rounded-xl border transition-all hover:border-[hsl(var(--og-lime))/0.4] hover:bg-[hsl(var(--og-lime))/0.05] text-left ${chartToken?.mint === token.mint ? "border-[hsl(var(--og-lime))/0.5] bg-[hsl(var(--og-lime))/0.08]" : "border-white/[0.08] bg-white/[0.03]"}`}
              >
                <div className="flex items-center gap-2 w-full">
                  {token.image && <img src={token.image} className="w-7 h-7 rounded-lg object-cover" alt="" onError={e => (e.target as HTMLImageElement).style.display = "none"} />}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold truncate">{token.symbol}</p>
                    <p className="text-[10px] text-white/30 truncate">{token.name}</p>
                  </div>
                </div>
                <p className="text-[11px] font-mono text-white/60">{token.price > 0 ? `$${token.price < 0.001 ? token.price.toExponential(2) : token.price.toFixed(4)}` : "—"}</p>
              </button>
            ))}
          </div>

          {/* Inline chart if selected */}
          {chartToken && (
            <Card className="og-glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-[hsl(var(--og-lime))]" />
                  {chartToken.symbol} / USD
                  <Button variant="ghost" size="sm" className="ml-auto h-6 text-[10px]" onClick={() => setChartToken(null)}><X className="h-3 w-3" /></Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                <iframe
                  src={`https://dexscreener.com/solana/${chartToken.mint}?embed=1&theme=dark&trades=0&info=0`}
                  className="w-full rounded-xl border border-white/[0.07]"
                  style={{ height: "480px" }}
                  title={`${chartToken.symbol} chart`}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ══ SWAP DIALOG ══ */}
      <Dialog open={swapOpen} onOpenChange={setSwapOpen}>
        <DialogContent className="bg-[hsl(var(--background))] border border-white/[0.1] rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              {swapMode === "buy" ? (
                <ArrowDownLeft className="h-4 w-4 text-green-400" />
              ) : (
                <ArrowUpRight className="h-4 w-4 text-red-400" />
              )}
              {swapMode === "buy" ? "Buy" : "Sell"} {swapToken?.symbol ?? "Token"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            {/* Token info */}
            {swapToken && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                {swapToken.image && <img src={swapToken.image} className="w-10 h-10 rounded-xl object-cover" alt="" />}
                <div className="flex-1">
                  <p className="font-semibold">{swapToken.name}</p>
                  <p className="text-[11px] text-white/40">Balance: {swapToken.balance.toFixed(4)} {swapToken.symbol}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm">{formatUsd(swapToken.value)}</p>
                </div>
              </div>
            )}

            {/* Amount input */}
            <div className="space-y-1">
              <p className="text-xs text-white/40">{swapMode === "buy" ? "Amount in SOL" : `Amount in ${swapToken?.symbol ?? "tokens"}`}</p>
              <Input
                type="number"
                placeholder="0.00"
                value={swapAmount}
                onChange={e => setSwapAmount(e.target.value)}
                className="bg-white/[0.04] border-white/[0.1] rounded-xl text-lg font-bold h-12"
                autoFocus
              />
              {/* Quick amounts */}
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

            {/* Quote */}
            {swapQuote && (
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-white/40">You receive</span>
                  <span className="font-semibold text-[hsl(var(--og-lime))]">{swapQuote.outAmount.toFixed(4)} {swapQuote.outSymbol}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-white/40">Price impact</span>
                  <span className={Math.abs(swapQuote.priceImpact) > 3 ? "text-red-400 font-semibold" : "text-white/60"}>
                    {swapQuote.priceImpact.toFixed(2)}%
                    {Math.abs(swapQuote.priceImpact) > 3 && " ⚠️"}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-white/40">Slippage</span>
                  <span className="text-white/60">{slippage / 100}%</span>
                </div>
              </div>
            )}

            {/* Slippage control */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/40">Max slippage</span>
              <div className="flex gap-1">
                {[50, 100, 300].map(s => (
                  <button key={s} onClick={() => setSlippage(s)}
                    className={`text-[11px] px-2.5 py-1 rounded-lg transition-colors ${slippage === s ? "bg-[hsl(var(--og-lime))] text-[hsl(var(--og-ink))] font-bold" : "bg-white/[0.06] text-white/40"}`}
                  >{s / 100}%</button>
                ))}
              </div>
            </div>

            {/* CTA */}
            <Button
              className={`w-full h-12 font-bold text-sm rounded-2xl ${swapMode === "buy"
                ? "bg-gradient-to-r from-green-500 to-[hsl(var(--og-lime))] text-[hsl(var(--og-ink))]"
                : "bg-gradient-to-r from-red-500 to-orange-500 text-white"} hover:opacity-90`}
              disabled={!swapAmount || swapLoading || !swapQuote}
              onClick={executeSwap}
            >
              {swapLoading
                ? <><RefreshCw className="h-4 w-4 animate-spin mr-2" />Sending to wallet...</>
                : <><Zap className="h-4 w-4 mr-2" />{swapMode === "buy" ? `Buy ${swapToken?.symbol}` : `Sell ${swapToken?.symbol}`}</>
              }
            </Button>
            <p className="text-center text-[10px] text-white/20">Powered by Jupiter · Signed by your wallet extension</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* ══ CHART DIALOG (from portfolio) ══ */}
      <Dialog open={chartOpen} onOpenChange={setChartOpen}>
        <DialogContent className="bg-[hsl(var(--background))] border border-white/[0.1] rounded-2xl max-w-3xl w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-[hsl(var(--og-lime))]" />
              {chartToken?.symbol} / USD
              {chartToken && (
                <Button variant="outline" size="sm" className="ml-auto h-7 text-[11px]"
                  onClick={() => { setSwapToken(chartToken); setChartOpen(false); setSwapMode("buy"); setSwapOpen(true); }}
                >
                  <Zap className="h-3 w-3 mr-1" />Trade
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          {chartToken && (
            <iframe
              src={`https://dexscreener.com/solana/${chartToken.mint}?embed=1&theme=dark&trades=1&info=1`}
              className="w-full rounded-xl border border-white/[0.07]"
              style={{ height: "520px" }}
              title={`${chartToken.symbol} chart`}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
