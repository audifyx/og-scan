/**
 * OrbitX Trade wallet — the in-app wallet is the only wallet.
 * One row, one tap: link the in-app wallet via the dashboard auth-code flow.
 */
import { useCallback, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Loader2, Wallet, X } from "lucide-react";
import { toast } from "sonner";
import { useOrbitxBilling } from "@/tokenomics/useOrbitxBilling";

export const TRADE_WALLET_NAMES = ["In-App"] as const;
export type TradeWalletName = (typeof TRADE_WALLET_NAMES)[number];

function shortAddr(a: string, n = 4): string {
  return a.length > n * 2 ? `${a.slice(0, n)}…${a.slice(-n)}` : a;
}

export function TradeWalletPickerModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const billing = useOrbitxBilling();
  const [busy, setBusy] = useState(false);
  const linked = billing.ready && !!billing.wallet;

  const onPick = useCallback(async () => {
    if (linked) {
      onClose();
      return;
    }
    setBusy(true);
    try {
      billing.beginAuth();
      toast.success("Linking in-app wallet…");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not link wallet");
    } finally {
      setBusy(false);
    }
  }, [billing, linked, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-[340px] space-y-4 rounded-2xl border border-white/10 bg-[#111] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Link wallet"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">In-app wallet</h3>
          <button type="button" onClick={onClose} className="text-white/30 hover:text-white/60" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-xs text-white/40">
          Your OrbitX in-app wallet is the only wallet. One link — trades sign
          on the backend, no popups, no extensions.
        </p>
        <div className="space-y-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void onPick()}
            className="group flex w-full items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.05] px-4 py-3 text-left transition hover:border-white/25 hover:bg-white/[0.1] disabled:opacity-50"
          >
            <Wallet className="h-8 w-8 text-white/40" />
            <span className="flex-1 text-sm font-semibold text-white">
              {linked && billing.wallet ? shortAddr(billing.wallet) : "In-App Wallet"}
            </span>
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin text-white/50" />
            ) : (
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400/80">
                {linked ? "Linked" : "Link"}
              </span>
            )}
          </button>
        </div>
        {billing.error && (
          <p className="text-center text-[11px] text-red-400/80">{billing.error}</p>
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

/** Self-contained Link-wallet button + modal. */
export function TradeConnectWalletButton({ className, children }: ButtonProps) {
  const { openPicker, picker } = useTradeWalletPicker();
  const billing = useOrbitxBilling();
  const linked = billing.ready && !!billing.wallet;
  return (
    <>
      <button type="button" onClick={openPicker} className={className}>
        {children ?? (
          <>
            <Wallet className="h-3.5 w-3.5" /> {linked ? "Wallet linked" : "Link wallet"}
          </>
        )}
      </button>
      {picker}
    </>
  );
}
