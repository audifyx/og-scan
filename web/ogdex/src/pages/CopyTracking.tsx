import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Copy, Eye, Zap, TrendingUp, TrendingDown, Loader2, Plus, Trash2, Bell, RefreshCw, ExternalLink } from "lucide-react";
import { useWallet } from "../lib/wallet";
import { short, fmtUsd, compact } from "../lib/api";

interface TrackedWallet {
  address: string;
  label?: string;
  addedAt: number;
}

interface Trade {
  wallet: string;
  mint: string;
  symbol?: string;
  side: "buy" | "sell";
  amountUsd: number;
  timestamp: number;
  txHash?: string;
}

const STORAGE_KEY = "ogdex_copy_wallets";

function getTracked(): TrackedWallet[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}
function saveTracked(list: TrackedWallet[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 10)));
}

export default function CopyTracking() {
  const { address } = useWallet();
  const [tracked, setTracked] = useState<TrackedWallet[]>(getTracked);
  const [input, setInput] = useState("");
  const [label, setLabel] = useState("");
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const add = () => {
    setErr("");
    const addr = input.trim();
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr)) {
      setErr("Invalid wallet address"); return;
    }
    if (tracked.some((t) => t.address === addr)) {
      setErr("Already tracking this wallet"); return;
    }
    if (tracked.length >= 10) {
      setErr("Max 10 wallets"); return;
    }
    const next = [...tracked, { address: addr, label: label.trim() || undefined, addedAt: Date.now() }];
    setTracked(next);
    saveTracked(next);
    setInput(""); setLabel("");
  };

  const remove = (addr: string) => {
    const next = tracked.filter((t) => t.address !== addr);
    setTracked(next);
    saveTracked(next);
  };

  const loadTrades = async () => {
    if (!tracked.length) { setTrades([]); return; }
    setLoading(true);
    try {
      const results = await Promise.allSettled(
        tracked.slice(0, 5).map((t) =>
          fetch(`/api/ogdex/wallet?address=${t.address}&trades=1`)
            .then((r) => r.json())
            .then((d) =>
              (d.trades || []).slice(0, 10).map((tr: any) => ({
                wallet: t.address,
                mint: tr.mint || tr.tokenAddress || "",
                symbol: tr.symbol || tr.tokenSymbol || null,
                side: (tr.type || tr.side || "buy").toLowerCase().includes("sell") ? "sell" : "buy",
                amountUsd: tr.amountUsd ?? tr.volumeUsd ?? 0,
                timestamp: tr.timestamp ?? tr.blockTime ?? Date.now() / 1000,
                txHash: tr.signature ?? tr.txHash ?? null,
              }))
            )
        )
      );
      const all: Trade[] = results
        .filter((r): r is PromiseFulfilledResult<Trade[]> => r.status === "fulfilled")
        .flatMap((r) => r.value)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 50);
      setTrades(all);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { loadTrades(); }, [tracked.length]);

  const now = Date.now() / 1000;
  const ago = (ts: number) => {
    const d = now - ts;
    if (d < 60) return `${Math.floor(d)}s ago`;
    if (d < 3600) return `${Math.floor(d / 60)}m ago`;
    return `${Math.floor(d / 3600)}h ago`;
  };

  return (
    <div className="max-w-2xl mx-auto py-6 px-4">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-white mb-5">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>

      <div className="flex items-center gap-2.5 mb-1">
        <Eye className="w-5 h-5 text-accent" />
        <h1 className="text-2xl font-black tracking-tight">Copy Tracking</h1>
      </div>
      <p className="text-xs text-muted mb-6">Track up to 10 wallets. See their recent trades in real time and get notified the moment they move.</p>

      {/* Add wallet */}
      <div className="card p-4 mb-5">
        <div className="text-sm font-bold mb-3">Track a Wallet</div>
        <div className="space-y-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Wallet address (Solana)"
            className="inp"
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (optional, e.g. 'Alpha KOL')"
            className="inp"
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          {err && <p className="text-xs text-down">{err}</p>}
          <button
            onClick={add}
            className="btn bg-accent text-black font-bold w-full inline-flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Track Wallet
          </button>
        </div>
      </div>

      {/* Tracked wallets list */}
      {tracked.length > 0 && (
        <div className="mb-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
            Tracking ({tracked.length}/10)
          </div>
          <div className="space-y-1.5">
            {tracked.map((t) => (
              <div key={t.address} className="card flex items-center gap-3 p-3">
                <Eye className="w-4 h-4 text-accent shrink-0" />
                <div className="flex-1 min-w-0">
                  {t.label && <div className="text-sm font-semibold text-white">{t.label}</div>}
                  <div className="text-[11px] font-mono text-muted truncate">{t.address}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Link to={`/wallet/${t.address}`}
                    className="p-1.5 rounded-lg text-muted hover:text-accent transition-colors">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                  <button onClick={() => remove(t.address)} className="p-1.5 rounded-lg text-muted hover:text-down transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live trade feed */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted">Recent Trades</div>
        <button onClick={loadTrades} disabled={loading} className="text-muted hover:text-white transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading ? (
        <div className="grid place-items-center py-12 text-muted">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : tracked.length === 0 ? (
        <div className="card p-8 text-center">
          <Eye className="w-10 h-10 text-muted/30 mx-auto mb-3" />
          <p className="text-sm text-muted">Add wallets above to see their trades here.</p>
        </div>
      ) : trades.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-muted">No recent trades found for tracked wallets.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {trades.map((tr, i) => {
            const tw = tracked.find((t) => t.address === tr.wallet);
            return (
              <div key={i} className="card p-3 flex items-center gap-3">
                <div className={`shrink-0 p-1.5 rounded-lg ${tr.side === "buy" ? "bg-up/15" : "bg-down/15"}`}>
                  {tr.side === "buy"
                    ? <TrendingUp className="w-3.5 h-3.5 text-up" />
                    : <TrendingDown className="w-3.5 h-3.5 text-down" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-mono text-muted">
                      {tw?.label || short(tr.wallet)}
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tr.side === "buy" ? "text-up bg-up/10" : "text-down bg-down/10"}`}>
                      {tr.side.toUpperCase()}
                    </span>
                    {tr.symbol && (
                      <Link to={`/token/${tr.mint}`} className="text-xs font-bold text-accent hover:underline">
                        {tr.symbol}
                      </Link>
                    )}
                  </div>
                  <div className="text-[10px] text-muted">{ago(tr.timestamp)}</div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-bold ${tr.side === "buy" ? "text-up" : "text-down"}`}>
                    {fmtUsd(tr.amountUsd)}
                  </div>
                  {tr.txHash && (
                    <a href={`https://solscan.io/tx/${tr.txHash}`} target="_blank" rel="noreferrer"
                      className="text-[10px] text-muted hover:text-accent">
                      view tx
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[10px] text-muted/50 mt-4 text-center">
        Copy tracking is informational only. OGDEX never auto-executes trades. You decide and sign every trade yourself.
      </p>
    </div>
  );
}
