/**
 * TradingTerminal — Phantom-style 3-panel trading terminal for OrbitX.
 *
 * Layout:
 *   Left   (280 px)  DEX market list (screener) + search + positions
 *   Center (flex-1)  Token header → Chart → Trades / My Trades / Positions
 *   Right  (320 px)  Stats → Buy/Sell with Phantom connect + sign
 *
 * Markets: /api/ogdex/screener (same as DEX home).
 * Trades: POST /api/ogdex/trade → VersionedTransaction → wallet signAndSend.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, VersionedTransaction } from "@solana/web3.js";
import {
  Search, Copy, ExternalLink, RefreshCw,
  ArrowUpRight, ArrowDownLeft, Check,
  Wallet, Activity, X, Loader2, Users, Bell, KeyRound,
} from "lucide-react";
import {
  ALERT_KINDS,
  createPriceAlert,
  fetchAlerts,
  removeAlert,
  type AlertKind,
} from "@/trade/tradeAlerts";
import { getBuyPresets, getSellPresets, saveBuyPresets } from "@/trade/tradePresets";
import { fetchWallet } from "@/trade/tradeApi";
import { fmtPct, fmtPnl, fmtTok, fmtUsd } from "@/trade/tradeFmt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import {
  jupSearchToken,
  jupQuote,
  jupSwapTransaction,
  HELIUS_RPC,
  SOL_MINT,
  shortAddr,
  type JupTokenInfo,
} from "@/lib/og";
import {
  getAssets,
  type TokenAsset,
} from "@/lib/solana-api";
import { useActiveTradingWallet } from "@/hooks/useActiveTradingWallet";
import { connectSolanaWallet, phantomInstallHint } from "@/lib/connectSolanaWallet";
import ActiveTradingWalletChip from "@/trade/ActiveTradingWalletChip";
export type TradeTerminalProps = {
  initialMint?: string | null;
  onMintChange?: (mint: string) => void;
  /** desk = chart + trade only (no market browser chrome) */
  mode?: "full" | "desk";
};

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

