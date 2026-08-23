/**
 * Soft UI gate only — NOT a security boundary for APIs.
 * PIN is checked on Vercel (/api/orbitx-desk-unlock). Never compare locally.
 *
 * Shown only after AdminRoute confirmed the signed-in identity is the owner.
 * Do not print the owner email, wallet list, or PIN.
 */
import { useState } from "react";
import { Lock, Loader2 } from "lucide-react";
import { persistDeskUnlock, requestDeskUnlock } from "../../shared/desk-unlock-client.js";
import { supabase } from "@/lib/supabase";

export function AdminPassGate(_props?: { children?: React.ReactNode }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const typed = code.trim();
    if (!typed) {
      setError("Incorrect code");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = await requestDeskUnlock(typed, data.session?.access_token);
      persistDeskUnlock(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Incorrect code");
      setCode("");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020915] p-4">
        <div className="flex flex-col items-center gap-3 text-white/60">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">Opening desk…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#020915] p-4">
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
      </div>
    </div>
  );
}
