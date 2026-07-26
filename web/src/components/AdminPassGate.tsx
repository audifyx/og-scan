// Soft UI gate only — NOT a security boundary. Use a different value from server ADMIN_PASS.
// Never set VITE_ADMIN_PASS equal to ADMIN_PASS (Vite inlines client env into the SPA).
import { useState } from "react";
import { Lock } from "lucide-react";
import { setAdminUnlocked } from "@/hooks/useAdmin";

const ADMIN_PASSCODE = (import.meta.env.VITE_ADMIN_PASS as string | undefined)?.trim() || "";

export function AdminPassGate({ children }: { children?: React.ReactNode }) {
  const [unlocked, setUnlockedLocal] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ADMIN_PASSCODE || ADMIN_PASSCODE.length < 8) {
      setError("Admin pass is not configured in this environment.");
      return;
    }
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
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-og-lime/50"
            placeholder="Passcode"
            autoComplete="current-password"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button type="submit" className="w-full rounded-xl bg-og-lime/90 py-3 text-sm font-bold text-black hover:bg-og-lime">
            Unlock
          </button>
        </form>
      </div>
    </div>
  );
}
