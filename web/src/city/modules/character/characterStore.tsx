/**
 * Character state: profile persistence, outfit buffs, gym training,
 * paper CITY wallet, companion config. Billing (real ORBITX burns) is
 * injected through <CharacterProvider billing={...}> — see billing.ts.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type {
  Appearance,
  BurnReceipt,
  CharacterBillingProvider,
  CharacterProfile,
  CharacterStats,
  DerivedEffects,
  OutfitSlot,
  StatBuffs,
  TrainableStat,
} from "./types";
import { BARBER_STYLES, clothingById, FACIAL_HAIR, GYM_EXERCISES, STORES, TATTOOS } from "./data";
import { purchaseBurn } from "./billing";

const STORE_KEY = "orbitxcity.character.v1";
const STARTER_CITY = 500;

function defaultAppearance(): Appearance {
  return { skinToneId: "sand", hairStyleId: "fade", hairColorId: "raven", facialHairId: "none" };
}

function defaultStats(): CharacterStats {
  return { strength: 10, stamina: 10, agility: 10 };
}

function defaultProfile(): CharacterProfile {
  const now = Date.now();
  return {
    id: `char-${now}`,
    name: "Rookie",
    appearance: defaultAppearance(),
    outfit: {},
    wardrobe: ["tee-basic", "jeans-basic", "shoes-sneak"],
    tattoos: [],
    cuts: ["fade"],
    stats: defaultStats(),
    progress: { strength: 0, stamina: 0, agility: 0 },
    cityBalance: STARTER_CITY,
    companionName: "Orbit",
    companionColor: 0x14c8b4,
    companionEnabled: true,
    lastTrained: {},
    receipts: [],
    createdAt: now,
    updatedAt: now,
  };
}

function loadProfile(): CharacterProfile {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as CharacterProfile;
      if (p && p.appearance && p.stats) {
        return {
          ...defaultProfile(),
          ...p,
          stats: { ...defaultStats(), ...p.stats },
          progress: { strength: 0, stamina: 0, agility: 0, ...p.progress },
          appearance: { ...defaultAppearance(), ...p.appearance },
        };
      }
    }
  } catch { /* corrupted save → fresh profile */ }
  return defaultProfile();
}

/** Sum of outfit buffs for the currently equipped clothing. */
export function getActiveBuffs(profile: CharacterProfile): StatBuffs {
  const total: StatBuffs = {};
  for (const itemId of Object.values(profile.outfit)) {
    if (!itemId) continue;
    const item = clothingById(itemId);
    if (!item) continue;
    if (item.buffs.strength) total.strength = (total.strength ?? 0) + item.buffs.strength;
    if (item.buffs.stamina) total.stamina = (total.stamina ?? 0) + item.buffs.stamina;
    if (item.buffs.speed) total.speed = (total.speed ?? 0) + item.buffs.speed;
  }
  return total;
}

/**
 * Stats → gameplay effects. Core's character controller consumes these
 * (documented in MODULE.md as the stat hook the core team should read).
 */
export function getDerivedEffects(profile: CharacterProfile): DerivedEffects {
  const buffs = getActiveBuffs(profile);
  const strength = profile.stats.strength + (buffs.strength ?? 0);
  const stamina = profile.stats.stamina + (buffs.stamina ?? 0);
  const agility = profile.stats.agility + (buffs.speed ?? 0) * 0.5;
  return {
    strength, stamina, agility,
    sprintSpeedMult: 1 + stamina * 0.004 + (buffs.speed ?? 0) * 0.01,
    sprintStaminaSec: 6 + stamina * 0.12,
    meleeDamageMult: 1 + strength * 0.02,
    accelMult: 1 + agility * 0.006,
  };
}

export function getStores() {
  return STORES;
}

interface CharacterContextValue {
  profile: CharacterProfile;
  buffs: StatBuffs;
  effects: DerivedEffects;
  billingReady: boolean;
  orbitxBalance: number | null;
  beginBillingAuth: () => void;
  updateAppearance: (patch: Partial<Appearance>) => void;
  setName: (name: string) => void;
  buyClothing: (itemId: string) => Promise<{ ok: boolean; message?: string }>;
  equip: (slot: OutfitSlot, itemId: string | null) => void;
  buyTattoo: (designId: string) => Promise<{ ok: boolean; message?: string }>;
  removeTattoo: (designId: string) => void;
  buyCut: (styleId: string) => Promise<{ ok: boolean; message?: string }>;
  train: (exerciseId: string) => { ok: boolean; message: string };
  renameCompanion: (name: string) => void;
  setCompanionColor: (hex: number) => void;
  setCompanionEnabled: (on: boolean) => void;
  grantCity: (n: number) => void;
  reset: () => void;
}

const CharacterContext = createContext<CharacterContextValue | null>(null);