const TIMEFRAME_CONFIG: Record<Timeframe, { geckoBase: string; aggregate: number; limit: number; label: string; dexInterval: string }> = {
  "15m": { geckoBase: "minute", aggregate: 15, limit: 96,  label: "15m", dexInterval: "15" },
  "1H":  { geckoBase: "hour",   aggregate: 1,  limit: 168, label: "1H",  dexInterval: "60" },
  "4H":  { geckoBase: "hour",   aggregate: 4,  limit: 180, label: "4H",  dexInterval: "240" },
  "1D":  { geckoBase: "day",    aggregate: 1,  limit: 90,  label: "1D",  dexInterval: "1D" },
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

/** Same market universe as ORBITX_DEX Screener (minus social feed). */
type MarketCategory = "discover" | "pumpfun" | "curated" | "wallet";
type MarketTab =
  | "trending" | "runners" | "new" | "fomo" | "jupiter"
  | "unbonded" | "migrated" | "moonshot" | "newpairs"
  | "og" | "kols" | "celebrity" | "organic" | "listed"
  | "positions";

const MARKET_CATEGORIES: { id: MarketCategory; label: string }[] = [
  { id: "discover", label: "Discover" },
  { id: "pumpfun", label: "Pump" },
  { id: "curated", label: "Curated" },
  { id: "wallet", label: "Wallet" },
];

const TABS_BY_CATEGORY: Record<MarketCategory, { id: MarketTab; label: string }[]> = {
  discover: [
    { id: "trending", label: "Trending" },
    { id: "runners", label: "Runners" },
    { id: "new", label: "New" },
    { id: "fomo", label: "FOMO" },
    { id: "jupiter", label: "Jupiter" },
  ],
  pumpfun: [
    { id: "unbonded", label: "Unbonded" },
    { id: "migrated", label: "Migrated" },
    { id: "moonshot", label: "Moonshot" },
    { id: "newpairs", label: "New Pairs" },
  ],
  curated: [
    { id: "og", label: "OG" },
    { id: "kols", label: "KOLs" },
    { id: "celebrity", label: "Celeb" },
    { id: "organic", label: "Organic" },
    { id: "listed", label: "Listed" },
  ],
  wallet: [
    { id: "positions", label: "Positions" },
  ],
};

const DEFAULT_TAB: Record<MarketCategory, MarketTab> = {
  discover: "trending",
  pumpfun: "unbonded",
  curated: "og",
  wallet: "positions",
};

const SCREEN_INTERVAL = "1h";
const SCREEN_LIMIT = 200;

function mapScreenerRow(row: any): TokenListItem | null {
  const mint = String(row.mint || row.contract_address || "").trim();
  if (!mint) return null;
  const poolRaw = row.firstPool?.id || row.poolAddress || row.pairAddress || "";
  const pairAddress = String(poolRaw).includes("_")
    ? String(poolRaw).split("_").pop()
    : String(poolRaw || "") || undefined;
  return {
    mint,
    symbol: row.symbol || "???",
    name: row.name || row.symbol || "",
    image: row.icon || row.image_url || undefined,
    price: Number(row.priceUsd || row.price_usd) || 0,
    mcap: Number(row.mcap || row.fdv || row.market_cap) || 0,
    change24h: Number(row.change24h ?? row.change1h ?? row.change5m) || 0,
    volume24h: Number(row.volume) || 0,
    liquidity: Number(row.liquidity) || 0,
    pairAddress: pairAddress || undefined,
    volume5m: Number(row.volume5m) || 0,
    buys5m: Number(row.numBuys) || 0,
    sells5m: Number(row.numSells) || 0,
    buyVol5m: Number(row.buyVolume) || 0,
    sellVol5m: Number(row.sellVolume) || 0,
  };
}

async function fetchOgdexMarkets(type: Exclude<MarketTab, "positions">): Promise<TokenListItem[]> {
  try {
    // Community listings use a separate endpoint (same as DEX home "Listed" tab)
    if (type === "listed") {
      const r = await fetch("/api/ogdex/listings");
      const d = await r.json();
      const rows: any[] = Array.isArray(d?.rows) ? d.rows : [];
      return rows.map(mapScreenerRow).filter(Boolean) as TokenListItem[];
    }
    const r = await fetch(
      `/api/ogdex/screener?type=${encodeURIComponent(type)}&interval=${SCREEN_INTERVAL}&limit=${SCREEN_LIMIT}&chain=solana`,
    );
    const d = await r.json();
    const rows: any[] = Array.isArray(d?.rows) ? d.rows : [];
    return rows.map(mapScreenerRow).filter(Boolean) as TokenListItem[];
  } catch {
    return [];
  }
}

function dexScreenerEmbedUrl(ref: string, interval: string): string {
  const q = new URLSearchParams({
    embed: "1",
    loadChartSettings: "0",
    trades: "0",
    tabs: "0",
    info: "0",
    chartLeftToolbar: "0",
    chartDefaultOnMobile: "1",
    chartTheme: "dark",
    theme: "dark",
    chartStyle: "1",
    chartType: "usd",
    interval,
  });
  return `https://dexscreener.com/solana/${ref}?${q.toString()}`;
}

const BOTTOM_TABS = ["Trades", "My Trades", "Positions", "Top Traders"] as const;
type BottomTab = (typeof BOTTOM_TABS)[number];

const GECKO_BASE = "https://api.geckoterminal.com/api/v2";

/* ═══════════════════════════════════════════════════════════════════
   API Helpers
   ═══════════════════════════════════════════════════════════════════ */

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

async function fetchGeckoTrades(poolAddress: string, tokenSymbol: string): Promise<TradeEntry[]> {
  try {
    const r = await fetch(`${GECKO_BASE}/networks/solana/pools/${poolAddress}/trades`);
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

async function fetchSecurity(mint: string): Promise<TokenSecurity> {
  const def: TokenSecurity = {
    top10HoldersPercent: null, devHoldersPercent: null,
    lpBurned: "—", mintable: null, freezable: null, mutable: null,
  };
  try {
    const [mintRes, holderRes] = await Promise.all([
      fetch(HELIUS_RPC, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: "mint-info", method: "getAccountInfo", params: [mint, { encoding: "jsonParsed" }] }),
      }),
      fetch(HELIUS_RPC, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: "holders", method: "getTokenLargestAccounts", params: [mint, { commitment: "confirmed" }] }),
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
      const top10Sum = accounts.slice(0, 10).reduce((s: number, a: any) => s + (a.uiAmount || 0), 0);
      if (supply > 0) def.top10HoldersPercent = Math.min(100, (top10Sum / supply) * 100);
    }
  } catch { /* best-effort */ }
  return def;
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

type LivePosition = {
  amount: number;
  worthUsd: number | null;
  costUsd: number | null;
  boughtUsd: number | null;
  avgCostUsd: number | null;
  unrealizedUsd: number | null;
  unrealizedPct: number | null;
  updatedAt: number;
};

export const TradingTerminal = ({ initialMint, onMintChange, mode = "full" }: TradeTerminalProps = {}) => {
  const {
    publicKey,
    connected,
    wallets,
    select,
    connect,
    disconnect,
    sendTransaction,
    signTransaction,
    signMessage,
  } = useWallet();
  const { connection } = useConnection();
  const deskMode = mode === "desk";
  const {
    setMode: setWalletMode,
    publicKey: tradePk,
    localActive,
    ready: tradeReady,
    sendTx: sendActiveTx,
  } = useActiveTradingWallet();

  /* ── State ──────────────────────────────────────────────── */
  const [tokens, setTokens] = useState<TokenListItem[]>([]);
  const [selectedMint, setSelectedMint] = useState<string>(initialMint || DEFAULT_MINTS[0].mint);
  const [selectedToken, setSelectedToken] = useState<TokenListItem | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>("15m");
  const [trades, setTrades] = useState<TradeEntry[]>([]);
  const [security, setSecurity] = useState<TokenSecurity | null>(null);
  const [marketCategory, setMarketCategory] = useState<MarketCategory>("discover");
  const [marketTab, setMarketTab] = useState<MarketTab>("trending");
  const [bottomTab, setBottomTab] = useState<BottomTab>("Trades");
  const [myTrades, setMyTrades] = useState<any[]>([]);
  const [myTradesLoading, setMyTradesLoading] = useState(false);
  const [topTraders, setTopTraders] = useState<any[]>([]);
  const [topTradersLoading, setTopTradersLoading] = useState(false);
  const [swapMode, setSwapMode] = useState<"buy" | "sell">("buy");
  const [buyAmt, setBuyAmt] = useState("0.25");
  const [buyPresets, setBuyPresets] = useState<number[]>(() => getBuyPresets());
  const [sellPresets] = useState<number[]>(() => getSellPresets());
  const [editPresetsOpen, setEditPresetsOpen] = useState(false);
  const [presetDraft, setPresetDraft] = useState("");
  const [sellPct, setSellPct] = useState(50);
  const [slippage, setSlippage] = useState(10);
  const [orderMode, setOrderMode] = useState<"market" | AlertKind>("market");
  const [alertPrice, setAlertPrice] = useState("");
  const [alertChan, setAlertChan] = useState<"telegram" | "webhook">(
    () => (typeof localStorage !== "undefined" && (localStorage.getItem("ogdex.alertChan") as any)) || "telegram",
  );
  const [alertTarget, setAlertTarget] = useState(
    () => (typeof localStorage !== "undefined" && localStorage.getItem("ogdex.alertTarget")) || "",
  );
  const [alertBusy, setAlertBusy] = useState(false);
  const [alertMsg, setAlertMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [mintAlerts, setMintAlerts] = useState<any[]>([]);
  const [tradeBusy, setTradeBusy] = useState(false);
  const [tradeStage, setTradeStage] = useState("");
  const [tradeErr, setTradeErr] = useState("");
  const [tradeSig, setTradeSig] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<JupTokenInfo[]>([]);
  const [searching, setSearching] = useState(false);
  const [chartReady, setChartReady] = useState(false);
  const [mountChart, setMountChart] = useState(false);
  const [loadingTokens, setLoadingTokens] = useState(!deskMode);
  const [copied, setCopied] = useState(false);
  const [positions, setPositions] = useState<TokenAsset[]>([]);
  const [showWalletPicker, setShowWalletPicker] = useState(false);
  const [livePos, setLivePos] = useState<LivePosition | null>(null);
  const [livePosLoading, setLivePosLoading] = useState(false);
  const costCacheRef = useRef<{
    mint: string;
    avgCostUsd: number | null;
    costUsd: number | null;
    boughtUsd: number | null;
  } | null>(null);

  /* ── Load DEX markets (skip in desk mode — trade a selected mint only) ── */
  useEffect(() => {
    if (deskMode) {
      setLoadingTokens(false);
      return;
    }
    if (marketTab === "positions") return;
    let cancelled = false;
    (async () => {
      setLoadingTokens(true);
      let list = await fetchOgdexMarkets(marketTab);
      if (!list.length) {
        const fallback = await Promise.all(DEFAULT_MINTS.map((t) => fetchDexPair(t.mint)));
        list = fallback.filter(Boolean) as TokenListItem[];
      }
      if (cancelled) return;
      setTokens(list);
      setLoadingTokens(false);
      if (initialMint && list.some((t) => t.mint === initialMint)) {
        setSelectedMint(initialMint);
      } else if (list.length && !list.some((t) => t.mint === selectedMint)) {
        setSelectedMint(list[0].mint);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketTab, deskMode]);

  /* Paint UI first, then mount DexScreener iframe (feels faster) */
  useEffect(() => {
    setMountChart(false);
    setChartReady(false);
    const t = window.setTimeout(() => setMountChart(true), 80);
    return () => window.clearTimeout(t);
  }, [selectedMint, timeframe]);

  useEffect(() => {
    if (initialMint) setSelectedMint(initialMint);
  }, [initialMint]);

  /* ── Load selected token data ───────────────────────────── */
  useEffect(() => {
    if (!selectedMint) return;
    let cancelled = false;
    setChartReady(false);
    (async () => {
      const pair = await fetchDexPair(selectedMint);
      if (cancelled) return;
      if (pair) setSelectedToken(pair);
      else {
        const fromList = tokens.find((t) => t.mint === selectedMint);
        if (fromList) setSelectedToken(fromList);
      }
      fetchSecurity(selectedMint).then((s) => { if (!cancelled) setSecurity(s); });
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMint]);

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

  /* ── Load positions for active trading wallet ───────────── */
  useEffect(() => {
    if (!tradePk) { setPositions([]); return; }
    (async () => {
      try {
        const assets = await getAssets(tradePk.toString());
        setPositions(
          (assets.items || []).filter(
            (a: TokenAsset) => a.interface === "FungibleToken" || a.interface === "FungibleAsset"
          )
        );
      } catch { setPositions([]); }
    })();
  }, [tradePk]);

  /* ── Live position for selected mint (~1s balance + price) ─ */
  useEffect(() => {
    if (!tradePk || !selectedMint) {
      setLivePos(null);
      setLivePosLoading(false);
      costCacheRef.current = null;
      return;
    }
    let on = true;
    setLivePosLoading(true);

    const refreshCost = async () => {
      try {
        const w = await fetchWallet(tradePk.toBase58());
        if (!on || !w?.ok) return;
        const tokens: any[] = Array.isArray(w?.pnl?.tokens)
          ? w.pnl.tokens
          : Array.isArray(w?.tokens)
            ? w.tokens
            : [];
        const row = tokens.find((t: any) => t.mint === selectedMint);
        costCacheRef.current = {
          mint: selectedMint,
          avgCostUsd: row?.avgCostUsd != null ? Number(row.avgCostUsd) : null,
          costUsd: row?.costUsd != null ? Number(row.costUsd) : null,
          boughtUsd: row?.boughtUsd != null ? Number(row.boughtUsd) : null,
        };
      } catch {
        /* keep prior cache */
      }
    };

    const tick = async () => {
      try {
        const mintPk = new PublicKey(selectedMint);
        const accs = await connection.getParsedTokenAccountsByOwner(tradePk, { mint: mintPk });
        let amount = 0;
        for (const a of accs.value) {
          const ui = Number(a.account?.data?.parsed?.info?.tokenAmount?.uiAmount || 0);
          if (Number.isFinite(ui)) amount += ui;
        }
        const price = Number(selectedToken?.price) || 0;
        const worthUsd = price > 0 && amount > 0 ? amount * price : amount > 0 && price <= 0 ? null : 0;
        const cache = costCacheRef.current?.mint === selectedMint ? costCacheRef.current : null;
        let costUsd = cache?.costUsd ?? null;
        if (costUsd == null && cache?.avgCostUsd != null && amount > 0) {
          costUsd = cache.avgCostUsd * amount;
        }
        let unrealizedUsd: number | null = null;
        let unrealizedPct: number | null = null;
        if (worthUsd != null && costUsd != null && costUsd > 0) {
          unrealizedUsd = worthUsd - costUsd;
          unrealizedPct = (unrealizedUsd / costUsd) * 100;
        }
        if (!on) return;
        // Bail out when numbers are unchanged so 1s polling doesn't thrash the tree
        // (critical: never remount input panels on ticker ticks).
        setLivePos((prev) => {
          const next = {
            amount,
            worthUsd,
            costUsd,
            boughtUsd: cache?.boughtUsd ?? null,
            avgCostUsd: cache?.avgCostUsd ?? null,
            unrealizedUsd,
            unrealizedPct,
            updatedAt: Date.now(),
          };
          if (
            prev &&
            prev.amount === next.amount &&
            prev.worthUsd === next.worthUsd &&
            prev.costUsd === next.costUsd &&
            prev.boughtUsd === next.boughtUsd &&
            prev.avgCostUsd === next.avgCostUsd &&
            prev.unrealizedUsd === next.unrealizedUsd &&
            prev.unrealizedPct === next.unrealizedPct
          ) {
            return prev;
          }
          return next;
        });
      } catch {
        if (on) setLivePos(null);
      } finally {
        if (on) setLivePosLoading(false);
      }
    };

    void refreshCost().then(() => tick());
    const balIv = window.setInterval(() => void tick(), 1000);
    const costIv = window.setInterval(() => void refreshCost(), 12_000);
    return () => {
      on = false;
      window.clearInterval(balIv);
      window.clearInterval(costIv);
    };
  }, [tradePk, selectedMint, selectedToken?.price, connection]);

  /* ── My Trades (wallet swaps) ───────────────────────────── */
  useEffect(() => {
    if (bottomTab !== "My Trades" || !tradePk) {
      if (!tradePk) setMyTrades([]);
      return;
    }
    let on = true;
    setMyTradesLoading(true);
    fetch(`/api/ogdex/swaps?address=${encodeURIComponent(tradePk.toBase58())}&limit=50`)
      .then((r) => r.json())
      .then((d) => {
        if (!on) return;
        const list = Array.isArray(d?.trades) ? d.trades : [];
        const filtered = selectedMint
          ? list.filter((t: any) => !t.mint || t.mint === selectedMint)
          : list;
        setMyTrades(filtered.length ? filtered : list);
        setMyTradesLoading(false);
      })
      .catch(() => {
        if (on) {
          setMyTrades([]);
          setMyTradesLoading(false);
        }
      });
    return () => {
      on = false;
    };
  }, [bottomTab, tradePk, selectedMint]);

  /* ── Top traders for selected mint ──────────────────────── */
  useEffect(() => {
    if (bottomTab !== "Top Traders" || !selectedMint) return;
    let on = true;
    setTopTradersLoading(true);
    fetch(`/api/ogdex/traders?mint=${encodeURIComponent(selectedMint)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!on) return;
        setTopTraders(Array.isArray(d?.traders) ? d.traders : []);
        setTopTradersLoading(false);
      })
      .catch(() => {
        if (on) {
          setTopTraders([]);
          setTopTradersLoading(false);
        }
      });
    return () => {
      on = false;
    };
  }, [bottomTab, selectedMint]);

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
    setSecurity(null);
    setSelectedToken(null);
    setChartReady(false);
    onMintChange?.(mint);
  }, [onMintChange]);

  const copyMint = useCallback(() => {
    navigator.clipboard.writeText(selectedMint);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Address copied" });
  }, [selectedMint]);

  /** Build Jupiter swap tx client-side when the trade API can't return one. */
  const buildJupiterTx = useCallback(async (): Promise<string> => {
    if (!tradePk || !selectedMint) throw new Error("Wallet / mint missing");
    const slippageBps = Math.min(Math.max(Math.round((Number(slippage) || 10) * 100), 50), 5000);
    if (swapMode === "buy") {
      const lamports = Math.floor(Number(buyAmt) * 1e9);
      if (!Number.isFinite(lamports) || lamports <= 0) throw new Error("Enter a valid SOL amount");
      const q = await jupQuote(SOL_MINT, selectedMint, String(lamports), slippageBps);
      return jupSwapTransaction(q, tradePk.toBase58());
    }
    const mintPk = new PublicKey(selectedMint);
    const accs = await connection.getParsedTokenAccountsByOwner(tradePk, { mint: mintPk });
    let raw = 0n;
    for (const a of accs.value) {
      const amt = a.account?.data?.parsed?.info?.tokenAmount?.amount;
      if (amt) raw += BigInt(amt);
    }
    if (raw <= 0n) throw new Error("No balance to sell");
    const amount = (raw * BigInt(Math.round(sellPct))) / 100n;
    if (amount <= 0n) throw new Error("Sell amount too small");
    const q = await jupQuote(selectedMint, SOL_MINT, amount.toString(), slippageBps);
    return jupSwapTransaction(q, tradePk.toBase58());
  }, [tradePk, selectedMint, swapMode, buyAmt, sellPct, slippage, connection]);

  /** Build + sign trade — Phantom/Jupiter when connected mode; local keypair when local mode. */
  const handleSwap = useCallback(async () => {
    if (!selectedMint) return;
    setTradeErr("");
    setTradeSig("");
    if (!tradeReady || !tradePk) {
      if (localActive) {
        setTradeErr("Import a trading wallet and set a default — or switch to Connected wallet");
        return;
      }
      setShowWalletPicker(true);
      return;
    }
    if (!localActive && !sendTransaction && !signTransaction) {
      setTradeErr("This wallet can't sign here — reconnect Phantom or Jupiter");
      return;
    }
    if (swapMode === "buy") {
      const n = Number(buyAmt);
      if (!Number.isFinite(n) || n <= 0) {
        setTradeErr("Enter a valid SOL amount");
        return;
      }
    }
    setTradeBusy(true);
    try {
      setTradeStage("Building transaction…");
      const amount = swapMode === "buy" ? Number(buyAmt) : `${sellPct}%`;
      let txB64 = "";
      let skipPreflight = true;
      let warning = "";

      try {
        const r = await fetch("/api/ogdex/trade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            publicKey: tradePk.toBase58(),
            action: swapMode,
            mint: selectedMint,
            amount,
            denominatedInSol: swapMode === "buy" ? "true" : "false",
            slippage,
            priorityFee: 0.0003,
            pool: "auto",
          }),
        });
        const d = await r.json().catch(() => ({}));
        if (d?.ok && d?.tx) {
          txB64 = d.tx;
          // Prefer opening the wallet immediately; only tighten preflight when sim passed.
          skipPreflight = d.simulated !== true;
          if (typeof d.warning === "string") warning = d.warning;
        } else {
          throw new Error(d?.error || "Could not build transaction");
        }
      } catch (apiErr: any) {
        // In-app Jupiter quote/swap API fallback — never open jup.ag website.
        setTradeStage("Building via Jupiter…");
        try {
          txB64 = await buildJupiterTx();
          skipPreflight = true;
        } catch (jupErr: any) {
          const apiMsg = String(apiErr?.message || apiErr || "");
          const jupMsg = String(jupErr?.message || jupErr || "");
          throw new Error(
            jupMsg && jupMsg !== apiMsg
              ? `${apiMsg || "Trade API failed"}; Jupiter quote failed: ${jupMsg}`
              : apiMsg || jupMsg || "Could not build transaction",
          );
        }
      }

      const bytes = Uint8Array.from(atob(txB64), (c) => c.charCodeAt(0));
      const tx = VersionedTransaction.deserialize(bytes);
      setTradeStage(localActive ? "Signing locally…" : "Confirm in wallet…");
      const sig = await sendActiveTx(connection, tx, { skipPreflight, maxRetries: 3 });
      setTradeStage("Confirming on-chain…");
      await connection.confirmTransaction(sig, "confirmed");
      setTradeSig(sig);
      toast({
        title: "Trade confirmed",
        description: warning ? `${sig.slice(0, 8)}… · ${warning}` : `${sig.slice(0, 8)}…`,
      });
      if (tradePk) {
        try {
          const assets = await getAssets(tradePk.toString());
          setPositions(
            (assets.items || []).filter(
              (a: TokenAsset) => a.interface === "FungibleToken" || a.interface === "FungibleAsset",
            ),
          );
        } catch {
          /* ignore */
        }
      }
    } catch (e: any) {
      const m = String(e?.message || e || "Trade failed");
      const friendly = /reject|cancel/i.test(m) ? "Cancelled in wallet" : m;
      setTradeErr(friendly);
      if (!/reject|cancel/i.test(m)) {
        toast({ title: "Trade failed", description: friendly, variant: "destructive" });
      }
    } finally {
      setTradeBusy(false);
      setTradeStage("");
    }
  }, [
    selectedMint,
    tradeReady,
    tradePk,
    localActive,
    sendActiveTx,
    swapMode,
    buyAmt,
    sellPct,
    slippage,
    sendTransaction,
    signTransaction,
    connection,
    buildJupiterTx,
  ]);

  const selectSearchResult = useCallback(
    (token: JupTokenInfo) => {
      const mint = (token as any).address || token.id;
      setTokens((prev) => {
        if (prev.some((t) => t.mint === mint)) return prev;
        return [
          {
            mint, symbol: token.symbol || "???", name: token.name || "",
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

  /* ── Derived ────────────────────────────────────────────── */
  const t = selectedToken;
  const chartRef = t?.pairAddress || selectedMint;
  const dexChartSrc = chartRef
    ? dexScreenerEmbedUrl(chartRef, TIMEFRAME_CONFIG[timeframe].dexInterval)
    : "";
  const marketSubTabs = TABS_BY_CATEGORY[marketCategory];
  const curPrice = t?.price || 0;

  const refreshMintAlerts = useCallback(async () => {
    if (!publicKey || !signMessage || !selectedMint) {
      setMintAlerts([]);
      return;
    }
    try {
      const d = await fetchAlerts(publicKey.toBase58(), signMessage);
      const list = Array.isArray(d?.alerts) ? d.alerts : [];
      setMintAlerts(list.filter((a: any) => a.mint === selectedMint));
    } catch {
      /* ignore */
    }
  }, [publicKey, signMessage, selectedMint]);

  useEffect(() => {
    if (orderMode !== "market") void refreshMintAlerts();
  }, [orderMode, refreshMintAlerts]);

  useEffect(() => {
    if (!curPrice || alertPrice) return;
    if (orderMode === "market") return;
    setAlertPrice(
      curPrice < 0.01 ? curPrice.toPrecision(4) : curPrice.toFixed(curPrice < 1 ? 6 : 4),
    );
  }, [orderMode, curPrice]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreateAlert = useCallback(async () => {
    setAlertMsg(null);
    if (!connected || !publicKey || !signMessage) {
      setShowWalletPicker(true);
      return;
    }
    if (orderMode === "market") return;
    const v = Number(alertPrice);
    if (!Number.isFinite(v) || v <= 0) {
      setAlertMsg({ ok: false, text: "Enter a target price in USD" });
      return;
    }
    const tgt = alertTarget.trim();
    if (alertChan === "telegram" ? !/^(-?\d{4,}|@[A-Za-z0-9_]{4,})$/.test(tgt) : !/^https?:\/\//i.test(tgt)) {
      setAlertMsg({
        ok: false,
        text: alertChan === "telegram" ? "Enter Telegram chat ID or @channel" : "Enter https:// webhook URL",
      });
      return;
    }
    setAlertBusy(true);
    try {
      localStorage.setItem("ogdex.alertChan", alertChan);
      localStorage.setItem("ogdex.alertTarget", tgt);
      const d = await createPriceAlert({
        wallet: publicKey.toBase58(),
        signMessage,
        mint: selectedMint,
        symbol: t?.symbol,
        kind: orderMode,
        valueUsd: v,
        channel: alertChan,
        target: tgt,
      });
      if (!d?.ok) throw new Error(d?.error || "Could not create alert");
      setAlertMsg({ ok: true, text: `${ALERT_KINDS[orderMode].label} set at $${v}` });
      toast({ title: "Alert created", description: `${ALERT_KINDS[orderMode].label} @ $${v}` });
      void refreshMintAlerts();
    } catch (e: any) {
      const m = String(e?.message || e || "Failed");
      setAlertMsg({ ok: false, text: /reject|cancel/i.test(m) ? "Sign cancelled in Phantom" : m });
    } finally {
      setAlertBusy(false);
    }
  }, [
    connected,
    publicKey,
    signMessage,
    orderMode,
    alertPrice,
    alertTarget,
    alertChan,
    selectedMint,
    t?.symbol,
    refreshMintAlerts,
  ]);

  // IMPORTANT: render as a function call ({renderSwapPanel()}), NOT <SwapPanel />.
  // Defining a component inside this parent recreates its type every render and
  // remounts all inputs (focus lost after one keystroke) — worse with livePos polls.
  const renderSwapPanel = () => (
    <div className="space-y-3 border-b border-white/[0.07] p-4">
      {/* Order type */}
      <div className="grid grid-cols-4 gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
        {(
          [
            ["market", "Market"],
            ["limit", "Limit"],
            ["tp", "TP"],
            ["stop", "Stop"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setOrderMode(id);
              setAlertMsg(null);
              if (id !== "market" && curPrice && !alertPrice) {
                setAlertPrice(
                  curPrice < 0.01 ? curPrice.toPrecision(4) : curPrice.toFixed(curPrice < 1 ? 6 : 4),
                );
              }
              if (id === "limit") setSwapMode("buy");
              if (id === "tp" || id === "stop") setSwapMode("sell");
            }}
            className={`rounded-lg py-2 text-[11px] font-bold transition-colors ${
              orderMode === id ? "bg-white text-black" : "text-white/40 hover:text-white/70"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {orderMode === "market" ? (
        <>
          <div className="flex overflow-hidden rounded-lg border border-white/[0.07]">
            <button
              type="button"
              onClick={() => setSwapMode("buy")}
              className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                swapMode === "buy"
                  ? "border-b-2 border-green-400 bg-green-500/20 text-green-400"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              Buy
            </button>
            <button
              type="button"
              onClick={() => setSwapMode("sell")}
              className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                swapMode === "sell"
                  ? "border-b-2 border-red-400 bg-red-500/20 text-red-400"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              Sell
            </button>
          </div>

          {swapMode === "buy" ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] uppercase tracking-wide text-white/35">Amount (SOL)</label>
                <button
                  type="button"
                  onClick={() => {
                    setPresetDraft(buyPresets.join(", "));
                    setEditPresetsOpen((v) => !v);
                  }}
                  className="text-[10px] font-semibold text-white/40 underline hover:text-white/70"
                >
                  {editPresetsOpen ? "Close" : "Edit presets"}
                </button>
              </div>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={buyAmt}
                onChange={(e) => setBuyAmt(e.target.value)}
                className="h-11 border-white/[0.1] bg-white/[0.05] font-mono text-base font-semibold"
                placeholder="0.25"
              />
              <div className="grid grid-cols-4 gap-2">
                {buyPresets.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setBuyAmt(String(p))}
                    className={`rounded-xl border py-2.5 font-mono text-[12px] font-bold transition-colors ${
                      buyAmt === String(p)
                        ? "border-white bg-white text-black"
                        : "border-white/10 bg-white/[0.04] text-white/70 hover:border-white/25 hover:text-white"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              {editPresetsOpen && (
                <div className="rounded-xl border border-white/10 bg-black/50 p-2.5 space-y-2">
                  <p className="text-[10px] text-white/40">Comma-separated SOL amounts (2–6)</p>
                  <Input
                    value={presetDraft}
                    onChange={(e) => setPresetDraft(e.target.value)}
                    placeholder="0.05, 0.1, 0.25, 0.5, 1"
                    className="h-9 border-white/10 bg-white/[0.04] font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const nums = presetDraft
                        .split(/[,\s]+/)
                        .map((s) => Number(s.trim()))
                        .filter((n) => Number.isFinite(n) && n > 0);
                      if (nums.length < 2) {
                        toast({ title: "Need at least 2 amounts", variant: "destructive" });
                        return;
                      }
                      saveBuyPresets(nums);
                      setBuyPresets(getBuyPresets());
                      setEditPresetsOpen(false);
                      toast({ title: "Buy presets saved" });
                    }}
                    className="h-9 w-full rounded-lg bg-white text-xs font-bold text-black"
                  >
                    Save presets
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-wide text-white/35">Sell %</label>
              <div className="grid grid-cols-4 gap-2">
                {sellPresets.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setSellPct(p)}
                    className={`rounded-xl border py-2.5 font-mono text-[12px] font-bold transition-colors ${
                      sellPct === p
                        ? "border-red-400 bg-red-500/20 text-red-300"
                        : "border-white/10 bg-white/[0.04] text-white/70 hover:border-white/25"
                    }`}
                  >
                    {p}%
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <label className="shrink-0 text-[10px] uppercase tracking-wide text-white/35">Slippage</label>
            <Input
              type="number"
              min="0.1"
              max="50"
              step="0.5"
              value={slippage}
              onChange={(e) => setSlippage(Number(e.target.value) || 10)}
              className="h-8 w-20 border-white/[0.07] bg-white/[0.04] font-mono text-xs"
            />
            <span className="text-[10px] text-white/30">%</span>
          </div>

          {/* Active trading identity — Local default keypair vs Phantom */}
          <ActiveTradingWalletChip />

          {/* Your position — always visible above Buy/Sell */}
          <div className="rounded-xl border border-white/15 bg-gradient-to-b from-white/[0.08] to-transparent px-3 py-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/50">
                Your position
              </p>
              {tradeReady ? (
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400/90">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  </span>
                  Live
                  {livePosLoading && !livePos ? "…" : ""}
                </span>
              ) : (
                <span className="text-[10px] text-white/35">
                  {localActive ? "Import local wallet" : "Connect to track"}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              <div>
                <p className="text-[9px] uppercase tracking-wider text-white/30">Holding</p>
                <p className="font-mono text-[13px] font-bold tabular-nums">
                  {tradeReady
                    ? livePos
                      ? fmtTok(livePos.amount)
                      : livePosLoading
                        ? "…"
                        : "0"
                    : "—"}
                  <span className="ml-1 text-[10px] font-medium text-white/35">
                    {t?.symbol || ""}
                  </span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-[9px] uppercase tracking-wider text-white/30">Worth</p>
                <p className="font-mono text-[13px] font-bold tabular-nums">
                  {tradeReady
                    ? livePos
                      ? livePos.worthUsd != null
                        ? fmtUsd(livePos.worthUsd)
                        : "—"
                      : livePosLoading
                        ? "…"
                        : "$0"
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wider text-white/30">Unrealized</p>
                <p
                  className={`font-mono text-[12px] font-semibold tabular-nums ${
                    !tradeReady || livePos?.unrealizedUsd == null
                      ? "text-white/40"
                      : livePos.unrealizedUsd >= 0
                        ? "text-emerald-400"
                        : "text-red-400"
                  }`}
                >
                  {tradeReady && livePos?.unrealizedUsd != null ? (
                    <>
                      {fmtPnl(livePos.unrealizedUsd)}
                      {livePos.unrealizedPct != null ? (
                        <span className="ml-1 text-[10px] opacity-80">
                          ({fmtPct(livePos.unrealizedPct)})
                        </span>
                      ) : null}
                    </>
                  ) : (
                    "—"
                  )}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[9px] uppercase tracking-wider text-white/30">
                  {livePos?.boughtUsd != null ? "Bought" : "Cost basis"}
                </p>
                <p className="font-mono text-[12px] font-semibold tabular-nums text-white/70">
                  {tradeReady
                    ? livePos?.boughtUsd != null
                      ? fmtUsd(livePos.boughtUsd)
                      : livePos?.costUsd != null
                        ? fmtUsd(livePos.costUsd)
                        : livePos?.avgCostUsd != null
                          ? `${fmtUsd(livePos.avgCostUsd)}/tok`
                          : "—"
                    : "—"}
                </p>
              </div>
            </div>
            {!tradeReady ? (
              localActive ? (
                <Link
                  to="/trade/wallets"
                  className="mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.06] text-[11px] font-bold text-white/85 hover:bg-white/10"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  Import trading wallet
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowWalletPicker(true)}
                  className="mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.06] text-[11px] font-bold text-white/85 hover:bg-white/10"
                >
                  <Wallet className="h-3.5 w-3.5" />
                  Connect Phantom / Jupiter
                </button>
              )
            ) : null}
          </div>

          <Button
            type="button"
            onClick={() => void handleSwap()}
            disabled={tradeBusy || !selectedMint}
            className={`h-12 w-full rounded-xl text-sm font-semibold disabled:opacity-60 ${
              swapMode === "buy"
                ? "bg-green-500 text-black hover:bg-green-600"
                : "bg-red-500 text-white hover:bg-red-600"
            }`}
          >
            {tradeBusy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {tradeStage || "Working…"}
              </>
            ) : !tradeReady ? (
              localActive ? (
                <>
                  <KeyRound className="mr-2 h-4 w-4" />
                  Set local wallet
                </>
              ) : (
                <>
                  <Wallet className="mr-2 h-4 w-4" />
                  Connect Phantom
                </>
              )
            ) : swapMode === "buy" ? (
              <>
                <ArrowDownLeft className="mr-2 h-4 w-4" />
                Buy {t?.symbol || "token"}
              </>
            ) : (
              <>
                <ArrowUpRight className="mr-2 h-4 w-4" />
                Sell {sellPct}% {t?.symbol || "token"}
              </>
            )}
          </Button>

          {tradeErr && <p className="text-center text-[11px] text-red-400">{tradeErr}</p>}
          {tradeSig && (
            <a
              href={`https://solscan.io/tx/${tradeSig}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1 text-[11px] text-white hover:underline"
            >
              Confirmed {tradeSig.slice(0, 8)}… <ExternalLink className="h-3 w-3" />
            </a>
          )}
          <p className="text-center text-[10px] text-white/25">
            {localActive ? "Market · signs with local default wallet" : "Market · confirm in connected wallet"}
          </p>
        </>
      ) : (
        <>
          <p className="text-[11px] leading-relaxed text-white/45">{ALERT_KINDS[orderMode].help}</p>
          <div>
            <label className="text-[10px] uppercase tracking-wide text-white/35">Target price (USD)</label>
            <Input
              value={alertPrice}
              onChange={(e) => setAlertPrice(e.target.value.replace(/[^0-9.]/g, ""))}
              className="mt-1 h-10 border-white/10 bg-white/[0.04] font-mono text-sm"
              placeholder="0.0"
              inputMode="decimal"
            />
            {curPrice > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <span className="text-[10px] text-white/30">
                  Now ${curPrice < 0.01 ? curPrice.toPrecision(4) : curPrice.toFixed(curPrice < 1 ? 6 : 4)}
                </span>
                {(orderMode === "limit" || orderMode === "stop"
                  ? [-5, -10, -20]
                  : [5, 10, 25]
                ).map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => {
                      const p = curPrice * (1 + pct / 100);
                      setAlertPrice(p < 0.01 ? p.toPrecision(4) : p.toFixed(p < 1 ? 6 : 4));
                    }}
                    className="rounded border border-white/10 px-2 py-0.5 font-mono text-[10px] text-white/45 hover:text-white"
                  >
                    {pct > 0 ? "+" : ""}
                    {pct}%
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-1">
            <button
              type="button"
              onClick={() => setAlertChan("telegram")}
              className={`rounded-md py-2 text-[11px] font-semibold ${
                alertChan === "telegram" ? "bg-white text-black" : "text-white/40"
              }`}
            >
              Telegram
            </button>
            <button
              type="button"
              onClick={() => setAlertChan("webhook")}
              className={`rounded-md py-2 text-[11px] font-semibold ${
                alertChan === "webhook" ? "bg-white text-black" : "text-white/40"
              }`}
            >
              Webhook
            </button>
          </div>
          <Input
            value={alertTarget}
            onChange={(e) => setAlertTarget(e.target.value)}
            placeholder={alertChan === "telegram" ? "Telegram chat ID or @channel" : "https://discord/webhook…"}
            className="h-10 border-white/10 bg-white/[0.04] text-sm"
          />

          <Button
            type="button"
            onClick={() => void handleCreateAlert()}
            disabled={alertBusy || !selectedMint}
            className="h-12 w-full rounded-xl bg-white text-sm font-bold text-black hover:bg-white/90 disabled:opacity-60"
          >
            {alertBusy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sign to save…
              </>
            ) : !connected ? (
              <>
                <Wallet className="mr-2 h-4 w-4" />
                Connect Phantom
              </>
            ) : (
              <>
                <Bell className="mr-2 h-4 w-4" />
                Set {ALERT_KINDS[orderMode].label}
              </>
            )}
          </Button>

          {alertMsg && (
            <p className={`text-center text-[11px] ${alertMsg.ok ? "text-green-400" : "text-red-400"}`}>
              {alertMsg.text}
            </p>
          )}
          <p className="text-center text-[10px] leading-relaxed text-white/25">
            Notify-only · Phantom must sign the alert · you still place the trade when it fires
          </p>

          {mintAlerts.length > 0 && (
            <div className="space-y-1.5 rounded-xl border border-white/10 bg-black/40 p-2">
              <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-white/35">
                Active on this coin
              </p>
              {mintAlerts.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-lg bg-white/[0.04] px-2.5 py-2 text-[11px]"
                >
                  <div>
                    <p className="font-semibold text-white/80">
                      {a.type === "price_above" ? "Above" : "Below"} ${a.value}
                    </p>
                    <p className="text-[10px] text-white/30">{a.channel}</p>
                  </div>
                  <button
                    type="button"
                    className="text-white/35 hover:text-red-400"
                    onClick={() => {
                      if (!publicKey || !signMessage) return;
                      void removeAlert(publicKey.toBase58(), signMessage, a.id).then(() =>
                        refreshMintAlerts(),
                      );
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );

  /* ═══════════════════════════════════════════════════════════════
     Wallet Picker Overlay
     ═══════════════════════════════════════════════════════════════ */
  // Same as swap panel — call as {renderWalletPickerOverlay()}, never as a JSX tag.
  const renderWalletPickerOverlay = () => {
    if (!showWalletPicker) return null;
    // Prefer Installed/Loadable. Still list known wallets when NotDetected so the
    // user gets an install toast — never auto-open adapter.url / jup.ag.
    const known = ["Phantom", "Jupiter", "Solflare"] as const;
    const available = wallets.filter((w) => {
      if (!known.includes(w.adapter.name as (typeof known)[number])) return false;
      const rs = String(w.readyState);
      return rs === "Installed" || rs === "Loadable";
    });
    const connectOne = async (name: string) => {
      setWalletMode("connected");
      setShowWalletPicker(false);
      try {
        await connectSolanaWallet({
          wallets,
          select,
          connect,
          preferredName: name,
        });
        toast({ title: "Wallet connected", description: name });
      } catch (err) {
        toast({
          title: "Could not connect",
          description: String((err as Error)?.message || err || phantomInstallHint(name)),
          variant: "destructive",
        });
      }
    };
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={() => setShowWalletPicker(false)}>
        <div className="bg-[#111111] border border-white/[0.1] rounded-2xl p-6 w-[340px] max-w-[90vw] space-y-4"
          onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">Connect Wallet</h3>
            <button type="button" onClick={() => setShowWalletPicker(false)} className="text-white/30 hover:text-white/60">
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="text-xs text-white/40">Select a wallet to connect to OrbitX. Trades sign in-app — we never open jup.ag.</p>
          <div className="space-y-2">
            {available.map((w) => (
              <button
                key={w.adapter.name}
                type="button"
                onClick={() => void connectOne(w.adapter.name)}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.1] hover:border-[#ffffff]/40 transition-all group"
              >
                {w.adapter.icon && <img src={w.adapter.icon} alt={w.adapter.name} className="w-8 h-8 rounded-lg" />}
                <span className="font-semibold text-sm">{w.adapter.name}</span>
                <span className="ml-auto text-[10px] text-white/30 group-hover:text-[#ffffff] transition-colors">
                  Connect →
                </span>
              </button>
            ))}
            {available.length === 0 && (
              <div className="text-center py-6 space-y-3">
                <Wallet className="h-8 w-8 text-white/15 mx-auto mb-2" />
                <p className="text-sm text-white/40">No wallet extension detected</p>
                <p className="text-[11px] text-white/30 px-2">
                  Install Phantom (or Solflare), then refresh this page. OrbitX will not redirect you to swap sites.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    toast({
                      title: "Phantom not detected",
                      description: phantomInstallHint("Phantom"),
                      variant: "destructive",
                    });
                  }}
                  className="w-full rounded-xl bg-white px-4 py-3 text-sm font-bold text-black"
                >
                  Connect Phantom
                </button>
              </div>
            )}
          </div>
          <p className="text-[10px] text-white/20 text-center">Your keys never leave your wallet.</p>
        </div>
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */

  return (
    <>
    {renderWalletPickerOverlay()}
    <div className={`flex h-full min-h-0 bg-black ${deskMode ? "flex-col overflow-y-auto overscroll-contain lg:flex-row lg:overflow-hidden" : "min-h-[calc(100vh-68px)] flex-col overflow-y-auto lg:min-h-0 lg:flex-row lg:overflow-hidden"}`}>

      {/* ═══════════════ LEFT SIDEBAR (hidden in desk mode) ═══════════════ */}
      <aside className={`${deskMode ? "hidden" : "hidden lg:flex"} flex-col w-[300px] min-w-[300px] border-r border-white/10 bg-[#050505]`}>
        {/* Category + market tabs (full DEX universe) */}
        <div className="border-b border-white/10">
          <div className="flex overflow-x-auto scrollbar-none">
            {MARKET_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setMarketCategory(cat.id);
                  setMarketTab(DEFAULT_TAB[cat.id]);
                }}
                className={`shrink-0 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                  marketCategory === cat.id
                    ? "text-white border-b-2 border-white"
                    : "text-white/35 hover:text-white/60"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
          <div className="flex overflow-x-auto scrollbar-none bg-black/40">
            {marketSubTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMarketTab(tab.id)}
                className={`shrink-0 px-2.5 py-2 text-[10px] font-medium transition-colors ${
                  marketTab === tab.id
                    ? "text-white border-b border-white"
                    : "text-white/40 hover:text-white/65"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {marketTab !== "positions" && (
            <p className="px-3 py-1 text-[9px] text-white/25 font-mono">
              {loadingTokens ? "Loading…" : `${tokens.length} tokens`}
            </p>
          )}
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
          <div className="border-b border-white/[0.07] bg-[#0a0a0a] max-h-[300px] overflow-y-auto">
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
          ) : marketTab !== "positions" ? (
            tokens.map((token) => (
              <button
                key={token.mint}
                onClick={() => selectToken(token.mint)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 transition-colors text-left ${
                  selectedMint === token.mint
                    ? "bg-white/10 border-l-2 border-white"
                    : "hover:bg-white/[0.04] border-l-2 border-transparent"
                }`}
              >
                {token.image ? (
                  <img src={token.image} alt="" className="w-7 h-7 rounded-full shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center text-[10px] font-bold shrink-0">
                    {token.symbol.slice(0, 2)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-semibold truncate">{token.symbol}</p>
                    {token.volume24h > 0 && (
                      <span className="text-[9px] text-white/25 font-mono shrink-0">{fmtMcap(token.volume24h)}</span>
                    )}
                  </div>
                  <p className="text-[10px] text-white/30 truncate">{token.name}</p>
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
          ) : (
            tradeReady && positions.length > 0 ? (
              positions.slice(0, 30).map((pos) => {
                const sym = pos.content?.metadata?.symbol || "???";
                const img = pos.content?.links?.image;
                const val = pos.token_info?.price_info?.total_price || 0;
                return (
                  <button
                    key={pos.id}
                    onClick={() => selectToken(pos.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-white/[0.04] transition-colors text-left ${
                      selectedMint === pos.id ? "bg-white/10 border-l-2 border-white" : "border-l-2 border-transparent"
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
                <p className="text-xs text-white/40">
                  {tradeReady
                    ? "No token positions"
                    : localActive
                      ? "Set a local trading wallet to view positions"
                      : "Connect wallet to view positions"}
                </p>
                {!tradeReady && !localActive && (
                  <Button size="sm" onClick={() => setShowWalletPicker(true)} className="mt-3 bg-white text-black text-xs">
                    Connect
                  </Button>
                )}
                {!tradeReady && localActive && (
                  <Link to="/trade/wallets">
                    <Button size="sm" className="mt-3 bg-white text-black text-xs">
                      Manage wallets
                    </Button>
                  </Link>
                )}
              </div>
            )
          )}
        </ScrollArea>
      </aside>

      {/* ═══════════════ CENTER PANEL ═══════════════ */}
      <div className={`flex min-w-0 flex-col ${deskMode ? "min-h-[85vh] lg:min-h-0 lg:flex-1 lg:overflow-hidden" : "min-h-0 flex-1 overflow-hidden"}`}>

        {/* Mobile market browser — only in full mode */}
        {!deskMode && (
        <div className="lg:hidden border-b border-white/10 bg-[#050505]">
          <div className="p-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/25" />
              <Input
                placeholder="Search token…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs bg-white/[0.04] border-white/10 rounded-lg"
              />
            </div>
            {searchResults.length > 0 && (
              <div className="mt-1 bg-[#0a0a0a] rounded-lg border border-white/[0.07] max-h-[200px] overflow-y-auto">
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
        </div>
        )}

        {/* Token header */}
        {t && (
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.07] bg-[#050505]/80 flex-wrap">
            {deskMode && (
              <a
                href={`/trade/token/${selectedMint}`}
                className="mr-1 rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-medium text-white/50 hover:text-white"
              >
                ← Coin
              </a>
            )}
            {t.image ? (
              <img src={t.image} alt="" className="w-9 h-9 rounded-full ring-2 ring-white/[0.08]" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#ffffff] to-[#404040] flex items-center justify-center text-xs font-bold ring-2 ring-white/[0.08]">
                {t.symbol.slice(0, 2)}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold">{t.symbol}</h2>
                <span className="text-[11px] text-white/30 hidden sm:inline">{t.name}</span>
                <button onClick={copyMint} className="text-white/25 hover:text-white/50 transition-colors">
                  {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
                <a href={`https://solscan.io/token/${selectedMint}`} target="_blank" rel="noopener noreferrer"
                  className="text-white/25 hover:text-white/50 transition-colors" title="Solscan">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <a
                  href={`https://dexscreener.com/solana/${t.pairAddress || selectedMint}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-white/35 hover:text-white transition-colors font-medium"
                >
                  DX
                </a>
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-sm font-bold font-mono">{fmtPrice(t.price)}</span>
                <span className={`text-xs font-semibold font-mono ${t.change24h >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {fmtPct(t.change24h)}
                </span>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <span className="text-[10px] text-white/30">MCap</span>
                <p className="text-sm font-semibold font-mono">{fmtMcap(t.mcap)}</p>
              </div>
              <div className="text-right hidden sm:block">
                <span className="text-[10px] text-white/30">24h Vol</span>
                <p className="text-sm font-semibold font-mono">{fmtMcap(t.volume24h)}</p>
              </div>
              <div className="text-right hidden md:block">
                <span className="text-[10px] text-white/30">Liq</span>
                <p className="text-sm font-semibold font-mono text-[#ffffff]">{fmtMcap(t.liquidity)}</p>
              </div>
              {/* Wallet status — active trading identity */}
              {tradeReady && tradePk ? (
                localActive ? (
                  <Link
                    to="/trade/wallets"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.07] hover:bg-white/[0.08] transition-colors"
                  >
                    <div className="w-2 h-2 rounded-full bg-green-400" />
                    <span className="text-[11px] text-white/60 font-mono">
                      Local {shortAddr(tradePk.toBase58(), 4)}
                    </span>
                  </Link>
                ) : (
                  <button
                    onClick={() => disconnect()}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.07] hover:bg-white/[0.08] transition-colors"
                  >
                    <div className="w-2 h-2 rounded-full bg-green-400" />
                    <span className="text-[11px] text-white/60 font-mono">
                      {shortAddr(tradePk.toBase58(), 4)}
                    </span>
                  </button>
                )
              ) : localActive ? (
                <Link to="/trade/wallets">
                  <Button size="sm" className="bg-[#ffffff] hover:bg-[#e5e5e5] text-black text-xs font-semibold rounded-lg">
                    <KeyRound className="h-3.5 w-3.5 mr-1.5" />
                    Set local
                  </Button>
                </Link>
              ) : (
                <Button size="sm" onClick={() => setShowWalletPicker(true)}
                  className="bg-[#ffffff] hover:bg-[#e5e5e5] text-black text-xs font-semibold rounded-lg">
                  <Wallet className="h-3.5 w-3.5 mr-1.5" />
                  Connect
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Chart controls — DexScreener embed */}
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-white/10 bg-black">
          {(Object.keys(TIMEFRAME_CONFIG) as Timeframe[]).map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => { setTimeframe(tf); setChartReady(false); }}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                timeframe === tf
                  ? "bg-white text-black"
                  : "text-white/35 hover:text-white/60 hover:bg-white/[0.04]"
              }`}
            >
              {TIMEFRAME_CONFIG[tf].label}
            </button>
          ))}
          <div className="flex-1" />
          {chartRef && (
            <a
              href={`https://dexscreener.com/solana/${chartRef}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-white/35 hover:text-white transition-colors"
            >
              DexScreener <ExternalLink className="h-3 w-3" />
            </a>
          )}
          <button
            type="button"
            onClick={() => {
              setMountChart(false);
              setChartReady(false);
              window.setTimeout(() => setMountChart(true), 50);
            }}
            className="text-white/25 hover:text-white/50 transition-colors p-1"
            title="Reload chart"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* DexScreener chart — delayed mount so swap UI paints first */}
        <div className="relative min-h-[180px] flex-1 bg-black lg:min-h-[240px]">
          {(!mountChart || !chartReady) && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black">
              <Loader2 className="h-6 w-6 animate-spin text-white/30" />
              <p className="text-[11px] text-white/30">Loading chart…</p>
            </div>
          )}
          {mountChart && dexChartSrc ? (
            <iframe
              key={`${chartRef}-${timeframe}`}
              title="DexScreener chart"
              src={dexChartSrc}
              className="absolute inset-0 h-full w-full border-0"
              style={{ colorScheme: "dark" }}
              allow="clipboard-write"
              onLoad={() => setChartReady(true)}
            />
          ) : !dexChartSrc ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-white/30">
              Select a token to load chart
            </div>
          ) : null}
        </div>

        {/* Bottom tabs: Trades / My Trades / Positions / Top Traders */}
        <div className="flex h-[240px] shrink-0 flex-col border-t border-white/10 bg-[#050505] sm:h-[260px]">
          <div className="flex shrink-0 overflow-x-auto border-b border-white/10">
            {BOTTOM_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setBottomTab(tab)}
                className={`shrink-0 px-3 py-2.5 text-xs font-medium transition-colors sm:px-4 ${
                  bottomTab === tab
                    ? "border-b-2 border-white text-white"
                    : "text-white/35 hover:text-white/60"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {bottomTab === "Trades" && (
              <>
                <div className="sticky top-0 grid grid-cols-6 gap-2 border-b border-white/[0.05] bg-[#050505] px-3 py-1.5 text-[10px] font-medium text-white/25">
                  <span>Time</span><span>Type</span><span>Price</span><span>Amount</span><span>Value</span><span>Wallet</span>
                </div>
                {trades.length === 0 ? (
                  <div className="flex items-center justify-center py-8 text-xs text-white/20">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading trades…
                  </div>
                ) : (
                  trades.map((trade, i) => (
                    <div
                      key={trade.txHash + i}
                      className="grid grid-cols-6 items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-white/[0.03]"
                    >
                      <span className="font-mono text-white/40">{fmtAgo(trade.time)}</span>
                      <span className={`font-semibold ${trade.side === "buy" ? "text-green-400" : "text-red-400"}`}>
                        {trade.side === "buy" ? "Buy" : "Sell"}
                      </span>
                      <span className="font-mono text-white/60">{fmtPrice(trade.priceUsd)}</span>
                      <span className="font-mono text-white/50">{fmtNum(trade.amount)}</span>
                      <span className="font-mono text-white/50">${fmtNum(trade.value)}</span>
                      <a
                        href={`/trade/wallet/${trade.wallet}`}
                        className="truncate font-mono text-white/30 hover:text-white"
                      >
                        {shortAddr(trade.wallet, 4)}
                      </a>
                    </div>
                  ))
                )}
              </>
            )}

            {bottomTab === "My Trades" && (
              !tradeReady ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Activity className="mb-2 h-6 w-6 text-white/15" />
                  <p className="text-xs text-white/30">
                    {localActive ? "Import a local wallet to see trades" : "Connect wallet to see your trades"}
                  </p>
                  {localActive ? (
                    <Link to="/trade/wallets" className="mt-3 inline-flex h-8 items-center rounded-lg bg-white px-3 text-xs font-semibold text-black">
                      Manage wallets
                    </Link>
                  ) : (
                    <Button size="sm" type="button" onClick={() => setShowWalletPicker(true)} className="mt-3 bg-white text-xs text-black">
                      Connect
                    </Button>
                  )}
                </div>
              ) : myTradesLoading ? (
                <div className="flex items-center justify-center py-8 text-xs text-white/30">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading your swaps…
                </div>
              ) : myTrades.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <p className="text-xs text-white/30">No recent swaps found for this wallet</p>
                </div>
              ) : (
                myTrades.map((tr: any, i: number) => (
                  <a
                    key={tr.txHash || i}
                    href={tr.mint ? `/trade/token/${tr.mint}` : `https://solscan.io/tx/${tr.txHash}`}
                    className="flex items-center justify-between border-b border-white/[0.05] px-3 py-2.5 hover:bg-white/[0.04]"
                  >
                    <div>
                      <p className={`text-xs font-bold ${tr.side === "buy" ? "text-green-400" : "text-red-400"}`}>
                        {(tr.side || "swap").toUpperCase()} {tr.symbol || shortAddr(tr.mint || "", 4)}
                      </p>
                      <p className="font-mono text-[10px] text-white/30">
                        {tr.solAmount != null ? `${Number(tr.solAmount).toFixed(3)} SOL` : ""}
                      </p>
                    </div>
                    <p className="font-mono text-xs text-white/70">
                      {tr.usd != null ? `$${Number(tr.usd).toFixed(2)}` : "—"}
                    </p>
                  </a>
                ))
              )
            )}

            {bottomTab === "Positions" && (
              tradeReady && positions.length > 0 ? (
                <>
                  <div className="sticky top-0 grid grid-cols-4 gap-2 border-b border-white/[0.05] bg-[#050505] px-3 py-1.5 text-[10px] font-medium text-white/25">
                    <span>Token</span><span>Balance</span><span>Price</span><span>Value</span>
                  </div>
                  {positions.slice(0, 40).map((pos) => {
                    const sym = pos.content?.metadata?.symbol || "???";
                    const bal = (pos.token_info?.balance || 0) / Math.pow(10, pos.token_info?.decimals || 0);
                    const price = pos.token_info?.price_info?.price_per_token || 0;
                    const val = pos.token_info?.price_info?.total_price || 0;
                    return (
                      <button
                        key={pos.id}
                        type="button"
                        onClick={() => selectToken(pos.id)}
                        className="grid w-full grid-cols-4 gap-2 px-3 py-2 text-left text-[11px] hover:bg-white/[0.04]"
                      >
                        <span className="truncate font-semibold">{sym}</span>
                        <span className="font-mono text-white/50">{fmtNum(bal)}</span>
                        <span className="font-mono text-white/50">{fmtPrice(price)}</span>
                        <span className="font-mono text-white/70">{val > 0 ? `$${val.toFixed(2)}` : "—"}</span>
                      </button>
                    );
                  })}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Wallet className="mb-2 h-6 w-6 text-white/15" />
                  <p className="text-xs text-white/30">
                    {tradeReady
                      ? "No positions found"
                      : localActive
                        ? "Set a local trading wallet to view positions"
                        : "Connect wallet to view positions"}
                  </p>
                  {!tradeReady && !localActive && (
                    <Button size="sm" type="button" onClick={() => setShowWalletPicker(true)} className="mt-3 bg-white text-xs text-black">
                      Connect
                    </Button>
                  )}
                  {!tradeReady && localActive && (
                    <Link to="/trade/wallets">
                      <Button size="sm" type="button" className="mt-3 bg-white text-xs text-black">
                        Manage wallets
                      </Button>
                    </Link>
                  )}
                </div>
              )
            )}

            {bottomTab === "Top Traders" && (
              topTradersLoading ? (
                <div className="flex items-center justify-center py-8 text-xs text-white/30">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading traders…
                </div>
              ) : topTraders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Users className="mb-2 h-6 w-6 text-white/15" />
                  <p className="text-xs text-white/30">No top trader data yet</p>
                </div>
              ) : (
                topTraders.slice(0, 40).map((tr: any, i: number) => {
                  const addr = tr.owner || tr.address;
                  const pnl = tr.netPnl ?? tr.realizedPnl ?? tr.pnlUsd;
                  return (
                    <a
                      key={addr || i}
                      href={`/trade/wallet/${addr}`}
                      className="flex items-center justify-between border-b border-white/[0.05] px-3 py-2.5 hover:bg-white/[0.04]"
                    >
                      <div>
                        <p className="font-mono text-xs">
                          #{tr.rank || i + 1} {shortAddr(addr || "", 5)}
                        </p>
                        <p className="text-[10px] text-white/30">
                          {tr.buys ?? 0}B / {tr.sells ?? 0}S
                        </p>
                      </div>
                      <p className={`font-mono text-xs ${(Number(pnl) || 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {pnl != null ? `${Number(pnl) < 0 ? "-" : ""}$${Math.abs(Number(pnl)).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}
                      </p>
                    </a>
                  );
                })
              )
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════ RIGHT SIDEBAR (Desktop) ═══════════════ */}
      <aside className="hidden lg:flex flex-col w-[320px] min-w-[320px] border-l border-white/[0.07] bg-[#050505]">
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

        {renderSwapPanel()}

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
      <div className="lg:hidden bg-[#050505] border-t border-white/[0.07]">
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

        {renderSwapPanel()}

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
    </>
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
