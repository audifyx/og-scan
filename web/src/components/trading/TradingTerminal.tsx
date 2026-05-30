/**
 * TradingTerminal — Phantom-style 3-panel trading terminal for OG Scan.
 *
 * Layout:
 *   Left   (280 px)  Token list with search + trending/positions tabs
 *   Center (flex-1)  Token header → Chart → Trades / My Trades / Positions / Top Traders
 *   Right  (320 px)  5m stats → Buy/Sell swap → Token Info
 *
 * All data is fetched natively — no embeds. Chart uses lightweight-charts.
 * Chart + Trades use GeckoTerminal (CORS-friendly) with DexScreener pool address.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";
import {
  Search, Copy, ExternalLink, RefreshCw,
  ArrowUpRight, ArrowDownLeft, ChevronDown, Check,
  Wallet, Activity, Star, X, Loader2, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import {
  jupSearchToken,
  JUPITER_BASE,
  JUPITER_API_KEY,
  HELIUS_RPC,
  SOL_MINT,
  shortAddr,
  type JupTokenInfo,
} from "@/lib/og";
import {
  getAssets,
  type TokenAsset,
} from "@/lib/solana-api";
import { CandlestickChart, type CandleDataPoint } from "./CandlestickChart";

/* ═══════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════ */

interface TokenListItem {
  mint: string;
  symbol: string;
  name: string;
  image?: string;
  price: number;
  mcap: number;
  change24h: number;
  volume24h: number;
  liquidity: number;
  pairAddress?: string;
  // 5-min stats
  volume5m: number;
  buys5m: number;
  sells5m: number;
  buyVol5m: number;
  sellVol5m: number;
}

interface TradeEntry {
  txHash: string;
  time: number;
  side: "buy" | "sell";
  priceUsd: number;
  amount: number;
  symbol: string;
  value: number;
  wallet: string;
}

interface TokenSecurity {
  top10HoldersPercent: number | null;
  devHoldersPercent: number | null;
  lpBurned: string;
  mintable: boolean | null;
  freezable: boolean | null;
  mutable: boolean | null;
}

/* ═══════════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════════ */

type Timeframe = "15m" | "1H" | "4H" | "1D";

const TIMEFRAME_CONFIG: Record<Timeframe, { geckoBase: string; aggregate: number; limit: number; label: string }> = {
  "15m": { geckoBase: "minute", aggregate: 15, limit: 96,  label: "15m" },
  "1H":  { geckoBase: "hour",   aggregate: 1,  limit: 168, label: "1H" },
  "4H":  { geckoBase: "hour",   aggregate: 4,  limit: 180, label: "4H" },
  "1D":  { geckoBase: "day",    aggregate: 1,  limit: 90,  label: "1D" },
};

