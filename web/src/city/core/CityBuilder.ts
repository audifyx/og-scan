import * as THREE from "three";
import {
  roadTexture, sidewalkTexture, crosswalkTexture, grassTexture,
  cloudTexture, billboardFace, type BillboardFace,
} from "./textures";
import { loadAsset } from "./assetLoader";
import { buildOrbitXTower, buildOrbitXShop, buildOrbitXApartment, type BrandedBuilding } from "./OrbitXBuildings";
import { buildKOLCharacter, buildNeonCar, buildAdBillboard, KOLS } from "./OrbitXProps";
import { pickBuilding, BUILDINGS, CARS, type AssetEntry } from "./assetManifest";

export const BLOCKS = 5;          // blocks per side
export const BLOCK = 64;          // block size (m)
export const ROAD_W = 14;         // road width (m)
export const SIDEWALK_W = 5;
export const PITCH = BLOCK + ROAD_W;
export const CITY_SPAN = BLOCKS * PITCH + ROAD_W; // full extent incl. outer roads
export const HALF = CITY_SPAN / 2;

export interface Collider { minX: number; maxX: number; minZ: number; maxZ: number }
export interface RoadNode { x: number; z: number }
export interface ParkedCar { x: number; z: number; heading: number }
export interface Billboard { face: BillboardFace; mesh: THREE.Mesh }

export interface CityData {
  group: THREE.Group;
  colliders: Collider[];
  /** Intersection nodes indexed [i][j] for i,j in 0..BLOCKS */
  nodes: RoadNode[][];
  billboards: Billboard[];
  lampMats: THREE.MeshStandardMaterial[];
  windowMats: THREE.MeshStandardMaterial[];
  parked: ParkedCar[];
  spawn: { x: number; z: number; heading: number };
  /** Building lots awaiting GLB hydration (filled by buildCity, consumed by hydrateBuildings) */
  slots: BuildingSlot[];
  /** per-frame animation callbacks for branded buildings */
  tickers: ((t: number) => void)[];
}

/** A lot reserved for a GLB building model. */
export interface BuildingSlot {
  cx: number; cz: number;
  lotW: number; lotD: number;
  downtown: boolean;   // center blocks → skyscrapers
  wantShop: boolean;   // street-level retail
}

function streetCoord(i: number): number {
  return -HALF + ROAD_W / 2 + i * PITCH;
}

// shared materials / geometries (module-level, reused across meshes)
const MAT = {
  curb: new THREE.MeshStandardMaterial({ color: 0xd9d5cb, roughness: 0.9 }),
  pole: new THREE.MeshStandardMaterial({ color: 0x707880, roughness: 0.5, metalness: 0.6 }),
  benchWood: new THREE.MeshStandardMaterial({ color: 0x9a6b3f, roughness: 0.8 }),
  benchIron: new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 0.6, metalness: 0.4 }),
  hydrant: new THREE.MeshStandardMaterial({ color: 0xc23b2e, roughness: 0.55 }),
  hydrantCap: new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: 0.5 }),
  busRoof: new THREE.MeshStandardMaterial({ color: 0x2e6f8e, roughness: 0.6 }),
  busGlass: new THREE.MeshStandardMaterial({ color: 0xbcd8ee, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.5 }),
  acUnit: new THREE.MeshStandardMaterial({ color: 0xb9bdc2, roughness: 0.7, metalness: 0.3 }),
  waterTank: new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.9 }),
  parapet: new THREE.MeshStandardMaterial({ color: 0xcac5b8, roughness: 0.95 }),
  trunk: new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 1 }),
  white: new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.8 }),
};

const TREE_GREENS = [0x3e8e3a, 0x4da34a, 0x5cb85a, 0x2f7a32, 0x6faf4e];

