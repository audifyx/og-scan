/**
 * OrbitXCity — Vehicles module: chop shop (performance mods).
 *
 * RULE: every performance mod burns real ORBITX (backend-signed, no popup).
 * Cosmetics (paint, neon) are paper CITY. One mod per slot per vehicle —
 * installing into an occupied slot replaces the old one (old mod is lost,
 * GTA-style: no refunds).
 */
import { effectiveStats, MOD_DEFS, modDef, vehicleDef } from "./data/catalog";
import type { BurnReceipt, PaperDelta, VehicleInstance } from "./types";
import type { IBurnProvider } from "./economy";
import { burnRef } from "./economy";

export const CHOP_SHOP = {
  name: "Los Toros Chop Shop",
  x: -112,
  z: 88,
  blip: "🔧 Chop Shop",
};

export interface ModQuote {
  modId: string;
  name: string;
  slot: string;
  description: string;
  orbitxBurn: number;
  paperDelta: PaperDelta | null;
  replaces: string | null; // mod id being replaced, if any
  fits: boolean;
}

export function quoteMod(instance: VehicleInstance, modId: string): ModQuote {
  const def = vehicleDef(instance.defId);
  const mod = modDef(modId);
  const fits = mod.fits.includes(def.kind);
  const replaced = instance.mods.find((id) => {
    try { return modDef(id).slot === mod.slot; } catch { return false; }
  }) ?? null;
  return {
    modId,
    name: mod.name,
    slot: mod.slot,
    description: mod.description,
    orbitxBurn: mod.orbitxCost,
    paperDelta: mod.paperCost > 0
      ? { amount: -mod.paperCost, label: `Chop shop — ${mod.name}`, source: "vehicles:chopshop" }
      : null,
    replaces: replaced,
    fits,
  };
}

export interface ModInstallResult {
  instance: VehicleInstance;
  burn: BurnReceipt | null;
  paperDelta: PaperDelta | null;
  /** Effective stats after install (for the tune HUD). */
  stats: ReturnType<typeof effectiveStats>;
}

/**
 * Installs a mod: burns ORBITX via the provider (null provider = paper-only
 * "pending billing" receipt), returns the paper delta for the integrator.
 */
export async function installMod(
  instance: VehicleInstance,
  modId: string,
  burn: IBurnProvider,
): Promise<ModInstallResult> {
  const quote = quoteMod(instance, modId);
  if (!quote.fits) throw new Error(`${quote.name} does not fit ${vehicleDef(instance.defId).kind}`);
  let receipt: BurnReceipt | null = null;
  if (quote.orbitxBurn > 0) {
    receipt = await burn.burn({
      amount: quote.orbitxBurn,
      reason: `city:vehicles:mod:${modId}`,
      ref: burnRef(`veh-mod-${instance.uid}`),
    });
    if (!receipt.ok) throw new Error("Mod burn failed");
  }
  const replacedSlot = quote.replaces ? modDef(quote.replaces).slot : null;
  const mods = instance.mods.filter((id) => {
    if (id === quote.replaces) return false;
    try { return replacedSlot ? modDef(id).slot !== replacedSlot : true; } catch { return true; }
  });
  mods.push(modId);
  const next: VehicleInstance = { ...instance, mods };
  return {
    instance: next,
    burn: receipt,
    paperDelta: quote.paperDelta,
    stats: effectiveStats(vehicleDef(next.defId), next.mods),
  };
}

/** All mods that fit a vehicle, grouped for the shop UI. */
export function availableMods(defId: string) {
  const def = vehicleDef(defId);
  return MOD_DEFS.filter((m) => m.fits.includes(def.kind));
}
