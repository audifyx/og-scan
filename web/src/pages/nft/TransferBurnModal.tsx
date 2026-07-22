// Phase 5 — real on-chain Transfer / Burn for standard SPL NFTs, signed by the
// connected wallet. (Programmable NFTs would require the Metaplex transfer flow.)
import { useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync, createAssociatedTokenAccountInstruction,
  createTransferInstruction, createBurnInstruction, createCloseAccountInstruction,
} from "@solana/spl-token";
import { toast } from "sonner";
import { X, Send, Flame, Loader2 } from "lucide-react";

export function TransferBurnModal({ mint, name, onClose, onDone }: { mint: string; name: string; onClose: () => void; onDone?: () => void }) {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [tab, setTab] = useState<"transfer" | "burn">("transfer");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmBurn, setConfirmBurn] = useState("");

  const doTransfer = async () => {
    if (!publicKey || !sendTransaction) return toast.error("Connect your wallet");
    let dest: PublicKey;
    try { dest = new PublicKey(to.trim()); } catch { return toast.error("Invalid recipient address"); }
    setBusy(true);
    try {
      const mintPk = new PublicKey(mint);
      const fromAta = getAssociatedTokenAddressSync(mintPk, publicKey);
      const toAta = getAssociatedTokenAddressSync(mintPk, dest);
      const tx = new Transaction();
      if (!(await connection.getAccountInfo(toAta))) tx.add(createAssociatedTokenAccountInstruction(publicKey, toAta, dest, mintPk));
      tx.add(createTransferInstruction(fromAta, toAta, publicKey, 1));
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");
      toast.success(`Transferred ${name}`);
      onDone?.(); onClose();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Transfer failed"); }
    finally { setBusy(false); }
  };

  const doBurn = async () => {
    if (!publicKey || !sendTransaction) return toast.error("Connect your wallet");
    if (confirmBurn.trim().toUpperCase() !== "BURN") return toast.error('Type BURN to confirm');
    setBusy(true);
    try {
      const mintPk = new PublicKey(mint);
      const ata = getAssociatedTokenAddressSync(mintPk, publicKey);
      const tx = new Transaction()
        .add(createBurnInstruction(ata, mintPk, publicKey, 1))
        .add(createCloseAccountInstruction(ata, publicKey, publicKey));
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");
      toast.success(`Burned ${name} · rent reclaimed`);
      onDone?.(); onClose();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Burn failed"); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0a1220] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="truncate text-base font-black text-white">Manage “{name}”</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-white/50" /></button>
        </div>
        <div className="mb-4 flex gap-1 rounded-xl bg-white/[0.04] p-1">
          <button onClick={() => setTab("transfer")} className={`flex-1 rounded-lg px-3 py-1.5 text-[12px] font-bold ${tab === "transfer" ? "bg-og-cyan text-black" : "text-white/60"}`}>Transfer</button>
          <button onClick={() => setTab("burn")} className={`flex-1 rounded-lg px-3 py-1.5 text-[12px] font-bold ${tab === "burn" ? "bg-og-blood text-white" : "text-white/60"}`}>Burn</button>
        </div>
        {tab === "transfer" ? (
          <div className="space-y-3">
            <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Recipient wallet address"
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-og-cyan/60" />
            <button onClick={doTransfer} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-og-cyan px-4 py-2.5 text-sm font-black text-black disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send NFT
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[12px] text-white/50">Burning permanently destroys this NFT and reclaims its rent. This cannot be undone. Type <span className="font-black text-og-blood">BURN</span> to confirm.</p>
            <input value={confirmBurn} onChange={(e) => setConfirmBurn(e.target.value)} placeholder="BURN"
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-og-blood/60" />
            <button onClick={doBurn} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-og-blood px-4 py-2.5 text-sm font-black text-white disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flame className="h-4 w-4" />} Burn NFT
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
