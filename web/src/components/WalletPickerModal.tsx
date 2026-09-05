// Custom hub chooser — Phantom and Jupiter only. Always Connect (never Install).
import { createPortal } from "react-dom";
import { X, Loader2, Wallet, ExternalLink } from "lucide-react";
import type { PickableWallet } from "@/hooks/useWalletSignIn";

export function WalletPickerModal({ open, onClose, wallets, onPick, busy }: {
  open: boolean; onClose: () => void; wallets: PickableWallet[];
  onPick: (name: string) => void; busy: string | null;
}) {
  if (!open) return null;
  if (typeof document === "undefined") return null;
  const rows = (wallets.length ? wallets : [
    { name: "Phantom", icon: "", readyState: "Loadable" as const, adapter: { name: "Phantom", icon: "", url: "https://phantom.app" } },
    { name: "Jupiter", icon: "", readyState: "Loadable" as const, adapter: { name: "Jupiter", icon: "", url: "https://jup.ag" } },
  ]).filter((w) => /phantom|jupiter/i.test(w.name));
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0a1220] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-black text-white"><Wallet className="h-4 w-4 text-og-cyan" /> Connect a wallet</h3>
          <button type="button" onClick={onClose}><X className="h-4 w-4 text-white/50" /></button>
        </div>
        <p className="mb-4 text-[12px] text-white/50">Phantom or Jupiter. You&apos;ll sign a free message to log in — no transaction, no fees.</p>
        <div className="space-y-1.5">
          {rows.map((w) => (
            <button key={w.name} type="button" onClick={() => onPick(w.name)} disabled={!!busy}
              className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left transition hover:border-og-cyan/50 hover:bg-white/[0.06] disabled:opacity-50">
              <Wallet className="h-6 w-6 text-og-cyan" />
              <span className="flex-1 text-sm font-bold text-white">Connect {w.name}</span>
              {busy === w.name ? <Loader2 className="h-4 w-4 animate-spin text-og-cyan" /> :
                <span className="text-[10px] font-bold uppercase tracking-widest text-og-lime">Connect</span>}
            </button>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-center gap-3 text-[11px] text-white/40">
          <a href="https://phantom.app" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-og-cyan">Get Phantom <ExternalLink className="h-3 w-3" /></a>
          <a href="https://jup.ag" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-og-cyan">Get Jupiter <ExternalLink className="h-3 w-3" /></a>
        </div>
      </div>
    </div>,
    document.body,
  );
}
