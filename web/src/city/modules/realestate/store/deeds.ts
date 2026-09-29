/**
 * Real estate module — deed store (NFT deeds + foot-traffic rent sim).
 *
 * External store (useSyncExternalStore) so every panel shares one deed book
 * without context plumbing. Persisted to localStorage per device.
 *
 * Rent model: `rentPerHour(propertyId, tier)` from the catalog (district
 * base-traffic × tier multiplier × time-of-day foot-traffic curve) accrues
 * into `pendingCity` on `tick()`. Collecting credits paper CITY via the
 * injected ledger. Premium flows (purchase, upgrades) burn real ORBITX
 * through the injected billing adapter.
 */
import { useSyncExternalStore } from "react";
import type {
  CatalogProperty,
  Deed,
  DeedNftMetadata,
  PaperLedger,
  RentState,
} from "../types";
import {
  districtById,
  penthousePropertyFor,
  propertyById,
  rentPerHour,
  tierByLevel,
} from "../data/catalog";
import type { RealEstateBilling } from "../billing";

const STORAGE_KEY = "orbitxcity:realestate-deeds:v1";
const MAX_DEEDS = 100;

interface DeedBook {
  deeds: Deed[];
  rent: Record<string, RentState>;
  /** Synthetic catalog props (won penthouses) not present in PROPERTIES. */
  customProps: Record<string, CatalogProperty>;
}

function load(): DeedBook {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DeedBook;
      if (Array.isArray(parsed.deeds)) {
        return {
          deeds: parsed.deeds.slice(0, MAX_DEEDS),
          rent: parsed.rent && typeof parsed.rent === "object" ? parsed.rent : {},
          customProps: parsed.customProps && typeof parsed.customProps === "object" ? parsed.customProps : {},
        };
      }
    }
  } catch {
    /* corrupted storage — start fresh */
  }
  return { deeds: [], rent: {}, customProps: {} };
}

let state: DeedBook = load();
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

function getSnapshot(): DeedBook {
  return state;
}

/** Resolve the catalog property backing a deed (custom penthouse props first). */
export function propertyForDeed(deed: Deed): CatalogProperty | undefined {
  return state.customProps[deed.propertyId] ?? propertyById(deed.propertyId);
}

/** Current rent rate (paper CITY / hour) for a deed. */
export function deedRentRate(deed: Deed, at: number = Date.now()): number {
  const prop = propertyForDeed(deed);
  if (!prop) return 0;
  return rentPerHour(prop.id, deed.tier, at);
}

/** Accrue rent into every deed's pendingCity up to `now`. */
function tickDeeds(now: number) {
  let changed = false;
  const rent = { ...state.rent };
  for (const deed of state.deeds) {
    const prop = state.customProps[deed.propertyId] ?? propertyById(deed.propertyId);
    if (!prop) continue;
    const prev = rent[deed.deedId] ?? { deedId: deed.deedId, pendingCity: 0, lastTickAt: deed.purchasedAt };
    const hours = Math.max(0, (now - prev.lastTickAt) / 3_600_000);
    if (hours <= 0) continue;
    // Accrue in 5-minute slices so the foot-traffic curve is sampled, not flat.
    const sliceHours = 5 / 60;
    let accrued = 0;
    let cursor = prev.lastTickAt;
    while (cursor < now) {
      const end = Math.min(now, cursor + sliceHours * 3_600_000);
      accrued += rentPerHour(prop.id, deed.tier, cursor) * ((end - cursor) / 3_600_000);
      cursor = end;
    }
    rent[deed.deedId] = {
      deedId: deed.deedId,
      pendingCity: Math.round((prev.pendingCity + accrued) * 100) / 100,
      lastTickAt: now,
    };
    changed = true;
  }
  if (changed) {
    state = { ...state, rent };
    emit();
  }
}

/** Rent accrued but not yet collected for a deed. */
export function pendingRent(deedId: string): number {
  return state.rent[deedId]?.pendingCity ?? 0;
}

/**
 * Marketplace-ready NFT metadata payload for a deed.
 * The actual mint goes through the platform's existing NFT infra
 * (`web/src/lib/orbitx/nftMint.ts` + `/nft/create`) — read-only reuse,
 * never rebuilt here. This function just produces the payload.
 */
export function deedToNftMetadata(deed: Deed): DeedNftMetadata {
  const district = districtById(deed.districtId);
  const tier = tierByLevel(deed.tier);
  return {
    name: `OrbitXCity Deed — ${deed.propertyName}`,
    symbol: "OXDEED",
    description:
      `On-chain deed to ${deed.propertyName} (${district.name}), tier ${deed.tier} — ${tier.label}. ` +
      `Yields foot-traffic rent in paper CITY inside OrbitXCity.`,
    attributes: [
      { trait_type: "Property", value: deed.propertyName },
      { trait_type: "District", value: district.name },
      { trait_type: "Kind", value: deed.kind },
      { trait_type: "Tier", value: deed.tier },
      { trait_type: "Tier label", value: tier.label },
      { trait_type: "Rent multiplier", value: tier.multiplier },
      { trait_type: "Upgrades", value: deed.upgrades.length },
    ],
    externalId: deed.deedId,
  };
}

