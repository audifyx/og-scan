import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fmtUsd, short } from "../lib/api";
import { Zap, Rocket, CheckCircle, Wallet, AlertTriangle, Clock, Copy, ExternalLink } from "lucide-react";

const PAY_WALLET = "CicbPxARTDrwQ4XcxWsn6SYeG4FMJHirS633cZUJeQDh";

const TIERS = [
  {
    id: "6h", label: "6-Hour Boost", hours: 6, usd: 20, icon: Zap, color: "text-accent",
    bg: "bg-accent/10", border: "border-accent/50",
    desc: "Scrolling reel slot for 6 hours",
    perks: ["Boost reel placement", "Featured Daily section", "~thousands of views"],
  },
  {
    id: "24h", label: "24-Hour Boost", hours: 24, usd: 60, icon: Rocket, color: "text-yellow-400",
    bg: "bg-yellow-500/10", border: "border-yellow-500/50",
    desc: "Full day — max exposure",
    perks: ["Boost reel placement", "Featured Daily section", "Top of featured list", "Pinned all day"],
  },
];

export default function Boost() {
  const [tier, setTier] = useState<string | null>(null);
  const [ca, setCa] = useState("");
  const [txHash, setTxHash] = useState("");
  const [payerWallet, setPayerWallet] = useState("");
  const [payWith, setPayWith] = useState<"sol"|"usd">("sol");
  const [solPrice, setSolPrice] = useState<number | null>(null);
  const [step, setStep] = useState<"pick"|"pay"|"done">("pick");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tokenInfo, setTokenInfo] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("https://lite-api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112")
      .then((r) => r.json())
      .then((d) => {
        const p = Number(d?.data?.So11111111111111111111111111111111111111112?.price);
        if (p > 0) setSolPrice(p);
      }).catch(() => {});
  }, []);

  // Auto-fetch token info when CA looks valid
  useEffect(() => {
    const v = ca.trim();
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v)) { setTokenInfo(null); return; }
    let on = true;
    fetch(`/api/ogdex/token?mint=${v}`).then((r) => r.json())
      .then((d) => { if (on) setTokenInfo(d?.token || null); }).catch(() => {});
    return () => { on = false; };
  }, [ca]);

  const selTier = TIERS.find((t) => t.id === tier);
  const solAmount = selTier && solPrice ? (selTier.usd / solPrice).toFixed(4) : null;
  const payDisplay = payWith === "sol" && solAmount ? `${solAmount} SOL` : selTier ? `$${selTier.usd} USDC/USDT` : "";

  const copyWallet = () => {
    navigator.clipboard.writeText(PAY_WALLET).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };

  const handleSubmit = async () => {
    if (!ca || !tier || !txHash) { setError("Contract address, tier, and transaction hash are all required."); return; }
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/ogdex/boosts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mint: ca.trim(),
          tier,
          payment_tx: txHash.trim(),
          payer_wallet: payerWallet.trim() || null,
          pay_currency: payWith,
          symbol: tokenInfo?.symbol,
          name: tokenInfo?.name,
          icon: tokenInfo?.icon,
          chain: "solana",
        }),
      }).then((r) => r.json());
      if (!r.ok) throw new Error(r.error || "Submission failed");
      setStep("done");
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (step === "done") return (
    <div className="max-w-lg mx-auto py-16 text-center space-y-5">
      <div className="w-16 h-16 rounded-full bg-up/15 grid place-items-center mx-auto">
        <CheckCircle className="w-9 h-9 text-up" />
      </div>
      <div>
        <h2 className="text-2xl font-black">Boost Submitted!</h2>
        <p className="text-muted text-sm mt-1">We're verifying your payment on-chain. Your token will appear in the boost reel and Featured Daily section within 1–2 hours.</p>
      </div>
      {tokenInfo && (
        <div className="card p-3 flex items-center gap-3 max-w-xs mx-auto">
          {tokenInfo.icon && <img src={tokenInfo.icon} className="w-8 h-8 rounded-full" />}
          <div className="text-left">
            <div className="font-semibold text-sm">{tokenInfo.symbol}</div>
            <div className="text-xs text-muted">{tokenInfo.name}</div>
          </div>
          <span className="ml-auto pill bg-accent/15 text-accent text-[10px]">
            {tier === "24h" ? "24hr" : "6hr"} boost
          </span>
        </div>
      )}
      <Link to="/" className="btn bg-accent text-black font-bold inline-flex mt-2 px-6 py-2.5">← Back to Screener</Link>
    </div>
  );

  return (
    <div className="max-w-xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Zap className="w-5 h-5 text-accent" />
          <h1 className="text-2xl font-black">Boost Your Token</h1>
        </div>
        <p className="text-muted text-sm">Get your token in the scrolling boost reel <em>and</em> the Featured Daily section — seen by every visitor.</p>
      </div>

      {/* 1. Pick tier */}
      <section className="space-y-3">
        <label className="text-xs font-semibold text-muted uppercase tracking-wide">1. Choose duration</label>
        <div className="grid grid-cols-2 gap-3">
          {TIERS.map((t) => (
            <button key={t.id} onClick={() => setTier(t.id)}
              className={`card p-4 text-left transition-all border-2 space-y-2
                ${tier === t.id ? `${t.border} ${t.bg}` : "border-transparent hover:border-white/15"}`}>
              <div className="flex items-center gap-2">
                <t.icon className={`w-4 h-4 ${t.color}`} />
                <span className="font-bold text-sm">{t.label}</span>
              </div>
              <div className={`text-2xl font-black ${t.color}`}>${t.usd}</div>
              <div className="text-xs text-muted">{t.desc}</div>
              <ul className="space-y-0.5">
                {t.perks.map((p) => (
                  <li key={p} className="text-[11px] text-muted/70 flex items-center gap-1">
                    <span className={`w-1 h-1 rounded-full ${t.color.replace('text-','bg-')}`} />{p}
                  </li>
                ))}
              </ul>
              {solPrice && payWith === "sol" && (
                <div className="text-[11px] text-muted/50">≈ {(t.usd / solPrice).toFixed(3)} SOL</div>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* 2. Token CA */}
      <section className="space-y-2">
        <label className="text-xs font-semibold text-muted uppercase tracking-wide">2. Token contract address</label>
        <div className="card p-3 space-y-2">
          <input
            value={ca}
            onChange={(e) => setCa(e.target.value)}
            placeholder="Solana token mint address (CA)"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted/40 font-mono"
          />
          {tokenInfo && (
            <div className="flex items-center gap-2 pt-2 border-t border-line">
              {tokenInfo.icon && <img src={tokenInfo.icon} className="w-7 h-7 rounded-full" />}
              <div>
                <span className="font-semibold text-sm">{tokenInfo.symbol}</span>
                <span className="text-muted text-xs ml-1.5">{tokenInfo.name}</span>
              </div>
              {tokenInfo.mcap && <span className="ml-auto text-xs text-muted">{fmtUsd(tokenInfo.mcap, { compact: true })} MC</span>}
            </div>
          )}
        </div>
      </section>

      {/* 3. Pay */}
      {tier && ca.length > 30 && (
        <section className="space-y-3">
          <label className="text-xs font-semibold text-muted uppercase tracking-wide">3. Send payment</label>

          {/* SOL / USD toggle */}
          <div className="flex gap-1 bg-panel2 rounded-lg p-1 w-fit">
            {(["sol","usd"] as const).map((c) => (
              <button key={c} onClick={() => setPayWith(c)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all
                  ${payWith === c ? "bg-panel text-white" : "text-muted hover:text-white"}`}>
                {c === "sol" ? "Pay in SOL" : "Pay in USDC/USDT"}
              </button>
            ))}
          </div>

          <div className="card p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Wallet className="w-5 h-5 text-accent shrink-0" />
              <div>
                <div className="text-xs text-muted">Send exactly</div>
                <div className="text-2xl font-black">{payDisplay || `$${selTier?.usd}`}</div>
                {payWith === "sol" && selTier && <div className="text-xs text-muted">(${selTier.usd} USD at current SOL price)</div>}
                {payWith === "usd" && <div className="text-xs text-muted">Any stablecoin on Solana</div>}
              </div>
            </div>

            <div>
              <div className="text-xs text-muted mb-1.5">Send to this wallet:</div>
              <div className="flex items-center gap-2 bg-panel2 rounded-lg px-3 py-2">
                <span className="font-mono text-xs text-white/80 break-all flex-1">{PAY_WALLET}</span>
                <button onClick={copyWallet} className="shrink-0 text-muted hover:text-white transition-colors" title="Copy">
                  {copied ? <CheckCircle className="w-4 h-4 text-up" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-start gap-2 text-xs text-yellow-400/80 bg-yellow-500/5 rounded-lg p-2.5 border border-yellow-500/10">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Send in a single transaction, then paste the Solscan tx hash below. We manually verify every payment.</span>
            </div>
          </div>

          {/* TX hash + optional wallet */}
          <div className="space-y-2">
            <input
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
              placeholder="Paste transaction hash here"
              className="card w-full p-3 text-sm bg-transparent outline-none placeholder:text-muted/40 font-mono"
            />
            <input
              value={payerWallet}
              onChange={(e) => setPayerWallet(e.target.value)}
              placeholder="Your wallet address (optional, for support)"
              className="card w-full p-3 text-sm bg-transparent outline-none placeholder:text-muted/40 font-mono"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 text-down text-sm bg-down/10 rounded-lg p-3 border border-down/20">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || !txHash.trim() || !ca.trim() || !tier}
            className="w-full btn bg-accent text-black font-bold py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Submitting…" : "Submit Boost →"}
          </button>
        </section>
      )}

      {/* How it works */}
      <div className="card p-4 space-y-2 text-xs text-muted border-line">
        <div className="flex items-center gap-1.5 font-semibold text-white text-sm mb-1">
          <Clock className="w-4 h-4 text-accent" /> How it works
        </div>
        <p>1. Pick 6h ($20) or 24h ($60) boost and enter your token's contract address.</p>
        <p>2. Send SOL or USDC/USDT to the payment wallet and paste your tx hash.</p>
        <p>3. We verify on-chain and activate your boost within 1–2 hours.</p>
        <p>4. Your token appears in the <strong className="text-white">scrolling boost reel</strong> and <strong className="text-white">Featured Daily</strong> section at the top of the screener.</p>
        <p className="pt-1 border-t border-line">
          Questions? <a href="https://t.me/orbitxwrld" target="_blank" rel="noreferrer" className="text-accent hover:underline">Telegram @ogscanner</a>
        </p>
      </div>
    </div>
  );
}
