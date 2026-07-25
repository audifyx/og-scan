import type { EquipSlot, GameProfile, InventoryStack } from "../types";
import { getItem } from "../catalogs/classesItems";
import { awardShards } from "./progression";

export function addItem(profile: GameProfile, itemId: string, qty = 1): GameProfile {
  const def = getItem(itemId);
  if (!def) return profile;
  const inventory = [...profile.inventory];
  const existing = inventory.find((s) => s.itemId === itemId);
  if (existing && def.stackable) {
    existing.qty = Math.min(def.maxStack, existing.qty + qty);
  } else if (!existing) {
    inventory.push({ itemId, qty: def.stackable ? Math.min(def.maxStack, qty) : 1 });
  }
  return { ...profile, inventory, updatedAt: Date.now() };
}

export function removeItem(profile: GameProfile, itemId: string, qty = 1): GameProfile {
  const inventory = profile.inventory
    .map((s) => (s.itemId === itemId ? { ...s, qty: s.qty - qty } : s))
    .filter((s) => s.qty > 0);
  const equipment = { ...profile.character.equipment };
  for (const [slot, id] of Object.entries(equipment)) {
    if (id === itemId && !inventory.some((s) => s.itemId === itemId)) {
      delete equipment[slot as EquipSlot];
    }
  }
  return {
    ...profile,
    inventory,
    character: { ...profile.character, equipment },
    updatedAt: Date.now(),
  };
}

export function equipItem(profile: GameProfile, itemId: string): GameProfile {
  const def = getItem(itemId);
  if (!def?.slot) return profile;
  if (!profile.inventory.some((s) => s.itemId === itemId)) return profile;
  const equipment = { ...profile.character.equipment, [def.slot]: itemId };
  const inventory: InventoryStack[] = profile.inventory.map((s) =>
    s.itemId === itemId ? { ...s, equippedSlot: def.slot } : s.equippedSlot === def.slot ? { ...s, equippedSlot: undefined } : s,
  );
  return {
    ...profile,
    inventory,
    character: { ...profile.character, equipment },
    updatedAt: Date.now(),
  };
}

export function buyWithShards(profile: GameProfile, itemId: string): { ok: boolean; profile: GameProfile; error?: string } {
  const def = getItem(itemId);
  if (!def?.priceShards) return { ok: false, profile, error: "Not for sale" };
  if (profile.progression.shards < def.priceShards) return { ok: false, profile, error: "Not enough shards" };
  let next = {
    ...profile,
    progression: awardShards(profile.progression, -def.priceShards),
  };
  next = addItem(next, itemId, 1);
  return { ok: true, profile: next };
}

export function consumeItem(profile: GameProfile, itemId: string): { ok: boolean; profile: GameProfile; error?: string } {
  const def = getItem(itemId);
  if (!def || def.kind !== "consumable") return { ok: false, profile, error: "Not consumable" };
  if (!profile.inventory.some((s) => s.itemId === itemId)) return { ok: false, profile, error: "Missing item" };
  let next = removeItem(profile, itemId, 1);
  if (itemId === "shard-pouch") {
    next = { ...next, progression: awardShards(next.progression, 50) };
  }
  return { ok: true, profile: next };
}

/** Soft-currency reward loop helpers (not crypto). */
export function missionShardPayout(base: number, charisma: number): number {
  return Math.round(base * (1 + charisma * 0.02));
}