export const deedStore = {
  get: getSnapshot,
  subscribe,
  tick: tickDeeds,

  /** Buy a property deed — burns real ORBITX, mints the deed record + NFT payload. */
  async buyDeed(propertyId: string, ownerId: string, billing: RealEstateBilling): Promise<Deed> {
    const prop = propertyById(propertyId);
    if (!prop) throw new Error("Unknown property");
    if (state.deeds.some((d) => d.propertyId === propertyId && d.ownerId === ownerId)) {
      throw new Error("You already own this property");
    }
    const { signature } = await billing.buyPremium(`deed:${propertyId}`, `Deed — ${prop.name}`, prop.basePriceOrbitx);
    const now = Date.now();
    const deed: Deed = {
      deedId: crypto.randomUUID(),
      propertyId: prop.id,
      propertyName: prop.name,
      districtId: prop.districtId,
      kind: prop.kind,
      ownerId,
      tier: 0,
      purchasedAt: now,
      purchasePriceOrbitx: prop.basePriceOrbitx,
      purchaseSignature: signature,
      upgrades: [],
      nft: {} as DeedNftMetadata, // filled below (needs the deed first)
    };
    deed.nft = deedToNftMetadata(deed);
    state = {
      ...state,
      deeds: [deed, ...state.deeds].slice(0, MAX_DEEDS),
      rent: { ...state.rent, [deed.deedId]: { deedId: deed.deedId, pendingCity: 0, lastTickAt: now } },
    };
    emit();
    return deed;
  },

  /** Upgrade a deed one tier — burns the tier's ORBITX cost. */
  async upgradeDeed(deedId: string, billing: RealEstateBilling): Promise<Deed> {
    const deed = state.deeds.find((d) => d.deedId === deedId);
    if (!deed) throw new Error("Deed not found");
    if (deed.tier >= 5) throw new Error("Already a landmark");
    const next = tierByLevel(deed.tier + 1);
    const { signature } = await billing.buyPremium(
      `deed:${deed.propertyId}:tier:${next.tier}`,
      `${deed.propertyName} → ${next.label}`,
      next.upgradeCostOrbitx
    );
    const updated: Deed = {
      ...deed,
      tier: next.tier,
      upgrades: [...deed.upgrades, { tier: next.tier, at: Date.now(), signature }],
    };
    updated.nft = deedToNftMetadata(updated);
    state = { ...state, deeds: state.deeds.map((d) => (d.deedId === deedId ? updated : d)) };
    emit();
    return updated;
  },

  /** List the deed on the market (flag only — settlement via the existing `/nft` market). */
  listDeed(deedId: string, priceOrbitx: number) {
    if (!Number.isFinite(priceOrbitx) || priceOrbitx <= 0) throw new Error("Invalid listing price");
    state = {
      ...state,
      deeds: state.deeds.map((d) =>
        d.deedId === deedId ? { ...d, listed: { priceOrbitx: Math.ceil(priceOrbitx), at: Date.now() } } : d
      ),
    };
    emit();
  },

  /**
   * Record the on-chain mint of the deed NFT (called by the integrator once
   * the backend-signed desk-wallet flow mints the Metaplex NFT for the deed,
   * using the payload from `deedToNftMetadata`). The module never mints
   * itself — `web/src/lib/orbitx/nftMint.ts` needs a wallet-adapter wallet
   * (popup), so deed mints go through the no-popup desk-wallet + authCode
   * backend flow instead.
   */
  recordDeedNftMint(deedId: string, mintAddress: string, signature: string) {
    if (!mintAddress.trim()) throw new Error("Mint address is empty");
    state = {
      ...state,
      deeds: state.deeds.map((d) =>
        d.deedId === deedId ? { ...d, mintAddress: mintAddress.trim(), mintSignature: signature } : d
      ),
    };
    emit();
  },

  unlistDeed(deedId: string) {
    state = {
      ...state,
      deeds: state.deeds.map((d) => (d.deedId === deedId ? { ...d, listed: undefined } : d)),
    };
    emit();
  },

  /** Collect accrued rent into the paper ledger. */
  collectRent(deedId: string, ledger: PaperLedger): number {
    tickDeeds(Date.now());
    const pending = state.rent[deedId]?.pendingCity ?? 0;
    if (pending <= 0) throw new Error("Nothing to collect yet");
    const deed = state.deeds.find((d) => d.deedId === deedId);
    if (!deed) throw new Error("Deed not found");
    const amount = Math.floor(pending * 100) / 100;
    ledger.credit(amount, `Rent — ${deed.propertyName}`, "realestate:rent");
    state = {
      ...state,
      rent: { ...state.rent, [deedId]: { deedId, pendingCity: 0, lastTickAt: Date.now() } },
    };
    emit();
    return amount;
  },

  /** Award a penthouse deed to an auction winner (called by the auction store). */
  awardPenthouseDeed(lotId: string, title: string, districtId: string, ownerId: string, priceOrbitx: number, signature: string): Deed {
    const prop = penthousePropertyFor(lotId, title, districtId);
    const now = Date.now();
    const deed: Deed = {
      deedId: crypto.randomUUID(),
      propertyId: prop.id,
      propertyName: title,
      districtId,
      kind: "building",
      ownerId,
      tier: 5,
      purchasedAt: now,
      purchasePriceOrbitx: priceOrbitx,
      purchaseSignature: signature,
      upgrades: [],
      nft: {} as DeedNftMetadata,
    };
    deed.nft = deedToNftMetadata(deed);
    state = {
      ...state,
      customProps: { ...state.customProps, [prop.id]: prop },
      deeds: [deed, ...state.deeds].slice(0, MAX_DEEDS),
      rent: { ...state.rent, [deed.deedId]: { deedId: deed.deedId, pendingCity: 0, lastTickAt: now } },
    };
    emit();
    return deed;
  },
};

export function useDeeds() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
