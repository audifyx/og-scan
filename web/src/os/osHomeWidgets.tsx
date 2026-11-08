/**
 * OrbitX OS home widgets (wave 7, item 7) — Fear & Greed, Mini Swap and
 * Portfolio Snapshot desk widgets, plus the phone widget strip.
 *
 * Data is public / free, no new backend:
 *  - Fear & Greed: https://api.alternative.me/fng/ (free, no key)
 *  - Mini Swap quotes: Jupiter v6 quote API (free, no key); execution goes
 *    through the desk-wallet path (deskBuy/deskSell in @/lib/deskTrades),
 *    the same backend-signed flow the DEX uses — no extension, no popup.
 *  - Portfolio: the linked in-app (desk) wallet via useOrbitxBilling,
 *    SOL balance + SPL holdings off public RPC, priced via DexScreener.
 * All fetches fail soft (cached last value / "needs network" hint) — a
 * widget never breaks the desktop when an API is down.
 */
import { useEffect, useRef, useState } from "react";
import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { useOrbitxBilling } from "@/tokenomics/useOrbitxBilling";
import { deskBuy, deskSell, solscanTxUrl } from "@/lib/deskTrades";
import { SOL_MINT, jupGetTokens, type JupTokenInfo } from "@/lib/og";
import { browserWalletRpcUrl } from "@/lib/solanaRpc";
import { fetchTokenQuote } from "./osWave6";
import {
  ChartWidgetBody,
  MarketWidgetBody,
  MiniChartWidgetBody,
  NoteWidgetBody,
  TasksWidgetBody,
  TokenWidgetBody,
  type MarketRow,
} from "./osWave6";
import { daysUntil, quoteOfDay } from "./osWave4";
import type { DeskWidget, OsNote, OsPriceAlert, OsTask } from "./osStore";
import type { OsWindowKind } from "./osWindows";

export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const ORBITX_MINT = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";
const JUP_QUOTE_API = "https://quote-api.jup.ag/v6/quote";
const FNG_API = "https://api.alternative.me/fng/?limit=7";
const FNG_CACHE_KEY = "orbitxos:fear-greed:v1";

function fmtUsd(n: number, digits = 2): string {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function fmtNum(n: number, maxDp = 4): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: maxDp });
}

