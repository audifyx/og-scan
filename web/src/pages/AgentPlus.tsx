import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Bot,
  Plus,
  Send,
  X,
  ChevronDown,
  ChevronRight,
  Rocket,
  FileCode2,
  Brain,
  Zap,
  Hammer,
  MessageSquare,
  AlertTriangle,
  ArrowDownToLine,
  Loader2,
  Radio,
  Globe,
  FlaskConical,
  LayoutTemplate,
  KeyRound,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

/* ── AgentPlus contract ────────────────────────────────────────────────
   FEED:    GET  /api/x-mcp?path=agentplus/feed&since=<id>&agent=<name>&limit=100
   COMMAND: POST /api/x-mcp?path=agentplus/command   (spawn | task | send)
   Auth: Authorization: Bearer <supabase access_token>
   ────────────────────────────────────────────────────────────────────── */

const FEED_PATH = "/api/x-mcp?path=agentplus/feed";
const COMMAND_PATH = "/api/x-mcp?path=agentplus/command";
const POLL_MS = 2000;

type AgentEventKind = "thought" | "action" | "file" | "message" | "build" | "deploy" | "error";

interface AgentEvent {
  id: string | number;
  agent: string;
  kind: AgentEventKind | string;
  task_id?: string | null;
  body: string;
  created_at: string;
}

interface AgentInfo {
  name: string;
  status: string;
  unread: number;
  /** 'live' = agent has a real server-side LLM reasoning loop;
      'driver' = no LLM key configured; advances via deterministic tick
      steps driven by an external LLM through MCP tools. */
  mind?: "live" | "driver" | string;
}

interface FeedResponse {
  ok: boolean;
  events?: AgentEvent[];
  agents?: AgentInfo[];
  nextCursor?: string | number | null;
}

const KIND_META: Record<string, { label: string; color: string; dot: string; Icon: typeof Zap }> = {
  thought: { label: "Thought", color: "text-violet-300", dot: "bg-violet-400", Icon: Brain },
  action: { label: "Action", color: "text-sky-300", dot: "bg-sky-400", Icon: Zap },
  file: { label: "File", color: "text-amber-300", dot: "bg-amber-400", Icon: FileCode2 },
  message: { label: "Message", color: "text-emerald-300", dot: "bg-emerald-400", Icon: MessageSquare },
  build: { label: "Build", color: "text-orange-300", dot: "bg-orange-400", Icon: Hammer },
  deploy: { label: "Deploy", color: "text-lime-300", dot: "bg-lime-400", Icon: Rocket },
  error: { label: "Error", color: "text-red-300", dot: "bg-red-400", Icon: AlertTriangle },
};

const kindMeta = (kind: string) =>
  KIND_META[kind] || { label: kind, color: "text-zinc-300", dot: "bg-zinc-500", Icon: Bot };

async function authedFetch(url: string, init?: RequestInit): Promise<Response> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  return fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

async function postCommand(body: Record<string, unknown>) {
  const res = await authedFetch(COMMAND_PATH, { method: "POST", body: JSON.stringify(body) });
  const ct = res.headers.get("content-type") || "";
  const json = ct.includes("application/json") ? await res.json().catch(() => ({})) : {};
  if (!res.ok) throw new Error(json?.error || `Command failed (${res.status})`);
  if (json && json.ok === false) throw new Error(json?.error || "Command rejected");
  return json;
}

