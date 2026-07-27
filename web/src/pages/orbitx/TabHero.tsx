// Shared page chrome for OrbitX launchpad tabs — Solana purple/green identity.
import type { LucideIcon } from "lucide-react";

export function TabHero({
  icon: Icon,
  eyebrow,
  title,
  subtitle,
  accent = "green",
  actions,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  subtitle?: string;
  accent?: "green" | "purple" | "gold" | "red";
  actions?: React.ReactNode;
}) {
  const tone =
    accent === "purple" ? "hsl(var(--pf-blue))"
    : accent === "gold" ? "hsl(var(--pf-gold))"
    : accent === "red" ? "hsl(var(--pf-red))"
    : "hsl(var(--pf-green))";

  return (
    <div className="ox-tab-hero mb-5 overflow-hidden rounded-2xl border border-[hsl(var(--pf-border))]/80 p-4 sm:p-5"
      style={{
        background: `linear-gradient(135deg, hsl(var(--pf-bg-2) / 0.95), hsl(263 60% 12% / 0.55) 55%, hsl(158 50% 10% / 0.4))`,
        boxShadow: `inset 0 1px 0 hsl(0 0% 100% / 0.05), 0 0 40px -20px ${tone}`,
      }}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border"
            style={{
              borderColor: `${tone}55`,
              background: `linear-gradient(145deg, ${tone}22, transparent)`,
              color: tone,
            }}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="pf-mono text-[10px] font-bold uppercase tracking-[0.28em]" style={{ color: tone }}>
              {eyebrow}
            </div>
            <h1 className="mt-0.5 text-xl font-black tracking-tight text-[hsl(var(--pf-ink))] sm:text-2xl">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[hsl(var(--pf-muted))]">{subtitle}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
