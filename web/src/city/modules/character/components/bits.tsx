/**
 * Shared UI atoms for the character module panels.
 */
import { useState } from "react";
import { useCharacter } from "../characterStore";
import { AvatarPreview } from "./AvatarPreview";
import type { StatBuffs } from "../types";

export function BuffLine({ buffs }: { buffs: StatBuffs }) {
  const parts: string[] = [];
  if (buffs.strength) parts.push(`+${buffs.strength} STR`);
  if (buffs.stamina) parts.push(`+${buffs.stamina} STA`);
  if (buffs.speed) parts.push(`+${buffs.speed} SPD`);
  if (parts.length === 0) return null;
  return <span className="ox-ch-buff">{parts.join(" · ")}</span>;
}

/**
 * Billing-gated purchase button. Not connected → prompts auth-once;
 * connected → runs the burn and reports the outcome to `onResult`.
 */
export function BurnButton(props: {
  amount: number;
  label: string;
  onBurn: () => Promise<{ ok: boolean; message?: string }>;
  onResult?: (msg: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const { billingReady, orbitxBalance, beginBillingAuth } = useCharacter();
  const [busy, setBusy] = useState(false);

  if (!billingReady) {
    return (
      <button
        className={`ox-ch-btn ghost ${props.className ?? ""}`}
        onClick={beginBillingAuth}
        disabled={props.disabled}
      >
        🔥 Connect wallet to burn
      </button>
    );
  }

  const click = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await props.onBurn();
      props.onResult?.(res.message ?? (res.ok ? "Burned + applied." : "Failed."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      className={`ox-ch-btn ${props.className ?? ""}`}
      onClick={click}
      disabled={busy || props.disabled}
      title={orbitxBalance != null ? `${orbitxBalance.toFixed(0)} ORBITX in wallet` : undefined}
    >
      {busy ? "Burning…" : `🔥 ${props.amount} ORBITX · ${props.label}`}
    </button>
  );
}

/** Full-width notice shown when billing isn't connected yet. */
export function BillingNotice() {
  const { billingReady, beginBillingAuth } = useCharacter();
  if (billingReady) return null;
  return (
    <div className="ox-ch-notice">
      Premium purchases burn real ORBITX (backend-signed, no popups — auth once
      up front). Connect your wallet to shop.
      <br />
      <button className="ox-ch-btn" onClick={beginBillingAuth} style={{ marginTop: 8 }}>
        Connect OrbitX wallet
      </button>
    </div>
  );
}

/** Small live look-preview bound to the current profile. */
export function ShopLook() {
  const { profile } = useCharacter();
  return (
    <div style={{ height: 260 }}>
      <AvatarPreview appearance={profile.appearance} outfit={profile.outfit} tattoos={profile.tattoos} />
      <div className="ox-ch-hint">Drag to rotate · your live look</div>
    </div>
  );
}
