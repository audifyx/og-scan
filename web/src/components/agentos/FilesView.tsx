/* Agent OS v2 — Files: workspace explorer (real folder tree) + website gallery. */
import { useCallback, useEffect, useState } from "react";
import {
  Folder,
  FolderOpen,
  FileCode2,
  FileText,
  ChevronDown,
  ChevronRight,
  Loader2,
  Eye,
  RefreshCw,
  LayoutGrid,
  Trash2,
  Pencil,
  Download,
  Plus,
  FilePlus2,
  X,
  Check,
  Braces,
  Globe,
  Image as ImageIcon,
  Palette,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type AgentInfo,
  type TaskInfo,
  type TaskFile,
  postCommand,
  authedFetch,
  EXPORT_PATH,
  timeAgo,
} from "./api";
import { btnGhost, EmptyState, LoadingState, StatusPill } from "./ui";

export interface FileTreeNode {
  name: string;
  type: "dir" | "file";
  children?: FileTreeNode[];
  path?: string;
  version?: number;
  size?: number;
  sha256?: string;
  updated_at?: string;
}

interface TaskWithFiles extends TaskInfo {
  files: TaskFile[];
  tree: FileTreeNode[];
  quota?: { used: number; max: number };
}

function extIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (["ts", "tsx", "js", "jsx", "mjs", "cjs", "py", "rs", "go", "sol"].includes(ext))
    return <FileCode2 size={13} className="shrink-0 text-sky-300/80" />;
  if (ext === "json") return <Braces size={13} className="shrink-0 text-amber-300/80" />;
  if (ext === "html" || ext === "htm") return <Globe size={13} className="shrink-0 text-emerald-300/80" />;
  if (ext === "css" || ext === "scss") return <Palette size={13} className="shrink-0 text-violet-300/80" />;
  if (ext === "md" || ext === "txt") return <FileText size={13} className="shrink-0 text-zinc-400" />;
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext))
    return <ImageIcon size={13} className="shrink-0 text-pink-300/80" />;
  return <FileCode2 size={13} className="shrink-0 text-zinc-500" />;
}

