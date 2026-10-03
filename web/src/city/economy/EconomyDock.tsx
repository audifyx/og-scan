/**
 * OrbitX City — economy dock.
 *
 * Three plug-in buttons for the game HUD: SHOP (burn ORBITX for items),
 * TRADE (Jupiter swaps), LAUNCH (real token launch terminal). Each opens its
 * panel as an overlay. Drop <EconomyDock /> into the rebuilt HUD wherever
 * the boards call for it.
 */
import { useState } from "react";
import { ArrowDownUp, Building2, Flame, Gamepad2, Rocket, Shirt } from "lucide-react";
import { getStyle, STYLES, setStyle, type StyleId } from "../cityState";
import CityShop from "./CityShop";
import TradePanel from "./TradePanel";
import LaunchTerminal from "./LaunchTerminal";
import ArcadeGame from "./ArcadeGame";
import { PropertyPanel } from "../realestate/PropertyPanel";
import "./economy.css";

type Panel = "shop" | "trade" | "launch" | "arcade" | "estate" | "fit" | null;

export default function EconomyDock() {
  const [panel, setPanel] = useState<Panel>(null);

  return (
    <>
      <div className="oxe-dock" data-hud>
        <button className="oxe-btn" onClick={() => setPanel("shop")} aria-label="Open city shop">
          <Flame className="oxe-ic-sm" /> SHOP
        </button>
        <button className="oxe-btn" onClick={() => setPanel("trade")} aria-label="Open trade">
          <ArrowDownUp className="oxe-ic-sm" /> TRADE
        </button>
        <button className="oxe-btn" onClick={() => setPanel("launch")} aria-label="Open launch terminal">
          <Rocket className="oxe-ic-sm" /> LAUNCH
        </button>
        <button className="oxe-btn" onClick={() => setPanel("arcade")} aria-label="Play arcade">
          <Gamepad2 className="oxe-ic-sm" /> PLAY
        </button>
        <button className="oxe-btn" onClick={() => setPanel("estate")} aria-label="Open real estate">
          <Building2 className="oxe-ic-sm" /> ESTATE
        </button>
        <button className="oxe-btn" onClick={() => setPanel("fit")} aria-label="Change trader style">
          <Shirt className="oxe-ic-sm" /> FIT
        </button>
      </div>
      {panel === "shop" && <CityShop onClose={() => setPanel(null)} />}
      {panel === "trade" && <TradePanel onClose={() => setPanel(null)} />}
      {panel === "launch" && <LaunchTerminal onClose={() => setPanel(null)} />}
      {panel === "arcade" && <ArcadeGame onClose={() => setPanel(null)} />}
      {panel === "estate" && (
        <div className="oxe-overlay" data-hud onClick={() => setPanel(null)}>
          <div className="oxe-sheet oxe-sheet-wide" onClick={(e) => e.stopPropagation()}>
            <div className="oxe-sheet-head">
              <div className="oxe-sheet-title">
                <Building2 className="oxe-ic" />
                <div>
                  <div className="oxe-t1">REAL ESTATE</div>
                  <div className="oxe-t2">Buy buildings · earn CITY rent</div>
                </div>
              </div>
              <button className="oxe-x" onClick={() => setPanel(null)} aria-label="Close real estate">
                ✕
              </button>
            </div>
            <PropertyPanel />
          </div>
        </div>
      )}

      {panel === "fit" && (
        <div className="oxe-overlay" data-hud onClick={() => setPanel(null)}>
          <div className="oxe-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="oxe-sheet-head">
              <div className="oxe-sheet-title">
                <Shirt className="oxe-ic" />
                <div>
                  <div className="oxe-t1">TRADER FIT</div>
                  <div className="oxe-t2">Swap style without leaving the block</div>
                </div>
              </div>
              <button className="oxe-x" onClick={() => setPanel(null)} aria-label="Close fit">✕</button>
            </div>
            <div className="oxe-fit-grid">
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  className={`oxe-btn${getStyle() === s.id ? " oxe-btn-primary" : ""}`}
                  onClick={() => {
                    setStyle(s.id);
                    window.dispatchEvent(new CustomEvent("oxc-style", { detail: s.id satisfies StyleId }));
                    setPanel(null);
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
