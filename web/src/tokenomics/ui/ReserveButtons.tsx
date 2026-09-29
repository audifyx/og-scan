/**
 * Reservation buttons (#12a): burn ORBITX to reserve a token ticker.
 * Uniqueness registry is local for now — a backend registry ships later
 * (BLOCKED: no backend ticker registry).
 */
import { useState } from "react";
import { useOrbitxBilling } from "../useOrbitxBilling";
import { BurnButton, BillingBanner } from "./BurnButton";
import { ORBITX_PRICES, formatOrbitx, spendReason } from "../constants";

const RESERVED_KEY = "orbitx.billing.reservedTickers.v1";

function readReserved(): Record<string, string> {
  try {
    const raw = localStorage.getItem(RESERVED_KEY);
    const o = raw ? JSON.parse(raw) : {};
    return o && typeof o === "object" ? o : {};
  } catch {
    return {};
  }
}

export function reservedTickerSig(ticker: string): string | null {
  return readReserved()[ticker.toUpperCase()] || null;
}

export function TickerReserveButton({ ticker }: { ticker: string }): JSX.Element {
  const { ready } = useOrbitxBilling();
  const [sig, setSig] = useState<string | null>(() => reservedTickerSig(ticker));

  if (sig) {
    return (
      <a href={`https://solscan.io/tx/${sig}`} target="_blank" rel="noreferrer"
        style={{ fontSize: 12, color: "#4ade80" }}>
        ${ticker} reserved ✓ — view burn
      </a>
    );
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <BillingBanner compact />
      <BurnButton
        amount={ORBITX_PRICES.tickerReserve}
        reason={spendReason.tickerReserve(ticker)}
        label={`Reserve $${ticker} — burn ${formatOrbitx(ORBITX_PRICES.tickerReserve)}`}
        disabled={!ready}
        onDone={(s) => {
          const next = { ...readReserved(), [ticker.toUpperCase()]: s };
          try {
            localStorage.setItem(RESERVED_KEY, JSON.stringify(next));
          } catch {
            /* ignore */
          }
          setSig(s);
        }}
      />
    </span>
  );
}
