import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";
import { ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { jupQuote, jupSwapTransaction, SOL_MINT, type JupQuote } from "@/lib/og";
import { fetchTokenChart, fetchTokenDetail } from "@/lib/orbitxcity/tokenApi";
import { fmtPct, fmtUsd, shortMint } from "@/lib/orbitxcity/marketData";
import { useCity } from "@/pages/orbitxcity/CityProvider";
import { Link } from "react-router-dom";

const PRESETS = [0.1, 0.25, 0.5, 1];

/** Real Jupiter buy flow for an in-world token (billboard / marketplace). */
export function TokenBuyPanel() {
  const { selectedMint } = useCity();
  const { connection } = useConnection();
  const { publicKey, connected, signTransaction } = useWallet();
  const [amount, setAmount] = useState("0.1");
  const [quote, setQuote] = useState<JupQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [buying, setBuying] = useState(false);

  const { data: token, isLoading } = useQuery({
    queryKey: ["oxc-token", selectedMint],
    queryFn: () => fetchTokenDetail(selectedMint!),
    enabled: !!selectedMint,
    refetchInterval: 20_000,
  });

  const { data: candles } = useQuery({
    queryKey: ["oxc-chart", selectedMint],
    queryFn: () => fetchTokenChart(selectedMint!, "1h", 40),
    enabled: !!selectedMint,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!selectedMint) return;
    let live = true;
    const run = async () => {
      const sol = Number(amount);
      if (!Number.isFinite(sol) || sol <= 0) {
        setQuote(null);
        return;
      }
      setQuoting(true);
      try {
        const lamports = Math.floor(sol * 1e9).toString();
        const q = await jupQuote(SOL_MINT, selectedMint, lamports, 100);
        if (live) setQuote(q);
      } catch {
        if (live) setQuote(null);
      } finally {
        if (live) setQuoting(false);
      }
    };
    const t = setTimeout(run, 350);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [selectedMint, amount]);

  const buy = async () => {
    if (!selectedMint) return;
    if (!connected || !publicKey || !signTransaction) {
      toast.error("Connect your wallet to buy");
      return;
    }
    if (!quote) {
      toast.error("No quote yet");
      return;
    }
    setBuying(true);
    try {
      const b64 = await jupSwapTransaction(quote, publicKey.toBase58());
      const tx = VersionedTransaction.deserialize(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
      const signed = await signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false, maxRetries: 3 });
      toast.success(`Bought $${token?.symbol ?? "token"}`, {
        description: `sig ${sig.slice(0, 8)}…`,
        action: {
          label: "Solscan",
          onClick: () => window.open(`https://solscan.io/tx/${sig}`, "_blank"),
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Buy failed");
    } finally {
      setBuying(false);
    }
  };

  if (!selectedMint) {
    return <div className="oxc-muted">Select a token from a billboard or the marketplace.</div>;
  }

  const decimals = token?.decimals ?? 6;
  const outUi = quote
    ? (Number(quote.outAmount) / 10 ** decimals).toLocaleString(undefined, { maximumFractionDigits: 2 })
    : "—";
  const spark = candles ?? [];

  return (
    <div className="oxc-stack">
      {isLoading && <div className="oxc-muted">Loading token…</div>}
      <div className="oxc-token-hero">
        {token?.icon ? <img src={token.icon} alt="" className="oxc-token-icon" /> : <div className="oxc-token-icon placeholder">$</div>}
        <div>
          <div className="oxc-tile-title">
            {token?.name ?? "Token"} <span className="oxc-sym">${token?.symbol ?? "???"}</span>
          </div>
          <div className="oxc-muted">{shortMint(selectedMint, 6)}</div>
        </div>
        <div className="oxc-token-stats">
          <span>{fmtUsd(token?.priceUsd)}</span>
          <span className={Number(token?.change24h) >= 0 ? "up" : "down"}>{fmtPct(token?.change24h)}</span>
        </div>
      </div>

      <div className="oxc-stat-row">
        <div><small>MCAP</small><b>{fmtUsd(token?.mcap)}</b></div>
        <div><small>VOL 24H</small><b>{fmtUsd(token?.volume24h)}</b></div>
        <div><small>LIQ</small><b>{fmtUsd(token?.liquidity)}</b></div>
      </div>

      {spark.length > 1 && (
        <svg className="oxc-spark" viewBox="0 0 200 48" preserveAspectRatio="none">
          <polyline
            fill="none"
            stroke="#17ff4d"
            strokeWidth="1.5"
            points={spark
              .map((c, i) => {
                const xs = spark.map((s) => s.close);
                const min = Math.min(...xs);
                const max = Math.max(...xs);
                const range = max - min || 1;
                const x = (i / (spark.length - 1)) * 200;
                const y = 44 - ((c.close - min) / range) * 40;
                return `${x},${y}`;
              })
              .join(" ")}
          />
        </svg>
      )}

      <div className="oxc-section-label">Buy with SOL · Jupiter</div>
      <div className="oxc-buy-presets">
        {PRESETS.map((p) => (
          <button key={p} type="button" className={`oxc-btn ghost compact ${amount === String(p) ? "active-preset" : ""}`} onClick={() => setAmount(String(p))}>
            {p} SOL
          </button>
        ))}
      </div>
      <label className="oxc-field">
        Amount (SOL)
        <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
      </label>
      <div className="oxc-muted">
        Est. receive: {quoting ? "quoting…" : outUi} {token?.symbol ?? ""}
        {quote?.priceImpactPct ? ` · impact ${Number(quote.priceImpactPct).toFixed(2)}%` : ""}
      </div>

      <button type="button" className="oxc-btn primary" onClick={buy} disabled={buying || !quote || !connected}>
        {buying ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Confirming…</> : connected ? `Buy $${token?.symbol ?? "TOKEN"}` : "Connect wallet to buy"}
      </button>

      <div className="oxc-actions">
        <Link className="oxc-btn ghost" to={`/ORBITX_DEX/token/${selectedMint}`}>
          Open DEX <ExternalLink className="h-3.5 w-3.5" />
        </Link>
        <a className="oxc-btn ghost" href={`https://solscan.io/token/${selectedMint}`} target="_blank" rel="noreferrer">
          Solscan <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}