export function buildCity(): CityData {
  const group = new THREE.Group();
  const colliders: Collider[] = [];
  const lampMats: THREE.MeshStandardMaterial[] = [];
  const windowMats: THREE.MeshStandardMaterial[] = [];
  const billboards: Billboard[] = [];
  const parked: ParkedCar[] = [];
  const treeSpots: { x: number; z: number }[] = [];

  // --- ground: distant terrain (sage green) + city base (warm light gray) ---
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1400, 1400),
    new THREE.MeshStandardMaterial({ color: 0x8fa383, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  group.add(ground);

  const cityBase = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_SPAN + 60, CITY_SPAN + 60),
    new THREE.MeshStandardMaterial({ color: 0xb3aca0, roughness: 1 }),
  );
  cityBase.rotation.x = -Math.PI / 2;
  cityBase.position.y = 0;
  cityBase.receiveShadow = true;
  group.add(cityBase);

  // --- roads (strips) + curbs ---
  const roadTex = roadTexture();
  const roadLen = CITY_SPAN;
  const curbGeoH = new THREE.BoxGeometry(roadLen, 0.16, 0.35);
  const curbGeoV = new THREE.BoxGeometry(0.35, 0.16, roadLen);
  for (let i = 0; i <= BLOCKS; i++) {
    const c = streetCoord(i);
    for (const horizontal of [true, false]) {
      const tex = roadTex.clone();
      tex.needsUpdate = true;
      tex.repeat.set(1, roadLen / 14);
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 });
      const geo = new THREE.PlaneGeometry(horizontal ? roadLen : ROAD_W, horizontal ? ROAD_W : roadLen);
      const m = new THREE.Mesh(geo, mat);
      m.rotation.x = -Math.PI / 2;
      if (horizontal) { m.position.set(0, 0.02, c); m.rotation.z = Math.PI / 2; }
      else m.position.set(c, 0.015, 0);
      m.receiveShadow = true;
      group.add(m);
      // curbs both sides
      for (const side of [-1, 1]) {
        const off = side * (ROAD_W / 2 + 0.17);
        const curb = new THREE.Mesh(horizontal ? curbGeoH : curbGeoV, MAT.curb);
        if (horizontal) curb.position.set(0, 0.08, c + off);
        else curb.position.set(c + off, 0.08, 0);
        curb.receiveShadow = true;
        group.add(curb);
      }
    }
    // --- sidewalks both sides of each street ---
    const swTex = sidewalkTexture();
    for (const horizontal of [true, false]) {
      for (const side of [-1, 1]) {
        const tex = swTex.clone();
        tex.needsUpdate = true;
        tex.repeat.set(roadLen / 8, 1);
        const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 1 });
        const m = new THREE.Mesh(
          new THREE.PlaneGeometry(horizontal ? roadLen : SIDEWALK_W, horizontal ? SIDEWALK_W : roadLen),
          mat,
        );
        m.rotation.x = -Math.PI / 2;
        const off = side * (ROAD_W / 2 + SIDEWALK_W / 2);
        if (horizontal) m.position.set(0, 0.03, c + off);
        else m.position.set(c + off, 0.03, 0);
        m.receiveShadow = true;
        group.add(m);
      }
    }
    // --- street trees along this street (both sides, skipping intersections) ---
    for (const horizontal of [true, false]) {
      for (const side of [-1, 1]) {
        const tOff = side * (ROAD_W / 2 + SIDEWALK_W + 1.6);
        for (let d = -HALF + 18; d < HALF - 12; d += 27) {
          let nearX = false;
          for (let j = 0; j <= BLOCKS; j++) {
            if (Math.abs(d - streetCoord(j)) < 13) { nearX = true; break; }
          }
          if (nearX) continue;
          const tx = horizontal ? d : streetCoord(i) + tOff;
          const tz = horizontal ? streetCoord(i) + tOff : d;
          treeSpots.push({ x: tx, z: tz });
          colliders.push({ minX: tx - 0.5, maxX: tx + 0.5, minZ: tz - 0.5, maxZ: tz + 0.5 });
        }
      }
    }
  }

  // --- intersection nodes for traffic graph ---
  const nodes: RoadNode[][] = [];
  for (let i = 0; i <= BLOCKS; i++) {
    nodes[i] = [];
    for (let j = 0; j <= BLOCKS; j++) {
      nodes[i][j] = { x: streetCoord(i), z: streetCoord(j) };
    }
  }

  // --- crosswalks at every intersection ---
  {
    const cwTex = crosswalkTexture();
    const cwTexR = cwTex.clone();
    cwTexR.needsUpdate = true;
    cwTexR.center.set(0.5, 0.5);
    cwTexR.rotation = Math.PI / 2;
    const matH = new THREE.MeshStandardMaterial({ map: cwTex, roughness: 0.95 });
    const matV = new THREE.MeshStandardMaterial({ map: cwTexR, roughness: 0.95 });
    const geoH = new THREE.PlaneGeometry(4, ROAD_W);   // crosses horizontal roads
    const geoV = new THREE.PlaneGeometry(ROAD_W, 4);   // crosses vertical roads
    for (let i = 0; i <= BLOCKS; i++) {
      for (let j = 0; j <= BLOCKS; j++) {
        const sx = streetCoord(i), sz = streetCoord(j);
        for (const s of [-1, 1]) {
          const a = new THREE.Mesh(geoH, matH);
          a.rotation.x = -Math.PI / 2;
          a.position.set(sx + s * (ROAD_W / 2 + 2.6), 0.035, sz);
          group.add(a);
          const b = new THREE.Mesh(geoV, matV);
          b.rotation.x = -Math.PI / 2;
          b.position.set(sx, 0.035, sz + s * (ROAD_W / 2 + 2.6));
          group.add(b);
        }
      }
    }
  }

  // --- building lots per block (slots for GLB hydration; see hydrateBuildings) ---
  const slots: BuildingSlot[] = [];
  const tickers: ((t: number) => void)[] = [];

  for (let bi = 0; bi < BLOCKS; bi++) {
    for (let bj = 0; bj < BLOCKS; bj++) {
      const bx0 = streetCoord(bi) + ROAD_W / 2 + SIDEWALK_W;
      const bz0 = streetCoord(bj) + ROAD_W / 2 + SIDEWALK_W;
      const bx1 = streetCoord(bi + 1) - ROAD_W / 2 - SIDEWALK_W;
      const bz1 = streetCoord(bj + 1) - ROAD_W / 2 - SIDEWALK_W;
      // 2x2 lots
      for (let lx = 0; lx < 2; lx++) {
        for (let lz = 0; lz < 2; lz++) {
          const lotX0 = bx0 + ((bx1 - bx0) / 2) * lx + 3;
          const lotX1 = bx0 + ((bx1 - bx0) / 2) * (lx + 1) - 3;
          const lotZ0 = bz0 + ((bz1 - bz0) / 2) * lz + 3;
          const lotZ1 = bz0 + ((bz1 - bz0) / 2) * (lz + 1) - 3;
          const cx = (lotX0 + lotX1) / 2;
          const cz = (lotZ0 + lotZ1) / 2;
          const roll = Math.random();
          if (roll < 0.16) {
            addPark(group, colliders, treeSpots, cx, cz, lotX1 - lotX0, lotZ1 - lotZ0);
          } else if (roll < 0.3) {
            addParkingLot(group, parked, cx, cz, lotX1 - lotX0, lotZ1 - lotZ0);
          } else {
            const distC = Math.hypot(bi - (BLOCKS - 1) / 2, bj - (BLOCKS - 1) / 2);
            slots.push({
              cx, cz,
              lotW: lotX1 - lotX0, lotD: lotZ1 - lotZ0,
              downtown: distC < 1.6,
              wantShop: !slots.length || Math.random() < 0.22,
            });
          }
        }
      }
    }
  }

  // --- instanced street + park trees (2 draw calls for all trees) ---
  {
    const trunkGeo = new THREE.CylinderGeometry(0.28, 0.45, 3.4, 7);
    const leafGeo = new THREE.IcosahedronGeometry(2.7, 1);
    const leafMat = new THREE.MeshStandardMaterial({ roughness: 1 });
    const trunks = new THREE.InstancedMesh(trunkGeo, MAT.trunk, treeSpots.length);
    const leaves = new THREE.InstancedMesh(leafGeo, leafMat, treeSpots.length);
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    treeSpots.forEach((t, i) => {
      const s = 0.85 + Math.random() * 0.5;
      dummy.position.set(t.x, 1.7 * s, t.z);
      dummy.scale.setScalar(s);
      dummy.rotation.y = Math.random() * Math.PI * 2;
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);
      dummy.position.set(t.x, (3.4 + 1.6) * s, t.z);
      dummy.updateMatrix();
      leaves.setMatrixAt(i, dummy.matrix);
      col.setHex(TREE_GREENS[i % TREE_GREENS.length]).offsetHSL(0, 0, (Math.random() - 0.5) * 0.06);
      leaves.setColorAt(i, col);
    });
    trunks.castShadow = leaves.castShadow = true;
    trunks.instanceMatrix.needsUpdate = leaves.instanceMatrix.needsUpdate = true;
    if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
    group.add(trunks, leaves);
  }

  // --- streetlights (galvanized poles, lamps off in daytime) ---
  for (let i = 0; i <= BLOCKS; i++) {
    for (let d = -HALF + 20; d < HALF - 10; d += 42) {
      for (const horizontal of [true, false]) {
        const c = streetCoord(i);
        const lampMat = new THREE.MeshStandardMaterial({
          color: 0xf8f8f8, emissive: 0xffd9a0, emissiveIntensity: 0, roughness: 0.4,
        });
        lampMats.push(lampMat);
        const g = new THREE.Group();
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 8, 8), MAT.pole);
        pole.position.y = 4;
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 3.2), MAT.pole);
        arm.position.set(0, 7.8, 1.4);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), lampMat);
        lamp.position.set(0, 7.6, 2.8);
        g.add(pole, arm, lamp);
        if (horizontal) g.position.set(d, 0, c + ROAD_W / 2 + 1);
        else { g.position.set(c + ROAD_W / 2 + 1, 0, d); g.rotation.y = Math.PI / 2; }
        group.add(g);
      }
    }
  }

  // --- street props: benches, hydrants, bus stops ---
  addProps(group, colliders);

  // --- billboards (live market data faces) ---
  const bbSpots: { x: number; z: number; ry: number }[] = [
    { x: streetCoord(2), z: streetCoord(1) - ROAD_W, ry: 0 },
    { x: streetCoord(4) + ROAD_W, z: streetCoord(3), ry: -Math.PI / 2 },
    { x: streetCoord(1) - ROAD_W, z: streetCoord(4), ry: Math.PI / 2 },
  ];
  for (const s of bbSpots) {
    const face = billboardFace();
    const frame = new THREE.Group();
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(13, 7, 0.6),
      new THREE.MeshStandardMaterial({ map: face.texture, emissive: 0xffffff, emissiveMap: face.texture, emissiveIntensity: 0.55 }),
    );
    panel.position.y = 11;
    panel.userData.isBuilding = true; // token-scanner raycast target (gadgets module)
    const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 11, 8), MAT.pole);
    p1.position.set(-4, 5.5, 0);
    const p2 = p1.clone();
    p2.position.x = 4;
    frame.add(panel, p1, p2);
    frame.position.set(s.x, 0, s.z);
    frame.rotation.y = s.ry;
    group.add(frame);
    billboards.push({ face, mesh: panel });
    colliders.push({ minX: s.x - 7, maxX: s.x + 7, minZ: s.z - 1, maxZ: s.z + 1 });
  }

  // --- clouds (static daytime puffs) ---
  {
    const ct = cloudTexture();
    for (let i = 0; i < 12; i++) {
      const sm = new THREE.SpriteMaterial({ map: ct, transparent: true, opacity: 0.85, depthWrite: false, fog: false });
      const sp = new THREE.Sprite(sm);
      const sc = 120 + Math.random() * 110;
      sp.scale.set(sc, sc * 0.5, 1);
      sp.position.set((Math.random() - 0.5) * 1200, 170 + Math.random() * 90, (Math.random() - 0.5) * 1200);
      group.add(sp);
    }
  }

  const spawn = { x: streetCoord(2) + ROAD_W / 2 + SIDEWALK_W / 2, z: streetCoord(2), heading: Math.PI };
  return { group, colliders, nodes, billboards, lampMats, windowMats, parked, spawn, slots };
}

