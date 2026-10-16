import React, { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity, BellPlus, BellRing, Calculator, Check, Clock, Copy, Download, FileText,
  Flame, Gauge, Hash, ListChecks, Loader2, Plus, ReceiptText, RefreshCw, Share2,
  ShieldAlert, Siren, StickyNote, Target, Trash2, TrendingUp, Trophy, Volume2,
  VolumeX, Wallet, X, Zap,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Shared types + helpers (self-contained, no sibling imports)         */
/* ------------------------------------------------------------------ */

export interface RpcTrade {
  signature: string;
  timestamp: number; /* unix seconds */
  side: "BUY" | "SELL" | "BURN" | "TRANSFER";
  tokenAmount: number;
  solAmount: number;
  wallet: string;
}

export interface Chain4Props {
  trades: RpcTrade[];
  burns?: RpcTrade[];
  solPrice?: number | null;
  price?: number | null;
  mcap?: number | null;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
}

function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor(Date.now() / 1000) - ts);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtUsd(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  const digits = abs >= 1000 ? 0 : 2;
  return (n < 0 ? "-$" : "$") + abs.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function shortAddr(a: string): string {
  return a && a.length > 8 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a || "—";
}

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — ignore */
  }
}

function sideColor(side: RpcTrade["side"]): string {
  switch (side) {
    case "BUY": return "bg-emerald-400/15 text-emerald-300";
    case "SELL": return "bg-rose-400/15 text-rose-300";
    case "BURN": return "bg-orange-400/15 text-orange-300";
    default: return "bg-zinc-400/15 text-zinc-300";
  }
}

function Shell({
  icon: Icon, title, children, className,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-white/10 bg-white/[0.03] p-3", className)}>
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-sky-300" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">{title}</h3>
      </div>
      {children}
    </div>
  );
}

interface ChainAlert { id: string; type: "buy" | "sell"; threshold: number; }
interface PortfolioEntry { id: string; tokenAmount: number; priceUsd: number; }

function tradeUsd(t: RpcTrade, solPrice?: number | null): number {
  return t.solAmount * (solPrice ?? 0);
}

function getPortfolio(): PortfolioEntry[] {
  return readJSON<PortfolioEntry[]>("orbitx-portfolio", []);
}

/* C76 */
export function WhaleSiren2({ trades, solPrice }: Chain4Props) {
  const [whale, setWhale] = useState<RpcTrade | null>(null);
  const seenRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (seenRef.current === 0) {
      seenRef.current = readJSON<number>("orbitx-siren2-seen", 0);
    }
    if (!trades.length || !solPrice) return;
    const fresh = trades.filter((t) => t.timestamp > seenRef.current);
    if (!fresh.length) return;
    const maxTs = Math.max(...fresh.map((t) => t.timestamp));
    seenRef.current = maxTs;
    writeJSON("orbitx-siren2-seen", maxTs);
    const big = fresh.find(
      (t) => (t.side === "BUY" || t.side === "SELL") && tradeUsd(t, solPrice) >= 2000
    );
    if (big) {
      setWhale(big);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setWhale(null), 8000);
    }
  }, [trades, solPrice]);

  return (
    <Shell icon={Siren} title="Whale Siren">
      {whale ? (
        <div className="animate-pulse rounded-xl border border-amber-400/40 bg-amber-400/10 p-2">
          <div className="text-xs font-bold text-amber-300">
            🐋 WHALE {whale.side} {fmtUsd(tradeUsd(whale, solPrice))}
          </div>
          <div className="mt-0.5 text-[11px] text-zinc-400">
            {whale.tokenAmount.toLocaleString()} tokens · {shortAddr(whale.wallet)} · {timeAgo(whale.timestamp)}
          </div>
        </div>
      ) : (
        <div className="text-xs text-zinc-500">monitoring… whale buys/sells ≥ $2,000 will flash here</div>
      )}
    </Shell>
  );
}

