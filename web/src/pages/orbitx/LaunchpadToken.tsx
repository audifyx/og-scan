// Orbitx Launchpad — token detail page (/orbitxlaunch/token/:mint).
// Same "dex platform" data model as the rest of the app: registry row
// (when the token was launched here) blended with live Jupiter +
// DexScreener + GeckoTerminal data — works for ANY Solana mint, launched
// here or not (this is what makes the official OrbitX token resolve even
// with no orbitx_tokens row). Real candlestick chart, a live on-chain
// position + estimated PnL panel, Buy/Sell via Jupiter quote + Phantom,
// socials/links pulled from DexScreener + the token's own metadata JSON,
// and correct small-price formatting (no more "$7.75e-6").
import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { getToken, markGraduated } from "@/lib/orbitx/registry";
import { shortAddr, timeAgo, SectionLabel, Pill, useDocumentMeta, fmtPrice, GRADUATION_MC_USD } from "./_shared";
import { fmtCompactUsd } from "./lpx";
import { jupGetTokens, jupQuote, SOL_MINT, fmtPct, HELIUS_BASE, HELIUS_API_KEY } from "@/lib/og";
import {
  Loader2, Copy, Check, ExternalLink, ShieldCheck, ShieldAlert, Droplets, Flame,
  ArrowLeft, Coins, ArrowDownUp, Zap, BadgeCheck, TrendingUp, TrendingDown,
  Globe, Twitter, Send, Wallet, RefreshCw,
} from "lucide-react";

const OFFICIAL_MINT = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";

/* ═══════════════ live market fetch (DexScreener) — richer than the
   Home board needs: pair age, buy/sell counts, socials, website ═══════════════ */

type DexPairFull = {
  pairAddress?: string;
  dexId?: string;
  url?: string;
  priceUsd?: string;
  priceChange?: { m5?: number; h1?: number; h6?: number; h24?: number };
  liquidity?: { usd?: number };
  volume?: { h24?: number };
  marketCap?: number;
  fdv?: number;
  pairCreatedAt?: number;
  txns?: { h24?: { buys?: number; sells?: number } };
  info?: { imageUrl?: string; socials?: { type: string; url: string }[]; websites?: { url: string }[] };
};

async function fetchBestDexPair(mint: string): Promise<DexPairFull | null> {
  try {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
    if (!r.ok) return null;
    const d = await r.json();
    const pairs: DexPairFull[] = (d.pairs || []).filter((p: any) => p.chainId === "solana");
    if (!pairs.length) return null;
    return pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
  } catch { return null; }
}

/** Best-effort description/socials pulled straight from the token's own
 * metadata JSON (pump.fun-style {name,symbol,description,twitter,...}). */
async function fetchMetaJson(uri: string | null | undefined) {
  if (!uri) return null;
  try {
    const r = await fetch(uri);
    if (!r.ok) return null;
    const j = await r.json();
    return j as { description?: string; twitter?: string; telegram?: string; website?: string };
  } catch { return null; }
}

/* ═══════════════ chart panel — DexScreener embed ═══════════════ */

function ChartPanel({ pairAddress, dexId }: { pairAddress: string | null; dexId: string | null }) {
  if (!pairAddress || !dexId) {
    return (
      <div className="pf-card p-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="pf-mono text-xs font-black uppercase tracking-wide text-[hsl(var(--pf-muted))]">Price chart</h3>
        </div>
        <div className="flex h-[420px] items-center justify-center text-xs text-[hsl(var(--pf-muted))]">No liquidity pool yet — chart appears once trading starts</div>
      </div>
    );
  }

  // DexScreener embed URL — high-quality chart, real-time, 2026 modern look
  const dexScreenerUrl = `https://dexscreener.com/solana/${pairAddress}`;
  
  return (
    <div className="pf-card p-3 overflow-hidden">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="pf-mono text-xs font-black uppercase tracking-wide text-[hsl(var(--pf-muted))]">Price chart</h3>
        <a href={dexScreenerUrl} target="_blank" rel="noreferrer" className="pf-mono text-[9px] font-bold text-[hsl(var(--pf-blue))] hover:underline">Open in DexScreener ↗</a>
      </div>
      {/* Embed DexScreener chart iframe — responsive, high-quality, real-time */}
      <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
        <iframe
          src={`https://dexscreener.com/solana/${pairAddress}?embed=1&theme=dark&info=0&trades=1&info=0`}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            border: 'none',
            borderRadius: '8px',
          }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          loading="lazy"
        />
      </div>
    </div>
  );
}