/**
 * Async GLB hydration: loads real 3D building models for each reserved slot.
 * - Skyscrapers in the downtown core, shops at street level, mid-rise elsewhere
 * - Varies rotation (0/90/180/270) and scale (0.9–1.1); avoids repeating the same
 *   model on adjacent lots
 * - Colliders use the model's manifest footprint (rotation-aware)
 * - Falls back to procedural boxes via assetLoader if a GLB fails
 */
export async function hydrateBuildings(city: CityData): Promise<{ buildings: number; glbCars: number }> {
  const ROTS = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
  let placed = 0;
  let lastPath = "";

  // ── OrbitX branded landmark buildings ──
  // Signature tower at the downtown core (most central slot)
  const downtownSlots = city.slots.filter(s => s.downtown);
  if (downtownSlots.length > 0) {
    // Pick the slot closest to city center (0,0)
    downtownSlots.sort((a, b) =>
      (a.cx * a.cx + a.cz * a.cz) - (b.cx * b.cx + b.cz * b.cz));
    const towerSlot = downtownSlots[0];
    const tower = buildOrbitXTower("#00f0ff", 48);
    tower.group.position.set(towerSlot.cx, 0, towerSlot.cz);
    tower.group.traverse(o => { o.userData.isBuilding = true; o.userData.isLandmark = true; });
    city.group.add(tower.group);
    city.tickers.push(tower.tick);
    const [tw, td] = tower.footprint;
    city.colliders.push({
      minX: towerSlot.cx - tw / 2, maxX: towerSlot.cx + tw / 2,
      minZ: towerSlot.cz - td / 2, maxZ: towerSlot.cz + td / 2,
    });
    placed++;
    // Remove this slot from the GLB pool so we don't double-place
    city.slots.splice(city.slots.indexOf(towerSlot), 1);

    // Branded shops near the tower (street-level retail)
    const shopColors = ["#ff00ff", "#00f0ff", "#a855f7"];
    let shopsPlaced = 0;
    for (const s of city.slots) {
      if (shopsPlaced >= 3) break;
      if (s.wantShop && !s.downtown) {
        const shop = buildOrbitXShop(shopColors[shopsPlaced % shopColors.length]);
        shop.group.position.set(s.cx, 0, s.cz);
        shop.group.rotation.y = ROTS[Math.floor(Math.random() * ROTS.length)];
        shop.group.traverse(o => { o.userData.isBuilding = true; });
        city.group.add(shop.group);
        city.tickers.push(shop.tick);
        const [sw, sd] = shop.footprint;
        city.colliders.push({
          minX: s.cx - sw / 2, maxX: s.cx + sw / 2,
          minZ: s.cz - sd / 2, maxZ: s.cz + sd / 2,
        });
        placed++;
        shopsPlaced++;
        city.slots.splice(city.slots.indexOf(s), 1);
      }
    }

    // Apartment blocks in outer areas
    let aptsPlaced = 0;
    for (const s of [...city.slots]) {
      if (aptsPlaced >= 2) break;
      if (!s.downtown && !s.wantShop) {
        const apt = buildOrbitXApartment(6 + Math.floor(Math.random() * 3), "#a855f7");
        apt.group.position.set(s.cx, 0, s.cz);
        apt.group.traverse(o => { o.userData.isBuilding = true; });
        city.group.add(apt.group);
        city.tickers.push(apt.tick);
        const [aw, ad] = apt.footprint;
        city.colliders.push({
          minX: s.cx - aw / 2, maxX: s.cx + aw / 2,
          minZ: s.cz - ad / 2, maxZ: s.cz + ad / 2,
        });
        placed++;
        aptsPlaced++;
        city.slots.splice(city.slots.indexOf(s), 1);
      }
    }
  }

  // Pre-pick all models first (fast, sync) so we can dedupe adjacents
  const picks: { slot: BuildingSlot; entry: AssetEntry }[] = [];
  for (const slot of city.slots) {
    let entry = pickBuilding(slot.lotW, slot.lotD, slot.downtown);
    // shops: prefer shop models for street-level retail lots
    if (slot.wantShop && !slot.downtown) {
      const shops = BUILDINGS.filter(b => b.kind === "shop"
        && b.footprint[0] <= slot.lotW && b.footprint[1] <= slot.lotD);
      if (shops.length) entry = shops[Math.floor(Math.random() * shops.length)];
    }
    // avoid same model twice in a row (adjacent lots are sequential)
    if (entry.path === lastPath) {
      const alt = pickBuilding(slot.lotW, slot.lotD, slot.downtown);
      if (alt.path !== lastPath) entry = alt;
    }
    lastPath = entry.path;
    picks.push({ slot, entry });
  }

  // Load + place (sequential to keep memory spikes low on mobile)
  for (const { slot, entry } of picks) {
    try {
      const model = await loadAsset(entry);
      const rot = ROTS[Math.floor(Math.random() * ROTS.length)];
      const s = 0.9 + Math.random() * 0.2;
      model.rotation.y = rot;
      model.scale.setScalar(s);
      model.position.set(slot.cx, 0, slot.cz);
      // token-scanner raycast target (matches old procedural behavior)
      model.traverse(o => { o.userData.isBuilding = true; });
      city.group.add(model);

      // collider from manifest footprint (swap dims on 90° rotations)
      const swap = Math.abs(Math.sin(rot)) > 0.5;
      const fw = (swap ? entry.footprint[1] : entry.footprint[0]) * s;
      const fd = (swap ? entry.footprint[0] : entry.footprint[1]) * s;
      city.colliders.push({
        minX: slot.cx - fw / 2, maxX: slot.cx + fw / 2,
        minZ: slot.cz - fd / 2, maxZ: slot.cz + fd / 2,
      });
      placed++;
    } catch {
      // loadAsset already falls back to procedural; this is a last-resort guard
    }
  }

  // GLB parked cars in parking lots (static decoration; drivables stay procedural)
  let glbCars = 0;
  const carPicks = CARS.slice(0, 8);
  for (const p of city.parked) {
    if (Math.random() < 0.5) continue; // only decorate ~half the spots
    try {
      const entry = carPicks[Math.floor(Math.random() * carPicks.length)];
      const car = await loadAsset(entry);
      car.rotation.y = p.heading;
      car.position.set(p.x, 0, p.z);
      city.group.add(car);
      glbCars++;
      if (glbCars >= 15) break; // cap for mobile
    } catch { /* skip */ }
  }

  // ── KOL character NPCs (plaza gathering near downtown) ──
  // Find a park or open area near center for the KOL plaza
  const kolSpots: { x: number; z: number }[] = [];
  const plazaCx = 0, plazaCz = 0;
  KOLS.forEach((def, i) => {
    const angle = (i / KOLS.length) * Math.PI * 2;
    const r = 8 + (i % 3) * 4;
    kolSpots.push({
      x: plazaCx + Math.cos(angle) * r,
      z: plazaCz + Math.sin(angle) * r,
    });
  });
  for (let i = 0; i < KOLS.length && i < kolSpots.length; i++) {
    const npc = buildKOLCharacter(KOLS[i]);
    npc.group.position.set(kolSpots[i].x, 0, kolSpots[i].z);
    // Face center
    npc.group.rotation.y = Math.atan2(plazaCx - kolSpots[i].x, plazaCz - kolSpots[i].z);
    city.group.add(npc.group);
    city.tickers.push(npc.tick);
  }

  // ── Ad billboards (OrbitX branded, at key intersections) ──
  const billboardAds = [
    "ORBITX CITY\nTRADE \u2022 LAUNCH \u2022 LIVE",
    "BURN $ORBITX\nEVERY PURCHASE",
    "KOL ZONE\nANSEM \u2022 CUPSEY \u2022 ORANGIE",
    "OWN THE CITY\nBUY BUILDINGS ON-CHAIN",
  ];
  const bbPositions = [
    { x: -40, z: 0, ry: Math.PI / 2 },
    { x: 40, z: 0, ry: -Math.PI / 2 },
    { x: 0, z: 40, ry: Math.PI },
    { x: 0, z: -40, ry: 0 },
  ];
  for (let i = 0; i < billboardAds.length; i++) {
    const bb = buildAdBillboard(billboardAds[i], "#00f0ff");
    bb.group.position.set(bbPositions[i].x, 0, bbPositions[i].z);
    bb.group.rotation.y = bbPositions[i].ry;
    city.group.add(bb.group);
    city.tickers.push(bb.tick);
  }

  // ── Neon cars (parked decoration) ──
  const neonColors: [string, string][] = [
    ["#ff00ff", "#00f0ff"],
    ["#00f0ff", "#ff00ff"],
    ["#f97316", "#ffffff"],
  ];
  for (let i = 0; i < 3 && i < city.parked.length; i++) {
    const p = city.parked[i * 2];
    if (!p) continue;
    const [color, accent] = neonColors[i % neonColors.length];
    const car = buildNeonCar(color, accent);
    car.position.set(p.x, 0, p.z);
    car.rotation.y = p.heading;
    city.group.add(car);
  }

  return { buildings: placed, glbCars };
}