/* C77 */
export function TxExplorer({ trades }: Chain4Props) {
  const rows = [...trades].sort((a, b) => b.timestamp - a.timestamp).slice(0, 8);
  return (
    <Shell icon={ReceiptText} title="Tx Explorer">
      {rows.length === 0 ? (
        <div className="text-xs text-zinc-500">no trades in feed yet</div>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((t) => (
            <li key={t.signature}>
              <a
                href={`https://solscan.io/tx/${t.signature}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.04] px-2 py-1.5 text-xs hover:bg-white/[0.08]"
              >
                <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold", sideColor(t.side))}>
                  {t.side}
                </span>
                <span className="font-mono text-zinc-300">{t.solAmount.toFixed(3)} SOL</span>
                <span className="text-zinc-500">{timeAgo(t.timestamp)}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}

/* C78 */
export function CopyWallet({ trades, solPrice }: Chain4Props) {
  const [addr, setAddr] = useState("");
  const q = addr.trim().toLowerCase();
  const rows = q ? trades.filter((t) => t.wallet.toLowerCase() === q) : [];
  const buys = rows.filter((t) => t.side === "BUY").length;
  const sells = rows.filter((t) => t.side === "SELL").length;
  const volume = rows.reduce((s, t) => s + tradeUsd(t, solPrice), 0);
  return (
    <Shell icon={Copy} title="Copy Wallet">
      <input
        value={addr}
        onChange={(e) => setAddr(e.target.value)}
        placeholder="paste wallet address…"
        spellCheck={false}
        className="w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 font-mono text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-sky-400/50 focus:outline-none"
      />
      {!q ? (
        <div className="mt-2 text-xs text-zinc-500">enter a wallet to filter its trades</div>
      ) : rows.length === 0 ? (
        <div className="mt-2 text-xs text-zinc-500">no trades found for {shortAddr(addr.trim())}</div>
      ) : (
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-white/[0.04] p-2">
            <div className="text-sm font-bold text-emerald-300">{buys}</div>
            <div className="text-[10px] text-zinc-500">buys</div>
          </div>
          <div className="rounded-lg bg-white/[0.04] p-2">
            <div className="text-sm font-bold text-rose-300">{sells}</div>
            <div className="text-[10px] text-zinc-500">sells</div>
          </div>
          <div className="rounded-lg bg-white/[0.04] p-2">
            <div className="text-sm font-bold text-zinc-200">{fmtUsd(volume)}</div>
            <div className="text-[10px] text-zinc-500">volume</div>
          </div>
        </div>
      )}
    </Shell>
  );
}

/* C79 */
export function AlertBuilder(_props: Chain4Props) {
  const [type, setType] = useState<"buy" | "sell">("buy");
  const [threshold, setThreshold] = useState("");
  const [saved, setSaved] = useState(false);

  const save = () => {
    const amt = parseFloat(threshold);
    if (!amt || amt <= 0) return;
    const alerts = readJSON<ChainAlert[]>("orbitx-chain-alerts", []);
    alerts.push({ id: `${Date.now()}`, type, threshold: amt });
    writeJSON("orbitx-chain-alerts", alerts);
    setThreshold("");
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  };

  return (
    <Shell icon={BellPlus} title="Alert Builder">
      <div className="flex gap-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as "buy" | "sell")}
          className="rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-zinc-200 focus:outline-none"
        >
          <option value="buy">whale buy ≥ $</option>
          <option value="sell">sell ≥ $</option>
        </select>
        <input
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          placeholder="2000"
          inputMode="decimal"
          className="w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-sky-400/50 focus:outline-none"
        />
        <button
          onClick={save}
          className="flex items-center gap-1 rounded-lg bg-sky-500/20 px-3 py-1.5 text-xs font-semibold text-sky-300 hover:bg-sky-500/30"
        >
          {saved ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {saved ? "Saved" : "Add"}
        </button>
      </div>
      <div className="mt-1.5 text-[11px] text-zinc-500">alerts persist in this browser</div>
    </Shell>
  );
}

/* C80 */
export function AlertList({ trades, solPrice }: Chain4Props) {
  const [alerts, setAlerts] = useState<ChainAlert[]>([]);

  useEffect(() => {
    setAlerts(readJSON<ChainAlert[]>("orbitx-chain-alerts", []));
  }, [trades]);

  const remove = (id: string) => {
    const next = alerts.filter((a) => a.id !== id);
    setAlerts(next);
    writeJSON("orbitx-chain-alerts", next);
  };

  const isHit = (a: ChainAlert): boolean =>
    trades.some((t) => {
      const matches =
        (a.type === "buy" && t.side === "BUY") || (a.type === "sell" && t.side === "SELL");
      return matches && tradeUsd(t, solPrice) >= a.threshold;
    });

  return (
    <Shell icon={ListChecks} title="Alert List">
      {alerts.length === 0 ? (
        <div className="text-xs text-zinc-500">no saved alerts — build one above</div>
      ) : (
        <ul className="space-y-1.5">
          {alerts.map((a) => {
            const hit = isHit(a);
            return (
              <li
                key={a.id}
                className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.04] px-2 py-1.5 text-xs"
              >
                <span className="text-zinc-300">
                  {a.type === "buy" ? "🐋 buy" : "📉 sell"} ≥ {fmtUsd(a.threshold)}
                </span>
                <span className="flex items-center gap-2">
                  {hit && (
                    <span className="animate-pulse rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                      TRIGGERED
                    </span>
                  )}
                  <button
                    onClick={() => remove(a.id)}
                    aria-label="delete alert"
                    className="text-zinc-500 hover:text-rose-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Shell>
  );
}

/* C81 */
export function PortfolioTracker(_props: Chain4Props) {
  const [entries, setEntries] = useState<PortfolioEntry[]>(() => getPortfolio());
  const [amount, setAmount] = useState("");
  const [price, setPrice] = useState("");

  const persist = (next: PortfolioEntry[]) => {
    setEntries(next);
    writeJSON("orbitx-portfolio", next);
    window.dispatchEvent(new Event("orbitx-portfolio"));
  };

  const add = () => {
    const tokenAmount = parseFloat(amount);
    const priceUsd = parseFloat(price);
    if (!tokenAmount || tokenAmount <= 0 || !priceUsd || priceUsd <= 0) return;
    persist([...entries, { id: `${Date.now()}`, tokenAmount, priceUsd }]);
    setAmount("");
    setPrice("");
  };

  return (
    <Shell icon={Wallet} title="Portfolio Tracker">
      <div className="flex gap-2">
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="tokens"
          inputMode="decimal"
          className="w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-sky-400/50 focus:outline-none"
        />
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="entry $"
          inputMode="decimal"
          className="w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-sky-400/50 focus:outline-none"
        />
        <button
          onClick={add}
          aria-label="add entry"
          className="rounded-lg bg-sky-500/20 px-3 text-sky-300 hover:bg-sky-500/30"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      {entries.length === 0 ? (
        <div className="mt-2 text-xs text-zinc-500">no manual entries yet</div>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {entries.map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.04] px-2 py-1.5 text-xs"
            >
              <span className="text-zinc-300">
                {e.tokenAmount.toLocaleString()} @ {fmtUsd(e.priceUsd)}
              </span>
              <button
                onClick={() => persist(entries.filter((x) => x.id !== e.id))}
                aria-label="remove entry"
                className="text-zinc-500 hover:text-rose-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}

/* C82 */
export function CostBasis(_props: Chain4Props) {
  const [entries, setEntries] = useState<PortfolioEntry[]>(() => getPortfolio());

  useEffect(() => {
    const reload = () => setEntries(getPortfolio());
    window.addEventListener("orbitx-portfolio", reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener("orbitx-portfolio", reload);
      window.removeEventListener("storage", reload);
    };
  }, []);

  const totalTokens = entries.reduce((s, e) => s + e.tokenAmount, 0);
  const totalInvested = entries.reduce((s, e) => s + e.tokenAmount * e.priceUsd, 0);
  const avg = totalTokens > 0 ? totalInvested / totalTokens : null;

  return (
    <Shell icon={Calculator} title="Cost Basis">
      {entries.length === 0 ? (
        <div className="text-xs text-zinc-500">add entries in Portfolio Tracker to compute basis</div>
      ) : (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-white/[0.04] p-2">
            <div className="text-sm font-bold text-zinc-200">{avg !== null ? fmtUsd(avg) : "—"}</div>
            <div className="text-[10px] text-zinc-500">avg entry</div>
          </div>
          <div className="rounded-lg bg-white/[0.04] p-2">
            <div className="text-sm font-bold text-zinc-200">{totalTokens.toLocaleString()}</div>
            <div className="text-[10px] text-zinc-500">tokens</div>
          </div>
          <div className="rounded-lg bg-white/[0.04] p-2">
            <div className="text-sm font-bold text-zinc-200">{fmtUsd(totalInvested)}</div>
            <div className="text-[10px] text-zinc-500">invested</div>
          </div>
        </div>
      )}
    </Shell>
  );
}

/* C83 */
export function PNLCalc({ price }: Chain4Props) {
  const [entries, setEntries] = useState<PortfolioEntry[]>(() => getPortfolio());

  useEffect(() => {
    const reload = () => setEntries(getPortfolio());
    window.addEventListener("orbitx-portfolio", reload);
    return () => window.removeEventListener("orbitx-portfolio", reload);
  }, []);

  const totalTokens = entries.reduce((s, e) => s + e.tokenAmount, 0);
  const totalInvested = entries.reduce((s, e) => s + e.tokenAmount * e.priceUsd, 0);
  const avg = totalTokens > 0 ? totalInvested / totalTokens : null;
  const pnl = price != null && avg !== null ? (price - avg) * totalTokens : null;
  const pct = pnl !== null && totalInvested > 0 ? (pnl / totalInvested) * 100 : null;

  return (
    <Shell icon={TrendingUp} title="P&L Calc">
      {pnl === null ? (
        <div className="text-xs text-zinc-500">
          {price == null ? "waiting for live price…" : "add portfolio entries first"}
        </div>
      ) : (
        <div className={cn("rounded-xl border p-2", pnl >= 0 ? "border-emerald-400/30 bg-emerald-400/10" : "border-rose-400/30 bg-rose-400/10")}>
          <div className={cn("text-lg font-bold", pnl >= 0 ? "text-emerald-300" : "text-rose-300")}>
            {fmtUsd(pnl)}{" "}
            <span className="text-xs font-normal">
              ({pct !== null ? (pct >= 0 ? "+" : "") + pct.toFixed(1) + "%" : "—"})
            </span>
          </div>
          <div className="text-[11px] text-zinc-400">
            {totalTokens.toLocaleString()} tokens · avg {fmtUsd(avg)} → {fmtUsd(price)}
          </div>
        </div>
      )}
    </Shell>
  );
}

/* C84 */
export function QuickCalc({ price }: Chain4Props) {
  const [usdIn, setUsdIn] = useState("");
  const [tokIn, setTokIn] = useState("");
  const usd = parseFloat(usdIn);
  const tok = parseFloat(tokIn);
  const tokensOut = price && usd > 0 ? usd / price : null;
  const usdOut = price && tok > 0 ? tok * price : null;

  return (
    <Shell icon={Zap} title="Quick Calc">
      {price == null ? (
        <div className="text-xs text-zinc-500">waiting for live price…</div>
      ) : (
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <input
              value={usdIn}
              onChange={(e) => setUsdIn(e.target.value)}
              placeholder="$ USD"
              inputMode="decimal"
              className="w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-sky-400/50 focus:outline-none"
            />
            <span className="whitespace-nowrap font-mono text-sky-300">
              → {tokensOut !== null ? tokensOut.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"} tok
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={tokIn}
              onChange={(e) => setTokIn(e.target.value)}
              placeholder="tokens"
              inputMode="decimal"
              className="w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-sky-400/50 focus:outline-none"
            />
            <span className="whitespace-nowrap font-mono text-sky-300">
              → {usdOut !== null ? fmtUsd(usdOut) : "—"}
            </span>
          </div>
        </div>
      )}
    </Shell>
  );
}

/* C85 */
export function ExportCSV({ trades, solPrice }: Chain4Props) {
  const download = () => {
    const header = "time_iso,side,sol_amount,token_amount,wallet,signature\n";
    const rows = trades.map((t) =>
      [
        new Date(t.timestamp * 1000).toISOString(),
        t.side,
        t.solAmount,
        t.tokenAmount,
        t.wallet,
        t.signature,
      ].join(",")
    );
    const blob = new Blob([header + rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "orbitx-trades.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    void solPrice;
  };

  return (
    <Shell icon={Download} title="Export CSV">
      <button
        onClick={download}
        disabled={trades.length === 0}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-500/20 px-3 py-2 text-xs font-semibold text-sky-300 hover:bg-sky-500/30 disabled:opacity-40"
      >
        <Download className="h-4 w-4" />
        Download {trades.length} trades
      </button>
    </Shell>
  );
}

/* C86 */
export function ShareStats({ trades, solPrice, price }: Chain4Props) {
  const [copied, setCopied] = useState(false);

  const net = trades.reduce((s, t) => {
    const usd = tradeUsd(t, solPrice);
    if (t.side === "BUY") return s + usd;
    if (t.side === "SELL") return s - usd;
    return s;
  }, 0);

  const copy = async () => {
    const text = `ORBITX: ${fmtUsd(price)} | ${trades.length} trades | net flow ${fmtUsd(net)}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <Shell icon={Share2} title="Share Stats">
      <div className="mb-2 rounded-lg bg-white/[0.04] p-2 font-mono text-[11px] text-zinc-400">
        ORBITX: {fmtUsd(price)} | {trades.length} trades | net flow {fmtUsd(net)}
      </div>
      <button
        onClick={copy}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-500/20 px-3 py-2 text-xs font-semibold text-sky-300 hover:bg-sky-500/30"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? "Copied!" : "Copy to clipboard"}
      </button>
    </Shell>
  );
}

/* C87 */
export function VolumeAlert({ trades, solPrice }: Chain4Props) {
  const now = Math.floor(Date.now() / 1000);
  const usd = (t: RpcTrade) => tradeUsd(t, solPrice);
  const last10 = trades.filter((t) => now - t.timestamp <= 600).reduce((s, t) => s + usd(t), 0);
  const prev10 = trades
    .filter((t) => now - t.timestamp > 600 && now - t.timestamp <= 1200)
    .reduce((s, t) => s + usd(t), 0);
  const spike = prev10 > 0 && last10 > 2 * prev10;

  return (
    <Shell icon={Volume2} title="Volume Alert">
      {spike ? (
        <div className="animate-pulse rounded-xl border border-amber-400/40 bg-amber-400/10 p-2 text-xs font-bold text-amber-300">
          📢 Volume spike — last 10m {fmtUsd(last10)} vs prior 10m {fmtUsd(prev10)}
        </div>
      ) : (
        <div className="text-xs text-zinc-500">
          10m volume {fmtUsd(last10)} · prior {fmtUsd(prev10)} — no spike
        </div>
      )}
    </Shell>
  );
}

/* C88 */
export function RefreshControl({ onRefresh }: Chain4Props) {
  const [spinning, setSpinning] = useState(false);
  const refresh = () => {
    setSpinning(true);
    onRefresh?.();
    window.setTimeout(() => setSpinning(false), 800);
  };
  return (
    <Shell icon={RefreshCw} title="Refresh Control">
      <button
        onClick={refresh}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-500/20 px-3 py-2 text-xs font-semibold text-sky-300 hover:bg-sky-500/30"
      >
        <RefreshCw className={cn("h-4 w-4", spinning && "animate-spin")} />
        Refresh feed
      </button>
      <div className="mt-1.5 text-center text-[11px] text-zinc-500">feed interval · ~12s poll</div>
    </Shell>
  );
}

/* C89 */
export function DataStatus({ trades, loading, error }: Chain4Props) {
  return (
    <Shell icon={Activity} title="Data Status">
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin text-sky-300" />
          loading on-chain feed…
        </div>
      ) : error ? (
        <div className="rounded-lg border border-rose-400/30 bg-rose-400/10 p-2 text-xs text-rose-300">
          {error}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-zinc-300">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          Live · {trades.length} trades tracked
        </div>
      )}
    </Shell>
  );
}

/* C90 */
export function FeedLatency({ trades }: Chain4Props) {
  const [, setTick] = useState(0);
  const newest = trades.length ? Math.max(...trades.map((t) => t.timestamp)) : null;

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 5000);
    return () => window.clearInterval(id);
  }, []);

  const age = newest !== null ? Math.max(0, Math.floor(Date.now() / 1000) - newest) : null;

  return (
    <Shell icon={Clock} title="Feed Latency">
      <div className="text-xs text-zinc-300">
        {age === null ? (
          <span className="text-zinc-500">no data yet</span>
        ) : (
          <>data <span className="font-mono font-bold text-sky-300">{age}s</span> old</>
        )}
      </div>
      <div className="mt-1 text-[11px] text-zinc-500">ticks every 5s</div>
    </Shell>
  );
}

