/**
 * EconomyHub — the single mount point for the whole economy module.
 * Tabbed overlay: ORBITX Bank · CITY Wallet · Candle Predictor · Arcade.
 *
 * Mount (integrator): render inside the city page shell, e.g. when the core
 * HUD panel `economy` is open:
 *
 *   import { EconomyHub } from "@/city/modules/economy";
 *   {panel === "economy" && <EconomyHub billing={billing} onClose={closePanel} />}
 *
 * `billing` is the tokenomics `useOrbitxBilling()` result (cast to
 * OrbitxBillingProvider). Omit it until the primitive lands — the bank shows
 * the coming-soon state and everything else keeps working on paper CITY.
 */
import { useState } from "react";
import "../economy.css";
import type { OrbitxBillingProvider } from "../types";
import { usePaperWallet, formatCity } from "../store/paperWallet";
import { PaperWalletPanel } from "./PaperWalletPanel";
import { OrbitxBankPanel } from "./OrbitxBankPanel";
import { CandlePredictor } from "./CandlePredictor";
import { Arcade } from "./Arcade";

export type EconomyTab = "bank" | "wallet" | "predict" | "arcade";

/** Panel id the core HUD should use for this module. */
export const ECONOMY_PANEL_ID = "economy";

const TABS: { id: EconomyTab; label: string }[] = [
  { id: "bank", label: "🏦 Bank" },
  { id: "wallet", label: "🪙 Wallet" },
  { id: "predict", label: "🕯️ Predict" },
  { id: "arcade", label: "🕹️ Arcade" },
];

export function EconomyHub({
  billing,
  onClose,
  initialTab = "bank",
}: {
  billing?: OrbitxBillingProvider;
  onClose: () => void;
  initialTab?: EconomyTab;
}) {
  const [tab, setTab] = useState<EconomyTab>(initialTab);
  const { wallet } = usePaperWallet();

  return (
    <div className="ox-eco-hub" role="dialog" aria-label="Economy">
      <div className="ox-eco-card">
        <div className="ox-eco-head">
          <div className="ox-eco-title">💸 OrbitXCity Economy</div>
          <div className="ox-eco-row">
            <span className="ox-eco-section-title">{formatCity(wallet.balance)} CITY</span>
            <button className="ox-eco-close" onClick={onClose} aria-label="Close economy">
              ✕
            </button>
          </div>
        </div>
        <div className="ox-eco-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`ox-eco-tab ${tab === t.id ? "active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="ox-eco-body">
          {tab === "bank" && <OrbitxBankPanel billing={billing} />}
          {tab === "wallet" && <PaperWalletPanel />}
          {tab === "predict" && <CandlePredictor />}
          {tab === "arcade" && <Arcade />}
        </div>
      </div>
    </div>
  );
}
