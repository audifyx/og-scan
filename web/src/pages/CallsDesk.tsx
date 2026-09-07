import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell,
  Bot,
  Crosshair,
  Database,
  Link2,
  Loader2,
  Radio,
  RefreshCw,
  Trophy,
  Unplug,
  Users,
} from "lucide-react";
import { CopyMintButton } from "@/components/CopyMintButton";
import { formatAddress, formatUsd } from "@/pages/onchain-world/lib/orbitx/format";
import { readDeskSessionToken } from "../../shared/desk-unlock-client.js";

type CallRow = {
  id?: string;
  mint?: string;
  symbol?: string;
  name?: string;
  url?: string;
  agent_id?: string;
  agent_name?: string;
  thesis?: string;
  analysis?: Record<string, unknown>;
  mc_at_call?: number | null;
  liq_at_call?: number | null;
  vol_24h_at_call?: number | null;
  mc_ath?: number | null;
  mc_atl?: number | null;
  mc_now?: number | null;
  multiple_now?: number | null;
  multiple_ath?: number | null;
  status?: string;
  called_at?: string;
  telegram_posts?: Array<{ chat_id?: string; message_id?: number }>;
};

type ChatRow = {
  chat_id: string;
  title?: string | null;
  username?: string | null;
  chat_type?: string | null;
  members?: number | null;
  status?: string;
};

type DeskSnap = {
  ok?: boolean;
  connected?: boolean;
  bot_username?: string | null;
  bot_name?: string | null;
  token_masked?: string;
  channel_id?: string | null;
  channel_title?: string | null;
  channel_username?: string | null;
  broadcast_groups?: boolean;
  armed?: boolean;
  last_tick_at?: string | null;
  last_agent_id?: string | null;
  last_error?: string | null;
  groups?: number;
  channels?: number;
  chats?: ChatRow[];
  calls?: CallRow[];
  error?: string;
  skipped?: string | null;
  disclaimer?: string;
  store?: string;
  applied?: { ok?: boolean; error?: string; via?: string };
  stats?: {
    calls?: number;
    open?: number;
    won?: number;
    lost?: number;
    win_rate?: number | null;
    avg_multiple_now?: number | null;
    avg_multiple_ath?: number | null;
    pnl_now?: number;
    pnl_ath?: number;
    best?: CallRow | null;
  };
};

async function callsApi(method: string, body?: Record<string, unknown>, query = "") {
  const admin = readDeskSessionToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (admin) headers.Authorization = `Bearer ${admin}`;
  const res = await fetch(`/api/orbitx-calls${query}`, {
    method,
    headers,
    cache: "no-store",
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as DeskSnap & { error?: string };
  if (!res.ok || json.ok === false) {
    throw new Error(String(json.error || `HTTP ${res.status}`));
  }
  return json;
}

function x(n: number | null | undefined, digits = 2) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(digits)}x`;
}

function ago(at?: string | null) {
  if (!at) return "never";
  const ms = Date.now() - Date.parse(at);
  if (!Number.isFinite(ms) || ms < 0) return at;
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3600_000) return `${Math.floor(ms / 60_000)}m ago`;
  return `${Math.floor(ms / 3600_000)}h ago`;
}

function pct(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(0)}%`;
}