/* C91 */
export function TradeCounter({ trades }: Chain4Props) {
  const [session, setSession] = useState(() => readJSON<number>("orbitx-trades-seen", 0));

  useEffect(() => {
    const n = new Set(trades.map((t) => t.signature)).size;
    setSession((prev) => {
      const next = Math.max(prev, n);
      if (next !== prev) writeJSON("orbitx-trades-seen", next);
      return next;
    });
  }, [trades]);

  return (
    <Shell icon={Hash} title="Trade Counter">
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-lg bg-white/[0.04] p-2">
          <div className="text-lg font-bold text-zinc-100">{trades.length}</div>
          <div className="text-[10px] text-zinc-500">feed total</div>
        </div>
        <div className="rounded-lg bg-white/[0.04] p-2">
          <div className="text-lg font-bold text-zinc-100">{session}</div>
          <div className="text-[10px] text-zinc-500">session max</div>
        </div>
      </div>
    </Shell>
  );
}

/* C92 */
export function SessionBiggest({ trades, solPrice }: Chain4Props) {
  const big = trades.length
    ? trades.reduce((a, b) => (tradeUsd(b, solPrice) > tradeUsd(a, solPrice) ? b : a))
    : null;

  return (
    <Shell icon={Trophy} title="Session Biggest">
      {!big ? (
        <div className="text-xs text-zinc-500">no trades in feed yet</div>
      ) : (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-2">
          <div className="flex items-center justify-between">
            <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold", sideColor(big.side))}>
              {big.side}
            </span>
            <span className="font-mono text-sm font-bold text-amber-300">
              {fmtUsd(tradeUsd(big, solPrice))}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-zinc-400">
            {big.solAmount.toFixed(3)} SOL · {big.tokenAmount.toLocaleString()} tokens · {shortAddr(big.wallet)} · {timeAgo(big.timestamp)}
          </div>
        </div>
      )}
    </Shell>
  );
}

