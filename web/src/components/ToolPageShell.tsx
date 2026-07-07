/**
 * ToolPageShell — Shared premium wrapper for all OrbitX tool pages.
 * Provides consistent header, section cards, and filter pill styling.
 */
import React from "react";
import { cn } from "@/lib/utils";

/* ─── Tool Page Header ─── */
interface ToolHeaderProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  gradient: string;      // tailwind gradient classes (e.g. "from-emerald-500 to-green-400")
  glowColor?: string;    // CSS color for glow (e.g. "rgba(16,185,129,0.25)")
  badge?: string;
  badgeColor?: "lime" | "red" | "orange" | "cyan" | "gold";
  rightSlot?: React.ReactNode;
}

export const ToolHeader: React.FC<ToolHeaderProps> = ({
  icon: Icon, title, subtitle, gradient, glowColor, badge, badgeColor = "lime", rightSlot,
}) => (
  <div className="flex flex-wrap items-start justify-between gap-3">
    <div className="flex items-start gap-3">
      <div
        className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-lg", gradient)}
        style={glowColor ? { boxShadow: `0 8px 24px -6px ${glowColor}` } : undefined}
      >
        <Icon className="h-5 w-5 text-white drop-shadow-md" strokeWidth={2.2} />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-base font-black text-white tracking-tight">{title}</h2>
          {badge && (
            <span className={cn(
              "rounded-md px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider",
              badgeColor === "red"    ? "bg-red-500/15 text-red-400" :
              badgeColor === "orange" ? "bg-orange-500/15 text-orange-400" :
              badgeColor === "cyan"   ? "bg-og-cyan/15 text-og-cyan" :
              badgeColor === "gold"   ? "bg-og-gold/15 text-og-gold" :
                                        "bg-og-lime/15 text-og-lime",
            )}>
              {badge}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[10px] text-white/30 leading-relaxed max-w-md">{subtitle}</p>
      </div>
    </div>
    {rightSlot && <div className="flex items-center gap-2">{rightSlot}</div>}
  </div>
);

/* ─── Section Card ─── */
interface SectionCardProps {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export const SectionCard: React.FC<SectionCardProps> = ({ children, className, noPadding }) => (
  <div className={cn(
    "rounded-2xl glass-card",
    !noPadding && "p-4",
    className,
  )}>
    {children}
  </div>
);

/* ─── Section Divider with label ─── */
export const SectionDivider: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center gap-3 py-1">
    <div className="h-px flex-1 bg-gradient-to-r from-white/[0.06] to-transparent" />
    <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/20">{label}</span>
    <div className="h-px flex-1 bg-gradient-to-l from-white/[0.06] to-transparent" />
  </div>
);

/* ─── Filter Pill ─── */
interface FilterPillProps {
  label: string;
  active: boolean;
  onClick: () => void;
  icon?: React.ComponentType<{ className?: string }>;
  count?: number;
}

export const FilterPill: React.FC<FilterPillProps> = ({ label, active, onClick, icon: Icon, count }) => (
  <button
    onClick={onClick}
    className={cn(
      "flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-[10px] font-bold transition-all duration-200",
      active
        ? "bg-white/10 text-white shadow-[0_0_10px_rgba(255,255,255,0.03)]"
        : "bg-white/[0.03] text-white/30 hover:bg-white/[0.06] hover:text-white/50",
    )}
  >
    {Icon && <Icon className={cn("h-3 w-3", active ? "text-og-lime" : "text-white/20")} />}
    {label}
    {count !== undefined && (
      <span className={cn(
        "ml-0.5 rounded-full px-1.5 py-0.5 text-[8px] font-black",
        active ? "bg-white/10 text-white/60" : "bg-white/[0.04] text-white/20",
      )}>
        {count}
      </span>
    )}
  </button>
);

/* ─── Stat Chip (for inline metrics) ─── */
interface StatChipProps {
  label: string;
  value: string | number;
  trend?: "up" | "down" | "neutral";
}

export const StatChip: React.FC<StatChipProps> = ({ label, value, trend }) => (
  <div className="flex flex-col items-center rounded-xl px-3 py-2 glass-sm">
    <span className="text-[8px] font-bold uppercase tracking-widest text-white/20">{label}</span>
    <span className={cn(
      "mt-0.5 text-sm font-black",
      trend === "up" ? "text-og-lime" : trend === "down" ? "text-red-400" : "text-white/70",
    )}>
      {value}
    </span>
  </div>
);

/* ─── Empty State ─── */
interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, description }) => (
  <div className="flex flex-col items-center justify-center py-16">
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl glass-sm">
      <Icon className="h-6 w-6 text-white/30" />
    </div>
    <p className="mt-3 text-[12px] font-bold text-white/50">{title}</p>
    {description && <p className="mt-1 text-[10px] text-white/30">{description}</p>}
  </div>
);

/* ─── Loading State ─── */
export const LoadingState: React.FC<{ text?: string }> = ({ text = "Loading..." }) => (
  <div className="flex flex-col items-center justify-center py-16">
    <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-og-lime" />
    <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-white/40">{text}</p>
  </div>
);

/* ─── Emerald Header (matches OrbitX Scanner shell) ─── */
interface EmeraldHeaderProps {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  subtitle?: string;
  badge?: string;
  right?: React.ReactNode;
}
export const EmeraldHeader: React.FC<EmeraldHeaderProps> = ({ icon: Icon, title, subtitle, badge, right }) => (
  <div className="relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.06] via-white/[0.02] to-transparent p-5">
    <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-emerald-500/20 blur-3xl" />
    <div className="relative flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-400 shadow-lg shadow-emerald-500/30">
          <Icon className="h-6 w-6 text-white" strokeWidth={2.2} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black tracking-tight text-white">{title}</h2>
            {badge && <span className="rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-300">{badge}</span>}
          </div>
          {subtitle && <p className="mt-1 max-w-md text-xs leading-relaxed text-white/45">{subtitle}</p>}
        </div>
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  </div>
);

/* ─── Segmented Tabs (emerald pill nav) ─── */
interface SegTab<T extends string> { id: T; label: string; Icon?: React.ComponentType<{ className?: string }>; }
export function SegmentedTabs<T extends string>({ tabs, active, onChange }: { tabs: SegTab<T>[]; active: T; onChange: (t: T) => void; }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3.5 py-2 text-[11px] font-bold transition",
            active === t.id ? "border-emerald-400/50 bg-emerald-500/[0.08] text-emerald-300" : "border-white/10 bg-white/[0.03] text-white/40 hover:text-white/70",
          )}
        >
          {t.Icon && <t.Icon className={cn("h-3.5 w-3.5", active === t.id ? "text-emerald-300" : "text-white/30")} />}
          {t.label}
        </button>
      ))}
    </div>
  );
}
