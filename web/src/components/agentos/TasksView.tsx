/* Agent OS v2 — Tasks: cross-agent kanban board. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { ListChecks, Plus, RefreshCw, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type AgentInfo,
  type TaskInfo,
  postCommand,
  taskProgress,
  timeAgo,
} from "./api";
import { btnPrimary, btnGhost, ProgressBar, EmptyState, LoadingState, StatusPill } from "./ui";

const COLUMNS = [
  { id: "open", title: "Open" },
  { id: "in_progress", title: "In progress" },
  { id: "done", title: "Done" },
  { id: "failed", title: "Failed" },
] as const;

export function TasksView({ agents, onOpenTask, onDispatch }: {
  agents: AgentInfo[];
  onOpenTask: (task: TaskInfo) => void;
  onDispatch: (agent?: string) => void;
}) {
  const [tasks, setTasks] = useState<TaskInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const active = agents.filter((a) => a.status === "active");
      const results = await Promise.all(
        active.map((a) =>
          postCommand({ action: "tasks", name: a.name, quiet: true })
            .then((j) => ((j.tasks || []) as TaskInfo[]).map((t) => ({ ...t, agent: a.name })))
            .catch(() => [] as TaskInfo[]),
        ),
      );
      const merged = results.flat().sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      setTasks(merged);
    } catch {
      /* keep stale */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [agents]);

  useEffect(() => {
    load();
    const t = window.setInterval(() => load(true), 15000);
    return () => window.clearInterval(t);
  }, [load]);

  const byStatus = useMemo(() => {
    const m: Record<string, TaskInfo[]> = { open: [], in_progress: [], done: [], failed: [] };
    for (const t of tasks) {
      const k = m[t.status] ? t.status : "open";
      m[k].push(t);
    }
    return m;
  }, [tasks]);

  const totalSteps = tasks.reduce((s, t) => s + (t.steps || []).length, 0);
  const doneSteps = tasks.reduce((s, t) => s + taskProgress(t).done, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-lg font-bold text-zinc-100">Tasks</h2>
          <p className="text-[11px] text-zinc-500">
            {tasks.length} tasks · {doneSteps}/{totalSteps} steps complete · across {agents.filter((a) => a.status === "active").length} agents
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={() => load(true)} disabled={refreshing} className={btnGhost} title="Refresh">
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
          </button>
          <button onClick={() => onDispatch()} className={cn(btnPrimary, "!py-1.5 text-xs")}>
            <Plus size={14} /> Dispatch task
          </button>
        </div>
      </div>

      {loading && tasks.length === 0 ? (
        <LoadingState label="Loading tasks…" />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No tasks yet"
          body="Dispatch a task and agents will pick it up — try “build me a website about…”."
          action={
            <button onClick={() => onDispatch()} className={btnPrimary}>
              <Plus size={14} /> Dispatch your first task
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((col) => (
            <div key={col.id} className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-2.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500">{col.title}</span>
                <span className="rounded-full bg-black/40 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                  {byStatus[col.id].length}
                </span>
              </div>
              <div className="max-h-[60vh] space-y-2 overflow-y-auto">
                {byStatus[col.id].map((t) => {
                  const p = taskProgress(t);
                  return (
                    <button
                      key={t.id}
                      onClick={() => onOpenTask(t)}
                      className="block w-full rounded-lg border border-white/5 bg-black/30 p-3 text-left transition hover:border-emerald-400/30 hover:bg-black/50"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-zinc-100">{t.title}</span>
                        <ChevronRight size={13} className="shrink-0 text-zinc-600" />
                      </div>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span className="font-mono text-[10px] text-emerald-300/80">{t.agent}</span>
                        <span className="rounded-full bg-black/40 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
                          {t.kind}
                        </span>
                        <StatusPill status={t.status} />
                      </div>
                      {p.total > 0 && (
                        <div className="mt-2">
                          <ProgressBar done={p.done} total={p.total} />
                        </div>
                      )}
                      <div className="mt-1.5 text-[10px] text-zinc-600">{timeAgo(t.created_at)}</div>
                    </button>
                  );
                })}
                {byStatus[col.id].length === 0 && (
                  <p className="py-4 text-center text-[11px] text-zinc-700">—</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
