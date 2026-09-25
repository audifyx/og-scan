/* Agent OS v2 — overlays: digest banner, spawn wizard, command palette,
   dispatch modal, and the right-side inspector panel. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  Plus,
  Bot,
  Brain,
  Database,
  Inbox,
  ListChecks,
  Download,
  Loader2,
  Play,
  Archive,
  RefreshCw,
  FolderOpen,
  FileCode2,
  Eye,
  Rocket,
  ExternalLink,
  Cpu,
  Search,
  Sparkles,
  Globe2,
  LineChart,
  MessagesSquare,
  Send,
  MoonStar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type AgentDetail,
  type MemoryEntry,
  type InboxMsg,
  type TaskInfo,
  type TaskFile,
  type DigestResponse,
  type ModelsProbe,
  postCommand,
  downloadExport,
  extractUrls,
  formatTime,
  timeAgo,
  taskProgress,
} from "./api";
import {
  inputCls,
  btnPrimary,
  btnGhost,
  SectionTitle,
  ProgressBar,
  MindBadge,
  StatusPill,
  ThinkErrorBanner,
  LoadingState,
  StepIcon,
  stepColor,
} from "./ui";

export type Selection =
  | { type: "agent"; agent: string }
  | { type: "task"; task: TaskInfo }
  | { type: "file"; agent: string; taskId: string; path: string }
  | null;

/* ── digest banner ── */

