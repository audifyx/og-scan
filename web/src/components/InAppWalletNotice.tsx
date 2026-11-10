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
import { useHumanGate } from "@/components/HumanGate";
import { ORBITX_RISK_DISCLAIMER } from "@/lib/contact";

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
  const { requireHuman } = useHumanGate();
  const linked = billing.ready && !!billing.wallet;

  const onLinkWallet = async () => {
    const ok = await requireHuman();
    if (!ok) return;
    billing.beginAuth();
  };

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
      <p className="mx-auto mt-3 max-w-sm border-t border-white/5 pt-3 text-left text-[11px] leading-relaxed text-white/45">
        <span className="font-bold text-white/70">How your wallet works: </span>
        linking connects your OrbitX in-app wallet — no browser extension, no deposit to OrbitX.
        Your wallet keys are created on your device and never sent to our servers. Trades execute
        on-chain through the in-app wallet; OrbitX never holds or receives your funds.
      </p>
      <p className="mx-auto mt-2 max-w-sm text-[11px] leading-relaxed text-white/35">
        {ORBITX_RISK_DISCLAIMER}
      </p>
      {!linked ? (
        <button
          type="button"
          onClick={onLinkWallet}
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