function fmtSize(n: number) {
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)}M`;
  return `${(n / 1024).toFixed(1)}k`;
}

async function downloadBlob(url: string, filename: string) {
  const res = await authedFetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 5000);
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
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());
  const [gallery, setGallery] = useState<{ agent: string; task: TaskInfo; html: string }[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  // inline editor: {taskId, mode, target}
  const [editing, setEditing] = useState<{ taskId: string; mode: "new" | "rename"; target?: string } | null>(null);
  const [editValue, setEditValue] = useState("");

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
            return { ...t, files: (f.files || []) as TaskFile[], tree: (f.tree || []) as FileTreeNode[], quota: f.quota };
          } catch {
            return { ...t, files: [] as TaskFile[], tree: [] as FileTreeNode[] };
          }
        }),
      );
      const sorted = withFiles.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      setTasks(sorted);
      const first = sorted.find((t) => t.files.length > 0);
      setExpanded(new Set(first ? [first.id] : []));
      // auto-open top-level folders of the first task with files
      if (first) {
        const tops = new Set<string>();
        for (const n of first.tree) if (n.type === "dir") tops.add(`${first.id}/${n.name}`);
        setOpenFolders(tops);
      }
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
            const html = (c.file?.content ?? c.content) as string | undefined;
            if (typeof html !== "string" || !html.trim()) return null;
            return { agent, task, html };
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

  const toggleFolder = (key: string) =>
    setOpenFolders((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const refresh = () => loadExplorer(agentName);

  const doDelete = async (taskId: string, node: FileTreeNode, fullPath: string) => {
    const isDir = node.type === "dir";
    const label = isDir ? `folder "${fullPath}/" and everything inside it` : `file "${fullPath}"`;
    if (!window.confirm(`Delete ${label}?\n\nThis cannot be undone.`)) return;
    setBusy(true);
    try {
      await postCommand(isDir ? { action: "delete_file", task_id: taskId, prefix: fullPath } : { action: "delete_file", task_id: taskId, path: fullPath });
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (taskId: string, mode: "new" | "rename", target?: string) => {
    setEditing({ taskId, mode, target });
    setEditValue(target || "");
  };

  const submitEdit = async () => {
    if (!editing || busy) return;
    const v = editValue.trim();
    if (!v) {
      setEditing(null);
      return;
    }
    setBusy(true);
    try {
      if (editing.mode === "new") {
        await postCommand({ action: "write_file", task_id: editing.taskId, path: v, content: "" });
      } else if (editing.target) {
        await postCommand({ action: "rename_file", task_id: editing.taskId, from: editing.target, to: v });
      }
      setEditing(null);
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const downloadFile = async (taskId: string, path: string) => {
    try {
      const c = await postCommand({ action: "file", task_id: taskId, path, quiet: true });
      const content = (c.file?.content ?? c.content) as string | undefined;
      const blob = new Blob([typeof content === "string" ? content : ""], { type: "text/plain;charset=utf-8" });
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = path.split("/").pop() || "file";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 5000);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Download failed");
    }
  };

  const downloadZip = async (task: TaskWithFiles) => {
    try {
      await downloadBlob(`${EXPORT_PATH}&kind=zip&task_id=${encodeURIComponent(task.id)}`, `${task.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) || "workspace"}.zip`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "ZIP download failed");
    }
  };

  const renderTree = (task: TaskWithFiles, nodes: FileTreeNode[], depth: number, parentPath: string) => {
    return nodes.map((n) => {
      const fullPath = parentPath ? `${parentPath}/${n.name}` : n.name;
      if (n.type === "dir") {
        const key = `${task.id}/${fullPath}`;
        const open = openFolders.has(key);
        const isEditing = editing?.taskId === task.id && editing.mode === "rename" && editing.target === fullPath;
        return (
          <div key={key}>
            <div
              className="group flex items-center gap-1.5 rounded-md px-2 py-1 transition hover:bg-white/[0.04]"
              style={{ paddingLeft: 8 + depth * 16 }}
            >
              <button onClick={() => toggleFolder(key)} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
                {open ? <ChevronDown size={13} className="shrink-0 text-zinc-500" /> : <ChevronRight size={13} className="shrink-0 text-zinc-500" />}
                {open ? <FolderOpen size={13} className="shrink-0 text-amber-300/80" /> : <Folder size={13} className="shrink-0 text-amber-300/60" />}
                {isEditing ? (
                  <span className="flex min-w-0 flex-1 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <input
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") submitEdit(); if (e.key === "Escape") setEditing(null); }}
                      className="min-w-0 flex-1 rounded border border-emerald-400/40 bg-black/60 px-1.5 py-0.5 font-mono text-xs text-zinc-100 outline-none"
                    />
                    <button onClick={submitEdit} className="rounded p-0.5 text-emerald-300 hover:bg-white/10" title="Save"><Check size={12} /></button>
                    <button onClick={() => setEditing(null)} className="rounded p-0.5 text-zinc-500 hover:bg-white/10" title="Cancel"><X size={12} /></button>
                  </span>
                ) : (
                  <span className="truncate font-mono text-xs font-semibold text-zinc-200">{n.name}/</span>
                )}
              </button>
              {!isEditing && (
                <span className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
                  <button onClick={() => startEdit(task.id, "rename", fullPath)} className="rounded p-1 text-zinc-500 hover:bg-white/10 hover:text-zinc-200" title="Rename folder">
                    <Pencil size={11} />
                  </button>
                  <button onClick={() => doDelete(task.id, n, fullPath)} disabled={busy} className="rounded p-1 text-zinc-500 hover:bg-white/10 hover:text-red-300" title="Delete folder">
                    <Trash2 size={11} />
                  </button>
                </span>
              )}
            </div>
            {open && renderTree(task, n.children || [], depth + 1, fullPath)}
          </div>
        );
      }
      const isEditing = editing?.taskId === task.id && editing.mode === "rename" && editing.target === fullPath;
      return (
        <div
          key={`${task.id}/${fullPath}`}
          className="group flex items-center gap-1.5 rounded-md px-2 py-1 transition hover:bg-white/[0.04]"
          style={{ paddingLeft: 8 + depth * 16 }}
        >
          <button onClick={() => onOpenFile(task.agent || agentName, task.id, fullPath)} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
            {extIcon(n.name)}
            {isEditing ? (
              <span className="flex min-w-0 flex-1 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <input
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") submitEdit(); if (e.key === "Escape") setEditing(null); }}
                  className="min-w-0 flex-1 rounded border border-emerald-400/40 bg-black/60 px-1.5 py-0.5 font-mono text-xs text-zinc-100 outline-none"
                />
                <button onClick={submitEdit} className="rounded p-0.5 text-emerald-300 hover:bg-white/10" title="Save"><Check size={12} /></button>
                <button onClick={() => setEditing(null)} className="rounded p-0.5 text-zinc-500 hover:bg-white/10" title="Cancel"><X size={12} /></button>
              </span>
            ) : (
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-zinc-200">{n.name}</span>
            )}
          </button>
          {!isEditing && (
            <>
              <span className="shrink-0 font-mono text-[10px] text-zinc-600">v{n.version}</span>
              <span className="shrink-0 font-mono text-[10px] text-zinc-600">{fmtSize(n.size || 0)}</span>
              <span className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
                <button onClick={() => downloadFile(task.id, fullPath)} className="rounded p-1 text-zinc-500 hover:bg-white/10 hover:text-zinc-200" title="Download file">
                  <Download size={11} />
                </button>
                <button onClick={() => startEdit(task.id, "rename", fullPath)} className="rounded p-1 text-zinc-500 hover:bg-white/10 hover:text-zinc-200" title="Rename">
                  <Pencil size={11} />
                </button>
                <button onClick={() => doDelete(task.id, n, fullPath)} disabled={busy} className="rounded p-1 text-zinc-500 hover:bg-white/10 hover:text-red-300" title="Delete file">
                  <Trash2 size={11} />
                </button>
              </span>
            </>
          )}
        </div>
      );
    });
  };

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
            const creating = editing?.taskId === t.id && editing.mode === "new";
            return (
              <div key={t.id} className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
                <div className="flex w-full items-center gap-2 px-3 py-2.5">
                  <button onClick={() => toggle(t.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    {open ? <ChevronDown size={15} className="shrink-0" /> : <ChevronRight size={15} className="shrink-0" />}
                    <FolderOpen size={14} className="shrink-0 text-amber-300/80" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-100">{t.title}</span>
                  </button>
                  <span className="shrink-0 rounded-full bg-black/40 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
                    {t.kind}
                  </span>
                  <StatusPill status={t.status} />
                  <span className="shrink-0 font-mono text-[10px] text-zinc-500" title="workspace quota">
                    {t.quota ? `${fmtSize(t.quota.used)}/${fmtSize(t.quota.max)}` : `${t.files.length} files`}
                  </span>
                  <button
                    onClick={() => startEdit(t.id, "new")}
                    className={btnGhost}
                    title="New file (nested paths like src/ui/Widget.tsx create folders)"
                  >
                    <FilePlus2 size={13} />
                  </button>
                  <button onClick={() => downloadZip(t)} className={btnGhost} title="Download workspace as .zip">
                    <Download size={13} />
                  </button>
                </div>
                {open && (
                  <div className="border-t border-white/5 px-2 py-2">
                    {creating && (
                      <div className="mb-1 flex items-center gap-1.5 rounded-md bg-emerald-400/5 px-2 py-1.5 ring-1 ring-emerald-400/20">
                        <Plus size={13} className="shrink-0 text-emerald-300" />
                        <input
                          autoFocus
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") submitEdit(); if (e.key === "Escape") setEditing(null); }}
                          placeholder="path/to/file.ext — folders are created from the path"
                          className="min-w-0 flex-1 bg-transparent font-mono text-xs text-zinc-100 outline-none placeholder:text-zinc-600"
                        />
                        <button onClick={submitEdit} disabled={busy} className="rounded p-0.5 text-emerald-300 hover:bg-white/10" title="Create">
                          <Check size={13} />
                        </button>
                        <button onClick={() => setEditing(null)} className="rounded p-0.5 text-zinc-500 hover:bg-white/10" title="Cancel">
                          <X size={13} />
                        </button>
                      </div>
                    )}
                    {t.tree.length === 0 && !creating ? (
                      <p className="px-2 py-2 text-xs text-zinc-600">No files in this task yet.</p>
                    ) : (
                      renderTree(t, t.tree, 0, "")
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
