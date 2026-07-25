import type { AchievementDef, BattlePassSeason, MissionDef } from "../types";

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first_boot", name: "Systems Online", description: "Create your first OrbitX character", xp: 50, category: "meta" },
  { id: "class_pick", name: "Role Locked", description: "Choose a player class", xp: 40, category: "meta" },
  { id: "city_entry", name: "City Lights", description: "Enter OrbitX City", xp: 75, category: "explore" },
  { id: "party_up", name: "Squad Formed", description: "Create or join a party", xp: 60, category: "social" },
  { id: "daily_three", name: "Mission Runner", description: "Complete 3 daily missions", xp: 120, category: "meta" },
  { id: "shard_500", name: "Shard Saver", description: "Hold 500 shards at once", xp: 100, category: "economy" },
  { id: "equip_full", name: "Fully Kitted", description: "Fill every equipment slot", xp: 90, category: "combat" },
  { id: "voice_join", name: "On Comms", description: "Join a voice lobby session", xp: 70, category: "social" },
  { id: "level_10", name: "Deca Rank", description: "Reach level 10", xp: 200, category: "meta" },
  { id: "pass_tier_5", name: "Season Climber", description: "Claim battle pass tier 5", xp: 150, category: "meta" },
];

export const DAILY_MISSIONS: MissionDef[] = [
  { id: "daily_login", kind: "daily", title: "Boot Sequence", description: "Open the Play hub once today", xp: 40, shardReward: 25, criteria: { open_play: 1 } },
  { id: "daily_customize", kind: "daily", title: "Fresh Fit", description: "Change a cosmetic or equipment piece", xp: 50, shardReward: 35, criteria: { customize: 1 } },
  { id: "daily_social", kind: "daily", title: "Signal Check", description: "Send 3 party/lobby chat lines", xp: 55, shardReward: 40, criteria: { chat: 3 } },
  { id: "daily_explore", kind: "daily", title: "Street Miles", description: "Enter OrbitX City and play 5 minutes", xp: 70, shardReward: 50, criteria: { city_minutes: 5 } },
];

export const WEEKLY_MISSIONS: MissionDef[] = [
  { id: "weekly_party", kind: "weekly", title: "Party Circuit", description: "Complete 5 matches/lobbies with a party", xp: 200, shardReward: 180, criteria: { party_sessions: 5 } },
  { id: "weekly_economy", kind: "weekly", title: "Shard Economy", description: "Earn 400 shards from missions", xp: 180, shardReward: 100, criteria: { shards_earned: 400 } },
];

export const BATTLE_PASS_SEASON: BattlePassSeason = {
  id: "s1-neon-dawn",
  name: "Season 1 · Neon Dawn",
  theme: "City ignition · metallic lime",
  endsAt: "2026-10-01T00:00:00.000Z",
  tiers: Array.from({ length: 20 }, (_, i) => {
    const tier = i + 1;
    return {
      tier,
      xpRequired: tier * 120,
      freeReward:
        tier % 2 === 0
          ? { shards: 40 + tier * 5 }
          : tier === 5
            ? { cosmeticId: "hair-mohawk" }
            : tier === 10
              ? { itemId: "emote-dance" }
              : { shards: 25 },
      premiumReward:
        tier % 5 === 0
          ? { cosmeticId: tier >= 15 ? "outfit-neon" : "aura-grid", shards: 80 }
          : { shards: 60 + tier * 3, itemId: tier === 8 ? "xp-boost" : undefined },
    };
  }),
};