export function DigestBanner({ digest, onDismiss }: { digest: DigestResponse; onDismiss: () => void }) {
  const t = digest.totals;
  const items = [
    t.thoughts > 0 && `${t.thoughts} thinks`,
    t.files > 0 && `${t.files} files written`,
    t.steps_advanced > 0 && `${t.steps_advanced} task steps advanced`,
    t.deploys > 0 && `${t.deploys} deploys`,
    t.builds > 0 && `${t.builds} builds`,
    t.messages > 0 && `${t.messages} messages`,
    t.errors > 0 && `${t.errors} errors`,
  ].filter(Boolean) as string[];
  if (items.length === 0) return null;
  return (
    <div className="relative overflow-hidden rounded-xl border border-violet-400/30 bg-gradient-to-r from-violet-500/10 via-transparent to-emerald-500/10 p-4">
      <button onClick={onDismiss} className="absolute right-2 top-2 rounded-md p-1 text-zinc-500 hover:text-zinc-300" title="Dismiss">
        <X size={14} />
      </button>
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-violet-400/10 p-2 ring-1 ring-violet-400/30">
          <MoonStar size={18} className="text-violet-300" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-zinc-100">While you were away</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">
            since {formatTime(digest.since)} — your fleet was busy:{" "}
            <span className="font-semibold text-zinc-200">{items.join(" · ")}</span>
            {digest.agents_active > 0 && (
              <span className="text-zinc-500"> across {digest.agents_active} agent{digest.agents_active === 1 ? "" : "s"}</span>
            )}
            .
          </p>
          {digest.per_agent.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {digest.per_agent.slice(0, 6).map((p) => (
                <span key={p.agent} className="inline-flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 font-mono text-[10px] text-zinc-400 ring-1 ring-white/10">
                  {p.agent}
                  <span className="text-violet-300">{p.thoughts}💭</span>
                  <span className="text-amber-300">{p.files}📄</span>
                </span>
              ))}
            </div>
          )}
          {t.errors > 0 && (
            <p className="mt-1.5 text-[11px] text-red-300/80">⚠ {t.errors} error{t.errors === 1 ? "" : "s"} logged — check the Activity stream.</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── spawn wizard ── */

const TEMPLATES = [
  {
    id: "website",
    name: "Website Builder",
    Icon: Globe2,
    role: "Website builder",
    persona:
      "You are an elite front-end engineer. You build complete, polished, fully working websites from a single brief: real HTML/CSS/JS in one file or a small set of files, responsive, no placeholders, no lorem ipsum. You write index.html first, then supporting assets, then validate by reviewing your own code. You explain what you built in plain language.",
    capabilities: ["write_file", "build", "deploy"],
  },
  {
    id: "research",
    name: "Researcher",
    Icon: Search,
    role: "Research analyst",
    persona:
      "You are a relentless research analyst. Given a topic, you dig deep: gather facts, compare sources, note what is uncertain, and write clear structured findings to your workspace files. You cite where claims came from and flag anything you could not verify.",
    capabilities: ["write_file", "remember"],
  },
  {
    id: "trader",
    name: "Trader",
    Icon: LineChart,
    role: "Trading assistant",
    persona:
      "You are a disciplined trading assistant. You watch markets, summarize setups, and prepare trade plans — but you NEVER execute a trade without explicit human confirmation of size and direction. You log every observation and keep a trading journal in your workspace.",
    capabilities: ["write_file", "remember"],
  },
  {
    id: "general",
    name: "General Assistant",
    Icon: Sparkles,
    role: "General assistant",
    persona:
      "You are a capable general-purpose assistant. You take on whatever tasks you are given, break them into steps, use your workspace files to organize your work, and report back clearly when done.",
    capabilities: ["write_file", "remember"],
  },
];

export function SpawnWizard({ open, onClose, onSpawned }: {
  open: boolean;
  onClose: () => void;
  onSpawned: (name: string) => void;
}) {
  const [template, setTemplate] = useState(TEMPLATES[0].id);
  const [name, setName] = useState("");
  const [role, setRole] = useState(TEMPLATES[0].role);
  const [persona, setPersona] = useState(TEMPLATES[0].persona);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      setBusy(false);
    }
  }, [open ]);

  if (!open) return null;

  const pickTemplate = (id: string) => {
    setTemplate(id);
    const t = TEMPLATES.find((x) => x.id === id)!;
    setRole(t.role);
    setPersona(t.persona);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    if (!n || busy) return;
    setBusy(true);
    setError(null);
    try {
      const t = TEMPLATES.find((x) => x.id === template)!;
      await postCommand({ action: "spawn", name: n, role: role.trim(), persona: persona.trim(), capabilities: t.capabilities });
      onSpawned(n);
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Spawn failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-white/10 bg-[#0a0f1c] p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center gap-2">
          <div className="rounded-lg bg-emerald-400/10 p-1.5 ring-1 ring-emerald-400/30">
            <Bot size={18} className="text-emerald-300" />
          </div>
          <h2 className="text-base font-bold text-zinc-100">Spawn agent</h2>
          <button onClick={onClose} className="ml-auto rounded-md p-1 text-zinc-500 hover:text-zinc-300">
            <X size={16} />
          </button>
        </div>

        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500">Template</p>
        <div className="mb-4 grid grid-cols-2 gap-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => pickTemplate(t.id)}
              className={cn(
                "flex items-center gap-2 rounded-xl border p-3 text-left transition",
                template === t.id
                  ? "border-emerald-400/50 bg-emerald-400/[0.07]"
                  : "border-white/10 bg-white/[0.02] hover:border-white/25",
              )}
            >
              <t.Icon size={16} className={template === t.id ? "text-emerald-300" : "text-zinc-500"} />
              <span className={cn("text-xs font-semibold", template === t.id ? "text-emerald-200" : "text-zinc-300")}>
                {t.name}
              </span>
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. site-builder-1" className={inputCls} required />
            <p className="mt-1 text-[10px] text-zinc-600">lowercase letters, numbers, dashes · 2–32 chars</p>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Role</label>
            <input value={role} onChange={(e) => setRole(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Persona / instructions</label>
            <textarea value={persona} onChange={(e) => setPersona(e.target.value)} className={cn(inputCls, "min-h-[110px] resize-y")} />
          </div>
          {error && <p className="text-xs text-red-300">{error}</p>}
          <button type="submit" disabled={busy || !name.trim()} className={cn(btnPrimary, "w-full")}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Spawn agent
          </button>
          <p className="text-center text-[10px] text-zinc-600">
            The agent wakes when you assign a task or send it a message.
          </p>
        </form>
      </div>
    </div>
  );
}

/* ── dispatch modal ── */

export function DispatchModal({ open, agents, presetAgent, onClose, onDispatched }: {
  open: boolean;
  agents: { name: string; status: string }[];
  presetAgent?: string;
  onClose: () => void;
  onDispatched: () => void;
}) {
  const [instructions, setInstructions] = useState("");
  const [kind, setKind] = useState<"website" | "research" | "general">("website");
  const [agent, setAgent] = useState(presetAgent || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAgent(presetAgent || "");
      setError(null);
    }
  }, [open, presetAgent ]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = instructions.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    try {
      const title = text.length > 70 ? text.slice(0, 70) + "…" : text;
      await postCommand({ action: "task", name: agent || undefined, title, kind, instructions: text });
      setInstructions("");
      onDispatched();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dispatch failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-t-2xl border border-white/10 bg-[#0a0f1c] p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center gap-2">
          <div className="rounded-lg bg-emerald-400/10 p-1.5 ring-1 ring-emerald-400/30">
            <Send size={16} className="text-emerald-300" />
          </div>
          <h2 className="text-base font-bold text-zinc-100">Dispatch task</h2>
          <button onClick={onClose} className="ml-auto rounded-md p-1 text-zinc-500 hover:text-zinc-300">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="build me a website about…"
            className={cn(inputCls, "min-h-[100px] resize-y")}
            autoFocus
          />
          <div className="flex gap-2">
            <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className={cn(inputCls, "flex-1")}>
              <option value="website">Website</option>
              <option value="research">Research</option>
              <option value="general">General</option>
            </select>
            <select value={agent} onChange={(e) => setAgent(e.target.value)} className={cn(inputCls, "flex-1")}>
              <option value="">Auto-assign</option>
              {agents.filter((a) => a.status === "active").map((a) => (
                <option key={a.name} value={a.name}>{a.name}</option>
              ))}
            </select>
          </div>
          {error && <p className="text-xs text-red-300">{error}</p>}
          <button type="submit" disabled={busy || !instructions.trim()} className={cn(btnPrimary, "w-full")}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Assign task
          </button>
        </form>
      </div>
    </div>
  );
}

/* ── command palette ── */

interface PaletteItem {
  id: string;
  label: string;
  hint: string;
  Icon: typeof Bot;
  run: () => void;
}

export function CommandPalette({ open, onClose, agents, tasks, onThink, onSpawn, onGoMessages, onSelectAgent, onOpenTask, onDispatch }: {
  open: boolean;
  onClose: () => void;
  agents: { name: string; mind?: string }[];
  tasks: TaskInfo[];
  onThink: (name: string) => void;
  onSpawn: () => void;
  onGoMessages: (peer: string) => void;
  onSelectAgent: (name: string) => void;
  onOpenTask: (task: TaskInfo) => void;
  onDispatch: () => void;
}) {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setIdx(0);
      window.setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open ]);

  const items: PaletteItem[] = useMemo(() => {
    const query = q.trim().toLowerCase();
    const match = (s: string) => !query || s.toLowerCase().includes(query);
    const list: PaletteItem[] = [];
    list.push(
      { id: "act:spawn", label: "Spawn agent…", hint: "action", Icon: Plus, run: onSpawn },
      { id: "act:dispatch", label: "Dispatch task…", hint: "action", Icon: Send, run: onDispatch },
      { id: "act:lobby", label: "Message the lobby…", hint: "action", Icon: MessagesSquare, run: () => onGoMessages("lobby") },
    );
    for (const a of agents) {
      if (!match(a.name)) continue;
      list.push({ id: `agent:${a.name}`, label: a.name, hint: "agent", Icon: Bot, run: () => onSelectAgent(a.name) });
      list.push({ id: `think:${a.name}`, label: `Think now — ${a.name}`, hint: "action", Icon: Play, run: () => onThink(a.name) });
      list.push({ id: `dm:${a.name}`, label: `Message ${a.name}…`, hint: "action", Icon: MessagesSquare, run: () => onGoMessages(a.name) });
    }
    for (const t of tasks) {
      if (!match(t.title)) continue;
      list.push({ id: `task:${t.id}`, label: t.title, hint: `task · ${t.agent || ""}`, Icon: ListChecks, run: () => onOpenTask(t) });
    }
    return list.slice(0, 40);
  }, [q, agents, tasks, onThink, onSpawn, onGoMessages, onSelectAgent, onOpenTask, onDispatch]);

  useEffect(() => setIdx(0), [q]);

  if (!open) return null;

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); const it = items[idx]; if (it) { onClose(); it.run(); } }
    else if (e.key === "Escape") onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 p-4 pt-[12vh] backdrop-blur-sm" onClick={onClose}>
      <div
        className="mx-auto max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-[#0a0f1c] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKey}
      >
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          <Search size={16} className="shrink-0 text-zinc-500" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Jump to an agent, task, or action…"
            className="w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 outline-none"
          />
          <kbd className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">esc</kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-1.5">
          {items.length === 0 && <p className="px-3 py-6 text-center text-xs text-zinc-600">No matches.</p>}
          {items.map((it, i) => (
            <button
              key={it.id}
              onMouseEnter={() => setIdx(i)}
              onClick={() => { onClose(); it.run(); }}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition",
                i === idx ? "bg-emerald-400/10 text-emerald-100" : "text-zinc-300",
              )}
            >
              <it.Icon size={14} className={i === idx ? "text-emerald-300" : "text-zinc-500"} />
              <span className="min-w-0 flex-1 truncate">{it.label}</span>
              <span className="shrink-0 text-[10px] uppercase tracking-wider text-zinc-600">{it.hint}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── inspector (right panel / mobile sheet) ── */

function InspectorAgent({ name, thinkBusy, onThink, onArchive, onOpenTask, unread }: {
  name: string;
  thinkBusy: string | null;
  onThink: (n: string) => void;
  onArchive: (n: string) => void;
  onOpenTask: (t: TaskInfo) => void;
  unread: number;
}) {
  const [detail, setDetail] = useState<AgentDetail | null>(null);
  const [mem, setMem] = useState<MemoryEntry[]>([]);
  const [tasks, setTasks] = useState<TaskInfo[]>([]);
  const [inbox, setInbox] = useState<InboxMsg[]>([]);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dlBusy, setDlBusy] = useState<string | null>(null);
  const [probe, setProbe] = useState<ModelsProbe | null>(null);
  const [probeLoading, setProbeLoading] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [g, r, t] = await Promise.all([
        postCommand({ action: "get", name, quiet: true }),
        postCommand({ action: "recall", name, key: "", quiet: true }),
        postCommand({ action: "tasks", name, quiet: true }),
      ]);
      setDetail(g.agent as AgentDetail);
      setMem(Array.isArray(r.memory) ? (r.memory as MemoryEntry[]) : []);
      setTasks(((t.tasks || []) as TaskInfo[]).map((x) => ({ ...x, agent: name })));
    } catch {
      /* keep stale */
    } finally {
      setLoading(false);
    }
  }, [name]);

  useEffect(() => {
    setDetail(null);
    setMem([]);
    setTasks([]);
    setInbox([]);
    setInboxOpen(false);
    setProbe(null);
    load();
    const t = window.setInterval(() => load(true), 10000);
    return () => window.clearInterval(t);
  }, [name, load]);

  const loadInbox = async () => {
    try {
      const j = await postCommand({ action: "inbox", name, quiet: true });
      setInbox((j.messages || []) as InboxMsg[]);
      setInboxOpen(true);
    } catch { /* ignore */ }
  };

  const dl = async (kind: "log" | "thoughts") => {
    setDlBusy(kind);
    try {
      await downloadExport(name, kind);
    } catch { /* shell flashes */ }
    finally {
      setDlBusy(null);
    }
  };

  const probeModels = async () => {
    setProbeLoading(true);
    try {
      const j = await postCommand({ action: "models" });
      setProbe(j as ModelsProbe);
    } catch { /* ignore */ }
    finally {
      setProbeLoading(false);
    }
  };

  if (loading && !detail) return <LoadingState label={`Loading ${name}…`} />;
  if (!detail) return <p className="py-8 text-center text-xs text-zinc-600">Couldn't load agent.</p>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-mono text-base font-bold text-zinc-100">{detail.name}</h3>
        <StatusPill status={detail.status} />
        <MindBadge mind={detail.mind} />
        {detail.role && <span className="text-[11px] text-zinc-500">{detail.role}</span>}
        <div className="ml-auto flex gap-1.5">
          <button onClick={() => onThink(detail.name)} disabled={thinkBusy === detail.name} className={cn(btnPrimary, "!px-2.5 !py-1.5 text-xs")} title="Force the server-side mind to think now">
            {thinkBusy === detail.name ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            Think
          </button>
          <button onClick={() => load(true)} className={btnGhost} title="Refresh">
            <RefreshCw size={12} />
          </button>
          <button onClick={() => onArchive(detail.name)} className={cn(btnGhost, "hover:!bg-red-400/10 hover:!text-red-300")} title="Archive (kill switch)">
            <Archive size={12} />
          </button>
        </div>
      </div>

      {detail.last_think_error && <ThinkErrorBanner err={detail.last_think_error} />}

      <div className="rounded-lg bg-black/30 p-3 ring-1 ring-white/5">
        <div className="mb-1.5 flex items-center justify-between text-[11px]">
          <span className="font-semibold uppercase tracking-wider text-zinc-500">Think budget</span>
          <span className="font-mono text-zinc-400">{detail.thinks_today ?? 0} / {detail.think_budget_per_day ?? "—"} today</span>
        </div>
        <ProgressBar done={detail.thinks_today ?? 0} total={detail.think_budget_per_day ?? 0} />
        <div className="mt-1.5 flex flex-wrap justify-between gap-1 text-[10px] text-zinc-600">
          <span>last think: {detail.last_think_at ? timeAgo(detail.last_think_at) : "never"}</span>
          {detail.model && <span className="font-mono" title={detail.model}>{detail.model.split("/").pop()}</span>}
        </div>
      </div>

      {detail.persona && (
        <div className="rounded-lg bg-black/30 p-3 ring-1 ring-white/5">
          <SectionTitle icon={Brain}>Persona</SectionTitle>
          <p className="line-clamp-6 whitespace-pre-wrap text-xs leading-relaxed text-zinc-300">{detail.persona}</p>
        </div>
      )}

      <div className="rounded-lg bg-black/30 p-3 ring-1 ring-white/5">
        <SectionTitle icon={Database} right={<span className="font-mono text-[10px] text-zinc-600">{mem.length}</span>}>Memory</SectionTitle>
        {mem.length === 0 ? (
          <p className="text-[11px] text-zinc-600">Nothing remembered yet.</p>
        ) : (
          <div className="max-h-36 space-y-1 overflow-y-auto">
            {mem.slice(0, 12).map((m) => (
              <div key={m.key} className="rounded-md bg-white/[0.03] px-2 py-1 ring-1 ring-white/5">
                <div className="font-mono text-[10px] font-semibold text-violet-300">{m.key}</div>
                <div className="truncate text-[11px] text-zinc-400">{m.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg bg-black/30 p-3 ring-1 ring-white/5">
        <div className="mb-2 flex items-center justify-between">
          <SectionTitle icon={Inbox}>Inbox</SectionTitle>
          {!inboxOpen && (
            <button onClick={loadInbox} className={btnGhost}>
              <Inbox size={11} /> Load{unread > 0 ? ` (${unread})` : ""}
            </button>
          )}
        </div>
        {!inboxOpen ? (
          <p className="text-[11px] text-zinc-600">{unread} unread — loading marks DMs read.</p>
        ) : inbox.length === 0 ? (
          <p className="text-[11px] text-zinc-600">Inbox is clear.</p>
        ) : (
          <div className="max-h-44 space-y-1.5 overflow-y-auto">
            {inbox.map((m) => (
              <div key={m.id} className="rounded-md bg-white/[0.03] px-2 py-1.5 ring-1 ring-white/5">
                <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                  <span className="font-mono text-emerald-300">{m.from}</span>
                  <span className="ml-auto">{timeAgo(m.created_at)}</span>
                </div>
                <p className="mt-0.5 line-clamp-3 text-[11px] text-zinc-300">{m.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg bg-black/30 p-3 ring-1 ring-white/5">
        <SectionTitle icon={ListChecks} right={<span className="font-mono text-[10px] text-zinc-600">{tasks.length}</span>}>Tasks</SectionTitle>
        {tasks.length === 0 ? (
          <p className="text-[11px] text-zinc-600">No tasks yet.</p>
        ) : (
          <div className="space-y-1.5">
            {tasks.slice(0, 8).map((t) => {
              const p = taskProgress(t);
              return (
                <button key={t.id} onClick={() => onOpenTask(t)} className="block w-full rounded-lg bg-white/[0.03] p-2 text-left ring-1 ring-white/5 hover:bg-white/[0.06]">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-zinc-200">{t.title}</span>
                    <StatusPill status={t.status} />
                  </div>
                  {p.total > 0 && <div className="mt-1.5"><ProgressBar done={p.done} total={p.total} /></div>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-lg bg-black/30 p-3 ring-1 ring-white/5">
        <SectionTitle icon={Download}>Export</SectionTitle>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => dl("log")} disabled={dlBusy !== null} className={cn(btnPrimary, "!px-3 !py-1.5 text-xs")}>
            {dlBusy === "log" ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} full-log.md
          </button>
          <button onClick={() => dl("thoughts")} disabled={dlBusy !== null} className={cn(btnPrimary, "!px-3 !py-1.5 text-xs")}>
            {dlBusy === "thoughts" ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} thoughts-only.md
          </button>
        </div>
      </div>

      <div className="rounded-lg bg-black/30 p-3 ring-1 ring-white/5">
        <SectionTitle icon={Cpu}>Mind model</SectionTitle>
        <p className="mb-2 text-[10px] leading-relaxed text-zinc-600">
          One model for every agent — per-agent model overrides are retired. The key itself is never shown.
        </p>
        <button onClick={probeModels} disabled={probeLoading} className={cn(btnGhost, "w-full")}>
          {probeLoading ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />} Verify mind model
        </button>
        {probe && (
          <div className="mt-2 rounded-lg bg-black/40 p-2 text-[10px] ring-1 ring-white/5">
            {probe.ok ? (
              <>
                <div className="mb-1 flex items-center gap-1.5">
                  <Brain size={11} className="shrink-0 text-emerald-300" />
                  <span className="min-w-0 flex-1 truncate font-mono text-emerald-300" title={probe.defaultModel}>{probe.defaultModel}</span>
                </div>
                {probe.lastVerified?.ok ? (
                  <div className="mb-1 text-zinc-500">
                    <span className="font-semibold text-emerald-300">verified working</span>
                    {" — last successful think "}
                    <span className="font-mono text-zinc-400">{timeAgo(probe.lastVerified.at || "")}</span>
                    {typeof probe.lastVerified.ms === "number" && (
                      <span className="font-mono text-zinc-600"> · {(probe.lastVerified.ms / 1000).toFixed(1)}s</span>
                    )}
                  </div>
                ) : (
                  <div className="mb-1 text-amber-300/80">No successful think recorded for this model yet.</div>
                )}
                <details className="mt-1">
                  <summary className="cursor-pointer text-zinc-600 hover:text-zinc-400">
                    Raw provider catalog ({probe.count} IDs — most 404 at chat time)
                  </summary>
                  <div className="mt-1 max-h-32 space-y-0.5 overflow-y-auto font-mono">
                    {(probe.models || []).slice(0, 30).map((m) => (
                      <div key={m} className={cn("truncate rounded px-1.5 py-0.5", m === probe.defaultModel ? "bg-emerald-400/10 text-emerald-300" : "text-zinc-400")} title={m}>
                        {m}
                      </div>
                    ))}
                  </div>
                </details>
              </>
            ) : (
              <div className="text-red-300"><span className="font-mono font-bold">{probe.error}</span> — {probe.message}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function InspectorTask({ task, events, onOpenFile }: {
  task: TaskInfo;
  events: import("./api").AgentEvent[];
  onOpenFile: (agent: string, taskId: string, path: string) => void;
}) {
  const [files, setFiles] = useState<TaskFile[]>([]);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const j = await postCommand({ action: "files", task_id: task.id, quiet: true });
      const list = (j.files || []) as TaskFile[];
      setFiles(list);
      if (task.kind === "website") {
        const idx = list.find((f) => f.path === "index.html") || list.find((f) => f.path.endsWith(".html"));
        if (idx) {
          const c = await postCommand({ action: "file", task_id: task.id, path: idx.path, quiet: true });
          if (typeof c.content === "string") {
            setPreviewHtml(c.content as string);
            setPreviewPath(idx.path);
          }
        }
      }
    } catch { /* keep stale */ }
    finally {
      setLoading(false);
    }
  }, [task.id, task.kind]);

  useEffect(() => {
    setPreviewHtml(null);
    setPreviewPath(null);
    load();
    const t = window.setInterval(() => load(), 10000);
    return () => window.clearInterval(t);
  }, [load]);

  const p = taskProgress(task);
  const deploys = events.filter((e) => e.task_id === task.id && e.kind === "deploy");
  const builds = events.filter((e) => e.task_id === task.id && e.kind === "build");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="min-w-0 flex-1 text-sm font-bold text-zinc-100">{task.title}</h3>
        <StatusPill status={task.status} />
      </div>
      <p className="flex items-center gap-2 font-mono text-[11px] text-zinc-500">
        <span className="text-emerald-300/80">{task.agent || "auto"}</span>·<span>{task.kind}</span>·<span>{timeAgo(task.created_at)}</span>
      </p>

      {(task.steps || []).length > 0 && (
        <div className="rounded-lg bg-black/30 p-3 ring-1 ring-white/5">
          <SectionTitle icon={ListChecks}>Plan steps</SectionTitle>
          <div className="space-y-1.5">
            {(task.steps || []).map((s, i) => (
              <div key={i} className="flex items-start gap-2 rounded-md bg-white/[0.03] px-2 py-1.5 ring-1 ring-white/5">
                <StepIcon status={s.status} />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-zinc-200">{s.title}</div>
                  {s.result && <div className="mt-0.5 break-words font-mono text-[10px] text-zinc-500">{s.result.slice(0, 160)}{s.result.length > 160 && "…"}</div>}
                </div>
                <span className={cn("shrink-0 font-mono text-[10px]", stepColor(s.status))}>{s.status}</span>
              </div>
            ))}
            <ProgressBar done={p.done} total={p.total} />
          </div>
        </div>
      )}

      {(builds.length > 0 || deploys.length > 0) && (
        <div className="rounded-lg bg-black/30 p-3 ring-1 ring-white/5">
          <SectionTitle icon={Rocket}>Build & deploy</SectionTitle>
          <div className="space-y-1.5">
            {builds.length > 0 && (
              <p className="break-words font-mono text-[10px] text-orange-200/90">
                <span className="text-zinc-500">latest build: </span>{builds[builds.length - 1].body.slice(0, 160)}
              </p>
            )}
            {deploys.map((d) => {
              const urls = extractUrls(d.body);
              return urls.map((u) => (
                <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-lg bg-lime-400/10 px-2.5 py-1.5 font-mono text-[11px] text-lime-300 ring-1 ring-lime-400/30 hover:bg-lime-400/20">
                  <ExternalLink size={11} className="shrink-0" /><span className="truncate">{u}</span>
                </a>
              ));
            })}
          </div>
        </div>
      )}

      {task.kind === "website" && (
        <div className="rounded-lg bg-black/30 p-3 ring-1 ring-white/5">
          <SectionTitle icon={Eye}>Preview</SectionTitle>
          {previewHtml ? (
            <>
              <iframe title={`Preview of ${previewPath}`} sandbox="allow-scripts" srcDoc={previewHtml} className="h-72 w-full rounded-lg bg-white ring-1 ring-white/10" />
              <p className="mt-1.5 font-mono text-[10px] text-zinc-600">rendering {previewPath} · sandboxed · refreshes as files change</p>
            </>
          ) : (
            <p className="text-[11px] text-zinc-600">{loading ? "Loading…" : "No index.html yet — the preview appears once the agent writes one."}</p>
          )}
        </div>
      )}

      <div className="rounded-lg bg-black/30 p-3 ring-1 ring-white/5">
        <div className="mb-2 flex items-center justify-between">
          <SectionTitle icon={FolderOpen}>Files ({files.length})</SectionTitle>
          {loading && <Loader2 size={12} className="animate-spin text-zinc-500" />}
        </div>
        {files.length === 0 ? (
          <p className="text-[11px] text-zinc-600">No files yet.</p>
        ) : (
          <div className="space-y-1">
            {files.map((f) => (
              <button
                key={f.path}
                onClick={() => onOpenFile(task.agent || "", task.id, f.path)}
                className="flex w-full items-center gap-2 rounded-md bg-white/[0.03] px-2 py-1.5 text-left ring-1 ring-white/5 hover:bg-white/[0.06]"
              >
                <FileCode2 size={12} className="shrink-0 text-amber-300/80" />
                <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-zinc-200">{f.path}</span>
                <span className="shrink-0 font-mono text-[10px] text-zinc-600">v{f.version}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InspectorFile({ agent, taskId, path }: { agent: string; taskId: string; path: string }) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<{ version: number; size: number; sha256: string; updated_at?: string } | null>(null);
  const [versions, setVersions] = useState<{ version: number; sha256: string; updated_at?: string }[]>([]);
  const [selVersion, setSelVersion] = useState<number | null>(null);

  const load = useCallback((v: number | null) => {
    setLoading(true);
    setContent(null);
    postCommand({ action: "file", task_id: taskId, path, ...(v ? { version: v } : {}), quiet: true })
      .then((j) => {
        setContent(typeof j.content === "string" ? (j.content as string) : "(empty)");
        setMeta({ version: j.version, size: j.size, sha256: j.sha256, updated_at: j.updated_at });
        if (Array.isArray(j.versions)) setVersions(j.versions as { version: number; sha256: string; updated_at?: string }[]);
      })
      .catch(() => setContent("(failed to load)"))
      .finally(() => setLoading(false));
  }, [taskId, path]);

  useEffect(() => {
    setSelVersion(null);
    load(null);
  }, [taskId, path, load]);

  const pickVersion = (v: number | null) => {
    setSelVersion(v);
    load(v);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <FileCode2 size={14} className="shrink-0 text-amber-300/80" />
        <h3 className="min-w-0 flex-1 truncate font-mono text-sm font-bold text-zinc-100">{path}</h3>
      </div>
      <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] text-zinc-500">
        <span>{agent}</span>
        {meta && (
          <>
            <span className="rounded-full bg-black/40 px-1.5 py-0.5 text-zinc-400">v{meta.version}</span>
            <span>{(meta.size / 1024).toFixed(1)}k</span>
            {meta.updated_at && <span>{timeAgo(meta.updated_at)}</span>}
          </>
        )}
        {versions.length > 1 && (
          <select
            value={selVersion ?? ""}
            onChange={(e) => pickVersion(e.target.value ? Number(e.target.value) : null)}
            className="rounded border border-white/10 bg-black/40 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300 outline-none"
            title="Version history"
          >
            <option value="">latest (v{versions[0]?.version})</option>
            {versions.map((v) => (
              <option key={v.version} value={v.version}>
                v{v.version} · {v.sha256?.slice(0, 8)}
              </option>
            ))}
          </select>
        )}
      </div>
      {loading ? (
        <LoadingState label="Loading file…" />
      ) : (
        <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/60 p-3 font-mono text-[11px] leading-relaxed text-zinc-300 ring-1 ring-white/5">
          {content}
        </pre>
      )}
    </div>
  );
}

export function Inspector({ selection, onClose, onThink, onArchive, thinkBusy, onOpenTask, onOpenFile, events, agents }: {
  selection: Selection;
  onClose: () => void;
  onThink: (n: string) => void;
  onArchive: (n: string) => void;
  thinkBusy: string | null;
  onOpenTask: (t: TaskInfo) => void;
  onOpenFile: (agent: string, taskId: string, path: string) => void;
  events: import("./api").AgentEvent[];
  agents: import("./api").AgentInfo[];
}) {
  if (!selection) return null;
  const unread = selection.type === "agent" ? agents.find((a) => a.name === selection.agent)?.unread || 0 : 0;
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500">Inspector</span>
        <button onClick={onClose} className="ml-auto rounded-md p-1 text-zinc-500 hover:text-zinc-300" title="Close">
          <X size={15} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {selection.type === "agent" && (
          <InspectorAgent name={selection.agent} thinkBusy={thinkBusy} onThink={onThink} onArchive={onArchive} onOpenTask={onOpenTask} unread={unread} />
        )}
        {selection.type === "task" && (
          <InspectorTask task={selection.task} events={events} onOpenFile={onOpenFile} />
        )}
        {selection.type === "file" && (
          <InspectorFile agent={selection.agent} taskId={selection.taskId} path={selection.path} />
        )}
      </div>
    </div>
  );
}