function addPark(
  group: THREE.Group, colliders: Collider[], treeSpots: { x: number; z: number }[],
  cx: number, cz: number, w: number, d: number,
) {
  const gtex = grassTexture();
  gtex.repeat.set(Math.max(1, Math.round(w / 9)), Math.max(1, Math.round(d / 9)));
  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshStandardMaterial({ map: gtex, roughness: 1 }),
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.set(cx, 0.04, cz);
  grass.receiveShadow = true;
  group.add(grass);
  // concrete walking paths (cross)
  const pathMat = new THREE.MeshStandardMaterial({ color: 0xd6cfbd, roughness: 1 });
  const p1 = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.92, 2.6), pathMat);
  p1.rotation.x = -Math.PI / 2;
  p1.position.set(cx, 0.055, cz);
  const p2 = new THREE.Mesh(new THREE.PlaneGeometry(2.6, d * 0.92), pathMat);
  p2.rotation.x = -Math.PI / 2;
  p2.position.set(cx, 0.055, cz);
  p1.receiveShadow = p2.receiveShadow = true;
  group.add(p1, p2);
  // lush trees (added to instanced set)
  const n = 5 + Math.floor(Math.random() * 4);
  for (let i = 0; i < n; i++) {
    const tx = cx + (Math.random() - 0.5) * w * 0.75;
    const tz = cz + (Math.random() - 0.5) * d * 0.75;
    if (Math.abs(tx - cx) < 2.4 || Math.abs(tz - cz) < 2.4) continue; // keep paths clear
    treeSpots.push({ x: tx, z: tz });
    colliders.push({ minX: tx - 0.5, maxX: tx + 0.5, minZ: tz - 0.5, maxZ: tz + 0.5 });
  }
  // park benches
  addBench(group, colliders, cx - w * 0.28, cz + 2.2, 0);
  addBench(group, colliders, cx + w * 0.28, cz - 2.2, Math.PI);
}

