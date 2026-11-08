/**
 * /alerts — Alerts command center.
 *
 * Watchlist-first redesign: live prices for every watched token, alert
 * triggers, and one-tap trade on each row. Data layers are unchanged:
 *  - webhook rules + migration watches: Supabase `alerts` / `migration-watch`
 *    edge functions (work today, no wallet signing needed)
 *  - wallet-proof price alerts (Limit / TP / Stop): `tradeAlerts.ts` →
 *    `/api/ogdex/alerts`. NOTE: the in-app desk wallet signs on the backend
 *    and cannot client-sign alert proofs yet (same honest "paused" state as
 *    TradingTerminal) — the section attempts the real fetch and, when signing
 *    is unavailable, says so and deep-links to the DEX alerts page where
 *    Phantom signs. Nothing here is faked.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  ArrowUpRight,
  Bell,
  Bot,
  Crosshair,
  ExternalLink,
  Loader2,
  Plus,
  Radar,
  RefreshCw,
  Send,
  Trash2,
  Twitter,
  Wallet,
  Webhook,
} from "lucide-react";
import { useActiveTradingWallet } from "@/hooks/useActiveTradingWallet";
import {
  ALERT_KINDS,
  createPriceAlert,
  fetchAlerts,
  removeAlert,
  type AlertKind,
} from "@/trade/tradeAlerts";
import { fetchTokenOnly } from "@/trade/tradeApi";
import { fmtPct, fmtUsd, shortAddr } from "@/trade/tradeFmt";

const GOLD = "#e8b84a";

type Quote = {
  price: number | null;
  change24h: number | null;
  symbol: string | null;
  name: string | null;
};

function numOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Price / symbol / 24h change out of a /api/ogdex/token payload (token/meta/raw aliases). */
function quoteFromPayload(d: any): Quote {
  const t = d?.token ?? {};
  const meta = d?.meta ?? {};
  const raw = d?.raw ?? {};
  return {
    price: numOrNull(t.priceUsd ?? meta.priceUsd ?? raw.priceUsd),
    change24h: numOrNull(
      t.change24h ?? t.priceChange24h ?? meta.priceChange24h ?? raw.priceChange24h,
    ),
    symbol: (t.symbol ?? meta.symbol ?? null) as string | null,
    name: (t.name ?? meta.name ?? null) as string | null,
  };
}

function ruleTrigger(r: any): string {
  return (
    r.nl_request ||
    (r.conditions?.length ? `${r.conditions.length} condition(s)` : "all notable moves")
  );
}

function priceAlertTrigger(a: any): string {
  const kind = ALERT_KINDS[a.kind as AlertKind];
  const target = Number(a.value);
  if (!kind || !Number.isFinite(target)) return a.type || "price alert";
  const unit = String(a.type || "").startsWith("pct") ? "%" : "";
  return `${kind.short} ${unit ? "" : "$"}${target}${unit}`;
}

/** 0..1 progress of live price from refPrice toward target; null when unknowable. */
function triggerProgress(a: any, q: Quote | undefined): number | null {
  const target = Number(a.value);
  const price = q?.price;
  const ref = Number(a.refPrice);
  if (!Number.isFinite(target) || !price || !Number.isFinite(ref) || ref <= 0) return null;
  if (target === ref) return null;
  return Math.max(0, Math.min(1, (price - ref) / (target - ref)));
}

function distanceLabel(a: any, q: Quote | undefined): string {
  const target = Number(a.value);
  if (!q?.price || !Number.isFinite(target) || target <= 0) return "—";
  const d = Math.abs(((target - q.price) / q.price) * 100);
  return `${d.toFixed(1)}% away`;
}

