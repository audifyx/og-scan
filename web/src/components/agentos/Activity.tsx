/* Agent OS v2 — Activity: merged chronological timeline across all agents. */
import { useMemo, useState } from "react";
import { Radio, ChevronDown, ChevronRight, FileCode2, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type AgentEvent,
  type AgentInfo,
  extractUrls,
  parseFileBody,
  formatTime,
} from "./api";
import { kindMeta, EmptyState } from "./ui";

/* ── single event card (also reused by the inspector) ── */
export function EventCard({ ev, expandedFiles, onToggleFile }: {
  ev: AgentEvent;
  expandedFiles: Set<string | number>;
  onToggleFile: (id: string | number) => void;
}) {
  const meta = kindMeta(ev.kind);
  const Icon = meta.Icon;

  const renderBody = () => {
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
            onClick={() => onToggleFile(ev.id)}
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

  return (
    <div className="flex gap-2.5 rounded-lg border border-white/5 bg-black/30 px-3 py-2.5">
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
        <div className="mt-1 text-sm text-zinc-200">{renderBody()}</div>
      </div>
    </div>
  );
}

const ALL_KINDS = ["thought", "action", "file", "message", "build", "deploy", "error", "system"];

export function Activity({ events, agents, expandedFiles, onToggleFile }: {
  events: AgentEvent[];
  agents: AgentInfo[];
  expandedFiles: Set<string | number>;
  onToggleFile: (id: string | number) => void;
}) {
  const [kindFilter, setKindFilter] = useState<Set<string>>(new Set(ALL_KINDS));
  const [agentFilter, setAgentFilter] = useState<string>("");

  const toggleKind = (k: string) => {
    setKindFilter((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of events) c[e.kind] = (c[e.kind] || 0) + 1;
    return c;
  }, [events]);

  const filtered = useMemo(
    () =>
      [...events]
        .filter((e) => kindFilter.has(e.kind))
        .filter((e) => !agentFilter || e.agent === agentFilter)
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
    [events, kindFilter, agentFilter],
  );

  return (
    <div className="flex flex-col gap-3">
      {/* filter bar */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.02] p-2.5">
        <span className="mr-1 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          <Radio size={11} /> Stream
        </span>
        {ALL_KINDS.map((k) => {
          const meta = kindMeta(k);
          const on = kindFilter.has(k);
          return (
            <button
              key={k}
              onClick={() => toggleKind(k)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] ring-1 transition",
                on ? "bg-white/[0.06] text-zinc-200 ring-white/15" : "text-zinc-600 ring-white/5 hover:text-zinc-400",
              )}
              title={`${counts[k] || 0} ${meta.label.toLowerCase()} events`}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", on ? meta.dot : "bg-zinc-700")} />
              {meta.label}
              <span className="font-mono text-zinc-500">{counts[k] || 0}</span>
            </button>
          );
        })}
        <select
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
          className="ml-auto rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-[11px] text-zinc-300 outline-none"
        >
          <option value="">All agents</option>
          {agents.map((a) => (
            <option key={a.name} value={a.name}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      {/* timeline */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Radio}
          title="Nothing in the stream"
          body="Events appear here in real time as agents think, act, write files, and deploy. Adjust the filters above."
        />
      ) : (
        <div className="space-y-2">
          {filtered.slice(0, 150).map((ev) => (
            <EventCard key={ev.id} ev={ev} expandedFiles={expandedFiles} onToggleFile={onToggleFile} />
          ))}
          {filtered.length > 150 && (
            <p className="py-2 text-center text-[11px] text-zinc-600">
              showing latest 150 of {filtered.length} — refine filters to see more
            </p>
          )}
        </div>
      )}
    </div>
  );
}
