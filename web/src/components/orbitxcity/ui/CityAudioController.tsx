import { useEffect, useSyncExternalStore } from "react";
import { cityAudio } from "@/lib/orbitxcity/cityAudio";
import { useCityAudioEvents } from "@/lib/orbitxcity/useCityAudioEvents";
import { useGameStore } from "@/lib/orbitxcity/gameStore";
import { useCity } from "@/pages/orbitxcity/CityProvider";

/**
 * Mount once inside OrbitX City — unlocks audio on first gesture, drives
 * menu vs world theme beds, keeps mute prefs in sync, bridges wanted heat
 * into the siren loop, and runs the engine-hum + footstep event loop while
 * the world is live.
 */
export function CityAudioController() {
  const { gate, entered } = useCity();
  const snap = useSyncExternalStore(cityAudio.subscribe, () => cityAudio.getState(), () => cityAudio.getState());

  useCityAudioEvents(entered && gate === "world");

  // Wanted heat → patrol siren loop (gameStore heat 0..100; siren at >= 60).
  useEffect(() => {
    cityAudio.setHeat(useGameStore.getState().heat);
    const unsub = useGameStore.subscribe((s) => cityAudio.setHeat(s.heat));
    return unsub;
  }, []);

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
    } else if (gate === "menu" || gate === "characters" || gate === "lobbies") {
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
