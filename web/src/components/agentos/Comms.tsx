/* Agent OS v2 — Messages (lobby + DM threads) and Usage (token/cost telemetry). */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MessageSquare,
  Send,
  Loader2,
  RefreshCw,
  Inbox,
  Gauge,
  Sparkles,
  Clock3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type AgentInfo,
  type AgentEvent,
  type InboxMsg,
  type UsageResponse,
  postCommand,
  formatTime,
  fmtTokens,
  fmtMs,
} from "./api";
import { cardCls, btnPrimary, btnGhost, SectionTitle, EmptyState, LoadingState, MindBadge } from "./ui";

/* ── messages ── */

export function MessagesView({ agents, feedEvents, initialPeer, onSent }: {
  agents: AgentInfo[];
  feedEvents: AgentEvent[];
  initialPeer: string | null;
  onSent: () => void;
}) {
  const [peer, setPeer] = useState<string>(initialPeer || "lobby");
  const [inboxMsgs, setInboxMsgs] = useState<InboxMsg[]>([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialPeer) setPeer(initialPeer);
  }, [initialPeer]);

  const loadInbox = useCallback(async (name: string) => {
    setInboxLoading(true);
    try {
      const j = await postCommand({ action: "inbox", name, quiet: true });
      setInboxMsgs((j.messages || []) as InboxMsg[]);
    } catch {
      setInboxMsgs([]);
    } finally {
      setInboxLoading(false);
    }
  }, []);

  useEffect(() => {
    if (peer !== "lobby") loadInbox(peer);
  }, [peer, loadInbox]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [inboxMsgs, feedEvents, peer]);

  const lobbyMsgs = useMemo(
    () => feedEvents.filter((e) => e.kind === "message").sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 80),
    [feedEvents],
  );

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await postCommand({ action: "send", from: "user", to: peer, body: text });
      setBody("");
      if (peer !== "lobby") await loadInbox(peer);
      onSent();
    } catch {
      /* shell flashes the error */
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-220px)] min-h-[420px] gap-3">
      {/* thread list */}
      <div className="flex w-44 shrink-0 flex-col gap-1 overflow-y-auto rounded-xl border border-white/10 bg-white/[0.02] p-2 sm:w-52">
        <button
          onClick={() => setPeer("lobby")}
          className={cn(
            "flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition",
            peer === "lobby" ? "bg-emerald-400/10 text-emerald-200 ring-1 ring-emerald-400/30" : "text-zinc-300 hover:bg-white/5",
          )}
        >
          <MessageSquare size={14} className="shrink-0" />
          <span className="font-medium">Lobby</span>
          <span className="ml-auto text-[10px] text-zinc-600">all</span>
        </button>
        <div className="my-1 border-t border-white/5" />
        {agents.map((a) => (
          <button
            key={a.name}
            onClick={() => setPeer(a.name)}
            className={cn(
              "flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition",
              peer === a.name ? "bg-emerald-400/10 text-emerald-200 ring-1 ring-emerald-400/30" : "text-zinc-300 hover:bg-white/5",
            )}
          >
            <span className={cn("h-2 w-2 shrink-0 rounded-full", a.status === "active" ? "bg-emerald-400" : "bg-zinc-600")} />
            <span className="min-w-0 flex-1 truncate text-left font-mono text-xs">{a.name}</span>
            {a.unread > 0 && (
              <span className="rounded-full bg-emerald-400/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                {a.unread}
              </span>
            )}
          </button>
        ))}
        {agents.length === 0 && <p className="px-2 py-3 text-xs text-zinc-600">No agents yet.</p>}
      </div>

      {/* conversation */}
      <div className="flex min-w-0 flex-1 flex-col rounded-xl border border-white/10 bg-white/[0.02]">
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
          <h2 className="font-mono text-sm font-bold text-zinc-100">{peer === "lobby" ? "# lobby" : peer}</h2>
          {peer !== "lobby" && <MindBadge mind={agents.find((a) => a.name === peer)?.mind} />}
          <span className="ml-auto text-[11px] text-zinc-600">
            {peer === "lobby" ? "visible to every agent" : "wakes the agent's next think"}
          </span>
          {peer !== "lobby" && (
            <button onClick={() => loadInbox(peer)} disabled={inboxLoading} className={btnGhost} title="Reload thread">
              <RefreshCw size={12} className={inboxLoading ? "animate-spin" : ""} />
            </button>
          )}
        </div>

        <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
          {peer === "lobby" ? (
            lobbyMsgs.length === 0 ? (
              <EmptyState
                icon={MessageSquare}
                title="Lobby is quiet"
                body="Messages you send here reach every agent. Their replies and chatter appear in the activity stream."
              />
            ) : (
              lobbyMsgs.map((m) => (
                <div key={m.id} className="rounded-lg border border-white/5 bg-black/30 px-3 py-2">
                  <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                    <span className="font-mono text-emerald-300">{m.agent}</span>
                    <span className="ml-auto">{formatTime(m.created_at)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-200">{m.body}</p>
                </div>
              ))
            )
          ) : inboxLoading && inboxMsgs.length === 0 ? (
            <LoadingState label={`Loading thread with ${peer}…`} />
          ) : inboxMsgs.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title={`No messages with ${peer}`}
              body="Say hello — sending a message wakes the agent's mind on its next think."
            />
          ) : (
            inboxMsgs.map((m) => {
              const mine = m.from === "user";
              return (
                <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] rounded-xl px-3 py-2",
                      mine ? "bg-emerald-400/15 text-emerald-100 ring-1 ring-emerald-400/30" : "bg-black/40 text-zinc-200 ring-1 ring-white/10",
                    )}
                  >
                    {!mine && (
                      <div className="mb-0.5 font-mono text-[10px] text-emerald-300/80">{m.from}</div>
                    )}
                    <p className="whitespace-pre-wrap text-sm">{m.body}</p>
                    <div className="mt-1 text-right text-[10px] text-zinc-500">{formatTime(m.created_at)}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <form onSubmit={handleSend} className="flex gap-2 border-t border-white/10 p-3">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={peer === "lobby" ? "Broadcast to all agents…" : `Message ${peer}…`}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-emerald-400/60"
          />
          <button type="submit" disabled={sending || !body.trim()} className={cn(btnPrimary, "!px-4")}>
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ── usage ── */

function Sparkline({ data }: { data: { day: string; tokens: number }[] }) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.tokens), 1);
  const W = 280;
  const H = 56;
  const bw = W / data.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-14 w-full" role="img" aria-label="Daily token usage">
      {data.map((d, i) => {
        const h = Math.max(2, (d.tokens / max) * (H - 8));
        return (
          <rect
            key={d.day}
            x={i * bw + 1}
            y={H - h}
            width={Math.max(1, bw - 2)}
            height={h}
            rx={1.5}
            className="fill-emerald-400/70"
          >
            <title>{`${d.day}: ${fmtTokens(d.tokens)} tokens`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

export function UsageView() {
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const j = await postCommand({ action: "usage", quiet: true });
      setUsage(j as UsageResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Usage load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !usage) return <LoadingState label="Aggregating token usage…" />;
  if (error && !usage)
    return (
      <EmptyState
        icon={Gauge}
        title="Couldn't load usage"
        body={error}
        action={
          <button onClick={load} className={btnPrimary}>
            Retry
          </button>
        }
      />
    );

  const t = usage!.totals;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div>
          <h2 className="text-lg font-bold text-zinc-100">Usage</h2>
          <p className="text-[11px] text-zinc-500">token telemetry from every server-side think receipt</p>
        </div>
        <button onClick={load} disabled={loading} className={cn(btnGhost, "ml-auto")}>
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {/* totals */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className={cardCls}>
          <div className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-zinc-500">
            <Sparkles size={11} /> thinks
          </div>
          <div className="mt-1 text-2xl font-bold text-zinc-100">{t.thinks}</div>
        </div>
        <div className={cardCls}>
          <div className="text-[11px] uppercase tracking-wider text-zinc-500">total tokens</div>
          <div className="mt-1 text-2xl font-bold text-emerald-300">{fmtTokens(t.total_tokens)}</div>
          <div className="mt-0.5 font-mono text-[10px] text-zinc-500">
            {fmtTokens(t.prompt_tokens)} in · {fmtTokens(t.completion_tokens)} out
          </div>
        </div>
        <div className={cardCls}>
          <div className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-zinc-500">
            <Clock3 size={11} /> mind time
          </div>
          <div className="mt-1 text-2xl font-bold text-zinc-100">{fmtMs(t.ms)}</div>
          <div className="mt-0.5 font-mono text-[10px] text-zinc-500">
            {t.thinks > 0 ? `${fmtMs(t.ms / t.thinks)}/think` : "—"}
          </div>
        </div>
        <div className={cardCls}>
          <div className="text-[11px] uppercase tracking-wider text-zinc-500">last 14 days</div>
          <Sparkline data={usage!.daily} />
        </div>
      </div>

      {/* per-agent */}
      <div>
        <SectionTitle>Per agent</SectionTitle>
        {usage!.agents.length === 0 ? (
          <p className="text-xs text-zinc-600">No think receipts yet — usage appears after agents think.</p>
        ) : (
          <div className="space-y-2">
            {usage!.agents.map((a) => {
              const maxT = usage!.totals.total_tokens || 1;
              const inPct = t.total_tokens ? Math.round((a.prompt_tokens / maxT) * 100) : 0;
              const outPct = t.total_tokens ? Math.round((a.completion_tokens / maxT) * 100) : 0;
              return (
                <div key={a.agent} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold text-zinc-100">{a.agent}</span>
                    <span className="text-[11px] text-zinc-500">{a.thinks} thinks</span>
                    <span className="ml-auto font-mono text-sm font-bold text-emerald-300">{fmtTokens(a.total_tokens)}</span>
                    <span className="font-mono text-[10px] text-zinc-500">tokens</span>
                  </div>
                  <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-white/5">
                    <div className="h-full bg-violet-400/70" style={{ width: `${(a.prompt_tokens / maxT) * 100}%` }} title={`in: ${fmtTokens(a.prompt_tokens)}`} />
                    <div className="h-full bg-sky-400/70" style={{ width: `${(a.completion_tokens / maxT) * 100}%` }} title={`out: ${fmtTokens(a.completion_tokens)}`} />
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] text-zinc-500">
                    <span>
                      <span className="text-violet-300">■</span> in {fmtTokens(a.prompt_tokens)} ({inPct}%)
                    </span>
                    <span>
                      <span className="text-sky-300">■</span> out {fmtTokens(a.completion_tokens)} ({outPct}%)
                    </span>
                    <span className="font-mono">⏱ {fmtMs(a.ms)}</span>
                    {a.models.length > 0 && (
                      <span className="truncate font-mono" title={a.models.join(", ")}>
                        {a.models[0].split("/").pop()}
                        {a.models.length > 1 && ` +${a.models.length - 1}`}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <p className="text-[10px] text-zinc-600">
        Aggregated from server-side think receipts (kind='system' log entries). Tokens are what the fleet's minds
        actually consumed — the data behind them is free, the thinking isn't.
      </p>
    </div>
  );
}
