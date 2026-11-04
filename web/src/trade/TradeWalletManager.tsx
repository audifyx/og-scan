/**
 * In-app wallet manager — the only wallet across OrbitX.
 *
 * Previously a local keypair import/export manager. Retired per owner order:
 * one wallet, one address, everywhere. This page now shows the linked in-app
 * wallet with live balances.
 *
 * There is no link step: when a wallet exists on this device it is ALREADY
 * linked (see useInAppWalletLinked in ./TradeWalletPicker — a local device
 * wallet, locked or unlocked, or an already-resolved desk wallet). When no
 * wallet exists yet, the only path is creating one on this device. The
 * desk-wallet dashboard auth-code flow is never triggered from here; desk
 * auth still happens where a spend needs it. Unlink only appears when the
 * desk wallet is actually authed — it forgets the desk auth code, it never
 * touches the local device wallet.
 */
import { useEffect, useState } from "react";
import { Connection } from "@solana/web3.js";
import { browserWalletRpcUrl } from "@/lib/solanaRpc";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { Check, Copy, Plus, RefreshCw, Unlink, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useOrbitxBilling } from "@/tokenomics/useOrbitxBilling";
import { ORBITX_MINT } from "@/tokenomics/constants";
import { shortAddr } from "./tradeFmt";
import { useInAppWalletLinked } from "./TradeWalletPicker";

export default function TradeWalletManager() {
  const connection = new Connection(browserWalletRpcUrl(), "confirmed");
  const billing = useOrbitxBilling();
  const { ready: walletsReady, linked, address, deskLinked, create } =
    useInAppWalletLinked();
  const [sol, setSol] = useState<number | null>(null);
  const [orbitx, setOrbitx] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    if (!address) {
      setSol(null);
      setOrbitx(null);
      return;
    }
    setLoading(true);
    try {
      const pk = new PublicKey(address);
      const lamports = await connection.getBalance(pk);
      setSol(lamports / 1e9);
      try {
        const ata = await getAssociatedTokenAddress(pk, new PublicKey(ORBITX_MINT));
        const bal = await connection.getTokenAccountBalance(ata);
        setOrbitx(Number(bal.value.uiAmount ?? 0));
      } catch {
        setOrbitx(0);
      }
    } catch {
      /* keep stale */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  const copy = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const onCreate = () => {
    setCreating(true);
    try {
      create();
      toast.success("Wallet created on this device");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create wallet");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-6">
      <div>
        <h1
          className="text-4xl leading-none text-[var(--term-ink)]"
          style={{ fontFamily: "var(--term-hand)" }}
        >
          In-app wallet
        </h1>
        <p className="mt-1 text-sm text-[var(--term-silver)]">
          The only wallet across OrbitX — same address on every surface. Backend-signed, no popups.
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--term-gold)]/25 bg-white/[0.08] p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--term-gold)]/10">
            <Wallet className="h-6 w-6 text-[var(--term-gold)]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--term-gold)]">
              {linked ? "Linked in-app wallet" : "No wallet on this device yet"}
            </p>
            {linked && address ? (
              <button
                type="button"
                onClick={copy}
                className="mt-0.5 flex items-center gap-2 font-mono text-sm font-bold text-[var(--term-ink)] hover:text-[var(--term-gold)]"
                title="Copy address"
              >
                <span className="truncate">{shortAddr(address, 8)}</span>
                {copied ? <Check className="h-4 w-4 text-[var(--term-gold)]" /> : <Copy className="h-4 w-4 text-white/60" />}
              </button>
            ) : linked ? (
              <p className="mt-0.5 text-sm text-white/50">
                Your PIN-encrypted wallet lives on this device. Unlock it from the Launchpad to see the address and balances.
              </p>
            ) : (
              <p className="mt-0.5 text-sm text-white/50">Create your wallet on this device — one tap, and trades and burns become seamless.</p>
            )}
          </div>
          {deskLinked ? (
            <button
              type="button"
              onClick={() => billing.resetAuth()}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-white/50 hover:border-red-400/60 hover:text-red-400"
            >
              <Unlink className="h-3 w-3" /> Unlink
            </button>
          ) : linked ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--term-gold)]/40 bg-[var(--term-gold)]/10 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--term-gold)]">
              <Check className="h-3 w-3" /> Linked
            </span>
          ) : (
            <button
              type="button"
              disabled={creating || !walletsReady}
              onClick={onCreate}
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--term-gold)] px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-black transition hover:brightness-110 disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" /> Create wallet
            </button>
          )}
        </div>

        {linked && address && (
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/[0.07] bg-black/30 p-4">
              <p className="font-mono text-[10px] uppercase tracking-widest text-white/65">SOL</p>
              <p className="mt-1 font-mono text-xl font-black text-white">
                {sol === null ? "—" : sol.toFixed(4)}
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-black/30 p-4">
              <p className="font-mono text-[10px] uppercase tracking-widest text-white/65">ORBITX</p>
              <p className="mt-1 font-mono text-xl font-black text-white">
                {orbitx === null ? "—" : orbitx.toLocaleString()}
              </p>
            </div>
          </div>
        )}

        {linked && address && (
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="mt-4 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-white/70 hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh balances
          </button>
        )}
      </div>

      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.06] p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-white/50">What changed</p>
        <p className="mt-2 text-sm leading-relaxed text-white/45">
          Phantom, Jupiter, and imported browser keypairs are retired. Your in-app wallet is now the
          only wallet — the same address in the hub, the city, the trade terminal, and the shop.
          It signs on the backend, so there's nothing to install and no popups.
          There is no link step anymore: if a wallet exists on this device, it is already linked.
        </p>
        <p className="mt-2 font-mono text-[11px] text-white/60">
          RPC: {browserWalletRpcUrl().replace(/^https?:\/\//, "").slice(0, 42)}…
        </p>
      </div>
    </div>
  );
}