const DEFAULT_MINTS: { mint: string; symbol: string; name: string }[] = [
  { mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", symbol: "BONK", name: "Bonk" },
  { mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", symbol: "WIF", name: "dogwifhat" },
  { mint: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr", symbol: "POPCAT", name: "Popcat" },
  { mint: "9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump", symbol: "FARTCOIN", name: "Fartcoin" },
  { mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", symbol: "JUP", name: "Jupiter" },
  { mint: "6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN", symbol: "TRUMP", name: "Official Trump" },
  { mint: "ED5nyyWEzpPPiWimP8vYm7sD7TD3LAt3Q3gRTWHzPJBY", symbol: "MOODENG", name: "Moo Deng" },
  { mint: "ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82", symbol: "BOME", name: "BOOK OF MEME" },
  { mint: "3S8qX1MsMqRbiwKg2cQyx7nis1oHMgaCuc9c4VfvVdPN", symbol: "MOTHER", name: "Mother Iggy" },
  { mint: "HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC", symbol: "AI16Z", name: "ai16z" },
  { mint: "CzLSujWBLFsSjncfkh59rUFqvafWcY5tzedWJSuypump", symbol: "GOAT", name: "Goatseus Maximus" },
  { mint: "MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5", symbol: "MEW", name: "cat in a dogs world" },
];

const SIDEBAR_TABS = ["Trending", "Positions", "Following"] as const;
type SidebarTab = (typeof SIDEBAR_TABS)[number];

const BOTTOM_TABS = ["Trades", "My Trades", "Positions", "Top Traders"] as const;
type BottomTab = (typeof BOTTOM_TABS)[number];

const GECKO_BASE = "https://api.geckoterminal.com/api/v2";

/* ═══════════════════════════════════════════════════════════════════
   API Helpers
   ═══════════════════════════════════════════════════════════════════ */

/** Fetch token pair info from DexScreener (CORS-friendly) */
async function fetchDexPair(mint: string): Promise<TokenListItem | null> {
  try {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
    if (!r.ok) return null;
    const d = await r.json();
    const pair = (d.pairs || [])
      .filter((p: any) => p.chainId === "solana")
      .sort((a: any, b: any) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0))[0];
    if (!pair) return null;
    const txns5m = pair.txns?.m5 || {};
    const totalTxns5m = (txns5m.buys || 0) + (txns5m.sells || 0);
    return {
      mint,
      symbol: pair.baseToken?.symbol || "???",
      name: pair.baseToken?.name || "",
      image: pair.info?.imageUrl || undefined,
      price: parseFloat(pair.priceUsd || "0"),
      mcap: pair.marketCap || pair.fdv || 0,
      change24h: pair.priceChange?.h24 || 0,
      volume24h: pair.volume?.h24 || 0,
      liquidity: pair.liquidity?.usd || 0,
      pairAddress: pair.pairAddress,
      volume5m: pair.volume?.m5 || 0,
      buys5m: txns5m.buys || 0,
      sells5m: txns5m.sells || 0,
      buyVol5m: totalTxns5m > 0 ? ((pair.volume?.m5 || 0) * (txns5m.buys || 0)) / totalTxns5m : 0,
      sellVol5m: totalTxns5m > 0 ? ((pair.volume?.m5 || 0) * (txns5m.sells || 0)) / totalTxns5m : 0,
    };
  } catch { return null; }
}

/** Fetch OHLCV candle data from GeckoTerminal (CORS-friendly) */
async function fetchGeckoOhlcv(
  poolAddress: string,
  tokenMint: string,
  timeframe: Timeframe,
): Promise<CandleDataPoint[]> {
  const cfg = TIMEFRAME_CONFIG[timeframe];
  const url = `${GECKO_BASE}/networks/solana/pools/${poolAddress}/ohlcv/${cfg.geckoBase}?aggregate=${cfg.aggregate}&limit=${cfg.limit}&currency=usd&token=${tokenMint}`;
  try {
    const r = await fetch(url);
    if (!r.ok) return [];
    const d = await r.json();
    const items: number[][] = d?.data?.attributes?.ohlcv_list ?? [];
    return items
      .map(([ts, o, h, l, c, v]) => ({
        time: ts,
        open: o,
        high: h,
        low: l,
        close: c,
        volume: v,
      }))
      .sort((a, b) => a.time - b.time);
  } catch { return []; }
}

/** Fetch recent trades from GeckoTerminal (CORS-friendly) */
async function fetchGeckoTrades(poolAddress: string, tokenSymbol: string): Promise<TradeEntry[]> {
  try {
    const r = await fetch(
      `${GECKO_BASE}/networks/solana/pools/${poolAddress}/trades`
    );
    if (!r.ok) return [];
    const d = await r.json();
    return (d?.data ?? []).slice(0, 50).map((t: any) => {
      const a = t.attributes || {};
      const isBuy = a.kind === "buy";
      return {
        txHash: a.tx_hash || "",
        time: a.block_timestamp ? Math.floor(new Date(a.block_timestamp).getTime() / 1000) : 0,
        side: isBuy ? "buy" : "sell",
        priceUsd: parseFloat(a.price_to_in_usd || a.price_from_in_usd || "0"),
        amount: parseFloat(isBuy ? a.to_token_amount || "0" : a.from_token_amount || "0"),
        symbol: tokenSymbol,
        value: parseFloat(a.volume_in_usd || "0"),
        wallet: a.tx_from_address || "",
      } as TradeEntry;
    });
  } catch { return []; }
}

/** Fetch mint/freeze/holder security info from Helius RPC */
async function fetchSecurity(mint: string): Promise<TokenSecurity> {
  const def: TokenSecurity = {
    top10HoldersPercent: null,
    devHoldersPercent: null,
    lpBurned: "—",
    mintable: null,
    freezable: null,
    mutable: null,
  };
  try {
    const [mintRes, holderRes] = await Promise.all([
      fetch(HELIUS_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: "mint-info",
          method: "getAccountInfo",
          params: [mint, { encoding: "jsonParsed" }],
        }),
      }),
      fetch(HELIUS_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: "holders",
          method: "getTokenLargestAccounts",
          params: [mint, { commitment: "confirmed" }],
        }),
      }),
    ]);
    const mintData = await mintRes.json();
    const info = mintData?.result?.value?.data?.parsed?.info;
    if (info) {
      def.mintable = !!info.mintAuthority;
      def.freezable = !!info.freezeAuthority;
      const supply = parseFloat(info.supply || "0") / Math.pow(10, info.decimals || 0);
      const holderData = await holderRes.json();
      const accounts = holderData?.result?.value || [];
      const top10Sum = accounts
        .slice(0, 10)
        .reduce((s: number, a: any) => s + (a.uiAmount || 0), 0);
      if (supply > 0) {
        def.top10HoldersPercent = Math.min(100, (top10Sum / supply) * 100);
      }
    }
  } catch { /* best-effort */ }
  return def;
}

/* ═══════════════════════════════════════════════════════════════════
   Swap Helper (Jupiter — zero platform fees)
   ═══════════════════════════════════════════════════════════════════ */

function b64ToU8(b64: string): Uint8Array {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

async function buildSwapTx(
  inputMint: string, outputMint: string,
  amountLamports: number, slippageBps: number, userKey: string,
): Promise<string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(JUPITER_API_KEY ? { Authorization: `Bearer ${JUPITER_API_KEY}` } : {}),
  };
  const q = await fetch(
    `${JUPITER_BASE}/swap/v1/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountLamports}&slippageBps=${slippageBps}&restrictIntermediateTokens=true`,
    { headers },
  );
  if (!q.ok) throw new Error("Quote failed");
  const quote = await q.json();
  const s = await fetch(`${JUPITER_BASE}/swap/v1/swap`, {
    method: "POST", headers,
    body: JSON.stringify({
      quoteResponse: quote, userPublicKey: userKey,
      wrapAndUnwrapSol: true, dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: "auto",
    }),
  });
  if (!s.ok) throw new Error("Swap build failed");
  return (await s.json()).swapTransaction;
}

/* ═══════════════════════════════════════════════════════════════════
   Formatting
   ═══════════════════════════════════════════════════════════════════ */