function extractUrls(text: string): string[] {
  const m = text.match(/https?:\/\/[^\s)"'<>]+/g) || [];
  return [...new Set(m)];
}

function parseFileBody(body: string): { path: string; sha: string } | null {
  try {
    const j = JSON.parse(body);
    if (j && typeof j === "object" && (j.path || j.file)) {
      return { path: String(j.path || j.file), sha: String(j.sha || j.hash || "") };
    }
  } catch {
    /* not JSON */
  }
  const m = body.match(/([^\s]+\.[a-z0-9]+)\s*(?:@|:|#|\|)?\s*([0-9a-f]{7,40})?/i);
  if (m) return { path: m[1], sha: m[2] || "" };
  return null;
}

function formatTime(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  } catch {
    return ts;
  }
}

const inputCls =
  "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-emerald-400/60 focus:ring-1 focus:ring-emerald-400/40";

const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-400/15 px-4 py-2 text-sm font-semibold text-emerald-300 ring-1 ring-emerald-400/40 transition hover:bg-emerald-400/25 disabled:opacity-50 disabled:cursor-not-allowed";

const AgentPlus = () => {
  const { user, loading: authLoading } = useAuth();

  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [cursor, setCursor] = useState<string>("");
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [feedState, setFeedState] = useState<"idle" | "loading" | "live" | "error">("idle");
  const [feedError, setFeedError] = useState<string | null>(null);
  const [followLive, setFollowLive] = useState(true);
  const [expandedFiles, setExpandedFiles] = useState<Set<string | number>>(new Set());

  // spawn form
  const [showSpawn, setShowSpawn] = useState(false);
  const [spawnName, setSpawnName] = useState("");
  const [spawnRole, setSpawnRole] = useState("");
  const [spawnPersona, setSpawnPersona] = useState("");
  const [spawnBusy, setSpawnBusy] = useState(false);

  // task console
  const [consoleTab, setConsoleTab] = useState<"task" | "message">("task");
  const [taskInput, setTaskInput] = useState("");
  const [taskKind, setTaskKind] = useState<"website" | "research" | "general">("website");
  const [taskAgent, setTaskAgent] = useState("");
  const [taskBusy, setTaskBusy] = useState(false);

  // message box
  const [msgTo, setMsgTo] = useState("lobby");
  const [msgBody, setMsgBody] = useState("");
  const [msgBusy, setMsgBusy] = useState(false);

  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const cursorRef = useRef("");
  const followRef = useRef(true);
  const streamRef = useRef<HTMLDivElement>(null);
  const seenIds = useRef<Set<string | number>>(new Set());

  const flash = (kind: "ok" | "err", text: string) => {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice(null), 5000);
  };

  /* ── feed polling ── */
  const fetchFeed = useCallback(async (initial: boolean) => {
    try {
      const url = `${FEED_PATH}&since=${encodeURIComponent(cursorRef.current || "")}&limit=100`;
      const res = await authedFetch(url);
      const ct = res.headers.get("content-type") || "";
      if (!res.ok) throw new Error(`Feed request failed (${res.status})`);
      if (!ct.includes("application/json")) throw new Error("Feed endpoint not ready (non-JSON response)");
      const json = (await res.json()) as FeedResponse;
      if (json.ok === false) throw new Error("Feed returned ok:false");
      const fresh = (json.events || []).filter((e) => !seenIds.current.has(e.id));
      fresh.forEach((e) => seenIds.current.add(e.id));
      if (fresh.length) setEvents((prev) => [...prev, ...fresh]);
      if (json.agents) setAgents(json.agents);
      if (json.nextCursor !== undefined && json.nextCursor !== null) {
        cursorRef.current = String(json.nextCursor);
        setCursor(String(json.nextCursor));
      }
      setFeedState("live");
      setFeedError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Feed unavailable";
      setFeedError(msg);
      if (initial) setFeedState("error");
    }
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;
    setFeedState("loading");
    fetchFeed(true);
    const t = window.setInterval(() => fetchFeed(false), POLL_MS);
    return () => window.clearInterval(t);
  }, [authLoading, user, fetchFeed]);

  /* ── auto-scroll ── */
  useEffect(() => {
    if (followRef.current && streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  }, [events, feedState]);

  const handleStreamScroll = () => {
    const el = streamRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    followRef.current = nearBottom;
    setFollowLive(nearBottom);
  };

  const jumpToLive = () => {
    followRef.current = true;
    setFollowLive(true);
    if (streamRef.current) streamRef.current.scrollTop = streamRef.current.scrollHeight;
  };

  const toggleFile = (id: string | number) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /* ── commands ── */
  const refreshRoster = async () => {
    seenIds.current.clear();
    cursorRef.current = "";
    setEvents([]);
    setFeedState("loading");
    await fetchFeed(true);
  };

  const handleSpawn = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = spawnName.trim();
    if (!name || spawnBusy) return;
    setSpawnBusy(true);
    try {
      await postCommand({ action: "spawn", name, role: spawnRole.trim(), persona: spawnPersona.trim() });
      flash("ok", `Agent "${name}" spawning — watch the stream.`);
      setSpawnName("");
      setSpawnRole("");
      setSpawnPersona("");
      setShowSpawn(false);
      await refreshRoster();
    } catch (err) {
      flash("err", err instanceof Error ? err.message : "Spawn failed");
    } finally {
      setSpawnBusy(false);
    }
  };

  const handleTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const instructions = taskInput.trim();
    if (!instructions || taskBusy) return;
    setTaskBusy(true);
    try {
      const title = instructions.length > 70 ? instructions.slice(0, 70) + "…" : instructions;
      await postCommand({
        action: "task",
        name: taskAgent || undefined,
        title,
        kind: taskKind,
        instructions,
      });
      flash("ok", "Task dispatched — agents will pick it up.");
      setTaskInput("");
    } catch (err) {
      flash("err", err instanceof Error ? err.message : "Task dispatch failed");
    } finally {
      setTaskBusy(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = msgBody.trim();
    if (!body || msgBusy) return;
    setMsgBusy(true);
    try {
      await postCommand({ action: "send", from: "user", to: msgTo, body });
      flash("ok", `Message sent to ${msgTo}.`);
      setMsgBody("");
    } catch (err) {
      flash("err", err instanceof Error ? err.message : "Send failed");
    } finally {
      setMsgBusy(false);
    }
  };

  /* ── derived ── */
  const filtered = selectedAgent ? events.filter((e) => e.agent === selectedAgent) : events;
  const deploys = events.filter((e) => e.kind === "deploy");
  const kindCounts = events.slice(-200).reduce<Record<string, number>>((acc, e) => {
    acc[e.kind] = (acc[e.kind] || 0) + 1;
    return acc;
  }, {});

  const renderBody = (ev: AgentEvent) => {
    if (ev.kind === "deploy") {
      const urls = extractUrls(ev.body);
      if (urls.length) {
        return (
          <div className="space-y-1">
            <p className="whitespace-pre-wrap break-words">{ev.body}</p>
            {urls.map((u) => (
              <a
                key={u}
                href={u}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md bg-lime-400/10 px-2 py-1 font-mono text-xs text-lime-300 ring-1 ring-lime-400/30 hover:bg-lime-400/20"
              >
                <Globe size={12} /> {u}
              </a>
            ))}
          </div>
        );
      }
    }
    if (ev.kind === "file") {
      const parsed = parseFileBody(ev.body);
      const open = expandedFiles.has(ev.id);
      return (
        <div>
          <button
            onClick={() => toggleFile(ev.id)}
            className="flex w-full items-center gap-1.5 text-left font-mono text-xs text-amber-200 hover:text-amber-100"
          >
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <FileCode2 size={13} className="shrink-0" />
            <span className="truncate">{parsed?.path || ev.body.slice(0, 80)}</span>
          </button>
          {open && (
            <div className="mt-1.5 rounded-md bg-black/50 p-2.5 font-mono text-[11px] leading-relaxed text-zinc-300 ring-1 ring-white/5">
              <div className="break-all text-amber-200/90">{parsed?.path || "(no path parsed)"}</div>
              {parsed?.sha && <div className="mt-1 text-zinc-500">sha: {parsed.sha}</div>}
              <pre className="mt-2 whitespace-pre-wrap break-words text-zinc-400">{ev.body}</pre>
            </div>
          )}
        </div>
      );
    }
    return <p className="whitespace-pre-wrap break-words">{ev.body}</p>;
  };

  /* ── auth / loading shells ── */
  if (authLoading) {
    return (
      <AppLayout>
        <div className="flex min-h-[60vh] items-center justify-center bg-[#04070f]">
          <Loader2 className="animate-spin text-emerald-400" size={28} />
        </div>
      </AppLayout>
    );
  }

  if (!user) {
    return (
      <AppLayout>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 bg-[#04070f] px-6 text-center">
          <div className="rounded-2xl bg-emerald-400/10 p-4 ring-1 ring-emerald-400/30">
            <Bot size={32} className="text-emerald-300" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-100">AgentPlus</h1>
          <p className="max-w-sm text-sm text-zinc-400">
            Spawn autonomous agents and watch them build in real time. Sign in to access your agent fleet.
          </p>
          <Link to="/auth" className={btnPrimary}>
            <KeyRound size={16} /> Sign in
          </Link>
        </div>
      </AppLayout>
    );
  }

  const online = feedState === "live";

  return (
    <AppLayout>
      <div className="flex min-h-screen flex-col bg-[#04070f] text-zinc-100">
        {/* ── header ── */}
        <header className="sticky top-0 z-10 border-b border-white/10 bg-[#04070f]/90 backdrop-blur">
          <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-3">
            <div className="rounded-lg bg-emerald-400/10 p-1.5 ring-1 ring-emerald-400/30">
              <Bot size={20} className="text-emerald-300" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">AgentPlus</h1>
            <span className="hidden text-xs text-zinc-500 sm:inline">autonomous agent fleet</span>
            <div className="ml-auto flex items-center gap-3">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1",
                  online
                    ? "bg-emerald-400/10 text-emerald-300 ring-emerald-400/40"
                    : "bg-zinc-500/10 text-zinc-400 ring-zinc-500/30",
                )}
              >
                <span className="relative flex h-2 w-2">
                  {online && (
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  )}
                  <span
                    className={cn("relative inline-flex h-2 w-2 rounded-full", online ? "bg-emerald-400" : "bg-zinc-500")}
                  />
                </span>
                {online ? "LIVE" : feedState === "loading" ? "CONNECTING" : "OFFLINE"}
              </span>
              <span className="hidden text-[11px] text-zinc-600 md:inline" title={cursor ? `cursor ${cursor}` : undefined}>
                {feedError ? <span className="text-red-400">{feedError}</span> : `${events.length} events`}
              </span>
            </div>
          </div>
          {notice && (
            <div
              className={cn(
                "border-t px-4 py-2 text-xs",
                notice.kind === "ok"
                  ? "border-emerald-400/20 bg-emerald-400/5 text-emerald-300"
                  : "border-red-400/20 bg-red-400/5 text-red-300",
              )}
            >
              {notice.text}
            </div>
          )}
        </header>

        {/* ── three columns ── */}
        <div className="mx-auto grid w-full max-w-[1600px] flex-1 grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-[260px_minmax(0,1fr)_320px]">
          {/* LEFT — roster */}
          <aside className="flex flex-col gap-3 lg:max-h-[calc(100vh-140px)]">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">Agents</h2>
                <span className="text-[11px] text-zinc-600">{agents.length}</span>
              </div>

              <button
                onClick={() => setSelectedAgent(null)}
                className={cn(
                  "mb-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition",
                  selectedAgent === null ? "bg-emerald-400/10 text-emerald-200 ring-1 ring-emerald-400/30" : "text-zinc-300 hover:bg-white/5",
                )}
              >
                <Radio size={14} className="shrink-0 text-zinc-500" />
                <span className="font-medium">All agents</span>
              </button>

              <div className="max-h-64 space-y-1 overflow-y-auto lg:max-h-none lg:flex-1">
                {agents.map((a) => (
                  <button
                    key={a.name}
                    onClick={() => setSelectedAgent((cur) => (cur === a.name ? null : a.name))}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition",
                      selectedAgent === a.name
                        ? "bg-emerald-400/10 text-emerald-200 ring-1 ring-emerald-400/30"
                        : "text-zinc-300 hover:bg-white/5",
                    )}
                  >
                    <span
                      className={cn(
                        "h-2 w-2 shrink-0 rounded-full",
                        a.status === "active" ? "bg-emerald-400" : "bg-zinc-600",
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate text-left font-medium">{a.name}</span>
                    <span
                      className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-black/40 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ring-1 ring-white/10"
                      title={
                        a.mind === "live"
                          ? "mind: live — this agent thinks on the server; its thoughts appear verbatim in the log stream"
                          : a.mind === "driver"
                            ? "mind: driver — no LLM key configured; this agent advances when driven via MCP by an external LLM"
                            : "mind mode unknown"
                      }
                    >
                      <span className="relative flex h-1.5 w-1.5">
                        {a.mind === "live" && (
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                        )}
                        <span
                          className={cn(
                            "relative inline-flex h-1.5 w-1.5 rounded-full",
                            a.mind === "live" ? "bg-emerald-400" : "bg-zinc-500",
                          )}
                        />
                      </span>
                      <span className={a.mind === "live" ? "text-emerald-300" : "text-zinc-400"}>
                        {a.mind === "live" ? "live" : a.mind === "driver" ? "driver" : "?"}
                      </span>
                    </span>
                    {a.unread > 0 && (
                      <span className="rounded-full bg-emerald-400/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                        {a.unread}
                      </span>
                    )}
                  </button>
                ))}

              {/* mind mode legend */}
              {agents.length > 0 && (
                <div className="mt-2 rounded-lg bg-black/30 p-2 text-[10px] leading-relaxed text-zinc-500 ring-1 ring-white/5">
                  <div className="mb-1 flex items-center gap-1.5 font-semibold text-zinc-400">
                    <Brain size={10} /> Mind mode
                  </div>
                  <p>
                    <span className="font-semibold text-emerald-300">live</span> = this agent thinks on the server;
                    its thoughts appear verbatim in the log stream.
                  </p>
                  <p className="mt-0.5">
                    <span className="font-semibold text-zinc-300">driver</span> = no LLM key configured; advances
                    when driven via MCP by an external LLM.
                  </p>
                </div>
              )}
              </div>

              <button onClick={() => setShowSpawn((s) => !s)} className={cn(btnPrimary, "mt-3 w-full !px-3 !py-1.5 text-xs")}>
                {showSpawn ? <X size={14} /> : <Plus size={14} />}
                {showSpawn ? "Cancel" : "New agent"}
              </button>

              {showSpawn && (
                <form onSubmit={handleSpawn} className="mt-3 space-y-2 border-t border-white/10 pt-3">
                  <input
                    className={inputCls}
                    placeholder="Agent name *"
                    value={spawnName}
                    onChange={(e) => setSpawnName(e.target.value)}
                    required
                  />
                  <input
                    className={inputCls}
                    placeholder="Role (e.g. frontend builder)"
                    value={spawnRole}
                    onChange={(e) => setSpawnRole(e.target.value)}
                  />
                  <textarea
                    className={cn(inputCls, "min-h-[64px] resize-y")}
                    placeholder="Persona / instructions"
                    value={spawnPersona}
                    onChange={(e) => setSpawnPersona(e.target.value)}
                  />
                  <button type="submit" disabled={spawnBusy || !spawnName.trim()} className={cn(btnPrimary, "w-full !py-1.5 text-xs")}>
                    {spawnBusy ? <Loader2 size={14} className="animate-spin" /> : <Bot size={14} />}
                    Spawn agent
                  </button>
                </form>
              )}
            </div>
          </aside>

          {/* CENTER — live stream */}
          <section className="relative flex min-h-[420px] flex-col rounded-xl border border-white/10 bg-white/[0.02] lg:max-h-[calc(100vh-140px)]">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
              <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
                Live stream {selectedAgent && <span className="text-emerald-300">· {selectedAgent}</span>}
              </h2>
              {selectedAgent && (
                <button onClick={() => setSelectedAgent(null)} className="text-[11px] text-zinc-500 hover:text-zinc-300">
                  clear filter ×
                </button>
              )}
            </div>

            <div ref={streamRef} onScroll={handleStreamScroll} className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
              {feedState === "loading" && events.length === 0 && (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="animate-spin text-emerald-400" size={24} />
                </div>
              )}

              {feedState === "error" && events.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                  <AlertTriangle size={24} className="text-red-400" />
                  <p className="max-w-xs text-sm text-zinc-400">
                    Couldn't reach the AgentPlus feed. The backend may still be deploying.
                  </p>
                  <p className="max-w-xs font-mono text-[11px] text-zinc-600">{feedError}</p>
                  <button onClick={() => refreshRoster()} className={cn(btnPrimary, "!py-1.5 text-xs")}>
                    Retry
                  </button>
                </div>
              )}

              {feedState !== "loading" && feedState !== "error" && filtered.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                  <div className="rounded-2xl bg-emerald-400/10 p-4 ring-1 ring-emerald-400/30">
                    <Bot size={28} className="text-emerald-300" />
                  </div>
                  {agents.length === 0 ? (
                    <>
                      <p className="text-sm font-semibold text-zinc-200">No agents yet</p>
                      <p className="max-w-xs text-sm text-zinc-500">
                        Spawn your first agent to get started — give it a name, a role, and a persona, then watch it work.
                      </p>
                      <button onClick={() => setShowSpawn(true)} className={cn(btnPrimary, "text-xs")}>
                        <Plus size={14} /> Spawn your first agent
                      </button>
                    </>
                  ) : (
                    <p className="max-w-xs text-sm text-zinc-500">
                      No events {selectedAgent ? `for ${selectedAgent}` : "yet"} — agents will log here as they work.
                    </p>
                  )}
                </div>
              )}

              {filtered.map((ev) => {
                const meta = kindMeta(ev.kind);
                const Icon = meta.Icon;
                return (
                  <div key={ev.id} className="flex gap-2.5 rounded-lg border border-white/5 bg-black/30 px-3 py-2.5">
                    <div className="flex flex-col items-center pt-0.5">
                      <span className={cn("rounded-md bg-white/5 p-1.5", meta.color)}>
                        <Icon size={14} />
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                        <span className={cn("font-semibold", meta.color)}>{meta.label}</span>
                        <span className="font-mono text-zinc-400">{ev.agent}</span>
                        {ev.task_id && <span className="font-mono text-zinc-600">#{String(ev.task_id).slice(0, 8)}</span>}
                        <span className="ml-auto shrink-0 text-zinc-600">{formatTime(ev.created_at)}</span>
                      </div>
                      <div className="mt-1 text-sm text-zinc-200">{renderBody(ev)}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {!followLive && filtered.length > 0 && (
              <button
                onClick={jumpToLive}
                className="absolute bottom-4 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-emerald-400 px-4 py-1.5 text-xs font-bold text-black shadow-lg transition hover:bg-emerald-300"
              >
                <ArrowDownToLine size={14} /> Jump to live
              </button>
            )}
          </section>

          {/* RIGHT — task console */}
          <aside className="flex flex-col gap-3 lg:max-h-[calc(100vh-140px)] lg:overflow-y-auto">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <div className="mb-2 flex gap-1 rounded-lg bg-black/40 p-1">
                {(["task", "message"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setConsoleTab(t)}
                    className={cn(
                      "flex-1 rounded-md px-2 py-1 text-xs font-semibold capitalize transition",
                      consoleTab === t ? "bg-emerald-400/15 text-emerald-300" : "text-zinc-500 hover:text-zinc-300",
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {consoleTab === "task" ? (
                <form onSubmit={handleTask} className="space-y-2">
                  <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">Dispatch task</h2>
                  <textarea
                    className={cn(inputCls, "min-h-[84px] resize-y")}
                    placeholder="build me a website about…"
                    value={taskInput}
                    onChange={(e) => setTaskInput(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <select value={taskKind} onChange={(e) => setTaskKind(e.target.value as typeof taskKind)} className={cn(inputCls, "flex-1")}>
                      <option value="website">Website</option>
                      <option value="research">Research</option>
                      <option value="general">General</option>
                    </select>
                    <select value={taskAgent} onChange={(e) => setTaskAgent(e.target.value)} className={cn(inputCls, "flex-1")}>
                      <option value="">Auto-assign</option>
                      {agents
                        .filter((a) => a.status === "active")
                        .map((a) => (
                          <option key={a.name} value={a.name}>
                            {a.name}
                          </option>
                        ))}
                    </select>
                  </div>
                  <button type="submit" disabled={taskBusy || !taskInput.trim()} className={cn(btnPrimary, "w-full")}>
                    {taskBusy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    Assign task
                  </button>
                </form>
              ) : (
                <form onSubmit={handleSend} className="space-y-2">
                  <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">Send message</h2>
                  <select value={msgTo} onChange={(e) => setMsgTo(e.target.value)} className={inputCls}>
                    <option value="lobby">Lobby (all agents)</option>
                    {agents.map((a) => (
                      <option key={a.name} value={a.name}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                  <textarea
                    className={cn(inputCls, "min-h-[84px] resize-y")}
                    placeholder="Message to agents…"
                    value={msgBody}
                    onChange={(e) => setMsgBody(e.target.value)}
                  />
                  <button type="submit" disabled={msgBusy || !msgBody.trim()} className={cn(btnPrimary, "w-full")}>
                    {msgBusy ? <Loader2 size={14} className="animate-spin" /> : <MessageSquare size={14} />}
                    Send
                  </button>
                </form>
              )}
            </div>

            {/* recent activity */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">Recent activity</h2>
              {events.length === 0 ? (
                <p className="text-xs text-zinc-600">Nothing logged yet.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(kindCounts).map(([kind, n]) => {
                    const meta = kindMeta(kind);
                    return (
                      <span
                        key={kind}
                        className="inline-flex items-center gap-1 rounded-full bg-black/40 px-2 py-1 text-[11px] ring-1 ring-white/10"
                      >
                        <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                        <span className="text-zinc-300">{n}</span>
                        <span className="text-zinc-500">{meta.label.toLowerCase()}s</span>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            {/* deploy links */}
            {deploys.length > 0 && (
              <div className="rounded-xl border border-lime-400/20 bg-lime-400/[0.03] p-3">
                <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-lime-300/80">
                  <Rocket size={12} /> Deploys
                </h2>
                <div className="space-y-1.5">
                  {deploys.slice(-5).reverse().map((ev) => {
                    const urls = extractUrls(ev.body);
                    return (
                      <div key={ev.id} className="rounded-lg bg-black/40 p-2 text-xs">
                        <div className="mb-1 flex items-center gap-2 text-[11px] text-zinc-500">
                          <span className="font-mono text-zinc-400">{ev.agent}</span>
                          <span className="ml-auto">{formatTime(ev.created_at)}</span>
                        </div>
                        {urls.length ? (
                          urls.map((u) => (
                            <a
                              key={u}
                              href={u}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 truncate font-mono text-lime-300 hover:underline"
                            >
                              <Globe size={11} className="shrink-0" /> {u}
                            </a>
                          ))
                        ) : (
                          <p className="truncate text-zinc-400">{ev.body.slice(0, 90)}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* kind legend */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
                <FlaskConical size={12} /> Event kinds
              </h2>
              <div className="grid grid-cols-2 gap-1">
                {Object.entries(KIND_META).map(([kind, meta]) => (
                  <span key={kind} className="inline-flex items-center gap-1.5 text-[11px] text-zinc-400">
                    <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                    {meta.label}
                  </span>
                ))}
              </div>
              <p className="mt-2 flex items-center gap-1 text-[10px] text-zinc-600">
                <LayoutTemplate size={10} /> Polling feed every 2s · cursor {cursor ? cursor.slice(0, 12) : "—"}
              </p>
            </div>
          </aside>
        </div>
      </div>
    </AppLayout>
  );
};

export default AgentPlus;
