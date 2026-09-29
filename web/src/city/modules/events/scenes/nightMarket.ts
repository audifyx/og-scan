/**
 * OrbitXCity — Events module: night markets.
 *
 * Pop-up stall rows that appear at rotating plaza spots after dark,
 * selling rare cosmetics. Cosmetics are priced in paper CITY (gameplay)
 * or real ORBITX (premium — burned per BILLING_CONTRACT.md). ORBITX items
 * render "auth required" until the integrator injects the tokenomics
 * billing provider; NOTHING is imported from `@/tokenomics/*` here.
 */

import * as THREE from "three";
import type {
  CityEffectHandle,
  EventReward,
  EventsSceneHost,
  EventsWallet,
  OrbitxBillingProvider,
} from "../types";
import { burnPurchase } from "@/tokenomics/burnFlow";

export type MarketCurrency = "CITY" | "ORBITX";

export interface MarketItem {
  id: string;
  label: string;
  description: string;
  price: number;
  currency: MarketCurrency;
  icon: string; // text glyph — no asset deps
  rarity: "rare" | "epic" | "legendary";
  /** Only stocked on certain nights (0=Sunday..6=Saturday). Empty = nightly. */
  nights?: number[];
}

/** The rare-cosmetics catalog. Integrator may extend via setCatalog(). */
export const NIGHT_MARKET_CATALOG: MarketItem[] = [
  { id: "nm-neon-tats", label: "Neon Sleeve Tats", description: "Glowing full-arm ink.", price: 2500, currency: "CITY", icon: "💠", rarity: "rare" },
  { id: "nm-chrome-kicks", label: "Chrome Kicks", description: "Mirror-finish sneakers.", price: 4000, currency: "CITY", icon: "👟", rarity: "rare" },
  { id: "nm-holo-jacket", label: "Holo Bomber", description: "Iridescent bomber jacket.", price: 8000, currency: "CITY", icon: "🧥", rarity: "epic" },
  { id: "nm-ghost-ride-paint", label: "Ghost Paint", description: "Color-shifting car paint.", price: 12000, currency: "CITY", icon: "🚗", rarity: "epic" },
  { id: "nm-plasma-aura", label: "Plasma Aura", description: "Crackling energy aura.", price: 25, currency: "ORBITX", icon: "⚡", rarity: "legendary" },
  { id: "nm-diamond-grill", label: "Diamond Grill", description: "Iced-out smile.", price: 18, currency: "ORBITX", icon: "💎", rarity: "legendary" },
  { id: "nm-orbit-ring", label: "Orbit Ring Halo", description: "A tiny Saturn ring overhead.", price: 40, currency: "ORBITX", icon: "🪐", rarity: "legendary", nights: [5, 6] },
  { id: "nm-midnight-cape", label: "Midnight Cape", description: "Flowing shadow cape.", price: 9000, currency: "CITY", icon: "🦇", rarity: "epic", nights: [1, 3, 5] },
];

export interface NightMarketSpot {
  id: string;
  label: string;
  position: { x: number; z: number };
}

export const NIGHT_MARKET_SPOTS: NightMarketSpot[] = [
  { id: "plaza-bay", label: "Bayview Plaza", position: { x: -60, z: 180 } },
  { id: "plaza-neon", label: "Neon Row", position: { x: 90, z: -40 } },
  { id: "plaza-old", label: "Old Town Square", position: { x: -120, z: -90 } },
];

/** Which spot hosts the market tonight (rotates daily). */
export function tonightSpot(now: number = Date.now()): NightMarketSpot {
  const day = Math.floor(now / 86400000);
  return NIGHT_MARKET_SPOTS[day % NIGHT_MARKET_SPOTS.length];
}

/** Items actually stocked tonight (night-gated items filtered). */
export function tonightStock(now: number = Date.now(), catalog: MarketItem[] = NIGHT_MARKET_CATALOG): MarketItem[] {
  const weekday = new Date(now).getDay();
  return catalog.filter((i) => !i.nights || i.nights.includes(weekday));
}

export interface PurchaseContext {
  wallet: EventsWallet | null;
  billing: OrbitxBillingProvider | null;
  onReward?: (reward: EventReward) => void;
}

/**
 * Buy a night-market item. CITY items debit the paper wallet; ORBITX
 * items burn via the injected billing provider (or report unavailable).
 */
