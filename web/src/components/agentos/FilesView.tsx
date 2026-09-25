/* Agent OS v2 — Files: workspace explorer + website gallery. */
import { useCallback, useEffect, useState } from "react";
import {
  FolderOpen,
  FileCode2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Eye,
  RefreshCw,
  LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type AgentInfo,
  type TaskInfo,
  type TaskFile,
  postCommand,
  timeAgo,
} from "./api";
import { btnGhost, EmptyState, LoadingState, StatusPill } from "./ui";

interface TaskWithFiles extends TaskInfo {
  files: TaskFile[];
}

export function FilesView({ agents, defaultAgent, onOpenFile, onOpenTask }: {
  agents: AgentInfo[];
  defaultAgent: string | null;
  onOpenFile: (agent: string, taskId: string, path: string) => void;
  onOpenTask: (task: TaskInfo) => void;
}) {
  const [tab, setTab] = useState<"explorer" | "gallery">("gallery");
  const [agentName, setAgentName] = useState<string>(defaultAgent || agents[0]?.name || "");
  const [tasks, setTasks] = useState<TaskWithFiles[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [gallery, setGallery] = useState<{ agent: string; task: TaskInfo; html: string }[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);

  const loadExplorer = useCallback(async (name: string) => {
    if (!name) return;
    setLoading(true);
    try {
      const j = await postCommand({ action: "tasks", name, quiet: true });
      const list = ((j.tasks || []) as TaskInfo[]).map((t) => ({ ...t, agent: name }));
      const withFiles: TaskWithFiles[] = await Promise.all(
        list.map(async (t) => {
          try {
            const f = await postCommand({ action: "files", task_id: t.id, quiet: true });
            return { ...t, files: (f.files || []) as TaskFile[] };
          } catch {
            return { ...t, files: [] as TaskFile[] };
          }
        }),
      );
      setTasks(withFiles.sort((a, b) => (a.created_at < b.created_at ? 1 : -1)));
      const first = withFiles.find((t) => t.files.length > 0);
      setExpanded(new Set(first ? [first.id] : []));
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadGallery = useCallback(async () => {
    setGalleryLoading(true);
    try {
      const active = agents.filter((a) => a.status === "active");
      const perAgent = await Promise.all(
        active.map((a) =>
          postCommand({ action: "tasks", name: a.name, quiet: true })
            .then((j) => ({ agent: a.name, tasks: (j.tasks || []) as TaskInfo[] }))
            .catch(() => ({ agent: a.name, tasks: [] as TaskInfo[] })),
        ),
      );
      const sites: { agent: string; task: TaskInfo }[] = [];
      for (const { agent, tasks: list } of perAgent) {
        for (const t of list) {
          if (t.kind === "website" && t.status !== "failed") sites.push({ agent, task: { ...t, agent } });
        }
      }
      const rendered = await Promise.all(
        sites.map(async ({ agent, task }) => {
          try {
            const f = await postCommand({ action: "files", task_id: task.id, quiet: true });
            const files = (f.files || []) as TaskFile[];
            const idx = files.find((x) => x.path === "index.html") || files.find((x) => x.path.endsWith(".html"));
            if (!idx) return null;
            const c = await postCommand({ action: "file", task_id: task.id, path: idx.path, quiet: true });
            if (typeof c.content !== "string" || !c.content.trim()) return null;
            return { agent, task, html: c.content as string };
          } catch {
            return null;
          }
        }),
      );
      setGallery(rendered.filter(Boolean) as { agent: string; task: TaskInfo; html: string }[]);
    } catch {
      setGallery([]);
    } finally {
      setGalleryLoading(false);
    }
  }, [agents]);

  useEffect(() => {
    if (tab === "explorer") loadExplorer(agentName);
    else loadGallery();
  }, [tab, agentName, loadExplorer, loadGallery]);

  useEffect(() => {
    if (defaultAgent) setAgentName(defaultAgent);
  }, [defaultAgent]);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const totalFiles = tasks.reduce((s, t) => s + t.files.length, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-lg font-bold text-zinc-100">Files</h2>
          <p className="text-[11px] text-zinc-500">every file your agents have written, live from their workspaces</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex gap-1 rounded-lg bg-black/40 p-1">
            {(["gallery", "explorer"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-semibold capitalize transition",
                  tab === t ? "bg-emerald-400/15 text-emerald-300" : "text-zinc-500 hover:text-zinc-300",
                )}
              >
                {t}
              </button>
            ))}
          </div>
          {tab === "explorer" ? (
            <>
              <select
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                className="rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-xs text-zinc-200 outline-none"
              >
                {agents.map((a) => (
                  <option key={a.name} value={a.name}>
                    {a.name}
                  </option>
                ))}
              </select>
              <button onClick={() => loadExplorer(agentName)} disabled={loading} className={btnGhost} title="Refresh">
                <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              </button>
            </>
          ) : (
            <button onClick={loadGallery} disabled={galleryLoading} className={btnGhost} title="Refresh gallery">
              <RefreshCw size={13} className={galleryLoading ? "animate-spin" : ""} />
            </button>
          )}
        </div>
      </div>

      {tab === "gallery" ? (
        galleryLoading && gallery.length === 0 ? (
          <LoadingState label="Scanning agent workspaces…" />
        ) : gallery.length === 0 ? (
          <EmptyState
            icon={LayoutGrid}
            title="No websites yet"
            body="When an agent builds a website, its live preview appears here as a card. Dispatch a website task to see it happen."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {gallery.map(({ agent, task, html }) => (
              <div key={task.id} className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
                <div className="relative aspect-[16/10] bg-white">
                  <iframe
                    title={`Site preview: ${task.title}`}
                    sandbox="allow-scripts"
                    srcDoc={html}
                    className="pointer-events-none h-full w-full"
                    loading="lazy"
                  />
                </div>
                <div className="flex items-center gap-2 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-zinc-100">{task.title}</p>
                    <p className="mt-0.5 flex items-center gap-2 text-[11px] text-zinc-500">
                      <span className="font-mono text-emerald-300/80">{agent}</span>
                      <StatusPill status={task.status} />
                      <span>{timeAgo(task.created_at)}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => onOpenTask(task)}
                    className={cn(btnGhost, "!text-emerald-300")}
                    title="Open full preview"
                  >
                    <Eye size={13} /> Open
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : loading && tasks.length === 0 ? (
        <LoadingState label={`Loading ${agentName}'s workspace…`} />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="Workspace is empty"
          body={`${agentName || "This agent"} hasn't written any files yet. Files appear here the moment an agent writes them.`}
        />
      ) : (
        <div className="space-y-2">
          <p className="text-[11px] text-zinc-500">
            {totalFiles} files across {tasks.length} tasks
          </p>
          {tasks.map((t) => {
            const open = expanded.has(t.id);
            return (
              <div key={t.id} className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
                <button
                  onClick={() => toggle(t.id)}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition hover:bg-white/[0.03]"
                >
                  {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  <FolderOpen size={14} className="shrink-0 text-amber-300/80" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-100">{t.title}</span>
                  <span className="shrink-0 rounded-full bg-black/40 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
                    {t.kind}
                  </span>
                  <StatusPill status={t.status} />
                  <span className="shrink-0 font-mono text-[10px] text-zinc-500">{t.files.length} files</span>
                </button>
                {open && (
                  <div className="border-t border-white/5 px-3 py-2">
                    {t.files.length === 0 ? (
                      <p className="py-2 text-xs text-zinc-600">No files in this task yet.</p>
                    ) : (
                      <div className="space-y-1">
                        {t.files.map((f) => (
                          <button
                            key={f.path}
                            onClick={() => onOpenFile(t.agent || agentName, t.id, f.path)}
                            className="flex w-full items-center gap-2 rounded-md bg-black/30 px-2.5 py-1.5 text-left ring-1 ring-white/5 transition hover:bg-white/[0.05]"
                          >
                            <FileCode2 size={13} className="shrink-0 text-amber-300/80" />
                            <span className="min-w-0 flex-1 truncate font-mono text-xs text-zinc-200">{f.path}</span>
                            <span className="shrink-0 font-mono text-[10px] text-zinc-600">v{f.version}</span>
                            <span className="shrink-0 font-mono text-[10px] text-zinc-600">
                              {(f.size / 1024).toFixed(1)}k
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
