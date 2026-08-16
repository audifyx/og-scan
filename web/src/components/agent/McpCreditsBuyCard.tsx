import { useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { PLATFORM_WALLET } from "@/lib/platformFee";
import {
  confirmXCreditsPurchase,
  quoteXCreditsBuy,
  type XCreditsUsage,
} from "@/lib/xMcp";

type Pack = { sol: number; credits: number; label: string };

const FALLBACK_PACKS: Pack[] = [
  { sol: 0.1, credits: 1000, label: "Starter" },
  { sol: 0.5, credits: 5000, label: "Standard" },
  { sol: 1, credits: 10000, label: "Pro" },
  { sol: 5, credits: 50000, label: "Whale" },
];

type Props = {
  usage?: XCreditsUsage | null;
  onPurchased?: () => void;
  toolHint?: string;
};

function shortAddr(value: string) {
  if (!value || value.length <= 12) return value || "—";
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export function McpCreditsBuyCard({ usage, onPurchased, toolHint }: Props) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();
  const [buySol, setBuySol] = useState("0.1");
  const [buyBusy, setBuyBusy] = useState(false);
  const [buyNote, setBuyNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualSig, setManualSig] = useState("");
  const [copied, setCopied] = useState(false);

  const packs = usage?.advanced?.suggestedPacks?.length
    ? usage.advanced.suggestedPacks
    : FALLBACK_PACKS;
  const rate = usage?.creditsPerSol || 10_000;
  const payTo = usage?.payTo || PLATFORM_WALLET;

  const quotedCredits = useMemo(() => {
    const sol = Number(buySol);
    if (!Number.isFinite(sol) || sol <= 0) return 0;
    return Math.floor(sol * rate);
  }, [buySol, rate]);

  const onBuy = async () => {
    setBuyBusy(true);
    setBuyNote(null);
    setError(null);
    try {
      const sol = Number(buySol);
      if (!Number.isFinite(sol) || sol < 0.001) throw new Error("Enter at least 0.001 SOL");
      if (!publicKey || !connected || !sendTransaction) {
        throw new Error("Connect a Solana wallet first (same wallet you sign in with)");
      }
      const quote = await quoteXCreditsBuy(sol, publicKey.toBase58());
      if (!quote.ok || !quote.lamports || !quote.payTo) {
        throw new Error(quote.message || quote.error || "Could not quote purchase");
      }
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(quote.payTo || PLATFORM_WALLET),
          lamports: quote.lamports,
        }),
      );
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;
      const signature = await sendTransaction(tx, connection);
      await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
      const credited = await confirmXCreditsPurchase(signature);
      setBuyNote(credited.message || `+${credited.creditsAdded ?? quote.credits} credits`);
      onPurchased?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Purchase failed");
    } finally {
      setBuyBusy(false);
    }
  };

  const onConfirmManual = async () => {
    setBuyBusy(true);
    setBuyNote(null);
    setError(null);
    try {
      const sig = manualSig.trim();
      if (!sig) throw new Error("Paste a transaction signature");
      const credited = await confirmXCreditsPurchase(sig);
      setBuyNote(credited.message || "Credits applied");
      setManualSig("");
      onPurchased?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Confirm failed");
    } finally {
      setBuyBusy(false);
    }
  };

  return (
    <section className="ox-agent__panel">
      <div className="ox-agent__panel-h">
        <h2 className="ox-agent__panel-title">Buy MCP credits</h2>
        <span className="ox-agent__panel-hint">packs · any amount</span>
      </div>
      <div className="ox-agent__panel-b">
        <p className="ox-agent__note" style={{ marginTop: 0 }}>
          Phantom sends SOL to the OrbitX desk wallet. Credits apply after confirm and work for Agent MCP
          and X MCP. {toolHint || "In chat: orbitx_credits_buy or x_credits_buy / x_buy what=credits."}
        </p>
        <div className="ox-x-packs">
          {packs.map((p) => (
            <button
              key={p.sol}
              type="button"
              className={`ox-x-packs__btn${Number(buySol) === p.sol ? " is-on" : ""}`}
              onClick={() => setBuySol(String(p.sol))}
            >
              <span className="ox-x-packs__lbl">{p.label}</span>
              <span className="ox-x-packs__sol">{p.sol} SOL</span>
              <span className="ox-x-packs__cr">{p.credits.toLocaleString()} cr</span>
            </button>
          ))}
        </div>
        <label className="ox-agent__label" htmlFor="ox-shop-buy-sol">
          Custom SOL
        </label>
        <div className="ox-x-buy__row">
          <input
            id="ox-shop-buy-sol"
            className="ox-agent__input"
            type="number"
            min={0.001}
            step={0.001}
            value={buySol}
            onChange={(e) => setBuySol(e.target.value)}
            placeholder="0.1"
          />
          <span className="ox-x-buy__quote">→ {quotedCredits.toLocaleString()} credits</span>
        </div>
        <p className="ox-agent__note">
          Rate: {rate.toLocaleString()} credits / 1 SOL · desk{" "}
          <button
            type="button"
            className="ox-agent__linkish"
            onClick={() => {
              void navigator.clipboard?.writeText(payTo).then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1400);
              });
            }}
          >
            {shortAddr(payTo)}
          </button>
          {copied ? " · copied" : ""}
        </p>
        {error && <div className="ox-agent__alert">{error}</div>}
        {buyNote && <p className="ox-agent__note ox-x-buy__ok">{buyNote}</p>}
        <div className="ox-agent__actions" style={{ marginTop: "0.75rem" }}>
          <button type="button" className="ox-agent__btn ox-agent__btn--primary" disabled={buyBusy} onClick={() => void onBuy()}>
            {buyBusy ? "Processing…" : connected ? "Pay with wallet" : "Connect wallet to pay"}
          </button>
        </div>
        <div className="ox-x-buy__manual">
          <label className="ox-agent__label" htmlFor="ox-shop-buy-sig">
            Already paid? Paste signature
          </label>
          <input
            id="ox-shop-buy-sig"
            className="ox-agent__input"
            value={manualSig}
            onChange={(e) => setManualSig(e.target.value)}
            placeholder="Solana tx signature"
          />
          <button
            type="button"
            className="ox-agent__btn ox-agent__btn--ghost"
            disabled={buyBusy || !manualSig.trim()}
            onClick={() => void onConfirmManual()}
          >
            Confirm payment
          </button>
        </div>
      </div>
    </section>
  );
}
