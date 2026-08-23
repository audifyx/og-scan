import { useEffect, useState, type ReactNode } from "react";
import { Lock, Loader2 } from "lucide-react";
import {
  DESK_UNLOCK_EVENT,
  clearDeskUnlock,
  hasDeskSession,
  persistDeskUnlock,
  requestDeskUnlock,
} from "../../../shared/desk-unlock-client.js";

/** Soft UI gate for ORBITX_DEX owner desk — PIN is checked on Vercel, not here. */
export default function OwnerDeskGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [ok, setOk] = useState(false);
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setOk(hasDeskSession());
    setReady(true);
    const sync = () => setOk(hasDeskSession());
    window.addEventListener(DESK_UNLOCK_EVENT, sync);
    return () => window.removeEventListener(DESK_UNLOCK_EVENT, sync);
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
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr("");
          try {
            const token = await requestDeskUnlock(code.trim());
            persistDeskUnlock(token);
            setOk(true);
          } catch (error) {
            clearDeskUnlock();
            setErr(error instanceof Error ? error.message : "Incorrect code");
            setCode("");
          } finally {
            setBusy(false);
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
        <button className="btn bg-accent text-black font-semibold w-full mt-3" disabled={busy}>
          {busy ? "Checking…" : "Unlock"}
        </button>
      </form>
    </div>
  );
}
