/* Agent OS v2 — the /agentplus command center. agent-os-v2
   Full-screen ops console: rail nav (Fleet, Activity, Tasks, Files,
   Messages, Usage), right inspector panel, Cmd+K palette, spawn wizard,
   "while you were away" digest, token usage telemetry. */
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Bot,
  Plus,
  Radio,
  ListChecks,
  FolderOpen,
  MessageSquare,
  Gauge,
  AlertTriangle,
  Loader2,
  KeyRound,
  Search,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  AGENT_OS_VERSION,
  LAST_VISIT_KEY,
  POLL_MS,
  FEED_PATH,
  type AgentInfo,
  type AgentEvent,
  type TaskInfo,
  type DigestResponse,
  authedFetch,
  postCommand,
  activeRoster,
  fleetTasks,
  rosterKey,
  type FeedResponse,
} from "@/components/agentos/api";
import { btnPrimary, btnGhost } from "@/components/agentos/ui";
import { Fleet } from "@/components/agentos/Fleet";
import { Activity } from "@/components/agentos/Activity";
import { TasksView } from "@/components/agentos/TasksView";
import { FilesView } from "@/components/agentos/FilesView";
import { MessagesView, UsageView } from "@/components/agentos/Comms";
import {
  DigestBanner,
  SpawnWizard,
  DispatchModal,
  CommandPalette,
  Inspector,
  type Selection,
} from "@/components/agentos/Overlays";

type ViewId = "fleet" | "activity" | "tasks" | "files" | "messages" | "usage";

const VIEWS: { id: ViewId; label: string; Icon: typeof Bot }[] = [
  { id: "fleet", label: "Fleet", Icon: Bot },
  { id: "activity", label: "Activity", Icon: Radio },
  { id: "tasks", label: "Tasks", Icon: ListChecks },
  { id: "files", label: "Files", Icon: FolderOpen },
  { id: "messages", label: "Messages", Icon: MessageSquare },
  { id: "usage", label: "Usage", Icon: Gauge },
];

