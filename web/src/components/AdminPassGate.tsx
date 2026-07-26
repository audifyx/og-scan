/**
 * Soft UI gate only — NOT a security boundary for APIs.
 * Real API auth uses server ADMIN_PASS / owner JWT (never this code).
 */
import { useState } from "react";
import { Lock } from "lucide-react";
import { setAdminUnlocked } from "@/hooks/useAdmin";
import { OWNER_DESK_CODE, OWNER_EMAIL } from "@/lib/ownerDesk";

export function AdminPassGate({ children }: { children?: React.ReactNode }) {
  const [unlocked, setUnlockedLocal] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim() === OWNER_DESK_CODE) {
      setAdminUnlocked(true);
      setUnlockedLocal(true);
      setError("");
    } else {
      setError("Incorrect code");
      setCode("");
    }
  };

  if (unlocked) return <>{children}</>;

  return (
    <div className="min-h-screen bg-[#020915] flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.03] p-8">
        <div className="mb-6 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/5">
            <Lock className="h-7 w-7 text-white/50" />
          </div>
        </div>
        <h1 className="mb-1 text-center text-xl font-black text-white">Continue</h1>
        <p className="mb-6 text-center text-sm text-white/40">Enter access code.</p>
        <form onSubmit={submit} className="space-y-3">
          <input
            type="password"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-white/30"
            placeholder="Code"
            autoComplete="off"
            autoFocus
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button type="submit" className="w-full rounded-xl bg-white/90 py-3 text-sm font-bold text-black hover:bg-white">
            Unlock
          </button>
        </form>
        <p className="mt-4 text-center text-[10px] text-white/25">
          Signed-in owner required ({OWNER_EMAIL})
        </p>
      </div>
    </div>
  );
}
