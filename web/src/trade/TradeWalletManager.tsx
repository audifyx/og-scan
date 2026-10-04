/**
 * In-app wallet manager — the only wallet across OrbitX.
 *
 * Previously a local keypair import/export manager. Retired per owner order:
 * one wallet, one address, everywhere. This page now shows the linked in-app
 * (desk) wallet with live balances, plus link/unlink.
 */
import { useEffect, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { Wallet, Copy, Check, Unlink, RefreshCw } from "lucide-react";
import { useOrbitxBilling } from "@/tokenomics/useOrbitxBilling";
import { ORBITX_MINT } from "@/tokenomics/constants";
import { browserWalletRpcUrl } from "@/lib/solanaRpc";
import { shortAddr } from "./tradeFmt";

export default function TradeWalletManager() {
  const { connection } = useConnection();
  const billing = useOrbitxBilling();
  const [sol, setSol] = useState<number | null>(null);
  const [orbitx, setOrbitx] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const address = billing.wallet;
  const linked = billing.ready && !!address;

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

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-black text-white">In-app wallet</h1>
        <p className="mt-1 text-sm text-white/40">
          The only wallet across OrbitX — same address on every surface. Backend-signed, no popups.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-og-cyan/10">
            <Wallet className="h-6 w-6 text-og-cyan" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] uppercase tracking-widest text-white/40">
              {linked ? "Linked desk wallet" : "No wallet linked"}
            </p>
            {linked ? (
              <button
                type="button"
                onClick={copy}
                className="mt-0.5 flex items-center gap-2 font-mono text-sm font-bold text-white hover:text-og-cyan"
                title="Copy address"
              >
                <span className="truncate">{shortAddr(address!, 8)}</span>
                {copied ? <Check className="h-4 w-4 text-og-lime" /> : <Copy className="h-4 w-4 text-white/30" />}
              </button>
            ) : (
              <p className="mt-0.5 text-sm text-white/50">Link it once — trades and burns become seamless.</p>
            )}
          </div>
          {linked ? (
            <button
              type="button"
              onClick={() => billing.resetAuth()}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-white/50 hover:border-og-blood hover:text-og-blood"
            >
              <Unlink className="h-3 w-3" /> Unlink
            </button>
          ) : (
            <button
              type="button"
              onClick={() => billing.beginAuth()}
              className="inline-flex items-center gap-1.5 rounded-full border border-og-cyan/40 bg-og-cyan/10 px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-og-cyan hover:border-og-cyan hover:bg-og-cyan/20"
            >
              <Wallet className="h-3.5 w-3.5" /> Link in-app wallet
            </button>
          )}
        </div>

        {billing.error && (
          <p className="mt-3 text-xs text-og-blood">{billing.error}</p>
        )}

        {linked && (
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/[0.07] bg-black/30 p-4">
              <p className="font-mono text-[10px] uppercase tracking-widest text-white/35">SOL</p>
              <p className="mt-1 font-mono text-xl font-black text-white">
                {sol === null ? "—" : sol.toFixed(4)}
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-black/30 p-4">
              <p className="font-mono text-[10px] uppercase tracking-widest text-white/35">ORBITX</p>
              <p className="mt-1 font-mono text-xl font-black text-white">
                {orbitx === null ? "—" : orbitx.toLocaleString()}
              </p>
            </div>
          </div>
        )}

        {linked && (
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="mt-4 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-white/40 hover:text-white/70 disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh balances
          </button>
        )}
      </div>

      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-white/50">What changed</p>
        <p className="mt-2 text-sm leading-relaxed text-white/45">
          Phantom, Jupiter, and imported browser keypairs are retired. Your in-app wallet is now the
          only wallet — the same address in the hub, the city, the trade terminal, and the shop.
          It signs on the backend, so there's nothing to install and no popups.
        </p>
        <p className="mt-2 font-mono text-[11px] text-white/30">
          RPC: {browserWalletRpcUrl().replace(/^https?:\/\//, "").slice(0, 42)}…
        </p>
      </div>
    </div>
  );
}
