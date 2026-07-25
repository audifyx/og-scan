import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type OxButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "default";
  size?: "sm" | "md";
  block?: boolean;
};

export const OxButton = forwardRef<HTMLButtonElement, OxButtonProps>(
  ({ className, variant = "default", size = "md", block, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "ox-btn",
        variant === "primary" && "ox-btn--primary",
        variant === "ghost" && "ox-btn--ghost",
        size === "sm" && "ox-btn--sm",
        block && "ox-btn--block",
        className,
      )}
      {...props}
    />
  ),
);
OxButton.displayName = "OxButton";

export function OxPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("ox-panel", className)}>
      <div className="ox-panel__body">{children}</div>
    </div>
  );
}

export function OxTabs({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="ox-tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          className="ox-tab"
          data-active={value === t.id}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function OxXpBar({
  level,
  xp,
  nextXp,
  label = "XP",
}: {
  level: number;
  xp: number;
  nextXp: number;
  label?: string;
}) {
  const pct = Math.max(4, Math.min(100, Math.round((xp / Math.max(nextXp, 1)) * 100)));
  return (
    <div className="ox-xp">
      <div className="ox-xp__meta">
        <span>
          LVL {level} · {label}
        </span>
        <span>
          {xp.toLocaleString()} / {nextXp.toLocaleString()}
        </span>
      </div>
      <div className="ox-xp__track" aria-hidden>
        <div className="ox-xp__fill" style={{ ["--pct" as string]: `${pct}%` }} />
      </div>
    </div>
  );
}

export function OxLoader({ label = "Initializing OrbitX OS" }: { label?: string }) {
  return (
    <div className="ox-loader" role="status">
      <div className="ox-loader__ring" />
      <span>{label}</span>
    </div>
  );
}

export function OxModal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="ox-modal-backdrop" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="ox-modal ox-panel" onClick={(e) => e.stopPropagation()}>
        <div className="ox-panel__body">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <h2 className="ox-title" style={{ fontSize: "1.1rem", margin: 0 }}>
              {title}
            </h2>
            <OxButton type="button" variant="ghost" size="sm" onClick={onClose} aria-label="Close">
              Close
            </OxButton>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export function OxField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="ox-field">
      <label>{label}</label>
      {children}
    </div>
  );
}
