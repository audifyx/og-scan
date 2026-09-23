import { useCallback, useEffect, useState } from "react";
import { KeyRound, Plus, Trash2, Download } from "lucide-react";
import {
  createLocalTradingWallet,
  exportLocalTradingWalletSecret,
  importLocalTradingWallet,
  listLocalTradingWallets,
  removeLocalTradingWallet,
  setDefaultLocalWallet,
  getDefaultLocalWalletId,
  type LocalTradingWalletMeta,
} from "@/lib/tradeWallets/localTradingWallets";

export function InAppWalletPanel() {
  const [wallets, setWallets] = useState<LocalTradingWalletMeta[]>([]);
  const [defaultId, setDefaultId] = useState<string | null>(null);
  const [secret, setSecret] = useState("");
  const [importKey, setImportKey] = useState("");
  const [err, setErr] = useState("");

  const reload = useCallback(() => {
    setWallets(listLocalTradingWallets());
    setDefaultId(getDefaultLocalWalletId());
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const create = async () => {
    setErr("");
    try {
      const w = await createLocalTradingWallet("In-app wallet");
      const raw = await exportLocalTradingWalletSecret(w.id);
      setSecret(raw);
      reload();
    } catch (e: any) {
      setErr(String(e.message || e));
    }
  };

  const exp = async (id: string) => {
    if (!window.confirm("Show the private key stored in THIS browser? OrbitX servers do not have it.")) return;
    setErr("");
    try {
      setSecret(await exportLocalTradingWalletSecret(id));
    } catch (e: any) {
      setErr(String(e.message || e));
    }
  };

  const imp = async () => {
    setErr("");
    try {
      await importLocalTradingWallet(importKey.trim(), "Imported MCP wallet");
      setImportKey("");
      reload();
    } catch (e: any) {
      setErr(String(e.message || e));
    }
  };

  return (
    <section className="supercomputer-card">
      <p className="supercomputer-eyebrow">LOCAL WALLET</p>
      <h2>Your key. This device. Not our servers.</h2>
      <p>
        Same model as Launchpad. The private key is encrypted in this browser only.
        OrbitX cannot see it, export it from the backend, or sign for you from the cloud.
      </p>
      {err ? <p><strong>{err}</strong></p> : null}

      <div className="supercomputer-welcome__actions">
        <button type="button" className="supercomputer-button supercomputer-button--primary" onClick={create}>
          <Plus size={16} /> Create wallet
        </button>
      </div>

      <label>
        Import key from MCP chat
        <textarea value={importKey} onChange={(e) => setImportKey(e.target.value)} rows={3} style={{ width: "100%" }} />
      </label>
      <button type="button" className="supercomputer-button supercomputer-button--quiet" onClick={imp} disabled={!importKey.trim()}>
        <Download size={16} /> Import
      </button>

      {wallets.map((w) => (
        <div key={w.id} className="supercomputer-channel-notice">
          <div>
            <strong>{w.label}</strong>
            <p>{w.publicKey}</p>
            {defaultId === w.id ? <small>Default</small> : (
              <button type="button" className="supercomputer-inline-link" onClick={() => { setDefaultLocalWallet(w.id); reload(); }}>Make default</button>
            )}
          </div>
          <button type="button" className="supercomputer-button supercomputer-button--quiet" onClick={() => exp(w.id)}><KeyRound size={15} /> Export</button>
          <button type="button" className="supercomputer-button supercomputer-button--quiet" onClick={() => { if (window.confirm("Delete local copy?")) { removeLocalTradingWallet(w.id); setSecret(""); reload(); } }}><Trash2 size={15} /></button>
        </div>
      ))}

      {secret ? <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{secret}</pre> : null}
      <p>If Grok created the wallet in chat, paste that secret here once. After that it only lives on this device.</p>
    </section>
  );
}

export default InAppWalletPanel;
