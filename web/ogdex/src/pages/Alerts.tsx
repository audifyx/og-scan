import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useWallet } from "../lib/wallet";
import { short } from "../lib/api";
import { Bell, Wallet2, Loader2, Trash2, Plus, CheckCircle2, AlertTriangle, ExternalLink, Zap, TrendingDown, Users, ArrowRightLeft } from "lucide-react";

interface Alert {
  id: string; mint: string; symbol?: string; type: string; value: number;
  channel: string; target: string; refPrice?: number | null; enabled: boolean; createdAt: number; watch?: string; label?: string;
}

const TYPE_GROUPS: { group: string; icon: any; types: [string, string][] }[] = [
  {
    group: "Price Alerts",
    icon: Zap,
    types: [
      ["price_above", "Price rises above $"],
      ["price_below", "Price drops below $"],
      ["pct_up", "Pumps % from now"],
      ["pct_down", "Dumps % from now"],
    ],
  },
  {
    group: "Whale Alerts",
    icon: Users,
    types: [
      ["whale_buy", "Whale buy detected (≥ $ threshold)"],
      ["whale_sell", "Whale sell detected (≥ $ threshold)"],
    ],
  },
  {
    group: "On-chain Events",
    icon: ArrowRightLeft,
    types: [
      ["dev_sell", "Dev wallet sells any amount"],
      ["migration", "Token migrates to new contract"],
      ["wallet_trade", "Wallet makes any trade"],
    ],
  },
];

const TYPE_LABEL: Record<string, string> = Object.fromEntries(
  TYPE_GROUPS.flatMap((g) => g.types)
);

const needsValue = (t: string) => !["dev_sell", "migration", "wallet_trade"].includes(t);
const needsMint = (t: string) => t !== "wallet_trade";
const needsWatch = (t: string) => t === "wallet_trade";

