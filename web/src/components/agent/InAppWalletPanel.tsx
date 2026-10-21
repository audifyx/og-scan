import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { KeyRound, Lock, LockOpen, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

type Row = { publicKey?: string; pinSet?: boolean; unlocked?: boolean; unlockUntil?: string | null };

async function token() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || "";
}

async function api(method: "GET" | "POST", body?: Record<string, unknown>) {
  const t = await token();
  if (!t) throw new Error("Sign in at /auth first");
  const r = await fetch("/api/orbitx/desk-wallet", {
    method,
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: method === "POST" ? JSON.stringify(body || {}) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.message || j.error || `HTTP ${r.status}`);
  return j;
}

const pinInputStyle: CSSProperties = {
  background: "rgba(0,0,0,0.5)",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 10,
  padding: "8px 12px",
  color: "#fff",
  width: "100%",
  marginTop: 6,
};

export function InAppWalletPanel() {
  const { user } = useAuth();
  const [row, setRow] = useState<Row | null>(null);
  const [err, setErr] = useState("");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [newPin, setNewPin] = useState("");
  const [pinMsg, setPinMsg] = useState("");

  const load = useCallback(async () => {
    if (!user) { setRow(null); return; }
    setErr("");
    try {
      const result = await api("GET");
      // Auto-create if no wallet exists
      if (!result?.publicKey) {
        const created = await api("POST", {});
        setRow(created);
      } else {
        setRow(result);
      }
    } catch (e: any) { setErr(String(e.message || e)); }
  }, [user]);
  useEffect(() => { void load(); }, [load]);

  if (!user) {
    return (
      <section className="supercomputer-card">
        <p className="supercomputer-eyebrow">YOUR DESK</p>
        <h2>Sign in to OrbitX first.</h2>
        <p>Same account as /auth — X or email. Do not connect a wallet to log in. The desk wallet is created after you are signed in.</p>
        <a className="supercomputer-button supercomputer-button--primary" href="/auth">Sign in</a>
      </section>
    );
  }

  const create = async () => {
    setBusy(true); setErr("");
    try { setRow(await api("POST", {})); } catch (e: any) { setErr(String(e.message || e)); }
    finally { setBusy(false); }
  };
  const exp = async () => {
    if (!window.confirm("Show YOUR private key?")) return;
    setBusy(true);
    try {
      const j = await api("POST", { action: "export" });
      setSecret(j.secretKeyBase58 || "");
    } catch (e: any) { setErr(String(e.message || e)); }
    finally { setBusy(false); }
  };
  const revoke = async () => {
    if (!window.confirm("Delete this desk wallet for your account?")) return;
    setBusy(true);
    try { await api("POST", { action: "revoke" }); setRow(null); setSecret(""); } catch (e: any) { setErr(String(e.message || e)); }
    finally { setBusy(false); }
  };

  const pinAction = async (body: Record<string, unknown>, success: string) => {
    setBusy(true); setErr(""); setPinMsg("");
    try {
      await api("POST", body);
      setPin(""); setPinConfirm(""); setNewPin("");
      setPinMsg(success);
      await load();
    } catch (e: any) { setErr(String(e.message || e)); }
    finally { setBusy(false); }
  };

  const doSetPin = () => {
    if (pin !== pinConfirm) { setErr("PINs don't match."); return; }
    if (!window.confirm("Set this PIN? From now on ONLY this PIN can open your wallet — OrbitX servers can't. If you forget it, the wallet can never be opened again. Export your key first if you haven't.")) return;
    void pinAction({ action: "set_pin", pin }, "PIN set. Your wallet is now locked — unlock to trade.");
  };
  const unlock = () => void pinAction({ action: "unlock", pin }, "Unlocked for 6 hours.");
  const lockNow = () => void pinAction({ action: "lock" }, "Wallet locked.");
  const changePin = () => {
    if (!newPin) { setErr("Enter a new PIN."); return; }
    void pinAction({ action: "change_pin", currentPin: pin, newPin }, "PIN changed. Wallet locked — unlock with the new PIN.");
  };
  const removePin = () => {
    if (!window.confirm("Remove the PIN? The wallet goes back to server-sealed mode (OrbitX can sign without your PIN).")) return;
    void pinAction({ action: "remove_pin", pin }, "PIN removed.");
  };

  const pk = row?.publicKey;
  const pinSet = !!row?.pinSet;
  const unlocked = row?.unlocked !== false;

  return (
    <section className="supercomputer-card">
      <p className="supercomputer-eyebrow">YOUR DESK</p>
      <h2>Your wallet. Tied to this OrbitX login.</h2>
      <p>Logged in as {user.email || user.id}. Create generates a Solana desk for this account. No Phantom login.</p>
      {err ? <p><strong>{err}</strong></p> : null}
      {pk ? (
        <>
          <p><strong>{pk}</strong></p>
          <div className="supercomputer-welcome__actions">
            <button type="button" className="supercomputer-button supercomputer-button--primary" onClick={exp} disabled={busy || (pinSet && !unlocked)}><KeyRound size={16} /> Export key</button>
            <button type="button" className="supercomputer-button supercomputer-button--quiet" onClick={revoke} disabled={busy}><Trash2 size={16} /> Delete desk</button>
          </div>
          {pinSet && !unlocked ? <p><strong>Wallet is PIN-locked.</strong> Unlock below to export or trade.</p> : null}
          {secret ? <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{secret}</pre> : null}

          <div style={{ marginTop: 18, borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 14 }}>
            <p className="supercomputer-eyebrow"><ShieldCheck size={13} /> WALLET PIN</p>
            {pinMsg ? <p><strong>{pinMsg}</strong></p> : null}
            {!pinSet ? (
              <>
                <p>Set a PIN and your key gets re-encrypted under it — after that, <strong>only your PIN can open this wallet</strong>. OrbitX servers can't decrypt it or sign while it's locked. Unlocking starts a 6-hour trading window; then it locks again.</p>
                <p><strong>Warning:</strong> if you forget this PIN, the wallet can never be opened again. Export your key first and keep it somewhere safe.</p>
                <input type="password" autoComplete="new-password" placeholder="New PIN (6+ characters)" value={pin} onChange={(e) => setPin(e.target.value)} style={pinInputStyle} />
                <input type="password" autoComplete="new-password" placeholder="Confirm PIN" value={pinConfirm} onChange={(e) => setPinConfirm(e.target.value)} style={pinInputStyle} />
                <div className="supercomputer-welcome__actions" style={{ marginTop: 10 }}>
                  <button type="button" className="supercomputer-button supercomputer-button--primary" onClick={doSetPin} disabled={busy || pin.length < 6}><Lock size={16} /> Set PIN & lock wallet</button>
                </div>
              </>
            ) : !unlocked ? (
              <>
                <p><Lock size={14} /> This wallet is <strong>locked</strong>. Enter your PIN to start a 6-hour trading window.</p>
                <input type="password" autoComplete="current-password" placeholder="Wallet PIN" value={pin} onChange={(e) => setPin(e.target.value)} style={pinInputStyle} />
                <div className="supercomputer-welcome__actions" style={{ marginTop: 10 }}>
                  <button type="button" className="supercomputer-button supercomputer-button--primary" onClick={unlock} disabled={busy || !pin}><LockOpen size={16} /> Unlock for 6 hours</button>
                </div>
              </>
            ) : (
              <>
                <p><LockOpen size={14} /> <strong>Unlocked</strong>{row?.unlockUntil ? <> until {new Date(row.unlockUntil).toLocaleString()}</> : null}. MCP trades work without popups during the window.</p>
                <div className="supercomputer-welcome__actions">
                  <button type="button" className="supercomputer-button supercomputer-button--quiet" onClick={lockNow} disabled={busy}><Lock size={16} /> Lock now</button>
                </div>
                <input type="password" autoComplete="current-password" placeholder="Current PIN (for change / remove)" value={pin} onChange={(e) => setPin(e.target.value)} style={pinInputStyle} />
                <input type="password" autoComplete="new-password" placeholder="New PIN (change only)" value={newPin} onChange={(e) => setNewPin(e.target.value)} style={pinInputStyle} />
                <div className="supercomputer-welcome__actions" style={{ marginTop: 10 }}>
                  <button type="button" className="supercomputer-button supercomputer-button--quiet" onClick={changePin} disabled={busy || !pin || !newPin}>Change PIN</button>
                  <button type="button" className="supercomputer-button supercomputer-button--quiet" onClick={removePin} disabled={busy || !pin}>Remove PIN</button>
                </div>
              </>
            )}
          </div>
        </>
      ) : (
        <p className="text-white/50">Setting up your desk wallet…</p>
      )}
    </section>
  );
}

export default InAppWalletPanel;
