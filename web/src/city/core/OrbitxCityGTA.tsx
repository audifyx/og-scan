import { useGtaGame } from "./useGtaGame";
import { GtaHud } from "./GtaHud";
import { GtaTitleScreen, GtaHowToScreen, GtaPauseOverlay } from "./GtaScreens";
import { CityBillingProvider } from "@/city/integration/CityBillingHost";
import { CitySystemsHost } from "@/city/integration/CitySystemsHost";
import { CityAppsShell } from "@/city/integration/CityAppsShell";

/**
 * ORBITXCITY — GTA-style open world (Three.js).
 * Core world: walkable city, drivable cars, day/night, traffic, peds,
 * live price billboards/ticker. Systems (bank, real estate, jobs…) phase in
 * on top via the billing contract in tokenomics/BILLING_CONTRACT.md.
 */
export default function OrbitxCityGTA() {
  const api = useGtaGame();
  const inWorld = api.phase === "playing" || api.phase === "howto";

  return (
    <div className="ocg-root">
      {/* 3D canvas always mounted while in the world (survives help overlay) */}
      {inWorld && (
        <CityBillingProvider>
          <canvas ref={api.canvasRef} className="ocg-canvas" />
          <GtaHud api={api} />
          <CitySystemsHost api={api} />
          <CityAppsShell api={api} />
        </CityBillingProvider>
      )}
      {api.phase === "title" && <GtaTitleScreen api={api} />}
      {api.phase === "howto" && <GtaHowToScreen api={api} />}
      <GtaPauseOverlay api={api} />
    </div>
  );
}
