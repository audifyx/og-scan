import type { ReactNode } from "react";
import { CosmicBackdrop } from "./CosmicBackdrop";
import type { CityGate } from "@/lib/orbitxcity/types";
import { GATE_COPY } from "@/lib/orbitxcity/cityGates";
import { useCity } from "@/pages/orbitxcity/CityProvider";

type PageGate = Exclude<CityGate, "menu" | "world">;

export function GateFrame({
  gate,
  children,
  footer,
  extra,
  actions,
}: {
  gate: PageGate;
  children: ReactNode;
  footer?: ReactNode;
  extra?: ReactNode;
  actions?: ReactNode;
}) {
  const { setGate } = useCity();
  const copy = GATE_COPY[gate];

  return (
    <div className={`oxc-gate oxc-gate--${gate}`} data-testid={`oxc-gate-${gate}`}>
      <CosmicBackdrop variant="chamber" />
      {extra}
      <header className="oxc-gate-top">
        <button type="button" className="oxc-gate-back" onClick={() => setGate("menu")}>
          ← Menu
        </button>
        <p className="oxc-gate-kicker">{copy.kicker}</p>
        <div className="oxc-gate-actions">{actions}</div>
      </header>
      <div className="oxc-gate-head">
        <h1>{copy.title}</h1>
        <p>{copy.sub}</p>
      </div>
      <div className="oxc-gate-body">{children}</div>
      {footer ? <footer className="oxc-gate-foot">{footer}</footer> : null}
    </div>
  );
}