export default function Alerts() {
  const { address, connect, connecting } = useWallet();
  const [params] = useSearchParams();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);
  const [mint, setMint] = useState(params.get("mint") || "");
  const [type, setType] = useState(params.get("type") || "price_above");
  const [value, setValue] = useState(params.get("value") || "");
  const [watch, setWatch] = useState("");
  const [channel, setChannel] = useState<"telegram" | "webhook">("telegram");
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
    if (needsWatch(type)) {
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(watch.trim())) { setErr("Enter a valid wallet address to watch"); return; }
    } else if (needsMint(type)) {
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint.trim())) { setErr("Enter a valid token mint"); return; }
      if (needsValue(type) && (!value || Number(value) <= 0)) { setErr("Enter a target value"); return; }
    }
    if (channel === "telegram") {
      if (!/^(-?\d{4,}|@[A-Za-z0-9_]{4,})$/.test(target.trim())) { setErr("Enter your Telegram chat ID (numeric) or @channel"); return; }
    } else if (!/^https?:\/\//i.test(target.trim())) { setErr("Enter a webhook URL (Discord/Slack/custom)"); return; }
    setBusy(true);
    try {
      const alert: any = { type, channel, target: target.trim() };
      if (needsWatch(type)) { alert.watch = watch.trim(); alert.label = watch.trim().slice(0, 6); }
      else {
        alert.mint = mint.trim();
        if (needsValue(type)) alert.value = Number(value);
      }
      const r = await fetch("/api/ogdex/alerts", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: address, alert }) });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "Could not create alert");
      setAlerts(d.alerts); setOk("Alert created ✓"); setValue(""); setWatch("");
    } catch (e: any) { setErr(e?.message || "Failed"); } finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    if (!address) return;
    const r = await fetch("/api/ogdex/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ wallet: address, remove: id }) });
    const d = await r.json(); if (d.ok) setAlerts(d.alerts);
  };

  const alertIcon = (t: string) => {
    if (t.includes("whale")) return <Users className="w-3.5 h-3.5" />;
    if (t === "dev_sell") return <TrendingDown className="w-3.5 h-3.5" />;
    if (t === "migration") return <ArrowRightLeft className="w-3.5 h-3.5" />;
    return <Bell className="w-3.5 h-3.5" />;
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl border border-accent/20 bg-accent/10">
          <Bell className="h-7 w-7 text-accent" />
        </div>
        <h1 className="text-2xl font-black tracking-tight">Smart Alerts</h1>
        <p className="mt-2 text-sm text-muted">
          Price moves, whale trades, dev sells, migrations — get pinged the moment it happens.
          Delivered to Telegram or any webhook. Tied to your wallet, synced across devices.
        </p>
      </div>

      <div className="card mb-4 flex items-center justify-between p-3">
        <div className="flex items-center gap-2 text-sm">
          <Wallet2 className="h-4 w-4 text-accent" />
          {address ? <span className="font-mono text-white">{short(address)}</span> : <span className="text-muted">Connect to manage alerts</span>}
        </div>
        {!address && (
          <button onClick={connect} disabled={connecting} className="btn bg-accent text-black font-semibold">
            {connecting ? "Connecting…" : "Connect Phantom"}
          </button>
        )}
      </div>

      {address && (
        <div className="card mb-4 p-4">
          <div className="mb-3 text-sm font-bold">New Alert</div>
          <div className="space-y-2">
            {/* Alert type grouped selector */}
            <div className="space-y-1.5">
              {TYPE_GROUPS.map((g) => (
                <div key={g.group}>
                  <div className="text-[10px] uppercase tracking-widest text-muted/60 mb-1 flex items-center gap-1">
                    <g.icon className="w-3 h-3" /> {g.group}
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {g.types.map(([k, v]) => (
                      <button
                        key={k}
                        onClick={() => setType(k)}
                        className={`text-left px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${
                          type === k
                            ? "bg-accent/15 text-accent border-accent/30"
                            : "bg-panel2 text-muted border-line hover:text-white hover:border-line/60"
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Fields */}
            {needsWatch(type) ? (
              <input value={watch} onChange={(e) => setWatch(e.target.value)} placeholder="Wallet address to watch" className="inp" />
            ) : (
              <div className={needsValue(type) ? "grid grid-cols-2 gap-2" : ""}>
                <input value={mint} onChange={(e) => setMint(e.target.value)} placeholder="Token mint address" className="inp" />
                {needsValue(type) && (
                  <input value={value} onChange={(e) => setValue(e.target.value.replace(/[^0-9.]/g, ""))}
                    placeholder={type.startsWith("pct") ? "%" : "$ value"} className="inp" />
                )}
              </div>
            )}

            {/* Channel */}
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-panel2/60 p-1">
              <button onClick={() => setChannel("telegram")} className={`rounded-lg py-1.5 text-xs font-bold transition ${channel === "telegram" ? "bg-accent/15 text-accent" : "text-muted hover:text-white"}`}>Telegram</button>
              <button onClick={() => setChannel("webhook")} className={`rounded-lg py-1.5 text-xs font-bold transition ${channel === "webhook" ? "bg-accent/15 text-accent" : "text-muted hover:text-white"}`}>Webhook</button>
            </div>
            <input value={target} onChange={(e) => setTarget(e.target.value)}
              placeholder={channel === "telegram" ? "Telegram chat ID (e.g. 123456789)" : "Webhook URL (Discord/Slack/custom)"} className="inp" />
            <button onClick={add} disabled={busy} className="btn w-full bg-accent text-black font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create Alert
            </button>
          </div>
          {err && <div className="mt-2 flex items-center gap-1.5 text-xs text-down"><AlertTriangle className="h-3.5 w-3.5" /> {err}</div>}
          {ok && <div className="mt-2 flex items-center gap-1.5 text-xs text-up"><CheckCircle2 className="h-3.5 w-3.5" /> {ok}</div>}
          <p className="mt-2 text-[10px] text-muted/60">
            {channel === "telegram"
              ? "Telegram: open @Theogsupportbot → Start so it can DM you, then message @userinfobot to get your numeric chat ID."
              : "Discord: Server Settings → Integrations → Webhooks → New Webhook → Copy URL."} Alerts are checked every minute.
          </p>
        </div>
      )}

      {address && (
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Your alerts {alerts.length > 0 && `(${alerts.length})`}
          </div>
          {loading ? (
            <div className="grid place-items-center py-10 text-muted"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : alerts.length === 0 ? (
            <div className="card p-8 text-center text-sm text-muted">No alerts yet. Create one above.</div>
          ) : (
            <div className="space-y-2">
              {alerts.map((a) => (
                <div key={a.id} className="card flex items-center gap-3 p-3">
                  <div className={`shrink-0 p-1.5 rounded-lg ${a.enabled ? "bg-accent/15 text-accent" : "bg-panel2 text-muted"}`}>
                    {alertIcon(a.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-white">
                      {a.type === "wallet_trade"
                        ? <>{a.label || short(a.watch || "")} <span className="text-muted font-normal">— notify on any trade</span></>
                        : <>{a.symbol || short(a.mint)} <span className="text-muted font-normal">— {TYPE_LABEL[a.type]} {needsValue(a.type) ? a.value + (a.type.startsWith("pct") ? "%" : "") : ""}</span></>
                      }
                    </div>
                    <div className="truncate text-[11px] text-muted">
                      {a.enabled ? "active" : "fired"} · → {a.target.replace(/^https?:\/\//, "").slice(0, 32)}…
                    </div>
                  </div>
                  <button onClick={() => remove(a.id)} className="text-muted hover:text-down p-1.5">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
