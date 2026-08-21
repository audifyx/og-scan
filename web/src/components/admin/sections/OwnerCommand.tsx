/**
 * Owner command center sections — live data from /api/orbitx-owner.
 * Zeroes mean no verified rows yet, not placeholder metrics.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Activity,
  Flame,
  Globe2,
  HeartPulse,
  Loader2,
  Radio,
  RefreshCw,
  Search,
  Shield,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import type { AdminSection } from "../types";
import {
  fmtNum,
  fmtUsd,
  liveDot,
  ownerCommand,
  solscanTx,
} from "@/lib/orbitx/ownerCommand";

type Overview = {
  generatedAt: string;
  definitions: Record<string, string>;
  users: {
    total: number;
    newToday: number;
    newYesterday: number;
    newWeek: number;
    newMonth: number;
    onlineNow: number;
    awayNow: number;
    dau: number;
  };
  activity: {
    txMonth: number;
    txToday: number;
    volumeMonthUsd: number;
    volumeTodayUsd: number;
    launchesMonth: number;
    launchesToday: number;
    jupiterMonth: number;
  };
  revenue: {
    feesMonthUsd: number;
    feesTodayUsd: number;
    feesWeekUsd: number;
    feesByApp: Record<string, number>;
    avgFeeUsd: number;
    maxFeeUsd: number;
  };
  burns: {
    tokensMonth: number;
    tokensToday: number;
    countMonth: number;
    countToday: number;
  };
  apps: Record<string, { online: number; away: number }>;
  live: Array<Record<string, unknown>>;
};

type Health = {
  state: string;
  checks: Array<{ name: string; ok: boolean; state: string; ms: number; error?: string }>;
  failedTransactionsToday: number;
  lastVerifiedBurn: { created_at?: string; tokens_burned?: number; tx_signature?: string } | null;
  feeProcessor: string;
  burnProcessor: string;
};

function Card({
  label,
  value,
  hint,
  tone = "text-white",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/35">{label}</p>
      <p className={`mt-1 text-2xl font-black tabular-nums ${tone}`}>{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-white/40">{hint}</p> : null}
    </div>
  );
}

function useOwnerPoll<T>(action: Parameters<typeof ownerCommand>[0], extra: Record<string, unknown> = {}, ms = 8000) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const extraKey = JSON.stringify(extra);

  const load = useCallback(async () => {
    try {
      const json = await ownerCommand<{ data?: T; rows?: T; mcp?: unknown }>(action, extra);
      setData((json.data ?? json.rows ?? json) as T);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Owner API failed");
    } finally {
      setLoading(false);
    }
  }, [action, extraKey]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), ms);
    return () => clearInterval(id);
  }, [load, ms]);

  return { data, error, loading, reload: load };
}

export function CommandOverview({ onNavigate }: { onNavigate: (s: AdminSection) => void }) {
  const { data, error, loading, reload } = useOwnerPoll<{ data: Overview } | Overview>("overview", {}, 8000);
  const o = ((data as { data?: Overview })?.data || data) as Overview | null;

  if (loading && !o) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-cyan-300" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200/70">Live command</p>
          <h2 className="text-xl font-black text-white">Platform pulse</h2>
          <p className="mt-1 text-xs text-white/45">
            Metrics are verified rows only. Empty tables read as zero — never estimated.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void reload()}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/70"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>
      {error ? (
        <p className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">{error}</p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card label="Online now" value={fmtNum(o?.users.onlineNow)} hint={`${fmtNum(o?.users.awayNow)} away`} tone="text-emerald-300" />
        <Card label="Total users" value={fmtNum(o?.users.total)} hint={`+${fmtNum(o?.users.newToday)} today`} tone="text-cyan-200" />
        <Card label="DAU" value={fmtNum(o?.users.dau)} hint={`${fmtNum(o?.users.newWeek)} new this week`} />
        <Card label="Fees today" value={fmtUsd(o?.revenue.feesTodayUsd)} hint={`${fmtUsd(o?.revenue.feesMonthUsd)} / 30d`} tone="text-yellow-200" />
        <Card label="Volume today" value={fmtUsd(o?.activity.volumeTodayUsd)} hint={`${fmtNum(o?.activity.txToday)} verified txs`} />
        <Card label="Jupiter (30d)" value={fmtNum(o?.activity.jupiterMonth)} hint="Completed + on-chain verified" />
        <Card label="Burns today" value={fmtNum(o?.burns.tokensToday)} hint={`${fmtNum(o?.burns.countToday)} verified burns`} tone="text-orange-300" />
        <Card label="Launches today" value={fmtNum(o?.activity.launchesToday)} hint={`${fmtNum(o?.activity.launchesMonth)} / 30d`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 lg:col-span-2">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Live users by app</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Object.entries(o?.apps || {}).length === 0 ? (
              <p className="col-span-full text-sm text-white/40">No heartbeats yet. Presence starts after the migration is applied.</p>
            ) : (
              Object.entries(o?.apps || {}).map(([app, v]) => (
                <button
                  key={app}
                  type="button"
                  onClick={() => onNavigate("live_users")}
                  className="rounded-xl border border-white/[0.08] bg-[#0b1420] px-3 py-3 text-left"
                >
                  <p className="text-xs font-semibold capitalize text-white/80">{app}</p>
                  <p className="mt-1 text-lg font-black text-emerald-300">{v.online}</p>
                  <p className="text-[10px] text-white/35">{v.away} away</p>
                </button>
              ))
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Definitions</p>
          <ul className="mt-3 space-y-2 text-[11px] leading-5 text-white/50">
            {Object.entries(o?.definitions || {}).map(([k, v]) => (
              <li key={k}>
                <span className="font-semibold text-white/75">{k}:</span> {v}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function CommandLiveUsers({ onOpenUser }: { onOpenUser: (userId: string) => void }) {
  const { data, loading } = useOwnerPoll<Array<Record<string, unknown>>>("presence", {}, 5000);
  const rows = Array.isArray(data) ? data : ((data as { rows?: unknown[] })?.rows as Array<Record<string, unknown>>) || [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-black text-white">Live users</h2>
        <p className="text-xs text-white/45">ONLINE = heartbeat &lt; 60s. AWAY = 60s–5m. Offline rows stay off this list.</p>
      </div>
      {loading && !rows.length ? (
        <Loader2 className="h-6 w-6 animate-spin text-cyan-300" />
      ) : (
        <div className="grid gap-2">
          {rows.filter((r) => r.liveStatus === "online" || r.liveStatus === "away").map((u) => (
            <button
              key={String(u.user_id)}
              type="button"
              onClick={() => onOpenUser(String(u.user_id))}
              className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-3 text-left"
            >
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${liveDot(String(u.liveStatus))}`} />
              <img
                src={String(u.avatar_url || "")}
                alt=""
                className="h-9 w-9 rounded-full bg-white/10 object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{String(u.username || "anon")}</p>
                <p className="truncate text-[11px] text-white/40">
                  {String(u.current_app || "app")} · {String(u.current_path || "/")} · {String(u.device || "—")}
                </p>
              </div>
              <span className="text-[10px] uppercase tracking-wider text-white/35">{String(u.liveStatus)}</span>
            </button>
          ))}
          {!rows.filter((r) => r.liveStatus === "online" || r.liveStatus === "away").length ? (
            <p className="text-sm text-white/40">Nobody is online. Heartbeats appear after users load the app with the presence table live.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function CommandTable({
  action,
  title,
  hint,
}: {
  action: "events" | "ledger" | "jupiter" | "burns" | "audit";
  title: string;
  hint: string;
}) {
  const [q, setQ] = useState("");
  const extra = useMemo(() => {
    if (action === "ledger" || action === "jupiter") return q ? { signature: q, q } : {};
    if (action === "events") return q ? { eventType: q } : {};
    return {};
  }, [action, q]);
  const { data, loading } = useOwnerPoll<unknown>(action, extra, 10000);
  const payload = data as { rows?: Array<Record<string, unknown>>; mcp?: Array<Record<string, unknown>> } | Array<Record<string, unknown>> | null;
  const rows = Array.isArray(payload) ? payload : payload?.rows || [];
  const mcp = !Array.isArray(payload) ? payload?.mcp || [] : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-black text-white">{title}</h2>
          <p className="text-xs text-white/45">{hint}</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={action === "events" ? "Filter event type" : "Signature / filter"}
            className="h-10 w-full rounded-xl border border-white/10 bg-[#0b1420] pl-9 pr-3 text-sm text-white placeholder:text-white/30"
          />
        </div>
      </div>
      {loading && !rows.length ? (
        <Loader2 className="h-6 w-6 animate-spin text-cyan-300" />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/[0.08]">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-white/[0.03] text-[10px] uppercase tracking-[0.16em] text-white/35">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Detail</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {[...rows, ...mcp.map((m) => ({ ...m, _mcp: true }))].map((r, i) => {
                const sig = String(r.tx_signature || r.signature || "");
                const href = solscanTx(sig);
                return (
                  <tr key={String(r.id || sig || i)} className="border-t border-white/[0.06]">
                    <td className="px-3 py-2 text-xs text-white/50">
                      {r.created_at ? formatDistanceToNow(new Date(String(r.created_at)), { addSuffix: true }) : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs font-semibold text-white/80">
                      {String(r.event_type || r.tx_type || r.action || r.application || (r._mcp ? "mcp_burn" : "—"))}
                    </td>
                    <td className="px-3 py-2 text-xs text-white/60">
                      {String(r.title || r.tokens_burned || r.value_usd || r.fee_usd_actual || "").slice(0, 80) || "—"}
                      {href ? (
                        <a className="ml-2 text-cyan-300" href={href} target="_blank" rel="noreferrer">
                          explorer
                        </a>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-[11px] uppercase text-white/45">
                      {String(r.status || (r.verified_onchain === false ? "unverified" : r.verified_onchain ? "verified" : "—"))}
                    </td>
                  </tr>
                );
              })}
              {!rows.length && !mcp.length ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-sm text-white/40">
                    No verified rows yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function CommandHealth() {
  const { data, loading } = useOwnerPoll<{ data: Health } | Health>("health", {}, 15000);
  const h = ((data as { data?: Health })?.data || data) as Health | null;
  const tone =
    h?.state === "healthy" ? "text-emerald-300" : h?.state === "warning" ? "text-amber-300" : "text-rose-300";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <HeartPulse className={`h-6 w-6 ${tone}`} />
        <div>
          <h2 className="text-xl font-black text-white">System health</h2>
          <p className={`text-xs font-semibold uppercase tracking-wider ${tone}`}>{h?.state || "loading"}</p>
        </div>
      </div>
      {loading && !h ? <Loader2 className="h-6 w-6 animate-spin text-cyan-300" /> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(h?.checks || []).map((c) => (
          <div key={c.name} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
            <p className="text-xs font-semibold capitalize text-white/80">{c.name.replace("_", " ")}</p>
            <p className={`mt-1 text-lg font-black ${c.ok ? "text-emerald-300" : "text-rose-300"}`}>
              {c.ok ? "healthy" : "critical"}
            </p>
            <p className="text-[11px] text-white/40">{c.ms}ms{c.error ? ` · ${c.error}` : ""}</p>
          </div>
        ))}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
          <p className="text-xs font-semibold text-white/80">Failed txs today</p>
          <p className="mt-1 text-lg font-black text-white">{fmtNum(h?.failedTransactionsToday)}</p>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
          <p className="text-xs font-semibold text-white/80">Fee processor</p>
          <p className="mt-1 text-sm text-white/70">{h?.feeProcessor || "—"}</p>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
          <p className="text-xs font-semibold text-white/80">Burn processor</p>
          <p className="mt-1 text-sm text-white/70">{h?.burnProcessor || "—"}</p>
          {h?.lastVerifiedBurn?.tx_signature ? (
            <a
              className="mt-1 inline-block text-[11px] text-cyan-300"
              href={solscanTx(h.lastVerifiedBurn.tx_signature) || "#"}
              target="_blank"
              rel="noreferrer"
            >
              last burn {fmtNum(h.lastVerifiedBurn.tokens_burned)}
            </a>
          ) : (
            <p className="mt-1 text-[11px] text-white/35">No verified burns recorded yet</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function CommandFees() {
  const { data } = useOwnerPoll<{ data: Overview } | Overview>("overview", {}, 12000);
  const o = ((data as { data?: Overview })?.data || data) as Overview | null;
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-black text-white">Fees</h2>
      <p className="text-xs text-white/45">
        Backend formula: platform_fee = min(tx_usd × 0.012, $10). Frontend quotes are previews only.
      </p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card label="Today" value={fmtUsd(o?.revenue.feesTodayUsd)} tone="text-yellow-200" />
        <Card label="7d" value={fmtUsd(o?.revenue.feesWeekUsd)} />
        <Card label="30d" value={fmtUsd(o?.revenue.feesMonthUsd)} />
        <Card label="Avg / max" value={`${fmtUsd(o?.revenue.avgFeeUsd)} / ${fmtUsd(o?.revenue.maxFeeUsd)}`} />
      </div>
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">By application</p>
        <div className="mt-3 space-y-2">
          {Object.entries(o?.revenue.feesByApp || {}).length === 0 ? (
            <p className="text-sm text-white/40">No completed fee rows yet.</p>
          ) : (
            Object.entries(o?.revenue.feesByApp || {}).map(([app, usd]) => (
              <div key={app} className="flex items-center justify-between text-sm">
                <span className="capitalize text-white/70">{app}</span>
                <span className="font-semibold text-white">{fmtUsd(usd)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export function CommandApps({ onNavigate }: { onNavigate: (s: AdminSection) => void }) {
  const { data } = useOwnerPoll<{ data: Overview } | Overview>("overview", {}, 12000);
  const o = ((data as { data?: Overview })?.data || data) as Overview | null;
  const names = new Set([
    ...Object.keys(o?.apps || {}),
    ...Object.keys(o?.revenue.feesByApp || {}),
    "dex",
    "agent",
    "launches",
    "communities",
    "games",
    "predictions",
  ]);
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-black text-white">Platform apps</h2>
      <p className="text-xs text-white/45">Presence + verified fees per application. Zeros mean no heartbeats/fees yet.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[...names].map((app) => (
          <button
            key={app}
            type="button"
            onClick={() => onNavigate("live_users")}
            className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-4 text-left"
          >
            <p className="text-sm font-bold capitalize text-white">{app}</p>
            <p className="mt-2 text-2xl font-black text-emerald-300">{o?.apps?.[app]?.online || 0}</p>
            <p className="text-[11px] text-white/40">
              {o?.apps?.[app]?.away || 0} away · {fmtUsd(o?.revenue.feesByApp?.[app] || 0)} fees / 30d
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

export function OwnerUserHub({
  openUserId,
  onClose,
}: {
  openUserId: string | null;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (term: string) => {
    setLoading(true);
    try {
      const json = await ownerCommand<{ rows: Array<Record<string, unknown>> }>("search", { q: term, limit: 40 });
      setRows(json.rows || []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void search(q), 280);
    return () => clearTimeout(t);
  }, [q, search]);

  useEffect(() => {
    if (!openUserId) {
      setDetail(null);
      return;
    }
    void ownerCommand<{ data: Record<string, unknown> }>("user", { userId: openUserId })
      .then((j) => setDetail(j.data || null))
      .catch(() => setDetail(null));
  }, [openUserId]);

  const profile = (detail?.profile || {}) as Record<string, unknown>;
  const presence = (detail?.presence || {}) as Record<string, unknown>;
  const stats = (detail?.stats || {}) as Record<string, number>;
  const timeline = (detail?.timeline || []) as Array<Record<string, unknown>>;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search username, wallet, user id"
            className="h-11 w-full rounded-xl border border-white/10 bg-[#0b1420] pl-10 pr-3 text-sm text-white placeholder:text-white/30"
          />
        </div>
        <div className="mt-3 max-h-[520px] space-y-1 overflow-auto">
          {loading ? <Loader2 className="mx-auto my-6 h-5 w-5 animate-spin text-cyan-300" /> : null}
          {rows.map((u) => (
            <button
              key={String(u.user_id)}
              type="button"
              onClick={() =>
                void ownerCommand<{ data: Record<string, unknown> }>("user", { userId: u.user_id }).then((j) =>
                  setDetail(j.data || null),
                )
              }
              className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-white/[0.04]"
            >
              <span className={`h-2 w-2 rounded-full ${liveDot(String(u.liveStatus))}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-white">{String(u.username || "anon")}</p>
                <p className="truncate text-[11px] text-white/40">
                  {String(u.current_app || "—")} · {String(u.wallet_address || "").slice(0, 8)}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
        {!detail ? (
          <p className="text-sm text-white/40">Select a user to open the full profile.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-black text-white">{String(profile.username || "anon")}</p>
                <p className="text-[11px] text-white/40">{String(profile.user_id)}</p>
                <p className="mt-1 font-mono text-[11px] text-white/55">{String(profile.wallet_address || "no wallet")}</p>
              </div>
              {openUserId ? (
                <button type="button" onClick={onClose} className="text-xs text-white/40">
                  Close
                </button>
              ) : null}
            </div>
            <p className="text-xs text-white/55">
              <span className={`mr-2 inline-block h-2 w-2 rounded-full ${liveDot(String(presence.liveStatus))}`} />
              {String(presence.liveStatus || "offline")} · {String(presence.current_app || "—")} ·{" "}
              {String(presence.current_path || "—")}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Card label="Volume" value={fmtUsd(stats.volumeUsd)} />
              <Card label="Fees" value={fmtUsd(stats.feesUsd)} />
              <Card label="Burned" value={fmtNum(stats.burns)} />
              <Card label="Txs" value={fmtNum(stats.transactions)} />
              <Card label="Jupiter" value={fmtNum(stats.jupiter)} />
              <Card label="XP" value={fmtNum(stats.xp)} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/35">Timeline</p>
              <div className="mt-2 max-h-[360px] space-y-2 overflow-auto">
                {timeline.map((e, i) => (
                  <div key={i} className="rounded-xl border border-white/[0.06] bg-[#0b1420] px-3 py-2">
                    <p className="text-sm text-white/85">{String(e.title)}</p>
                    <p className="text-[11px] text-white/35">
                      {e.at ? formatDistanceToNow(new Date(String(e.at)), { addSuffix: true }) : ""} · {String(e.kind)}
                    </p>
                  </div>
                ))}
                {!timeline.length ? <p className="text-sm text-white/40">No events yet for this user.</p> : null}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export const COMMAND_ICONS = { Activity, Flame, Globe2, HeartPulse, Radio, Shield, TrendingUp, Users, Wallet };