/* ═══════════════ your position — real on-chain balance + estimated PnL ═══════════════ */

function usePositionBalance(mint: string) {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  return useQuery({
    queryKey: ["token-position-balance", mint, publicKey?.toBase58()],
    queryFn: async () => {
      if (!publicKey) return 0;
      const accts = await connection.getParsedTokenAccountsByOwner(publicKey, { mint: new PublicKey(mint) });
      return accts.value.reduce((sum, a) => sum + (a.account.data.parsed?.info?.tokenAmount?.uiAmount ?? 0), 0);
    },
    enabled: !!publicKey && !!mint,
    refetchInterval: 20_000,
  });
}

/** Estimated PnL from the wallet's actual recent SWAP transfer history for
 * this mint (net SOL out vs in). Covers Helius's most recent 100 swaps for
 * the wallet — real on-chain data, but may miss older history. */
function useWalletPnl(mint: string) {
  const { publicKey } = useWallet();
  return useQuery({
    queryKey: ["token-pnl", mint, publicKey?.toBase58()],
    queryFn: async () => {
      if (!publicKey || !HELIUS_API_KEY) return null;
      const addr = publicKey.toBase58();
      const r = await fetch(`${HELIUS_BASE}/addresses/${addr}/transactions?api-key=${HELIUS_API_KEY}&type=SWAP&limit=100`);
      if (!r.ok) return null;
      const txs: any[] = await r.json();
      let solOut = 0, solIn = 0;
      let touched = 0;
      for (const tx of txs) {
        const tokenTransfers: any[] = tx.tokenTransfers ?? [];
        if (!tokenTransfers.some((t) => t.mint === mint)) continue;
        touched++;
        for (const nt of tx.nativeTransfers ?? []) {
          if (nt.fromUserAccount === addr) solOut += nt.amount / 1e9;
          if (nt.toUserAccount === addr) solIn += nt.amount / 1e9;
        }
      }
      return { netSolInvested: solOut - solIn, swapsSeen: touched };
    },
    enabled: !!publicKey && !!mint,
    staleTime: 30_000,
  });
}

