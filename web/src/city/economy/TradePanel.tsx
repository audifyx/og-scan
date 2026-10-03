/**
 * OrbitX City — in-world trading (Jupiter).
 *
 * Pick input/output tokens, get a live quote, execute the swap. The player's
 * hub wallet (Phantom / Jupiter) signs in its own popup — real on-chain
 * swap, real signature, receipt with Solscan link. Phone-first layout.
 */
import { useEffect, useMemo, useState } from "react";
import { ArrowDownUp, Search, X } from "lucide-react";
import { useConnection, useWallet } from "@/wallets/hub";
import {
  buildJupSwapTransaction,
  defaultSwapTokens,
  fromBaseUnits,
  getJupQuote,
  searchJupTokens,
  toBaseUnits,
  type JupQuote,
  type JupTokenMeta,
} from "./jupiterSwap";
import ReceiptModal from "./ReceiptModal";
import "./economy.css";

function TokenPicker({
  label,
  value,
  exclude,
  onPick,
  onClose,
}: {
  label: string;
  value: JupTokenMeta;
  exclude: string;
  onPick: (t: JupTokenMeta) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<JupTokenMeta[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const r = await searchJupTokens(q.trim());
        setResults(r.filter((x) => x.address !== exclude));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [q, exclude]);

  return (
    <div className="oxe-overlay" role="dialog" aria-modal="true" aria-label={label}>
      <div className="oxe-sheet">
        <div className="oxe-sheet-head">
          <div className="oxe-sheet-title">
            <div>
              <div className="oxe-t1">{label}</div>
            </div>
          </div>
          <button className="oxe-x" onClick={onClose} aria-label="Close token picker">
            <X />
          </button>
        </div>
        <div className="oxe-search">
          <Search className="oxe-ic-sm" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search symbol or paste mint…"
            inputMode="search"
          />
        </div>
        <div className="oxe-tokenlist">
          {searching && <div className="oxe-t2">Searching…</div>}
          {!q.trim() && <div className="oxe-t2">Type to search Jupiter's token list.</div>}
          {results.map((t) => (
            <button
              key={t.address}
              className="oxe-tokenrow"
              onClick={() => {
                onPick(t);
                onClose();
              }}
            >
              <span className="oxe-token-sym">{t.symbol}</span>
              <span className="oxe-token-name">{t.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function TradePanel({ onClose }: { onClose: () => void }) {
  const { publicKey, connected, connect, sendTransaction } = useWallet();
  const { connection } = useConnection();

  const [tokens, setTokens] = useState<JupTokenMeta[]>([]);
  const [inToken, setInToken] = useState<JupTokenMeta | null>(null);
  const [outToken, setOutToken] = useState<JupTokenMeta | null>(null);
  const [amount, setAmount] = useState("");
  const [picker, setPicker] = useState<"in" | "out" | null>(null);
  const [quote, setQuote] = useState<JupQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ inAmt: string; outAmt: string; sig: string } | null>(null);

  useEffect(() => {
    defaultSwapTokens().then((t) => {
      setTokens(t);
      setInToken(t[0] ?? null);
      setOutToken(t[2] ?? t[1] ?? null);
    });
  }, []);

  const canQuote = useMemo(
    () => inToken && outToken && Number(amount) > 0 && inToken.address !== outToken.address,
    [inToken, outToken, amount],
  );

  async function fetchQuote() {
    if (!canQuote || !inToken || !outToken) return;
    setError(null);
    setQuote(null);
    setQuoting(true);
    try {
      const q = await getJupQuote(
        inToken.address,
        outToken.address,
        toBaseUnits(amount, inToken.decimals),
        100,
      );
      setQuote(q);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Quote failed.");
    } finally {
      setQuoting(false);
    }
  }

  async function execute() {
    if (!quote || !publicKey || !inToken || !outToken) return;
    setError(null);
    setSwapping(true);
    try {
      const tx = await buildJupSwapTransaction(quote, publicKey.toBase58());
      const sig = await sendTransaction(tx, connection, { maxRetries: 3 });
      setReceipt({
        inAmt: `${amount} ${inToken.symbol}`,
        outAmt: `${fromBaseUnits(quote.outAmount, outToken.decimals)} ${outToken.symbol}`,
        sig,
      });
      setQuote(null);
      setAmount("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Swap failed.");
    } finally {
      setSwapping(false);
    }
  }

  function flip() {
    setInToken(outToken);
    setOutToken(inToken);
    setQuote(null);
  }

  return (
    <div className="oxe-overlay" role="dialog" aria-modal="true" aria-label="Trade">
      <div className="oxe-sheet">
        <div className="oxe-sheet-head">
          <div className="oxe-sheet-title">
            <ArrowDownUp className="oxe-ic" />
            <div>
              <div className="oxe-t1">TRADE</div>
              <div className="oxe-t2">Jupiter · real on-chain swaps</div>
            </div>
          </div>
          <button className="oxe-x" onClick={onClose} aria-label="Close trade">
            <X />
          </button>
        </div>

        {!connected ? (
          <div className="oxe-notice">
            <div className="oxe-notice-t">Connect a wallet to trade</div>
            <div className="oxe-notice-s">Phantom or Jupiter — you sign every swap.</div>
            <button className="oxe-btn oxe-btn-primary" onClick={() => connect().catch(() => {})}>
              Connect wallet
            </button>
          </div>
        ) : (
          <>
            <div className="oxe-swaprow">
              <button className="oxe-tokbtn" onClick={() => setPicker("in")}>
                <span className="oxe-tokbtn-sym">{inToken?.symbol ?? "—"}</span>
                <span className="oxe-tokbtn-caret">▾</span>
              </button>
              <input
                className="oxe-amt"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value.replace(/[^0-9.]/g, ""));
                  setQuote(null);
                }}
                placeholder="0.0"
                inputMode="decimal"
              />
            </div>
            <button className="oxe-flip" onClick={flip} aria-label="Flip tokens">
              <ArrowDownUp className="oxe-ic-sm" />
            </button>
            <div className="oxe-swaprow">
              <button className="oxe-tokbtn" onClick={() => setPicker("out")}>
                <span className="oxe-tokbtn-sym">{outToken?.symbol ?? "—"}</span>
                <span className="oxe-tokbtn-caret">▾</span>
              </button>
              <div className="oxe-amt oxe-amt-out">
                {quote && outToken ? fromBaseUnits(quote.outAmount, outToken.decimals) : "—"}
              </div>
            </div>

            {quote && (
              <div className="oxe-quote">
                <span>Price impact</span>
                <b className={Number(quote.priceImpactPct) > 2 ? "oxe-warn" : ""}>
                  {Number(quote.priceImpactPct).toFixed(2)}%
                </b>
              </div>
            )}

            {error && <div className="oxe-err oxe-err-block">{error}</div>}

            <div className="oxe-actions">
              {!quote ? (
                <button className="oxe-btn oxe-btn-primary" onClick={fetchQuote} disabled={!canQuote || quoting}>
                  {quoting ? "Quoting…" : "Get quote"}
                </button>
              ) : (
                <button className="oxe-btn oxe-btn-primary" onClick={execute} disabled={swapping}>
                  {swapping ? "Swapping…" : `Swap ${inToken?.symbol} → ${outToken?.symbol}`}
                </button>
              )}
            </div>
            <div className="oxe-t2 oxe-center">1% slippage · you sign in your wallet</div>
          </>
        )}
      </div>

      {picker && inToken && outToken && (
        <TokenPicker
          label={picker === "in" ? "You pay" : "You receive"}
          value={picker === "in" ? inToken : outToken}
          exclude={picker === "in" ? outToken.address : inToken.address}
          onPick={(t) => {
            if (picker === "in") setInToken(t);
            else setOutToken(t);
            setQuote(null);
          }}
          onClose={() => setPicker(null)}
        />
      )}

      {receipt && (
        <ReceiptModal
          title="Swap complete"
          subtitle="Executed on Jupiter · settled on-chain"
          rows={[
            { label: "Paid", value: receipt.inAmt },
            { label: "Received", value: receipt.outAmt },
          ]}
          signature={receipt.sig}
          onClose={() => setReceipt(null)}
        />
      )}
    </div>
  );
}
