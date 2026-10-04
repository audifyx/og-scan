/**
 * Honest placeholder for flows whose custom transactions aren't backend-signed yet.
 *
 * The in-app (desk) wallet is now the only wallet across OrbitX. Trades
 * (orbitx_app_buy/sell) and burns (burnPurchase/spend) are backend-signed and
 * work. Arbitrary custom transactions (mints, launches, claims, transfers)
 * don't have a backend signer yet — this notice says so instead of faking it.
 */
import { Wallet } from "lucide-react";
import { useOrbitxBilling } from "@/tokenomics/useOrbitxBilling";

export function shortAddr(a: string, n = 4): string {
  return a.length > n * 2 ? `${a.slice(0, n)}…${a.slice(-n)}` : a;
}

export function InAppWalletNotice({
  action = "This action",
  compact = false,
}: {
  action?: string;
  compact?: boolean;
}) {
  const billing = useOrbitxBilling();
  const linked = billing.ready && !!billing.wallet;

  return (
    <div
      className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center"
      style={compact ? { padding: "1rem" } : undefined}
    >
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-og-cyan/10">
        <Wallet className="h-5 w-5 text-og-cyan" />
      </div>
      <p className="text-sm font-bold text-white">{action} is moving to the in-app wallet</p>
      <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-white/50">
        OrbitX no longer uses Phantom or Jupiter — your in-app wallet is the only wallet.
        Backend signing for this kind of transaction isn't live yet, so it's paused rather than faked.
        Trades and burns already work through the in-app wallet.
      </p>
      {!linked ? (
        <button
          type="button"
          onClick={() => billing.beginAuth()}
          className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-full border border-og-cyan/40 bg-og-cyan/10 px-5 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-og-cyan transition hover:border-og-cyan hover:bg-og-cyan/20"
        >
          <Wallet className="h-3.5 w-3.5" /> Link in-app wallet
        </button>
      ) : (
        <p className="mt-3 font-mono text-[11px] text-white/40">
          Linked: <span className="text-og-lime">{shortAddr(billing.wallet!)}</span>
        </p>
      )}
      {billing.error && (
        <p className="mt-2 text-xs text-og-blood">{billing.error}</p>
      )}
    </div>
  );
}

export default InAppWalletNotice;
