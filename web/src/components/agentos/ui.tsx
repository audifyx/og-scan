/* Agent OS v2 — shared UI primitives (dark OrbitX glassy style). */
import {
  Bot,
  Brain,
  Zap,
  FileCode2,
  MessageSquare,
  Hammer,
  Rocket,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  X,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTime, type ThinkError } from "./api";

export const inputCls =
  "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-emerald-400/60 focus:ring-1 focus:ring-emerald-400/40";

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-400/15 px-4 py-2 text-sm font-semibold text-emerald-300 ring-1 ring-emerald-400/40 transition hover:bg-emerald-400/25 disabled:opacity-50 disabled:cursor-not-allowed";

export const btnGhost =
  "inline-flex items-center justify-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-300 ring-1 ring-white/10 transition hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed";

export const cardCls = "rounded-xl border border-white/10 bg-white/[0.02] p-3";

export function SectionTitle({ icon: Icon, children, right }: { icon?: typeof Zap; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
        {Icon && <Icon size={12} />} {children}
      </h2>
      {right}
    </div>
  );
}

export function ProgressBar({ done, total, barCls = "bg-emerald-400" }: { done: number; total: number; barCls?: string }) {
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

export function ThinkErrorBanner({ err, compact = false }: { err: ThinkError; compact?: boolean }) {
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
      </div>
    </div>
  );
}

export function MindBadge({ mind, pulsing = true }: { mind?: string; pulsing?: boolean }) {
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
        {live && pulsing && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        )}
        <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", live ? "bg-emerald-400" : "bg-zinc-500")} />
      </span>
      <span className={live ? "text-emerald-300" : "text-zinc-400"}>{live ? "live" : mind === "driver" ? "driver" : "?"}</span>
    </span>
  );
}

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1",
        status === "done" || status === "active"
          ? "bg-emerald-400/10 text-emerald-300 ring-emerald-400/30"
          : status === "failed"
            ? "bg-red-400/10 text-red-300 ring-red-400/30"
            : "bg-sky-400/10 text-sky-300 ring-sky-400/30",
      )}
    >
      {status}
    </span>
  );
}

export function EmptyState({
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

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-zinc-500">
      <Loader2 size={18} className="animate-spin text-emerald-400" /> {label}
    </div>
  );
}

export const KIND_META: Record<string, { label: string; color: string; dot: string; Icon: typeof Zap }> = {
  thought: { label: "Thought", color: "text-violet-300", dot: "bg-violet-400", Icon: Brain },
  action: { label: "Action", color: "text-sky-300", dot: "bg-sky-400", Icon: Zap },
  file: { label: "File", color: "text-amber-300", dot: "bg-amber-400", Icon: FileCode2 },
  message: { label: "Message", color: "text-emerald-300", dot: "bg-emerald-400", Icon: MessageSquare },
  build: { label: "Build", color: "text-orange-300", dot: "bg-orange-400", Icon: Hammer },
  deploy: { label: "Deploy", color: "text-lime-300", dot: "bg-lime-400", Icon: Rocket },
  error: { label: "Error", color: "text-red-300", dot: "bg-red-400", Icon: AlertTriangle },
  system: { label: "System", color: "text-zinc-400", dot: "bg-zinc-500", Icon: Bot },
};

export const kindMeta = (kind: string) =>
  KIND_META[kind] || { label: kind, color: "text-zinc-300", dot: "bg-zinc-500", Icon: Bot };

export const STEP_ICON: Record<string, typeof CheckCircle2> = {
  complete: CheckCircle2,
  in_progress: Loader2,
  failed: AlertTriangle,
  skipped: X,
};

export const stepColor = (s: string) =>
  s === "complete"
    ? "text-emerald-300"
    : s === "in_progress"
      ? "text-sky-300"
      : s === "failed"
        ? "text-red-300"
        : "text-zinc-500";

export function StepIcon({ status }: { status: string }) {
  const Icon = STEP_ICON[status] || Clock;
  return <Icon size={14} className={cn("shrink-0", stepColor(status), status === "in_progress" && "animate-spin")} />;
}
