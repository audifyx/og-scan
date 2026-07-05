/**
 * BetaGate — site-wide access lock.
 * Every visitor (including splash and auth pages) lands here first until they
 * enter the beta access code. Access persists in localStorage so returning
 * users skip the gate. Code: shared privately with beta users.
 */
import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import { KeyRound, Lock, Rocket, Sparkles } from "lucide-react";

const ACCESS_KEY = "orbitx-beta-access";
const ACCESS_VALUE = "granted-v1";
const BETA_CODE = "orbitx"; // shared with beta users

function hasAccess(): boolean {
  try { return localStorage.getItem(ACCESS_KEY) === ACCESS_VALUE; } catch { return false; }
}

export function BetaGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState<boolean>(hasAccess);
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!unlocked) setTimeout(() => inputRef.current?.focus(), 300);
  }, [unlocked]);

  if (unlocked) return <>{children}</>;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (code.trim().toLowerCase() === BETA_CODE) {
      try { localStorage.setItem(ACCESS_KEY, ACCESS_VALUE); } catch { /* private mode */ }
      setUnlocked(true);
    } else {
      setError(true);
      setShake(true);
      setCode("");
      setTimeout(() => setShake(false), 500);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex min-h-screen items-center justify-center overflow-hidden bg-[#050608] px-4">
      <style>{`
        @keyframes bg-drift { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-4%,3%) scale(1.08)} }
        @keyframes gate-shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-5px)} 80%{transform:translateX(5px)} }
        .gate-shake { animation: gate-shake .45s ease; }
      `}</style>

      {/* ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-[#1d9bf0]/15 blur-[120px]" style={{ animation: "bg-drift 14s ease-in-out infinite" }} />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-[#9945FF]/15 blur-[120px]" style={{ animation: "bg-drift 18s ease-in-out infinite reverse" }} />
      </div>

      <div className={`relative w-full max-w-md ${shake ? "gate-shake" : ""}`}>
        <div className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-8 shadow-2xl backdrop-blur-xl sm:p-10">
          {/* brand */}
          <div className="flex items-center justify-center gap-2.5">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-[#1d9bf0] to-[#9945FF] text-lg font-black text-white shadow-lg shadow-[#1d9bf0]/30">O</span>
            <span className="text-xl font-black tracking-tight text-white">OrbitX</span>
          </div>

          <div className="mt-6 flex items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#1d9bf0]/30 bg-[#1d9bf0]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#6bc9ff]">
              <Sparkles className="h-3 w-3" /> Private beta
            </span>
          </div>

          <h1 className="mt-5 text-center text-2xl font-black leading-tight text-white sm:text-[26px]">
            We're in beta — actively rebuilding everything
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-center text-[13.5px] leading-relaxed text-white/45">
            OrbitX is being rebuilt from the ground up. To try the beta before everyone
            else, enter the special access code we gave you.
          </p>

          <form onSubmit={submit} className="mt-7 space-y-3">
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" />
              <input
                ref={inputRef}
                type="password"
                value={code}
                onChange={(e) => { setCode(e.target.value); setError(false); }}
                placeholder="Enter access code"
                autoComplete="off"
                className={`w-full rounded-2xl border bg-white/[0.04] py-3.5 pl-11 pr-4 text-center text-[15px] font-bold tracking-[0.35em] text-white placeholder:font-medium placeholder:tracking-normal placeholder:text-white/25 outline-none transition ${
                  error ? "border-rose-500/60 bg-rose-500/[0.06]" : "border-white/10 focus:border-[#1d9bf0]/60 focus:bg-white/[0.06]"
                }`}
              />
            </div>
            {error && (
              <p className="text-center text-[12px] font-bold text-rose-400">
                That code isn't right. Double-check it and try again.
              </p>
            )}
            <button
              type="submit"
              disabled={!code.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#1d9bf0] to-[#9945FF] py-3.5 text-[14px] font-black uppercase tracking-widest text-white shadow-lg shadow-[#1d9bf0]/25 transition hover:brightness-110 disabled:opacity-40 disabled:hover:brightness-100"
            >
              <Rocket className="h-4 w-4" /> Enter the beta
            </button>
          </form>

          <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-white/25">
            <Lock className="h-3 w-3" /> Access is limited while we rebuild. Codes are shared with our community.
          </div>
        </div>
      </div>
    </div>
  );
}

export default BetaGate;
