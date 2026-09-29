/**
 * OrbitXCity — Events module: dock black market.
 *
 * Nights only. A shadowy container-yard market at the docks sells rare
 * gadgets — gameplay tools with real in-world effects (the integrator
 * applies the effect; this module defines the catalog, the access rules,
 * and the scene). Access requires the night's rotating code word, learned
 * from the fixer NPC (integrator-owned dialogue). No code = no entry.
 *
 * Purchases are paper-CITY (gameplay) or ORBITX premium (burned, per
 * BILLING_CONTRACT.md) — same defensive provider pattern as the night
 * market, no `@/tokenomics/*` imports.
 */

import * as THREE from "three";
import type {
  CityEffectHandle,
  EventsSceneHost,
} from "../types";
import { buyMarketItem, type MarketItem, type PurchaseContext } from "./nightMarket";

export const BLACK_MARKET_CATALOG: MarketItem[] = [
  {
    id: "bm-emp-jammer",
    label: "EMP Jammer",
    description: "Kills traffic AI in a 40m radius for 60s.",
    price: 15000,
    currency: "CITY",
    icon: "📡",
    rarity: "epic",
  },
  {
    id: "bm-grapple",
    label: "Grapple Line",
    description: "Zip to any rooftop in sight.",
    price: 20000,
    currency: "CITY",
    icon: "🪝",
    rarity: "epic",
  },
  {
    id: "bm-thermal",
    label: "Thermal Optics",
    description: "See NPCs and crates through walls for 5 min.",
    price: 12000,
    currency: "CITY",
    icon: "🥽",
    rarity: "rare",
  },
  {
    id: "bm-decoy-wallet",
    label: "Decoy Wallet",
    description: "Muggers rob this instead of you. One use.",
    price: 8000,
    currency: "CITY",
    icon: "👛",
    rarity: "rare",
  },
  {
    id: "bm-silent-engine",
    label: "Silent Engine",
    description: "Your car makes zero noise for 10 min.",
    price: 30,
    currency: "ORBITX",
    icon: "🔇",
    rarity: "legendary",
  },
  {
    id: "bm-ghost-plate",
    label: "Ghost Plates",
    description: "Cops can't ID your vehicle for 24h.",
    price: 22,
    currency: "ORBITX",
    icon: "👻",
    rarity: "legendary",
  },
];

/** Dock position for the black market (integrator may override). */
export const BLACK_MARKET_DOCK = { x: 210, z: 330, label: "Pier 9 Container Yard" };

const CODE_WORDS = [
  "moonbag",
  "paperhands",
  "rugpull",
  "diamond",
  "ser",
  "wagmi",
  "ngmi",
  "hodl",
  "aped",
  "rekt",
];

/** Tonight's access code (rotates daily). The fixer NPC gives this out. */
export function tonightCode(now: number = Date.now()): string {
  const day = Math.floor(now / 86400000);
  return CODE_WORDS[day % CODE_WORDS.length];
}

export function checkCode(input: string, now: number = Date.now()): boolean {
  return input.trim().toLowerCase() === tonightCode(now);
}

/** The market only exists at night. */
export function isBlackMarketOpen(isNight: boolean): boolean {
  return isNight;
}

export async function buyBlackMarketItem(item: MarketItem, ctx: PurchaseContext) {
  return buyMarketItem(item, ctx);
}

/* ------------------------------------------------------------------ */
/* Scene: container yard at the docks                                  */
/* ------------------------------------------------------------------ */

export function startBlackMarket(host: EventsSceneHost): CityEffectHandle {
  const group = new THREE.Group();
  host.scene.add(group);
  const { x: dx, z: dz } = BLACK_MARKET_DOCK;

  // container stacks
  const containerColors = [0x7a2d2d, 0x2d5a7a, 0x4a7a2d, 0x6b5a2d, 0x3d3d5c];
  const boxGeo = new THREE.BoxGeometry(8, 3, 3.2);
  const spots: [number, number, number][] = [
    [-14, 0, -8, 0.2],
    [-14, 3.1, -8, 0.2],
    [14, 0, -10, -0.15],
    [0, 0, -16, 0.05],
    [8, 3.1, -16, 0.05],
    [-6, 0, 10, 1.35],
    [18, 0, 8, 1.5],
  ] as unknown as [number, number, number][];
  spots.forEach(([cx, cy, cz], i) => {
    const mat = new THREE.MeshStandardMaterial({
      color: containerColors[i % containerColors.length],
      roughness: 0.75,
      metalness: 0.25,
    });
    const c = new THREE.Mesh(boxGeo, mat);
    c.position.set(dx + cx, cy + 1.5, dz + cz);
    c.rotation.y = [0.2, 0.2, -0.15, 0.05, 0.05, 1.35, 1.5][i] ?? 0;
    group.add(c);
  });

  // dealer table with red lamp
  const table = new THREE.Mesh(
    new THREE.BoxGeometry(3, 1, 1.4),
    new THREE.MeshStandardMaterial({ color: 0x2a1f16, roughness: 0.9 })
  );
  table.position.set(dx, 0.5, dz);
  group.add(table);
  const lamp = new THREE.PointLight(0xff2222, 30, 25);
  lamp.position.set(dx, 3.4, dz);
  group.add(lamp);
  const shade = new THREE.Mesh(
    new THREE.ConeGeometry(0.8, 0.7, 10, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x881111, side: THREE.DoubleSide })
  );
  shade.position.set(dx, 3.2, dz);
  group.add(shade);

  // gadget crates with cyan glow
  for (let i = 0; i < 5; i++) {
    const crate = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 1.4, 1.4),
      new THREE.MeshStandardMaterial({
        color: 0x1a1a22,
        emissive: 0x22d3ee,
        emissiveIntensity: 0.5,
        roughness: 0.6,
      })
    );
    const a = (i / 5) * Math.PI * 2;
    crate.position.set(dx + Math.cos(a) * 5.5, 0.7, dz + Math.sin(a) * 5.5);
    crate.rotation.y = a;
    group.add(crate);
  }

  // hooded dealer figure
  const dealer = new THREE.Group();
  const cloak = new THREE.MeshStandardMaterial({ color: 0x0d0d12, roughness: 0.95 });
  const dBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.75, 4, 10), cloak);
  dBody.position.y = 1.15;
  dealer.add(dBody);
  const dHead = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 10), cloak);
  dHead.position.y = 1.95;
  dealer.add(dHead);
  const eyes = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0x22d3ee })
  );
  eyes.position.set(0, 1.98, 0.2);
  dealer.add(eyes);
  dealer.position.set(dx, 0, dz - 1.8);
  dealer.rotation.y = Math.PI;
  group.add(dealer);

  host.playSound("market-open", 0.4);

  let elapsed = 0;
  function dispose() {
    host.scene.remove(group);
    group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry && mesh.geometry !== boxGeo) mesh.geometry.dispose();
      const mat = mesh.material as THREE.Material | undefined;
      if (mat) mat.dispose();
    });
    boxGeo.dispose();
  }

  return {
    update(dt: number): boolean {
      elapsed += dt;
      // lamp flicker — shady vibes
      lamp.intensity = 30 + Math.sin(elapsed * 13) * 3 + (Math.random() < 0.02 ? -14 : 0);
      dealer.rotation.y = Math.PI + Math.sin(elapsed * 0.7) * 0.15;
      // market vanishes at dawn
      return host.isNight;
    },
    dispose,
  };
}
