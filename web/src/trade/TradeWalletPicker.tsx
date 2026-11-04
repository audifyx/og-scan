/**
 * OrbitX Trade wallet — the in-app wallet is the only wallet.
 *
 * The in-app wallet is ALREADY linked when a wallet exists on this device:
 * there is no link step, ever. This modal only ever shows the linked state
 * (address + "Linked" badge) or — when this device has no wallet yet — a
 * one-tap "create on this device" path. The desk-wallet dashboard
 * auth-code flow (useOrbitxBilling().beginAuth) is not a wallet-link step
 * and is never triggered from here; desk auth still happens where a spend
 * needs it (SwapPanel, TradingTerminal, Settings, …).
 */
import { useCallback, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, Loader2, Plus, Wallet, X } from "lucide-react";
import { toast } from "sonner";
import { useOrbitxBilling } from "@/tokenomics/useOrbitxBilling";
import { useLocalWallets } from "@/lib/localWallets";

export const TRADE_WALLET_NAMES = ["In-App"] as const;
export type TradeWalletName = (typeof TRADE_WALLET_NAMES)[number];

function shortAddr(a: string, n = 4): string {
  return a.length > n * 2 ? `${a.slice(0, n)}…${a.slice(-n)}` : a;
}

/**
 * Source of truth for "already linked": a wallet exists on this device.
 * - `wallets.solana` — plaintext v2 wallet, or a PIN wallet unlocked for
 *   this browser session (session cache).
 * - `locked` / `hasPin` — a PIN-encrypted v3 envelope lives on this device
 *   but the session plaintext is gone; the wallet still exists, its address
 *   just isn't readable until it is unlocked.
 * The desk wallet (billing.wallet) counts too: if the dashboard auth-code
 * flow already resolved it, the in-app wallet is linked as well.
 * Read with autoCreate: false — rendering this hook must never create a
 * wallet as a side effect.
 */
export function useInAppWalletLinked() {
  const local = useLocalWallets({ autoCreate: false });
  const billing = useOrbitxBilling();
  const localAddress = local.wallets?.solana?.publicKey ?? null;
  const localExists = !!localAddress || local.locked || local.hasPin;
  const deskAddress = billing.wallet;
  const deskLinked = billing.ready && !!deskAddress;
  const linked = localExists || !!deskAddress;
  // Prefer the desk address: it is the backend-signed trading identity.
  const address = deskAddress ?? localAddress;
  return {
    ready: local.ready,
    linked,
    address,
    deskLinked,
    create: local.create,
  };
}

export function TradeWalletPickerModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { ready, linked, address, create } = useInAppWalletLinked();
  const [busy, setBusy] = useState(false);

  const onCreate = useCallback(() => {
    setBusy(true);
    try {
      create();
      toast.success("Wallet created on this device");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create wallet");
    } finally {
      setBusy(false);
    }
  }, [create, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-[340px] space-y-4 rounded-2xl border border-[var(--term-gold)]/30 bg-[var(--term-bg)] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="In-app wallet"
      >
        <div className="flex items-center justify-between">
          <h3
            className="text-3xl leading-none text-[var(--term-ink)]"
            style={{ fontFamily: "var(--term-hand)" }}
          >
            In-app wallet
          </h3>
          <button type="button" onClick={onClose} className="text-[var(--term-silver)] hover:text-white" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        {linked ? (
          <>
            <p className="text-xs leading-relaxed text-[var(--term-silver)]">
              Your wallet is already linked on this device — trades sign on the
              backend, no popups, no extensions.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="group flex w-full items-center gap-3 rounded-xl border border-[var(--term-gold)]/40 bg-white/[0.05] px-4 py-3 text-left transition hover:border-[var(--term-gold)]"
            >
              <Wallet className="h-8 w-8 text-[var(--term-gold)]" />
              <span className="flex-1 text-sm font-semibold text-[var(--term-ink)]">
                {address ? shortAddr(address) : "In-App Wallet"}
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-[var(--term-gold)]">
                <Check className="h-3.5 w-3.5" /> Linked
              </span>
            </button>
          </>
        ) : !ready ? (
          <div className="flex items-center gap-2 px-1 py-3 text-sm text-[var(--term-silver)]">
            <Loader2 className="h-4 w-4 animate-spin text-[var(--term-gold)]" />
            Checking wallet…
          </div>
        ) : (
          <>
            <p className="text-xs leading-relaxed text-[var(--term-silver)]">
              No wallet on this device yet. Create one — it lives only on this
              device. No link step, no extension.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={onCreate}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--term-gold)] px-4 py-3 text-sm font-bold text-black transition hover:brightness-110 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Create wallet on this device
            </button>
          </>
        )}
        <p className="text-center text-[10px] text-white/25">One wallet, one address, everywhere.</p>
      </div>
    </div>,
    document.body,
  );
}

/** Hook: open picker from any Trade CTA; render `{picker}` once in the tree. */
export function useTradeWalletPicker() {
  const [open, setOpen] = useState(false);
  const openPicker = useCallback(() => setOpen(true), []);
  const closePicker = useCallback(() => setOpen(false), []);
  const picker = <TradeWalletPickerModal open={open} onClose={closePicker} />;
  return { open, openPicker, closePicker, picker };
}

type ButtonProps = {
  className?: string;
  children?: ReactNode;
};

/** Self-contained wallet button + modal. No link step: linked, or create. */
export function TradeConnectWalletButton({ className, children }: ButtonProps) {
  const { openPicker, picker } = useTradeWalletPicker();
  const { ready, linked } = useInAppWalletLinked();
  return (
    <>
      <button type="button" onClick={openPicker} className={className}>
        {children ?? (
          <>
            <Wallet className="h-3.5 w-3.5" />{" "}
            {linked ? "Wallet linked" : ready ? "Create wallet" : "Wallet"}
          </>
        )}
      </button>
      {picker}
    </>
  );
}