export default function Alerts() {
  const { address, ready: walletReady, signMessage } = useActiveTradingWallet();
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [type, setType] = useState("token");
  const [mint, setMint] = useState("");
  const [nl, setNl] = useState("");
  const [url, setUrl] = useState("");

  // ── Wallet-proof price alerts (tradeAlerts.ts → /api/ogdex/alerts) ──
  const [priceAlerts, setPriceAlerts] = useState<any[]>([]);
  const [priceStatus, setPriceStatus] = useState<"idle" | "loading" | "ready" | "paused">("idle");
  const [priceErr, setPriceErr] = useState("");
  const [paMint, setPaMint] = useState("");
  const [paKind, setPaKind] = useState<AlertKind>("limit");
  const [paValue, setPaValue] = useState("");
  const [paChannel, setPaChannel] = useState<"telegram" | "webhook">("telegram");
  const [paTarget, setPaTarget] = useState("");

  // ── Live quotes for every watched mint ──
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [quotesLoading, setQuotesLoading] = useState(false);

  const call = async (body: any) => {
    const { data, error } = await supabase.functions.invoke("alerts", { body });
    if (error || data?.error) throw new Error(data?.error || error?.message);
    return data;
  };
  const load = async () => {
    setLoading(true);
    try {
      const d = await call({ action: "list" });
      setRules(d.rules || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const loadPriceAlerts = useCallback(async () => {
    if (!address) {
      setPriceStatus("idle");
      setPriceAlerts([]);
      return;
    }
    setPriceStatus("loading");
    try {
      const d = await fetchAlerts(address, signMessage);
      if (d?.ok === false) throw new Error(d?.error || "Could not load price alerts");
      setPriceAlerts(Array.isArray(d?.alerts) ? d.alerts : []);
      setPriceStatus("ready");
    } catch (e: any) {
      // Desk wallet can't client-sign alert proofs yet — paused, not faked.
      setPriceStatus("paused");
      setPriceErr(e?.message || "Price alerts unavailable");
      setPriceAlerts([]);
    }
  }, [address, signMessage]);
  useEffect(() => {
    if (walletReady) void loadPriceAlerts();
  }, [walletReady, loadPriceAlerts]);

  // ── Watchlist: one row per distinct watched mint ──
  const watchlist = useMemo(() => {
    const map = new Map<string, { triggers: string[]; sources: string[] }>();
    for (const r of rules) {
      if (!r.mint) continue;
      const m = String(r.mint);
      const cur = map.get(m) ?? { triggers: [], sources: [] };
      cur.triggers.push(ruleTrigger(r));
      cur.sources.push("webhook");
      map.set(m, cur);
    }
    for (const a of priceAlerts) {
      if (!a.mint) continue;
      const m = String(a.mint);
      const cur = map.get(m) ?? { triggers: [], sources: [] };
      cur.triggers.push(priceAlertTrigger(a));
      cur.sources.push("price");
      map.set(m, cur);
    }
    return [...map.entries()].map(([mint, v]) => ({ mint, ...v }));
  }, [rules, priceAlerts]);

  const mintKey = useMemo(() => watchlist.map((w) => w.mint).join(","), [watchlist]);

  const loadQuotes = useCallback(async (mints: string[]) => {
    if (!mints.length) return;
    setQuotesLoading(true);
    const entries = await Promise.all(
      mints.slice(0, 10).map(async (m) => {
        try {
          const d = await fetchTokenOnly(m);
          return [m, quoteFromPayload(d)] as const;
        } catch {
          return [m, { price: null, change24h: null, symbol: null, name: null }] as const;
        }
      }),
    );
    setQuotes((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
    setQuotesLoading(false);
  }, []);

  useEffect(() => {
    const mints = mintKey ? mintKey.split(",") : [];
    if (!mints.length) return;
    void loadQuotes(mints);
    const t = setInterval(() => void loadQuotes(mints), 30_000);
    return () => clearInterval(t);
  }, [mintKey, loadQuotes]);

  const test = async () => {
    if (!url.trim()) {
      toast.error("Enter a webhook URL first");
      return;
    }
    setBusy(true);
    try {
      const d = await call({ action: "test", webhook_url: url.trim() });
      toast[d.ok ? "success" : "error"](
        d.ok ? "Test sent — check your webhook" : "Webhook rejected the test",
      );
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const create = async () => {
    if (!url.trim()) {
      toast.error("Webhook URL required");
      return;
    }
    if (type === "token" && !mint.trim()) {
      toast.error("Contract address required for token alerts");
      return;
    }
    setBusy(true);
    try {
      await call({
        action: "create",
        type,
        mint: mint.trim() || null,
        nl_request: nl.trim() || null,
        webhook_url: url.trim(),
      });
      setMint("");
      setNl("");
      toast.success("Alert created");
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const toggle = async (r: any) => {
    try {
      await call({ action: "update", id: r.id, enabled: !r.enabled });
      await load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  const del = async (r: any) => {
    try {
      await call({ action: "delete", id: r.id });
      await load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const createPrice = async () => {
    if (!address) {
      toast.error("Link your in-app wallet first");
      return;
    }
    const v = Number(paValue);
    if (!paMint.trim()) {
      toast.error("Contract address required");
      return;
    }
    if (!Number.isFinite(v) || v <= 0) {
      toast.error("Enter a target price in USD");
      return;
    }
    if (!paTarget.trim()) {
      toast.error("Telegram chat ID or webhook URL required");
      return;
    }
    setBusy(true);
    try {
      const d = await createPriceAlert({
        wallet: address,
        signMessage,
        mint: paMint.trim(),
        kind: paKind,
        valueUsd: v,
        channel: paChannel,
        target: paTarget.trim(),
      });
      if (d?.ok === false) throw new Error(d?.error || "Could not create alert");
      toast.success("Price alert armed");
      setPaMint("");
      setPaValue("");
      setPaTarget("");
      await loadPriceAlerts();
    } catch (e: any) {
      toast.error(e?.message || "Could not create alert");
    } finally {
      setBusy(false);
    }
  };
  const removePrice = async (id: string) => {
    if (!address) return;
    try {
      const d = await removeAlert(address, signMessage, id);
      if (d?.ok === false) throw new Error(d?.error || "Could not remove alert");
      setPriceAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch (e: any) {
      toast.error(e?.message || "Could not remove alert");
    }
  };

  const activeRules = rules.filter((r) => r.enabled).length;
  const activePrice = priceStatus === "ready" ? priceAlerts.filter((a) => a.enabled !== false).length : null;

  return (
    <AppLayout>
      <PageHeader
        title="Alerts"
        description="Your watchlist command center — live prices, triggers, one-tap trade"
      />
      <div className="px-4 pb-24 max-w-[920px] mx-auto space-y-4">
        {/* ── Command-center stats ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
            <div className="flex items-center gap-1.5 text-white/40 text-[10px] uppercase tracking-wider">
              <Crosshair className="h-3 w-3" style={{ color: GOLD }} /> Watchlist
            </div>
            <p className="mt-1 font-mono text-xl font-bold text-white">
              {watchlist.length}
              <span className="ml-1 text-[11px] font-normal text-white/40">tokens</span>
            </p>
            <p className="text-white/35 text-[10px]">
              {quotesLoading ? "refreshing prices…" : "live prices, 30s refresh"}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
            <div className="flex items-center gap-1.5 text-white/40 text-[10px] uppercase tracking-wider">
              <Webhook className="h-3 w-3" style={{ color: GOLD }} /> Webhook rules
            </div>
            <p className="mt-1 font-mono text-xl font-bold text-white">
              {activeRules}
              <span className="ml-1 text-[11px] font-normal text-white/40">
                / {rules.length} active
              </span>
            </p>
            <p className="text-white/35 text-[10px]">Discord / any webhook</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
            <div className="flex items-center gap-1.5 text-white/40 text-[10px] uppercase tracking-wider">
              <Radar className="h-3 w-3" style={{ color: GOLD }} /> Migration watches
            </div>
            <p className="mt-1 font-mono text-xl font-bold text-white">
              <MigrationWatchCount />
            </p>
            <p className="text-white/35 text-[10px]">AI-filtered graduations</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
            <div className="flex items-center gap-1.5 text-white/40 text-[10px] uppercase tracking-wider">
              <Bell className="h-3 w-3" style={{ color: GOLD }} /> Price alerts
            </div>
            <p className="mt-1 font-mono text-xl font-bold text-white">
              {activePrice == null ? "Paused" : `${activePrice} armed`}
            </p>
            <p className="text-white/35 text-[10px]">
              {priceStatus === "ready" ? "limit / TP / stop" : "signing not live in-app yet"}
            </p>
          </div>
        </div>

        {/* ── Watchlist command center ── */}
        <Card className="p-5 glass-card">
          <div className="flex items-center gap-2 mb-1">
            <Crosshair className="h-4 w-4" style={{ color: GOLD }} />
            <h3 className="font-bold text-white text-[15px]">Watchlist</h3>
            <span className="text-white/35 text-[11px]">live price · trigger · trade</span>
            <button
              type="button"
              onClick={() => void loadQuotes(mintKey ? mintKey.split(",") : [])}
              className="ml-auto grid h-8 w-8 place-items-center rounded-full border border-white/10 text-white/60 hover:text-white"
              aria-label="Refresh prices"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${quotesLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
          <p className="text-white/40 text-[11px] mb-3">
            Every token your alerts watch, with its live price and what fires. Tap Trade to open
            the token desk.
          </p>
          {loading ? (
            <div className="flex items-center gap-2 text-white/40 text-[13px]">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading watchlist…
            </div>
          ) : watchlist.length ? (
            <div className="space-y-2">
              {watchlist.map((w) => {
                const q = quotes[w.mint];
                const sym = q?.symbol || shortAddr(w.mint, 4);
                const up = (q?.change24h ?? 0) >= 0;
                return (
                  <div
                    key={w.mint}
                    className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
                  >
                    <div
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl font-mono text-[11px] font-bold"
                      style={{ background: `${GOLD}22`, color: GOLD }}
                    >
                      {sym.slice(0, 4).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-white/90 text-[13px] font-bold truncate">
                          {sym}
                        </span>
                        <span className="font-mono text-[12px] font-semibold text-white">
                          {q?.price != null ? fmtUsd(q.price) : quotesLoading ? "…" : "—"}
                        </span>
                        {q?.change24h != null && (
                          <span
                            className="font-mono text-[11px]"
                            style={{ color: up ? GOLD : "rgba(255,255,255,0.45)" }}
                          >
                            {fmtPct(q.change24h)}
                          </span>
                        )}
                      </div>
                      <div className="text-white/35 text-[11px] truncate">
                        {q?.name || shortAddr(w.mint, 6)}
                        {" · "}
                        {w.triggers.slice(0, 2).join(" · ")}
                        {w.triggers.length > 2 ? ` · +${w.triggers.length - 2} more` : ""}
                      </div>
                    </div>
                    <Link
                      to={`/trade/token/${w.mint}`}
                      className="shrink-0 inline-flex items-center gap-1 rounded-full px-3.5 py-2 text-[12px] font-bold text-black hover:opacity-90"
                      style={{ background: GOLD }}
                    >
                      Trade <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-white/30 text-[13px]">
              Nothing watched yet — create a token alert below and it lands here with a live
              price.
            </div>
          )}
        </Card>

        {/* ── Price alerts (wallet-proof, tradeAlerts.ts) ── */}
        <Card className="p-5 glass-card">
          <div className="flex items-center gap-2 mb-1">
            <Bell className="h-4 w-4" style={{ color: GOLD }} />
            <h3 className="font-bold text-white text-[15px]">Price alerts</h3>
            <Badge className="ml-auto text-[9px] border-0" style={{ background: `${GOLD}22`, color: GOLD }}>
              LIMIT · TP · STOP
            </Badge>
          </div>
          <p className="text-white/40 text-[11px] mb-3">
            Notify-only — checked every minute. You place the trade when one fires.
          </p>

          {priceStatus === "loading" ? (
            <div className="flex items-center gap-2 text-white/40 text-[13px]">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking price alerts…
            </div>
          ) : priceStatus === "ready" ? (
            priceAlerts.length ? (
              <div className="space-y-2 mb-4">
                {priceAlerts.map((a) => {
                  const q = quotes[a.mint];
                  const prog = triggerProgress(a, q);
                  return (
                    <div
                      key={a.id}
                      className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
                    >
                      <Badge variant="outline" className="text-[9px] uppercase shrink-0">
                        {ALERT_KINDS[a.kind as AlertKind]?.short || a.kind || a.type}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-white/90 text-[13px] font-semibold truncate">
                            {a.symbol || q?.symbol || shortAddr(a.mint || "", 4)}
                          </span>
                          <span className="font-mono text-[12px] text-white">
                            {q?.price != null ? fmtUsd(q.price) : "—"}
                          </span>
                          <span className="font-mono text-[11px] text-white/50">
                            → {priceAlertTrigger(a)}
                          </span>
                        </div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="h-1 flex-1 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.round((prog ?? 0) * 100)}%`,
                                background: GOLD,
                              }}
                            />
                          </div>
                          <span className="font-mono text-[10px] text-white/45 shrink-0">
                            {prog == null ? distanceLabel(a, q) : `${Math.round(prog * 100)}% to trigger`}
                          </span>
                        </div>
                        <div className="text-white/30 text-[10px] mt-1 truncate">
                          {a.channel} → {String(a.target || "").replace(/^https?:\/\//, "").slice(0, 40)}
                        </div>
                      </div>
                      <Link
                        to={`/trade/token/${a.mint}`}
                        className="shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-2 text-[12px] font-bold text-black hover:opacity-90"
                        style={{ background: GOLD }}
                      >
                        Trade <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void removePrice(a.id)}
                        className="h-8 px-2 text-red-400/70 hover:text-red-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-white/30 text-[13px] mb-4">
                No price alerts armed. Set a target below — it fires to Telegram or your webhook.
              </p>
            )
          ) : (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 mb-4">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 shrink-0" style={{ color: GOLD }} />
                <p className="text-white/85 text-[13px] font-semibold">
                  Price alerts are paused in the main app
                </p>
              </div>
              <p className="text-white/40 text-[12px] mt-1.5 leading-relaxed">
                Limit / TP / stop alerts are wallet-proof — they need client-side message
                signing, and the in-app wallet signs on the backend, so that proof can&apos;t be
                made here yet. Your webhook rules and migration watches below work today.
                {priceErr && (
                  <span className="text-white/30"> ({priceErr})</span>
                )}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(Object.keys(ALERT_KINDS) as AlertKind[]).map((k) => (
                  <span
                    key={k}
                    className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-white/60"
                    title={ALERT_KINDS[k].help}
                  >
                    {ALERT_KINDS[k].label}
                  </span>
                ))}
                <a
                  href="/ORBITX_DEX/alerts"
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold text-black hover:opacity-90"
                  style={{ background: GOLD }}
                >
                  Manage in DEX <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          )}

          {/* Arm a price alert — attempts the real tradeAlerts.ts call; surfaces the
              honest backend-signing error until signing lands. */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-white/50 text-[11px]">Contract address</Label>
              <Input
                value={paMint}
                onChange={(e) => setPaMint(e.target.value)}
                placeholder="paste CA…"
                className="bg-white/5 border-white/10 text-sm font-mono mt-1"
              />
            </div>
            <div>
              <Label className="text-white/50 text-[11px]">Kind</Label>
              <Select value={paKind} onValueChange={(v) => setPaKind(v as AlertKind)}>
                <SelectTrigger className="bg-white/5 border-white/10 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ALERT_KINDS) as AlertKind[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {ALERT_KINDS[k].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-white/50 text-[11px]">Target price (USD)</Label>
              <Input
                value={paValue}
                onChange={(e) => setPaValue(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0.00"
                inputMode="decimal"
                className="bg-white/5 border-white/10 text-sm font-mono mt-1"
              />
              <div className="text-white/30 text-[10px] mt-1">
                {ALERT_KINDS[paKind].help}
              </div>
            </div>
            <div>
              <Label className="text-white/50 text-[11px]">Notify via</Label>
              <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-white/[0.04] p-1 mt-1">
                {(["telegram", "webhook"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setPaChannel(c)}
                    className={`rounded-lg py-2 text-[11px] font-bold capitalize ${
                      paChannel === c ? "text-black" : "text-white/60 hover:text-white"
                    }`}
                    style={paChannel === c ? { background: GOLD } : undefined}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-3">
            <Label className="text-white/50 text-[11px]">
              {paChannel === "telegram" ? "Telegram chat ID or @channel" : "Webhook URL"}
            </Label>
            <Input
              value={paTarget}
              onChange={(e) => setPaTarget(e.target.value)}
              placeholder={
                paChannel === "telegram"
                  ? "123456789 or @channel"
                  : "https://discord.com/api/webhooks/…"
              }
              className="bg-white/5 border-white/10 text-sm mt-1"
            />
          </div>
          <Button
            onClick={() => void createPrice()}
            disabled={busy}
            className="rounded-xl font-bold mt-3 text-black hover:opacity-90"
            style={{ background: GOLD }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Plus className="h-4 w-4 mr-1.5" />}
            Arm {ALERT_KINDS[paKind].label}
          </Button>
        </Card>

        {/* ── Webhook rules: create ── */}
        <Card className="p-5 glass-card">
          <div className="flex items-center gap-2 mb-3">
            <Webhook className="h-4 w-4" style={{ color: GOLD }} />
            <h3 className="font-bold text-white text-[15px]">New webhook alert</h3>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-white/50 text-[11px]">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="bg-white/5 border-white/10 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="token">Token (by contract)</SelectItem>
                  <SelectItem value="migrations">Pump.fun migrations (all)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {type === "token" && (
              <div>
                <Label className="text-white/50 text-[11px]">Contract address</Label>
                <Input
                  value={mint}
                  onChange={(e) => setMint(e.target.value)}
                  placeholder="paste CA…"
                  className="bg-white/5 border-white/10 text-sm font-mono mt-1"
                />
              </div>
            )}
          </div>
          {type === "token" && (
            <div className="mt-3">
              <Label className="text-white/50 text-[11px]">Tell the brain what to alert you about</Label>
              <Textarea
                value={nl}
                onChange={(e) => setNl(e.target.value)}
                placeholder="e.g. alert me when it 2x's, dips 20%, or crosses $10M market cap"
                className="bg-white/5 border-white/10 text-sm mt-1 min-h-[64px]"
              />
              <div className="text-white/30 text-[10px] mt-1">
                AI converts this into precise conditions. Leave blank to get every notable move.
              </div>
            </div>
          )}
          <div className="mt-3">
            <Label className="text-white/50 text-[11px]">Discord webhook or any custom webhook URL</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://discord.com/api/webhooks/…  or your own webhook"
              className="bg-white/5 border-white/10 text-sm mt-1"
            />
          </div>
          <div className="flex gap-2 mt-3">
            <Button
              onClick={create}
              disabled={busy}
              className="rounded-xl font-bold text-black hover:opacity-90"
              style={{ background: GOLD }}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Plus className="h-4 w-4 mr-1.5" />}
              Create alert
            </Button>
            <Button onClick={test} disabled={busy} variant="outline" className="rounded-xl">
              <Send className="h-3.5 w-3.5 mr-1.5" /> Test webhook
            </Button>
          </div>
        </Card>

        {/* ── Webhook rules: list ── */}
        <Card className="p-5 glass-card">
          <div className="flex items-center gap-2 mb-3">
            <Webhook className="h-4 w-4" style={{ color: GOLD }} />
            <h3 className="font-bold text-white text-[15px]">Your webhook alerts</h3>
            <span className="text-white/35 text-[11px] ml-auto">
              {activeRules} of {rules.length} on
            </span>
          </div>
          {loading ? (
            <div className="flex items-center gap-2 text-white/40 text-[13px]">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : rules.length ? (
            <div className="space-y-2">
              {rules.map((r) => {
                const q = r.mint ? quotes[r.mint] : undefined;
                return (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
                  >
                    <Badge variant="outline" className="text-[9px] uppercase shrink-0">
                      {r.type}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-white/85 text-[13px] font-semibold truncate">
                          {r.name || r.symbol || q?.symbol || r.mint || "Migrations"}
                        </span>
                        {q?.price != null && (
                          <span className="font-mono text-[11px] text-white/70 shrink-0">
                            {fmtUsd(q.price)}
                          </span>
                        )}
                      </div>
                      <div className="text-white/35 text-[11px] truncate">
                        {ruleTrigger(r)} · {r.channel_type}
                      </div>
                    </div>
                    {r.mint && (
                      <Link
                        to={`/trade/token/${r.mint}`}
                        className="shrink-0 inline-flex items-center gap-1 rounded-full border border-white/15 px-3 py-2 text-[12px] font-bold text-white hover:border-white/40"
                      >
                        Trade <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    )}
                    <Switch checked={!!r.enabled} onCheckedChange={() => toggle(r)} />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => del(r)}
                      className="h-8 px-2 text-red-400/70 hover:text-red-300"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-white/30 text-[13px]">No alerts yet. Create one above.</div>
          )}
        </Card>

        <MigrationWatchCard />

        {/* full bot + auto-poster live in Settings > Connections */}
        <Card className="p-4 glass-card">
          <div className="flex items-center gap-2 mb-1">
            <Bot className="h-4 w-4 text-[#5865F2]" />
            <Twitter className="h-4 w-4" style={{ color: GOLD }} />
            <h4 className="font-bold text-white text-[13px]">Want a full Discord bot or X auto-poster?</h4>
          </div>
          <p className="text-white/40 text-[11px]">
            Bring your own Discord bot (slash commands) and connect your X account to auto-post
            migrations &amp; reports from{" "}
            <a href="/settings" className="hover:underline" style={{ color: GOLD }}>
              Settings → Connections
            </a>
            .
          </p>
        </Card>

        <div className="text-white/30 text-[11px] text-center">
          Want the full experience (scans, PDFs/HTML reports, wallet tools, chat)? Use the
          Telegram super bot. Webhooks are the lightweight alerts-only channel.
        </div>
      </div>
    </AppLayout>
  );
}

// ── Migration-watch count for the stats strip (lightweight list read) ────────
function MigrationWatchCount() {
  const [count, setCount] = useState<string>("—");
  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const { data } = await supabase.functions.invoke("migration-watch", {
          body: { action: "list" },
        });
        if (!on) return;
        const watches = data?.watches || [];
        const active = watches.filter((w: any) => w.enabled).length;
        setCount(`${active} / ${watches.length}`);
      } catch {
        if (on) setCount("—");
      }
    })();
    return () => {
      on = false;
    };
  }, []);
  return <>{count}</>;
}

// ── Conversational migration watches (firehose filters) ────────────────────────
function MigrationWatchCard() {
  const [watches, setWatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [nl, setNl] = useState("");
  const [url, setUrl] = useState("");

  const fn = async (body: any) => {
    const { data, error } = await supabase.functions.invoke("migration-watch", { body });
    if (error || data?.error) throw new Error(data?.error || error?.message);
    return data;
  };
  const load = async () => {
    setLoading(true);
    try {
      const d = await fn({ action: "list" });
      setWatches(d.watches || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    if (!url.trim()) {
      toast.error("Webhook URL required");
      return;
    }
    setBusy(true);
    try {
      await fn({ action: "create", nl_request: nl.trim() || null, webhook_url: url.trim() });
      setNl("");
      toast.success("Watch created - AI compiled your filter");
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const toggle = async (w: any) => {
    try {
      await fn({ action: "update", id: w.id, enabled: !w.enabled });
      await load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  const del = async (w: any) => {
    try {
      await fn({ action: "delete", id: w.id });
      await load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <Card className="p-5 glass-card">
      <div className="flex items-center gap-2 mb-1">
        <Radar className="h-4 w-4" style={{ color: GOLD }} />
        <h3 className="font-bold text-white text-[15px]">Migration watches</h3>
        <Badge className="ml-auto text-[9px] border-0" style={{ background: `${GOLD}22`, color: GOLD }}>
          AI
        </Badge>
      </div>
      <p className="text-white/40 text-[11px] mb-3">
        Describe what you want in plain English. Grim watches every pump.fun graduation and pings
        you only when one matches.
      </p>
      <Textarea
        value={nl}
        onChange={(e) => setNl(e.target.value)}
        placeholder="e.g. alert me on migrations with 50+ holders, revoked mint, and over $30k market cap"
        className="bg-white/5 border-white/10 text-sm min-h-[60px]"
      />
      <Input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Discord webhook or any webhook URL"
        className="bg-white/5 border-white/10 text-sm mt-2"
      />
      <Button
        onClick={create}
        disabled={busy}
        className="rounded-xl font-bold mt-2 text-black hover:opacity-90"
        style={{ background: GOLD }}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Plus className="h-4 w-4 mr-1.5" />}
        Create watch
      </Button>

      {loading ? null : watches.length ? (
        <div className="space-y-2 mt-4">
          {watches.map((w) => (
            <div
              key={w.id}
              className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
            >
              <Radar className="h-3.5 w-3.5 shrink-0" style={{ color: GOLD }} />
              <div className="min-w-0 flex-1">
                <div className="text-white/85 text-[12px] truncate">{w.nl_request || "every migration"}</div>
                <div className="text-white/30 text-[10px]">
                  {(w.conditions?.length || 0)} condition(s)
                  {w.webhook_hint ? ` · ${w.webhook_hint}` : ""}
                </div>
              </div>
              <Switch checked={!!w.enabled} onCheckedChange={() => toggle(w)} />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => del(w)}
                className="h-8 px-2 text-red-400/70 hover:text-red-300"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
