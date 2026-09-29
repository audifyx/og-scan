/**
 * Real estate module — homes store (apartments & safehouses).
 *
 * Apartments: bought with real ORBITX (burned). Safehouses: paper CITY.
 * Furniture: paper CITY for basics, ORBITX for premium pieces (burned).
 * Guests are invited by player-id. A home can be the player's spawn point —
 * the integrator reads `getSpawnHome()` and wires it to core's teleport once
 * core exposes it (documented in MODULE.md).
 */
import { useSyncExternalStore } from "react";
import type { Home, PaperLedger, PlacedFurniture } from "../types";
import { districtById, furnitureById, homeTemplateById } from "../data/catalog";
import type { RealEstateBilling } from "../billing";

const STORAGE_KEY = "orbitxcity:realestate-homes:v1";
const MAX_HOMES = 20;

function load(): Home[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.slice(0, MAX_HOMES);
    }
  } catch {
    /* corrupted storage — start fresh */
  }
  return [];
}

let state: Home[] = load();
const listeners = new Set<() => void>();

function emit() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage blocked — keep in memory */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Home[] {
  return state;
}

function update(homeId: string, fn: (h: Home) => Home) {
  state = state.map((h) => (h.homeId === homeId ? fn(h) : h));
  emit();
}

export const homeStore = {
  get: getSnapshot,
  subscribe,

  /** Buy an apartment (ORBITX, burned) or safehouse (paper CITY). */
  async buyHome(templateId: string, ownerId: string, billing: RealEstateBilling, ledger: PaperLedger): Promise<Home> {
    const tpl = homeTemplateById(templateId);
    if (!tpl) throw new Error("Unknown home");
    if (state.some((h) => h.homeId === templateId && h.ownerId === ownerId)) {
      throw new Error("You already own this home");
    }
    const now = Date.now();
    const home: Home = {
      homeId: templateId,
      kind: tpl.kind,
      name: tpl.name,
      districtId: tpl.districtId,
      ownerId,
      purchasedAt: now,
      decoSlots: tpl.decoSlots,
      furniture: [],
      guests: [],
      isSpawnPoint: state.length === 0, // first home becomes the spawn by default
    };
    if (tpl.kind === "apartment") {
      if (!tpl.costOrbitx) throw new Error("Apartment has no ORBITX price");
      const { signature } = await billing.buyPremium(`home:${tpl.id}`, `Apartment — ${tpl.name}`, tpl.costOrbitx);
      home.purchaseSignature = signature;
    } else {
      if (!tpl.costCity) throw new Error("Safehouse has no CITY price");
      ledger.debit(tpl.costCity, `Safehouse — ${tpl.name}`, "realestate:home");
    }
    state = [home, ...state].slice(0, MAX_HOMES);
    emit();
    return home;
  },

  /** Buy + place furniture. Paper CITY for basics, ORBITX (burned) for premium. */
  async placeFurniture(homeId: string, itemId: string, billing: RealEstateBilling, ledger: PaperLedger): Promise<PlacedFurniture> {
    const home = state.find((h) => h.homeId === homeId);
    if (!home) throw new Error("Home not found");
    const item = furnitureById(itemId);
    if (!item) throw new Error("Unknown furniture");
    if (home.furniture.length >= home.decoSlots) throw new Error("No free decoration slots");
    if (item.costOrbitx) {
      await billing.buyPremium(`home:${homeId}:furniture:${itemId}`, `${item.name} — ${home.name}`, item.costOrbitx);
    } else if (item.costCity) {
      ledger.debit(item.costCity, `${item.name} — ${home.name}`, "realestate:furniture");
    }
    const placed: PlacedFurniture = { instanceId: crypto.randomUUID(), itemId, placedAt: Date.now() };
    update(homeId, (h) => ({ ...h, furniture: [...h.furniture, placed] }));
    return placed;
  },

  removeFurniture(homeId: string, instanceId: string) {
    update(homeId, (h) => ({ ...h, furniture: h.furniture.filter((f) => f.instanceId !== instanceId) }));
  },

  /** Invite a friend (player-id / handle) to the home. */
  inviteGuest(homeId: string, playerId: string) {
    const id = playerId.trim();
    if (!id) throw new Error("Player id is empty");
    update(homeId, (h) => (h.guests.includes(id) ? h : { ...h, guests: [...h.guests, id] }));
  },

  revokeGuest(homeId: string, playerId: string) {
    update(homeId, (h) => ({ ...h, guests: h.guests.filter((g) => g !== playerId) }));
  },

  /** Set this home as the player's spawn point (clears the others). */
  setSpawn(homeId: string) {
    state = state.map((h) => ({ ...h, isSpawnPoint: h.homeId === homeId }));
    emit();
  },

  /** Home the player spawns at — integration point for core teleport. */
  getSpawnHome(): Home | undefined {
    return state.find((h) => h.isSpawnPoint) ?? state[0];
  },

  /** Human-readable district for a home. */
  homeDistrictName(home: Home): string {
    return districtById(home.districtId).name;
  },
};

export function useHomes() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
