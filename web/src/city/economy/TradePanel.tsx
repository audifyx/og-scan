/**
 * OrbitX City — in-world trading through the in-app (desk) wallet.
 *
 * Buys and sells execute through the Supercomputer MCP (orbitx_app_buy /
 * orbitx_app_sell) with the billing authCode — the backend signs from the
 * user's sealed desk wallet, no popups, no Phantom. Quotes come from
 * orbitx_trade_quote. Every fill shows a receipt with the tx signature +
 * Solscan link. Phone-first layout.
 */
import { useMemo, useState } from "react";
import { ArrowDownUp, X } from "lucide-react";
import { Connection, PublicKey } from "@solana/web3.js";
import { useOrbitxBilling } from "@/tokenomics/useOrbitxBilling";
import { getBillingAuthCode } from "@/tokenomics/auth";
import { callSupercomputerTool } from "@/tokenomics/mcpClient";
import { browserWalletRpcUrl } from "@/lib/solanaRpc";
import { ORBITX_MINT } from "@/tokenomics/constants";
import ReceiptModal from "./ReceiptModal";
import "./economy.css";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const QUICK = [
  { symbol: "ORBITX", mint: ORBITX_MINT },
  { symbol: "SOL", mint: SOL_MINT },
  { symbol: "USDC", mint: USDC_MINT },
];

type Quote = {
  outAmount: string;
  priceImpactPct: string;
};

async function fetchMintDecimals(mint: string): Promise<number> {
  try {
    const conn = new Connection(browserWalletRpcUrl(), "confirmed");
    const info = await conn.getParsedAccountInfo(new PublicKey(mint), "confirmed");
    const d = (info.value?.data as { parsed?: { info?: { decimals?: number } } } | null)?.parsed?.info?.decimals;
    return typeof d === "number" ? d : 9;
  } catch {
    return 9;
  }
}

function fmtBaseUnits(raw: string, decimals: number): string {
  try {
    const v = Number(raw) / Math.pow(10, decimals);
    if (!Number.isFinite(v)) return "—";
    return v.toLocaleString("en-US", { maximumFractionDigits: Math.min(6, decimals) });
  } catch {
    return "—";
  }
}

function mintLabel(mint: string): string {
  const q = QUICK.find((x) => x.mint === mint);
  return q ? q.symbol : `${mint.slice(0, 6)}…${mint.slice(-4)}`;
}

