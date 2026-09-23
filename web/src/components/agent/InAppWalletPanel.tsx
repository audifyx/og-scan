import { useCallback, useEffect, useState } from "react";
import { KeyRound, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

type Row = { publicKey?: string };

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
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}

export function InAppWalletPanel() {
  const { user } = useAuth();
  const [row, setRow] = useState<Row | null>(null);
  const [err, setErr] = useState("");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) { setRow(null); return; }
    setErr("");
    try { setRow(await api("GET")); } catch (e: any) { setErr(String(e.message || e)); }
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

  const pk = row?.publicKey;

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
            <button type="button" className="supercomputer-button supercomputer-button--primary" onClick={exp} disabled={busy}><KeyRound size={16} /> Export key</button>
            <button type="button" className="supercomputer-button supercomputer-button--quiet" onClick={revoke} disabled={busy}><Trash2 size={16} /> Delete desk</button>
          </div>
          {secret ? <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{secret}</pre> : null}
        </>
      ) : (
        <button type="button" className="supercomputer-button supercomputer-button--primary" onClick={create} disabled={busy}>
          <Plus size={16} /> Create my desk wallet
        </button>
      )}
    </section>
  );
}

export default InAppWalletPanel;