export default function CallsDesk() {
  const [snap, setSnap] = useState<DeskSnap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [channel, setChannel] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await callsApi("GET");
      setSnap(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "load failed");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 12_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const run = async (label: string, fn: () => Promise<DeskSnap | void>) => {
    setBusy(label);
    setNote(null);
    setError(null);
    try {
      const out = await fn();
      if (out && Array.isArray(out.calls)) setSnap(out);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "request failed");
    } finally {
      setBusy(null);
    }
  };

  const stats = snap?.stats;
  const calls = snap?.calls || [];
  const best = stats?.best;
  const chats = (snap?.chats || []).filter((c) => c.status !== "left" && c.status !== "kicked");

  const statusTone = useMemo(() => {
    if (snap?.armed && snap?.connected) return "Live every 5 min";
    if (snap?.connected) return "Bot connected · alerts paused";
    return "Connect a bot to start";
  }, [snap?.armed, snap?.connected]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#020915] text-white">
      <div className="pointer-events-none absolute -top-40 left-[12%] h-[520px] w-[520px] rounded-full bg-og-lime/10 blur-[140px]" />
      <div className="pointer-events-none absolute top-40 right-0 h-[420px] w-[420px] rounded-full bg-og-cyan/10 blur-[120px]" />
      <div className="relative mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/40">Owner · /calls</p>
            <h1 className="mt-1 font-display text-3xl font-black tracking-tight">Calls desk</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/55">
              Connect your BotFather token here — not Vercel. NEON, WARDEN, and RAID scan the same /on-chain tape every 5
              minutes and push full-tape alerts. No commands. Channel + groups only.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-og-lime">
              {statusTone}
            </span>
            {snap?.store === "kv" ? (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-xl border border-og-gold/30 bg-og-gold/10 px-3 py-2 text-xs font-bold text-og-gold hover:border-og-gold/60"
                onClick={() => void run("sql", async () => {
                  const out = await callsApi("POST", { action: "apply_schema" });
                  setNote(out.applied?.ok ? "Postgres tables ready" : "Still on storage fallback — desk works either way");
                  return out;
                })}
                disabled={Boolean(busy)}
              >
                {busy === "sql" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Database className="h-3.5 w-3.5" />}
                Apply SQL
              </button>
            ) : null}
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-bold hover:border-og-lime/40"
              onClick={() => void run("scan", () => callsApi("POST", { action: "tick" }))}
              disabled={Boolean(busy)}
            >
              {busy === "scan" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Scan now
            </button>
          </div>
        </header>

        {error ? (
          <p className="rounded-xl border border-og-blood/30 bg-og-blood/10 px-4 py-3 text-sm text-red-300">
            {error === "admin_required"
              ? "Unlock the owner desk first, then open /calls."
              : error === "apply_ox_calls_desk_migration"
                ? "Click Apply SQL, or paste supabase/migrations/20260907180000_ox_calls_desk.sql in the Supabase SQL editor."
                : error}
          </p>
        ) : null}
        {note ? <p className="text-sm text-og-lime">{note}</p> : null}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon={Users} label="Groups" value={String(snap?.groups ?? 0)} hint="Bot is in" />
          <Stat icon={Bell} label="Channel" value={snap?.channel_title || "not linked"} hint={snap?.channel_username ? `@${snap.channel_username}` : "paste @channel"} />
          <Stat icon={Crosshair} label="Calls" value={String(stats?.calls ?? 0)} hint={`${stats?.open ?? 0} open · ${stats?.won ?? 0}W / ${stats?.lost ?? 0}L`} />
          <Stat icon={Trophy} label="Win rate" value={pct(stats?.win_rate)} hint={`ATH PnL ${stats?.pnl_ath != null ? `${stats.pnl_ath >= 0 ? "+" : ""}${stats.pnl_ath.toFixed(1)}x` : "—"}`} />
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="glass-card space-y-4 rounded-2xl border border-white/10 p-5">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-og-lime" />
              <h2 className="font-display text-lg">Telegram bot</h2>
            </div>
            {snap?.connected ? (
              <div className="space-y-3">
                <p className="text-sm text-white/70">
                  Connected <span className="text-white">@{snap.bot_username}</span>
                  {snap.token_masked ? <span className="ml-2 font-mono text-[10px] text-white/35">{snap.token_masked}</span> : null}
                </p>
                <p className="text-2xs text-white/40">Webhook is alert-only. Commands are ignored. Add the bot to groups/channel as admin so it can post.</p>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs text-white/70 hover:text-white"
                  onClick={() => void run("disconnect", async () => {
                    await callsApi("POST", { action: "disconnect" });
                    setNote("Bot disconnected");
                  })}
                >
                  <Unplug className="h-3.5 w-3.5" /> Disconnect
                </button>
              </div>
            ) : (
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run("connect", async () => {
                    const out = await callsApi("POST", { action: "connect", botToken: token.trim() });
                    setToken("");
                    setNote(`Connected @${out.bot_username || "bot"}`);
                    return out;
                  });
                }}
              >
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="BotFather token"
                  autoComplete="off"
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 font-mono text-sm outline-none focus:border-og-lime/50"
                />
                <button type="submit" className="rounded-xl bg-og-lime px-4 py-2.5 text-sm font-black text-black" disabled={!token.trim() || Boolean(busy)}>
                  {busy === "connect" ? "Connecting…" : "Connect bot"}
                </button>
              </form>
            )}
          </div>

          <div className="glass-card space-y-4 rounded-2xl border border-white/10 p-5">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-og-cyan" />
              <h2 className="font-display text-lg">Calls community</h2>
            </div>
            <p className="text-2xs text-white/40">Link the channel. Every call posts there. Optionally also every group the bot is in.</p>
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void run("channel", async () => {
                  const out = await callsApi("POST", { action: "channel", channel: channel.trim() });
                  setChannel("");
                  setNote(`Linked ${out.channel_title || "channel"}`);
                  return out;
                });
              }}
            >
              <input
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                placeholder="@channel or -100… chat id"
                className="min-w-[16rem] flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm outline-none focus:border-og-cyan/50"
              />
              <button type="submit" className="rounded-xl border border-white/10 px-4 py-2 text-sm font-bold" disabled={!channel.trim() || Boolean(busy)}>
                Link
              </button>
            </form>
            {snap?.channel_id ? (
              <button
                type="button"
                className="text-2xs text-white/40 underline hover:text-white"
                onClick={() => void run("unlink", () => callsApi("POST", { action: "unlink_channel" }))}
              >
                Unlink channel
              </button>
            ) : null}
            <label className="flex items-center gap-2 text-sm text-white/70">
              <input
                type="checkbox"
                checked={snap?.broadcast_groups !== false}
                onChange={(e) => void run("groups", () => callsApi("POST", { action: "settings", broadcast_groups: e.target.checked }))}
              />
              Also post to every group the bot is in
            </label>
            <label className="flex items-center gap-2 text-sm text-white/70">
              <input
                type="checkbox"
                checked={Boolean(snap?.armed)}
                onChange={(e) => void run("arm", () => callsApi("POST", { action: "settings", armed: e.target.checked }))}
              />
              <Radio className="h-3.5 w-3.5 text-og-lime" />
              Arm 5-minute agent alerts
            </label>
            <p className="text-[10px] uppercase tracking-wide text-white/35">
              Last tick {ago(snap?.last_tick_at)} · agent {snap?.last_agent_id || "—"}
              {snap?.last_error ? ` · ${snap.last_error}` : ""}
            </p>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          <Stat icon={Trophy} label="Best call" value={best?.symbol ? `$${best.symbol}` : "—"} hint={best ? `${x(best.multiple_ath)} ATH · called ${formatUsd(best.mc_at_call)}` : "No calls yet"} />
          <Stat icon={Crosshair} label="Avg now" value={x(stats?.avg_multiple_now)} hint={`Avg ATH ${x(stats?.avg_multiple_ath)}`} />
          <Stat icon={Bell} label="Paper PnL now" value={stats?.pnl_now != null ? `${stats.pnl_now >= 0 ? "+" : ""}${stats.pnl_now.toFixed(2)}x` : "—"} hint="Sum of (now / call MC − 1)" />
        </section>

        <section className="glass-card overflow-hidden rounded-2xl border border-white/10">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
            <h2 className="font-display text-lg">Call ledger</h2>
            <p className="text-[10px] uppercase tracking-wide text-white/35">MC at call · ATH · ATL · now</p>
          </div>
          {calls.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="font-mono text-[10px] uppercase tracking-widest text-white/35">
                  <tr>
                    <th className="px-4 py-2">Agent</th>
                    <th className="px-4 py-2">Token</th>
                    <th className="px-4 py-2">Called</th>
                    <th className="px-4 py-2">ATH</th>
                    <th className="px-4 py-2">ATL</th>
                    <th className="px-4 py-2">Now</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">CA</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map((c) => (
                    <tr key={c.id || c.mint} className="border-t border-white/5 align-top">
                      <td className="px-4 py-3 text-2xs text-white/50">{c.agent_name || c.agent_id}</td>
                      <td className="px-4 py-3">
                        <p className="font-bold">${c.symbol}</p>
                        <p className="mt-1 max-w-xs text-2xs leading-relaxed text-white/45">{c.thesis}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-2xs">
                        {formatUsd(c.mc_at_call)}
                        <div className="text-white/35">{ago(c.called_at)}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-2xs text-og-lime">
                        {formatUsd(c.mc_ath)} <span className="text-white/40">{x(c.multiple_ath)}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-2xs text-white/50">{formatUsd(c.mc_atl)}</td>
                      <td className="px-4 py-3 font-mono text-2xs">
                        {formatUsd(c.mc_now)} <span className="text-white/40">{x(c.multiple_now)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                            c.status === "won"
                              ? "bg-og-lime/15 text-og-lime"
                              : c.status === "lost"
                                ? "bg-og-blood/15 text-red-300"
                                : "bg-white/10 text-white/60"
                          }`}
                        >
                          {c.status}
                        </span>
                        <div className="mt-1 text-[10px] text-white/30">{c.telegram_posts?.length || 0} posts</div>
                      </td>
                      <td className="px-4 py-3">
                        {c.mint ? (
                          <div className="flex items-center gap-2">
                            <code className="text-[10px] text-white/40">{formatAddress(c.mint)}</code>
                            <CopyMintButton mint={c.mint} label="CA" copiedLabel="ok" className="rounded-full px-2 py-0.5 text-[10px]" iconClassName="h-3 w-3" />
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-5 py-8 text-sm text-white/40">No calls yet. Connect the bot, link the channel, arm alerts, or hit Scan now.</p>
          )}
        </section>

        {chats.length ? (
          <section className="glass-card rounded-2xl border border-white/10 p-5">
            <h2 className="font-display text-lg">Rooms the bot can post in</h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {chats.map((c) => (
                <li key={c.chat_id} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
                  <p className="font-bold">{c.title || c.chat_id}</p>
                  <p className="text-2xs text-white/40">
                    {c.chat_type || "chat"} · {c.members != null ? `${c.members} members` : c.chat_id}
                    {c.username ? ` · @${c.username}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <p className="pb-8 text-2xs text-white/30">{snap?.disclaimer}</p>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Bot;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="glass-card rounded-2xl border border-white/10 p-4">
      <div className="flex items-center gap-2 text-white/40">
        <Icon className="h-3.5 w-3.5" />
        <p className="font-mono text-[10px] uppercase tracking-widest">{label}</p>
      </div>
      <p className="mt-2 truncate font-display text-xl font-black">{value}</p>
      <p className="mt-1 text-2xs text-white/40">{hint}</p>
    </div>
  );
}
