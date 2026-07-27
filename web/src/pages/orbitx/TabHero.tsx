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
    accent === "purple" ? "#9945FF"
    : accent === "gold" ? "#F0B429"
    : accent === "red" ? "#FF4D6D"
    : "#14F195";

  return (
    <div className="ox-tab-hero mb-5">
      <div className="ox-tab-hero-glow" style={{ background: `radial-gradient(500px 180px at 0% 0%, ${tone}33, transparent 70%)` }} />
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3.5">
          <div className="ox-tab-hero-icon" style={{ borderColor: `${tone}66`, color: tone, boxShadow: `0 0 24px -8px ${tone}` }}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="pf-mono text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: tone }}>
              {eyebrow}
            </div>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-[1.75rem]">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-white/55">{subtitle}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