function fmtPrice(p: number): string {
  if (p === 0) return "$0";
  if (p >= 1_000) return `$${p.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (p >= 1) return `$${p.toFixed(2)}`;
  if (p >= 0.01) return `$${p.toFixed(4)}`;
  if (p >= 0.0001) return `$${p.toFixed(6)}`;
  return `$${p.toExponential(3)}`;
}

function fmtMcap(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtPct(p: number): string {
  const sign = p >= 0 ? "+" : "";
  if (Math.abs(p) >= 1000) return `${sign}${(p / 1000).toFixed(2)}K%`;
  return `${sign}${p.toFixed(2)}%`;
}

function fmtAgo(unix: number): string {
  const s = Math.floor(Date.now() / 1000 - unix);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function fmtNum(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  if (n >= 1) return n.toFixed(2);
  if (n >= 0.001) return n.toFixed(4);
  return n.toExponential(2);
}

/* ═══════════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════════ */

export const TradingTerminal = () => {
  const { publicKey, signTransaction, connected, wallets, select, connect, disconnect } = useWallet();
  const { connection } = useConnection();

  /* ── State ──────────────────────────────────────────────── */
  const [tokens, setTokens] = useState<TokenListItem[]>([]);
  const [selectedMint, setSelectedMint] = useState<string>(DEFAULT_MINTS[0].mint);
  const [selectedToken, setSelectedToken] = useState<TokenListItem | null>(null);
  const [chartData, setChartData] = useState<CandleDataPoint[]>([]);
  const [timeframe, setTimeframe] = useState<Timeframe>("15m");
  const [priceMode, setPriceMode] = useState<"price" | "mcap">("price");
  const [trades, setTrades] = useState<TradeEntry[]>([]);
  const [security, setSecurity] = useState<TokenSecurity | null>(null);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("Trending");
  const [bottomTab, setBottomTab] = useState<BottomTab>("Trades");
  const [swapMode, setSwapMode] = useState<"buy" | "sell">("buy");
  const [swapAmount, setSwapAmount] = useState("");
  const [swapping, setSwapping] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<JupTokenInfo[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingChart, setLoadingChart] = useState(false);
  const [loadingTokens, setLoadingTokens] = useState(true);
  const [copied, setCopied] = useState(false);
  const [positions, setPositions] = useState<TokenAsset[]>([]);
  const [showWalletPicker, setShowWalletPicker] = useState(false);

  // Chart height from container
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chartHeight, setChartHeight] = useState(400);

  /* ── Chart container resize ─────────────────────────────── */
  useEffect(() => {
    const el = chartContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setChartHeight(el.clientHeight));
    ro.observe(el);
    setChartHeight(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  /* ── Load trending tokens on mount ──────────────────────── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingTokens(true);
      const results = await Promise.all(
        DEFAULT_MINTS.map((t) => fetchDexPair(t.mint))
      );
      if (cancelled) return;
      const valid = results.filter(Boolean) as TokenListItem[];
      valid.sort((a, b) => b.volume24h - a.volume24h);
      setTokens(valid);
      setLoadingTokens(false);
      if (valid.length > 0) {
        setSelectedMint(valid[0].mint);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /* ── Load selected token data (DexScreener pair + security) ─── */
  useEffect(() => {
    if (!selectedMint) return;
    let cancelled = false;
    (async () => {
      const pair = await fetchDexPair(selectedMint);
      if (cancelled) return;
      if (pair) setSelectedToken(pair);

      // Security info (Helius RPC — supports CORS)
      fetchSecurity(selectedMint).then((s) => { if (!cancelled) setSecurity(s); });
    })();
    return () => { cancelled = true; };
  }, [selectedMint]);

  /* ── Load chart data from GeckoTerminal ─────────────────── */
  useEffect(() => {
    if (!selectedToken?.pairAddress) return;
    let cancelled = false;
    (async () => {
      setLoadingChart(true);
      try {
        const candles = await fetchGeckoOhlcv(
          selectedToken.pairAddress!,
          selectedMint,
          timeframe,
        );
        if (!cancelled) setChartData(candles);
      } catch {
        if (!cancelled) setChartData([]);
      }
      if (!cancelled) setLoadingChart(false);
    })();
    return () => { cancelled = true; };
  }, [selectedToken?.pairAddress, selectedMint, timeframe]);

  /* ── Load trades from GeckoTerminal ─────────────────────── */
  useEffect(() => {
    if (!selectedToken?.pairAddress) return;
    let cancelled = false;
    fetchGeckoTrades(selectedToken.pairAddress, selectedToken.symbol).then((t) => {
      if (!cancelled) setTrades(t);
    });
    return () => { cancelled = true; };
  }, [selectedToken?.pairAddress, selectedToken?.symbol]);

  /* ── Auto-refresh trades every 8s ───────────────────────── */
  useEffect(() => {
    if (!selectedToken?.pairAddress) return;
    const iv = setInterval(() => {
      fetchGeckoTrades(selectedToken.pairAddress!, selectedToken.symbol).then(setTrades);
    }, 8000);
    return () => clearInterval(iv);
  }, [selectedToken?.pairAddress, selectedToken?.symbol]);

  /* ── Auto-refresh pair data every 15s ───────────────────── */
  useEffect(() => {
    if (!selectedMint) return;
    const iv = setInterval(() => {
      fetchDexPair(selectedMint).then((p) => { if (p) setSelectedToken(p); });
    }, 15_000);
    return () => clearInterval(iv);
  }, [selectedMint]);

  /* ── Load positions if wallet connected ─────────────────── */
  useEffect(() => {
    if (!publicKey) { setPositions([]); return; }
    (async () => {
      try {
        const assets = await getAssets(publicKey.toString());
        setPositions(
          (assets.items || []).filter(
            (a: TokenAsset) => a.interface === "FungibleToken" || a.interface === "FungibleAsset"
          )
        );
      } catch { setPositions([]); }
    })();
  }, [publicKey]);

  /* ── Search debounce ────────────────────────────────────── */
  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await jupSearchToken(searchQuery);
        setSearchResults(res.slice(0, 12));
      } catch { setSearchResults([]); }
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  /* ── Handlers ───────────────────────────────────────────── */
  const selectToken = useCallback((mint: string) => {
    setSelectedMint(mint);
    setSearchQuery("");
    setSearchResults([]);
    setTrades([]);
    setChartData([]);
    setSecurity(null);
    setSelectedToken(null);
  }, []);

  const copyMint = useCallback(() => {
    navigator.clipboard.writeText(selectedMint);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Address copied" });
  }, [selectedMint]);

  /** Connect wallet using the adapter's select + connect */
  const connectWallet = useCallback(async () => {
    if (connected) return;
    // If Phantom is available, use it directly
    const phantomAdapter = wallets.find((w) => w.adapter.name === "Phantom");
    const solflareAdapter = wallets.find((w) => w.adapter.name === "Solflare");
    const target = phantomAdapter || solflareAdapter || wallets[0];
    if (target) {
      try {
        select(target.adapter.name as any);
        // Wait for the adapter to be ready, then connect
        setTimeout(async () => {
          try { await connect(); } catch { /* user cancelled or not installed */ }
        }, 200);
      } catch { /* ignore */ }
    } else {
      toast({ title: "No wallet detected", description: "Install Phantom or Solflare", variant: "destructive" });
    }
  }, [connected, wallets, select, connect]);

  const handleSwap = useCallback(async () => {
    if (!publicKey || !signTransaction || !selectedMint) return;
    const amt = parseFloat(swapAmount);
    if (!amt || amt <= 0) { toast({ title: "Enter an amount" }); return; }
    setSwapping(true);
    try {
      const inputMint = swapMode === "buy" ? SOL_MINT : selectedMint;
      const outputMint = swapMode === "buy" ? selectedMint : SOL_MINT;
      const decimals = swapMode === "buy" ? 9 : 6; // SOL=9, most tokens=6
      const lamports = Math.floor(amt * Math.pow(10, decimals));
      const base64Tx = await buildSwapTx(inputMint, outputMint, lamports, 100, publicKey.toString());
      const vtx = VersionedTransaction.deserialize(b64ToU8(base64Tx));
      const signed = await signTransaction(vtx);
      const sig = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(sig, "confirmed");
      toast({ title: "Swap confirmed!", description: `TX: ${shortAddr(sig, 8)}` });
      setSwapAmount("");
    } catch (err: any) {
      toast({ title: "Swap failed", description: err?.message || "Unknown error", variant: "destructive" });
    }
    setSwapping(false);
  }, [publicKey, signTransaction, selectedMint, swapMode, swapAmount, connection]);

  const selectSearchResult = useCallback(
    (token: JupTokenInfo) => {
      const mint = (token as any).address || token.id;
      setTokens((prev) => {
        if (prev.some((t) => t.mint === mint)) return prev;
        return [
          {
            mint,
            symbol: token.symbol || "???",
            name: token.name || "",
            image: (token as any).logoURI || token.icon || undefined,
            price: 0, mcap: 0, change24h: 0, volume24h: 0,
            liquidity: 0, volume5m: 0, buys5m: 0, sells5m: 0, buyVol5m: 0, sellVol5m: 0,
          },
          ...prev,
        ];
      });
      selectToken(mint);
    },
    [selectToken]
  );

  const refreshChart = useCallback(() => {
    if (!selectedToken?.pairAddress) return;
    setLoadingChart(true);
    fetchGeckoOhlcv(selectedToken.pairAddress, selectedMint, timeframe)
      .then(setChartData)
      .finally(() => setLoadingChart(false));
  }, [selectedToken?.pairAddress, selectedMint, timeframe]);

  /* ── Derived ────────────────────────────────────────────── */
  const t = selectedToken; // shorthand

  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */

  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-68px)] lg:h-[calc(100vh-0px)] overflow-y-auto lg:overflow-hidden bg-[#0a0a14]">

      {/* ═══════════════ LEFT SIDEBAR ═══════════════ */}
      <aside className="hidden lg:flex flex-col w-[280px] min-w-[280px] border-r border-white/[0.07] bg-[#0d0d1a]">
        {/* Sidebar tabs */}
        <div className="flex border-b border-white/[0.07]">
          {SIDEBAR_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setSidebarTab(tab)}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                sidebarTab === tab
                  ? "text-white border-b-2 border-[#ab9ff2]"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="p-2 border-b border-white/[0.07]">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/25" />
            <Input
              placeholder="Search token or paste address…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs bg-white/[0.04] border-white/[0.07] rounded-lg placeholder:text-white/20"
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(""); setSearchResults([]); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Search results overlay */}
        {searchResults.length > 0 && (
          <div className="border-b border-white/[0.07] bg-[#111128] max-h-[300px] overflow-y-auto">
            {searchResults.map((sr) => (
              <button
                key={(sr as any).address || sr.id}
                onClick={() => selectSearchResult(sr)}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/[0.06] transition-colors text-left"
              >
                {((sr as any).logoURI || sr.icon) && (
                  <img src={(sr as any).logoURI || sr.icon} alt=""
                    className="w-6 h-6 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold truncate">{sr.symbol}</p>
                  <p className="text-[10px] text-white/30 truncate">{sr.name}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Token list */}
        <ScrollArea className="flex-1">
          {loadingTokens ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-white/30" />
            </div>
          ) : sidebarTab === "Trending" ? (
            tokens.map((token) => (
              <button
                key={token.mint}
                onClick={() => selectToken(token.mint)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 transition-colors text-left ${
                  selectedMint === token.mint
                    ? "bg-[#ab9ff2]/10 border-l-2 border-[#ab9ff2]"
                    : "hover:bg-white/[0.04] border-l-2 border-transparent"
                }`}
              >
                {token.image ? (
                  <img src={token.image} alt="" className="w-7 h-7 rounded-full shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#ab9ff2] to-[#6c63ff] flex items-center justify-center text-[10px] font-bold shrink-0">
                    {token.symbol.slice(0, 2)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold truncate">{token.symbol}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-xs font-mono ${token.mcap > 0 ? "text-white/80" : "text-white/30"}`}>
                    {token.mcap > 0 ? fmtMcap(token.mcap) : "—"}
                  </p>
                  <p className={`text-[10px] font-mono ${
                    token.change24h > 0 ? "text-green-400" : token.change24h < 0 ? "text-red-400" : "text-white/30"
                  }`}>
                    {token.change24h !== 0 ? fmtPct(token.change24h) : "—"}
                  </p>
                </div>
              </button>
            ))
          ) : sidebarTab === "Positions" ? (
            connected && positions.length > 0 ? (
              positions.slice(0, 30).map((pos) => {
                const sym = pos.content?.metadata?.symbol || "???";
                const img = pos.content?.links?.image;
                const val = pos.token_info?.price_info?.total_price || 0;
                return (
                  <button
                    key={pos.id}
                    onClick={() => selectToken(pos.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-white/[0.04] transition-colors text-left ${
                      selectedMint === pos.id ? "bg-[#ab9ff2]/10 border-l-2 border-[#ab9ff2]" : "border-l-2 border-transparent"
                    }`}
                  >
                    {img ? (
                      <img src={img} alt="" className="w-7 h-7 rounded-full shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold shrink-0">{sym.slice(0, 2)}</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate">{sym}</p>
                    </div>
                    <p className="text-xs text-white/60 font-mono">{val > 0 ? `$${val.toFixed(2)}` : "—"}</p>
                  </button>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <Wallet className="h-8 w-8 text-white/20 mb-3" />
                <p className="text-xs text-white/40">{connected ? "No token positions" : "Connect wallet to view positions"}</p>
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <Star className="h-8 w-8 text-white/20 mb-3" />
              <p className="text-xs text-white/40">Follow tokens to track them here</p>
            </div>
          )}
        </ScrollArea>
      </aside>

      {/* ═══════════════ CENTER PANEL ═══════════════ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden lg:overflow-hidden">

        {/* Mobile token selector */}
        <div className="lg:hidden border-b border-white/[0.07] bg-[#0d0d1a]">
          <div className="p-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/25" />
              <Input
                placeholder="Search token…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs bg-white/[0.04] border-white/[0.07] rounded-lg"
              />
            </div>
            {/* Mobile search results */}
            {searchResults.length > 0 && (
              <div className="mt-1 bg-[#111128] rounded-lg border border-white/[0.07] max-h-[200px] overflow-y-auto">
                {searchResults.map((sr) => (
                  <button
                    key={(sr as any).address || sr.id}
                    onClick={() => selectSearchResult(sr)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/[0.06] text-left"
                  >
                    {((sr as any).logoURI || sr.icon) && (
                      <img src={(sr as any).logoURI || sr.icon} alt="" className="w-5 h-5 rounded-full" />
                    )}
                    <span className="text-xs font-semibold">{sr.symbol}</span>
                    <span className="text-[10px] text-white/30 truncate">{sr.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-1.5 px-2 pb-2 overflow-x-auto no-scrollbar">
            {tokens.slice(0, 10).map((tk) => (
              <button
                key={tk.mint}
                onClick={() => selectToken(tk.mint)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors ${
                  selectedMint === tk.mint ? "bg-[#ab9ff2]/20 text-[#ab9ff2]" : "bg-white/[0.05] text-white/50"
                }`}
              >
                {tk.image && <img src={tk.image} className="w-4 h-4 rounded-full" alt="" />}
                {tk.symbol}
              </button>
            ))}
          </div>
        </div>

        {/* Token header */}
        {t && (
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.07] bg-[#0d0d1a]/80">
            {t.image ? (
              <img src={t.image} alt="" className="w-8 h-8 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#ab9ff2] to-[#6c63ff] flex items-center justify-center text-xs font-bold">
                {t.symbol.slice(0, 2)}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold">{t.symbol}</h2>
                <button onClick={copyMint} className="text-white/25 hover:text-white/50 transition-colors">
                  {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
                <a href={`https://solscan.io/token/${selectedMint}`} target="_blank" rel="noopener noreferrer"
                  className="text-white/25 hover:text-white/50 transition-colors">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-4">
              <div className="text-right">
                <span className="text-[10px] text-white/30">Price</span>
                <p className="text-sm font-bold font-mono">{fmtPrice(t.price)}</p>
              </div>
              <div className="text-right hidden sm:block">
                <span className="text-[10px] text-white/30">Market Cap</span>
                <p className="text-sm font-semibold font-mono">{fmtMcap(t.mcap)}</p>
              </div>
              <div className="text-right hidden sm:block">
                <span className="text-[10px] text-white/30">24h</span>
                <p className={`text-sm font-semibold font-mono ${t.change24h >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {fmtPct(t.change24h)}
                </p>
              </div>
              <div className="text-right hidden md:block">
                <span className="text-[10px] text-white/30">Liquidity</span>
                <p className="text-sm font-semibold font-mono text-[#ab9ff2]">{fmtMcap(t.liquidity)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Chart controls */}
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-white/[0.07] bg-[#0a0a14]">
          {(Object.keys(TIMEFRAME_CONFIG) as Timeframe[]).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                timeframe === tf
                  ? "bg-[#ab9ff2]/20 text-[#ab9ff2]"
                  : "text-white/35 hover:text-white/60 hover:bg-white/[0.04]"
              }`}
            >
              {TIMEFRAME_CONFIG[tf].label}
            </button>
          ))}
          <div className="w-px h-4 bg-white/[0.07] mx-1" />
          <button
            onClick={() => setPriceMode("price")}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              priceMode === "price" ? "text-white underline underline-offset-4" : "text-white/35 hover:text-white/60"
            }`}
          >
            Price
          </button>
          <span className="text-white/15 text-[11px]">/</span>
          <button
            onClick={() => setPriceMode("mcap")}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              priceMode === "mcap" ? "text-white underline underline-offset-4" : "text-white/35 hover:text-white/60"
            }`}
          >
            MCap
          </button>
          <div className="flex-1" />
          <button onClick={refreshChart} className="text-white/25 hover:text-white/50 transition-colors p-1">
            <RefreshCw className={`h-3.5 w-3.5 ${loadingChart ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Chart area */}
        <div ref={chartContainerRef} className="flex-1 min-h-[300px] h-[350px] lg:h-auto relative">
          {loadingChart && chartData.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-[#ab9ff2]/40" />
            </div>
          ) : chartData.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="h-6 w-6 animate-spin text-white/20 mx-auto mb-2" />
                <p className="text-white/20 text-sm">Loading chart…</p>
              </div>
            </div>
          ) : (
            <CandlestickChart data={chartData} height={chartHeight} />
          )}
        </div>

        {/* Bottom tabs: Trades / My Trades / Positions / Top Traders */}
        <div className="border-t border-white/[0.07] bg-[#0d0d1a] flex flex-col min-h-[250px] lg:min-h-[200px] lg:max-h-[280px]">
          <div className="flex border-b border-white/[0.07]">
            {BOTTOM_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setBottomTab(tab)}
                className={`px-4 py-2 text-xs font-medium transition-colors ${
                  bottomTab === tab
                    ? "text-white border-b-2 border-[#ab9ff2]"
                    : "text-white/35 hover:text-white/60"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <ScrollArea className="flex-1">
            {bottomTab === "Trades" && (
              <>
                <div className="grid grid-cols-6 gap-2 px-3 py-1.5 text-[10px] text-white/25 font-medium border-b border-white/[0.05] sticky top-0 bg-[#0d0d1a]">
                  <span>Time</span>
                  <span>Type</span>
                  <span>Price</span>
                  <span>Amount</span>
                  <span>Value</span>
                  <span>Wallet</span>
                </div>
                {trades.length === 0 ? (
                  <div className="flex items-center justify-center py-8 text-white/20 text-xs">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Loading trades…
                  </div>
                ) : (
                  trades.map((trade, i) => (
                    <div
                      key={trade.txHash + i}
                      className="grid grid-cols-6 gap-2 px-3 py-1.5 text-[11px] hover:bg-white/[0.03] transition-colors items-center"
                    >
                      <span className="text-white/40 font-mono">{fmtAgo(trade.time)}</span>
                      <span className={`font-semibold ${trade.side === "buy" ? "text-green-400" : "text-red-400"}`}>
                        {trade.side === "buy" ? "Buy" : "Sell"}
                      </span>
                      <span className="text-white/60 font-mono">{fmtPrice(trade.priceUsd)}</span>
                      <span className="text-white/50 font-mono">{fmtNum(trade.amount)}</span>
                      <span className="text-white/50 font-mono">${fmtNum(trade.value)}</span>
                      <a
                        href={`https://solscan.io/account/${trade.wallet}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white/30 font-mono hover:text-[#ab9ff2] transition-colors truncate"
                      >
                        {shortAddr(trade.wallet, 4)}
                      </a>
                    </div>
                  ))
                )}
              </>
            )}

            {bottomTab === "My Trades" && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Activity className="h-6 w-6 text-white/15 mb-2" />
                <p className="text-xs text-white/30">{connected ? "Your trades for this token will appear here" : "Connect wallet to see your trades"}</p>
              </div>
            )}

            {bottomTab === "Positions" && (
              connected && positions.length > 0 ? (
                <>
                  <div className="grid grid-cols-4 gap-2 px-3 py-1.5 text-[10px] text-white/25 font-medium border-b border-white/[0.05]">
                    <span>Token</span>
                    <span>Balance</span>
                    <span>Price</span>
                    <span>Value</span>
                  </div>
                  {positions.slice(0, 20).map((pos) => {
                    const sym = pos.content?.metadata?.symbol || "???";
                    const bal = (pos.token_info?.balance || 0) / Math.pow(10, pos.token_info?.decimals || 0);
                    const price = pos.token_info?.price_info?.price_per_token || 0;
                    const val = pos.token_info?.price_info?.total_price || 0;
                    return (
                      <button
                        key={pos.id}
                        onClick={() => selectToken(pos.id)}
                        className="w-full grid grid-cols-4 gap-2 px-3 py-2 text-[11px] hover:bg-white/[0.04] transition-colors text-left"
                      >
                        <span className="font-semibold truncate">{sym}</span>
                        <span className="text-white/50 font-mono">{fmtNum(bal)}</span>
                        <span className="text-white/50 font-mono">{fmtPrice(price)}</span>
                        <span className="text-white/70 font-mono">{val > 0 ? `$${val.toFixed(2)}` : "—"}</span>
                      </button>
                    );
                  })}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Wallet className="h-6 w-6 text-white/15 mb-2" />
                  <p className="text-xs text-white/30">{connected ? "No positions found" : "Connect wallet to view positions"}</p>
                </div>
              )
            )}

            {bottomTab === "Top Traders" && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Users className="h-6 w-6 text-white/15 mb-2" />
                <p className="text-xs text-white/30">Top traders analysis coming soon</p>
              </div>
            )}
          </ScrollArea>
        </div>
      </div>

      {/* ═══════════════ RIGHT SIDEBAR ═══════════════ */}
      <aside className="hidden lg:flex flex-col w-[320px] min-w-[320px] border-l border-white/[0.07] bg-[#0d0d1a]">
        {/* 5m stats bar */}
        {t && (
          <div className="grid grid-cols-3 border-b border-white/[0.07]">
            <div className="p-3 text-center border-r border-white/[0.05]">
              <p className="text-[10px] text-white/30">5m Vol</p>
              <p className="text-xs font-bold font-mono text-white/80">{fmtMcap(t.volume5m)}</p>
            </div>
            <div className="p-3 text-center border-r border-white/[0.05]">
              <p className="text-[10px] text-white/30">Buys</p>
              <p className="text-xs font-bold font-mono text-green-400">
                {t.buys5m} <span className="text-white/30">·</span> {fmtMcap(t.buyVol5m)}
              </p>
            </div>
            <div className="p-3 text-center">
              <p className="text-[10px] text-white/30">Sells</p>
              <p className="text-xs font-bold font-mono text-red-400">
                {t.sells5m} <span className="text-white/30">·</span> {fmtMcap(t.sellVol5m)}
              </p>
            </div>
          </div>
        )}

        {/* Swap panel */}
        <div className="p-4 space-y-3 border-b border-white/[0.07]">
          {/* Buy / Sell toggle */}
          <div className="flex rounded-lg overflow-hidden border border-white/[0.07]">
            <button
              onClick={() => setSwapMode("buy")}
              className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                swapMode === "buy"
                  ? "bg-green-500/20 text-green-400 border-b-2 border-green-400"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              Buy
            </button>
            <button
              onClick={() => setSwapMode("sell")}
              className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                swapMode === "sell"
                  ? "bg-red-500/20 text-red-400 border-b-2 border-red-400"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              Sell
            </button>
          </div>

          {/* Amount input */}
          <div className="relative">
            <Input
              type="number"
              placeholder="0"
              value={swapAmount}
              onChange={(e) => setSwapAmount(e.target.value)}
              className="h-12 text-lg font-mono bg-white/[0.04] border-white/[0.07] rounded-xl pr-16"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-white/50">
              <span className="text-xs font-medium">SOL</span>
              <ChevronDown className="h-3 w-3" />
            </div>
          </div>

          {/* Quick amount buttons */}
          <div className="grid grid-cols-3 gap-1.5">
            {[0.1, 0.25, 0.5, 1, 5, 10].map((amt) => (
              <button
                key={amt}
                onClick={() => setSwapAmount(String(amt))}
                className="py-1.5 rounded-lg text-[11px] font-medium bg-white/[0.04] border border-white/[0.07] text-white/50 hover:bg-white/[0.08] hover:text-white/70 transition-colors"
              >
                {amt} ◎
              </button>
            ))}
          </div>

          {/* Swap / Connect button */}
          {connected ? (
            <Button
              onClick={handleSwap}
              disabled={swapping || !swapAmount}
              className={`w-full h-11 rounded-xl font-semibold text-sm ${
                swapMode === "buy"
                  ? "bg-green-500 hover:bg-green-600 text-black"
                  : "bg-red-500 hover:bg-red-600 text-white"
              }`}
            >
              {swapping ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : swapMode === "buy" ? (
                <ArrowDownLeft className="h-4 w-4 mr-2" />
              ) : (
                <ArrowUpRight className="h-4 w-4 mr-2" />
              )}
              {swapping ? "Swapping…" : swapMode === "buy" ? `Buy ${t?.symbol || ""}` : `Sell ${t?.symbol || ""}`}
            </Button>
          ) : (
            <Button
              onClick={connectWallet}
              className="w-full h-11 rounded-xl font-semibold text-sm bg-[#ab9ff2] hover:bg-[#9b8fe2] text-black"
            >
              <Wallet className="h-4 w-4 mr-2" />
              Connect Wallet
            </Button>
          )}

          <p className="text-[10px] text-white/25 text-center">$0 fee · Powered by Jupiter</p>
        </div>

        {/* Token Info */}
        <div className="p-4 flex-1 overflow-y-auto">
          <h3 className="text-xs font-semibold text-white/60 mb-3 flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5" />
            Token Info
          </h3>

          {security ? (
            <div className="grid grid-cols-3 gap-3">
              <InfoCell
                label="Top 10 H"
                value={security.top10HoldersPercent != null ? `${security.top10HoldersPercent.toFixed(1)}%` : "—"}
                color={
                  security.top10HoldersPercent == null ? "neutral" :
                  security.top10HoldersPercent < 30 ? "good" :
                  security.top10HoldersPercent < 60 ? "warn" : "bad"
                }
              />
              <InfoCell label="Dev H" value={security.devHoldersPercent != null ? `${security.devHoldersPercent.toFixed(1)}%` : "—"} color="neutral" />
              <InfoCell label="Snipers H" value="—" color="neutral" />
              <InfoCell label="Bundler H" value="—" color="neutral" />
              <InfoCell
                label="LP Burned"
                value={security.lpBurned}
                color={security.lpBurned === "100%" ? "good" : security.lpBurned === "—" ? "neutral" : "warn"}
              />
              <InfoCell
                label="Mutable"
                value={security.mutable == null ? "—" : security.mutable ? "Enabled" : "Disabled"}
                color={security.mutable == null ? "neutral" : security.mutable ? "bad" : "good"}
              />
              <InfoCell
                label="Mintable"
                value={security.mintable == null ? "—" : security.mintable ? "Enabled" : "Disabled"}
                color={security.mintable == null ? "neutral" : security.mintable ? "bad" : "good"}
              />
              <InfoCell
                label="Freezable"
                value={security.freezable == null ? "—" : security.freezable ? "Enabled" : "Disabled"}
                color={security.freezable == null ? "neutral" : security.freezable ? "bad" : "good"}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-white/20" />
            </div>
          )}
        </div>
      </aside>

      {/* ═══════════════ MOBILE SWAP & INFO SECTION ═══════════════ */}
      <div className="lg:hidden bg-[#0d0d1a] border-t border-white/[0.07]">
        {/* 5m stats */}
        {t && (
          <div className="grid grid-cols-3 border-b border-white/[0.07]">
            <div className="p-3 text-center border-r border-white/[0.05]">
              <p className="text-[10px] text-white/30">5m Vol</p>
              <p className="text-xs font-bold font-mono text-white/80">{fmtMcap(t.volume5m)}</p>
            </div>
            <div className="p-3 text-center border-r border-white/[0.05]">
              <p className="text-[10px] text-white/30">Buys</p>
              <p className="text-xs font-bold font-mono text-green-400">{t.buys5m}</p>
            </div>
            <div className="p-3 text-center">
              <p className="text-[10px] text-white/30">Sells</p>
              <p className="text-xs font-bold font-mono text-red-400">{t.sells5m}</p>
            </div>
          </div>
        )}

        {/* Swap panel */}
        <div className="p-4 space-y-3 border-b border-white/[0.07]">
          <div className="flex rounded-lg overflow-hidden border border-white/[0.07]">
            <button
              onClick={() => setSwapMode("buy")}
              className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                swapMode === "buy"
                  ? "bg-green-500/20 text-green-400 border-b-2 border-green-400"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              Buy
            </button>
            <button
              onClick={() => setSwapMode("sell")}
              className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                swapMode === "sell"
                  ? "bg-red-500/20 text-red-400 border-b-2 border-red-400"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              Sell
            </button>
          </div>

          <div className="relative">
            <Input
              type="number"
              placeholder="0"
              value={swapAmount}
              onChange={(e) => setSwapAmount(e.target.value)}
              className="h-12 text-lg font-mono bg-white/[0.04] border-white/[0.07] rounded-xl pr-16"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-white/50">
              <span className="text-xs font-medium">SOL</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {[0.1, 0.25, 0.5, 1, 5, 10].map((amt) => (
              <button
                key={amt}
                onClick={() => setSwapAmount(String(amt))}
                className="py-1.5 rounded-lg text-[11px] font-medium bg-white/[0.04] border border-white/[0.07] text-white/50 hover:bg-white/[0.08] transition-colors"
              >
                {amt} ◎
              </button>
            ))}
          </div>

          {connected ? (
            <Button
              onClick={handleSwap}
              disabled={swapping || !swapAmount}
              className={`w-full h-11 rounded-xl font-semibold text-sm ${
                swapMode === "buy"
                  ? "bg-green-500 hover:bg-green-600 text-black"
                  : "bg-red-500 hover:bg-red-600 text-white"
              }`}
            >
              {swapping ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : swapMode === "buy" ? (
                <ArrowDownLeft className="h-4 w-4 mr-2" />
              ) : (
                <ArrowUpRight className="h-4 w-4 mr-2" />
              )}
              {swapping ? "Swapping…" : swapMode === "buy" ? `Buy ${t?.symbol || ""}` : `Sell ${t?.symbol || ""}`}
            </Button>
          ) : (
            <Button
              onClick={connectWallet}
              className="w-full h-11 rounded-xl font-semibold text-sm bg-[#ab9ff2] hover:bg-[#9b8fe2] text-black"
            >
              <Wallet className="h-4 w-4 mr-2" />
              Connect Wallet
            </Button>
          )}
          <p className="text-[10px] text-white/25 text-center">$0 fee · Powered by Jupiter</p>
        </div>

        {/* Token Info on mobile */}
        {security && (
          <div className="p-4">
            <h3 className="text-xs font-semibold text-white/60 mb-3 flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5" />
              Token Info
            </h3>
            <div className="grid grid-cols-4 gap-3">
              <InfoCell
                label="Top 10 H"
                value={security.top10HoldersPercent != null ? `${security.top10HoldersPercent.toFixed(1)}%` : "—"}
                color={
                  security.top10HoldersPercent == null ? "neutral" :
                  security.top10HoldersPercent < 30 ? "good" :
                  security.top10HoldersPercent < 60 ? "warn" : "bad"
                }
              />
              <InfoCell label="Dev H" value={security.devHoldersPercent != null ? `${security.devHoldersPercent.toFixed(1)}%` : "—"} color="neutral" />
              <InfoCell
                label="Mintable"
                value={security.mintable == null ? "—" : security.mintable ? "Yes" : "No"}
                color={security.mintable == null ? "neutral" : security.mintable ? "bad" : "good"}
              />
              <InfoCell
                label="Freezable"
                value={security.freezable == null ? "—" : security.freezable ? "Yes" : "No"}
                color={security.freezable == null ? "neutral" : security.freezable ? "bad" : "good"}
              />
            </div>
          </div>
        )}

        {/* Bottom padding for app nav bar */}
        <div className="h-20" />
      </div>
    </div>
  );
};

/* ── Sub-component: Info cell ──────────────────────────── */
function InfoCell({ label, value, color }: { label: string; value: string; color: "good" | "warn" | "bad" | "neutral" }) {
  const clr =
    color === "good" ? "text-green-400" :
    color === "warn" ? "text-amber-400" :
    color === "bad" ? "text-red-400" :
    "text-white/40";
  return (
    <div className="text-center">
      <p className="text-[10px] text-white/30 mb-0.5">{label}</p>
      <p className={`text-xs font-semibold ${clr}`}>{value}</p>
    </div>
  );
}
