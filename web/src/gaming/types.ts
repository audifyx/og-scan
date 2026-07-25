/** OrbitX Gaming Studio — core game types (client). No trading, no backend. */

export type PlayerClassId = "striker" | "scout" | "tank" | "socialite" | "operator";
export type StatId = "power" | "speed" | "vitality" | "focus" | "charisma" | "luck";
export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic";
export type ItemKind = "weapon" | "armor" | "accessory" | "consumable" | "key" | "badge" | "emote" | "title" | "currency";
export type EquipSlot = "head" | "body" | "hands" | "feet" | "back" | "weapon" | "accessory";
export type CosmeticSlot = "skin" | "hair" | "outfit" | "trail" | "aura" | "emote_idle";
export type MissionKind = "daily" | "weekly" | "story" | "event";
export type LobbyVisibility = "public" | "friends" | "private";
export type PresenceStatus = "online" | "away" | "in_game" | "in_lobby" | "in_voice" | "offline";

export interface StatBlock {
  power: number;
  speed: number;
  vitality: number;
  focus: number;
  charisma: number;
  luck: number;
}

export interface PlayerClassDef {
  id: PlayerClassId;
  name: string;
  tagline: string;
  description: string;
  baseStats: StatBlock;
  accent: string;
  starterItems: string[];
}

export interface CosmeticDef {
  id: string;
  name: string;
  slot: CosmeticSlot;
  rarity: Rarity;
  colors?: string[];
  unlockLevel?: number;
  priceShards?: number;
}

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  rarity: Rarity;
  slot?: EquipSlot;
  stackable: boolean;
  maxStack: number;
  stats?: Partial<StatBlock>;
  description: string;
  tradeable: boolean;
  priceShards?: number;
}

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  xp: number;
  category: "combat" | "social" | "explore" | "economy" | "meta";
}

export interface MissionDef {
  id: string;
  kind: MissionKind;
  title: string;
  description: string;
  xp: number;
  shardReward: number;
  criteria: Record<string, number>;
}

export interface BattlePassTier {
  tier: number;
  xpRequired: number;
  freeReward?: { itemId?: string; shards?: number; cosmeticId?: string; title?: string };
  premiumReward?: { itemId?: string; shards?: number; cosmeticId?: string; title?: string };
}

export interface BattlePassSeason {
  id: string;
  name: string;
  theme: string;
  endsAt: string;
  tiers: BattlePassTier[];
}

export interface InventoryStack {
  itemId: string;
  qty: number;
  equippedSlot?: EquipSlot;
}

export interface CharacterLoadout {
  name: string;
  classId: PlayerClassId;
  skinColor: string;
  hairColor: string;
  bodyColor: string;
  accentColor: string;
  hairStyle: string;
  faceStyle: string;
  cosmetics: Partial<Record<CosmeticSlot, string>>;
  equipment: Partial<Record<EquipSlot, string>>;
}

export interface PlayerProgression {
  xp: number;
  level: number;
  prestige: number;
  title: string;
  shards: number; // soft currency (in-game, not crypto)
  seasonXp: number;
  battlePassPremium: boolean;
  unlockedAchievements: string[];
  missionProgress: Record<string, { progress: Record<string, number>; status: "active" | "completed" | "claimed" }>;
  claimedBattlePassTiers: number[];
}

export interface GameProfile {
  version: 1;
  character: CharacterLoadout;
  progression: PlayerProgression;
  inventory: InventoryStack[];
  friends: string[];
  partyId: string | null;
  updatedAt: number;
}

export interface HudSnapshot {
  health: number;
  maxHealth: number;
  energy: number;
  maxEnergy: number;
  level: number;
  xp: number;
  nextXp: number;
  shards: number;
  status: PresenceStatus;
  notifications: GameNotification[];
}

export interface GameNotification {
  id: string;
  kind: "info" | "reward" | "social" | "mission" | "party";
  title: string;
  body: string;
  at: number;
  read?: boolean;
}

export interface LobbyDescriptor {
  id: string;
  label: string;
  mode: string;
  visibility: LobbyVisibility;
  players: number;
  maxPlayers: number;
  hostName: string;
  passwordRequired: boolean;
  region: string;
}

export interface PartyMember {
  id: string;
  name: string;
  classId: PlayerClassId;
  ready: boolean;
  leader: boolean;
}

export interface PresencePeer {
  id: string;
  name: string;
  status: PresenceStatus;
  activity?: string;
}
