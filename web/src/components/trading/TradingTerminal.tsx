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

import { useState, useEffect, useCallback, useRef } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";
import {
  Search, Copy, ExternalLink, RefreshCw,
  ArrowUpRight, ArrowDownLeft, Check,
  Wallet, Activity, X, Loader2, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import {
  jupSearchToken,
  HELIUS_RPC,
  SOL_MINT,
  shortAddr,
  type JupTokenInfo,
} from "@/lib/og";
import {
  getAssets,
  type TokenAsset,
} from "@/lib/solana-api";
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

const BUY_PRESETS = [0.1, 0.25, 0.5, 1];
const SELL_PRESETS = [25, 50, 75, 100];

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

export const TradingTerminal = ({ initialMint, onMintChange, mode = "full" }: TradeTerminalProps = {}) => {
  const { publicKey, connected, wallets, select, connect, disconnect, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const deskMode = mode === "desk";

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
  const [swapMode, setSwapMode] = useState<"buy" | "sell">("buy");
  const [buyAmt, setBuyAmt] = useState("0.25");
  const [sellPct, setSellPct] = useState(50);
  const [slippage, setSlippage] = useState(10);
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

  /** Connect Phantom (or picker) then build + sign trade via /api/ogdex/trade */
  const handleSwap = useCallback(async () => {
    if (!selectedMint) return;
    setTradeErr("");
    setTradeSig("");
    if (!connected || !publicKey) {
      setShowWalletPicker(true);
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
      const r = await fetch("/api/ogdex/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicKey: publicKey.toBase58(),
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
      if (!r.ok || !d?.ok || !d?.tx) throw new Error(d?.error || "Could not build transaction");
      setTradeStage("Confirm in Phantom…");
      const bytes = Uint8Array.from(atob(d.tx), (c) => c.charCodeAt(0));
      const tx = VersionedTransaction.deserialize(bytes);
      const sig = await sendTransaction(tx, connection, { skipPreflight: false, maxRetries: 3 });
      setTradeStage("Confirming on-chain…");
      await connection.confirmTransaction(sig, "confirmed");
      setTradeSig(sig);
      toast({ title: "Trade confirmed", description: `${sig.slice(0, 8)}…` });
      if (publicKey) {
        try {
          const assets = await getAssets(publicKey.toString());
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
      setTradeErr(/reject|cancel/i.test(m) ? "Cancelled in Phantom" : m);
    } finally {
      setTradeBusy(false);
      setTradeStage("");
    }
  }, [
    selectedMint,
    connected,
    publicKey,
    swapMode,
    buyAmt,
    sellPct,
    slippage,
    sendTransaction,
    connection,
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

  const SwapPanel = () => (
    <div className="p-4 space-y-3 border-b border-white/[0.07]">
      <div className="flex rounded-lg overflow-hidden border border-white/[0.07]">
        <button
          type="button"
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
          type="button"
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

      {swapMode === "buy" ? (
        <div className="space-y-2">
          <label className="text-[10px] text-white/35 uppercase tracking-wide">Amount (SOL)</label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={buyAmt}
            onChange={(e) => setBuyAmt(e.target.value)}
            className="h-10 text-sm font-mono bg-white/[0.04] border-white/[0.07]"
            placeholder="0.25"
          />
          <div className="flex gap-1.5">
            {BUY_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setBuyAmt(String(p))}
                className={`flex-1 py-1.5 rounded-md text-[11px] font-mono border transition-colors ${
                  buyAmt === String(p)
                    ? "border-[#ffffff]/50 bg-[#ffffff]/15 text-white"
                    : "border-white/[0.07] text-white/45 hover:text-white/70"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="text-[10px] text-white/35 uppercase tracking-wide">Sell %</label>
          <div className="flex gap-1.5">
            {SELL_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setSellPct(p)}
                className={`flex-1 py-1.5 rounded-md text-[11px] font-mono border transition-colors ${
                  sellPct === p
                    ? "border-red-400/50 bg-red-500/15 text-red-300"
                    : "border-white/[0.07] text-white/45 hover:text-white/70"
                }`}
              >
                {p}%
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <label className="text-[10px] text-white/35 uppercase tracking-wide shrink-0">Slippage</label>
        <Input
          type="number"
          min="0.1"
          max="50"
          step="0.5"
          value={slippage}
          onChange={(e) => setSlippage(Number(e.target.value) || 10)}
          className="h-8 text-xs font-mono bg-white/[0.04] border-white/[0.07] w-20"
        />
        <span className="text-[10px] text-white/30">%</span>
      </div>

      <Button
        type="button"
        onClick={() => void handleSwap()}
        disabled={tradeBusy || !selectedMint}
        className={`w-full h-12 rounded-xl font-semibold text-sm disabled:opacity-60 ${
          swapMode === "buy"
            ? "bg-green-500 hover:bg-green-600 text-black"
            : "bg-red-500 hover:bg-red-600 text-white"
        }`}
      >
        {tradeBusy ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            {tradeStage || "Working…"}
          </>
        ) : !connected ? (
          <>
            <Wallet className="h-4 w-4 mr-2" />
            Connect Phantom
          </>
        ) : swapMode === "buy" ? (
          <>
            <ArrowDownLeft className="h-4 w-4 mr-2" />
            Buy {t?.symbol || "token"}
          </>
        ) : (
          <>
            <ArrowUpRight className="h-4 w-4 mr-2" />
            Sell {sellPct}% {t?.symbol || "token"}
          </>
        )}
      </Button>

      {tradeErr && <p className="text-[11px] text-red-400 text-center">{tradeErr}</p>}
      {tradeSig && (
        <a
          href={`https://solscan.io/tx/${tradeSig}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1 text-[11px] text-[#ffffff] hover:underline"
        >
          Confirmed {tradeSig.slice(0, 8)}… <ExternalLink className="h-3 w-3" />
        </a>
      )}
      <p className="text-[10px] text-white/25 text-center">Sign with Phantom · OrbitX trade API</p>
    </div>
  );

  /* ═══════════════════════════════════════════════════════════════
     Wallet Picker Overlay
     ═══════════════════════════════════════════════════════════════ */
  const WalletPickerOverlay = () => {
    if (!showWalletPicker) return null;
    const available = wallets.filter((w) => ["Phantom", "Solflare"].includes(w.adapter.name));
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={() => setShowWalletPicker(false)}>
        <div className="bg-[#111111] border border-white/[0.1] rounded-2xl p-6 w-[340px] max-w-[90vw] space-y-4"
          onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">Connect Wallet</h3>
            <button onClick={() => setShowWalletPicker(false)} className="text-white/30 hover:text-white/60">
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="text-xs text-white/40">Select a wallet to connect to OrbitX.</p>
          <div className="space-y-2">
            {available.map((w) => (
              <button
                key={w.adapter.name}
                onClick={() => {
                  select(w.adapter.name as any);
                  setTimeout(() => {
                    connect().catch(() => {});
                    setShowWalletPicker(false);
                  }, 150);
                }}
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
              <div className="text-center py-6">
                <Wallet className="h-8 w-8 text-white/15 mx-auto mb-2" />
                <p className="text-sm text-white/40 mb-2">No wallet detected</p>
                <a href="https://phantom.app" target="_blank" rel="noopener noreferrer"
                  className="text-[#ffffff] text-xs underline">
                  Install Phantom →
                </a>
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
    <WalletPickerOverlay />
    <div className="flex h-full min-h-[calc(100vh-68px)] flex-col overflow-y-auto bg-black lg:min-h-0 lg:flex-row lg:overflow-hidden">

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
                <p className="text-xs text-white/40">{connected ? "No token positions" : "Connect wallet to view positions"}</p>
                {!connected && (
                  <Button size="sm" onClick={() => setShowWalletPicker(true)} className="mt-3 bg-white text-black text-xs">
                    Connect
                  </Button>
                )}
              </div>
            )
          )}
        </ScrollArea>
      </aside>

      {/* ═══════════════ CENTER PANEL ═══════════════ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden lg:overflow-hidden">

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
              {/* Wallet status */}
              {connected ? (
                <button onClick={() => disconnect()} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.07] hover:bg-white/[0.08] transition-colors">
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="text-[11px] text-white/60 font-mono">{shortAddr(publicKey!.toString(), 4)}</span>
                </button>
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
        <div className="relative min-h-[320px] h-[380px] flex-1 lg:h-auto bg-black">
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
        <div className="border-t border-white/[0.07] bg-[#050505] flex flex-col min-h-[250px] lg:min-h-[200px] lg:max-h-[280px]">
          <div className="flex border-b border-white/[0.07]">
            {BOTTOM_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setBottomTab(tab)}
                className={`px-4 py-2 text-xs font-medium transition-colors ${
                  bottomTab === tab
                    ? "text-white border-b-2 border-[#ffffff]"
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
                <div className="grid grid-cols-6 gap-2 px-3 py-1.5 text-[10px] text-white/25 font-medium border-b border-white/[0.05] sticky top-0 bg-[#050505]">
                  <span>Time</span><span>Type</span><span>Price</span><span>Amount</span><span>Value</span><span>Wallet</span>
                </div>
                {trades.length === 0 ? (
                  <div className="flex items-center justify-center py-8 text-white/20 text-xs">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading trades…
                  </div>
                ) : (
                  trades.map((trade, i) => (
                    <div key={trade.txHash + i}
                      className="grid grid-cols-6 gap-2 px-3 py-1.5 text-[11px] hover:bg-white/[0.03] transition-colors items-center">
                      <span className="text-white/40 font-mono">{fmtAgo(trade.time)}</span>
                      <span className={`font-semibold ${trade.side === "buy" ? "text-green-400" : "text-red-400"}`}>
                        {trade.side === "buy" ? "Buy" : "Sell"}
                      </span>
                      <span className="text-white/60 font-mono">{fmtPrice(trade.priceUsd)}</span>
                      <span className="text-white/50 font-mono">{fmtNum(trade.amount)}</span>
                      <span className="text-white/50 font-mono">${fmtNum(trade.value)}</span>
                      <a href={`https://solscan.io/account/${trade.wallet}`} target="_blank" rel="noopener noreferrer"
                        className="text-white/30 font-mono hover:text-[#ffffff] transition-colors truncate">
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
                {!connected && (
                  <Button size="sm" onClick={() => setShowWalletPicker(true)} className="mt-3 bg-[#ffffff] text-black text-xs">Connect</Button>
                )}
              </div>
            )}

            {bottomTab === "Positions" && (
              connected && positions.length > 0 ? (
                <>
                  <div className="grid grid-cols-4 gap-2 px-3 py-1.5 text-[10px] text-white/25 font-medium border-b border-white/[0.05]">
                    <span>Token</span><span>Balance</span><span>Price</span><span>Value</span>
                  </div>
                  {positions.slice(0, 20).map((pos) => {
                    const sym = pos.content?.metadata?.symbol || "???";
                    const bal = (pos.token_info?.balance || 0) / Math.pow(10, pos.token_info?.decimals || 0);
                    const price = pos.token_info?.price_info?.price_per_token || 0;
                    const val = pos.token_info?.price_info?.total_price || 0;
                    return (
                      <button key={pos.id} onClick={() => selectToken(pos.id)}
                        className="w-full grid grid-cols-4 gap-2 px-3 py-2 text-[11px] hover:bg-white/[0.04] transition-colors text-left">
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
                  {!connected && (
                    <Button size="sm" onClick={() => setShowWalletPicker(true)} className="mt-3 bg-[#ffffff] text-black text-xs">Connect</Button>
                  )}
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

        <SwapPanel />

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

        <SwapPanel />

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
