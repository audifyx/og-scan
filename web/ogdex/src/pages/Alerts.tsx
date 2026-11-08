/**
 * /ORBITX_DEX/alerts — Alerts command center (LIVE page).
 *
 * Watchlist-first redesign: every token your alerts watch gets one row with
 * its live price, 24h move, market cap, the triggers armed on it, and a
 * one-tap Trade button that opens the token's trade view (/token/:mint,
 * TradePanel lives there). The full alert list below manages each alert
 * (trigger progress, channel, fired state, delete), and the create form at
 * the bottom keeps the exact same create behavior as before.
 *
 * Data layer is unchanged — ogdex's own lib only:
 *  - fetchAlerts / mutateAlerts from ../lib/api (wallet-proof, /api/ogdex/alerts)
 *  - wallet from ../lib/wallet
 *  - live prices from getToken (../lib/api) — the same DexScreener-backed
 *    /api/ogdex/token endpoint TokenDetail polls.
 *
 * Honest limits (pre-existing, backend-side — this file does not fake them):
 *  - The alerts backend only accepts price_above / price_below / pct_up /
 *    pct_down / wallet_trade. Whale / dev-sell / migration types are offered
 *    in the picker (as before) but the backend rejects them with
 *    "invalid type" — the error is surfaced on create.
 *  - There is no toggle endpoint (POST only supports alert | remove), so
 *    alerts are armed until they fire or are deleted. A fired one-way alert
 *    is disabled by the runner and shows as "fired".
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useWallet } from "../lib/wallet";
import { short, fetchAlerts, mutateAlerts, getToken, fmtUsd, fmtPct, compact } from "../lib/api";
import TokenLogo from "../components/TokenLogo";
import {
  Bell, Wallet2, Loader2, Trash2, Plus, CheckCircle2, AlertTriangle,
  Zap, TrendingDown, TrendingUp, Users, ArrowRightLeft, ArrowUpRight,
  RefreshCw, Crosshair, Eye, Activity,
} from "lucide-react";

interface Alert {
  id: string; mint: string; symbol?: string; type: string; value: number;
  channel: string; target: string; refPrice?: number | null; enabled: boolean;
  createdAt: number; watch?: string; label?: string; lastFired?: number;
}

interface Quote {
  price: number | null; change24h: number | null; symbol: string | null;
  name: string | null; icon: string | null; mcap: number | null;
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
/** Types the alerts backend actually accepts today (see header note). */
const BACKEND_TYPES = new Set(["price_above", "price_below", "pct_up", "pct_down", "wallet_trade"]);

function numOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Price / symbol / 24h / mcap out of a /api/ogdex/token payload. */
function quoteFromToken(d: any): Quote {
  const t = d?.token ?? {};
  const meta = d?.meta ?? {};
  const raw = d?.raw ?? {};
  return {
    price: numOrNull(t.priceUsd ?? meta.priceUsd ?? raw.priceUsd),
    change24h: numOrNull(t.change24h ?? t.priceChange24h ?? meta.priceChange24h ?? raw.priceChange24h),
    symbol: (t.symbol ?? meta.symbol ?? null) as string | null,
    name: (t.name ?? meta.name ?? null) as string | null,
    icon: (t.icon ?? meta.icon ?? null) as string | null,
    mcap: numOrNull(t.mcap ?? t.fdv ?? meta.mcap ?? raw.mcap),
  };
}

function triggerLabel(a: Alert): string {
  const base = TYPE_LABEL[a.type] || a.type.replace(/_/g, " ");
  if (!needsValue(a.type)) return base;
  const unit = a.type.startsWith("pct") ? "%" : "";
  const arrow = a.type === "price_above" || a.type === "pct_up" ? "↑ " : a.type === "price_below" || a.type === "pct_down" ? "↓ " : "";
  return `${arrow}${unit ? "" : "$"}${a.value}${unit}`;
}

