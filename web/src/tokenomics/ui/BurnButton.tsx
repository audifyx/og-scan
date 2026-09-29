/**
 * Shared billing UI primitives for the ORBITX utility backbone.
 * All spends are backend-signed burns — no wallet popups, ever.
 */
import { useState } from "react";
import { useOrbitxBilling } from "../useOrbitxBilling";
import { formatOrbitx } from "../constants";

type BurnState = "idle" | "confirm" | "burning" | "done" | "error";

/**
 * Generic burn button. Handles auth-gating, confirm, burn, and receipt.
 * `reason` must be a namespaced spend reason (see spendReason).
 */
export function BurnButton({
  amount,
  reason,
  label,
  className,
  disabled,
  onDone,
}: {
  amount: number;
  reason: string;
  label?: string;
  className?: string;
  disabled?: boolean;
  onDone?: (signature: string) => void;
}): JSX.Element {
  const { ready, balance, spend, beginAuth, error: billingError } = useOrbitxBilling();
  const [state, setState] = useState<BurnState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);

  const insufficient = balance != null && balance < amount;

  const start = () => {
    if (!ready) {
      beginAuth();
      return;
    }
    setError(null);
    setState("confirm");
  };

  const confirm = async () => {
    setState("burning");
    setError(null);
    try {
      const { signature: sig } = await spend({ amount, reason });
      setSignature(sig);
      setState("done");
      onDone?.(sig);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState("error");
    }
  };

  const btnLabel =
    state === "burning"
      ? "Burning…"
      : !ready
        ? "Link billing"
        : state === "confirm"
          ? `Confirm burn ${formatOrbitx(amount)}`
          : label || `Burn ${formatOrbitx(amount)}`;

  return (
    <span className={className} style={{ display: "inline-flex", flexDirection: "column", gap: 6 }}>
      <button
        type="button"
        disabled={disabled || state === "burning" || (ready && insufficient)}
        onClick={state === "confirm" ? confirm : start}
        title={
          !ready
            ? "One dashboard link, then spends are seamless"
            : insufficient
              ? `Need ${formatOrbitx(amount)} — desk holds ${formatOrbitx(balance ?? 0)}`
              : `Burn ${formatOrbitx(amount)} (${reason})`
        }
        style={{
          padding: "8px 14px",
          borderRadius: 10,
          border: "1px solid #f59e0b55",
          background: state === "confirm" ? "#b45309" : "#7c2d12",
          color: "#fff",
          fontWeight: 700,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled || (ready && insufficient) ? 0.55 : 1,
        }}
      >
        {btnLabel}
      </button>
      {state === "confirm" ? (
        <button
          type="button"
          onClick={() => setState("idle")}
          style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: 12 }}
        >
          cancel
        </button>
      ) : null}
      {insufficient && ready ? (
        <span style={{ fontSize: 12, color: "#f87171" }}>
          Insufficient ORBITX in the in-app wallet.
        </span>
      ) : null}
      {state === "done" && signature ? (
        <a
          href={`https://solscan.io/tx/${signature}`}
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: 12, color: "#4ade80" }}
        >
          Burned ✓ — view tx
        </a>
      ) : null}
      {(state === "error" && error) || billingError ? (
        <span style={{ fontSize: 12, color: "#f87171", maxWidth: 260 }}>
          {state === "error" && error ? error : billingError}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Small inline auth banner for surfaces that need billing.
 * Renders nothing once billing is ready.
 */
export function BillingBanner({ compact }: { compact?: boolean }): JSX.Element | null {
  const { ready, beginAuth, error } = useOrbitxBilling();
  if (ready) return null;
  return (
    <div
      style={{
        padding: compact ? "8px 12px" : "12px 16px",
        borderRadius: 10,
        border: "1px solid #f59e0b44",
        background: "#451a0355",
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontSize: compact ? 12 : 14,
        color: "#fde68a",
      }}
    >
      <span>🔥 ORBITX billing not linked — one tap, then every spend is seamless (no popups).</span>
      <button
        type="button"
        onClick={beginAuth}
        style={{
          marginLeft: "auto",
          padding: "6px 12px",
          borderRadius: 8,
          border: "none",
          background: "#f59e0b",
          color: "#000",
          fontWeight: 700,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        Link billing
      </button>
      {error ? <span style={{ color: "#f87171", fontSize: 12 }}>{error}</span> : null}
    </div>
  );
}
