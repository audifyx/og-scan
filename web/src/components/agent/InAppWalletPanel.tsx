import { useCallback, useEffect, useState } from "react";
import { KeyRound, Plus, Trash2, WalletCards } from "lucide-react";
import { supabase } from "@/lib/supabase";

type WalletState = {
  publicKey?: string;
  perTradeCapUsd?: number;
  lifetimeCapUsd?: number;
  expiresAt?: string;
};

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
  const [row, setRow] = useState<WalletState | null>(null);
  const [err, setErr] = useState("");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setErr("");
    try {
      const j = await api("GET");
      setRow(j);
    } catch (e: any) {
      setErr(String(e.message || e));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    setBusy(true); setErr("");
    try {
      const j = await api("POST", { action: "app" });
      setRow(j);
    } catch (e: any) {
      setErr(String(e.message || e));
    } finally { setBusy(false); }
  };

  const exp = async () => {
    if (!window.confirm("Show the private key? Anyone with it can empty this wallet.")) return;
    setBusy(true); setErr("");
    try {
      const j = await api("POST", { action: "export" });
      setSecret(j.secretKeyBase58 || "");
    } catch (e: any) {
      setErr(String(e.message || e));
    } finally { setBusy(false); }
  };

  const revoke = async () => {
    if (!window.confirm("Revoke OrbitX access to this in-app wallet?")) return;
    setBusy(true); setErr("");
    try {
      await api("POST", { action: "revoke" });
      setRow(null); setSecret("");
    } catch (e: any) {
      setErr(String(e.message || e));
    } finally { setBusy(false); }
  };

  const pk = row?.publicKey || row && (row as any).public_key;

  return (
    <section className="supercomputer-card">
      <p className="supercomputer-eyebrow">IN-APP WALLET</p>
      <h2>Trade from chat. You keep the key.</h2>
      <p>MCP can buy and sell from this wallet with no popup. Export the private key anytime.</p>
      {err ? <p className="supercomputer-channel-notice"><strong>{err}</strong></p> : null}
      {pk ? (
        <>
          <p><strong>{pk}</strong></p>
          <p>Cap ${row?.perTradeCapUsd ?? 250}/trade · lifetime ${row?.lifetimeCapUsd ?? 5000}</p>
          <p>Fund this address with SOL, then tell Grok: buy $1 of [CA].</p>
          <div className="supercomputer-welcome__actions">
            <button type="button" className="supercomputer-button supercomputer-button--primary" onClick={exp} disabled={busy}><KeyRound size={16} /> Export key</button>
            <button type="button" className="supercomputer-button supercomputer-button--quiet" onClick={revoke} disabled={busy}><Trash2 size={16} /> Revoke</button>
          </div>
          {secret ? (
            <pre style={{ overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{secret}</pre>
          ) : null}
        </>
      ) : (
        <button type="button" className="supercomputer-button supercomputer-button--primary" onClick={create} disabled={busy}>
          <Plus size={16} /> Create in-app wallet
        </button>
      )}
      <p>Needs <code>DELEGATED_WALLET_ENC_KEY</code> on Vercel (32-byte base64) if create fails.</p>
    </section>
  );
}

export default InAppWalletPanel;
