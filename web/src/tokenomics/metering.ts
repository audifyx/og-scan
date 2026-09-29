/**
 * API usage metering (#14).
 *
 * Client-side metering: counts calls per API key in localStorage and burns
 * ORBITX per 1k calls past the free tier via the billing primitive.
 *
 * NOTE (BLOCKED on backend): authoritative metering must live server-side
 * (a client counter can be reset). The backend needs a per-key usage ledger
 * + auto-burn on overage. Until then this is an honest local meter with an
 * explicit "settle overage" burn the dev can trigger.
 */
import { useCallback, useState } from "react";
import { API_METER_KEY, ORBITX_PRICES } from "./constants";
import type { SpendArgs } from "./useOrbitxBilling";
import { spendReason } from "./constants";

export const FREE_TIER_CALLS = 10_000;

type MeterState = Record<string, { used: number; burned1kUnits: number }>;

function readMeter(): MeterState {
  try {
    const raw = localStorage.getItem(API_METER_KEY);
    const o = raw ? JSON.parse(raw) : {};
    return o && typeof o === "object" ? o : {};
  } catch {
    return {};
  }
}

function writeMeter(m: MeterState): void {
  try {
    localStorage.setItem(API_METER_KEY, JSON.stringify(m));
  } catch {
    /* ignore */
  }
}

export function recordApiCall(keyId: string, n = 1): void {
  const m = readMeter();
  const cur = m[keyId] || { used: 0, burned1kUnits: 0 };
  writeMeter({ ...m, [keyId]: { ...cur, used: cur.used + n } });
}

/** Whole 1k-units of overage not yet burned for. */
export function overageUnitsDue(keyId: string, freeTier: number = FREE_TIER_CALLS): number {
  const cur = readMeter()[keyId];
  if (!cur) return 0;
  const overUnits = Math.max(0, Math.floor((cur.used - freeTier) / 1000));
  return Math.max(0, overUnits - cur.burned1kUnits);
}

export function useApiMetering(keyId: string, freeTier: number = FREE_TIER_CALLS): {
  used: number;
  freeTier: number;
  overageUnitsDue: number;
  burnDue: number;
  record: (n?: number) => void;
  /** Burn ORBITX for all outstanding overage. Returns the burn signature. */
  settleOverage: (
    spend: (opts: SpendArgs) => Promise<{ signature: string }>,
  ) => Promise<string | null>;
  refresh: () => void;
} {
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const cur = (tick >= 0 && readMeter()[keyId]) || { used: 0, burned1kUnits: 0 };
  const due = overageUnitsDue(keyId, freeTier);

  const record = useCallback(
    (n = 1) => {
      recordApiCall(keyId, n);
      refresh();
    },
    [keyId, refresh],
  );

  const settleOverage = useCallback(
    async (spend: (opts: SpendArgs) => Promise<{ signature: string }>): Promise<string | null> => {
      const units = overageUnitsDue(keyId, freeTier);
      if (units <= 0) return null;
      const { signature } = await spend({
        amount: units * ORBITX_PRICES.apiPer1kCalls,
        reason: spendReason.apiOverage(keyId, units),
      });
      const m = readMeter();
      const c = m[keyId] || { used: 0, burned1kUnits: 0 };
      writeMeter({ ...m, [keyId]: { ...c, burned1kUnits: c.burned1kUnits + units } });
      refresh();
      return signature;
    },
    [keyId, freeTier, refresh],
  );

  return {
    used: cur.used,
    freeTier,
    overageUnitsDue: due,
    burnDue: due * ORBITX_PRICES.apiPer1kCalls,
    record,
    settleOverage,
    refresh,
  };
}