/** 0..1 progress of live price from refPrice toward target; null when unknowable. */
function triggerProgress(a: Alert, q: Quote | undefined): number | null {
  if (!q?.price || q.price <= 0) return null;
  if (a.type.startsWith("pct")) {
    const ref = Number(a.refPrice);
    if (!Number.isFinite(ref) || ref <= 0) return null;
    const moved = ((q.price - ref) / ref) * 100;
    const target = Math.abs(Number(a.value));
    if (!target) return null;
    return Math.max(0, Math.min(1, Math.abs(moved) / target));
  }
  const target = Number(a.value);
  const ref = Number(a.refPrice);
  if (!Number.isFinite(target) || target <= 0 || !Number.isFinite(ref) || ref <= 0 || target === ref) return null;
  return Math.max(0, Math.min(1, (q.price - ref) / (target - ref)));
}

function distanceLabel(a: Alert, q: Quote | undefined): string {
  if (!q?.price || q.price <= 0) return "—";
  if (a.type.startsWith("pct")) {
    const ref = Number(a.refPrice);
    if (!Number.isFinite(ref) || ref <= 0) return "—";
    const moved = Math.abs(((q.price - ref) / ref) * 100);
    const target = Math.abs(Number(a.value));
    if (!target) return "—";
    return `${Math.max(0, target - moved).toFixed(1)}% move left`;
  }
  const target = Number(a.value);
  if (!Number.isFinite(target) || target <= 0) return "—";
  const d = Math.abs(((target - q.price) / q.price) * 100);
  return `${d.toFixed(1)}% away`;
}

