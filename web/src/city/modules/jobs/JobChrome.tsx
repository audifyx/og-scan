/**
 * Shared HUD chrome for job panels: floating card, buttons, premium upsell.
 * Premium = real ORBITX via tokenomics billing, which has NOT landed yet
 * (see BILLING_CONTRACT.md). Until then premium buttons render disabled in
 * "coming soon" state — never a parallel burn path.
 */
import type { ReactNode } from "react";
import type { JobMeta } from "./types";
import { getBuffs } from "./wallet";

export function PremiumButton({ label }: { label: string }): JSX.Element {
  return (
    <button
      className="oj-btn oj-premium"
      disabled
      title="Real-ORBITX billing is coming soon — premium stays locked until the tokenomics primitives land."
    >
      🔥 {label} · ORBITX soon
    </button>
  );
}

export function BuffRow(): JSX.Element | null {
  const buffs = getBuffs();
  if (buffs.length === 0) return null;
  return (
    <div className="oj-buffs">
      {buffs.map((b) => (
        <span key={b.id} className="oj-buff" title={`Pay ×${b.payMult} · XP ×${b.xpMult}`}>
          ✨ {b.label} {Math.max(1, Math.round((b.until - Date.now()) / 60000))}m
        </span>
      ))}
    </div>
  );
}

export function StatRow({ label, value, accent }: { label: string; value: ReactNode; accent?: boolean }) {
  return (
    <div className="oj-stat">
      <span className="oj-stat-label">{label}</span>
      <span className={accent ? "oj-stat-value oj-accent" : "oj-stat-value"}>{value}</span>
    </div>
  );
}

export function JobChrome({
  meta,
  status,
  children,
  onEnd,
}: {
  meta: JobMeta;
  status: string;
  children: ReactNode;
  onEnd: () => void;
}) {
  return (
    <div className="oj-panel" data-hud>
      <div className="oj-head">
        <span className="oj-icon">{meta.icon}</span>
        <div className="oj-title">
          <b>{meta.name}</b>
          <span className="oj-status">{status}</span>
        </div>
        <button className="oj-x" onClick={onEnd} aria-label="End shift">
          ✕
        </button>
      </div>
      <BuffRow />
      <div className="oj-body">{children}</div>
    </div>
  );
}
