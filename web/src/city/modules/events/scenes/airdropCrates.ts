/**
 * OrbitXCity — Events module: server-wide airdrop crates.
 *
 * A cargo plane crosses the sky, drops parachuted supply crates at the
 * payload's drop zones, and the whole city scrambles. Crates land, glow,
 * and are claimable by proximity (the integrator's proximity check calls
 * `claimCrate`). Loot rolls paper-CITY tiers with a small chance of a rare
 * cosmetic — real rewards from the injected wallet, never fabricated.
 */

import * as THREE from "three";
import type {
  AirdropPayload,
  CityEffectHandle,
  EventReward,
  EventsSceneHost,
  EventsWallet,
} from "../types";

/* ------------------------------------------------------------------ */
/* Loot table                                                          */
/* ------------------------------------------------------------------ */

export type CrateTier = "common" | "rare" | "epic" | "legendary";

export interface CrateLoot {
  tier: CrateTier;
  city: number; // paper CITY
  cosmeticId: string | null; // rare cosmetic unlock, null when none
  label: string;
}

const TIER_WEIGHTS: [CrateTier, number][] = [
  ["common", 55],
  ["rare", 28],
  ["epic", 12],
  ["legendary", 5],
];

const TIER_CITY: Record<CrateTier, [number, number]> = {
  common: [250, 800],
  rare: [900, 2500],
  epic: [2600, 6000],
  legendary: [7000, 15000],
};

const TIER_COSMETICS: Record<CrateTier, string[]> = {
  common: [],
  rare: ["crate-cap-neon"],
  epic: ["airdrop-jacket", "cargo-chute-backpack"],
  legendary: ["golden-crate-crown", "skyfall-aura"],
};

const TIER_COLORS: Record<CrateTier, number> = {
  common: 0x9aa3b2,
  rare: 0x3b82f6,
  epic: 0xa855f7,
  legendary: 0xf59e0b,
};

/** Deterministic-ish roll from a seed so drops feel authored, not flat. */
export function rollCrateLoot(seed: number, index: number): CrateLoot {
  let s = (seed * 2654435761 + index * 40503) >>> 0;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const roll = rnd() * 100;
  let acc = 0;
  let tier: CrateTier = "common";
  for (const [t, w] of TIER_WEIGHTS) {
    acc += w;
    if (roll <= acc) {
      tier = t;
      break;
    }
  }
  const [lo, hi] = TIER_CITY[tier];
  const city = Math.round(lo + rnd() * (hi - lo));
  const pool = TIER_COSMETICS[tier];
  const cosmeticId =
    pool.length > 0 && rnd() < (tier === "legendary" ? 0.6 : 0.25)
      ? pool[Math.floor(rnd() * pool.length)]
      : null;
  const label =
    tier === "common"
      ? `${city} CITY`
      : `${city} CITY${cosmeticId ? " + rare cosmetic" : ""}`;
  return { tier, city, cosmeticId, label };
}

/* ------------------------------------------------------------------ */
/* Scene                                                               */
/* ------------------------------------------------------------------ */

interface Crate {
  group: THREE.Group;
  loot: CrateLoot;
  state: "falling" | "landed" | "claimed";
  glow: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  vy: number;
  swayPhase: number;
}

export interface AirdropHandle extends CityEffectHandle {
  /** Try to claim the nearest landed crate within radius of a point. */
  claimCrate(near: THREE.Vector3, radius: number): EventReward | null;
  landedCount(): number;
  claimedCount(): number;
}

