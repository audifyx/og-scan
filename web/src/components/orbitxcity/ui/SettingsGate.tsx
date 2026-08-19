import { GateFrame } from "./GateFrame";
import { SettingsPanel } from "./SettingsPanel";
import { useCity } from "@/pages/orbitxcity/CityProvider";

export function SettingsGate() {
  const { setGate } = useCity();
  return (
    <GateFrame
      gate="settings"
      footer={
        <div className="oxc-gate-links">
          <button type="button" className="oxc-gate-link" onClick={() => setGate("help")}>
            View controls
          </button>
        </div>
      }
    >
      <SettingsPanel />
    </GateFrame>
  );
}
