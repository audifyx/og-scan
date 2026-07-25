import type { GameProfile, PlayerProgression, StatBlock } from "../types";
import { getClass, getItem } from "../catalogs/classesItems";
import { ACHIEVEMENTS, BATTLE_PASS_SEASON } from "../catalogs/progressionCatalog";

/** Cumulative XP curve: level N requires sum_{i=1..N-1} (100 * i) */
export function xpToReachLevel(level: number): number {
  const L = Math.max(1, Math.floor(level));
  return Math.floor(50 * (L - 1) * L);
}

export function levelFromXp(xp: number): number {
  let level = 1;
  while (xpToReachLevel(level + 1) <= xp && level < 100) level += 1;
  return level;
}

export function xpProgress(xp: number): { level: number; into: number; need: number; pct: number } {
  const level = levelFromXp(xp);
  const cur = xpToReachLevel(level);
  const next = xpToReachLevel(level + 1);
  const into = Math.max(0, xp - cur);
  const need = Math.max(1, next - cur);
  return { level, into, need, pct: Math.min(100, Math.round((into / need) * 100)) };
}

export function computeStats(profile: GameProfile): StatBlock {
  const base = getClass(profile.character.classId)?.baseStats ?? {
    power: 5, speed: 5, vitality: 5, focus: 5, charisma: 5, luck: 5,
  };
  const stats: StatBlock = { ...base };
  for (const itemId of Object.values(profile.character.equipment)) {
    if (!itemId) continue;
    const item = getItem(itemId);
    if (!item?.stats) continue;
    for (const [k, v] of Object.entries(item.stats)) {
      const key = k as keyof StatBlock;
      stats[key] = (stats[key] ?? 0) + (v ?? 0);
    }
  }
  // Level scaling
  const bonus = Math.floor((profile.progression.level - 1) / 2);
  stats.power += bonus;
  stats.vitality += bonus;
  return stats;
}

export function maxHealth(stats: StatBlock): number {
  return 80 + stats.vitality * 12;
}

export function maxEnergy(stats: StatBlock): number {
  return 50 + stats.focus * 8 + stats.speed * 2;
}

export function awardXp(prog: PlayerProgression, amount: number): PlayerProgression {
  const xp = Math.max(0, prog.xp + amount);
  const level = levelFromXp(xp);
  const seasonXp = prog.seasonXp + Math.max(0, amount);
  const unlocked = new Set(prog.unlockedAchievements);
  if (level >= 10) unlocked.add("level_10");
  return {
    ...prog,
    xp,
    level,
    seasonXp,
    unlockedAchievements: Array.from(unlocked),
    title: level >= 10 ? "Deca Operative" : prog.title,
  };
}

export function awardShards(prog: PlayerProgression, amount: number): PlayerProgression {
  const shards = Math.max(0, prog.shards + amount);
  const unlocked = new Set(prog.unlockedAchievements);
  if (shards >= 500) unlocked.add("shard_500");
  return { ...prog, shards, unlockedAchievements: Array.from(unlocked) };
}

export function unlockAchievement(prog: PlayerProgression, id: string): { prog: PlayerProgression; xpGained: number } {
  if (prog.unlockedAchievements.includes(id)) return { prog, xpGained: 0 };
  const def = ACHIEVEMENTS.find((a) => a.id === id);
  const withFlag: PlayerProgression = {
    ...prog,
    unlockedAchievements: [...prog.unlockedAchievements, id],
  };
  if (!def) return { prog: withFlag, xpGained: 0 };
  return { prog: awardXp(withFlag, def.xp), xpGained: def.xp };
}

export function claimBattlePassTier(prog: PlayerProgression): PlayerProgression {
  const claimed = new Set(prog.claimedBattlePassTiers);
  let next = { ...prog };
  for (const tier of BATTLE_PASS_SEASON.tiers) {
    if (claimed.has(tier.tier)) continue;
    if (next.seasonXp < tier.xpRequired) break;
    claimed.add(tier.tier);
    const reward = prog.battlePassPremium ? tier.premiumReward : tier.freeReward;
    if (reward?.shards) next = awardShards(next, reward.shards);
    if (tier.tier >= 5) {
      const u = unlockAchievement(next, "pass_tier_5");
      next = u.prog;
    }
  }
  return { ...next, claimedBattlePassTiers: Array.from(claimed).sort((a, b) => a - b) };
}
