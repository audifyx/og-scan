// Wallet chooser — lists every wallet the adapter detects (Phantom, Jupiter,
// Solflare, Backpack, …). Installed wallets first.
import { X, Loader2, Wallet, ExternalLink } from "lucide-react";
import type { PickableWallet } from "@/hooks/useWalletSignIn";

export function WalletPickerModal({ open, onClose, wallets, onPick, busy }: {
  open: boolean; onClose: () => void; wallets: PickableWallet[];
  onPick: (name: string) => void; busy: string | null;
}) {
  if (!open) return null;
  const installed = wallets.filter((w) => w.readyState === "Installed" || w.readyState === "Loadable");
  const rest = wallets.filter((w) => !(w.readyState === "Installed" || w.readyState === "Loadable"));
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0a1220] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-black text-white"><Wallet className="h-4 w-4 text-og-cyan" /> Connect a wallet</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-white/50" /></button>
        </div>
        <p className="mb-4 text-[12px] text-white/50">Your wallet is your login. You'll sign a free message to prove ownership — no transaction, no fees.</p>
        <div className="space-y-1.5">
          {installed.map((w) => <Row key={w.name} w={w} onPick={onPick} busy={busy} />)}
          {installed.length === 0 && <p className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-3 text-[12px] text-white/50">No Solana wallet detected. Install Phantom or Jupiter, then reload.</p>}
          {rest.length > 0 && <div className="pt-2 text-[10px] font-bold uppercase tracking-widest text-white/30">More</div>}
          {rest.map((w) => <Row key={w.name} w={w} onPick={onPick} busy={busy} />)}
        </div>
        <div className="mt-4 flex items-center justify-center gap-3 text-[11px] text-white/40">
          <a href="https://phantom.app" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-og-cyan">Get Phantom <ExternalLink className="h-3 w-3" /></a>
          <a href="https://jup.ag/mobile" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-og-cyan">Get Jupiter <ExternalLink className="h-3 w-3" /></a>
        </div>
      </div>
    </div>
  );
}

function Row({ w, onPick, busy }: { w: PickableWallet; onPick: (n: string) => void; busy: string | null }) {
  const detected = w.readyState === "Installed" || w.readyState === "Loadable";
  const url = (w.adapter as any)?.url as string | undefined;
  if (!detected) {
    // Not installed — link to the wallet site instead of triggering the adapter's
    // own website redirect on connect(). Keeps connect() in-app for real wallets.
    return (
      <a href={url || "#"} target="_blank" rel="noreferrer"
        className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5 text-left opacity-70 transition hover:opacity-100">
        {w.icon ? <img src={w.icon} alt="" className="h-6 w-6 rounded-md" /> : <Wallet className="h-6 w-6 text-white/60" />}
        <span className="flex-1 text-sm font-bold text-white">{w.name}</span>
        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-white/40">Install <ExternalLink className="h-3 w-3" /></span>
      </a>
    );
  }
  return (
    <button type="button" onClick={() => onPick(w.name)} disabled={!!busy}
      className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left transition hover:border-og-cyan/50 hover:bg-white/[0.06] disabled:opacity-50">
      {w.icon ? <img src={w.icon} alt="" className="h-6 w-6 rounded-md" /> : <Wallet className="h-6 w-6 text-white/60" />}
      <span className="flex-1 text-sm font-bold text-white">{w.name}</span>
      {busy === w.name ? <Loader2 className="h-4 w-4 animate-spin text-og-cyan" /> :
        <span className="text-[10px] font-bold uppercase tracking-widest text-og-lime">Detected</span>}
    </button>
  );
}
