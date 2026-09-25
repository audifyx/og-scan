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
  Download,
  FolderOpen,
  Inbox,
  ListChecks,
  Eye,
  RefreshCw,
  Play,
  Database,
  ExternalLink,
  CheckCircle2,
  Clock,
  ChevronLeft,
  Cpu,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

/* ── AgentPlus contract ────────────────────────────────────────────────
   FEED:    GET  /api/x-mcp?path=agentplus/feed&since=<id>&agent=<name>&limit=100
   COMMAND: POST /api/x-mcp?path=agentplus/command
            (spawn | task | send | remember | inbox | get | recall | tasks |
             files | file | think | models)   — read-only views pass quiet:true
   EXPORT:  GET  /api/x-mcp?path=agentplus/export&agent=<name>&kind=log|thoughts
                 (markdown download) | &kind=files|file&task_id=<id>[&path=<p>]
   Auth: Authorization: Bearer <supabase access_token>
   ────────────────────────────────────────────────────────────────────── */

const FEED_PATH = "/api/x-mcp?path=agentplus/feed";
const COMMAND_PATH = "/api/x-mcp?path=agentplus/command";
const EXPORT_PATH = "/api/x-mcp?path=agentplus/export";
const POLL_MS = 2000;
const DETAIL_POLL_MS = 10000;

type AgentEventKind = "thought" | "action" | "file" | "message" | "build" | "deploy" | "error";

interface AgentEvent {
  id: string | number;
  agent: string;
  kind: AgentEventKind | string;
  task_id?: string | null;
  body: string;
  created_at: string;
}

interface ThinkError {
  code: string;
  hint: string;
  at: string;
}

interface AgentInfo {
  name: string;
  status: string;
  unread: number;
  /** 'live' = agent has a real server-side LLM reasoning loop;
      'driver' = no LLM key configured; advances via deterministic tick
      steps driven by an external LLM through MCP tools. */
  mind?: "live" | "driver" | string;
  last_think_error?: ThinkError | null;
  thinks_today?: number;
  think_budget_per_day?: number;
}

interface AgentDetail {
  name: string;
  role?: string | null;
  persona?: string | null;
  capabilities?: string[];
  status: string;
  model?: string | null;
  mind?: string;
  thinks_today?: number;
  think_budget_per_day?: number;
  think_day?: string;
  last_think_at?: string | null;
  last_think_error?: ThinkError | null;
  next_think_at?: string | null;
  created_at?: string;
}

interface MemoryEntry {
  key: string;
  value: string;
  updated_at: string;
}

interface InboxMsg {
  id: number;
  from: string;
  to: string;
  via: string;
  body: string;
  created_at: string;
}

interface TaskStep {
  title: string;
  status: string;
  result?: string;
}

interface TaskInfo {
  id: string;
  title: string;
  kind: string;
  status: string;
  steps?: TaskStep[] | null;
  created_at: string;
}

interface TaskFile {
  path: string;
  version: number;
  size: number;
  sha256: string;
  updated_at?: string;
}

interface FeedResponse {
  ok: boolean;
  events?: AgentEvent[];
  agents?: AgentInfo[];
  nextCursor?: string | number | null;
}

interface ModelsProbe {
  ok: boolean;
  baseUrl?: string;
  defaultModel?: string;
  count?: number;
  models?: string[];
  error?: string;
  message?: string;
  hint?: string;
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

const STEP_ICON: Record<string, typeof CheckCircle2> = {
  complete: CheckCircle2,
  in_progress: Loader2,
  failed: AlertTriangle,
  skipped: X,
};

const stepColor = (s: string) =>
  s === "complete"
    ? "text-emerald-300"
    : s === "in_progress"
      ? "text-sky-300"
      : s === "failed"
        ? "text-red-300"
        : "text-zinc-500";

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

function taskProgress(t: TaskInfo): { done: number; total: number } {
  const steps = t.steps || [];
  const done = steps.filter((s) => s.status === "complete").length;
  return { done, total: steps.length };
}

const inputCls =
  "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-emerald-400/60 focus:ring-1 focus:ring-emerald-400/40";

const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-400/15 px-4 py-2 text-sm font-semibold text-emerald-300 ring-1 ring-emerald-400/40 transition hover:bg-emerald-400/25 disabled:opacity-50 disabled:cursor-not-allowed";

const cardCls = "rounded-xl border border-white/10 bg-white/[0.02] p-3";

function SectionTitle({ icon: Icon, children }: { icon?: typeof Zap; children: React.ReactNode }) {
  return (
    <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
      {Icon && <Icon size={12} />} {children}
    </h2>
  );
}

function ProgressBar({ done, total, barCls = "bg-emerald-400" }: { done: number; total: number; barCls?: string }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
        <div className={cn("h-full rounded-full transition-all", barCls)} style={{ width: `${pct}%` }} />
      </div>
      <span className="shrink-0 font-mono text-[10px] text-zinc-500">
        {done}/{total}
      </span>
    </div>
  );
}

