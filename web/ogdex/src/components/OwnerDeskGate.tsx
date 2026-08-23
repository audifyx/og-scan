import { useEffect, useState, type ReactNode } from "react";
import { Lock, Loader2 } from "lucide-react";

/** Must match web/src/lib/ownerDesk.ts (same-origin sessionStorage). */
const OWNER_DESK_CODE = "0129";
const OWNER_DESK_UNLOCK_KEY = "ox_desk_sess_v1";
const OWNER_DESK_UNLOCK_EVENT = "ox-desk-unlock";

function isUnlocked(): boolean {
  try {
    return sessionStorage.getItem(OWNER_DESK_UNLOCK_KEY) === "true";
  } catch {
    return false;
  }
}

function setUnlocked(v: boolean) {
  try {
    if (v) sessionStorage.setItem(OWNER_DESK_UNLOCK_KEY, "true");
    else sessionStorage.removeItem(OWNER_DESK_UNLOCK_KEY);
    sessionStorage.removeItem("orbitx_admin_unlocked");
    window.dispatchEvent(new Event(OWNER_DESK_UNLOCK_EVENT));
  } catch {
    /* ignore */
  }
}

/** Soft UI gate for ORBITX_DEX owner desk — not API auth. */
export default function OwnerDeskGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [ok, setOk] = useState(false);
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    setOk(isUnlocked());
    setReady(true);
    const sync = () => setOk(isUnlocked());
    window.addEventListener(OWNER_DESK_UNLOCK_EVENT, sync);
    return () => window.removeEventListener(OWNER_DESK_UNLOCK_EVENT, sync);
  }, []);

  if (!ready) {
    return (
      <div className="grid place-items-center py-24 text-muted">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  if (ok) return <>{children}</>;

  return (
    <div className="max-w-sm mx-auto card p-6 mt-16">
      <div className="flex items-center gap-2 font-semibold mb-2">
        <Lock className="w-4 h-4 text-muted" /> Continue
      </div>
      <p className="text-xs text-muted mb-4">Enter access code.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim() === OWNER_DESK_CODE) {
            setUnlocked(true);
            setOk(true);
            setErr("");
          } else {
            setErr("Incorrect code");
            setCode("");
          }
        }}
      >
        <input
          type="password"
          inputMode="numeric"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Code"
          autoComplete="off"
          autoFocus
          className="w-full bg-panel2 border border-line rounded-lg px-3 py-2.5 text-sm outline-none focus:border-accent/60"
        />
        {err && <div className="text-down text-xs mt-2">{err}</div>}
        <button className="btn bg-accent text-black font-semibold w-full mt-3">Unlock</button>
      </form>
    </div>
  );
}
