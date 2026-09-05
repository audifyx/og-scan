/**
 * OrbitX Trade wallet chooser — Phantom / Jupiter only.
 * User picks; we never auto-select Solflare (or any other) on Connect.
 */
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Loader2, Wallet, X } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { toast } from "sonner";
import { adapterNameMatches, connectSolanaWallet, phantomInstallHint } from "@/lib/connectSolanaWallet";
import { useLocalTradingWallets } from "@/hooks/useLocalTradingWallets";

export const TRADE_WALLET_NAMES = ["Phantom", "Jupiter"] as const;
export type TradeWalletName = (typeof TRADE_WALLET_NAMES)[number];

export function TradeWalletPickerModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { wallets, select, connect } = useWallet();
  const { setMode } = useLocalTradingWallets();
  const [busy, setBusy] = useState<string | null>(null);

  const rows = useMemo(() => {
    return TRADE_WALLET_NAMES.map((name) => {
      const hit = wallets.find((w) => adapterNameMatches(String(w.adapter.name), name));
      return {
        name,
        icon: hit?.adapter.icon,
      };
    });
  }, [wallets]);

  const onPick = useCallback(
    async (name: TradeWalletName) => {
      setBusy(name);
      setMode("connected");
      try {
        await connectSolanaWallet({
          wallets,
          select,
          connect,
          preferredName: name,
        });
        toast.success(`${name} connected`);
        onClose();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err || phantomInstallHint(name));
        toast.error(msg);
      } finally {
        setBusy(null);
      }
    },
    [wallets, select, connect, setMode, onClose],
  );

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
        aria-label="Connect wallet"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Connect wallet</h3>
          <button type="button" onClick={onClose} className="text-white/30 hover:text-white/60" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-xs text-white/40">
          Choose Phantom or Jupiter. Trades sign in-app — we never open wallet marketing sites.
        </p>
        <div className="space-y-2">
          {rows.map((w) => (
            <button
              key={w.name}
              type="button"
              disabled={!!busy}
              onClick={() => void onPick(w.name)}
              className="group flex w-full items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.05] px-4 py-3 text-left transition hover:border-white/25 hover:bg-white/[0.1] disabled:opacity-50"
            >
              {w.icon ? (
                <img src={w.icon} alt="" className="h-8 w-8 rounded-lg" />
              ) : (
                <Wallet className="h-8 w-8 text-white/40" />
              )}
              <span className="flex-1 text-sm font-semibold text-white">{w.name}</span>
              {busy === w.name ? (
                <Loader2 className="h-4 w-4 animate-spin text-white/50" />
              ) : (
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400/80">
                  Connect
                </span>
              )}
            </button>
          ))}
        </div>
        <p className="text-center text-[10px] text-white/25">Your keys never leave your wallet.</p>
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

/** Self-contained Connect wallet button + modal. */
export function TradeConnectWalletButton({ className, children }: ButtonProps) {
  const { openPicker, picker } = useTradeWalletPicker();
  return (
    <>
      <button type="button" onClick={openPicker} className={className}>
        {children ?? (
          <>
            <Wallet className="h-3.5 w-3.5" /> Connect wallet
          </>
        )}
      </button>
      {picker}
    </>
  );
}