/* C93 */
export function NotifyToggle({ trades, solPrice }: Chain4Props) {
  const [on, setOn] = useState(() => readJSON<boolean>("orbitx-notify", false));
  const seenRef = useRef<number>(0);

  const toggle = async () => {
    if (!on) {
      try {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") return;
      } catch {
        return;
      }
    }
    const next = !on;
    setOn(next);
    writeJSON("orbitx-notify", next);
  };

  useEffect(() => {
    if (!on || !solPrice || !trades.length) return;
    const maxTs = Math.max(...trades.map((t) => t.timestamp));
    if (seenRef.current === 0) {
      seenRef.current = maxTs;
      return;
    }
    const fresh = trades.filter((t) => t.timestamp > seenRef.current);
    seenRef.current = maxTs;
    for (const t of fresh) {
      if ((t.side === "BUY" || t.side === "SELL") && tradeUsd(t, solPrice) >= 2000) {
        try {
          new Notification("🐋 Whale buy", {
            body: `${t.side} ${fmtUsd(tradeUsd(t, solPrice))} · ${shortAddr(t.wallet)}`,
          });
        } catch {
          /* notifications blocked */
        }
      }
    }
  }, [trades, on, solPrice]);

  return (
    <Shell icon={BellRing} title="Notify Toggle">
      <button
        onClick={toggle}
        className={cn(
          "flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold",
          on ? "bg-emerald-500/20 text-emerald-300" : "bg-white/[0.05] text-zinc-400"
        )}
      >
        <span>🐋 Whale notifications</span>
        <span
          className={cn(
            "relative h-5 w-9 rounded-full transition-colors",
            on ? "bg-emerald-400/60" : "bg-white/10"
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all",
              on ? "left-[18px]" : "left-0.5"
            )}
          />
        </span>
      </button>
    </Shell>
  );
}

