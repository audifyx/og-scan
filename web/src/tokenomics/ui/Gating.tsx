/**
 * Token-gated access wrapper (#4, #13).
 * AlphaGate: shows children only to ORBITX holders (default 10k).
 * PriorityLane: marks holder-priority content (e.g. support queue).
 */
import type { ReactNode } from "react";
import { useAlphaGate, useSupportPriority } from "../gating";
import { useOrbitxBilling } from "../useOrbitxBilling";
import { ORBITX_PRICES, formatOrbitx } from "../constants";

export function AlphaGate({
  children,
  required,
  label,
}: {
  children: ReactNode;
  required?: number;
  label?: string;
}): JSX.Element {
  const { allowed, balance, required: req } = useAlphaGate(required);
  const { ready, beginAuth } = useOrbitxBilling();
  if (allowed) return <>{children}</>;
  return (
    <div
      style={{
        border: "1px solid #f59e0b44",
        borderRadius: 12,
        padding: 14,
        background: "#451a0333",
        color: "#fde68a",
        fontSize: 13,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 4 }}>🔒 {label || "Alpha lounge"}</div>
      <div>
        Hold {formatOrbitx(required ?? req)} to enter.
        {ready ? (
          <span> Your in-app wallet holds {formatOrbitx(balance ?? 0)}.</span>
        ) : (
          <span> Link billing to check your balance.</span>
        )}
      </div>
      {!ready ? (
        <button
          type="button"
          onClick={beginAuth}
          style={{ marginTop: 8, padding: "6px 12px", borderRadius: 8, border: "none", background: "#f59e0b", color: "#000", fontWeight: 700, cursor: "pointer" }}
        >
          Link billing
        </button>
      ) : null}
      <div style={{ marginTop: 6, fontSize: 11, opacity: 0.7 }}>
        Required: {formatOrbitx(ORBITX_PRICES.alphaGateHold)} default.
      </div>
    </div>
  );
}

export function PriorityLaneNote(): JSX.Element {
  const { priority, balance } = useSupportPriority();
  if (!priority) return <></>;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        fontWeight: 700,
        color: "#4ade80",
        border: "1px solid #16a34a55",
        borderRadius: 999,
        padding: "4px 10px",
        background: "#052e1655",
      }}
    >
      ⚡ Priority support lane — {formatOrbitx(balance ?? 0)} held
    </span>
  );
}
