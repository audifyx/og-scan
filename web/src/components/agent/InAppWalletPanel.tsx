import { useCallback, useEffect, useState } from "react";
import { KeyRound, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Row = { publicKey?: string; perTradeCapUsd?: number; lifetimeCapUsd?: number };

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
    try { setRow(await api("POST", { action: "app" })); } catch (e: any) { setErr(String(e.message || e)); }
    finally { setBusy(false); }
  };
  const exp = async () => {
    if (!window.confirm("Show private key? Backend still signs until you revoke.")) return;
    setBusy(true);
    try {
      const j = await api("POST", { action: "export" });
      setSecret(j.secretKeyBase58 || "");
    } catch (e: any) { setErr(String(e.message || e)); }
    finally { setBusy(false); }
  };
  const revoke = async () => {
    if (!window.confirm("Stop backend signing?")) return;
    setBusy(true);
    try { await api("POST", { action: "revoke" }); setRow(null); setSecret(""); } catch (e: any) { setErr(String(e.message || e)); }
    finally { setBusy(false); }
  };

  const pk = row?.publicKey;

  return (
    <section className="supercomputer-card">
      <p className="supercomputer-eyebrow">YOUR WALLET</p>
      <h2>This is your wallet. Not OrbitX. Not the owner desk.</h2>
      <p>Created for your account only. New keypair when you tap Create. Export anytime. Fund YOUR pubkey with SOL or USDC. Grok signs YOUR trades in the background — not a shared OrbitX wallet.</p>
      {err ? <p><strong>{err}</strong></p> : null}
      {pk ? (
        <>
          <p><strong>{pk}</strong></p>
          <p>Cap ${row?.perTradeCapUsd ?? 250}/trade</p>
          <div className="supercomputer-welcome__actions">
            <button type="button" className="supercomputer-button supercomputer-button--primary" onClick={exp} disabled={busy}><KeyRound size={16} /> Export</button>
            <button type="button" className="supercomputer-button supercomputer-button--quiet" onClick={revoke} disabled={busy}><Trash2 size={16} /> Revoke</button>
          </div>
          {secret ? <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{secret}</pre> : null}
        </>
      ) : (
        <button type="button" className="supercomputer-button supercomputer-button--primary" onClick={create} disabled={busy}>
          <Plus size={16} /> Create wallet
        </button>
      )}
      <p>If create fails, the site encryption key is missing — that key is not a wallet.</p>
    </section>
  );
}

export default InAppWalletPanel;