function ThinkErrorBanner({ err, compact = false }: { err: ThinkError; compact?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border border-red-400/30 bg-red-400/10 text-red-300",
        compact ? "px-2 py-1 text-[10px]" : "px-3 py-2 text-xs",
      )}
      title={err.at ? `Last failure at ${formatTime(err.at)}` : undefined}
    >
      <AlertTriangle size={compact ? 12 : 14} className="mt-0.5 shrink-0" />
      <div className="min-w-0">
        <span className="font-mono font-bold">{err.code}</span>
        <span className="text-red-300/80"> — {err.hint}</span>
        {!compact && (
          <div className="mt-1 text-[11px] text-red-300/60">
            Probe available models below to pick one this key can actually call.
          </div>
        )}
      </div>
    </div>
  );
}

function MindBadge({ mind }: { mind?: string }) {
  const live = mind === "live";
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-black/40 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ring-1 ring-white/10"
      title={
        live
          ? "mind: live — this agent thinks on the server; its thoughts appear verbatim in the log stream"
          : mind === "driver"
            ? "mind: driver — no LLM key configured; this agent advances when driven via MCP by an external LLM"
            : "mind mode unknown"
      }
    >
      <span className="relative flex h-1.5 w-1.5">
        {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
        <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", live ? "bg-emerald-400" : "bg-zinc-500")} />
      </span>
      <span className={live ? "text-emerald-300" : "text-zinc-400"}>{live ? "live" : mind === "driver" ? "driver" : "?"}</span>
    </span>
  );
}

function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: typeof Bot;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2.5 px-6 py-10 text-center">
      <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10">
        <Icon size={26} className="text-zinc-500" />
      </div>
      <p className="text-sm font-semibold text-zinc-200">{title}</p>
      <p className="max-w-xs text-sm text-zinc-500">{body}</p>
      {action}
    </div>
  );
}

