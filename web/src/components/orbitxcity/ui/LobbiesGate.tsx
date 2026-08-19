/**
 * Multiplayer gate — lobby browser on a dedicated page (back returns to menu).
 */
import { GateFrame } from "./GateFrame";
import { LobbyBrowser } from "./LobbyBrowser";
import { useCity } from "@/pages/orbitxcity/CityProvider";

export function LobbiesGate() {
  const { setGate } = useCity();
  return (
    <GateFrame
      gate="lobbies"
      footer={
        <div className="oxc-gate-links">
          <button type="button" className="oxc-gate-link" onClick={() => setGate("characters")}>
            Change mascot
          </button>
          <button type="button" className="oxc-gate-link" onClick={() => setGate("quick")}>
            Quick play instead
          </button>
        </div>
      }
    >
      <LobbyBrowser
        startAfterJoin
        onJoined={() => {
          /* setEntered handled inside LobbyBrowser */
        }}
      />
    </GateFrame>
  );
}