function firedAt(ts?: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  const now = Date.now();
  const mins = Math.max(0, Math.round((now - ts) / 60000));
  if (mins < 60) return `fired ${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `fired ${hrs}h ago`;
  return `fired ${d.toLocaleDateString()}`;
}

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

  // ── Live quotes for every watched mint ──
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [quotesUpdatedAt, setQuotesUpdatedAt] = useState<number | null>(null);

  const load = async () => {
    if (!address) return;
    setLoading(true);
    try { const d = await fetchAlerts(address); setAlerts(d.alerts || []); } catch {}
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [address]);

  // ── Watchlist: one row per distinct watched mint ──
  const watchlist = useMemo(() => {
    const map = new Map<string, Alert[]>();
    for (const a of alerts) {
      if (!a.mint) continue;
      const cur = map.get(a.mint) ?? [];
      cur.push(a);
      map.set(a.mint, cur);
    }
    return [...map.entries()].map(([mint, list]) => ({ mint, alerts: list }));
  }, [alerts]);
  const walletWatches = useMemo(() => alerts.filter((a) => a.type === "wallet_trade"), [alerts]);
  const mintKey = useMemo(() => watchlist.map((w) => w.mint).join(","), [watchlist]);

  const loadQuotes = useCallback(async (mints: string[]) => {
    if (!mints.length) return;
    setQuotesLoading(true);
    const entries = await Promise.all(
      mints.slice(0, 12).map(async (m) => {
        try {
          const d = await getToken(m);
          return [m, quoteFromToken(d)] as const;
        } catch {
          return [m, { price: null, change24h: null, symbol: null, name: null, icon: null, mcap: null }] as const;
        }
      }),
    );
    setQuotes((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
    setQuotesUpdatedAt(Date.now());
    setQuotesLoading(false);
  }, []);

  useEffect(() => {
    const mints = mintKey ? mintKey.split(",") : [];
    if (!mints.length) return;
    void loadQuotes(mints);
    const t = setInterval(() => void loadQuotes(mints), 30_000);
    return () => clearInterval(t);
  }, [mintKey, loadQuotes]);

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
      const d = await mutateAlerts(address, { alert });
      if (!d.ok) throw new Error(d.error || "Could not create alert");
      setAlerts(d.alerts); setOk("Alert created"); setValue(""); setWatch("");
    } catch (e: any) { setErr(e?.message || "Failed"); } finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    if (!address) return;
    try {
      const d = await mutateAlerts(address, { remove: id });
      if (d.ok) setAlerts(d.alerts);
    } catch { /* keep the row; user can retry */ }
  };

  const alertIcon = (t: string) => {
    if (t.includes("whale")) return <Users className="w-3.5 h-3.5" />;
    if (t === "dev_sell") return <TrendingDown className="w-3.5 h-3.5" />;
    if (t === "migration") return <ArrowRightLeft className="w-3.5 h-3.5" />;
    return <Bell className="w-3.5 h-3.5" />;
  };

  const armed = alerts.filter((a) => a.enabled !== false).length;
  const fired = alerts.filter((a) => a.enabled === false || (a.lastFired || 0) > 0).length;

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 pb-24">
      {/* ── Hero ── */}
      <div className="dex-hero">
        <div className="dex-kicker">orbitx@dex:~$ alerts --watch --notify</div>
        <h1 className="dex-hero-title">
          <Bell className="h-8 w-8 shrink-0" style={{ color: "#e8b84a" }} /> Alerts
        </h1>
        <p className="dex-hero-sub">
          Your watchlist command center — live prices for every token you watch,
          the triggers armed on each one, and one-tap trade. Price moves, whale
          trades, dev sells, migrations — pinged the moment it happens, to
          Telegram or any webhook. Tied to your wallet, synced across devices.
        </p>
      </div>

      {/* ── Command-center stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <div className="dex-panel !p-3">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted">
            <Crosshair className="h-3 w-3 text-accent" /> Watchlist
          </div>
          <p className="mt-1 font-mono text-xl font-bold text-white">
            {watchlist.length}<span className="ml-1 text-[11px] font-normal text-muted"> tokens</span>
          </p>
          <p className="text-muted text-[10px]">{quotesLoading ? "refreshing prices…" : quotesUpdatedAt ? "live prices · 30s refresh" : "prices load with alerts"}</p>
        </div>
        <div className="dex-panel !p-3">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted">
            <Bell className="h-3 w-3 text-accent" /> Armed
          </div>
          <p className="mt-1 font-mono text-xl font-bold text-white">
            {armed}<span className="ml-1 text-[11px] font-normal text-muted"> / {alerts.length} alerts</span>
          </p>
          <p className="text-muted text-[10px]">checked every minute</p>
        </div>
        <div className="dex-panel !p-3">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted">
            <Zap className="h-3 w-3 text-accent" /> Fired
          </div>
          <p className="mt-1 font-mono text-xl font-bold text-white">{fired}</p>
          <p className="text-muted text-[10px]">one-way alerts disarm after firing</p>
        </div>
        <div className="dex-panel !p-3">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted">
            <Eye className="h-3 w-3 text-accent" /> Wallet watches
          </div>
          <p className="mt-1 font-mono text-xl font-bold text-white">{walletWatches.length}</p>
          <p className="text-muted text-[10px]">notify on any trade</p>
        </div>
      </div>

      {/* ── Wallet ── */}
      <div className="card mb-4 flex items-center justify-between p-3">
        <div className="flex items-center gap-2 text-sm">
          <Wallet2 className="h-4 w-4 text-accent" />
          {address ? <span className="font-mono text-white">{short(address)}</span> : <span className="text-muted">Connect to manage alerts</span>}
        </div>
        {!address && (
          <button onClick={() => void connect()} disabled={connecting} className="btn bg-accent text-black font-semibold">
            {connecting ? "Connecting…" : "Connect Phantom"}
          </button>
        )}
      </div>

      {address && (
        <>
          {/* ── Watchlist command center ── */}
          <div className="card mb-4 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Crosshair className="h-4 w-4 text-accent" />
              <h2 className="text-[15px] font-bold text-white">Watchlist</h2>
              <span className="text-muted text-[11px]">live price · trigger · trade</span>
              <button
                type="button"
                onClick={() => void loadQuotes(mintKey ? mintKey.split(",") : [])}
                className="ml-auto grid h-8 w-8 place-items-center rounded-full border border-line text-muted hover:text-white"
                aria-label="Refresh prices"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${quotesLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
            <p className="text-muted text-[11px] mb-3">
              Every token your alerts watch, with its live price and what fires.
              Tap Trade to open the token desk with that token loaded.
            </p>
            {loading ? (
              <div className="grid place-items-center py-10 text-muted"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : watchlist.length === 0 ? (
              <div className="rounded-xl border border-line bg-panel2/60 p-6 text-center text-sm text-muted">
                Nothing watched yet — create an alert below and it lands here with a live price.
              </div>
            ) : (
              <div className="space-y-2">
                {watchlist.map((w) => {
                  const q = quotes[w.mint];
                  const sym = q?.symbol || w.alerts[0]?.symbol || short(w.mint);
                  const up = (q?.change24h ?? 0) >= 0;
                  // Closest-to-firing price/pct trigger on this token.
                  let nearest: Alert | null = null;
                  let nearestProg: number | null = null;
                  for (const a of w.alerts) {
                    if (!needsValue(a.type)) continue;
                    const p = triggerProgress(a, q);
                    if (p == null) continue;
                    if (nearestProg == null || p > nearestProg) { nearestProg = p; nearest = a; }
                  }
                  return (
                    <div key={w.mint} className="rounded-xl border border-line bg-panel2/60 p-3">
                      <div className="flex items-center gap-3">
                        <TokenLogo src={q?.icon} sym={sym} size={36} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <Link to={`/token/${w.mint}`} className="text-white text-[13px] font-bold hover:text-accent truncate">
                              {sym}
                            </Link>
                            <span className="font-mono text-[13px] font-semibold text-white">
                              {q?.price != null ? fmtUsd(q.price) : quotesLoading ? "…" : "—"}
                            </span>
                            {q?.change24h != null && (
                              <span className={`font-mono text-[11px] flex items-center gap-0.5 ${up ? "text-up" : "text-down"}`}>
                                {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                {fmtPct(q.change24h)}
                              </span>
                            )}
                            {q?.mcap != null && (
                              <span className="font-mono text-[11px] text-muted">${compact(q.mcap)} mcap</span>
                            )}
                          </div>
                          <div className="text-muted text-[11px] truncate">
                            {q?.name || short(w.mint)}
                          </div>
                        </div>
                        <Link
                          to={`/token/${w.mint}`}
                          className="shrink-0 inline-flex items-center gap-1 rounded-full px-3.5 py-2 text-[12px] font-bold text-black hover:opacity-90"
                          style={{ background: "#e8b84a" }}
                        >
                          Trade <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                      {/* Triggers armed on this token */}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {w.alerts.map((a) => (
                          <span
                            key={a.id}
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold ${
                              a.enabled === false
                                ? "border-line bg-panel text-muted line-through"
                                : "border-accent/30 bg-accent/10 text-accent"
                            }`}
                            title={`${TYPE_LABEL[a.type] || a.type} → ${a.channel}: ${a.target}`}
                          >
                            {alertIcon(a.type)}
                            {triggerLabel(a)}
                            {a.enabled === false ? " · fired" : ""}
                          </span>
                        ))}
                      </div>
                      {/* Closest trigger progress */}
                      {nearest && nearestProg != null && (
                        <div className="mt-2 flex items-center gap-2">
                          <Activity className="h-3 w-3 shrink-0 text-accent" />
                          <div className="h-1 flex-1 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${Math.round(nearestProg * 100)}%`, background: "#e8b84a" }}
                            />
                          </div>
                          <span className="font-mono text-[10px] text-muted shrink-0">
                            {triggerLabel(nearest)} · {distanceLabel(nearest, q)}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Wallet watches ── */}
          {walletWatches.length > 0 && (
            <div className="card mb-4 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Eye className="h-4 w-4 text-accent" />
                <h2 className="text-[15px] font-bold text-white">Wallet watches</h2>
                <span className="text-muted text-[11px]">pinged on any trade</span>
              </div>
              <div className="space-y-2">
                {walletWatches.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 rounded-xl border border-line bg-panel2/60 p-3">
                    <div className={`shrink-0 p-1.5 rounded-lg ${a.enabled !== false ? "bg-accent/15 text-accent" : "bg-panel2 text-muted"}`}>
                      <Users className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link to={`/wallet/${a.watch}`} className="text-sm font-semibold text-white hover:text-accent font-mono">
                        {a.label || short(a.watch || "")}
                      </Link>
                      <span className="text-muted text-[11px]"> — notify on any trade</span>
                      <div className="truncate text-[11px] text-muted">
                        {a.enabled === false ? `${firedAt(a.lastFired)} · ` : "armed · "}
                        → {a.target.replace(/^https?:\/\//, "").slice(0, 32)}…
                      </div>
                    </div>
                    <button onClick={() => remove(a.id)} className="text-muted hover:text-[#ff6b6b] p-1.5" aria-label="Delete alert">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── All alerts ── */}
          <div className="card mb-4 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Bell className="h-4 w-4 text-accent" />
              <h2 className="text-[15px] font-bold text-white">Your alerts</h2>
              <span className="text-muted text-[11px] ml-auto">{armed} of {alerts.length} armed</span>
            </div>
            <p className="text-muted text-[11px] mb-3">
              Every trigger, its live price, and how close it is to firing. One-way
              alerts disarm after they fire — delete and re-create to re-arm.
            </p>
            {loading ? (
              <div className="grid place-items-center py-10 text-muted"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : alerts.length === 0 ? (
              <div className="rounded-xl border border-line bg-panel2/60 p-6 text-center text-sm text-muted">
                No alerts yet. Create one below.
              </div>
            ) : (
              <div className="space-y-2">
                {alerts.map((a) => {
                  const q = a.mint ? quotes[a.mint] : undefined;
                  const prog = triggerProgress(a, q);
                  const isFired = a.enabled === false || (a.lastFired || 0) > 0;
                  return (
                    <div key={a.id} className="rounded-xl border border-line bg-panel2/60 p-3">
                      <div className="flex items-center gap-3">
                        <div className={`shrink-0 p-1.5 rounded-lg ${a.enabled !== false ? "bg-accent/15 text-accent" : "bg-panel2 text-muted"}`}>
                          {alertIcon(a.type)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-white truncate">
                              {a.type === "wallet_trade"
                                ? <>{a.label || short(a.watch || "")} <span className="text-muted font-normal">— notify on any trade</span></>
                                : <>{a.symbol || q?.symbol || short(a.mint)} <span className="text-muted font-normal">— {TYPE_LABEL[a.type] || a.type}</span></>}
                            </span>
                            {a.mint && q?.price != null && (
                              <span className="font-mono text-[12px] text-white shrink-0">{fmtUsd(q.price)}</span>
                            )}
                            {needsValue(a.type) && (
                              <span className="font-mono text-[11px] text-accent shrink-0">→ {triggerLabel(a)}</span>
                            )}
                            <span className={`font-mono text-[10px] shrink-0 ${isFired ? "text-muted" : "text-up"}`}>
                              {isFired ? firedAt(a.lastFired) || "fired" : "armed"}
                            </span>
                          </div>
                          {a.mint && prog != null && (
                            <div className="mt-1.5 flex items-center gap-2">
                              <div className="h-1 flex-1 rounded-full bg-white/10 overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{ width: `${Math.round(prog * 100)}%`, background: "#e8b84a" }}
                                />
                              </div>
                              <span className="font-mono text-[10px] text-muted shrink-0">
                                {Math.round(prog * 100)}% to trigger · {distanceLabel(a, q)}
                              </span>
                            </div>
                          )}
                          <div className="truncate text-[11px] text-muted mt-1">
                            {a.channel} → {a.target.replace(/^https?:\/\//, "").slice(0, 40)}…
                          </div>
                        </div>
                        {a.mint && (
                          <Link
                            to={`/token/${a.mint}`}
                            className="shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-2 text-[12px] font-bold text-black hover:opacity-90"
                            style={{ background: "#e8b84a" }}
                          >
                            Trade <ArrowUpRight className="h-3.5 w-3.5" />
                          </Link>
                        )}
                        <button onClick={() => remove(a.id)} className="text-muted hover:text-[#ff6b6b] p-1.5 shrink-0" aria-label="Delete alert">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── New alert ── */}
          <div className="card p-4">
            <div className="mb-3 text-sm font-bold text-white">New Alert</div>
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
            {err && <div className="mt-2 flex items-center gap-1.5 text-xs text-[#ff6b6b]"><AlertTriangle className="h-3.5 w-3.5" /> {err}</div>}
            {ok && <div className="mt-2 flex items-center gap-1.5 text-xs text-up"><CheckCircle2 className="h-3.5 w-3.5" /> {ok}</div>}
            <p className="mt-2 text-[10px] text-muted/60">
              {channel === "telegram"
                ? "Telegram: open @Theogsupportbot → Start so it can DM you, then message @userinfobot to get your numeric chat ID."
                : "Discord: Server Settings → Integrations → Webhooks → New Webhook → Copy URL."} Alerts are checked every minute.
            </p>
            {!BACKEND_TYPES.has(type) && (
              <p className="mt-1.5 flex items-start gap-1.5 text-[10px] text-[#ff6b6b]/80">
                <AlertTriangle className="h-3 w-3 shrink-0 mt-px" />
                Heads up: the alerts backend only fires price and wallet-trade alerts
                today — this type will be rejected on create until the backend adds it.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
