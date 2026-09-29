import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { useCity } from "@/pages/orbitxcity/CityProvider";
import { cityAudio } from "@/lib/orbitxcity/cityAudio";
import { useEconomyStore } from "@/lib/orbitxcity/economyStore";
import { useMissionStore } from "@/lib/orbitxcity/missionStore";
import {
  loadSave,
  readClaimedMissionIds,
  restoreEconomyCredits,
  saveGame,
  type CitySave,
} from "@/lib/orbitxcity/saveGame";
import type { CityId } from "@/lib/orbitxcity/types";

/**
 * Mount once inside the CityProvider tree (next to CityAudioController).
 * - On first world entry: loads 'oxc-save-v1' and applies quality, touch
 *   controls, avatar, selected city, economy credits, and audio prefs via the
 *   existing setters/stores.
 * - Afterwards: debounced auto-save (500ms) on settings/avatar/audio/economy
 *   changes, mission history updates, and provider claimed-mission changes.
 */
export function CitySaveController() {
  const {
    entered,
    avatar,
    setAvatar,
    selectedCityId,
    setSelectedCityId,
    quality,
    setQuality,
    touchControls,
    setTouchControls,
    claimedMissionIds,
  } = useCity();
  const audio = useSyncExternalStore(cityAudio.subscribe, () => cityAudio.getState(), () => cityAudio.getState());

  const appliedRef = useRef(false);
  const saveTimer = useRef<number | null>(null);

  // Load once on first entry into the world.
  useEffect(() => {
    if (!entered || appliedRef.current) return;
    appliedRef.current = true;
    const s = loadSave();
    if (!s) return;
    applySave(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entered]);

  /** Debounced write — one place all auto-save triggers funnel through. */
  const scheduleSave = useCallback(() => {
    if (!appliedRef.current) return;
    if (saveTimer.current != null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = null;
      const s = loadSave();
      const providerIds = readClaimedMissionIds();
      const completedIds = Array.from(
        new Set([...(s?.missions.completedIds ?? []), ...providerIds]),
      );
      saveGame({
        avatar,
        selectedCityId,
        quality,
        touchControls,
        audio: {
          masterMuted: audio.muted,
          musicOn: audio.musicOn,
          sfxOn: audio.sfxOn,
          musicVol: audio.musicVol,
          sfxVol: audio.sfxVol,
          trackId: audio.trackId,
        },
        missions: {
          completedIds,
          completions: s?.missions.completions ?? {},
          lastCompletedAt: s?.missions.lastCompletedAt ?? null,
        },
      });
    }, 500);
  }, [avatar, selectedCityId, quality, touchControls, audio]);

  // Auto-save on provider/avatar/audio changes.
  useEffect(() => {
    scheduleSave();
  }, [entered, avatar, selectedCityId, quality, touchControls, claimedMissionIds, audio, scheduleSave]);

  // Auto-save on mission runs + credit changes (Worker 3 stores).
  useEffect(() => {
    const unsubMissions = useMissionStore.subscribe(() => scheduleSave());
    const unsubEconomy = useEconomyStore.subscribe(() => scheduleSave());
    return () => {
      unsubMissions();
      unsubEconomy();
    };
  }, [scheduleSave]);

  useEffect(
    () => () => {
      if (saveTimer.current != null) window.clearTimeout(saveTimer.current);
    },
    [],
  );

  function applySave(s: CitySave) {
    // Settings through the provider's own setters (single source of truth stays in React).
    if (s.quality !== quality) setQuality(s.quality);
    if (s.touchControls !== touchControls) setTouchControls(s.touchControls);
    if (s.selectedCityId !== selectedCityId) setSelectedCityId(s.selectedCityId as CityId);
    setAvatar({ ...s.avatar });

    // Credits back into the economy store (ledgered as a restore).
    restoreEconomyCredits(s.credits);

    // Audio prefs into the engine (which persists its own keys).
    if (s.audio.masterMuted !== audio.muted) cityAudio.setMasterMuted(s.audio.masterMuted);
    if (s.audio.musicOn !== audio.musicOn) cityAudio.setMusicOn(s.audio.musicOn);
    if (s.audio.sfxOn !== audio.sfxOn) cityAudio.setSfxOn(s.audio.sfxOn);
    if (s.audio.musicVol !== audio.musicVol) cityAudio.setMusicVol(s.audio.musicVol);
    if (s.audio.sfxVol !== audio.sfxVol) cityAudio.setSfxVol(s.audio.sfxVol);
    if (s.audio.trackId !== audio.trackId) cityAudio.setTrack(s.audio.trackId);

    // Union claimed-missions back to the provider's own key (it only reads this at boot).
    try {
      const union = Array.from(new Set([...s.missions.completedIds, ...readClaimedMissionIds()]));
      localStorage.setItem("oxc_claimed_missions", JSON.stringify(union));
    } catch {
      /* ignore */
    }
  }

  return null;
}
