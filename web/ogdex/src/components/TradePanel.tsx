import { useEffect, useState, useCallback } from "react";
import { useWallet, getPhantom } from "../lib/wallet";
import { getBalance, getSafety, SafetyCheck, fmtUsd, compact } from "../lib/api";
import { Wallet2, Loader2, ArrowDownUp, ExternalLink, CheckCircle2, AlertTriangle, ShieldCheck, ShieldAlert, X, RefreshCw } from "lucide-react";

const BUY_PRESETS = [0.1, 0.25, 0.5, 1];
const SELL_PRESETS = [25, 50, 100];
const SOL_FEE_BUFFER = 0.02; // leave a little SOL for fees

async function confirmTx(sig: string, ms = 30000): Promise<"ok" | "failed" | "timeout"> {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const r = await fetch("/api/ogdex/rpc", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "getSignatureStatuses", params: [[sig], { searchTransactionHistory: true }], id: 1 }) });
      const d = await r.json();
      const st = d?.result?.value?.[0];
      if (st) { if (st.err) return "failed"; if (st.confirmationStatus === "confirmed" || st.confirmationStatus === "finalized") return "ok"; }
    } catch { /* keep polling */ }
    await new Promise((res) => setTimeout(res, 1800));
  }
  return "timeout";
}

export default function TradePanel({ mint, symbol, price, icon }: { mint: string; symbol?: string; price?: number | null; icon?: string | null }) {
  const { address, connect, connecting } = useWallet();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [buyAmt, setBuyAmt] = useState<string>("0.25");
  const [sellPct, setSellPct] = useState<number>(50);
  const [slippage, setSlippage] = useState<number>(10);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string>("");
  const [err, setErr] = useState<string>("");
  const [sig, setSig] = useState<string>("");
  const [ok, setOk] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [bal, setBal] = useState<{ sol: number; uiAmount: number; decimals: number } | null>(null);
  const [loadingBal, setLoadingBal] = useState(false);
  const [safety, setSafety] = useState<SafetyCheck | null>(null);

  const sym = symbol || "token";

  const loadBal = useCallback(async () => {
    if (!address) { setBal(null); return; }
    setLoadingBal(true);
    try {
      const b = await getBalance(address, mint);
      if (b.ok) setBal({ sol: b.sol, uiAmount: b.token.uiAmount, decimals: b.token.decimals });
    } catch { /* ignore */ } finally { setLoadingBal(false); }
  }, [address, mint]);

  useEffect(() => { loadBal(); }, [loadBal]);
  useEffect(() => { let on = true; setSafety(null); getSafety(mint).then((x) => { if (on && x.ok) setSafety(x); }).catch(() => {}); return () => { on = false; }; }, [mint]);

  const reset = () => { setReviewing(false); setErr(""); };
  const tokenHeld = bal?.uiAmount || 0;
  const tokenUsd = price && tokenHeld ? tokenHeld * price : null;
  const sellTokens = tokenHeld * (sellPct / 100);
  const sellUsd = price ? sellTokens * price : null;
  const maxBuy = bal ? Math.max(0, bal.sol - SOL_FEE_BUFFER) : 0;
  const summary = side === "buy" ? `Buy ${buyAmt || "0"} SOL of ${sym}` : `Sell ${sellPct}% of ${sym}`;

  const review = async () => {
    setErr(""); setSig(""); setOk(false);
    if (!address) { await connect(); return; }
    if (!getPhantom()) { setErr("Phantom not found. Open this page in the Phantom app browser, or install Phantom."); return; }
    if (side === "buy") {
      const n = Number(buyAmt);
      if (!Number.isFinite(n) || n <= 0) { setErr("Enter a valid SOL amount"); return; }
      if (bal && n > bal.sol) { setErr(`Not enough SOL. You have ${bal.sol.toFixed(3)}`); return; }
    } else {
      if (tokenHeld <= 0) { setErr(`You don't hold any ${sym} to sell`); return; }
    }
    setReviewing(true);
  };

  const confirm = async () => {
    const provider = getPhantom();
    if (!provider) { setErr("Phantom not found."); return; }
    setErr(""); setSig(""); setOk(false); setBusy(true);
    try {
      setStage("Building transaction…");
      const amount = side === "buy" ? Number(buyAmt) : `${sellPct}%`;
      const r = await fetch("/api/ogdex/trade", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKey: address, action: side, mint, amount, denominatedInSol: side === "buy" ? "true" : "false", slippage, priorityFee: 0.0003, pool: "auto" }) });
      const d = await r.json();
      if (!d.ok || !d.tx) throw new Error(d.error || "Could not build transaction");
      setStage("Confirm in Phantom…");
      const { VersionedTransaction } = await import("@solana/web3.js");
      const bytes = Uint8Array.from(atob(d.tx), (c) => c.charCodeAt(0));
      const tx = VersionedTransaction.deserialize(bytes);
      const res = await provider.signAndSendTransaction(tx);
      const signature = res.signature || res;
      setSig(signature); setReviewing(false);
      setStage("Confirming on-chain…");
      const status = await confirmTx(signature);
      if (status === "failed") setErr("Transaction failed on-chain. Try a higher slippage and retry.");
      else { setOk(true); setTimeout(loadBal, 2500); }
    } catch (e: any) {
      const m = e?.message || "Trade failed";
      setErr(/reject/i.test(m) ? "Transaction cancelled in Phantom" : m);
    } finally { setBusy(false); setStage(""); }
  };

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold text-white"><ArrowDownUp className="h-4 w-4 text-accent" /> Trade {sym}</div>
        <span className="text-[10px] text-muted">Non-custodial · Phantom</span>
      </div>

      {safety && (
        <div className={`mb-3 rounded-xl border px-3 py-2 text-xs ${safety.tone === "good" ? "border-up/25 bg-up/10 text-up" : safety.tone === "warn" ? "border-yellow-400/25 bg-yellow-400/10 text-yellow-300" : "border-down/25 bg-down/10 text-down"}`}>
          <div className="flex items-center gap-1.5 font-semibold">
            {safety.tone === "good" ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
            {safety.canSell ? `Tradeable · ${safety.verdict}` : "Cannot sell — " + safety.verdict}
            {safety.roundTripLossPct != null && safety.canSell ? <span className="ml-auto font-normal opacity-80">round trip ~{safety.roundTripLossPct.toFixed(1)}%</span> : null}
          </div>
          {!safety.canSell && <div className="mt-1 text-[11px] font-normal">{safety.note}</div>}
        </div>
      )}

      {/* Holdings */}
      {address && (
        <div className="mb-3 rounded-xl border border-line bg-panel2/40 p-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted">Your balance</span>
            <button onClick={loadBal} className="text-muted hover:text-white" title="Refresh"><RefreshCw className={`h-3 w-3 ${loadingBal ? "animate-spin" : ""}`} /></button>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-white font-semibold">{bal ? bal.sol.toLocaleString(undefined, { maximumFractionDigits: 3 }) : "—"} SOL</span>
            <span className="text-white/90">{bal ? compact(tokenHeld) : "—"} {sym}{tokenUsd != null ? <span className="text-muted"> (~{fmtUsd(tokenUsd, { compact: true })})</span> : null}</span>
          </div>
        </div>
      )}

      <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-panel2/60 p-1">
        <button onClick={() => { setSide("buy"); reset(); }} disabled={busy} className={`rounded-lg py-1.5 text-sm font-bold transition ${side === "buy" ? "bg-up/20 text-up" : "text-muted hover:text-white"}`}>Buy</button>
        <button onClick={() => { setSide("sell"); reset(); }} disabled={busy} className={`rounded-lg py-1.5 text-sm font-bold transition ${side === "sell" ? "bg-down/20 text-down" : "text-muted hover:text-white"}`}>Sell</button>
      </div>

      {side === "buy" ? (
        <>
          <div className="mb-2 flex gap-1.5">
            {BUY_PRESETS.map((p) => (
              <button key={p} onClick={() => { setBuyAmt(String(p)); reset(); }} className={`flex-1 rounded-lg border py-1.5 text-xs font-semibold transition ${buyAmt === String(p) ? "border-accent/50 bg-accent/10 text-accent" : "border-line bg-panel2/50 text-muted hover:text-white"}`}>{p}</button>
            ))}
            {bal && maxBuy > 0 && (
              <button onClick={() => { setBuyAmt(maxBuy.toFixed(3)); reset(); }} className="flex-1 rounded-lg border border-line bg-panel2/50 py-1.5 text-xs font-semibold text-muted hover:text-white">Max</button>
            )}
          </div>
          <div className="relative mb-1">
            <input value={buyAmt} onChange={(e) => { setBuyAmt(e.target.value.replace(/[^0-9.]/g, "")); reset(); }} inputMode="decimal" className="w-full rounded-lg border border-line bg-panel pr-12 pl-3 py-2 text-sm outline-none focus:border-accent/60" placeholder="0.0" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted">SOL</span>
          </div>
          <div className="mb-3 text-[10px] text-muted">{price && Number(buyAmt) > 0 ? `≈ ${compact((Number(buyAmt) / price))} ${sym}` : "\u00a0"}</div>
        </>
      ) : (
        <>
          <div className="mb-1 flex gap-1.5">
            {SELL_PRESETS.map((p) => (
              <button key={p} onClick={() => { setSellPct(p); reset(); }} className={`flex-1 rounded-lg border py-1.5 text-xs font-semibold transition ${sellPct === p ? "border-down/50 bg-down/10 text-down" : "border-line bg-panel2/50 text-muted hover:text-white"}`}>{p}%</button>
            ))}
          </div>
          <div className="mb-3 text-[10px] text-muted">
            {tokenHeld > 0 ? `Selling ${sellPct}% ≈ ${compact(sellTokens)} ${sym}${sellUsd != null ? ` (~${fmtUsd(sellUsd, { compact: true })})` : ""}` : `No ${sym} in this wallet to sell`}
          </div>
        </>
      )}

      <div className="mb-3 flex items-center justify-between text-xs">
        <span className="text-muted">Slippage</span>
        <div className="flex gap-1">
          {[5, 10, 20].map((s) => (
            <button key={s} onClick={() => { setSlippage(s); reset(); }} className={`rounded px-2 py-0.5 font-semibold transition ${slippage === s ? "bg-accent/15 text-accent" : "bg-panel2/60 text-muted hover:text-white"}`}>{s}%</button>
          ))}
        </div>
      </div>

      {reviewing ? (
        <div className="rounded-xl border border-accent/30 bg-accent/5 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-white mb-1"><ShieldCheck className="h-4 w-4 text-accent" /> Review &amp; confirm</div>
          <div className="text-xs text-muted mb-3">{side === "sell" && tokenHeld > 0 ? `Sell ${compact(sellTokens)} ${sym}` : summary} · {slippage}% slippage. Phantom will ask you to approve.</div>
          <div className="flex gap-2">
            <button onClick={confirm} disabled={busy} className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition disabled:opacity-60 ${side === "buy" ? "bg-up text-black hover:bg-up/90" : "bg-down text-white hover:bg-down/90"}`}>
              {busy ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> {stage || "Working…"}</span> : <span className="inline-flex items-center gap-2"><Wallet2 className="h-4 w-4" /> Confirm in Phantom</span>}
            </button>
            <button onClick={reset} disabled={busy} className="rounded-xl border border-line bg-panel2/60 px-3 text-muted hover:text-white"><X className="h-4 w-4" /></button>
          </div>
        </div>
      ) : (
        <button onClick={review} disabled={busy || connecting || (side === "sell" && address != null && tokenHeld <= 0)}
          className={`w-full rounded-xl py-2.5 text-sm font-bold transition disabled:opacity-50 ${side === "buy" ? "bg-up text-black hover:bg-up/90" : "bg-down text-white hover:bg-down/90"}`}>
          {connecting ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Connecting…</span>
            : !address ? <span className="inline-flex items-center gap-2"><Wallet2 className="h-4 w-4" /> Connect Wallet</span>
            : side === "sell" && tokenHeld <= 0 ? `No ${sym} to sell`
            : summary}
        </button>
      )}

      {ok && sig && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-up/25 bg-up/10 px-3 py-2 text-xs text-up">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> Trade confirmed.
          <a href={`https://solscan.io/tx/${sig}`} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 font-semibold hover:underline">View <ExternalLink className="h-3 w-3" /></a>
        </div>
      )}
      {err && (
        <div className="mt-3 rounded-lg border border-down/25 bg-down/10 px-3 py-2 text-xs text-down">
          <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 shrink-0" /> {err}</div>
          {sig && <a href={`https://solscan.io/tx/${sig}`} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 font-semibold hover:underline">Inspect tx <ExternalLink className="h-3 w-3" /></a>}
        </div>
      )}
      <p className="mt-2 text-center text-[10px] text-muted/70">OGDEX never holds your funds. You approve &amp; send every trade in Phantom.</p>
    </div>
  );
}