export function CharacterProvider(props: {
  children: React.ReactNode;
  billing?: CharacterBillingProvider | null;
}) {
  const [profile, setProfile] = useState<CharacterProfile>(loadProfile);
  const billingRef = useRef(props.billing ?? null);
  billingRef.current = props.billing ?? null;

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ ...profile, updatedAt: Date.now() }));
    } catch { /* storage full / private mode */ }
  }, [profile]);

  const patch = useCallback((fn: (p: CharacterProfile) => CharacterProfile) => {
    setProfile((p) => ({ ...fn(p), updatedAt: Date.now() }));
  }, []);

  const addReceipt = useCallback((receipt: BurnReceipt) => {
    patch((p) => ({ ...p, receipts: [receipt, ...p.receipts].slice(0, 200) }));
  }, [patch]);

  const buyWithBurn = useCallback(async (
    itemId: string,
    kind: BurnReceipt["kind"],
    amount: number,
    alreadyOwned: boolean,
  ): Promise<{ ok: boolean; message?: string }> => {
    if (alreadyOwned) return { ok: true };
    const billing = billingRef.current;
    if (!billing) return { ok: false, message: "Billing not connected yet." };
    const res = await purchaseBurn(billing, itemId, kind, amount);
    if (res.ok === false) return { ok: false, message: res.message };
    addReceipt(res.receipt);
    return { ok: true };
  }, [addReceipt]);

  const value = useMemo<CharacterContextValue>(() => {
    const billing = billingRef.current;
    return {
      profile,
      buffs: getActiveBuffs(profile),
      effects: getDerivedEffects(profile),
      billingReady: billing?.ready ?? false,
      orbitxBalance: billing?.balance ?? null,
      beginBillingAuth: () => billing?.beginAuth(),

      updateAppearance: (a) => patch((p) => ({ ...p, appearance: { ...p.appearance, ...a } })),
      setName: (name) => patch((p) => ({ ...p, name: name.slice(0, 24) || "Rookie" })),

      buyClothing: async (itemId) => {
        const item = clothingById(itemId);
        if (!item) return { ok: false, message: "Unknown item." };
        const res = await buyWithBurn(itemId, "clothing", item.price, profile.wardrobe.includes(itemId));
        if (res.ok) {
          patch((p) => ({
            ...p,
            wardrobe: p.wardrobe.includes(itemId) ? p.wardrobe : [...p.wardrobe, itemId],
            outfit: { ...p.outfit, [item.slot]: itemId },
          }));
        }
        return res;
      },

      equip: (slot, itemId) => patch((p) => {
        const outfit = { ...p.outfit };
        if (itemId) outfit[slot] = itemId; else delete outfit[slot];
        return { ...p, outfit };
      }),

      buyTattoo: async (designId) => {
        const design = TATTOOS.find((t) => t.id === designId);
        if (!design) return { ok: false, message: "Unknown design." };
        const res = await buyWithBurn(designId, "tattoo", design.price, profile.tattoos.includes(designId));
        if (res.ok && !profile.tattoos.includes(designId)) {
          patch((p) => ({ ...p, tattoos: [...p.tattoos, designId] }));
        }
        return res;
      },

      removeTattoo: (designId) => patch((p) => ({ ...p, tattoos: p.tattoos.filter((t) => t !== designId) })),

      buyCut: async (styleId) => {
        const style = BARBER_STYLES.find((b) => b.id === styleId);
        const facial = FACIAL_HAIR.find((f) => f.id === styleId);
        const price = style?.price ?? facial?.price ?? 0;
        const res = await buyWithBurn(styleId, "barber", price, false);
        if (res.ok) {
          patch((p) => ({
            ...p,
            appearance: {
              ...p.appearance,
              hairStyleId: style ? style.id : p.appearance.hairStyleId,
              facialHairId: facial ? (facial.id as Appearance["facialHairId"]) : p.appearance.facialHairId,
            },
            cuts: style && !p.cuts.includes(style.id) ? [...p.cuts, style.id] : p.cuts,
          }));
        }
        return res;
      },

      train: (exerciseId) => {
        const ex = GYM_EXERCISES.find((e) => e.id === exerciseId);
        if (!ex) return { ok: false, message: "Unknown exercise." };
        const last = profile.lastTrained[exerciseId] ?? 0;
        const waitMs = ex.cooldownMs - (Date.now() - last);
        if (waitMs > 0) {
          return { ok: false, message: `Rest ${Math.ceil(waitMs / 1000)}s more.` };
        }
        if (profile.cityBalance < ex.cityCost) {
          return { ok: false, message: "Not enough CITY." };
        }
        patch((p) => {
          let progress = { ...p.progress };
          let stats = { ...p.stats };
          progress[ex.stat] += ex.gain;
          // every 100 progress → +1 stat point (soft cap 100)
          while (progress[ex.stat] >= 100 && stats[ex.stat] < 100) {
            progress[ex.stat] -= 100;
            stats[ex.stat] += 1;
          }
          if (stats[ex.stat] >= 100) progress[ex.stat] = Math.min(progress[ex.stat], 99);
          // heavy bag warms agility a touch
          if (ex.id === "bag" && stats.agility < 100) {
            progress = { ...progress, agility: progress.agility + 3 };
            if (progress.agility >= 100) { progress.agility -= 100; stats.agility += 1; }
          }
          return {
            ...p,
            stats,
            progress,
            cityBalance: p.cityBalance - ex.cityCost,
            lastTrained: { ...p.lastTrained, [exerciseId]: Date.now() },
          };
        });
        return { ok: true, message: `+${ex.gain} ${ex.stat} progress.` };
      },

      renameCompanion: (name) => patch((p) => ({ ...p, companionName: name.slice(0, 18) || "Orbit" })),
      setCompanionColor: (hex) => patch((p) => ({ ...p, companionColor: hex })),
      setCompanionEnabled: (on) => patch((p) => ({ ...p, companionEnabled: on })),
      grantCity: (n) => patch((p) => ({ ...p, cityBalance: Math.max(0, p.cityBalance + n) })),
      reset: () => setProfile(defaultProfile()),
    };
  }, [profile, patch, addReceipt, buyWithBurn]);

  return <CharacterContext.Provider value={value}>{props.children}</CharacterContext.Provider>;
}

export function useCharacter(): CharacterContextValue {
  const ctx = useContext(CharacterContext);
  if (!ctx) throw new Error("useCharacter must be used inside <CharacterProvider>.");
  return ctx;
}

/** Convenience: stat XP progress percent toward the next point. */
export function statProgressPct(profile: CharacterProfile, stat: TrainableStat): number {
  return Math.min(99, Math.round(profile.progress[stat]));
}
