/**
 * Title-screen settings page — audio, quality, touch. Does not enter the world.
 */
import { MenuBackdrop } from "./MenuBackdrop";
import { SettingsPanel } from "./SettingsPanel";
import { SettingsSystemExtras } from "./CitySystemPanels";
import { useCity } from "@/pages/orbitxcity/CityProvider";

export function SettingsGate() {
  const { setGate, selectedCityId } = useCity();
  return (
    <div className="oxc-chars is-in oxc-settings-gate">
      <MenuBackdrop cityId={selectedCityId} intensity="chamber" />
      <header className="oxc-chars-bar">
        <button type="button" className="oxc-chars-back" onClick={() => setGate("menu")}>
          ← Title
        </button>
        <div className="oxc-chars-bar-center">
          <p className="oxc-chars-kicker">Settings</p>
          <h1 className="oxc-chars-title">
            ORBIT<span className="oxc-chars-title-x">X</span> RIG
          </h1>
        </div>
        <span className="oxc-chars-bar-spacer" aria-hidden />
      </header>
      <div className="oxc-settings-gate-body">
        <SettingsPanel />
        <SettingsSystemExtras />
      </div>
    </div>
  );
}
