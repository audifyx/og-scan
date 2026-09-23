import { useCallback, useEffect, useState } from "react";
import { KeyRound, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Row = { publicKey?: string };

async function token() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || "";
}

async function api(method: "GET" | "POST", body?: Record<string, unknown>) {
  const t = await token();
  if (!t) throw new Error("Sign in first");
  const r = await fetch("/api/orbitx-delegated-wallet", {
    method,
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: method === "POST" ? JSON.stringify(body || {}) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}

export function InAppWalletPanel() {
  const [row, setRow] = useState<Row | null>(null);
  const [err, setErr] = useState("");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setErr("");
    try { setRow(await api("GET")); } catch (e: any) { setErr(String(e.message || e)); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    setBusy(true); setErr("");
    try { setRow(await api("POST", {})); } catch (e: any) { setErr(String(e.message || e)); }
    finally { setBusy(false); }
  };
  const exp = async () => {
    if (!window.confirm("Show YOUR private key? This is your desk, not OrbitX treasury.")) return;
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
      <h2>Your wallet. Generated for this account.</h2>
      <p>
        Same model as orbitxtrade.world: each user gets their own Solana desk.
        Grok signs that desk in the background. Export the key anytime.
      </p>
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