export default function TradePanel({ onClose }: { onClose: () => void }) {
  const billing = useOrbitxBilling();
  const authed = billing.ready && !!getBillingAuthCode();

  const [mode, setMode] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [mint, setMint] = useState(ORBITX_MINT);
  const [percent, setPercent] = useState("25");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteOut, setQuoteOut] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ title: string; rows: { label: string; value: string }[]; sig: string } | null>(null);

  const amt = Number(amount);
  const pct = Number(percent);
  const canQuote = useMemo(
    () => mode === "buy" && amt > 0 && mint.trim().length >= 32,
    [mode, amt, mint],
  );
  const canSell = useMemo(
    () => mode === "sell" && pct >= 1 && pct <= 100 && mint.trim().length >= 32,
    [mode, pct, mint],
  );

  async function fetchQuote() {
    if (!canQuote) return;
    setError(null);
    setQuote(null);
    setQuoteOut(null);
    setQuoting(true);
    try {
      const res = await callSupercomputerTool("orbitx_trade_quote", {
        mint: mint.trim(),
        amountSol: amt,
      });
      if (!res.ok) throw new Error(res.message || res.error || "Quote failed.");
      const q: Quote = {
        outAmount: String(res.outAmount ?? "0"),
        priceImpactPct: String(res.priceImpactPct ?? "0"),
      };
      setQuote(q);
      const dec = await fetchMintDecimals(mint.trim());
      setQuoteOut(fmtBaseUnits(q.outAmount, dec));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Quote failed.");
    } finally {
      setQuoting(false);
    }
  }

  function requireAuth(): string | null {
    const code = getBillingAuthCode();
    if (!code) {
      setError("Link your in-app wallet first — one tap, then trades are seamless.");
      return null;
    }
    return code;
  }

  async function executeBuy() {
    const code = requireAuth();
    if (!code || !quote) return;
    setError(null);
    setWorking(true);
    try {
      const res = await callSupercomputerTool("orbitx_app_buy", {
        authCode: code,
        mint: mint.trim(),
        amountSol: amt,
        payWith: "sol",
        slippageBps: 200,
      });
      if (!res.ok || typeof res.signature !== "string") {
        throw new Error(res.message || res.error || "Buy failed.");
      }
      setReceipt({
        title: "Buy complete",
        rows: [
          { label: "Paid", value: `${amt} SOL` },
          { label: "Received", value: `≈ ${quoteOut ?? "—"} ${mintLabel(mint.trim())}` },
        ],
        sig: res.signature,
      });
      setQuote(null);
      setAmount("");
      billing.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Buy failed.");
    } finally {
      setWorking(false);
    }
  }

  async function executeSell() {
    const code = requireAuth();
    if (!code || !canSell) return;
    setError(null);
    setWorking(true);
    try {
      const res = await callSupercomputerTool("orbitx_app_sell", {
        authCode: code,
        mint: mint.trim(),
        percent: pct,
        slippageBps: 200,
      });
      if (!res.ok || typeof res.signature !== "string") {
        throw new Error(res.message || res.error || "Sell failed.");
      }
      setReceipt({
        title: "Sell complete",
        rows: [
          { label: "Sold", value: `${pct}% of ${mintLabel(mint.trim())}` },
          { label: "Received", value: "SOL (market)" },
        ],
        sig: res.signature,
      });
      billing.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sell failed.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="oxe-overlay" role="dialog" aria-modal="true" aria-label="Trade">
      <div className="oxe-sheet">
        <div className="oxe-sheet-head">
          <div className="oxe-sheet-title">
            <ArrowDownUp className="oxe-ic" />
            <div>
              <div className="oxe-t1">TRADE</div>
              <div className="oxe-t2">In-app wallet · backend-signed · real on-chain swaps</div>
            </div>
          </div>
          <button className="oxe-x" onClick={onClose} aria-label="Close trade">
            <X />
          </button>
        </div>

        {!authed ? (
          <div className="oxe-notice">
            <div className="oxe-notice-t">Link your in-app wallet to trade</div>
            <div className="oxe-notice-s">
              One dashboard link, then every trade is signed by the backend — no popups, ever.
            </div>
            {billing.error && <div className="oxe-err oxe-err-block">{billing.error}</div>}
            <button className="oxe-btn oxe-btn-primary" onClick={() => billing.beginAuth()}>
              Link in-app wallet
            </button>
          </div>
        ) : (
          <>
            <div className="oxe-modes">
              <button
                className={`oxe-mode${mode === "buy" ? " oxe-mode-on" : ""}`}
                onClick={() => { setMode("buy"); setQuote(null); setError(null); }}
              >
                Buy
              </button>
              <button
                className={`oxe-mode${mode === "sell" ? " oxe-mode-on" : ""}`}
                onClick={() => { setMode("sell"); setQuote(null); setError(null); }}
              >
                Sell
              </button>
            </div>

            <div className="oxe-chips">
              {QUICK.map((q) => (
                <button
                  key={q.symbol}
                  className={`oxe-mini-chip${mint === q.mint ? " oxe-mini-chip-on" : ""}`}
                  onClick={() => { setMint(q.mint); setQuote(null); }}
                >
                  {q.symbol}
                </button>
              ))}
            </div>
            <div className="oxe-field">
              <label>Token mint</label>
              <input
                value={mint}
                onChange={(e) => { setMint(e.target.value.trim()); setQuote(null); }}
                placeholder="Paste token mint…"
                spellCheck={false}
              />
            </div>

            {mode === "buy" ? (
              <>
                <div className="oxe-field">
                  <label>Pay (SOL)</label>
                  <input
                    value={amount}
                    onChange={(e) => { setAmount(e.target.value.replace(/[^0-9.]/g, "")); setQuote(null); }}
                    placeholder="0.0"
                    inputMode="decimal"
                  />
                </div>

                {quote && quoteOut && (
                  <div className="oxe-quote">
                    <span>You get ≈</span>
                    <b>{quoteOut} {mintLabel(mint.trim())}</b>
                  </div>
                )}
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
                    <button className="oxe-btn oxe-btn-primary" onClick={executeBuy} disabled={working}>
                      {working ? "Buying…" : `Buy with ${amt} SOL`}
                    </button>
                  )}
                </div>
                <div className="oxe-t2 oxe-center">2% slippage · signed by the backend · no popup</div>
              </>
            ) : (
              <>
                <div className="oxe-field">
                  <label>Sell percent (1–100)</label>
                  <input
                    value={percent}
                    onChange={(e) => setPercent(e.target.value.replace(/[^0-9.]/g, ""))}
                    placeholder="25"
                    inputMode="decimal"
                  />
                </div>

                {error && <div className="oxe-err oxe-err-block">{error}</div>}

                <div className="oxe-actions">
                  <button className="oxe-btn oxe-btn-primary" onClick={executeSell} disabled={!canSell || working}>
                    {working ? "Selling…" : `Sell ${pct || "—"}% → SOL`}
                  </button>
                </div>
                <div className="oxe-t2 oxe-center">Market sell · 2% slippage · signed by the backend</div>
              </>
            )}
          </>
        )}
      </div>

      {receipt && (
        <ReceiptModal
          title={receipt.title}
          subtitle="Settled on-chain from your in-app wallet"
          rows={receipt.rows}
          signature={receipt.sig}
          onClose={() => setReceipt(null)}
        />
      )}
    </div>
  );
}