const AgentPlus = () => {
  const { user, loading: authLoading } = useAuth();

  /* ── feed state (the heartbeat) ── */
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [cursor, setCursor] = useState<string>("");
  const [feedState, setFeedState] = useState<"idle" | "loading" | "live" | "error">("idle");
  const [feedError, setFeedError] = useState<string | null>(null);
  const [expandedFiles, setExpandedFiles] = useState<Set<string | number>>(new Set());

  /* ── shell state ── */
  const [view, setView] = useState<ViewId>("fleet");
  const [selection, setSelection] = useState<Selection>(null);
  const [allTasks, setAllTasks] = useState<TaskInfo[]>([]);
  const [digest, setDigest] = useState<DigestResponse | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [spawnOpen, setSpawnOpen] = useState(false);
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [dispatchAgent, setDispatchAgent] = useState<string | undefined>(undefined);
  const [thinkBusy, setThinkBusy] = useState<string | null>(null);
  const [messagePeer, setMessagePeer] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "err" | "warn"; text: string } | null>(null);

  const cursorRef = useRef("");
  const seenIds = useRef<Set<string | number>>(new Set());

  const flashGen = useRef(0);
  const flash = (kind: "ok" | "err" | "warn", text: string) => {
    const gen = ++flashGen.current;
    setNotice({ kind, text });
    window.setTimeout(() => {
      // A newer flash must not be cleared by an older timer.
      if (flashGen.current === gen) setNotice(null);
    }, 5000);
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
      if (fresh.length) setEvents((prev) => [...prev, ...fresh].slice(-600));
      if (json.agents) {
        // The feed delivers a fresh array identity every 2s poll even when
        // the roster is unchanged. Keep the previous state object in that
        // case, or every useCallback/useEffect depending on `agents`
        // (task lists, gallery) refires each poll — a refetch storm.
        const key = rosterKey(json.agents);
        setAgents((prev) => (rosterKey(prev) === key ? prev : json.agents));
      }
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

  /* ── cross-agent task list (kanban + palette share it) ── */
  const fetchAllTasks = useCallback(async () => {
    try {
      // Per-agent fetch (not the unscoped endpoint): tasks are attributed to
      // their owner, so archived agents' tasks can't leak into the palette.
      const live = activeRoster(agents);
      const results = await Promise.all(
        live.map((a) =>
          postCommand({ action: "tasks", name: a.name, quiet: true })
            .then((j) => ((j.tasks || []) as TaskInfo[]).map((t) => ({ ...t, agent: a.name })))
            .catch(() => [] as TaskInfo[]),
        ),
      );
      const merged = results.flat().sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      setAllTasks(merged);
    } catch {
      /* keep stale */
    }
  }, [agents]);

  useEffect(() => {
    if (authLoading || !user) return;
    fetchAllTasks();
    const t = window.setInterval(fetchAllTasks, 20000);
    return () => window.clearInterval(t);
  }, [authLoading, user, fetchAllTasks]);

  /* ── while-you-were-away digest ── */
  useEffect(() => {
    if (authLoading || !user) return;
    const lastVisit = window.localStorage.getItem(LAST_VISIT_KEY);
    window.localStorage.setItem(LAST_VISIT_KEY, String(Date.now()));
    if (!lastVisit) return;
    postCommand({ action: "digest", since: Number(lastVisit), quiet: true })
      .then((j) => {
        if (j && j.ok) setDigest(j as DigestResponse);
      })
      .catch(() => {});
  }, [authLoading, user]);

  /* ── Cmd+K ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ── actions ── */
  // Actionable surfaces (Cmd+K, dispatch, activity filter, fleet roster,
  // messages, header badge) only ever see the live fleet — archived agents'
  // stale errors must not look like problems.
  const activeAgents = useMemo(() => activeRoster(agents), [agents]);
  const handleThinkNow = async (name: string) => {
    if (thinkBusy) return;
    setThinkBusy(name);
    try {
      const j = await postCommand({ action: "think", name });
      if (j.skipped === "archived") flash("warn", `"${name}" is archived — its mind is stopped. Nothing to think.`);
      else if (j.skipped) flash("warn", `Think skipped for ${name} (${j.skipped}).`);
      else if (j.ok) flash("ok", `Think complete for ${name}${j.usedModel ? ` (${j.usedModel})` : ""}.`);
      else flash("err", `Think failed: ${j.error || "unknown"}`);
    } catch (err) {
      flash("err", err instanceof Error ? err.message : "Think failed");
    } finally {
      setThinkBusy(null);
    }
  };

  const handleArchive = async (name: string) => {
    if (!window.confirm(`Archive agent "${name}"? This is the kill switch — its mind stops immediately.`)) return;
    try {
      await postCommand({ action: "archive", name });
      flash("ok", `Agent "${name}" archived.`);
      if (selection?.type === "agent" && selection.agent === name) setSelection(null);
      await fetchFeed(false);
    } catch (err) {
      flash("err", err instanceof Error ? err.message : "Archive failed");
    }
  };

  const handleSpawned = async (name: string) => {
    setSpawnOpen(false);
    flash("ok", `Agent "${name}" spawned — assign a task or send it a message to wake it.`);
    await fetchFeed(false);
    setSelection({ type: "agent", agent: name });
    setView("fleet");
  };

  const handleDispatched = () => {
    setDispatchOpen(false);
    flash("ok", "Task dispatched — agents will pick it up.");
    fetchAllTasks();
  };

  const openDispatch = (agent?: string) => {
    setDispatchAgent(agent);
    setDispatchOpen(true);
  };

  const goMessages = (peer: string) => {
    setMessagePeer(peer);
    setView("messages");
  };

  const toggleFile = (id: string | number) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const refreshRoster = async () => {
    seenIds.current.clear();
    cursorRef.current = "";
    setEvents([]);
    setFeedState("loading");
    await fetchFeed(true);
  };

  /* ── auth shells ── */
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
          <h1 className="text-2xl font-bold text-zinc-100">Agent OS</h1>
          <p className="max-w-sm text-sm text-zinc-400">
            Your autonomous agent command center. Sign in to access the fleet.
          </p>
          <Link to="/auth" className={btnPrimary}>
            <KeyRound size={16} /> Sign in
          </Link>
        </div>
      </AppLayout>
    );
  }

  const online = feedState === "live";
  const rosterErrorCount = activeAgents.filter((a) => a.last_think_error).length;
  const totalUnread = activeAgents.reduce((s, a) => s + (a.unread || 0), 0);
  const inspectorAgent = selection?.type === "agent" ? selection.agent : null;

  const railBtn = (v: (typeof VIEWS)[number]) => {
    const active = view === v.id;
    const badge = v.id === "messages" && totalUnread > 0 ? totalUnread : null;
    return (
      <button
        key={v.id}
        onClick={() => setView(v.id)}
        title={v.label}
        className={cn(
          "relative flex flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-[10px] font-semibold transition",
          active ? "bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/40" : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300",
        )}
      >
        <v.Icon size={18} />
        <span className="hidden lg:inline">{v.label}</span>
        {badge !== null && (
          <span className="absolute right-1 top-1 rounded-full bg-emerald-400 px-1 text-[9px] font-bold text-black">
            {badge}
          </span>
        )}
      </button>
    );
  };

  return (
    <AppLayout>
      <div className="flex min-h-screen flex-col bg-[#04070f] text-zinc-100" data-agent-os={AGENT_OS_VERSION}>
        {/* ── OS header ── */}
        <header className="sticky top-0 z-20 border-b border-white/10 bg-[#04070f]/90 backdrop-blur">
          <div className="mx-auto flex max-w-[1800px] items-center gap-3 px-4 py-2.5">
            <div className="rounded-lg bg-emerald-400/10 p-1.5 ring-1 ring-emerald-400/30">
              <Bot size={18} className="text-emerald-300" />
            </div>
            <h1 className="text-base font-bold tracking-tight">Agent OS</h1>
            <span className="rounded-full bg-violet-400/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-violet-300 ring-1 ring-violet-400/30">
              v2
            </span>
            <span className="hidden text-xs text-zinc-500 sm:inline">autonomous agent command center</span>
            {rosterErrorCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-400/10 px-2.5 py-1 text-[11px] font-semibold text-red-300 ring-1 ring-red-400/40">
                <AlertTriangle size={11} /> {rosterErrorCount} failing
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setPaletteOpen(true)}
                className={cn(btnGhost, "hidden sm:inline-flex")}
                title="Command palette (Cmd+K)"
              >
                <Search size={13} /> <kbd className="font-mono text-[10px] text-zinc-500">⌘K</kbd>
              </button>
              <button onClick={() => setSpawnOpen(true)} className={cn(btnPrimary, "!px-3 !py-1.5 text-xs")}>
                <Plus size={14} /> <span className="hidden sm:inline">Spawn</span>
              </button>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1",
                  online ? "bg-emerald-400/10 text-emerald-300 ring-emerald-400/40" : "bg-zinc-500/10 text-zinc-400 ring-zinc-500/30",
                )}
              >
                <span className="relative flex h-2 w-2">
                  {online && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
                  <span className={cn("relative inline-flex h-2 w-2 rounded-full", online ? "bg-emerald-400" : "bg-zinc-500")} />
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
                  : notice.kind === "warn"
                    ? "border-amber-400/20 bg-amber-400/5 text-amber-300"
                    : "border-red-400/20 bg-red-400/5 text-red-300",
              )}
            >
              {notice.text}
            </div>
          )}
        </header>

        {/* ── digest ── */}
        {digest && (
          <div className="mx-auto w-full max-w-[1800px] px-4 pt-3">
            <DigestBanner digest={digest} onDismiss={() => setDigest(null)} />
          </div>
        )}

        {/* ── body: rail + content + inspector ── */}
        <div className="mx-auto flex w-full max-w-[1800px] flex-1 gap-4 px-4 py-4 pb-24 md:pb-4">
          {/* left icon rail (desktop) */}
          <nav className="hidden w-16 shrink-0 flex-col gap-1 md:flex">
            {VIEWS.map(railBtn)}
          </nav>

          {/* main content */}
          <main className="min-w-0 flex-1">
            {feedState === "error" && events.length === 0 ? (
              <div className="flex h-full min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
                <AlertTriangle size={24} className="text-red-400" />
                <p className="max-w-xs text-sm text-zinc-400">Couldn't reach the Agent OS feed. The backend may still be deploying.</p>
                <p className="max-w-xs font-mono text-[11px] text-zinc-600">{feedError}</p>
                <button onClick={refreshRoster} className={cn(btnPrimary, "!py-1.5 text-xs")}>Retry</button>
              </div>
            ) : (
              <>
                {view === "fleet" && (
                  <Fleet
                    agents={activeAgents}
                    events={events}
                    live={online}
                    thinkBusy={thinkBusy}
                    onThink={handleThinkNow}
                    onArchive={handleArchive}
                    onSelect={(n) => setSelection({ type: "agent", agent: n })}
                    onSpawn={() => setSpawnOpen(true)}
                    onDispatchTask={openDispatch}
                    onMessage={goMessages}
                  />
                )}
                {view === "activity" && (
                  <Activity agents={activeAgents} events={events} expandedFiles={expandedFiles} onToggleFile={toggleFile} />
                )}
                {view === "tasks" && (
                  <TasksView
                    agents={agents}
                    onOpenTask={(t) => setSelection({ type: "task", task: t })}
                    onDispatch={() => openDispatch()}
                  />
                )}
                {view === "files" && (
                  <FilesView
                    agents={agents}
                    defaultAgent={inspectorAgent}
                    onOpenFile={(agent, taskId, path) => setSelection({ type: "file", agent, taskId, path })}
                    onOpenTask={(t) => setSelection({ type: "task", task: t })}
                  />
                )}
                {view === "messages" && (
                  <MessagesView
                    agents={activeAgents}
                    feedEvents={events}
                    initialPeer={messagePeer}
                    onSent={() => fetchFeed(false)}
                    onError={(t) => flash("err", t)}
                  />
                )}
                {view === "usage" && <UsageView />}
              </>
            )}
          </main>

          {/* right inspector (desktop) */}
          {selection && (
            <aside className="hidden w-[380px] shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] lg:block lg:max-h-[calc(100vh-140px)] lg:sticky lg:top-[76px]">
              <Inspector
                selection={selection}
                onClose={() => setSelection(null)}
                onThink={handleThinkNow}
                onArchive={handleArchive}
                thinkBusy={thinkBusy}
                onOpenTask={(t) => setSelection({ type: "task", task: t })}
                onOpenFile={(agent, taskId, path) => setSelection({ type: "file", agent, taskId, path })}
                events={events}
                agents={agents}
              />
            </aside>
          )}
        </div>

        {/* inspector as mobile sheet */}
        {selection && (
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setSelection(null)}>
            <div
              className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-hidden rounded-t-2xl border-t border-white/10 bg-[#0a0f1c]"
              onClick={(e) => e.stopPropagation()}
            >
              <Inspector
                selection={selection}
                onClose={() => setSelection(null)}
                onThink={handleThinkNow}
                onArchive={handleArchive}
                thinkBusy={thinkBusy}
                onOpenTask={(t) => setSelection({ type: "task", task: t })}
                onOpenFile={(agent, taskId, path) => setSelection({ type: "file", agent, taskId, path })}
                events={events}
                agents={agents}
              />
            </div>
          </div>
        )}

        {/* bottom nav (mobile) */}
        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 gap-1 border-t border-white/10 bg-[#04070f]/95 px-2 py-1.5 backdrop-blur md:hidden">
          {VIEWS.map(railBtn)}
        </nav>

        {/* overlays */}
        <SpawnWizard open={spawnOpen} onClose={() => setSpawnOpen(false)} onSpawned={handleSpawned} />
        <DispatchModal
          open={dispatchOpen}
          agents={activeAgents}
          presetAgent={dispatchAgent}
          onClose={() => setDispatchOpen(false)}
          onDispatched={handleDispatched}
        />
        <CommandPalette
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          agents={activeAgents}
          tasks={fleetTasks(allTasks, activeAgents)}
          onThink={handleThinkNow}
          onSpawn={() => setSpawnOpen(true)}
          onGoMessages={goMessages}
          onSelectAgent={(n) => {
            setSelection({ type: "agent", agent: n });
            setView("fleet");
          }}
          onOpenTask={(t) => setSelection({ type: "task", task: t })}
          onDispatch={() => openDispatch()}
        />
      </div>
    </AppLayout>
  );
};

export default AgentPlus;