/* C94 */
export function SoundToggle({ trades, solPrice }: Chain4Props) {
  const [on, setOn] = useState(() => readJSON<boolean>("orbitx-sound", false));
  const audioRef = useRef<AudioContext | null>(null);
  const seenRef = useRef<number>(0);

  const beep = () => {
    const ctx = audioRef.current;
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch {
      /* audio unavailable */
    }
  };

  const toggle = () => {
    const next = !on;
    if (next && !audioRef.current) {
      try {
        audioRef.current = new AudioContext();
      } catch {
        return;
      }
    }
    if (audioRef.current && audioRef.current.state === "suspended") {
      void audioRef.current.resume();
    }
    setOn(next);
    writeJSON("orbitx-sound", next);
    if (next) beep();
  };

  useEffect(() => {
    if (!on || !solPrice || !trades.length) return;
    const maxTs = Math.max(...trades.map((t) => t.timestamp));
    if (seenRef.current === 0) {
      seenRef.current = maxTs;
      return;
    }
    const fresh = trades.filter((t) => t.timestamp > seenRef.current);
    seenRef.current = maxTs;
    if (fresh.some((t) => (t.side === "BUY" || t.side === "SELL") && tradeUsd(t, solPrice) >= 2000)) {
      beep();
    }
  }, [trades, on, solPrice]);

  return (
    <Shell icon={on ? Volume2 : VolumeX} title="Sound Toggle">
      <button
        onClick={toggle}
        className={cn(
          "flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold",
          on ? "bg-emerald-500/20 text-emerald-300" : "bg-white/[0.05] text-zinc-400"
        )}
      >
        <span>🔔 Whale beep</span>
        <span
          className={cn(
            "relative h-5 w-9 rounded-full transition-colors",
            on ? "bg-emerald-400/60" : "bg-white/10"
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all",
              on ? "left-[18px]" : "left-0.5"
            )}
          />
        </span>
      </button>
    </Shell>
  );
}

