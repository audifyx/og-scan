import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  body,
  className,
}: {
  icon: ReactNode;
  title: string;
  body?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full min-h-28 flex-col items-center justify-center gap-2 px-6 py-8 text-center",
        className,
      )}
    >
      <div className="relative mb-1 flex size-11 items-center justify-center rounded-md bg-bg-hover text-accent">
        <span className="ox-radar-ring absolute inset-0 rounded-md border border-accent/30" />
        {icon}
      </div>
      <p className="text-sm font-medium text-fg">{title}</p>
      {body ? <p className="max-w-xs text-xs leading-relaxed text-muted">{body}</p> : null}
    </div>
  );
}

export function Dash({ className }: { className?: string }) {
  return <span className={cn("ox-stat text-dim", className)}>—</span>;
}