export async function buyMarketItem(
  item: MarketItem,
  ctx: PurchaseContext
): Promise<{ ok: boolean; message: string; reward?: EventReward }> {
  if (item.currency === "CITY") {
    if (!ctx.wallet) return { ok: false, message: "Wallet not ready — try again shortly." };
    const okSpend = ctx.wallet.spend(item.price, `Night market: ${item.label}`, "events:nightmarket");
    if (!okSpend) return { ok: false, message: `Not enough CITY — need ${item.price.toLocaleString()}.` };
    const reward: EventReward = { kind: "cosmetic", itemId: item.id, label: item.label };
    ctx.onReward?.(reward);
    return { ok: true, message: `${item.label} equipped.`, reward };
  }
  // ORBITX premium — burned, per BILLING_CONTRACT.md
  if (!ctx.billing || !ctx.billing.ready) {
    return { ok: false, message: "ORBITX checkout needs wallet auth — connect to burn & claim." };
  }
  try {
    // Canonical buy-and-burn — dry-run safe, normalized reason, shared ledger.
    const res = await burnPurchase(ctx.billing, {
      amount: Math.ceil(item.price),
      itemId: item.id,
      label: item.label,
      reason: `city:events:market:${item.id}`,
      module: "events",
    });
    if (!res.ok) return { ok: false, message: res.message };
    const { signature } = res;
    const reward: EventReward = { kind: "cosmetic", itemId: item.id, label: `${item.label} (burn ${signature.slice(0, 8)}…)` };
    ctx.onReward?.(reward);
    return { ok: true, message: `${item.label} claimed — ${item.price} ORBITX burned.`, reward };
  } catch {
    return { ok: false, message: "Burn failed — nothing was charged." };
  }
}

/* ------------------------------------------------------------------ */
/* Scene: stall row                                                    */
/* ------------------------------------------------------------------ */

export function startNightMarket(
  host: EventsSceneHost,
  spot: NightMarketSpot,
  stock: MarketItem[]
): CityEffectHandle {
  const group = new THREE.Group();
  host.scene.add(group);

  const stallCount = Math.min(6, Math.max(3, Math.ceil(stock.length / 2)));
  const positions: { x: number; z: number }[] = [];
  for (let i = 0; i < stallCount; i++) {
    const angle = (i / stallCount) * Math.PI * 2;
    positions.push({
      x: spot.position.x + Math.cos(angle) * 16,
      z: spot.position.z + Math.sin(angle) * 16,
    });
  }

  const lanternColors = [0xff5d8f, 0x7c3aed, 0x38bdf8, 0xfbbf24, 0x34d399, 0xfb7185];
  const lights: THREE.PointLight[] = [];

  positions.forEach((p, i) => {
    const stall = new THREE.Group();
    // canopy
    const canopy = new THREE.Mesh(
      new THREE.CylinderGeometry(3.2, 3.6, 1.4, 8),
      new THREE.MeshStandardMaterial({ color: 0x8b2f3f, roughness: 0.85 })
    );
    canopy.position.y = 3.4;
    stall.add(canopy);
    // poles
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x4a3220, roughness: 0.9 });
    for (const [px, pz] of [[-2.6, -2.6], [2.6, -2.6], [-2.6, 2.6], [2.6, 2.6]] as const) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 3.2, 8), poleMat);
      pole.position.set(px, 1.6, pz);
      stall.add(pole);
    }
    // counter
    const counter = new THREE.Mesh(
      new THREE.BoxGeometry(4.6, 1.1, 1.6),
      new THREE.MeshStandardMaterial({ color: 0x5b4227, roughness: 0.85 })
    );
    counter.position.y = 0.55;
    stall.add(counter);
    // goods: glowing orbs on the counter (the "rare cosmetics")
    for (let gi = 0; gi < 4; gi++) {
      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 10, 10),
        new THREE.MeshStandardMaterial({
          color: lanternColors[(i + gi) % lanternColors.length],
          emissive: lanternColors[(i + gi) % lanternColors.length],
          emissiveIntensity: 1.2,
        })
      );
      orb.position.set(-1.6 + gi * 1.05, 1.45, 0);
      stall.add(orb);
    }
    // paper lantern string
    const lanternMat = new THREE.MeshBasicMaterial({ color: lanternColors[i % lanternColors.length] });
    for (let li = 0; li < 5; li++) {
      const lan = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 10), lanternMat);
      lan.position.set(-4 + li * 2, 2.9 + Math.sin(li * 1.2) * 0.25, 0);
      stall.add(lan);
    }
    const light = new THREE.PointLight(lanternColors[i % lanternColors.length], 26, 22);
    light.position.y = 3.2;
    stall.add(light);
    lights.push(light);

    stall.position.set(p.x, 0, p.z);
    stall.rotation.y = Math.atan2(spot.position.x - p.x, spot.position.z - p.z);
    group.add(stall);
  });

  // central bonfire-ish light well
  const well = new THREE.PointLight(0xff9f1c, 40, 40);
  well.position.set(spot.position.x, 4, spot.position.z);
  group.add(well);
  host.playSound("market-open", 0.5);

  let elapsed = 0;
  function dispose() {
    host.scene.remove(group);
    group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as THREE.Material | undefined;
      if (mat) mat.dispose();
    });
  }

  return {
    update(dt: number): boolean {
      elapsed += dt;
      // lanterns breathe; integrator ends the market at dawn via host.isNight
      lights.forEach((l, i) => {
        l.intensity = 26 + Math.sin(elapsed * 2.4 + i * 1.7) * 6;
      });
      well.intensity = 40 + Math.sin(elapsed * 3.1) * 8;
      return host.isNight; // market packs up at dawn
    },
    dispose,
  };
}
