/* Agent OS v2 — Fleet view: live agent cards. */
import { useMemo } from "react";
import { Bot, Plus, Play, Archive, MessageSquarePlus, ChevronRight, Brain, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type AgentInfo,
  type AgentEvent,
  timeAgo,
} from "./api";
import {
  cardCls,
  btnPrimary,
  btnGhost,
  MindBadge,
  ProgressBar,
  ThinkErrorBanner,
  EmptyState,
  SectionTitle,
} from "./ui";

export interface FleetProps {
  agents: AgentInfo[];
  events: AgentEvent[];
  live: boolean;
  thinkBusy: string | null;
  onThink: (name: string) => void;
  onArchive: (name: string) => void;
  onSelect: (name: string) => void;
  onSpawn: () => void;
  onDispatchTask: (agent: string) => void;
  onMessage: (agent: string) => void;
}

export function Fleet({ agents, events, live, thinkBusy, onThink, onArchive, onSelect, onSpawn, onDispatchTask, onMessage }: FleetProps) {
  const lastThought = useMemo(() => {
    const map = new Map<string, { body: string; at: string }>();
    for (const e of events) {
      if (e.kind !== "thought") continue;
      const prev = map.get(e.agent);
      if (!prev || e.created_at > prev.at) map.set(e.agent, { body: e.body, at: e.created_at });
    }
    return map;
  }, [events]);

  const lastActivity = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of events) {
      const prev = map.get(e.agent);
      if (!prev || e.created_at > prev) map.set(e.agent, e.created_at);
    }
    return map;
  }, [events]);

  const errorCount = agents.filter((a) => a.last_think_error).length;

  return (
    <div className="space-y-4">
      {/* fleet header stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className={cardCls}>
          <div className="text-2xl font-bold text-zinc-100">{agents.length}</div>
          <div className="text-[11px] uppercase tracking-wider text-zinc-500">agents</div>
        </div>
        <div className={cardCls}>
          <div className="flex items-center gap-1.5 text-2xl font-bold text-emerald-300">
            <span className="relative flex h-2.5 w-2.5">
              {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
              <span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", live ? "bg-emerald-400" : "bg-zinc-500")} />
            </span>
            {agents.filter((a) => a.mind === "live").length}
          </div>
          <div className="text-[11px] uppercase tracking-wider text-zinc-500">minds live</div>
        </div>
        <div className={cardCls}>
          <div className="text-2xl font-bold text-zinc-100">{agents.reduce((s, a) => s + (a.thinks_today || 0), 0)}</div>
          <div className="text-[11px] uppercase tracking-wider text-zinc-500">thinks today</div>
        </div>
        <div className={cardCls}>
          <div className={cn("text-2xl font-bold", errorCount > 0 ? "text-red-300" : "text-zinc-100")}>{errorCount}</div>
          <div className="text-[11px] uppercase tracking-wider text-zinc-500">failing</div>
        </div>
      </div>

      {agents.length === 0 ? (
        <EmptyState
          icon={Bot}
          title="No agents yet"
          body="Spawn your first agent — give it a name, a role, and a persona, then watch it start thinking on the server."
          action={
            <button onClick={onSpawn} className={btnPrimary}>
              <Plus size={14} /> Spawn your first agent
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {agents.map((a) => {
            const t = lastThought.get(a.name);
            const act = lastActivity.get(a.name);
            const budget = a.think_budget_per_day || 0;
            const used = a.thinks_today || 0;
            const thinking = thinkBusy === a.name;
            return (
              <div
                key={a.name}
                className="group flex flex-col rounded-xl border border-white/10 bg-white/[0.02] p-4 transition hover:border-emerald-400/30 hover:bg-white/[0.04]"
              >
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-emerald-400/10 p-1.5 ring-1 ring-emerald-400/30">
                    <Bot size={16} className="text-emerald-300" />
                  </div>
                  <button onClick={() => onSelect(a.name)} className="min-w-0 flex-1 truncate text-left font-mono text-sm font-bold text-zinc-100 hover:text-emerald-200">
                    {a.name}
                  </button>
                  <MindBadge mind={a.mind} />
                  {(a.active_schedules || 0) > 0 && (
                    <span className="flex items-center gap-1 rounded-full bg-sky-400/10 px-1.5 py-0.5 text-[10px] font-bold text-sky-300 ring-1 ring-sky-400/30" title={`${a.active_schedules} wake-up schedule${a.active_schedules === 1 ? "" : "s"}`}>
                      <Clock size={10} />{a.active_schedules}
                    </span>
                  )}
                  {a.unread > 0 && (
                    <span className="rounded-full bg-emerald-400/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300" title={`${a.unread} unread messages`}>
                      {a.unread}
                    </span>
                  )}
                </div>

                {a.last_think_error && (
                  <div className="mt-2">
                    <ThinkErrorBanner err={a.last_think_error} compact />
                  </div>
                )}

                {t ? (
                  <p className="mt-2.5 line-clamp-3 min-h-[3.2rem] text-xs leading-relaxed text-zinc-400">
                    <span className="mr-1 font-semibold text-violet-300/80">last thought</span>
                    {t.body.slice(0, 220)}
                    {t.body.length > 220 && "…"}
                  </p>
                ) : (
                  <p className="mt-2.5 min-h-[3.2rem] text-xs italic text-zinc-600">no thoughts logged yet</p>
                )}

                <div className="mt-2">
                  <div className="mb-1 flex items-center justify-between text-[10px] text-zinc-500">
                    <span className="uppercase tracking-wider">think budget</span>
                    <span className="font-mono">
                      {used}/{budget || "—"}
                    </span>
                  </div>
                  <ProgressBar done={used} total={budget} barCls={used >= budget && budget > 0 ? "bg-red-400" : "bg-emerald-400"} />
                </div>

                <div className="mt-2.5 flex items-center justify-between text-[10px] text-zinc-600">
                  <span>{act ? `active ${timeAgo(act)}` : "no activity"}</span>
                  <span className="font-mono">{a.status}</span>
                </div>

                <div className="mt-3 flex items-center gap-1.5 border-t border-white/5 pt-3">
                  <button
                    onClick={() => onThink(a.name)}
                    disabled={thinking}
                    className={cn(btnGhost, "!text-emerald-300")}
                    title="Force the server-side mind to think now"
                  >
                    <Play size={12} className={thinking ? "animate-spin" : ""} />
                    {thinking ? "Thinking…" : "Think now"}
                  </button>
                  <button onClick={() => onDispatchTask(a.name)} className={btnGhost} title="Assign a task">
                    <MessageSquarePlus size={12} /> Task
                  </button>
                  <button onClick={() => onMessage(a.name)} className={btnGhost} title="Message this agent">
                    DM
                  </button>
                  <div className="ml-auto flex gap-1.5">
                    <button onClick={() => onSelect(a.name)} className={btnGhost} title="Open in inspector">
                      <ChevronRight size={12} />
                    </button>
                    <button
                      onClick={() => onArchive(a.name)}
                      className={cn(btnGhost, "hover:!bg-red-400/10 hover:!text-red-300")}
                      title="Archive (kill switch)"
                    >
                      <Archive size={12} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* spawn card */}
          <button
            onClick={onSpawn}
            className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 p-4 text-zinc-500 transition hover:border-emerald-400/40 hover:bg-emerald-400/[0.03] hover:text-emerald-300"
          >
            <Plus size={22} />
            <span className="text-sm font-semibold">Spawn agent</span>
            <span className="text-[11px] text-zinc-600">website builder · researcher · trader</span>
          </button>
        </div>
      )}

      {/* mind mode legend */}
      <div className={cardCls}>
        <SectionTitle icon={Brain}>Mind mode</SectionTitle>
        <p className="text-[11px] leading-relaxed text-zinc-500">
          <span className="font-semibold text-emerald-300">live</span> = this agent thinks on the server; its thoughts
          appear verbatim in the activity stream.{" "}
          <span className="font-semibold text-zinc-300">driver</span> = no LLM key configured; advances when driven
          via MCP by an external LLM.
        </p>
      </div>
    </div>
  );
}
