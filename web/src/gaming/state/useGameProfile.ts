import { useMemo, useSyncExternalStore } from "react";
import { buildHud, gameProfileStore, loadNotifications } from "./GameProfileStore";
import { computeStats, xpProgress } from "../systems/progression";

export function useGameProfile() {
  const profile = useSyncExternalStore(gameProfileStore.subscribe, gameProfileStore.getSnapshot, gameProfileStore.getSnapshot);
  const stats = useMemo(() => computeStats(profile), [profile]);
  const xp = useMemo(() => xpProgress(profile.progression.xp), [profile.progression.xp]);
  const hud = useMemo(() => buildHud(profile), [profile]);
  const notifications = useMemo(() => loadNotifications(), [profile.updatedAt]);

  return {
    profile,
    stats,
    xp,
    hud,
    notifications,
    setProfile: (p: typeof profile) => gameProfileStore.set(p),
    updateProfile: (fn: (p: typeof profile) => typeof profile) => gameProfileStore.update(fn),
  };
}
