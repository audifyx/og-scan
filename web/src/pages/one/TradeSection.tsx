import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWallet } from "./wallet";
import { useConnection } from "./wallet";
import { LAMPORTS_PER_SOL, Transaction, VersionedTransaction } from "@solana/web3.js";
import { TOKENS, tokenBySymbol } from "./tokens";
import { getQuote, buildSwapTransaction, formatUnits, type QuoteResult } from "./jupiter";
import { shortWallet } from "./mock";

export default function Trade() {
  const { publicKey, signTransaction, connected } = useWallet();
  const { connection } = useConnection();
  const [fromSym, setFromSym] = useState("SOL");
  const [toSym, setToSym] = useState("USDC");
  const [amount, setAmount] = useState("1");
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [qLoading, setQLoading] = useState(false);
  const [qErr, setQErr] = useState<string | null>(null);
  const [swapping, setSwapping] = useState(false);
  const [txSig, setTxSig] = useState<string | null>(null);
  const [solBal, setSolBal] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fromT = tokenBySymbol(fromSym);
  const toT = tokenBySymbol(toSym);

  const fetchQuote = useCallback(async () => {
    const n = parseFloat(amount);
    if (!n || n <= 0 || fromSym === toSym) { setQuote(null); return; }
    setQLoading(true); setQErr(null);
    try {
      const baseUnits = Math.floor(n * 10 ** fromT.decimals).toString();
      const q = await getQuote(fromT.mint, toT.mint, baseUnits);
      setQuote(q);
    } catch (e: any) {
      setQErr(e.message ?? "Quote failed");
      setQuote(null);
    } finally {
      setQLoading(false);
    }
  }, [amount, fromSym, toSym, fromT, toT]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(fetchQuote, 600);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [fetchQuote]);

  useEffect(() => {
    (async () => {
      if (!publicKey) { setSolBal(null); return; }
      try {
        const lamports = await connection.getBalance(publicKey);
        setSolBal(lamports / LAMPORTS_PER_SOL);
      } catch { setSolBal(null); }
    })();
  }, [publicKey, connection]);

  const flip = () => { setFromSym(toSym); setToSym(fromSym); };

  const doSwap = async () => {
    if (!publicKey || !signTransaction || !quote) return;
    setSwapping(true); setQErr(null); setTxSig(null);
    try {
      // 1. Build the swap transaction from the REAL Jupiter quote.
      const b64 = await buildSwapTransaction(quote.raw, publicKey.toBase58());
      const buf = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      // 2. Deserialize (v0 or legacy) — then the USER'S wallet signs. Never auto-signed.
      let tx: Transaction | VersionedTransaction;
      try { tx = VersionedTransaction.deserialize(buf); }
      catch { tx = Transaction.from(buf); }
      const signed = await signTransaction(tx as any);
      const raw = (signed as VersionedTransaction).serialize
        ? (signed as VersionedTransaction).serialize()
        : (signed as Transaction).serialize();
      const sig = await connection.sendRawTransaction(raw as any, { skipPreflight: false });
      setTxSig(sig);
    } catch (e: any) {
      setQErr(e.message?.includes("User rejected") ? "Signature rejected in wallet." : (e.message ?? "Swap failed"));
    } finally {
      setSwapping(false);
    }
  };

  const impact = quote ? parseFloat(quote.priceImpactPct) : 0;
  const canSwap = connected && !!quote && !swapping && !qLoading;

  const out = useMemo(
    () => (quote ? formatUnits(quote.outAmount, toT.decimals) : "—"),
    [quote, toT]
  );

  return (
    <div className="mode-wrap">
      <h2 className="section-title">📈 Trade — DEX</h2>
      <p className="section-sub">
        Real Jupiter quotes on Solana mainnet. You always sign in your own wallet — nothing auto-executes.
      </p>

      <div className="swap-box">
        <div className="token-row">
          <label>YOU PAY</label>
          <div className="token-select-row">
            <select className="token-select" value={fromSym} onChange={(e) => setFromSym(e.target.value)}>
              {TOKENS.map((t) => <option key={t.symbol} value={t.symbol}>{t.symbol}</option>)}
            </select>
            <input className="amount-input" inputMode="decimal" value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0.0" />
          </div>
        </div>

        <div className="swap-flip"><button onClick={flip} aria-label="Flip tokens">⇅</button></div>

        <div className="token-row">
          <label>YOU RECEIVE (EST.)</label>
          <div className="token-select-row">
            <select className="token-select" value={toSym} onChange={(e) => setToSym(e.target.value)}>
              {TOKENS.map((t) => <option key={t.symbol} value={t.symbol}>{t.symbol}</option>)}
            </select>
            <input className="amount-input" value={qLoading ? "…" : out} readOnly placeholder="—" />
          </div>
        </div>

        {quote && (
          <div className="quote-box">
            <div>Rate: <strong>1 {fromSym} ≈ {formatUnits(String(Math.floor((Number(quote.outAmount) / Number(quote.inAmount)) * 1e6)), 6)} {toSym}</strong></div>
            <div>Price impact: <strong className={impact < 1 ? "pos" : "neg"}>{impact.toFixed(2)}%</strong></div>
            <div style={{ fontSize: 11.5, opacity: .75 }}>via Jupiter · live mainnet quote</div>
          </div>
        )}
        {qErr && <div className="notice mt">{qErr}</div>}

        <button className="btn btn-primary btn-block" disabled={!canSwap} onClick={doSwap} style={{ marginTop: 18, padding: 15 }}>
          {!connected ? "Connect wallet to trade" : swapping ? "Sign in wallet…" : qLoading ? "Fetching quote…" : `Swap ${fromSym} → ${toSym}`}
        </button>

        {txSig && (
          <div className="quote-box" style={{ borderColor: "rgba(23,255,77,.5)" }}>
            ✅ Swap sent: <strong>{shortWallet(txSig)}</strong>
            <div><a href={`https://solscan.io/tx/${txSig}`} target="_blank" rel="noreferrer" style={{ color: "var(--neon)" }}>View on Solscan →</a></div>
          </div>
        )}
      </div>

      <div className="portfolio">
        <div className="card" style={{ maxWidth: 480, margin: "0 auto" }}>
          <div className="row-between">
            <h3 style={{ margin: 0 }}>💼 Portfolio</h3>
            {connected && <span className="badge live"><span className="live-dot" /> {shortWallet(publicKey?.toBase58())}</span>}
          </div>
          {!connected ? (
            <p className="mt">Connect your wallet to see balances.</p>
          ) : (
            <div className="nft-stats" style={{ marginTop: 14 }}>
              <div className="nft-stat"><div className="k">SOL BALANCE</div><div className="v">{solBal === null ? "…" : `◎ ${solBal.toFixed(4)}`}</div></div>
              <div className="nft-stat"><div className="k">NETWORK</div><div className="v">mainnet-beta</div></div>
            </div>
          )}
          <p style={{ fontSize: 12, marginTop: 10 }}>Full token holdings + P&amp;L history wire into the unified rep engine next.</p>
        </div>
      </div>
    </div>
  );
}