function newId(): string {
  return `wdg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
}

export function widgetId(): string {
  return newId();
}

/* ------------------------------------------------------------------ */
/* Fear & Greed                                                        */
/* ------------------------------------------------------------------ */

export interface FearGreedReading {
  value: number;
  label: string;
  updatedAt: number;
  history: number[]; // oldest -> newest, up to 7 days
}

export async function fetchFearGreed(): Promise<FearGreedReading | null> {
  try {
    const res = await fetch(FNG_API);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: { value: string; value_classification: string; timestamp: string }[];
    };
    const rows = Array.isArray(json.data) ? json.data : [];
    if (!rows.length) return null;
    const latest = rows[0];
    const history = rows
      .map((r) => Number(r.value))
      .filter((v) => Number.isFinite(v))
      .reverse();
    const reading: FearGreedReading = {
      value: Number(latest.value),
      label: latest.value_classification || "—",
      updatedAt: Number(latest.timestamp) * 1000,
      history,
    };
    try {
      localStorage.setItem(FNG_CACHE_KEY, JSON.stringify(reading));
    } catch {
      /* storage unavailable */
    }
    return reading;
  } catch {
    return null;
  }
}

function loadCachedFearGreed(): FearGreedReading | null {
  try {
    const raw = localStorage.getItem(FNG_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FearGreedReading;
    return Number.isFinite(parsed.value) ? parsed : null;
  } catch {
    return null;
  }
}

/** Live Fear & Greed index, refreshed every 5 minutes. Null = unreachable. */
export function useFearGreed(): FearGreedReading | null {
  const [reading, setReading] = useState<FearGreedReading | null>(() => loadCachedFearGreed());
  useEffect(() => {
    let live = true;
    const tick = async () => {
      const r = await fetchFearGreed();
      if (live && r) setReading(r);
    };
    void tick();
    const id = setInterval(() => void tick(), 300000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, []);
  return reading;
}

function fngColor(value: number): string {
  if (value <= 24) return "#f87171";
  if (value <= 44) return "#fb923c";
  if (value <= 55) return "#e8b84a";
  if (value <= 75) return "#a3e635";
  return "#34d399";
}

/** Semicircle gauge + 7-day history bars. */
export function FearGreedWidgetBody() {
  const reading = useFearGreed();
  if (!reading) {
    return <p className="oxos-hint">Loading market mood… (needs network)</p>;
  }
  const v = Math.max(0, Math.min(100, reading.value));
  // Gauge: semicircle, 180deg (left) -> 0deg (right). Needle angle in radians.
  const angle = Math.PI - (v / 100) * Math.PI;
  const cx = 100;
  const cy = 92;
  const r = 78;
  const nx = cx + r * Math.cos(angle);
  const ny = cy - r * Math.sin(angle);
  const color = fngColor(v);
  const maxHist = Math.max(...reading.history, 1);
  return (
    <div className="oxos-deskwd__fng">
      <svg viewBox="0 0 200 100" width="100%" height="86" role="img" aria-label={`Fear and Greed index ${v}: ${reading.label}`}>
        <path d="M 22 92 A 78 78 0 0 1 178 92" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="10" strokeLinecap="round" />
        <path
          d="M 22 92 A 78 78 0 0 1 178 92"
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${(v / 100) * 245} 245`}
        />
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="5" fill="#e8b84a" />
      </svg>
      <div className="oxos-deskwd__bignum" style={{ color }}>
        {v} · {reading.label}
      </div>
      <div className="oxos-deskwd__fnghist" aria-hidden>
        {reading.history.map((h, i) => (
          <span
            key={i}
            title={`${h}`}
            style={{ height: `${Math.max(8, (h / maxHist) * 100)}%`, background: fngColor(h) }}
          />
        ))}
      </div>
      <p className="oxos-hint">
        Crypto Fear &amp; Greed · 7-day history · updated{" "}
        {reading.updatedAt ? new Date(reading.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—"}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mini Swap — live Jupiter quote, executed by the in-app wallet       */
/* ------------------------------------------------------------------ */

interface JupQuote {
  outAmount: string;
  priceImpactPct: string;
  routeLabels: string[];
}

async function fetchJupQuote(inputMint: string, outputMint: string, amountRaw: string): Promise<JupQuote | null> {
  try {
    const res = await fetch(
      `${JUP_QUOTE_API}?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountRaw}&slippageBps=100`,
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      outAmount?: string;
      priceImpactPct?: string;
      routePlan?: { swapInfo?: { label?: string } }[];
    };
    if (!json.outAmount) return null;
    return {
      outAmount: json.outAmount,
      priceImpactPct: json.priceImpactPct ?? "0",
      routeLabels: (json.routePlan ?? []).map((r) => r.swapInfo?.label ?? "").filter(Boolean),
    };
  } catch {
    return null;
  }
}

const SWAP_PRESETS: { mint: string; symbol: string }[] = [
  { mint: ORBITX_MINT, symbol: "ORBITX" },
  { mint: USDC_MINT, symbol: "USDC" },
  { mint: SOL_MINT, symbol: "SOL" },
];

export function MiniSwapWidgetBody({
  mint,
  swapMode,
  solPrice,
  onMint,
}: {
  mint?: string;
  swapMode?: "buy" | "sell";
  solPrice: number | null;
  onMint: (m: string) => void;
}) {
  const billing = useOrbitxBilling();
  const [mode, setMode] = useState<"buy" | "sell">(swapMode ?? "buy");
  const [amount, setAmount] = useState("0.1");
  const [sellPct, setSellPct] = useState(50);
  const [customMint, setCustomMint] = useState("");
  const [meta, setMeta] = useState<JupTokenInfo[]>([]);
  const [quote, setQuote] = useState<JupQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSig, setLastSig] = useState<string | null>(null);

  const outMint = mint ?? ORBITX_MINT;
  const outToken = meta.find((t) => t.id === outMint);
  const solToken = meta.find((t) => t.id === SOL_MINT);
  const outDecimals = outToken?.decimals ?? (outMint === USDC_MINT ? 6 : 9);
  const outSymbol = outToken?.symbol ?? (outMint === ORBITX_MINT ? "ORBITX" : outMint === USDC_MINT ? "USDC" : "Token");

  // Token metadata (decimals/symbol) for SOL + the selected output token.
  useEffect(() => {
    let live = true;
    jupGetTokens([SOL_MINT, outMint])
      .then((t) => {
        if (live) setMeta(t);
      })
      .catch(() => {
        /* quote still works with default decimals */
      });
    return () => {
      live = false;
    };
  }, [outMint]);

  // Live quote: buy = SOL -> token, sell = token -> SOL (1 unit of input).
  useEffect(() => {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setQuote(null);
      return;
    }
    let live = true;
    let timer: number | undefined;
    const tick = async () => {
      setQuoting(true);
      try {
        const inputMint = mode === "buy" ? SOL_MINT : outMint;
        const outputMint = mode === "buy" ? outMint : SOL_MINT;
        const inputDecimals = mode === "buy" ? 9 : outDecimals;
        const raw = Math.floor(amt * 10 ** inputDecimals).toString();
        const q = await fetchJupQuote(inputMint, outputMint, raw);
        if (live) setQuote(q);
      } finally {
        if (live) setQuoting(false);
      }
    };
    timer = window.setTimeout(() => void tick(), 500);
    const id = setInterval(() => void tick(), 15000);
    return () => {
      live = false;
      window.clearTimeout(timer);
      clearInterval(id);
    };
  }, [amount, mode, outMint, outDecimals]);

  const outAmount = quote
    ? Number(quote.outAmount) / 10 ** (mode === "buy" ? outDecimals : 9)
    : null;
  const impact = quote ? Number(quote.priceImpactPct) * 100 : null;
  const amountSol = mode === "buy" ? Number(amount) : null;
  const usdValue = amountSol != null && solPrice != null ? amountSol * solPrice : null;
  const overCap = usdValue != null && usdValue > 250;

  async function execute() {
    setError(null);
    setLastSig(null);
    if (!billing.ready) {
      billing.beginAuth();
      return;
    }
    if (mode === "buy") {
      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt <= 0) {
        setError("Enter a SOL amount.");
        return;
      }
      if (overCap) {
        setError("Per-trade cap is $250 worth of SOL.");
        return;
      }
      setBusy(true);
      try {
        const sig = await deskBuy(outMint, amt, 100);
        setLastSig(sig);
        billing.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Swap failed.");
      } finally {
        setBusy(false);
      }
    } else {
      setBusy(true);
      try {
        const sig = await deskSell(outMint, sellPct, 100);
        setLastSig(sig);
        billing.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Swap failed.");
      } finally {
        setBusy(false);
      }
    }
  }

  return (
    <div className="oxos-deskwd__swap">
      <div className="oxos-deskwd__swapmodes" role="tablist" aria-label="Swap direction">
        {(["buy", "sell"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            className={mode === m ? "is-on" : ""}
            onClick={() => {
              setMode(m);
              setQuote(null);
              setError(null);
              setLastSig(null);
            }}
          >
            {m === "buy" ? "Buy" : "Sell"}
          </button>
        ))}
      </div>
      {mode === "buy" ? (
        <label className="oxos-deskwd__swapfield">
          <span>You pay (SOL)</span>
          <input
            className="oxos-input"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label="SOL amount to swap"
          />
        </label>
      ) : (
        <div className="oxos-deskwd__swapfield">
          <span>Sell share of your {outSymbol} position</span>
          <div className="oxos-deskwd__swappcts">
            {[25, 50, 75, 100].map((p) => (
              <button
                key={p}
                type="button"
                className={sellPct === p ? "is-on" : ""}
                onClick={() => setSellPct(p)}
                aria-pressed={sellPct === p}
              >
                {p}%
              </button>
            ))}
          </div>
        </div>
      )}
      <label className="oxos-deskwd__swapfield">
        <span>{mode === "buy" ? "You receive" : "You sell"}</span>
        <select
          className="oxos-input"
          value={SWAP_PRESETS.some((p) => p.mint === outMint) ? outMint : "custom"}
          onChange={(e) => {
            if (e.target.value !== "custom") onMint(e.target.value);
          }}
          aria-label="Token to swap"
        >
          {SWAP_PRESETS.map((p) => (
            <option key={p.mint} value={p.mint}>
              {p.symbol}
            </option>
          ))}
          <option value="custom">Custom mint…</option>
        </select>
      </label>
      {!SWAP_PRESETS.some((p) => p.mint === outMint) && (
        <input
          className="oxos-input"
          value={customMint}
          placeholder="Paste a Solana mint…"
          aria-label="Custom token mint"
          spellCheck={false}
          onChange={(e) => setCustomMint(e.target.value.trim())}
          onBlur={() => {
            if (customMint) onMint(customMint);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
        />
      )}
      <div className="oxos-deskwd__row">
        <span>{mode === "buy" ? `≈ ${outSymbol}` : "≈ SOL"}</span>
        <span>
          {quoting
            ? "Quoting…"
            : outAmount != null
              ? `${fmtNum(outAmount)} ${mode === "buy" ? outSymbol : "SOL"}`
              : "—"}
        </span>
      </div>
      {impact != null && (
        <div className="oxos-deskwd__row">
          <span>Price impact</span>
          <span className={Math.abs(impact) > 2 ? "down" : ""}>{impact.toFixed(2)}%</span>
        </div>
      )}
      {quote && quote.routeLabels.length > 0 && (
        <p className="oxos-hint">Route: {quote.routeLabels.join(" → ")}</p>
      )}
      {usdValue != null && <p className="oxos-hint">≈ {fmtUsd(usdValue)} · 1% slippage · Jupiter</p>}
      {error && <p className="oxos-deskwd__err">{error}</p>}
      {lastSig && (
        <p className="oxos-hint">
          Swapped.{" "}
          <a href={solscanTxUrl(lastSig)} target="_blank" rel="noreferrer">
            View on Solscan
          </a>
        </p>
      )}
      <button
        type="button"
        className="oxos-btn oxos-deskwd__swapcta"
        disabled={busy || (mode === "buy" && (!Number.isFinite(Number(amount)) || Number(amount) <= 0))}
        onClick={() => void execute()}
      >
        {busy
          ? "Swapping…"
          : !billing.ready
            ? "Link in-app wallet to swap"
            : mode === "buy"
              ? `Swap ${amount || "0"} SOL → ${outSymbol}`
              : `Sell ${sellPct}% ${outSymbol} → SOL`}
      </button>
      {!billing.ready && (
        <p className="oxos-hint">Quotes are live without a wallet. Swaps run on your linked in-app wallet — no extension, no popup.</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Portfolio Snapshot — in-app wallet: SOL + SPL holdings, USD total   */
/* ------------------------------------------------------------------ */

interface HoldingRow {
  mint: string;
  symbol: string;
  amount: number;
  priceUsd: number | null;
  usd: number | null;
}

async function fetchHoldingPrices(mints: string[]): Promise<Map<string, { price: number; symbol: string; liq: number }>> {
  const out = new Map<string, { price: number; symbol: string; liq: number }>();
  if (!mints.length) return out;
  try {
    const res = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${mints.join(",")}`);
    if (!res.ok) return out;
    const pairs = (await res.json()) as any[];
    if (!Array.isArray(pairs)) return out;
    for (const p of pairs) {
      const mint = p?.baseToken?.address as string | undefined;
      const price = Number(p?.priceUsd);
      if (!mint || !Number.isFinite(price)) continue;
      const liq = Number(p?.liquidity?.usd ?? 0);
      const prev = out.get(mint);
      if (!prev || liq > prev.liq) {
        out.set(mint, { price, symbol: p?.baseToken?.symbol ?? "", liq });
      }
    }
  } catch {
    /* priced as unknown */
  }
  return out;
}

export function PortfolioWidgetBody({
  solPrice,
  orbitxPrice,
}: {
  solPrice: number | null;
  orbitxPrice: number | null;
}) {
  const billing = useOrbitxBilling();
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [holdings, setHoldings] = useState<HoldingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const wallet = billing.wallet;

  useEffect(() => {
    if (!wallet) {
      setSolBalance(null);
      setHoldings([]);
      return;
    }
    let live = true;
    const tick = async () => {
      setLoading(true);
      try {
        const conn = new Connection(browserWalletRpcUrl(), "confirmed");
        const [lamports, parsed] = await Promise.all([
          conn.getBalance(new PublicKey(wallet), "confirmed"),
          conn.getParsedTokenAccountsByOwner(new PublicKey(wallet), { programId: TOKEN_PROGRAM_ID }, "confirmed"),
        ]);
        if (!live) return;
        setSolBalance(lamports / 1e9);
        const rows = parsed.value
          .map((a) => {
            const info = (a.account.data as { parsed?: { info?: { mint?: string; tokenAmount?: { uiAmount?: number } } } }).parsed?.info;
            return { mint: info?.mint ?? "", amount: Number(info?.tokenAmount?.uiAmount ?? 0) };
          })
          .filter((r) => r.mint && r.amount > 0);
        const prices = await fetchHoldingPrices(rows.map((r) => r.mint));
        if (!live) return;
        setHoldings(
          rows
            .map((r) => {
              const p = prices.get(r.mint);
              return {
                mint: r.mint,
                symbol: p?.symbol || (r.mint === ORBITX_MINT ? "ORBITX" : `${r.mint.slice(0, 4)}…`),
                amount: r.amount,
                priceUsd: p ? p.price : null,
                usd: p ? r.amount * p.price : null,
              };
            })
            .sort((a, b) => (b.usd ?? 0) - (a.usd ?? 0))
            .slice(0, 6),
        );
        setUpdatedAt(Date.now());
      } catch {
        /* keep last values, show stale state */
      } finally {
        if (live) setLoading(false);
      }
    };
    void tick();
    const id = setInterval(() => void tick(), 60000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [wallet]);

  if (!billing.ready || !wallet) {
    return (
      <div className="oxos-deskwd__portfolio">
        <p className="oxos-hint">Link your in-app wallet to see SOL + token holdings here.</p>
        <button type="button" className="oxos-btn" onClick={() => billing.beginAuth()}>
          Link in-app wallet
        </button>
        {billing.error && <p className="oxos-deskwd__err">{billing.error}</p>}
      </div>
    );
  }

  const solUsd = solBalance != null && solPrice != null ? solBalance * solPrice : null;
  const holdingsUsd = holdings.reduce((s, h) => s + (h.usd ?? 0), 0);
  const orbitxRow = holdings.find((h) => h.mint === ORBITX_MINT);
  // ORBITX balance from billing is the source of truth if the RPC parse missed it.
  const orbitxAmount = orbitxRow?.amount ?? billing.balance ?? null;
  const orbitxUsd =
    orbitxRow?.usd ?? (orbitxAmount != null && orbitxPrice != null ? orbitxAmount * orbitxPrice : null);
  const totalUsd = (solUsd ?? 0) + holdingsUsd + (orbitxRow ? 0 : (orbitxUsd ?? 0));

  return (
    <div className="oxos-deskwd__portfolio">
      <div className="oxos-deskwd__bignum">{fmtUsd(totalUsd)}</div>
      <div className="oxos-deskwd__row">
        <span>SOL</span>
        <span>
          {solBalance != null ? `${fmtNum(solBalance)} SOL` : "—"}
          {solUsd != null ? ` · ${fmtUsd(solUsd)}` : ""}
        </span>
      </div>
      {orbitxAmount != null && (
        <div className="oxos-deskwd__row">
          <span>ORBITX</span>
          <span>
            {fmtNum(orbitxAmount)}
            {orbitxUsd != null ? ` · ${fmtUsd(orbitxUsd)}` : ""}
          </span>
        </div>
      )}
      {holdings
        .filter((h) => h.mint !== ORBITX_MINT)
        .slice(0, 4)
        .map((h) => (
          <div key={h.mint} className="oxos-deskwd__row">
            <span>{h.symbol}</span>
            <span>
              {fmtNum(h.amount)}
              {h.usd != null ? ` · ${fmtUsd(h.usd)}` : ""}
            </span>
          </div>
        ))}
      <p className="oxos-hint">
        {wallet.slice(0, 4)}…{wallet.slice(-4)} · {loading ? "Refreshing…" : updatedAt ? `Updated ${new Date(updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "—"}
        {" · "}
        <button type="button" className="oxos-deskwd__linkbtn" onClick={() => billing.refresh()}>
          Refresh
        </button>
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Phone widget strip — desk widgets on the phone home screen.         */
/* Desk widgets are absolutely positioned and hidden under 768px       */
/* (os.css), so the phone home renders the same widgets as a           */
/* horizontally scrollable strip above the app grid instead.           */
/* ------------------------------------------------------------------ */

export function deskWidgetTitle(type: DeskWidget["type"]): string {
  switch (type) {
    case "ticker":
      return "Market";
    case "trending":
      return "Trending";
    case "alerts":
      return "My alerts";
    case "countdown":
      return "Countdown";
    case "quote":
      return "Quote";
    case "token":
      return "Token";
    case "chart":
      return "Chart";
    case "market":
      return "Top 10";
    case "tasks":
      return "Tasks";
    case "note":
      return "Note";
    case "minichart":
      return "Mini chart";
    case "feargreed":
      return "Fear & Greed";
    case "miniswap":
      return "Mini Swap";
    case "portfolio":
      return "Portfolio";
  }
}

export function PhoneWidgetStrip({
  widgets,
  solPrice,
  solChange,
  orbitxPrice,
  orbitxChange,
  trending,
  alerts,
  tasks,
  notes,
  onRemove,
  onUpdate,
  onToggleTask,
  onOpenToken,
  onOpenBuiltin,
}: {
  widgets: DeskWidget[];
  solPrice: number | null;
  solChange: number | null;
  orbitxPrice: number | null;
  orbitxChange: number | null;
  trending: MarketRow[];
  alerts: OsPriceAlert[];
  tasks: OsTask[];
  notes: OsNote[];
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<DeskWidget>) => void;
  onToggleTask: (id: string) => void;
  onOpenToken: (mint: string) => void;
  onOpenBuiltin: (kind: OsWindowKind, title: string) => void;
}) {
  if (!widgets.length) return null;
  return (
    <div className="oxos-phone__widgets" aria-label="Home widgets">
      {widgets.map((wdg) => (
        <section key={wdg.id} className="oxos-phone__widget">
          <header className="oxos-phone__widgethead">
            <button type="button" onClick={() => {
              if (wdg.type === "token" || wdg.type === "chart") {
                if (wdg.mint) onOpenToken(wdg.mint);
              } else if (wdg.type === "tasks") {
                onOpenBuiltin("tasks", "Tasks");
              } else if (wdg.type === "note") {
                onOpenBuiltin("notes", "Notes");
              }
            }}>
              {deskWidgetTitle(wdg.type)}
            </button>
            <button type="button" title="Remove widget" aria-label={`Remove ${deskWidgetTitle(wdg.type)} widget`} onClick={() => onRemove(wdg.id)}>
              ✕
            </button>
          </header>
          <div className="oxos-phone__widgetbody">
            {wdg.type === "feargreed" && <FearGreedWidgetBody />}
            {wdg.type === "miniswap" && (
              <MiniSwapWidgetBody
                mint={wdg.mint}
                swapMode={wdg.swapMode}
                solPrice={solPrice}
                onMint={(m) => onUpdate(wdg.id, { mint: m })}
              />
            )}
            {wdg.type === "portfolio" && <PortfolioWidgetBody solPrice={solPrice} orbitxPrice={orbitxPrice} />}
            {wdg.type === "ticker" && (
              <>
                <div className="oxos-deskwd__row">
                  <span>SOL</span>
                  <span>{solPrice != null ? fmtUsd(solPrice) : "—"}</span>
                  {solChange != null && (
                    <span className={solChange >= 0 ? "up" : "down"}>
                      {solChange >= 0 ? "▲" : "▼"} {Math.abs(solChange).toFixed(1)}%
                    </span>
                  )}
                </div>
                <div className="oxos-deskwd__row">
                  <span>$ORBITX</span>
                  <span>{orbitxPrice != null ? fmtUsd(orbitxPrice, 6) : "—"}</span>
                  {orbitxChange != null && (
                    <span className={orbitxChange >= 0 ? "up" : "down"}>
                      {orbitxChange >= 0 ? "▲" : "▼"} {Math.abs(orbitxChange).toFixed(1)}%
                    </span>
                  )}
                </div>
              </>
            )}
            {wdg.type === "trending" &&
              trending.slice(0, 5).map((t) => (
                <div key={t.mint} className="oxos-deskwd__row">
                  <span>{t.symbol}</span>
                  <span>{fmtUsd(t.price)}</span>
                  <span className={t.change24h >= 0 ? "up" : "down"}>
                    {t.change24h >= 0 ? "+" : ""}
                    {t.change24h.toFixed(1)}%
                  </span>
                </div>
              ))}
            {wdg.type === "alerts" &&
              (alerts.length === 0 ? (
                <p className="oxos-hint">No alerts yet — add one from Notifications.</p>
              ) : (
                alerts.slice(0, 5).map((a) => (
                  <div key={a.id} className="oxos-deskwd__row">
                    <span>
                      {a.symbol} {a.direction === "above" ? "↑" : "↓"} ${a.target}
                    </span>
                    <span>{a.triggered ? "Hit ✓" : "Armed"}</span>
                  </div>
                ))
              ))}
            {wdg.type === "countdown" && (
              <div className="oxos-deskwd__bignum">
                {wdg.targetDate
                  ? (() => {
                      const d = daysUntil(wdg.targetDate);
                      return d > 0 ? `${d} days left` : d === 0 ? "Today!" : `${Math.abs(d)} days ago`;
                    })()
                  : "Pick a date in Settings."}
              </div>
            )}
            {wdg.type === "quote" && (
              <p style={{ margin: 0, fontStyle: "italic" }}>“{quoteOfDay()}”</p>
            )}
            {wdg.type === "token" && (
              <TokenWidgetBody
                mint={wdg.mint}
                onMint={(m) => onUpdate(wdg.id, { mint: m })}
              />
            )}
            {wdg.type === "chart" && (
              <ChartWidgetBody
                mint={wdg.mint}
                onMint={(m) => onUpdate(wdg.id, { mint: m })}
              />
            )}
            {wdg.type === "market" && <MarketWidgetBody trending={trending} />}
            {wdg.type === "minichart" && <MiniChartWidgetBody />}
            {wdg.type === "tasks" && <TasksWidgetBody tasks={tasks} onToggle={onToggleTask} />}
            {wdg.type === "note" && (
              <NoteWidgetBody
                note={notes.find((n) => n.id === wdg.noteId)}
                notes={notes}
                onPick={(id) => onUpdate(wdg.id, { noteId: id })}
              />
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

/** Re-exported for tests / future use. */
export { fetchTokenQuote };