function addParkingLot(group: THREE.Group, parked: ParkedCar[], cx: number, cz: number, w: number, d: number) {
  const lot = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshStandardMaterial({ color: 0x94979b, roughness: 1 }),
  );
  lot.rotation.x = -Math.PI / 2;
  lot.position.set(cx, 0.04, cz);
  lot.receiveShadow = true;
  group.add(lot);
  // painted stall dividers
  const rows = Math.max(2, Math.floor(d / 7));
  for (let r = 0; r <= rows; r++) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.02, 0.18), MAT.white);
    line.position.set(cx, 0.06, cz - d / 2 + (d / rows) * r);
    group.add(line);
  }
  const n = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    parked.push({
      x: cx + (Math.random() - 0.5) * w * 0.6,
      z: cz + (Math.random() - 0.5) * d * 0.6,
      heading: Math.random() < 0.5 ? 0 : Math.PI / 2,
    });
  }
}

function addBench(group: THREE.Group, colliders: Collider[], x: number, z: number, ry: number) {
  const g = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 0.55), MAT.benchWood);
  seat.position.y = 0.55;
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 0.1), MAT.benchWood);
  back.position.set(0, 0.95, -0.28);
  back.rotation.x = -0.15;
  g.add(seat, back);
  for (const s of [-0.7, 0.7]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 0.5), MAT.benchIron);
    leg.position.set(s, 0.28, 0);
    g.add(leg);
  }
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  g.traverse(o => { if (o instanceof THREE.Mesh) o.castShadow = true; });
  group.add(g);
  colliders.push({ minX: x - 1, maxX: x + 1, minZ: z - 0.5, maxZ: z + 0.5 });
}

