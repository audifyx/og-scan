/**
 * RealEstateHub — the single mount point for the whole real estate module.
 * Tabbed overlay: NFT Deeds · Penthouse Auctions · Homes · Hotels.
 *
 * Mount (integrator): render inside the city page shell, e.g. when the core
 * HUD panel `realestate` is open:
 *
 *   import { RealEstateHub, REALESTATE_PANEL_ID } from "@/city/modules/realestate";
 *   {panel === REALESTATE_PANEL_ID && <RealEstateHub billing={billing} ledger={ledger} onClose={closePanel} />}
 *
 * `billing` is the tokenomics `useOrbitxBilling()` result (cast to
 * OrbitxBillingProvider). Omit it until the primitive lands — premium flows
 * show the auth-required state and everything else keeps working on paper
 * CITY. `ledger` is the shared paper-CITY ledger (economy's paper wallet
 * wrapped to `PaperLedger`); when omitted a local standalone ledger is used.
 */
import { useMemo, useState } from "react";
import "../realestate.css";
import type { OrbitxBillingProvider, PaperLedger } from "../types";
import { useRealEstateBilling } from "../billing";
import { createLocalPaperLedger } from "../store/paperLedger";
import { PLAYER_ID } from "../store/identity";
import { DeedsPanel } from "./DeedsPanel";
import { AuctionsPanel } from "./AuctionsPanel";
import { HomesPanel } from "./HomesPanel";
import { HotelsPanel } from "./HotelsPanel";
import { fmt, type RealEstateCtx } from "./ctx";

export type RealEstateTab = "deeds" | "auctions" | "homes" | "hotels";

/** Panel id the core HUD should use for this module. */
export const REALESTATE_PANEL_ID = "realestate";

const TABS: { id: RealEstateTab; label: string }[] = [
  { id: "auctions", label: "🔨 Auctions" },
  { id: "deeds", label: "📜 Deeds" },
  { id: "homes", label: "🏠 Homes" },
  { id: "hotels", label: "🏨 Hotels" },
];

export function RealEstateHub({
  billing,
  ledger,
  onClose,
  initialTab = "auctions",
}: {
  billing?: OrbitxBillingProvider;
  ledger?: PaperLedger;
  onClose: () => void;
  initialTab?: RealEstateTab;
}) {
  const [tab, setTab] = useState<RealEstateTab>(initialTab);
  const realEstateBilling = useRealEstateBilling(billing);
  const localLedger = useMemo(() => createLocalPaperLedger(), []);
  const activeLedger = ledger ?? localLedger;

  const ctx: RealEstateCtx = useMemo(
    () => ({ billing: realEstateBilling, ledger: activeLedger, playerId: PLAYER_ID }),
    [realEstateBilling, activeLedger]
  );

  const cityBalance = activeLedger.balance();

  return (
    <div className="ox-re-overlay" role="dialog" aria-label="Real estate">
      <div className="ox-re-panel">
        <div className="ox-re-header">
          <h2>
            🏙️ OrbitXCity Real Estate
            <span className="ox-re-sub">
              {fmt(cityBalance ?? 0)} CITY
              {realEstateBilling.balance !== null && (
                <> · {fmt(realEstateBilling.balance)} ORBITX</>
              )}
              {!realEstateBilling.providerConnected && <> · paper mode</>}
            </span>
          </h2>
          <button className="ox-re-close" onClick={onClose} aria-label="Close real estate">
            ✕
          </button>
        </div>
        <div className="ox-re-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`ox-re-tab ${tab === t.id ? "active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="ox-re-body">
          {tab === "auctions" && <AuctionsPanel ctx={ctx} />}
          {tab === "deeds" && <DeedsPanel ctx={ctx} />}
          {tab === "homes" && <HomesPanel ctx={ctx} />}
          {tab === "hotels" && <HotelsPanel ctx={ctx} />}
        </div>
        <div className="ox-re-footer">
          Paper CITY = gameplay · Real ORBITX = premium, backend-signed burns 🔥 · The game never custodies keys or funds.
        </div>
      </div>
    </div>
  );
}
