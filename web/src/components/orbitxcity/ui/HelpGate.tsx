import { GateFrame } from "./GateFrame";
import { HelpPanel } from "./HelpPanel";
import { useCity } from "@/pages/orbitxcity/CityProvider";

export function HelpGate() {
  const { setGate } = useCity();
  return (
    <GateFrame
      gate="help"
      footer={
        <div className="oxc-gate-links">
          <button type="button" className="oxc-gate-link" onClick={() => setGate("settings")}>
            Open settings
          </button>
          <button type="button" className="oxc-gate-link" onClick={() => setGate("characters")}>
            Pick a mascot
          </button>
        </div>
      }
    >
      <HelpPanel />
    </GateFrame>
  );
}