export function startAirdropRun(
  host: EventsSceneHost,
  payload: AirdropPayload,
  wallet: EventsWallet | null,
  onReward?: (reward: EventReward) => void
): AirdropHandle {
  const group = new THREE.Group();
  host.scene.add(group);

  const span = host.worldHalfSpan;
  const zones = payload.dropZones.length > 0 ? payload.dropZones : [{ x: 0, z: 0 }];
  const crates: Crate[] = [];

  // --- cargo plane (low-poly but smooth-shaded, realistic silhouette) ---
  const plane = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2b3440, roughness: 0.5, metalness: 0.4 });
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.2, 14, 16), bodyMat);
  fuselage.rotation.z = Math.PI / 2;
  plane.add(fuselage);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.25, 11), bodyMat);
  plane.add(wing);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.6, 0.25), bodyMat);
  tail.position.set(-6.4, 1.4, 0);
  plane.add(tail);
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(14.2, 0.3, 3.35),
    new THREE.MeshStandardMaterial({ color: 0x7c3aed, emissive: 0x7c3aed, emissiveIntensity: 0.7 })
  );
  plane.add(stripe);
  // nav lights
  const navL = new THREE.PointLight(0xff3333, 8, 30);
  navL.position.set(0, 0.5, 5.6);
  plane.add(navL);
  const navR = new THREE.PointLight(0x33ff66, 8, 30);
  navR.position.set(0, 0.5, -5.6);
  plane.add(navR);
  plane.position.set(-span * 1.6, 90, 0);
  group.add(plane);

  // --- crates with parachutes ---
  const crateGeo = new THREE.BoxGeometry(2.2, 2.2, 2.2);
  const chuteGeo = new THREE.SphereGeometry(2.6, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2.2);
  const lineGeo = new THREE.BufferGeometry();
  for (let i = 0; i < payload.crateCount; i++) {
    const loot = rollCrateLoot(payload.seed, i);
    const g = new THREE.Group();
    const crateMat = new THREE.MeshStandardMaterial({
      color: 0x6b5636,
      roughness: 0.8,
      metalness: 0.15,
      emissive: TIER_COLORS[loot.tier],
      emissiveIntensity: 0.25,
    });
    const box = new THREE.Mesh(crateGeo, crateMat);
    box.position.y = 1.1;
    g.add(box);
    // crate strapping
    const strap = new THREE.Mesh(
      new THREE.BoxGeometry(2.3, 2.3, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 })
    );
    strap.position.y = 1.1;
    g.add(strap);
    const chute = new THREE.Mesh(
      chuteGeo,
      new THREE.MeshStandardMaterial({
        color: TIER_COLORS[loot.tier],
        roughness: 0.9,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.92,
      })
    );
    chute.position.y = 6.4;
    g.add(chute);
    // shroud lines
    const pts = new Float32Array([
      -1.8, 2.2, -1.8, -2.4, 6.2, -2.4,
      1.8, 2.2, -1.8, 2.4, 6.2, -2.4,
      -1.8, 2.2, 1.8, -2.4, 6.2, 2.4,
      1.8, 2.2, 1.8, 2.4, 6.2, 2.4,
    ]);
    lineGeo.setAttribute("position", new THREE.BufferAttribute(pts.slice(), 3));
    const lines = new THREE.LineSegments(
      lineGeo,
      new THREE.LineBasicMaterial({ color: 0xdddddd })
    );
    g.add(lines);

    // glow beacon visible from anywhere in the city
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(1.1, 12, 12),
      new THREE.MeshBasicMaterial({
        color: TIER_COLORS[loot.tier],
        transparent: true,
        opacity: 0.85,
      })
    );
    glow.position.y = 1.4;
    g.add(glow);
    const beacon = new THREE.PointLight(TIER_COLORS[loot.tier], 30, 60);
    beacon.position.y = 3;
    g.add(beacon);

    const zone = zones[i % zones.length];
    g.position.set(zone.x + (Math.random() - 0.5) * 40, 88, zone.z + (Math.random() - 0.5) * 40);
    g.visible = false; // released as the plane passes overhead
    group.add(g);
    crates.push({ group: g, loot, state: "falling", glow, vy: -14, swayPhase: Math.random() * Math.PI * 2 });
  }

  host.playSound("airdrop-plane", 0.8);
  let planeX = -span * 1.6;
  let released = 0;
  let elapsed = 0;
  const planeSpeed = 55;

  function dispose() {
    host.scene.remove(group);
    group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = (mesh as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else if (mat) mat.dispose();
    });
  }

  const handle: AirdropHandle = {
    update(dt: number): boolean {
      elapsed += dt;
      // fly the plane across
      planeX += planeSpeed * dt;
      plane.position.x = planeX;
      // release crates evenly along the flight path
      const target = Math.min(
        crates.length,
        Math.floor(((planeX + span * 1.6) / (span * 3.2)) * crates.length)
      );
      while (released < target) {
        const c = crates[released];
        c.group.visible = true;
        c.group.position.x = planeX + (Math.random() - 0.5) * 20;
        released++;
      }
      // fall + sway + land
      let anyFalling = false;
      for (const c of crates) {
        if (c.state !== "falling" || !c.group.visible) continue;
        anyFalling = true;
        c.group.position.y += c.vy * dt;
        c.vy = Math.max(-9, c.vy + 6 * dt); // parachute terminal velocity
        c.swayPhase += dt * 1.6;
        c.group.position.x += Math.sin(c.swayPhase) * dt * 3;
        c.group.rotation.y += dt * 0.6;
        if (c.group.position.y <= 0) {
          c.group.position.y = 0;
          c.state = "landed";
          c.group.children.forEach((ch) => {
            if ((ch as THREE.Mesh).geometry === chuteGeo) ch.visible = false; // collapse chute
          });
          host.playSound("crate-land", 0.5);
          host.shakeCamera(0.25, 300);
        }
      }
      // pulse landed-crate beacons
      const t = elapsed * 3;
      for (const c of crates) {
        if (c.state === "landed") {
          (c.glow.material as THREE.MeshBasicMaterial).opacity = 0.55 + 0.35 * Math.sin(t);
          c.group.rotation.y += dt * 0.25;
        }
      }
      // finished when plane left + all crates landed/claimed
      const done = planeX > span * 1.8 && !anyFalling;
      return !done;
    },
    dispose,
    claimCrate(near: THREE.Vector3, radius: number): EventReward | null {
      let best: Crate | null = null;
      let bestD = radius;
      const tmp = new THREE.Vector3();
      for (const c of crates) {
        if (c.state !== "landed") continue;
        const d = tmp.copy(c.group.position).distanceTo(near);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      if (!best) return null;
      best.state = "claimed";
      best.group.visible = false;
      host.playSound("crate-open", 0.7);
      const loot = best.loot;
      let balance: number | null = null;
      if (wallet) balance = wallet.earn(loot.city, `Airdrop crate (${loot.tier})`, "events:airdrop");
      const reward: EventReward = {
        kind: "city",
        amount: loot.city,
        itemId: loot.cosmeticId ?? undefined,
        label:
          loot.cosmeticId != null
            ? `${loot.city} CITY + ${loot.cosmeticId}`
            : `${loot.city} CITY${balance != null ? ` (balance ${balance})` : ""}`,
      };
      if (onReward) onReward(reward);
      return reward;
    },
    landedCount: () => crates.filter((c) => c.state === "landed").length,
    claimedCount: () => crates.filter((c) => c.state === "claimed").length,
  };
  return handle;
}
