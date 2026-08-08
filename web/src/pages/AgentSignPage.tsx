import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Transaction, VersionedTransaction } from "@solana/web3.js";
import { Check, ExternalLink, Loader2, ShieldAlert, Wallet } from "lucide-react";
import { useWalletSignIn } from "@/hooks/useWalletSignIn";

type Kind = "trade" | "claim" | "burn" | "rent";

function decodeTx(b64: string): VersionedTransaction | Transaction {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  try {
    return VersionedTransaction.deserialize(bytes);
  } catch {
    return Transaction.from(bytes);
  }
}

/**
 * MCP handoff — rebuild unsigned tx (trade / claim / burn / rent), sign in Phantom.
 * Query: kind, action, mint, amount, percent, publicKey, slippage, pool
 */
export default function AgentSignPage() {
  const [params] = useSearchParams();
  const { connection } = useConnection();
  const { publicKey, signTransaction, sendTransaction, connected } = useWallet();
  const { pickable, signInWith, busy } = useWalletSignIn();

  const kindParam = (params.get("kind") || "trade").toLowerCase();
  const kind: Kind =
    kindParam === "claim" || kindParam === "burn" || kindParam === "rent" ? kindParam : "trade";
  const action = params.get("action") === "sell" ? "sell" : "buy";
  const mint = (params.get("mint") || "").trim();
  const amountRaw = (params.get("amount") || "").trim();
  const percentRaw = (params.get("percent") || "").trim();
  const expectedWallet = (params.get("publicKey") || "").trim();
  const slippage = Math.min(Math.max(Number(params.get("slippage")) || 10, 1), 50);
  const pool = params.get("pool") || "auto";
  const autoPrompt =
    params.get("auto") === "1" ||
    params.get("auto") === "true" ||
    params.get("autoconfirm") === "1";

  const [busyTrade, setBusyTrade] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [extraNote, setExtraNote] = useState<string | null>(null);
  const autoStarted = useRef(false);

  const wallet = publicKey?.toBase58() || "";
  const walletMismatch = Boolean(expectedWallet && wallet && expectedWallet !== wallet);

  const amountLabel = useMemo(() => {
    if (kind === "claim") return "creator fees";
    if (kind === "rent") return "close empty ATAs";
    if (kind === "burn") {
      if (percentRaw) return `${percentRaw}%`;
      return amountRaw || "—";
    }
    if (!amountRaw) return "—";
    if (action === "buy") return `${amountRaw} SOL`;
    return amountRaw.endsWith("%") ? amountRaw : `${amountRaw} tokens`;
  }, [kind, action, amountRaw, percentRaw]);

  const valid = useMemo(() => {
    if (kind === "claim" || kind === "rent") return true;
    if (kind === "burn") return Boolean(mint && (amountRaw || percentRaw));
    return Boolean(mint && amountRaw && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint));
  }, [kind, mint, amountRaw, percentRaw]);

  const title =
    kind === "claim"
      ? "Claim fees"
      : kind === "burn"
        ? "Burn tokens"
        : kind === "rent"
          ? "Rent refund"
          : action.toUpperCase();

  const sendOne = async (b64: string) => {
    const tx = decodeTx(b64);
    // Prefer sendTransaction (signAndSend) — same path as TradingTerminal.
    if (sendTransaction) {
      return sendTransaction(tx as VersionedTransaction, connection, {
        skipPreflight: false,
        maxRetries: 3,
      });
    }
    if (signTransaction) {
      const signed = await signTransaction(tx as VersionedTransaction);
      const raw =
        signed instanceof VersionedTransaction
          ? signed.serialize()
          : (signed as Transaction).serialize();
      return connection.sendRawTransaction(raw, { skipPreflight: false, maxRetries: 3 });
    }
    throw new Error("This wallet cannot sign here — open in Phantom.");
  };

  const onSign = async () => {
    setError(null);
    setSignature(null);
    setExtraNote(null);
    if (!valid) {
      setError("Missing or invalid params for this operation.");
      return;
    }
    if (!connected || !publicKey) {
      setError("Connect Phantom first.");
      return;
    }
    if (walletMismatch) {
      setError(`Connect wallet ${expectedWallet.slice(0, 4)}…${expectedWallet.slice(-4)}`);
      return;
    }

    setBusyTrade(true);
    try {
      const pk = publicKey.toBase58();

      if (kind === "trade") {
        const amount =
          action === "sell" && amountRaw.endsWith("%") ? amountRaw : Number(amountRaw);
        if (typeof amount === "number" && (!Number.isFinite(amount) || amount <= 0)) {
          throw new Error("Invalid amount");
        }
        const res = await fetch("/api/ogdex/trade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            publicKey: pk,
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
        const sig = await sendOne(data.tx);
        await connection.confirmTransaction(sig, "confirmed");
        setSignature(sig);
        return;
      }

      const body: Record<string, unknown> = { kind, publicKey: pk };
      if (kind === "burn") {
        body.mint = mint;
        if (percentRaw) body.percent = Number(percentRaw);
        else if (amountRaw) body.amount = amountRaw.endsWith("%") ? amountRaw : Number(amountRaw);
      }

      const res = await fetch("/api/orbitx-agent/ops-prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || data?.message || "Could not build transaction");
      }

      const list: string[] = [];
      if (typeof data.transaction === "string") list.push(data.transaction);
      if (Array.isArray(data.transactions)) {
        for (const t of data.transactions) if (typeof t === "string") list.push(t);
      }
      if (!list.length) throw new Error("No transaction returned");

      let lastSig = "";
      for (let i = 0; i < list.length; i++) {
        lastSig = await sendOne(list[i]);
        await connection.confirmTransaction(lastSig, "confirmed");
      }
      setSignature(lastSig);
      if (list.length > 1) setExtraNote(`Signed ${list.length} transactions.`);
      if (data.reclaimableSol != null) {
        setExtraNote((n) => `${n ? `${n} ` : ""}~${data.reclaimableSol} SOL reclaimable.`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign failed");
    } finally {
      setBusyTrade(false);
    }
  };

  /* Chat auto-confirm: ?auto=1 opens Phantom as soon as wallet is ready */
  useEffect(() => {
    if (!autoPrompt || autoStarted.current) return;
    if (!valid || !connected || !publicKey || walletMismatch || busyTrade || signature) return;
    autoStarted.current = true;
    const t = window.setTimeout(() => {
      void onSign();
    }, 450);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once when wallet becomes ready
  }, [autoPrompt, valid, connected, publicKey, walletMismatch, busyTrade, signature]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#070a10] p-4 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0c111a] p-6 shadow-2xl">
        <div className="mb-1 flex items-center gap-2 text-emerald-300">
          <Wallet className="h-5 w-5" />
          <h1 className="text-xl font-black tracking-tight">
            {autoPrompt ? "Auto-confirm buy" : "Sign with Phantom"}
          </h1>
        </div>
        <p className="mb-5 text-xs text-white/45">
          {autoPrompt
            ? "Chat auto-confirm — Phantom will prompt as soon as your wallet is connected. Nothing broadcasts until you approve."
            : `OrbitX prepared an unsigned ${title.toLowerCase()}. Approve in Phantom — nothing broadcasts until you sign.`}
        </p>

        <div className="mb-4 space-y-2 rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-sm">
          <Row label="Action" value={title} />
          <Row label="Detail" value={amountLabel} />
          {mint ? <Row label="Mint" value={`${mint.slice(0, 6)}…${mint.slice(-4)}`} mono /> : null}
          {kind === "trade" ? <Row label="Slippage" value={`${slippage}%`} /> : null}
          {expectedWallet ? (
            <Row label="Wallet" value={`${expectedWallet.slice(0, 4)}…${expectedWallet.slice(-4)}`} mono />
          ) : null}
        </div>

        {!valid && (
          <div className="mb-4 flex gap-2 rounded-xl border border-amber-400/20 bg-amber-400/8 px-3 py-2 text-xs text-amber-100/80">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            Open this page from an MCP signUrl.
          </div>
        )}

        {walletMismatch && (
          <div className="mb-4 rounded-xl border border-rose-400/20 bg-rose-400/8 px-3 py-2 text-xs text-rose-100/80">
            Wrong wallet connected. Switch to {expectedWallet.slice(0, 4)}…{expectedWallet.slice(-4)}.
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
            {extraNote && <p className="mb-2 text-[11px] text-white/50">{extraNote}</p>}
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
                    disabled={!!busy}
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
              disabled={!valid || busyTrade || !!busy || !connected || walletMismatch}
              onClick={onSign}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#ab9ff2] px-4 py-3 text-sm font-bold text-black hover:brightness-110 disabled:opacity-40"
            >
              {busyTrade ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
              {busyTrade ? "Waiting for Phantom…" : `Sign & send ${title}`}
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