function PositionPanel({ mint, symbol, priceUsd, solUsd }: { mint: string; symbol: string; priceUsd: number | null; solUsd: number | null }) {
  const { connected } = useWallet();
  const balQ = usePositionBalance(mint);
  const pnlQ = useWalletPnl(mint);

  if (!connected) return null;

  const balance = balQ.data ?? 0;
  const valueUsd = priceUsd != null ? balance * priceUsd : null;
  const valueSol = solUsd && valueUsd != null ? valueUsd / solUsd : null;
  const pnlSol = pnlQ.data && valueSol != null ? valueSol - pnlQ.data.netSolInvested : null;
  const pnlUsd = pnlSol != null && solUsd != null ? pnlSol * solUsd : null;

  return (
    <div className="pf-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="pf-mono text-xs font-black uppercase tracking-wide text-[hsl(var(--pf-muted))]">Your position</h3>
        <button onClick={() => { balQ.refetch(); pnlQ.refetch(); }} className="rounded-full p-1 text-[hsl(var(--pf-muted))] hover:text-[hsl(var(--pf-ink))]">
          <RefreshCw className={`h-3.5 w-3.5 ${balQ.isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>
      {balQ.isLoading ? (
        <div className="flex items-center gap-2 py-4 text-xs text-[hsl(var(--pf-muted))]"><Loader2 className="h-4 w-4 animate-spin" /> checking wallet…</div>
      ) : balance <= 0 ? (
        <div className="py-2 text-xs text-[hsl(var(--pf-muted))]">You don't hold any ${symbol} yet.</div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--pf-muted))]">Holding</div>
            <div className="pf-mono text-lg font-black text-[hsl(var(--pf-ink))]">{balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
            <div className="pf-mono text-[10px] text-[hsl(var(--pf-muted))]">${symbol}</div>
          </div>
          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--pf-muted))]">Value</div>
            <div className="pf-mono text-lg font-black text-[hsl(var(--pf-ink))]">{valueUsd != null ? fmtCompactUsd(valueUsd) : "—"}</div>
          </div>
          {pnlSol != null && (
            <div className="col-span-2 mt-1 rounded-lg border border-[hsl(var(--pf-border))] p-2">
              <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--pf-muted))]">
                <span>Est. unrealized PnL</span>
                <span>{pnlQ.data?.swapsSeen} swap{pnlQ.data?.swapsSeen === 1 ? "" : "s"} seen</span>
              </div>
              <div className={`pf-mono text-base font-black ${pnlSol >= 0 ? "text-[hsl(var(--pf-green-dark))]" : "text-[hsl(var(--pf-red))]"}`}>
                {pnlSol >= 0 ? "+" : ""}{pnlSol.toFixed(4)} SOL {pnlUsd != null && <span className="text-xs font-bold">({pnlUsd >= 0 ? "+" : ""}{fmtCompactUsd(Math.abs(pnlUsd))})</span>}
              </div>
              <div className="mt-0.5 text-[9px] text-[hsl(var(--pf-muted))]">Based on your recent on-chain swaps for this token — may not cover full history.</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════ Buy / Sell — Jupiter live quote, execute via Phantom ═══════════════ */

function BuySellPanel({ mint, symbol, decimals, solUsd }: { mint: string; symbol: string; decimals: number; solUsd: number | null }) {
  const { connected } = useWallet();
  const balQ = usePositionBalance(mint);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("0.5");

  const inputMint = side === "buy" ? SOL_MINT : mint;
  const outputMint = side === "buy" ? mint : SOL_MINT;
  const inDecimals = side === "buy" ? 9 : decimals;

  const rawAmount = useMemo(() => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return "0";
    return Math.floor(n * 10 ** inDecimals).toString();
  }, [amount, inDecimals]);

  const { data: quote, isFetching, error } = useQuery({
    queryKey: ["token-page-quote", inputMint, outputMint, rawAmount],
    queryFn: () => jupQuote(inputMint, outputMint, rawAmount, 100),
    enabled: rawAmount !== "0",
    refetchInterval: 12_000,
    retry: 1,
  });

  const outDecimals = side === "buy" ? decimals : 9;
  const outAmount = quote ? (Number(quote.outAmount) / 10 ** outDecimals).toLocaleString(undefined, { maximumFractionDigits: 4 }) : "";
  const impact = quote ? Number(quote.priceImpactPct) * 100 : null;
  const swapUrl = `https://phantom.app/ul/swap?inputMint=${inputMint}&outputMint=${outputMint}&amount=${rawAmount}`;
  const buyQuick = ["0.1", "0.5", "1", "2"];
  const sellQuick: [string, number][] = [["25%", 0.25], ["50%", 0.5], ["Max", 1]];

  useEffect(() => {
    const onFocus = () => balQ.refetch();
    document.addEventListener("visibilitychange", onFocus);
    return () => document.removeEventListener("visibilitychange", onFocus);
  }, [balQ]);

  return (
    <div className="pf-card p-4">
      <div className="mb-3 flex gap-1 rounded-full border border-[hsl(var(--pf-border))] p-1">
        {(["buy", "sell"] as const).map((s) => (
          <button key={s} type="button" onClick={() => setSide(s)}
            className={`flex-1 rounded-full py-2 text-xs font-black uppercase tracking-wide transition ${
              side === s ? (s === "buy" ? "bg-[hsl(var(--pf-green))] text-white" : "bg-[hsl(var(--pf-red))] text-white") : "text-[hsl(var(--pf-muted))] hover:text-[hsl(var(--pf-ink))]"
            }`}>
            {s}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-[hsl(var(--pf-border))] bg-[hsl(var(--pf-bg))] p-3">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--pf-muted))]">
          <span>{side === "buy" ? "You pay (SOL)" : `You pay ($${symbol})`}</span>
          {side === "sell" && connected && <span>bal {balQ.data != null ? balQ.data.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"}</span>}
        </div>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
          inputMode="decimal"
          placeholder="0.0"
          className="mt-1 w-full bg-transparent text-2xl font-black text-[hsl(var(--pf-ink))] outline-none"
        />
        <div className="mt-2 flex gap-1.5">
          {side === "buy"
            ? buyQuick.map((v) => (
                <button key={v} onClick={() => setAmount(v)} className="rounded-full border border-[hsl(var(--pf-border))] px-2.5 py-1 pf-mono text-[10px] font-bold text-[hsl(var(--pf-muted))] hover:border-[hsl(var(--pf-green))] hover:text-[hsl(var(--pf-ink))]">{v} SOL</button>
              ))
            : sellQuick.map(([label, pct]) => (
                <button key={label} onClick={() => setAmount(String((balQ.data ?? 0) * pct))} className="rounded-full border border-[hsl(var(--pf-border))] px-2.5 py-1 pf-mono text-[10px] font-bold text-[hsl(var(--pf-muted))] hover:border-[hsl(var(--pf-red))] hover:text-[hsl(var(--pf-ink))]">{label}</button>
              ))}
        </div>
      </div>
      <div className="my-1 flex justify-center">
        <div className="flex h-7 w-7 items-center justify-center rounded-full border border-[hsl(var(--pf-border))] bg-[hsl(var(--pf-bg-2))]"><ArrowDownUp className="h-3.5 w-3.5 text-[hsl(var(--pf-muted))]" /></div>
      </div>
      <div className="rounded-xl border border-[hsl(var(--pf-border))] bg-[hsl(var(--pf-bg))] p-3">
        <div className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--pf-muted))]">
          {side === "buy" ? `You receive ($${symbol})` : "You receive (SOL)"}
        </div>
        <div className="mt-1 text-2xl font-black text-[hsl(var(--pf-green-dark))]">
          {isFetching ? <Loader2 className="h-5 w-5 animate-spin" /> : error ? "—" : outAmount || "0.0"}
        </div>
        {side === "buy" && outAmount && solUsd != null && (
          <div className="pf-mono text-[10px] text-[hsl(var(--pf-muted))]">≈ {fmtCompactUsd(Number(amount) * solUsd)}</div>
        )}
      </div>

      {quote && (
        <div className="mt-2 flex items-center justify-between pf-mono text-[10px] uppercase tracking-wide text-[hsl(var(--pf-muted))]">
          <span>Price impact</span>
          <span className={impact != null && impact > 1 ? "text-[hsl(var(--pf-red))]" : "text-[hsl(var(--pf-green-dark))]"}>{impact != null ? fmtPct(impact) : "—"}</span>
        </div>
      )}

      <a
        href={swapUrl}
        target="_blank"
        rel="noreferrer"
        className={`pf-btn mt-3 w-full justify-center ${side === "sell" ? "!bg-[hsl(var(--pf-red))] !shadow-[0_3px_0_hsl(0_65%_35%)]" : ""}`}
      >
        <Zap className="h-4 w-4" /> {side === "buy" ? "Buy" : "Sell"} on Phantom
      </a>
      <p className="mt-2 text-center text-[10px] text-[hsl(var(--pf-muted))]">Live quote via Jupiter · executes and settles inside your Phantom wallet · 1% slippage</p>
      {!connected && <p className="mt-1 text-center text-[10px] text-[hsl(var(--pf-muted))]"><Wallet className="mr-1 inline h-3 w-3" />Connect via the wallet button up top to see your balance</p>}
    </div>
  );
}

/* ═══════════════ small stat + row primitives ═══════════════ */

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[hsl(var(--pf-border))] py-2.5 last:border-0">
      <span className="pf-mono text-[11px] uppercase tracking-wider text-[hsl(var(--pf-muted))]">{label}</span>
      <span className="text-right pf-mono text-sm font-medium text-[hsl(var(--pf-ink))]">{children}</span>
    </div>
  );
}

function StatBox({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "up" | "down" }) {
  return (
    <div className="pf-card p-3 text-center">
      <div className="text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--pf-muted))]">{label}</div>
      <div className={`mt-1 text-base font-black ${tone === "up" ? "text-[hsl(var(--pf-green-dark))]" : tone === "down" ? "text-[hsl(var(--pf-red))]" : "text-[hsl(var(--pf-ink))]"}`}>{value}</div>
    </div>
  );
}

/* ═══════════════════════ PAGE ═══════════════════════ */

export default function LaunchpadToken() {
  const { mint } = useParams<{ mint: string }>();
  const [copied, setCopied] = useState(false);

  const { data: t, isLoading: registryLoading } = useQuery({
    queryKey: ["orbitx-token", mint],
    queryFn: () => getToken(mint!),
    enabled: !!mint,
  });

  const { data: jupTokens, isLoading: jupLoading } = useQuery({
    queryKey: ["orbitx-token-jup", mint],
    queryFn: () => jupGetTokens([mint!]),
    enabled: !!mint,
    staleTime: 20_000,
  });
  const jup = jupTokens?.[0];

  const { data: pair, isLoading: pairLoading } = useQuery({
    queryKey: ["orbitx-token-dexpair", mint],
    queryFn: () => fetchBestDexPair(mint!),
    enabled: !!mint,
    refetchInterval: 30_000,
  });

  const { data: meta } = useQuery({
    queryKey: ["orbitx-token-meta-json", t?.metadata_uri],
    queryFn: () => fetchMetaJson(t?.metadata_uri),
    enabled: !!t?.metadata_uri,
    staleTime: 5 * 60_000,
  });

  const { data: solUsdData } = useQuery({
    queryKey: ["orbitx-token-sol-usd"],
    queryFn: async () => {
      const r = await jupGetTokens([SOL_MINT]);
      return r?.[0]?.usdPrice ?? null;
    },
    staleTime: 30_000,
  });

  const isLoading = registryLoading || jupLoading;

  const name = t?.name ?? jup?.name;
  const ticker = t?.ticker ?? jup?.symbol;
  const logo = t?.logo_url ?? jup?.icon ?? pair?.info?.imageUrl ?? null;
  const decimals = t?.decimals ?? jup?.decimals ?? 9;
  const mcap = pair?.marketCap ?? pair?.fdv ?? jup?.mcap ?? jup?.fdv ?? null;
  const liq = pair?.liquidity?.usd ?? jup?.liquidity ?? null;
  const vol24 = pair?.volume?.h24 ?? null;
  const ch24 = pair?.priceChange?.h24 ?? jup?.stats24h?.priceChange ?? null;
  const priceUsd = pair?.priceUsd != null ? Number(pair.priceUsd) : jup?.usdPrice ?? null;
  const buys = pair?.txns?.h24?.buys ?? null;
  const sells = pair?.txns?.h24?.sells ?? null;

  useDocumentMeta(
    name
      ? {
          title: `${name} ($${ticker}) — OrbitX Launchpad`,
          description: `${name} ($${ticker}) on OrbitX — ${mcap ? `${fmtCompactUsd(mcap)} market cap, ` : ""}live chart, price and Phantom buy/sell. CA: ${mint}`,
          image: logo,
        }
      : null,
  );

  // Sticky graduation: once market cap first crosses the threshold, persist it
  // permanently (never un-graduates). Best-effort, fires once per crossing.
  useEffect(() => {
    if (mint && mcap != null && mcap >= GRADUATION_MC_USD && t && !t.graduated_at && !t.lp_pool_address) {
      markGraduated(mint).catch(() => {});
    }
  }, [mint, mcap, t]);

  if (isLoading || pairLoading) return <div className="flex items-center justify-center gap-2 py-24 pf-mono text-sm text-[hsl(var(--pf-muted))]"><Loader2 className="h-5 w-5 animate-spin" /> loading token…</div>;

  if (!t && !jup && !pair)
    return (
      <div className="pf-card mx-auto flex max-w-lg flex-col items-center gap-4 py-16 text-center">
        <div className="text-lg font-black text-[hsl(var(--pf-ink))]">Token not found</div>
        <div className="max-w-sm text-sm text-[hsl(var(--pf-muted))]">No launch or live Solana mint matches <span className="pf-mono text-[hsl(28_80%_32%)]">{shortAddr(mint, 6)}</span>.</div>
        <Link to="/orbitxlaunch" className="pf-btn"><ArrowLeft className="h-4 w-4" /> Back to launchpad</Link>
      </div>
    );

  const graduated = !!t?.lp_pool_address || !!t?.graduated_at || (mcap != null && mcap >= GRADUATION_MC_USD) || (liq ?? 0) > 0;
  const isOfficial = mint === OFFICIAL_MINT;
  const cluster = t?.cluster ?? "mainnet-beta";
  const explorer = `https://solscan.io/token/${mint}${cluster !== "mainnet-beta" ? "?cluster=devnet" : ""}`;
  const pct = graduated ? 100 : mcap && mcap > 0 ? Math.max(2, Math.min(99, Math.round((mcap / GRADUATION_MC_USD) * 100))) : 3;
  const description = meta?.description;
  const website = meta?.website || pair?.info?.websites?.[0]?.url;
  const twitter = meta?.twitter || pair?.info?.socials?.find((s) => s.type === "twitter")?.url;
  const telegram = meta?.telegram || pair?.info?.socials?.find((s) => s.type === "telegram")?.url;
  const pairAgeMs = pair?.pairCreatedAt ? Date.now() - pair.pairCreatedAt : null;

  const copy = () => {
    if (!mint) return;
    navigator.clipboard.writeText(mint);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="mx-auto max-w-5xl">
      <Link to="/orbitxlaunch" className="mb-4 inline-flex items-center gap-1.5 pf-mono text-xs uppercase tracking-wider text-[hsl(var(--pf-muted))] hover:text-[hsl(var(--pf-ink))]"><ArrowLeft className="h-4 w-4" /> Launchpad</Link>

      <div className="pf-card p-6">
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-[hsl(var(--pf-ink))] bg-[hsl(var(--pf-bg))]">
            {logo ? <img src={logo} alt={ticker} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-xl font-black text-[hsl(var(--pf-muted))]">{ticker?.slice(0, 2).toUpperCase()}</div>}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-[hsl(var(--pf-ink))]">{name}</h1>
              <span className="rounded-full bg-[hsl(var(--pf-ink))/0.06] px-2 py-0.5 pf-mono text-xs font-bold text-[hsl(28_80%_32%)]">${ticker}</span>
              {isOfficial && <Pill tone="gold"><BadgeCheck className="h-3 w-3" /> Official OrbitX token</Pill>}
              {t && <Pill tone={t.launch_type === "pump" ? "cyan" : "gold"}>{t.launch_type === "pump" ? "Pump launch" : "Custom launch"}</Pill>}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {graduated
                ? <Pill tone="lime"><Droplets className="h-3 w-3" /> Graduated</Pill>
                : <Pill tone="cyan"><Flame className="h-3 w-3" /> Fresh</Pill>}
              {t ? (
                t.is_vamp
                  ? <Pill tone="blood"><ShieldAlert className="h-3 w-3" /> Vamp · fees → {t.fee_route === "orbitx_buyback" ? "OBX buyback" : t.fee_route}</Pill>
                  : <Pill tone="muted"><ShieldCheck className="h-3 w-3" /> Verified unique</Pill>
              ) : jup?.isVerified ? (
                <Pill tone="muted"><ShieldCheck className="h-3 w-3" /> Verified on Jupiter</Pill>
              ) : null}
              {ch24 != null && (
                <Pill tone={ch24 >= 0 ? "lime" : "blood"}>{ch24 >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />} {fmtPct(ch24)} 24h</Pill>
              )}
              {pairAgeMs != null && <Pill tone="muted">{timeAgo(new Date(Date.now() - pairAgeMs).toISOString())} old pool</Pill>}
            </div>
            {description && <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[hsl(var(--pf-muted))]">{description}</p>}
            {(website || twitter || telegram) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {website && <a href={website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--pf-border))] px-3 py-1.5 text-xs font-bold text-[hsl(var(--pf-ink))] hover:border-[hsl(var(--pf-green))]"><Globe className="h-3.5 w-3.5" /> Website</a>}
                {twitter && <a href={twitter} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--pf-border))] px-3 py-1.5 text-xs font-bold text-[hsl(var(--pf-ink))] hover:border-[hsl(var(--pf-green))]"><Twitter className="h-3.5 w-3.5" /> X / Twitter</a>}
                {telegram && <a href={telegram} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--pf-border))] px-3 py-1.5 text-xs font-bold text-[hsl(var(--pf-ink))] hover:border-[hsl(var(--pf-green))]"><Send className="h-3.5 w-3.5" /> Telegram</a>}
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2 rounded-lg border border-[hsl(var(--pf-border))] bg-[hsl(var(--pf-bg))] px-3 py-2.5">
          <Coins className="h-4 w-4 shrink-0 text-[hsl(28_80%_32%)]" />
          <span className="min-w-0 flex-1 truncate pf-mono text-sm text-[hsl(var(--pf-ink))]">{mint}</span>
          <button onClick={copy} className="shrink-0 rounded-lg border border-[hsl(var(--pf-border))] p-1.5 hover:bg-[hsl(var(--pf-ink))/0.06]" title="Copy CA">{copied ? <Check className="h-4 w-4 text-[hsl(var(--pf-green-dark))]" /> : <Copy className="h-4 w-4" />}</button>
          <a href={explorer} target="_blank" rel="noreferrer" className="shrink-0 rounded-lg border border-[hsl(var(--pf-border))] p-1.5 hover:bg-[hsl(var(--pf-ink))/0.06]" title="View on Solscan"><ExternalLink className="h-4 w-4" /></a>
        </div>
      </div>

      {/* market stats */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatBox label="Price" value={fmtPrice(priceUsd)} />
        <StatBox label="Market cap" value={fmtCompactUsd(mcap)} />
        <StatBox label="Liquidity" value={fmtCompactUsd(liq)} />
        <StatBox label="24h volume" value={fmtCompactUsd(vol24)} />
      </div>
      {(buys != null || sells != null) && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <StatBox label="24h buys" value={buys ?? "—"} tone="up" />
          <StatBox label="24h sells" value={sells ?? "—"} tone="down" />
        </div>
      )}

      {!graduated && (
        <div className="pf-card mt-4 p-4">
          <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--pf-muted))]">
            <span>Bonding curve</span>
            <span className="text-[hsl(var(--pf-green-dark))]">{pct}% to graduation</span>
          </div>
          <div className="pf-progress"><div className="pf-progress-fill" style={{ width: `${pct}%` }} /></div>
        </div>
      )}

      <div className="mt-4">
        <ChartPanel pairAddress={pair?.pairAddress ?? null} dexId={pair?.dexId ?? null} />
      </div>

      {/* buy / sell + position + details */}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="space-y-4">
          <BuySellPanel mint={mint!} symbol={ticker ?? "TOKEN"} decimals={decimals} solUsd={solUsdData ?? null} />
          <PositionPanel mint={mint!} symbol={ticker ?? "TOKEN"} priceUsd={priceUsd} solUsd={solUsdData ?? null} />
        </div>

        <div className="pf-card p-6">
          <SectionLabel>Token details</SectionLabel>
          <div className="grid gap-x-8 gap-y-0">
            {t ? (
              <>
                <Row label="Supply">{Number(t.supply).toLocaleString()}</Row>
                <Row label="Decimals">{t.decimals}</Row>
                <Row label="DEX">{pair?.dexId || t.dex || "—"}</Row>
                <Row label="Fee routing">{t.fee_route === "orbitx_buyback" ? "OBX buyback" : t.fee_route === "og" ? "Original token" : "Creator"}</Row>
                <Row label="Creator">{shortAddr(t.creator_wallet, 5)}</Row>
                <Row label="Launched">{timeAgo(t.created_at)}</Row>
                {t.lp_pool_address && <Row label="LP pool">{shortAddr(t.lp_pool_address, 5)}</Row>}
                {t.mint_signature && <Row label="Mint tx"><a className="text-[hsl(var(--pf-blue))] hover:underline" target="_blank" rel="noreferrer" href={`https://solscan.io/tx/${t.mint_signature}${cluster !== "mainnet-beta" ? "?cluster=devnet" : ""}`}>{shortAddr(t.mint_signature, 5)}</a></Row>}
              </>
            ) : (
              <>
                <Row label="Decimals">{decimals}</Row>
                <Row label="Holders">{jup?.holderCount != null ? jup.holderCount.toLocaleString() : "—"}</Row>
                <Row label="Mint authority">{jup?.audit?.mintAuthorityDisabled ? "Revoked" : "Active"}</Row>
                <Row label="Freeze authority">{jup?.audit?.freezeAuthorityDisabled ? "Revoked" : "Active"}</Row>
                <div className="pt-2 text-xs text-[hsl(var(--pf-muted))]">
                  External Solana token — not launched through OrbitX. Live price and liquidity verified via Jupiter, DexScreener and GeckoTerminal.
                </div>
              </>
            )}
            <div className="flex flex-wrap gap-3 pt-3">
              {pair?.url && <a href={pair.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 pf-mono text-xs font-bold text-[hsl(var(--pf-blue))] hover:underline">DexScreener <ExternalLink className="h-3 w-3" /></a>}
              <a href={explorer} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 pf-mono text-xs font-bold text-[hsl(var(--pf-blue))] hover:underline">Solscan <ExternalLink className="h-3 w-3" /></a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
