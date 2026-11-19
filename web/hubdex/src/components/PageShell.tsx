/** Shared metal page chrome for DEX tab pages */
import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";

export function PageHero({
  kicker,
  title,
  sub,
  icon: Icon,
  children,
}: {
  kicker?: string;
  title: string;
  sub?: string;
  icon?: LucideIcon;
  children?: ReactNode;
}) {
  return (
    <div className="dex-hero">
      {kicker && <div className="dex-kicker">{kicker}</div>}
      <h1 className="dex-hero-title">
        {Icon && <Icon className="h-7 w-7 text-[var(--ox-gold-hi)]" strokeWidth={2.4} />}
        {title}
      </h1>
      {sub && <p className="dex-hero-sub">{sub}</p>}
      {children}
    </div>
  );
}

export function DexPanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`dex-panel ${className}`}>{children}</div>;
}
