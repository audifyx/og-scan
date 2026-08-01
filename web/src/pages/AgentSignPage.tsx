import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";
import { Check, ExternalLink, Loader2, ShieldAlert, Wallet } from "lucide-react";
import { useWalletSignIn } from "@/hooks/useWalletSignIn";

/**
 * MCP buy/sell handoff — rebuilds an unsigned trade, then signs & sends with Phantom.
 * Query: action, mint, amount, publicKey, slippage, pool
 */
export default function AgentSignPage() {
  const [params] = useSearchParams();
  const { connection } = useConnection();
  const { publicKey, signTransaction, sendTransaction, connected } = useWallet();
  const { pickable, signInWith, busy } = useWalletSignIn();

  const action = params.get("action") === "sell" ? "sell" : "buy";
  const mint = (params.get("mint") || "").trim();
  const amountRaw = (params.get("amount") || "").trim();
  const expectedWallet = (params.get("publicKey") || "").trim();
  const slippage = Math.min(Math.max(Number(params.get("slippage")) || 10, 1), 50);
  const pool = params.get("pool") || "auto";

  const [busyTrade, setBusyTrade] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);

  const wallet = publicKey?.toBase58() || "";
  const walletMismatch = Boolean(expectedWallet && wallet && expectedWallet !== wallet);

  const amountLabel = useMemo(() => {
    if (!amountRaw) return "—";
    if (action === "buy") return `${amountRaw} SOL`;
    return amountRaw.endsWith("%") ? amountRaw : `${amountRaw} tokens`;
  }, [action, amountRaw]);

  const valid = Boolean(mint && amountRaw && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint));

  const onSign = async () => {
    setError(null);
    setSignature(null);
    if (!valid) {
      setError("Missing or invalid trade params (mint / amount).");
      return;
    }
    if (!connected || !publicKey) {
      setError("Connect Phantom first.");
      return;
    }
    if (walletMismatch) {
      setError(`Connect the wallet that prepared this trade: ${expectedWallet.slice(0, 4)}…${expectedWallet.slice(-4)}`);
      return;
    }

    setBusyTrade(true);
    try {
      const amount =
        action === "sell" && amountRaw.endsWith("%")
          ? amountRaw
          : Number(amountRaw);
      if (typeof amount === "number" && (!Number.isFinite(amount) || amount <= 0)) {
        throw new Error("Invalid amount");
      }

      const res = await fetch("/api/ogdex/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicKey: publicKey.toBase58(),
          action,
          mint,
          amount,
          denominatedInSol: action === "buy",
          slippage,
          pool,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok || !data?.tx) {
        throw new Error(data?.error || "Could not build trade transaction");
      }

      const txBytes = Uint8Array.from(atob(data.tx), (c) => c.charCodeAt(0));
      const tx = VersionedTransaction.deserialize(txBytes);

      let sig: string;
      if (signTransaction) {
        const signed = await signTransaction(tx);
        sig = await connection.sendRawTransaction(signed.serialize(), {
          skipPreflight: false,
          maxRetries: 3,
        });
      } else if (sendTransaction) {
        sig = await sendTransaction(tx, connection, { skipPreflight: false, maxRetries: 3 });
      } else {
        throw new Error("This wallet cannot sign here — open in Phantom.");
      }

      await connection.confirmTransaction(sig, "confirmed");
      setSignature(sig);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign failed");
    } finally {
      setBusyTrade(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#070a10] p-4 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0c111a] p-6 shadow-2xl">
        <div className="mb-1 flex items-center gap-2 text-emerald-300">
          <Wallet className="h-5 w-5" />
          <h1 className="text-xl font-black tracking-tight">Sign with Phantom</h1>
        </div>
        <p className="mb-5 text-xs text-white/45">
          OrbitX prepared an unsigned {action}. Your wallet must sign — nothing broadcasts until you approve in
          Phantom.
        </p>

        <div className="mb-4 space-y-2 rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-sm">
          <Row label="Action" value={action.toUpperCase()} />
          <Row label="Amount" value={amountLabel} />
          <Row label="Mint" value={mint ? `${mint.slice(0, 6)}…${mint.slice(-4)}` : "—"} mono />
          <Row label="Slippage" value={`${slippage}%`} />
          {expectedWallet ? (
            <Row label="Wallet" value={`${expectedWallet.slice(0, 4)}…${expectedWallet.slice(-4)}`} mono />
          ) : null}
        </div>

        {!valid && (
          <div className="mb-4 flex gap-2 rounded-xl border border-amber-400/20 bg-amber-400/8 px-3 py-2 text-xs text-amber-100/80">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            Open this page from an MCP prepare_buy / prepare_sell signUrl (mint + amount required).
          </div>
        )}

        {walletMismatch && (
          <div className="mb-4 rounded-xl border border-rose-400/20 bg-rose-400/8 px-3 py-2 text-xs text-rose-100/80">
            Connected wallet does not match the trade. Switch to {expectedWallet.slice(0, 4)}…
            {expectedWallet.slice(-4)}.
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-100">
            {error}
          </div>
        )}

        {signature ? (
          <div className="mb-4 rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-3 py-3">
            <p className="mb-1 flex items-center gap-1.5 text-sm font-bold text-emerald-300">
              <Check className="h-4 w-4" /> Confirmed on-chain
            </p>
            <a
              href={`https://solscan.io/tx/${signature}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 break-all font-mono text-[11px] text-emerald-200/80 hover:underline"
            >
              {signature} <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          </div>
        ) : (
          <>
            {!connected && (
              <div className="mb-3 flex flex-wrap gap-2">
                {pickable.map((w) => (
                  <button
                    key={w.name}
                    type="button"
                    disabled={busy}
                    onClick={() => signInWith(w.name, { connectOnly: true })}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold hover:bg-white/10 disabled:opacity-50"
                  >
                    Connect {w.name}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              disabled={!valid || busyTrade || busy || !connected || walletMismatch}
              onClick={onSign}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#ab9ff2] px-4 py-3 text-sm font-bold text-black hover:brightness-110 disabled:opacity-40"
            >
              {busyTrade ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
              {busyTrade ? "Waiting for Phantom…" : `Sign & send ${action}`}
            </button>
          </>
        )}

        <p className="mt-4 text-center text-[11px] text-white/35">
          <Link to="/agent" className="text-white/50 hover:underline">
            Back to Agent MCP
          </Link>
        </p>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-white/35">{label}</span>
      <span className={`text-right text-xs text-white/80 ${mono ? "font-mono" : "font-semibold"}`}>{value}</span>
    </div>
  );
}