/* C95 */
export function WatchNotes(_props: Chain4Props) {
  const [notes, setNotes] = useState(() => readJSON<string>("orbitx-watch-notes", ""));
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const timerRef = useRef<number | null>(null);

  const onChange = (v: string) => {
    setNotes(v);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      writeJSON("orbitx-watch-notes", v);
      setSavedAt(Date.now());
    }, 500);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <Shell icon={StickyNote} title="Watch Notes">
      <textarea
        value={notes}
        onChange={(e) => onChange(e.target.value)}
        placeholder="per-token notes… wallet behavior, price levels, things to watch"
        rows={4}
        className="w-full resize-none rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-sky-400/50 focus:outline-none"
      />
      <div className="mt-1 text-[11px] text-zinc-500">
        {savedAt ? `saved ${timeAgo(Math.floor(savedAt / 1000))}` : "auto-saves as you type"}
      </div>
    </Shell>
  );
}

/* C96 */
export function BurnAlert({ burns = [] }: Chain4Props) {
  const [latest, setLatest] = useState<RpcTrade | null>(null);
  const seenRef = useRef<number>(0);

  useEffect(() => {
    if (!burns.length) return;
    const maxTs = Math.max(...burns.map((b) => b.timestamp));
    if (seenRef.current === 0) {
      const stored = readJSON<number>("orbitx-burn-seen", 0);
      seenRef.current = stored || maxTs;
      if (!stored) writeJSON("orbitx-burn-seen", maxTs);
      return;
    }
    const fresh = burns.filter((b) => b.timestamp > seenRef.current);
    if (fresh.length) {
      fresh.sort((a, b) => b.timestamp - a.timestamp);
      setLatest(fresh[0]);
      seenRef.current = fresh[0].timestamp;
      writeJSON("orbitx-burn-seen", fresh[0].timestamp);
    }
  }, [burns]);

  return (
    <Shell icon={Flame} title="Burn Alert">
      {latest ? (
        <div className="rounded-xl border border-orange-400/40 bg-orange-400/10 p-2">
          <div className="flex items-center justify-between">
            <div className="animate-pulse text-xs font-bold text-orange-300">
              🔥 NEW BURN · {latest.tokenAmount.toLocaleString()} tokens
            </div>
            <button
              onClick={() => setLatest(null)}
              aria-label="dismiss"
              className="text-zinc-500 hover:text-zinc-300"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mt-0.5 text-[11px] text-zinc-400">
            {timeAgo(latest.timestamp)} · {shortAddr(latest.wallet)}
          </div>
        </div>
      ) : (
        <div className="text-xs text-zinc-500">
          {burns.length ? `${burns.length} burn(s) tracked — watching for new ones` : "no burns in feed — watching"}
        </div>
      )}
    </Shell>
  );
}