function addHydrant(group: THREE.Group, colliders: Collider[], x: number, z: number) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.75, 10), MAT.hydrant);
  body.position.y = 0.45;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), MAT.hydrant);
  dome.position.y = 0.85;
  const capT = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.12, 8), MAT.hydrantCap);
  capT.position.y = 1.02;
  g.add(body, dome, capT);
  for (const s of [-1, 1]) {
    const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.3, 8), MAT.hydrantCap);
    noz.rotation.z = Math.PI / 2;
    noz.position.set(s * 0.3, 0.6, 0);
    g.add(noz);
  }
  g.position.set(x, 0, z);
  g.traverse(o => { if (o instanceof THREE.Mesh) o.castShadow = true; });
  group.add(g);
  colliders.push({ minX: x - 0.4, maxX: x + 0.4, minZ: z - 0.4, maxZ: z + 0.4 });
}

function addBusStop(group: THREE.Group, colliders: Collider[], x: number, z: number, ry: number) {
  const g = new THREE.Group();
  for (const s of [-1.4, 1.4]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.7, 0.16), MAT.pole);
    post.position.set(s, 1.35, 0);
    g.add(post);
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.14, 1.8), MAT.busRoof);
  roof.position.y = 2.75;
  roof.castShadow = true;
  const glassBack = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.4, 0.06), MAT.busGlass);
  glassBack.position.set(0, 1.5, -0.8);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.1, 0.45), MAT.benchWood);
  seat.position.set(0, 0.6, -0.5);
  g.add(roof, glassBack, seat);
  // sign
  const signPole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 8), MAT.pole);
  signPole.position.set(1.9, 1.3, 0);
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x1e5fa8, roughness: 0.5 }));
  sign.position.set(1.9, 2.5, 0);
  g.add(signPole, sign);
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  group.add(g);
  colliders.push({ minX: x - 1.8, maxX: x + 1.8, minZ: z - 1, maxZ: z + 1 });
}

