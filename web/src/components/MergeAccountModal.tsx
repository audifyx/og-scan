// One-time legacy account merge: enter your old email/password once to fold that
// account (and all its data) into your wallet identity. After this, wallet is
// the only login you need.
import { useState } from "react";
import { X, Loader2, GitMerge } from "lucide-react";
import { toast } from "sonner";
import { mergeLegacyAccount } from "@/lib/walletAuth";

export function MergeAccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await mergeLegacyAccount(email.trim(), password);
      toast.success("Account merged into your wallet. Email/password login is no longer needed.");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Merge failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0a1220] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-black text-white"><GitMerge className="h-4 w-4 text-og-gold" /> Merge your old account</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-white/50" /></button>
        </div>
        <p className="mb-4 text-[12px] text-white/50">Had an OrbitX account with email &amp; password? Enter it one last time to move everything — profile, history, credits — under this wallet.</p>
        <form onSubmit={submit} className="space-y-2.5">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com"
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-og-cyan/60" />
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password"
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-og-cyan/60" />
          <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-og-cyan px-4 py-2.5 text-sm font-black text-black disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitMerge className="h-4 w-4" />} Merge into wallet
          </button>
          <button type="button" onClick={onClose} className="w-full py-1.5 text-[12px] text-white/40 hover:text-white/70">Skip — I'm new here</button>
        </form>
      </div>
    </div>
  );
}
