// Passcode gate for admin dashboards — same pattern as the DEX admin.
// Unlocks every admin surface for the browser session; no wallet or login required.
import { useState } from "react";
import { Lock } from "lucide-react";
import { setAdminUnlocked } from "@/hooks/useAdmin";

const ADMIN_PASSCODE = "0129";

export function AdminPassGate({ children }: { children?: React.ReactNode }) {
  const [unlocked, setUnlockedLocal] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code === ADMIN_PASSCODE) {
      setAdminUnlocked(true);
      setUnlockedLocal(true);
      setError("");
    } else {
      setError("Incorrect passcode");
      setCode("");
    }
  };

  if (unlocked) return <>{children}</>;

  return (
    <div className="min-h-screen bg-[#020915] flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.03] p-8">
        <div className="mb-6 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-og-lime/30 bg-og-lime/10">
            <Lock className="h-7 w-7 text-og-lime" />
          </div>
        </div>
        <h1 className="mb-1 text-center text-xl font-black text-white">Admin access</h1>
        <p className="mb-6 text-center text-sm text-white/40">Enter the admin passcode to continue.</p>
        <form onSubmit={submit} className="space-y-3">
          <input
            type="password"
            inputMode="numeric"
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Passcode"
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center text-lg tracking-[0.5em] text-white outline-none placeholder:tracking-normal placeholder:text-white/25 focus:border-og-lime/50"
          />
          {error && <p className="text-center text-sm text-red-400">{error}</p>}
          <button type="submit" className="w-full rounded-xl bg-og-lime px-4 py-3 text-sm font-black text-black hover:bg-og-lime/90">
            Unlock
          </button>
        </form>
      </div>
    </div>
  );
}
