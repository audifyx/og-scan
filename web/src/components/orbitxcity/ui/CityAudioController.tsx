import { useEffect, useSyncExternalStore } from "react";
import { cityAudio } from "@/lib/orbitxcity/cityAudio";
import { useCity } from "@/pages/orbitxcity/CityProvider";

/**
 * Mount once inside OrbitX City — unlocks audio on first gesture, drives
 * menu vs world theme beds, and keeps mute prefs in sync.
 */
export function CityAudioController() {
  const { gate, entered } = useCity();
  const snap = useSyncExternalStore(cityAudio.subscribe, () => cityAudio.getState(), () => cityAudio.getState());

  // Unlock on first user gesture (autoplay policy)
  useEffect(() => {
    const unlock = () => {
      void cityAudio.unlock();
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
    window.addEventListener("touchstart", unlock, { passive: true });
    // Try immediately in case a gesture already happened
    void cityAudio.unlock();
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, []);

  // Theme bed by gate
  useEffect(() => {
    if (gate === "world" && entered) {
      cityAudio.setTheme("world");
    } else if (gate !== "world") {
      cityAudio.setTheme("menu");
    } else {
      cityAudio.setTheme("off");
    }
  }, [gate, entered]);

  // Tear down when leaving the city route
  useEffect(() => {
    return () => {
      cityAudio.setTheme("off");
    };
  }, []);

  // Invisible — state is consumed by HUD/settings via cityAudio.subscribe
  void snap;
  return null;
}
