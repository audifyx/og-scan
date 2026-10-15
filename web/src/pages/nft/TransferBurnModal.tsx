// Transfer / Burn for standard SPL NFTs — backend-signed by the in-app wallet.
// (Programmable NFTs would require the Metaplex transfer flow.)
import { useState } from "react";
import { toast } from "sonner";
import { X, Send, Flame, Loader2 } from "lucide-react";
import { useActiveTradingWallet } from "@/hooks/useActiveTradingWallet";
import { deskNftTransfer, deskNftBurn } from "@/lib/nftDesk";

export function TransferBurnModal({ mint, name, onClose, onDone }: { mint: string; name: string; onClose: () => void; onDone?: () => void }) {
  const { ready } = useActiveTradingWallet();
  const [tab, setTab] = useState<"transfer" | "burn">("transfer");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmBurn, setConfirmBurn] = useState("");

  const doTransfer = async () => {
    if (!ready) return toast.error("Link your in-app wallet first");
    if (!to.trim()) return toast.error("Enter a recipient address");
    setBusy(true);
    try {
      const sig = await deskNftTransfer(mint, to.trim());
      toast.success(`Transferred ${name}`, { description: `https://solscan.io/tx/${sig}` });
      onDone?.(); onClose();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Transfer failed"); }
    finally { setBusy(false); }
  };

  const doBurn = async () => {
    if (!ready) return toast.error("Link your in-app wallet first");
    if (confirmBurn.trim().toUpperCase() !== "BURN") return toast.error("Type BURN to confirm");
    setBusy(true);
    try {
      const sig = await deskNftBurn(mint);
      toast.success(`Burned ${name} · rent reclaimed`, { description: `https://solscan.io/tx/${sig}` });
      onDone?.(); onClose();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Burn failed"); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#101016] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="truncate text-base font-black text-white">Manage “{name}”</h3>
          <button onClick={onClose} aria-label="Close"><X className="h-4 w-4 text-white/50" /></button>
        </div>
        <div className="mb-4 flex gap-1 rounded-xl bg-white/[0.04] p-1">
          <button onClick={() => setTab("transfer")} className={`flex-1 rounded-lg px-3 py-1.5 text-[12px] font-bold ${tab === "transfer" ? "bg-og-cyan text-black" : "text-white/60"}`}>Transfer</button>
          <button onClick={() => setTab("burn")} className={`flex-1 rounded-lg px-3 py-1.5 text-[12px] font-bold ${tab === "burn" ? "bg-og-blood text-white" : "text-white/60"}`}>Burn</button>
        </div>
        {tab === "transfer" ? (
          <div className="space-y-3">
            <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Recipient wallet address"
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-og-cyan/60" />
            <button onClick={doTransfer} disabled={busy || !ready} className="flex w-full items-center justify-center gap-2 rounded-xl bg-og-cyan px-4 py-2.5 text-sm font-black text-black disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send NFT
            </button>
            {!ready && <p className="text-center text-[11px] text-white/40">Link your in-app wallet to transfer.</p>}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[12px] text-white/50">Burning permanently destroys this NFT and reclaims its rent (~0.002 SOL) to your in-app wallet. This cannot be undone. Type <span className="font-black text-og-blood">BURN</span> to confirm.</p>
            <input value={confirmBurn} onChange={(e) => setConfirmBurn(e.target.value)} placeholder="BURN"
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-og-blood/60" />
            <button onClick={doBurn} disabled={busy || !ready} className="flex w-full items-center justify-center gap-2 rounded-xl bg-og-blood px-4 py-2.5 text-sm font-black text-white disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flame className="h-4 w-4" />} Burn NFT
            </button>
            {!ready && <p className="text-center text-[11px] text-white/40">Link your in-app wallet to burn.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