/** Benches, hydrants, bus stops placed along main streets. */
function addProps(group: THREE.Group, colliders: Collider[]) {
  // benches on the two central streets
  for (const si of [2, 3]) {
    for (let d = -HALF + 40; d < HALF - 30; d += 90) {
      const c = streetCoord(si);
      addBench(group, colliders, d, c + ROAD_W / 2 + SIDEWALK_W - 1.2, 0);
      addBench(group, colliders, d + 45, c - ROAD_W / 2 - SIDEWALK_W + 1.2, Math.PI);
    }
  }
  // hydrants near intersections
  let hn = 0;
  for (let i = 1; i < BLOCKS && hn < 10; i++) {
    for (let j = 1; j < BLOCKS && hn < 10; j += 2) {
      addHydrant(group, colliders, streetCoord(i) + ROAD_W / 2 + SIDEWALK_W - 0.8, streetCoord(j) + ROAD_W / 2 + 3);
      hn++;
    }
  }
  // bus stops
  addBusStop(group, colliders, streetCoord(1) - 20, streetCoord(2) + ROAD_W / 2 + SIDEWALK_W - 1, 0);
  addBusStop(group, colliders, streetCoord(4) + 20, streetCoord(3) - ROAD_W / 2 - SIDEWALK_W + 1, Math.PI);
  addBusStop(group, colliders, streetCoord(2) + ROAD_W / 2 + SIDEWALK_W - 1, streetCoord(4) - 25, Math.PI / 2);
  addBusStop(group, colliders, streetCoord(3) - ROAD_W / 2 - SIDEWALK_W + 1, streetCoord(1) + 25, -Math.PI / 2);
}
