/**
 * OrbitX City — economy dock.
 *
 * Three plug-in buttons for the game HUD: SHOP (burn ORBITX for items),
 * TRADE (Jupiter swaps), LAUNCH (real token launch terminal). Each opens its
 * panel as an overlay. Drop <EconomyDock /> into the rebuilt HUD wherever
 * the boards call for it.
 */
import { useState } from "react";
import { ArrowDownUp, Flame, Gamepad2, Rocket } from "lucide-react";
import CityShop from "./CityShop";
import TradePanel from "./TradePanel";
import LaunchTerminal from "./LaunchTerminal";
import ArcadeGame from "./ArcadeGame";
import "./economy.css";

type Panel = "shop" | "trade" | "launch" | "arcade" | null;

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
      </div>
      {panel === "shop" && <CityShop onClose={() => setPanel(null)} />}
      {panel === "trade" && <TradePanel onClose={() => setPanel(null)} />}
      {panel === "launch" && <LaunchTerminal onClose={() => setPanel(null)} />}
      {panel === "arcade" && <ArcadeGame onClose={() => setPanel(null)} />}
    </>
  );
}
