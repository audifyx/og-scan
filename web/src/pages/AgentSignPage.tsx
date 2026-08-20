import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, Transaction, VersionedTransaction } from "@solana/web3.js";
import { Check, ExternalLink, Loader2, ShieldAlert, Wallet } from "lucide-react";
import { useWalletSignIn } from "@/hooks/useWalletSignIn";
import { PLATFORM_WALLET } from "@/lib/platformFee";
import { supabase } from "@/lib/supabase";
import {
  buildMcpAccessBurnTransaction,
  confirmMcpAccessBurnUntilGranted,
  rememberPendingMcpBurn,
} from "@/lib/mcpBurnAccess";
import { sendWalletTransaction } from "@/lib/orbitx/sendWalletTx";

type Kind = "trade" | "claim" | "burn" | "rent" | "credits" | "mcp-access";

function decodeTx(b64: string): VersionedTransaction | Transaction {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  try {
    return VersionedTransaction.deserialize(bytes);
  } catch {
    return Transaction.from(bytes);
  }
}

/**
 * MCP handoff — rebuild unsigned tx (trade / credits / claim / burn / rent), sign in Jupiter.
 * Query: kind, action, mint, amount, percent, publicKey, slippage, pool, auto
 */
export default function AgentSignPage() {
  const [params] = useSearchParams();
  const { connection } = useConnection();
  const { publicKey, signTransaction, sendTransaction, connected, wallet: adapterWallet } = useWallet();
  const { pickable, signInWith, busy } = useWalletSignIn();
  const walletCaps = {
    sendTransaction: sendTransaction ?? undefined,
    signTransaction: signTransaction ?? undefined,
    walletName: adapterWallet?.adapter?.name ?? null,
  };
  const connectWallets = [...pickable].sort((a, b) => {
    const rank = (n: string) => (/jupiter/i.test(n) ? 0 : /phantom/i.test(n) ? 2 : 1);
    return rank(a.name) - rank(b.name);
  });

  const kindParam = (params.get("kind") || "trade").toLowerCase();
  const kind: Kind =
    kindParam === "claim" ||
    kindParam === "burn" ||
    kindParam === "rent" ||
    kindParam === "credits" ||
    kindParam === "credit" ||
    kindParam === "mcp-access" ||
    kindParam === "mcp_access" ||
    kindParam === "access"
      ? kindParam === "credit"
        ? "credits"
        : kindParam === "mcp_access" || kindParam === "access"
          ? "mcp-access"
          : kindParam
      : "trade";
  const packageId = (params.get("package") || params.get("packageId") || "").toLowerCase();
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
    if (kind === "credits") {
      const sol = Number(amountRaw);
      const credits = Number.isFinite(sol) ? Math.floor(sol * 10_000) : 0;
      return `${amountRaw || "—"} SOL → ~${credits.toLocaleString()} credits`;
    }
    if (kind === "mcp-access") {
      const forever = packageId === "forever" || packageId === "lifetime" || packageId === "launch";
      const tokens = forever ? 500 : packageId === "week" ? 1000 : 100;
      const label = forever ? "forever" : packageId === "week" ? "1 week" : "1 day";
      return `Burn ${tokens.toLocaleString()} $ORBITX → ${label} MCP access`;
    }
    if (kind === "claim") return "creator fees";
    if (kind === "rent") return "close empty ATAs";
    if (kind === "burn") {
      if (percentRaw) return `${percentRaw}%`;
      return amountRaw || "—";
    }
    if (!amountRaw) return "—";
    if (action === "buy") return `${amountRaw} SOL`;
    return amountRaw.endsWith("%") ? amountRaw : `${amountRaw} tokens`;
  }, [kind, action, amountRaw, percentRaw, packageId]);

  const valid = useMemo(() => {
    if (kind === "credits") {
      const sol = Number(amountRaw);
      return Number.isFinite(sol) && sol >= 0.001;
    }
    if (kind === "mcp-access") {
      return packageId === "day" || packageId === "week" || packageId === "forever" || packageId === "lifetime" || packageId === "launch";
    }
    if (kind === "claim" || kind === "rent") return true;
    if (kind === "burn") return Boolean(mint && (amountRaw || percentRaw));
    return Boolean(mint && amountRaw && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint));
  }, [kind, mint, amountRaw, percentRaw, packageId]);

  const title =
    kind === "credits"
      ? "Buy credits"
      : kind === "mcp-access"
        ? "Burn for MCP access"
        : kind === "claim"
          ? "Claim fees"
          : kind === "burn"
            ? "Burn tokens"
            : kind === "rent"
              ? "Rent refund"
              : action.toUpperCase();

  const sendOne = async (b64: string) => {
    const tx = decodeTx(b64);
    return sendWalletTransaction(connection, walletCaps, tx);
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
      setError("Connect Jupiter first.");
      return;
    }
    if (walletMismatch) {
      setError(`Connect wallet ${expectedWallet.slice(0, 4)}…${expectedWallet.slice(-4)}`);
      return;
    }

    setBusyTrade(true);
    try {
      const pk = publicKey.toBase58();

      if (kind === "credits") {
        const sol = Number(amountRaw);
        if (!Number.isFinite(sol) || sol < 0.001) throw new Error("Invalid SOL amount");
        const lamports = Math.round(sol * 1e9);
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
        const tx = new Transaction({
          feePayer: publicKey,
          recentBlockhash: blockhash,
        }).add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: new PublicKey(PLATFORM_WALLET),
            lamports,
          }),
        );
        const sig = await sendWalletTransaction(connection, walletCaps, tx);
        await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
        setSignature(sig);

        // Credit the account (session user, or wallet-linked agent user)
        try {
          const session = (await supabase.auth.getSession()).data.session;
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
          const res = await fetch("/api/orbitx-agent/credits/confirm", {
            method: "POST",
            headers,
            body: JSON.stringify({ signature: sig, publicKey: pk }),
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok && data?.ok) {
            setExtraNote(
              data.message ||
                `+${Number(data.creditsAdded || 0).toLocaleString()} credits added. Balance: ${Number(data.balance || 0).toLocaleString()}`,
            );
          } else {
            setExtraNote(
              "Payment sent. Tell Grok your signature to finish crediting, or open /x Usage → Confirm payment.",
            );
          }
        } catch {
          setExtraNote(
            "Payment sent. Tell Grok your signature to finish crediting, or open /x Usage → Confirm payment.",
          );
        }
        return;
      }

      if (kind === "mcp-access") {
        const forever = packageId === "forever" || packageId === "lifetime" || packageId === "launch";
        const pkg = forever ? "forever" : packageId === "week" ? "week" : "day";
        const preparePath = forever
          ? "/api/orbitx-agent/mcp-unlock/prepare"
          : "/api/orbitx-agent/mcp-access/prepare";
        const res = await fetch(preparePath, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicKey: pk, packageId: pkg }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.ok === false) {
          throw new Error(data?.error || data?.message || "Could not quote access burn");
        }
        let sig: string;
        if (typeof data.transaction === "string" && data.transaction) {
          sig = await sendOne(data.transaction);
        } else if (data.tokenAccount && data.amountRaw && data.programId) {
          const tx = await buildMcpAccessBurnTransaction(connection, publicKey, {
            tokenAccount: String(data.tokenAccount),
            mint: String(data.mint || mint),
            programId: String(data.programId),
            amountRaw: String(data.amountRaw),
            closesAccount: Boolean(data.closesAccount),
          });
          sig = await sendWalletTransaction(connection, walletCaps, tx);
        } else {
          throw new Error(data?.message || "Could not build access burn");
        }
        await connection.confirmTransaction(sig, "confirmed");
        setSignature(sig);
        if (forever) {
          const session = (await supabase.auth.getSession()).data.session;
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
          const confirmRes = await fetch("/api/orbitx-agent/mcp-unlock/confirm", {
            method: "POST",
            headers,
            body: JSON.stringify({ signature: sig, publicKey: pk }),
          });
          const granted = await confirmRes.json().catch(() => ({}));
          setExtraNote(
            granted.message ||
              (granted.ok
                ? "Burn verified. MCP unlocked forever."
                : "Burn sent. Paste the Solscan tx link in Telegram, Claude, or /ai if access does not appear."),
          );
          return;
        }
        rememberPendingMcpBurn({ signature: sig, publicKey: pk, packageId: pkg });
        const granted = await confirmMcpAccessBurnUntilGranted({
          signature: sig,
          publicKey: pk,
          packageId: pkg,
        });
        setExtraNote(
          granted.message ||
            `${granted.remainingLabel || "Access granted"}. Timed MCP access is active now.`,
        );
        return;
      }

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
            platformFee: true,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.ok || !data?.tx) {
          throw new Error(data?.error || "Could not build trade transaction");
        }
        // Separate desk-fee tx when the API could not embed the SOL transfer
        if (typeof data.feeTx === "string" && data.feeTx.length > 0) {
          const feeSig = await sendOne(data.feeTx);
          await connection.confirmTransaction(feeSig, "confirmed");
        }
        const sig = await sendOne(data.tx);
        await connection.confirmTransaction(sig, "confirmed");
        setSignature(sig);
        const feeSol = data?.platformFee?.feeSol;
        const feeWallet = data?.platformFee?.wallet || PLATFORM_WALLET;
        if (feeSol) {
          setExtraNote(
            `Platform fee ${Number(feeSol).toFixed(6)} SOL → ${feeWallet.slice(0, 4)}…${feeWallet.slice(-4)}`,
          );
        }
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

  useEffect(() => {
    if (!autoPrompt || autoStarted.current) return;
    if (!valid || !connected || !publicKey || walletMismatch || busyTrade || signature) return;
    autoStarted.current = true;
    const t = window.setTimeout(() => {
      void onSign();
    }, 450);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPrompt, valid, connected, publicKey, walletMismatch, busyTrade, signature]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#070a10] p-4 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0c111a] p-6 shadow-2xl">
        <div className="mb-1 flex items-center gap-2 text-emerald-300">
          <Wallet className="h-5 w-5" />
          <h1 className="text-xl font-black tracking-tight">
            {autoPrompt ? "Auto-confirm" : "Sign with Jupiter"}
          </h1>
        </div>
        <p className="mb-5 text-xs text-white/45">
          {kind === "credits"
            ? autoPrompt
              ? "Chat auto-confirm — Jupiter will send SOL to the OrbitX desk wallet, then credits apply."
              : "Approve the SOL transfer to the OrbitX desk wallet. Credits credit after confirmation."
            : kind === "mcp-access"
              ? autoPrompt
                ? "Chat auto-confirm — Jupiter will burn the exact $ORBITX package amount, then MCP access starts."
                : "Approve the $ORBITX burn in Jupiter. Forever MCP unlocks after a 500-token burn; day/week packs expire automatically."
              : autoPrompt
                ? "Chat auto-confirm — Jupiter will prompt as soon as your wallet is connected."
                : `OrbitX prepared an unsigned ${title.toLowerCase()}. Approve in Jupiter — nothing broadcasts until you sign.`}
        </p>

        <div className="mb-4 space-y-2 rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-sm">
          <Row label="Action" value={title} />
          <Row label="Detail" value={amountLabel} />
          {kind === "credits" || kind === "trade" ? (
            <Row label="Fee to" value={`${PLATFORM_WALLET.slice(0, 6)}…${PLATFORM_WALLET.slice(-4)}`} mono />
          ) : null}
          {mint && kind !== "credits" ? (
            <Row label="Mint" value={`${mint.slice(0, 6)}…${mint.slice(-4)}`} mono />
          ) : null}
          {kind === "trade" ? <Row label="Slippage" value={`${slippage}%`} /> : null}
          {kind === "trade" ? <Row label="Platform fee" value="0.95% SOL → desk" /> : null}
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
            {kind === "credits" ? (
              <p className="mt-2 text-[11px] text-white/45">
                <Link to="/shop" className="text-emerald-200/90 hover:underline">
                  View shop / balance
                </Link>
              </p>
            ) : null}
            {kind === "mcp-access" ? (
              <p className="mt-2 text-[11px] text-white/45">
                <Link to="/shop" className="text-emerald-200/90 hover:underline">
                  Open shop
                </Link>
              </p>
            ) : null}
          </div>
        ) : (
          <>
            {!connected && (
              <div className="mb-3 flex flex-wrap gap-2">
                {connectWallets.map((w) => (
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
              {busyTrade ? "Waiting for Jupiter…" : `Sign & send ${title}`}
            </button>
          </>
        )}

        <p className="mt-4 text-center text-[11px] text-white/35">
          <Link
            to={kind === "credits" || kind === "mcp-access" ? "/shop" : "/agent"}
            className="text-white/50 hover:underline"
          >
            {kind === "credits" || kind === "mcp-access" ? "Back to Shop" : "Back to Agent MCP"}
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
