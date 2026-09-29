/**
 * API metering panel (#14) — burn ORBITX per 1k calls past the free tier.
 * Client-side meter; authoritative server-side metering is BLOCKED
 * (needs backend per-key usage ledger + auto-burn).
 */
import { useState } from "react";
import { useOrbitxBilling } from "../useOrbitxBilling";
import { useApiMetering, FREE_TIER_CALLS } from "../metering";
import { ORBITX_PRICES, formatOrbitx } from "../constants";

export function ApiMeterPanel({ keyId, keyName }: { keyId: string; keyName: string }): JSX.Element {
  const billing = useOrbitxBilling();
  const meter = useApiMetering(keyId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sig, setSig] = useState<string | null>(null);

  const settle = async () => {
    if (!billing.ready) {
      billing.beginAuth();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const s = await meter.settleOverage(billing.spend);
      setSig(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginTop: 10, border: "1px solid #7c3aed33", borderRadius: 10, padding: 10, background: "#1e1b4b22" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#c4b5fd", marginBottom: 4 }}>
        ORBITX metering — {keyName}
      </div>
      <div style={{ fontSize: 12, color: "#9ca3af" }}>
        {meter.used.toLocaleString()} calls · {FREE_TIER_CALLS.toLocaleString()} free ·{" "}
        {meter.overageUnitsDue > 0 ? (
          <span style={{ color: "#fbbf24", fontWeight: 700 }}>
            {meter.overageUnitsDue}k overage = {formatOrbitx(meter.burnDue)} due
          </span>
        ) : (
          <span style={{ color: "#4ade80" }}>within free tier</span>
        )}
      </div>
      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
        {formatOrbitx(ORBITX_PRICES.apiPer1kCalls)} burned per 1k calls past free tier · local meter (server-side metering ships with the backend)
      </div>
      {meter.overageUnitsDue > 0 ? (
        <button
          type="button"
          onClick={settle}
          disabled={busy}
          style={{ marginTop: 8, padding: "6px 12px", borderRadius: 8, border: "none", background: "#7c3aed", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 12 }}
        >
          {busy ? "Burning…" : billing.ready ? `Burn ${formatOrbitx(meter.burnDue)} overage` : "Link billing"}
        </button>
      ) : null}
      {sig ? (
        <a href={`https://solscan.io/tx/${sig}`} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#4ade80", marginLeft: 8 }}>
          overage burned ✓
        </a>
      ) : null}
      {error ? <div style={{ fontSize: 12, color: "#f87171", marginTop: 6 }}>{error}</div> : null}
    </div>
  );
}
