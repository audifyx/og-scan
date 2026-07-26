import { useSyncExternalStore } from "react";
import { Volume2, VolumeX, Music2 } from "lucide-react";
import { cityAudio } from "@/lib/orbitxcity/cityAudio";

/** Compact music / SFX mute cluster for the City HUD. */
export function AudioToggle() {
  const snap = useSyncExternalStore(cityAudio.subscribe, () => cityAudio.getState(), () => cityAudio.getState());

  return (
    <div className="oxc-audio-toggles">
      <button
        type="button"
        className={`oxc-toggle-btn ${snap.musicOn ? "on" : ""}`}
        title={snap.musicOn ? "Mute theme music" : "Unmute theme music"}
        aria-pressed={snap.musicOn}
        onClick={() => {
          void cityAudio.unlock();
          cityAudio.setMusicOn(!snap.musicOn);
          cityAudio.play("ui");
        }}
      >
        {snap.musicOn ? <Music2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
      </button>
      <button
        type="button"
        className={`oxc-toggle-btn ${snap.sfxOn ? "on" : ""}`}
        title={snap.sfxOn ? "Mute sound effects" : "Unmute sound effects"}
        aria-pressed={snap.sfxOn}
        onClick={() => {
          void cityAudio.unlock();
          cityAudio.setSfxOn(!snap.sfxOn);
          if (!snap.sfxOn) cityAudio.play("ui");
        }}
      >
        <Volume2 className="h-3.5 w-3.5" />
      </button>
      {!snap.unlocked && (
        <button
          type="button"
          className="oxc-toggle-btn on"
          title="Click to enable City audio"
          onClick={() => {
            void cityAudio.unlock().then(() => cityAudio.play("confirm"));
          }}
        >
          Tap for sound
        </button>
      )}
    </div>
  );
}
