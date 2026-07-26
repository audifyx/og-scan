import type { GameProfile, GameNotification, HudSnapshot } from "../types";
import { defaultCharacter } from "../systems/character";
import { addItem } from "../systems/economy";
import { awardXp, computeStats, maxEnergy, maxHealth, unlockAchievement, xpProgress } from "../systems/progression";
import { DAILY_MISSIONS, WEEKLY_MISSIONS } from "../catalogs/progressionCatalog";

const STORAGE_KEY = "ox_game_profile_v1";
const NOTIF_KEY = "ox_game_notifications_v1";

function emptyProgression(): GameProfile["progression"] {
  const missionProgress: GameProfile["progression"]["missionProgress"] = {};
  for (const m of [...DAILY_MISSIONS, ...WEEKLY_MISSIONS]) {
    missionProgress[m.id] = { progress: {}, status: "active" };
  }
  return {
    xp: 0,
    level: 1,
    prestige: 0,
    title: "Recruit",
    shards: 120,
    seasonXp: 0,
    battlePassPremium: false,
    unlockedAchievements: [],
    missionProgress,
    claimedBattlePassTiers: [],
  };
}

export function createNewProfile(name = "Traveler"): GameProfile {
  let profile: GameProfile = {
    version: 1,
    character: defaultCharacter(name),
    progression: emptyProgression(),
    inventory: [],
    friends: ["ShardQueen", "JupPilot", "LimeFox"],
    partyId: null,
    updatedAt: Date.now(),
  };
  profile = addItem(profile, "badge-pioneer", 1);
  profile = addItem(profile, "key-nyc", 1);
  profile = addItem(profile, "shard-pouch", 2);
  const boot = unlockAchievement(profile.progression, "first_boot");
  profile = { ...profile, progression: boot.prog };
  return profile;
}

export function loadProfile(): GameProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as GameProfile;
      if (parsed?.version === 1 && parsed.character && parsed.progression) return parsed;
    }
  } catch {
    /* ignore */
  }
  const fresh = createNewProfile();
  saveProfile(fresh);
  return fresh;
}

export function saveProfile(profile: GameProfile) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...profile, updatedAt: Date.now() }));
}

export function loadNotifications(): GameNotification[] {
  try {
    const raw = localStorage.getItem(NOTIF_KEY);
    if (raw) return JSON.parse(raw) as GameNotification[];
  } catch {
    /* ignore */
  }
  return [];
}

export function pushNotification(n: Omit<GameNotification, "id" | "at"> & { id?: string; at?: number }) {
  const list = loadNotifications();
  const item: GameNotification = {
    id: n.id ?? `n_${Date.now()}`,
    kind: n.kind,
    title: n.title,
    body: n.body,
    at: n.at ?? Date.now(),
    read: false,
  };
  const next = [item, ...list].slice(0, 40);
  localStorage.setItem(NOTIF_KEY, JSON.stringify(next));
  return next;
}

export function markNotificationsRead() {
  const next = loadNotifications().map((n) => ({ ...n, read: true }));
  localStorage.setItem(NOTIF_KEY, JSON.stringify(next));
  return next;
}

export function buildHud(profile: GameProfile): HudSnapshot {
  const stats = computeStats(profile);
  const xp = xpProgress(profile.progression.xp);
  return {
    health: maxHealth(stats),
    maxHealth: maxHealth(stats),
    energy: maxEnergy(stats),
    maxEnergy: maxEnergy(stats),
    level: xp.level,
    xp: xp.into,
    nextXp: xp.need,
    shards: profile.progression.shards,
    status: "online",
    notifications: loadNotifications().filter((n) => !n.read).slice(0, 5),
  };
}

export function bumpMission(profile: GameProfile, missionId: string, key: string, by = 1): GameProfile {
  const mission = [...DAILY_MISSIONS, ...WEEKLY_MISSIONS].find((m) => m.id === missionId);
  if (!mission) return profile;
  const entry = profile.progression.missionProgress[missionId] ?? { progress: {}, status: "active" as const };
  if (entry.status !== "active") return profile;
  const progress = { ...entry.progress, [key]: (entry.progress[key] ?? 0) + by };
  let status = entry.status;
  const done = Object.entries(mission.criteria).every(([k, need]) => (progress[k] ?? 0) >= need);
  if (done) status = "completed";
  return {
    ...profile,
    progression: {
      ...profile.progression,
      missionProgress: {
        ...profile.progression.missionProgress,
        [missionId]: { progress, status },
      },
    },
    updatedAt: Date.now(),
  };
}

export function claimMission(profile: GameProfile, missionId: string): GameProfile {
  const mission = [...DAILY_MISSIONS, ...WEEKLY_MISSIONS].find((m) => m.id === missionId);
  const entry = profile.progression.missionProgress[missionId];
  if (!mission || !entry || entry.status !== "completed") return profile;
  let progression = awardXp(profile.progression, mission.xp);
  progression = {
    ...progression,
    shards: progression.shards + mission.shardReward,
    missionProgress: {
      ...progression.missionProgress,
      [missionId]: { ...entry, status: "claimed" },
    },
  };
  const claimedCount = Object.values(progression.missionProgress).filter((m) => m.status === "claimed").length;
  if (claimedCount >= 3) {
    progression = unlockAchievement(progression, "daily_three").prog;
  }
  pushNotification({
    kind: "mission",
    title: "Mission claimed",
    body: `+${mission.xp} XP · +${mission.shardReward} shards`,
  });
  return { ...profile, progression, updatedAt: Date.now() };
}

type Listener = () => void;

class GameProfileStore {
  private profile: GameProfile = loadProfile();
  private listeners = new Set<Listener>();

  getSnapshot = () => this.profile;

  subscribe = (cb: Listener) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };

  set(profile: GameProfile) {
    this.profile = profile;
    saveProfile(profile);
    for (const cb of this.listeners) cb();
  }

  update(fn: (p: GameProfile) => GameProfile) {
    this.set(fn(this.profile));
  }
}

export const gameProfileStore = new GameProfileStore();