/* C97 */
export function PriceTarget({ price }: Chain4Props) {
  const [target, setTarget] = useState(() => readJSON<string>("orbitx-price-target", ""));
  const t = parseFloat(target);
  const valid = t > 0;
  const hit = valid && price != null && price >= t;
  const pct = valid && price != null ? Math.min(100, (price / t) * 100) : 0;

  const onChange = (v: string) => {
    setTarget(v);
    writeJSON("orbitx-price-target", v);
  };

  return (
    <Shell icon={Target} title="Price Target">
      <input
        value={target}
        onChange={(e) => onChange(e.target.value)}
        placeholder="target price $"
        inputMode="decimal"
        className="w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-sky-400/50 focus:outline-none"
      />
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className={cn("h-full rounded-full transition-all", hit ? "bg-amber-300" : "bg-sky-400")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-xs">
        <span className="text-zinc-500">
          {fmtUsd(price)} / {valid ? fmtUsd(t) : "—"} · {pct.toFixed(0)}%
        </span>
        {hit && <span className="animate-pulse font-bold text-amber-300">🎯 HIT</span>}
      </div>
    </Shell>
  );
}

/* C98 */
export function MCapTarget({ mcap }: Chain4Props) {
  const [target, setTarget] = useState(() => readJSON<string>("orbitx-mcap-target", ""));
  const t = parseFloat(target);
  const valid = t > 0;
  const hit = valid && mcap != null && mcap >= t;
  const pct = valid && mcap != null ? Math.min(100, (mcap / t) * 100) : 0;

  const onChange = (v: string) => {
    setTarget(v);
    writeJSON("orbitx-mcap-target", v);
  };

  return (
    <Shell icon={Gauge} title="MCap Target">
      <input
        value={target}
        onChange={(e) => onChange(e.target.value)}
        placeholder="target mcap $"
        inputMode="decimal"
        className="w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-sky-400/50 focus:outline-none"
      />
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className={cn("h-full rounded-full transition-all", hit ? "bg-amber-300" : "bg-violet-400")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-xs">
        <span className="text-zinc-500">
          {fmtUsd(mcap)} / {valid ? fmtUsd(t) : "—"} · {pct.toFixed(0)}%
        </span>
        {hit && <span className="animate-pulse font-bold text-amber-300">🎯 HIT</span>}
      </div>
    </Shell>
  );
}

/* C99 */
export function DisclaimerCard(_props: Chain4Props) {
  return (
    <Shell icon={ShieldAlert} title="Disclaimer">
      <p className="text-[11px] leading-relaxed text-zinc-500">
        Not financial advice. On-chain data is windowed and may be incomplete. DYOR.
      </p>
    </Shell>
  );
}

/* C100 */
export function ChainSummary({ trades, solPrice }: Chain4Props) {
  if (!trades.length) {
    return (
      <Shell icon={FileText} title="Chain Summary">
        <p className="text-xs leading-relaxed text-zinc-500">
          No trades in the current window yet — monitoring for fresh on-chain activity.
        </p>
      </Shell>
    );
  }

  const usd = (t: RpcTrade) => tradeUsd(t, solPrice);
  const buys = trades.filter((t) => t.side === "BUY");
  const sells = trades.filter((t) => t.side === "SELL");
  const net = buys.reduce((s, t) => s + usd(t), 0) - sells.reduce((s, t) => s + usd(t), 0);
  const big = trades.reduce((a, b) => (usd(b) > usd(a) ? b : a));

  const sorted = [...trades].sort((a, b) => a.timestamp - b.timestamp);
  let streakSide = sorted[0].side;
  let streakLen = 1;
  let bestSide = streakSide;
  let bestLen = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].side === streakSide) {
      streakLen++;
    } else {
      streakSide = sorted[i].side;
      streakLen = 1;
    }
    if (streakLen > bestLen) {
      bestLen = streakLen;
      bestSide = streakSide;
    }
  }

  const vals = trades.map(usd);
  const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
  const sd = Math.sqrt(vals.reduce((s, v) => s + (v - mean) * (v - mean), 0) / vals.length);
  const cv = mean > 0 ? sd / mean : 0;
  const volWord = cv < 0.5 ? "calm" : cv < 1 ? "active" : cv < 1.5 ? "volatile" : "wild";

  return (
    <Shell icon={FileText} title="Chain Summary">
      <p className="text-xs leading-relaxed text-zinc-300">
        Tracking {trades.length} trades ({buys.length} buys vs {sells.length} sells) with net flow{" "}
        <span className={net >= 0 ? "font-semibold text-emerald-300" : "font-semibold text-rose-300"}>
          {fmtUsd(net)}
        </span>
        . The largest print was a {big.side.toLowerCase()} of{" "}
        <span className="font-semibold text-zinc-100">{fmtUsd(usd(big))}</span> from{" "}
        {shortAddr(big.wallet)} {timeAgo(big.timestamp)}. Longest streak: {bestLen}{" "}
        {bestSide.toLowerCase()}
        {bestLen > 1 ? "s" : ""} in a row. Trade sizes look {volWord} right now.
      </p>
    </Shell>
  );
}
