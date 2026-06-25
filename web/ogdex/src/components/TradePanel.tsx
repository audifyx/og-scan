import { useState } from "react";
import { useWallet, getPhantom } from "../lib/wallet";
import { Wallet2, Loader2, ArrowDownUp, ExternalLink, CheckCircle2, AlertTriangle, ShieldCheck, X } from "lucide-react";

const BUY_PRESETS = [0.1, 0.25, 0.5, 1];
const SELL_PRESETS = [25, 50, 100];

export default function TradePanel({ mint, symbol }: { mint: string; symbol?: string }) {
  const { address, connect, connecting } = useWallet();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [buyAmt, setBuyAmt] = useState<string>("0.25");
  const [sellPct, setSellPct] = useState<number>(50);
  const [slippage, setSlippage] = useState<number>(10);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>("");
  const [sig, setSig] = useState<string>("");
  // Two-step flow: build the tx first, then require an explicit confirm that
  // triggers the Phantom approval popup. Nothing is ever sent automatically.
  const [pendingTx, setPendingTx] = useState<string | null>(null);

  const sym = symbol || "token";
  const summary = side === "buy" ? `Buy ${buyAmt || "0"} SOL of ${sym}` : `Sell ${sellPct}% of ${sym}`;

  // STEP 1 — click Buy/Sell: connect if needed, then BUILD the transaction.
  const build = async () => {
    setErr(""); setSig("");
    if (!address) { await connect(); return; }            // first click connects (Phantom prompt)
    if (!getPhantom()) { setErr("Phantom not found. Install it from phantom.app"); return; }
    const amount = side === "buy" ? Number(buyAmt) : `${sellPct}%`;
    if (side === "buy" && (!Number.isFinite(Number(buyAmt)) || Number(buyAmt) <= 0)) { setErr("Enter a valid SOL amount"); return; }

    setBusy(true);
    try {
      const r = await fetch("/api/ogdex/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicKey: address, action: side, mint, amount,
          denominatedInSol: side === "buy" ? "true" : "false",
          slippage, priorityFee: 0.00005, pool: "auto",
        }),
      });
      const d = await r.json();
      if (!d.ok || !d.tx) throw new Error(d.error || "Could not build transaction");
      setPendingTx(d.tx);                                  // hold it — wait for explicit confirm
    } catch (e: any) {
      setErr(e?.message || "Could not build transaction");
    } finally {
      setBusy(false);
    }
  };

  // STEP 2 — click "Confirm in Phantom": Phantom opens, user approves & sends.
  const confirm = async () => {
    const provider = getPhantom();
    if (!provider || !pendingTx) return;
    setErr(""); setBusy(true);
    try {
      const { VersionedTransaction } = await import("@solana/web3.js");
      const bytes = Uint8Array.from(atob(pendingTx), (c) => c.charCodeAt(0));
      const tx = VersionedTransaction.deserialize(bytes);
      const res = await provider.signAndSendTransaction(tx);  // <-- Phantom approval popup
      setSig(res.signature);
      setPendingTx(null);
    } catch (e: any) {
      setErr(e?.message?.includes("User rejected") || e?.message?.includes("rejected") ? "Transaction cancelled in Phantom" : (e?.message || "Trade failed"));
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => { setPendingTx(null); setErr(""); };

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold text-white">
          <ArrowDownUp className="h-4 w-4 text-accent" /> Trade {sym}
        </div>
        <span className="text-[10px] text-muted">Non-custodial · Phantom</span>
      </div>

      {/* Buy/Sell toggle (disabled while reviewing) */}
      <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-panel2/60 p-1">
        <button onClick={() => { setSide("buy"); cancel(); }} disabled={busy}
          className={`rounded-lg py-1.5 text-sm font-bold transition ${side === "buy" ? "bg-up/20 text-up" : "text-muted hover:text-white"}`}>Buy</button>
        <button onClick={() => { setSide("sell"); cancel(); }} disabled={busy}
          className={`rounded-lg py-1.5 text-sm font-bold transition ${side === "sell" ? "bg-down/20 text-down" : "text-muted hover:text-white"}`}>Sell</button>
      </div>

      {side === "buy" ? (
        <>
          <div className="mb-2 flex gap-1.5">
            {BUY_PRESETS.map((p) => (
              <button key={p} onClick={() => { setBuyAmt(String(p)); cancel(); }}
                className={`flex-1 rounded-lg border py-1.5 text-xs font-semibold transition ${buyAmt === String(p) ? "border-accent/50 bg-accent/10 text-accent" : "border-line bg-panel2/50 text-muted hover:text-white"}`}>{p}</button>
            ))}
          </div>
          <div className="relative mb-3">
            <input value={buyAmt} onChange={(e) => { setBuyAmt(e.target.value.replace(/[^0-9.]/g, "")); cancel(); }} inputMode="decimal"
              className="w-full rounded-lg border border-line bg-panel pr-12 pl-3 py-2 text-sm outline-none focus:border-accent/60" placeholder="0.0" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted">SOL</span>
          </div>
        </>
      ) : (
        <div className="mb-3 flex gap-1.5">
          {SELL_PRESETS.map((p) => (
            <button key={p} onClick={() => { setSellPct(p); cancel(); }}
              className={`flex-1 rounded-lg border py-1.5 text-xs font-semibold transition ${sellPct === p ? "border-down/50 bg-down/10 text-down" : "border-line bg-panel2/50 text-muted hover:text-white"}`}>{p}%</button>
          ))}
        </div>
      )}

      {/* slippage */}
      <div className="mb-3 flex items-center justify-between text-xs">
        <span className="text-muted">Slippage</span>
        <div className="flex gap-1">
          {[5, 10, 20].map((s) => (
            <button key={s} onClick={() => { setSlippage(s); cancel(); }}
              className={`rounded px-2 py-0.5 font-semibold transition ${slippage === s ? "bg-accent/15 text-accent" : "bg-panel2/60 text-muted hover:text-white"}`}>{s}%</button>
          ))}
        </div>
      </div>

      {/* STEP 2: review + explicit confirm */}
      {pendingTx ? (
        <div className="rounded-xl border border-accent/30 bg-accent/5 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-white mb-1"><ShieldCheck className="h-4 w-4 text-accent" /> Review &amp; confirm</div>
          <div className="text-xs text-muted mb-3">{summary} · {slippage}% slippage. Phantom will ask you to approve.</div>
          <div className="flex gap-2">
            <button onClick={confirm} disabled={busy}
              className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition disabled:opacity-60 ${side === "buy" ? "bg-up text-black hover:bg-up/90" : "bg-down text-white hover:bg-down/90"}`}>
              {busy ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Confirm in Phantom…</span>
                : <span className="inline-flex items-center gap-2"><Wallet2 className="h-4 w-4" /> Confirm in Phantom</span>}
            </button>
            <button onClick={cancel} disabled={busy} className="rounded-xl border border-line bg-panel2/60 px-3 text-muted hover:text-white"><X className="h-4 w-4" /></button>
          </div>
        </div>
      ) : (
        /* STEP 1: build */
        <button onClick={build} disabled={busy || connecting}
          className={`w-full rounded-xl py-2.5 text-sm font-bold transition disabled:opacity-60 ${side === "buy" ? "bg-up text-black hover:bg-up/90" : "bg-down text-white hover:bg-down/90"}`}>
          {busy ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Preparing…</span>
            : connecting ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Connecting…</span>
            : !address ? <span className="inline-flex items-center gap-2"><Wallet2 className="h-4 w-4" /> Connect Wallet</span>
            : summary}
        </button>
      )}

      {sig && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-up/25 bg-up/10 px-3 py-2 text-xs text-up">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> Order sent.
          <a href={`https://solscan.io/tx/${sig}`} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 font-semibold hover:underline">View <ExternalLink className="h-3 w-3" /></a>
        </div>
      )}
      {err && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-down/25 bg-down/10 px-3 py-2 text-xs text-down">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {err}
        </div>
      )}
      <p className="mt-2 text-center text-[10px] text-muted/70">OGDEX never holds your funds. You approve &amp; send every trade in Phantom.</p>
    </div>
  );
}