function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-zinc-500">
      <Loader2 size={18} className="animate-spin text-emerald-400" /> {label}
    </div>
  );
}
const AgentPlus = () => {
  const { user, loading: authLoading } = useAuth();

  /* ── feed state ── */
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [cursor, setCursor] = useState<string>("");
  const [feedState, setFeedState] = useState<"idle" | "loading" | "live" | "error">("idle");
  const [feedError, setFeedError] = useState<string | null>(null);
  const [followLive, setFollowLive] = useState(true);
  const [expandedFiles, setExpandedFiles] = useState<Set<string | number>>(new Set());

  /* ── selection + center tabs ── */
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [centerTab, setCenterTab] = useState<"stream" | "agent" | "tasks">("stream");

  /* ── agent detail state ── */
  const [detail, setDetail] = useState<AgentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [memEntries, setMemEntries] = useState<MemoryEntry[]>([]);
  const [inboxMsgs, setInboxMsgs] = useState<InboxMsg[]>([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxOpened, setInboxOpened] = useState(false);
  const [agentTasks, setAgentTasks] = useState<TaskInfo[]>([]);
  const [thinkBusy, setThinkBusy] = useState(false);
  const [dlBusy, setDlBusy] = useState<string | null>(null);

  /* ── tasks tab state ── */
  const [tasksLoading, setTasksLoading] = useState(false);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [taskFiles, setTaskFiles] = useState<TaskFile[]>([]);
  const [taskFilesLoading, setTaskFilesLoading] = useState(false);
  const [fileView, setFileView] = useState<{ path: string; content: string } | null>(null);
  const [fileViewLoading, setFileViewLoading] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  /* ── models probe state ── */
  const [modelsProbe, setModelsProbe] = useState<ModelsProbe | null>(null);
  const [modelsLoading, setModelsLoading] = useState(false);

  /* ── spawn form ── */
  const [showSpawn, setShowSpawn] = useState(false);
  const [spawnName, setSpawnName] = useState("");
  const [spawnRole, setSpawnRole] = useState("");
  const [spawnPersona, setSpawnPersona] = useState("");
  const [spawnBusy, setSpawnBusy] = useState(false);

  /* ── task console ── */
  const [consoleTab, setConsoleTab] = useState<"task" | "message">("task");
  const [taskInput, setTaskInput] = useState("");
  const [taskKind, setTaskKind] = useState<"website" | "research" | "general">("website");
  const [taskAgent, setTaskAgent] = useState("");
  const [taskBusy, setTaskBusy] = useState(false);

  /* ── message box ── */
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

  /* ── agent detail loading (auto-refreshes while the Agent tab is open) ── */
  const loadAgentDetail = useCallback(async (name: string, silent = false) => {
    if (!silent) setDetailLoading(true);
    setDetailError(null);
    try {
      const [g, r, t] = await Promise.all([
        postCommand({ action: "get", name, quiet: true }),
        postCommand({ action: "recall", name, key: "", quiet: true }),
        postCommand({ action: "tasks", name, quiet: true }),
      ]);
      setDetail(g.agent as AgentDetail);
      setMemEntries(Array.isArray(r.memory) ? (r.memory as MemoryEntry[]) : []);
      setAgentTasks((t.tasks || []) as TaskInfo[]);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Detail load failed");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if ((centerTab !== "agent" && centerTab !== "tasks") || !selectedAgent) return;
    setDetail(null);
    setMemEntries([]);
    setAgentTasks([]);
    setInboxMsgs([]);
    setInboxOpened(false);
    loadAgentDetail(selectedAgent);
    const t = window.setInterval(() => loadAgentDetail(selectedAgent, true), DETAIL_POLL_MS);
    return () => window.clearInterval(t);
  }, [centerTab, selectedAgent, loadAgentDetail]);

  const loadInbox = async (name: string) => {
    setInboxLoading(true);
    try {
      const j = await postCommand({ action: "inbox", name, quiet: true });
      setInboxMsgs((j.messages || []) as InboxMsg[]);
      setInboxOpened(true);
    } catch (err) {
      flash("err", err instanceof Error ? err.message : "Inbox load failed");
    } finally {
      setInboxLoading(false);
    }
  };

  const handleThinkNow = async (name: string) => {
    if (thinkBusy) return;
    setThinkBusy(true);
    try {
      const j = await postCommand({ action: "think", name });
      if (j.ok) flash("ok", `Think complete for ${name}${j.usedModel ? ` (${j.usedModel})` : ""}.`);
      else flash("err", `Think failed: ${j.error || "unknown"}`);
      await loadAgentDetail(name, true);
    } catch (err) {
      flash("err", err instanceof Error ? err.message : "Think failed");
    } finally {
      setThinkBusy(false);
    }
  };

  const downloadLog = async (name: string, kind: "log" | "thoughts") => {
    const key = `${name}:${kind}`;
    setDlBusy(key);
    try {
      const res = await authedFetch(`${EXPORT_PATH}&agent=${encodeURIComponent(name)}&kind=${kind}`);
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name}-${kind === "thoughts" ? "thoughts-only" : "full-log"}.md`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      flash("ok", `Downloaded ${a.download}.`);
    } catch (err) {
      flash("err", err instanceof Error ? err.message : "Download failed");
    } finally {
      setDlBusy(null);
    }
  };

  /* ── task detail (auto-refreshes file list while open) ── */
  const loadTaskFiles = useCallback(async (taskId: string) => {
    setTaskFilesLoading(true);
    try {
      const j = await postCommand({ action: "files", task_id: taskId, quiet: true });
      setTaskFiles((j.files || []) as TaskFile[]);
    } catch {
      /* keep stale list */
    } finally {
      setTaskFilesLoading(false);
    }
  }, []);

  const loadPreview = useCallback(async (task: TaskInfo, files: TaskFile[]) => {
    if (task.kind !== "website") {
      setPreviewHtml(null);
      setPreviewPath(null);
      return;
    }
    const idx = files.find((f) => f.path === "index.html") || files.find((f) => f.path.endsWith(".html"));
    if (!idx) {
      setPreviewHtml(null);
      setPreviewPath(null);
      return;
    }
    setPreviewLoading(true);
    try {
      const j = await postCommand({ action: "file", task_id: task.id, path: idx.path, quiet: true });
      setPreviewHtml(j.content as string);
      setPreviewPath(idx.path);
    } catch {
      setPreviewHtml(null);
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  const openTaskDetail = useCallback(
    async (task: TaskInfo) => {
      setOpenTaskId(task.id);
      setFileView(null);
      setPreviewHtml(null);
      setPreviewPath(null);
      const j = await postCommand({ action: "files", task_id: task.id, quiet: true }).catch(() => null);
      const files = ((j?.files || []) as TaskFile[]);
      setTaskFiles(files);
      if (task.kind === "website") await loadPreview(task, files);
    },
    [loadPreview],
  );

  useEffect(() => {
    if (!openTaskId) return;
    const t = window.setInterval(() => {
      postCommand({ action: "files", task_id: openTaskId, quiet: true })
        .then((j) => setTaskFiles((j.files || []) as TaskFile[]))
        .catch(() => {});
    }, DETAIL_POLL_MS);
    return () => window.clearInterval(t);
  }, [openTaskId]);

  const viewFile = async (taskId: string, path: string) => {
    setFileViewLoading(path);
    try {
      const j = await postCommand({ action: "file", task_id: taskId, path, quiet: true });
      setFileView({ path, content: j.content as string });
    } catch (err) {
      flash("err", err instanceof Error ? err.message : "File load failed");
    } finally {
      setFileViewLoading(null);
    }
  };

  /* ── models probe ── */
  const probeModels = async () => {
    setModelsLoading(true);
    try {
      const j = await postCommand({ action: "models" });
      setModelsProbe(j as ModelsProbe);
      if (!j.ok) flash("err", `Probe failed: ${j.error || "unknown"}`);
    } catch (err) {
      flash("err", err instanceof Error ? err.message : "Probe failed");
    } finally {
      setModelsLoading(false);
    }
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
      if (selectedAgent) loadAgentDetail(selectedAgent, true);
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
  const rosterErrorCount = agents.filter((a) => a.last_think_error).length;

  const taskEvents = (taskId: string, kind: string) => events.filter((e) => e.task_id === taskId && e.kind === kind);
  const taskDeployUrl = (taskId: string): string | null => {
    const ds = taskEvents(taskId, "deploy");
    if (!ds.length) return null;
    const urls = extractUrls(ds[ds.length - 1].body);
    return urls.length ? urls[0] : null;
  };
  const taskBuildStatus = (taskId: string): string | null => {
    const bs = taskEvents(taskId, "build");
    if (!bs.length) return null;
    return bs[bs.length - 1].body.slice(0, 140);
  };
  const tasksForTab: TaskInfo[] = agentTasks; // Agent tab shows the selected agent's tasks

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

  const selectAgent = (name: string | null) => {
    setSelectedAgent(name);
    setOpenTaskId(null);
    if (name) setCenterTab("agent");
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
  const openTask: TaskInfo | null = tasksForTab.find((t) => t.id === openTaskId) || null;

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
            {rosterErrorCount > 0 && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-red-400/10 px-2.5 py-1 text-[11px] font-semibold text-red-300 ring-1 ring-red-400/40"
                title="Agents whose last think failed"
              >
                <AlertTriangle size={11} /> {rosterErrorCount} agent{rosterErrorCount === 1 ? "" : "s"} failing
              </span>
            )}
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
          <aside className="flex flex-col gap-3 lg:max-h-[calc(100vh-140px)] lg:overflow-y-auto">
            <div className={cardCls}>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">Agents</h2>
                <span className="text-[11px] text-zinc-600">{agents.length}</span>
              </div>

              <button
                onClick={() => selectAgent(null)}
                className={cn(
                  "mb-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition",
                  selectedAgent === null ? "bg-emerald-400/10 text-emerald-200 ring-1 ring-emerald-400/30" : "text-zinc-300 hover:bg-white/5",
                )}
              >
                <Radio size={14} className="shrink-0 text-zinc-500" />
                <span className="font-medium">All agents</span>
              </button>

              <div className="max-h-64 space-y-1 overflow-y-auto lg:max-h-none">
                {agents.length === 0 && feedState === "live" && (
                  <p className="px-2 py-3 text-xs text-zinc-600">No agents yet — spawn one below.</p>
                )}
                {agents.map((a) => (
                  <div key={a.name}>
                    <button
                      onClick={() => selectAgent(selectedAgent === a.name ? null : a.name)}
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
                      <MindBadge mind={a.mind} />
                      {a.unread > 0 && (
                        <span className="rounded-full bg-emerald-400/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                          {a.unread}
                        </span>
                      )}
                    </button>
                    {a.last_think_error && (
                      <div className="mb-1 ml-4 mr-1">
                        <ThinkErrorBanner err={a.last_think_error} compact />
                      </div>
                    )}
                  </div>
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

            {/* LLM models diagnostic */}
            <div className={cardCls}>
              <SectionTitle icon={Cpu}>LLM models</SectionTitle>
              <p className="mb-2 text-[11px] leading-relaxed text-zinc-500">
                Probe which model IDs this key can actually call — NVIDIA NIM 404s at chat time for models not
                provisioned on the key's account. The key itself is never shown.
              </p>
              <button onClick={probeModels} disabled={modelsLoading} className={cn(btnPrimary, "w-full !py-1.5 text-xs")}>
                {modelsLoading ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
                Probe available models
              </button>
              {modelsProbe && (
                <div className="mt-2 rounded-lg bg-black/40 p-2 text-[11px] ring-1 ring-white/5">
                  {modelsProbe.ok ? (
                    <>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="font-mono text-zinc-400">{modelsProbe.count} models</span>
                        <span className="font-mono text-zinc-600">{modelsProbe.baseUrl?.replace("https://", "")}</span>
                      </div>
                      <div className="mb-1.5 text-zinc-500">
                        default: <span className="font-mono text-emerald-300">{modelsProbe.defaultModel}</span>
                      </div>
                      <div className="max-h-40 space-y-0.5 overflow-y-auto font-mono">
                        {(modelsProbe.models || []).map((m) => (
                          <div
                            key={m}
                            className={cn(
                              "truncate rounded px-1.5 py-0.5",
                              m === modelsProbe.defaultModel ? "bg-emerald-400/10 text-emerald-300" : "text-zinc-400",
                            )}
                            title={m}
                          >
                            {m === modelsProbe.defaultModel && "● "}
                            {m}
                          </div>
                        ))}
                      </div>
                      <p className="mt-1.5 text-zinc-600">
                        Set AGENT_LLM_MODEL to any listed ID in Vercel env to switch the mind's model.
                      </p>
                    </>
                  ) : (
                    <div className="text-red-300">
                      <span className="font-mono font-bold">{modelsProbe.error}</span>
                      {modelsProbe.message && <p className="mt-1 break-words text-red-300/70">{modelsProbe.message}</p>}
                      {modelsProbe.hint && <p className="mt-1 text-zinc-400">{modelsProbe.hint}</p>}
                    </div>
                  )}
                </div>
              )}
            </div>
          </aside>

          {/* CENTER — tabbed: stream / agent / tasks */}
          <section className="relative flex min-h-[420px] flex-col rounded-xl border border-white/10 bg-white/[0.02] lg:max-h-[calc(100vh-140px)]">
            <div className="flex items-center gap-1 border-b border-white/10 px-3 py-2">
              {(["stream", "agent", "tasks"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setCenterTab(t)}
                  disabled={t !== "stream" && !selectedAgent}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition",
                    centerTab === t
                      ? "bg-emerald-400/15 text-emerald-300"
                      : "text-zinc-500 hover:text-zinc-300 disabled:cursor-not-allowed disabled:opacity-40",
                  )}
                  title={t !== "stream" && !selectedAgent ? "Select an agent first" : undefined}
                >
                  {t === "stream" ? "Live stream" : t === "agent" ? "Agent" : "Tasks"}
                </button>
              ))}
              {selectedAgent && (
                <span className="ml-2 truncate font-mono text-[11px] text-emerald-300/80">{selectedAgent}</span>
              )}
              {centerTab === "stream" && selectedAgent && (
                <button onClick={() => setSelectedAgent(null)} className="ml-auto text-[11px] text-zinc-500 hover:text-zinc-300">
                  clear filter ×
                </button>
              )}
            </div>

            {centerTab === "stream" && (
              <>
                <div ref={streamRef} onScroll={handleStreamScroll} className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
                  {feedState === "loading" && events.length === 0 && <LoadingState label="Connecting to feed…" />}

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
                    <EmptyState
                      icon={Bot}
                      title={agents.length === 0 ? "No agents yet" : "No events yet"}
                      body={
                        agents.length === 0
                          ? "Spawn your first agent to get started — give it a name, a role, and a persona, then watch it work."
                          : `No events ${selectedAgent ? `for ${selectedAgent}` : "yet"} — agents will log here as they work.`
                      }
                      action={
                        agents.length === 0 ? (
                          <button onClick={() => setShowSpawn(true)} className={cn(btnPrimary, "text-xs")}>
                            <Plus size={14} /> Spawn your first agent
                          </button>
                        ) : undefined
                      }
                    />
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
              </>
            )}

            {centerTab === "agent" && (
              <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
                {!selectedAgent ? (
                  <EmptyState icon={Bot} title="No agent selected" body="Pick an agent from the roster to inspect its mind, memory, tasks, and files." />
                ) : detailLoading && !detail ? (
                  <LoadingState label={`Loading ${selectedAgent}…`} />
                ) : detailError && !detail ? (
                  <div className="flex flex-col items-center gap-3 py-10 text-center">
                    <AlertTriangle size={24} className="text-red-400" />
                    <p className="text-sm text-zinc-400">{detailError}</p>
                    <button onClick={() => loadAgentDetail(selectedAgent)} className={cn(btnPrimary, "!py-1.5 text-xs")}>
                      <RefreshCw size={14} /> Retry
                    </button>
                  </div>
                ) : detail ? (
                  <>
                    {/* identity header */}
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-mono text-lg font-bold text-zinc-100">{detail.name}</h3>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1",
                          detail.status === "active"
                            ? "bg-emerald-400/10 text-emerald-300 ring-emerald-400/40"
                            : "bg-zinc-500/10 text-zinc-400 ring-zinc-500/30",
                        )}
                      >
                        {detail.status}
                      </span>
                      <MindBadge mind={detail.mind} />
                      {detail.role && <span className="text-xs text-zinc-500">{detail.role}</span>}
                      <div className="ml-auto flex gap-1.5">
                        <button
                          onClick={() => handleThinkNow(detail.name)}
                          disabled={thinkBusy}
                          className={cn(btnPrimary, "!px-3 !py-1.5 text-xs")}
                          title="Force the server-side mind to think now"
                        >
                          {thinkBusy ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                          Think now
                        </button>
                        <button
                          onClick={() => loadAgentDetail(detail.name)}
                          className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-300 ring-1 ring-white/10 hover:bg-white/10"
                          title="Refresh detail"
                        >
                          <RefreshCw size={13} />
                        </button>
                      </div>
                    </div>

                    {/* last think error — prominent */}
                    {detail.last_think_error && <ThinkErrorBanner err={detail.last_think_error} />}

                    {/* think budget meter */}
                    <div className="rounded-lg bg-black/30 p-3 ring-1 ring-white/5">
                      <div className="mb-1.5 flex items-center justify-between text-[11px]">
                        <span className="font-semibold uppercase tracking-wider text-zinc-500">Think budget</span>
                        <span className="font-mono text-zinc-400">
                          {detail.thinks_today ?? 0} / {detail.think_budget_per_day ?? "—"} today
                        </span>
                      </div>
                      <ProgressBar done={detail.thinks_today ?? 0} total={detail.think_budget_per_day ?? 0} />
                      <div className="mt-1.5 flex justify-between text-[10px] text-zinc-600">
                        <span>last think: {detail.last_think_at ? formatTime(detail.last_think_at) : "never"}</span>
                        {detail.model && <span className="font-mono">model: {detail.model}</span>}
                      </div>
                    </div>

                    {/* persona */}
                    {detail.persona && (
                      <div className="rounded-lg bg-black/30 p-3 ring-1 ring-white/5">
                        <SectionTitle icon={Brain}>Persona</SectionTitle>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">{detail.persona}</p>
                      </div>
                    )}

                    {/* memory */}
                    <div className="rounded-lg bg-black/30 p-3 ring-1 ring-white/5">
                      <SectionTitle icon={Database}>Memory ({memEntries.length})</SectionTitle>
                      {memEntries.length === 0 ? (
                        <p className="text-xs text-zinc-600">Nothing remembered yet.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {memEntries.map((m) => (
                            <div key={m.key} className="rounded-md bg-white/[0.03] px-2.5 py-1.5 ring-1 ring-white/5">
                              <div className="font-mono text-[11px] font-semibold text-violet-300">{m.key}</div>
                              <div className="mt-0.5 break-words text-xs text-zinc-400">
                                {m.value.length > 220 ? m.value.slice(0, 220) + "…" : m.value}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* inbox */}
                    <div className="rounded-lg bg-black/30 p-3 ring-1 ring-white/5">
                      <div className="mb-2 flex items-center justify-between">
                        <SectionTitle icon={Inbox}>Inbox</SectionTitle>
                        {!inboxOpened && (
                          <button
                            onClick={() => loadInbox(detail.name)}
                            disabled={inboxLoading}
                            className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-zinc-300 ring-1 ring-white/10 hover:bg-white/10"
                          >
                            {inboxLoading ? <Loader2 size={12} className="animate-spin" /> : <Inbox size={12} />}
                            Load inbox
                          </button>
                        )}
                      </div>
                      {!inboxOpened ? (
                        <p className="text-xs text-zinc-600">
                          {agents.find((a) => a.name === detail.name)?.unread ?? 0} unread — loading marks direct
                          messages read.
                        </p>
                      ) : inboxMsgs.length === 0 ? (
                        <p className="text-xs text-zinc-600">Inbox is clear.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {inboxMsgs.map((m) => (
                            <div key={m.id} className="rounded-md bg-white/[0.03] px-2.5 py-1.5 ring-1 ring-white/5">
                              <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                                <span className="font-mono text-emerald-300">{m.from}</span>
                                <span>→ {m.via}</span>
                                <span className="ml-auto">{formatTime(m.created_at)}</span>
                              </div>
                              <p className="mt-1 whitespace-pre-wrap text-xs text-zinc-300">{m.body}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* tasks with plan steps */}
                    <div className="rounded-lg bg-black/30 p-3 ring-1 ring-white/5">
                      <SectionTitle icon={ListChecks}>Tasks ({agentTasks.length})</SectionTitle>
                      {agentTasks.length === 0 ? (
                        <p className="text-xs text-zinc-600">No tasks yet — dispatch one from the console.</p>
                      ) : (
                        <div className="space-y-2">
                          {agentTasks.map((t) => {
                            const p = taskProgress(t);
                            return (
                              <button
                                key={t.id}
                                onClick={() => {
                                  setCenterTab("tasks");
                                  openTaskDetail(t);
                                }}
                                className="block w-full rounded-lg bg-white/[0.03] p-2.5 text-left ring-1 ring-white/5 transition hover:bg-white/[0.06] hover:ring-white/15"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-200">{t.title}</span>
                                  <span className="shrink-0 rounded-full bg-black/40 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
                                    {t.kind}
                                  </span>
                                  <span
                                    className={cn(
                                      "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1",
                                      t.status === "done"
                                        ? "bg-emerald-400/10 text-emerald-300 ring-emerald-400/30"
                                        : t.status === "failed"
                                          ? "bg-red-400/10 text-red-300 ring-red-400/30"
                                          : "bg-sky-400/10 text-sky-300 ring-sky-400/30",
                                    )}
                                  >
                                    {t.status}
                                  </span>
                                </div>
                                {p.total > 0 && (
                                  <div className="mt-2">
                                    <ProgressBar done={p.done} total={p.total} />
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* downloads */}
                    <div className="rounded-lg bg-black/30 p-3 ring-1 ring-white/5">
                      <SectionTitle icon={Download}>Export</SectionTitle>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => downloadLog(detail.name, "log")}
                          disabled={dlBusy !== null}
                          className={cn(btnPrimary, "!px-3 !py-1.5 text-xs")}
                        >
                          {dlBusy === `${detail.name}:log` ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Download size={13} />
                          )}
                          full-log.md
                        </button>
                        <button
                          onClick={() => downloadLog(detail.name, "thoughts")}
                          disabled={dlBusy !== null}
                          className={cn(btnPrimary, "!px-3 !py-1.5 text-xs")}
                        >
                          {dlBusy === `${detail.name}:thoughts` ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Download size={13} />
                          )}
                          thoughts-only.md
                        </button>
                      </div>
                      <p className="mt-2 text-[11px] text-zinc-600">
                        Each agent's full log is downloadable as markdown. Workspace files live under the Tasks tab.
                      </p>
                    </div>
                  </>
                ) : null}
              </div>
            )}

            {centerTab === "tasks" && (
              <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
                {!selectedAgent ? (
                  <EmptyState icon={ListChecks} title="No agent selected" body="Pick an agent from the roster to see its tasks." />
                ) : openTask ? (
                  /* ── task detail ── */
                  <div className="space-y-3">
                    <button
                      onClick={() => {
                        setOpenTaskId(null);
                        setFileView(null);
                        setPreviewHtml(null);
                      }}
                      className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
                    >
                      <ChevronLeft size={14} /> All tasks
                    </button>

                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="min-w-0 flex-1 text-sm font-bold text-zinc-100">{openTask.title}</h3>
                      <span className="shrink-0 rounded-full bg-black/40 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
                        {openTask.kind}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1",
                          openTask.status === "done"
                            ? "bg-emerald-400/10 text-emerald-300 ring-emerald-400/30"
                            : openTask.status === "failed"
                              ? "bg-red-400/10 text-red-300 ring-red-400/30"
                              : "bg-sky-400/10 text-sky-300 ring-sky-400/30",
                        )}
                      >
                        {openTask.status}
                      </span>
                    </div>

                    {/* plan steps checklist */}
                    <div className="rounded-lg bg-black/30 p-3 ring-1 ring-white/5">
                      <SectionTitle icon={ListChecks}>Plan steps</SectionTitle>
                      {(openTask.steps || []).length === 0 ? (
                        <p className="text-xs text-zinc-600">No plan steps — the agent works this task freeform.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {(openTask.steps || []).map((s, i) => {
                            const Icon = STEP_ICON[s.status] || Clock;
                            return (
                              <div key={i} className="flex items-start gap-2 rounded-md bg-white/[0.03] px-2.5 py-1.5 ring-1 ring-white/5">
                                <Icon
                                  size={14}
                                  className={cn("mt-0.5 shrink-0", stepColor(s.status), s.status === "in_progress" && "animate-spin")}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs text-zinc-200">{s.title}</div>
                                  {s.result && (
                                    <div className="mt-0.5 break-words font-mono text-[10px] text-zinc-500">
                                      {s.result.slice(0, 200)}
                                      {s.result.length > 200 && "…"}
                                    </div>
                                  )}
                                </div>
                                <span className={cn("shrink-0 font-mono text-[10px]", stepColor(s.status))}>{s.status}</span>
                              </div>
                            );
                          })}
                          <ProgressBar done={taskProgress(openTask).done} total={taskProgress(openTask).total} />
                        </div>
                      )}
                    </div>

                    {/* build status + deploy url */}
                    <div className="rounded-lg bg-black/30 p-3 ring-1 ring-white/5">
                      <SectionTitle icon={Rocket}>Build & deploy</SectionTitle>
                      {(() => {
                        const build = taskBuildStatus(openTask.id);
                        const url = taskDeployUrl(openTask.id);
                        if (!build && !url)
                          return <p className="text-xs text-zinc-600">No builds or deploys logged for this task yet.</p>;
                        return (
                          <div className="space-y-2">
                            {build && (
                              <p className="break-words font-mono text-[11px] text-orange-200/90">
                                <span className="text-zinc-500">latest build: </span>
                                {build}
                              </p>
                            )}
                            {url && (
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-lg bg-lime-400/10 px-3 py-1.5 font-mono text-xs text-lime-300 ring-1 ring-lime-400/30 hover:bg-lime-400/20"
                              >
                                <ExternalLink size={13} /> {url}
                              </a>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {/* website preview */}
                    {openTask.kind === "website" && (
                      <div className="rounded-lg bg-black/30 p-3 ring-1 ring-white/5">
                        <SectionTitle icon={Eye}>Preview</SectionTitle>
                        {previewLoading ? (
                          <LoadingState label="Loading preview…" />
                        ) : previewHtml ? (
                          <>
                            <iframe
                              title={`Preview of ${previewPath}`}
                              sandbox="allow-scripts"
                              srcDoc={previewHtml}
                              className="h-96 w-full rounded-lg bg-white ring-1 ring-white/10"
                            />
                            <p className="mt-1.5 font-mono text-[10px] text-zinc-600">
                              rendering {previewPath} · sandboxed iframe · refreshes as files change
                            </p>
                          </>
                        ) : (
                          <p className="text-xs text-zinc-600">
                            No index.html yet — the preview appears here once the agent writes one.
                          </p>
                        )}
                      </div>
                    )}

                    {/* files */}
                    <div className="rounded-lg bg-black/30 p-3 ring-1 ring-white/5">
                      <div className="mb-2 flex items-center justify-between">
                        <SectionTitle icon={FolderOpen}>Workspace files ({taskFiles.length})</SectionTitle>
                        {taskFilesLoading && <Loader2 size={13} className="animate-spin text-zinc-500" />}
                      </div>
                      {taskFiles.length === 0 ? (
                        <p className="text-xs text-zinc-600">No files written yet.</p>
                      ) : (
                        <div className="space-y-1">
                          {taskFiles.map((f) => (
                            <div key={f.path}>
                              <button
                                onClick={() => (fileView?.path === f.path ? setFileView(null) : viewFile(openTask.id, f.path))}
                                className="flex w-full items-center gap-2 rounded-md bg-white/[0.03] px-2.5 py-1.5 text-left ring-1 ring-white/5 transition hover:bg-white/[0.06]"
                              >
                                {fileView?.path === f.path ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                <FileCode2 size={13} className="shrink-0 text-amber-300/80" />
                                <span className="min-w-0 flex-1 truncate font-mono text-xs text-zinc-200">{f.path}</span>
                                <span className="shrink-0 font-mono text-[10px] text-zinc-600">v{f.version}</span>
                                <span className="shrink-0 font-mono text-[10px] text-zinc-600">
                                  {(f.size / 1024).toFixed(1)}k
                                </span>
                              </button>
                              {fileView?.path === f.path && (
                                <pre className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-md bg-black/60 p-3 font-mono text-[11px] leading-relaxed text-zinc-300 ring-1 ring-white/5">
                                  {fileViewLoading === f.path ? "loading…" : fileView.content}
                                </pre>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      <p className="mt-2 text-[10px] text-zinc-600">auto-refreshes every 10s while open</p>
                    </div>
                  </div>
                ) : (
                  /* ── task list ── */
                  <>
                    {tasksLoading ? (
                      <LoadingState label="Loading tasks…" />
                    ) : tasksForTab.length === 0 ? (
                      <EmptyState
                        icon={ListChecks}
                        title="No tasks"
                        body={`${selectedAgent} has no tasks yet — dispatch one from the console on the right.`}
                      />
                    ) : (
                      <div className="space-y-2">
                        {tasksForTab.map((t) => {
                          const p = taskProgress(t);
                          const url = taskDeployUrl(t.id);
                          return (
                            <button
                              key={t.id}
                              onClick={() => openTaskDetail(t)}
                              className="block w-full rounded-lg border border-white/5 bg-black/30 p-3 text-left transition hover:border-white/15 hover:bg-black/50"
                            >
                              <div className="flex items-center gap-2">
                                <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-100">{t.title}</span>
                                <span className="shrink-0 rounded-full bg-black/40 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
                                  {t.kind}
                                </span>
                                <span
                                  className={cn(
                                    "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1",
                                    t.status === "done"
                                      ? "bg-emerald-400/10 text-emerald-300 ring-emerald-400/30"
                                      : t.status === "failed"
                                        ? "bg-red-400/10 text-red-300 ring-red-400/30"
                                        : "bg-sky-400/10 text-sky-300 ring-sky-400/30",
                                  )}
                                >
                                  {t.status}
                                </span>
                                <ChevronRight size={14} className="shrink-0 text-zinc-600" />
                              </div>
                              {p.total > 0 && (
                                <div className="mt-2">
                                  <ProgressBar done={p.done} total={p.total} />
                                </div>
                              )}
                              <div className="mt-1.5 flex items-center gap-3 text-[10px] text-zinc-600">
                                <span>{formatTime(t.created_at)}</span>
                                {url && (
                                  <span className="inline-flex items-center gap-1 font-mono text-lime-300/80">
                                    <Globe size={10} /> deployed
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </section>

          {/* RIGHT — task console */}
          <aside className="flex flex-col gap-3 lg:max-h-[calc(100vh-140px)] lg:overflow-y-auto">
            <div className={cardCls}>
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
            <div className={cardCls}>
              <SectionTitle>Recent activity</SectionTitle>
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
            <div className={cardCls}>
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
