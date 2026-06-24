import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useWallet } from "../lib/wallet";
import { short } from "../lib/api";
import { Bell, Wallet2, Loader2, Trash2, Plus, CheckCircle2, AlertTriangle, ExternalLink } from "lucide-react";

interface Alert {
  id: string; mint: string; symbol?: string; type: string; value: number;
  channel: string; target: string; refPrice?: number | null; enabled: boolean; createdAt: number;
}
const TYPE_LABEL: Record<string, string> = {
  price_above: "Price rises above", price_below: "Price drops below",
  pct_up: "Pumps % from now", pct_down: "Dumps % from now",
};

export default function Alerts() {
  const { address, connect, connecting } = useWallet();
  const [params] = useSearchParams();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);
  const [mint, setMint] = useState(params.get("mint") || "");
  const [type, setType] = useState("price_above");
  const [value, setValue] = useState("");
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const load = async () => {
    if (!address) return;
    setLoading(true);
    try { const r = await fetch(`/api/ogdex/alerts?wallet=${address}`); const d = await r.json(); setAlerts(d.alerts || []); } catch {}
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [address]);

  const add = async () => {
    setErr(""); setOk("");
    if (!address) { await connect(); return; }
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint.trim())) { setErr("Enter a valid token mint"); return; }
    if (!value || Number(value) <= 0) { setErr("Enter a target value"); return; }
    if (!/^https?:\/\//i.test(target.trim())) { setErr("Enter a webhook URL (Discord/Slack/custom)"); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/ogdex/alerts", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: address, alert: { mint: mint.trim(), type, value: Number(value), target: target.trim() } }) });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "Could not create alert");
      setAlerts(d.alerts); setOk("Alert created"); setValue("");
    } catch (e: any) { setErr(e?.message || "Failed"); } finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    if (!address) return;
    const r = await fetch("/api/ogdex/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ wallet: address, remove: id }) });
    const d = await r.json(); if (d.ok) setAlerts(d.alerts);
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl border border-accent/20 bg-accent/10"><Bell className="h-7 w-7 text-accent" /></div>
        <h1 className="text-2xl font-black tracking-tight">Smart Alerts</h1>
        <p className="mt-2 text-sm text-muted">Get pinged when a token hits your price or % target. Delivered to any webhook (Discord, Slack, Telegram-bot, or your own endpoint). Tied to your wallet, synced across devices.</p>
      </div>

      <div className="card mb-4 flex items-center justify-between p-3">
        <div className="flex items-center gap-2 text-sm"><Wallet2 className="h-4 w-4 text-accent" />{address ? <span className="font-mono text-white">{short(address)}</span> : <span className="text-muted">Connect to manage alerts</span>}</div>
        {!address && <button onClick={connect} disabled={connecting} className="btn bg-accent text-black font-semibold">{connecting ? "Connecting…" : "Connect Phantom"}</button>}
      </div>

      {address && (
        <div className="card mb-4 p-4">
          <div className="mb-3 text-sm font-bold">New alert</div>
          <div className="space-y-2">
            <input value={mint} onChange={(e) => setMint(e.target.value)} placeholder="Token mint address" className="inp" />
            <div className="grid grid-cols-2 gap-2">
              <select value={type} onChange={(e) => setType(e.target.value)} className="inp">
                {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <input value={value} onChange={(e) => setValue(e.target.value.replace(/[^0-9.]/g, ""))} placeholder={type.startsWith("pct") ? "%" : "$ price"} className="inp" />
            </div>
            <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Webhook URL (https://discord.com/api/webhooks/… or your endpoint)" className="inp" />
            <button onClick={add} disabled={busy} className="btn w-full bg-accent text-black font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create alert
            </button>
          </div>
          {err && <div className="mt-2 flex items-center gap-1.5 text-xs text-down"><AlertTriangle className="h-3.5 w-3.5" /> {err}</div>}
          {ok && <div className="mt-2 flex items-center gap-1.5 text-xs text-up"><CheckCircle2 className="h-3.5 w-3.5" /> {ok}</div>}
          <p className="mt-2 text-[10px] text-muted/60">Tip: in Discord, Server Settings → Integrations → Webhooks → New Webhook → Copy URL. Checks run automatically.</p>
        </div>
      )}

      {address && (
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Your alerts {alerts.length > 0 && `(${alerts.length})`}</div>
          {loading ? <div className="grid place-items-center py-10 text-muted"><Loader2 className="h-5 w-5 animate-spin" /></div>
            : alerts.length === 0 ? <div className="card p-8 text-center text-sm text-muted">No alerts yet. Create one above.</div>
            : <div className="space-y-2">{alerts.map((a) => (
                <div key={a.id} className="card flex items-center gap-3 p-3">
                  <Bell className={`h-4 w-4 shrink-0 ${a.enabled ? "text-accent" : "text-muted"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-white">{a.symbol || short(a.mint)} <span className="text-muted font-normal">— {TYPE_LABEL[a.type]} {a.value}{a.type.startsWith("pct") ? "%" : ""}</span></div>
                    <div className="truncate text-[11px] text-muted">{a.enabled ? "active" : "fired/disabled"} · → {a.target.replace(/^https?:\/\//, "").slice(0, 32)}…</div>
                  </div>
                  <button onClick={() => remove(a.id)} className="text-muted hover:text-down"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}</div>}
        </div>
      )}
    </div>
  );
}
