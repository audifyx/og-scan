import { useSyncExternalStore } from "react";
import { Gamepad2, Gauge, Music2, Sparkles, Volume2 } from "lucide-react";
import { useCity } from "@/pages/orbitxcity/CityProvider";
import { cityAudio } from "@/lib/orbitxcity/cityAudio";

export function SettingsPanel() {
  const { quality, setQuality, touchControls, setTouchControls } = useCity();
  const audio = useSyncExternalStore(cityAudio.subscribe, () => cityAudio.getState(), () => cityAudio.getState());

  return (
    <section className="oxc-settings-panel">
      <div className="oxc-menu-section-head">
        <span className="oxc-kicker">Settings</span>
        <h2>Play your way</h2>
        <p>Audio, performance, and mobile controls for OrbitX City.</p>
      </div>

      <div className="oxc-settings-list">
        <div className="oxc-settings-row">
          <div>
            <div className="oxc-settings-title">
              <Music2 className="h-4 w-4" /> Theme music
            </div>
            <p>OrbitX City title theme on menus, softer ambient bed in the world.</p>
          </div>
          <button
            type="button"
            className={`oxc-switch ${audio.musicOn ? "on" : ""}`}
            onClick={() => {
              void cityAudio.unlock();
              cityAudio.setMusicOn(!audio.musicOn);
              cityAudio.play("ui");
            }}
            aria-pressed={audio.musicOn}
          >
            <span />
            {audio.musicOn ? "On" : "Off"}
          </button>
        </div>

        {audio.musicOn && (
          <div className="oxc-settings-row">
            <div>
              <div className="oxc-settings-title">Music volume</div>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={audio.musicVol}
              onChange={(e) => cityAudio.setMusicVol(Number(e.target.value))}
              aria-label="Music volume"
              className="oxc-slider"
            />
          </div>
        )}

        <div className="oxc-settings-row">
          <div>
            <div className="oxc-settings-title">
              <Volume2 className="h-4 w-4" /> Sound effects
            </div>
            <p>UI clicks, interact chimes, shard pickups, and enter stingers.</p>
          </div>
          <button
            type="button"
            className={`oxc-switch ${audio.sfxOn ? "on" : ""}`}
            onClick={() => {
              void cityAudio.unlock();
              cityAudio.setSfxOn(!audio.sfxOn);
              if (!audio.sfxOn) cityAudio.play("confirm");
            }}
            aria-pressed={audio.sfxOn}
          >
            <span />
            {audio.sfxOn ? "On" : "Off"}
          </button>
        </div>

        {!audio.unlocked && (
          <div className="oxc-settings-row accent">
            <div>
              <div className="oxc-settings-title">Enable audio</div>
              <p>Browsers block sound until you tap once. Tap the button to start the theme.</p>
            </div>
            <button
              type="button"
              className="oxc-btn primary compact"
              onClick={() => {
                void cityAudio.unlock().then(() => {
                  cityAudio.setTheme("world");
                  cityAudio.play("enter");
                });
              }}
            >
              Start sound
            </button>
          </div>
        )}

        <div className="oxc-settings-row">
          <div>
            <div className="oxc-settings-title">
              <Sparkles className="h-4 w-4" /> Graphics quality
            </div>
            <p>High mode keeps neon atmosphere and extra effects. Lite mode prioritizes smooth mobile play.</p>
          </div>
          <div className="oxc-menu-segmented compact" role="group" aria-label="Graphics quality">
            <button type="button" className={quality === "high" ? "on" : ""} onClick={() => setQuality("high")}>
              High
            </button>
            <button type="button" className={quality === "lite" ? "on" : ""} onClick={() => setQuality("lite")}>
              Lite
            </button>
          </div>
        </div>

        <div className="oxc-settings-row">
          <div>
            <div className="oxc-settings-title">
              <Gamepad2 className="h-4 w-4" /> Touch controls
            </div>
            <p>Show on-screen joystick, jump, sprint, interact, and emote controls.</p>
          </div>
          <button
            type="button"
            className={`oxc-switch ${touchControls ? "on" : ""}`}
            onClick={() => setTouchControls(!touchControls)}
            aria-pressed={touchControls}
          >
            <span />
            {touchControls ? "On" : "Off"}
          </button>
        </div>

        <div className="oxc-settings-row accent">
          <div>
            <div className="oxc-settings-title">
              <Gauge className="h-4 w-4" /> Recommended
            </div>
            <p>Phones and tablets should use Lite plus touch controls. Desktop rigs can run High.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
