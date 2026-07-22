// Phase 5 — SOL/USD pricing display option. A global toggle in the marketplace
// header; PriceText renders any SOL amount in the chosen unit (USD via live
// SOL price). This is a display option; on-chain settlement stays in SOL/USDC.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSolUsd } from "@/lib/orbitx/fee";

type Unit = "SOL" | "USD";
interface Ctx { unit: Unit; setUnit: (u: Unit) => void; solUsd: number | null }
const CurrencyCtx = createContext<Ctx>({ unit: "SOL", setUnit: () => {}, solUsd: null });
const KEY = "orbitx_nft_currency";

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [unit, setUnitState] = useState<Unit>(() => (localStorage.getItem(KEY) as Unit) || "SOL");
  const setUnit = (u: Unit) => { setUnitState(u); localStorage.setItem(KEY, u); };
  const { data } = useQuery({ queryKey: ["sol-usd"], staleTime: 60_000, refetchInterval: 120_000, queryFn: getSolUsd });
  const solUsd = data?.price ?? null;
  const value = useMemo(() => ({ unit, setUnit, solUsd }), [unit, solUsd]);
  return <CurrencyCtx.Provider value={value}>{children}</CurrencyCtx.Provider>;
}

export function useCurrency() { return useContext(CurrencyCtx); }

export function PriceText({ sol, dp, className = "" }: { sol?: number | null; dp?: number; className?: string }) {
  const { unit, solUsd } = useCurrency();
  if (sol == null || !Number.isFinite(sol)) return <span className={className}>—</span>;
  if (unit === "USD" && solUsd) {
    const usd = sol * solUsd;
    return <span className={className}>${usd >= 1000 ? usd.toLocaleString(undefined, { maximumFractionDigits: 0 }) : usd.toFixed(2)}</span>;
  }
  const d = dp ?? (sol >= 1 ? 2 : sol >= 0.01 ? 3 : sol >= 0.0001 ? 5 : 6);
  return <span className={className}>{sol.toFixed(d)} SOL</span>;
}

export function CurrencyToggle() {
  const { unit, setUnit } = useCurrency();
  return (
    <div className="flex items-center rounded-lg border mkt-hairline bg-[hsl(var(--mkt-panel-2))] p-0.5 text-[11px] font-bold">
      {(["SOL", "USD"] as const).map((u) => (
        <button key={u} onClick={() => setUnit(u)}
          className={`rounded-md px-2 py-1 ${unit === u ? "bg-[hsl(var(--og-cyan))] text-black" : "mkt-muted"}`}>{u}</button>
      ))}
    </div>
  );
}
