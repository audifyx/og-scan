/**
 * ToolPageShell — Shared premium wrapper for all OG Scan tool pages.
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
      <Icon className="h-6 w-6 text-white/[0.08]" />
    </div>
    <p className="mt-3 text-[12px] font-bold text-white/20">{title}</p>
    {description && <p className="mt-1 text-[10px] text-white/10">{description}</p>}
  </div>
);

/* ─── Loading State ─── */
export const LoadingState: React.FC<{ text?: string }> = ({ text = "Loading..." }) => (
  <div className="flex flex-col items-center justify-center py-16">
    <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-og-lime" />
    <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-white/20">{text}</p>
  </div>
);
