import * as THREE from "three";
import { facadeTexture, roadTexture, sidewalkTexture, billboardFace, type BillboardFace } from "./textures";
/**
 * District facade plots (door buildings) live in the districts module — the
 * single source of truth for door/facade placement. We reserve those lots so
 * random city generation never swallows a facade or blocks a door trigger.
 */
import { FACADE_PLOTS } from "../modules/districts";

export const BLOCKS = 9;          // blocks per side (expanded from 5)
export const BLOCK = 64;          // block size (m)
export const ROAD_W = 14;         // road width (m)
export const SIDEWALK_W = 5;
export const PITCH = BLOCK + ROAD_W;
export const CITY_SPAN = BLOCKS * PITCH + ROAD_W; // full extent incl. outer roads
export const HALF = CITY_SPAN / 2;

/** World-space layout anchors shared with the districts module. */
export const COAST_Z = HALF + 80;      // south edge of the beach band (water beyond)
export const BEACH_Z0 = HALF - 6;     // north edge of the sand strip
export const WATER_Y = -0.6;          // ocean plane height

export interface Collider { minX: number; maxX: number; minZ: number; maxZ: number }
export interface RoadNode { x: number; z: number }
export interface ParkedCar { x: number; z: number; heading: number }
export interface Billboard { face: BillboardFace; mesh: THREE.Mesh }

/** Live market quote shape fed by the integrator from `useLivePrices` (DexScreener). */
export interface MarketQuote {
  price: number;
  change24h: number;
  /** Optional — drives tower height. Falls back to neutral when absent. */
  marketCap?: number;
}

export interface MarketTower {
  mesh: THREE.Mesh;
  /** Window material — emissive color encodes 24h price action. */
  windowMat: THREE.MeshStandardMaterial;
  /** Crown signs that ride the tower top as its height changes. */
  signs: THREE.Mesh[];
  baseHeight: number;
  symbol: string;
}

export interface CityData {
  group: THREE.Group;
  colliders: Collider[];
  /** Intersection nodes indexed [i][j] for i,j in 0..BLOCKS */
  nodes: RoadNode[][];
  billboards: Billboard[];
  lampMats: THREE.MeshStandardMaterial[];
  windowMats: THREE.MeshStandardMaterial[];
  parked: ParkedCar[];
  /** Data-driven towers: height = market cap, windows = price action. */
  marketTowers: MarketTower[];
  spawn: { x: number; z: number; heading: number };
  /**
   * Push live DexScreener quotes into the market towers (height = market cap,
   * window glow = 24h price action). The integrator calls this from its
   * existing `useLivePrices` feed — no new data plumbing.
   */
  applyMarketData(quotes: Record<string, MarketQuote>): void;
}

function streetCoord(i: number): number {
  return -HALF + ROAD_W / 2 + i * PITCH;
}

/** Token symbols wired to market towers (mirrors the integrator's MARKET_SYMBOLS). */
const TOWER_SYMBOLS = ["SOL", "ORBITX", "BONK", "JUP", "WIF"];

type Zone = "financial" | "industrial" | "beachfront" | "suburb" | "midtown";

function zoneFor(bi: number, bj: number): Zone {
  const c = (BLOCKS - 1) / 2;
  const d = Math.hypot(bi - c, bj - c);
  if (bj >= BLOCKS - 1) return "beachfront"; // south coast row
  if (bj >= BLOCKS - 2) return "industrial"; // docks strip behind the beach
  if (d <= 1.7) return "financial";          // downtown towers
  if (d >= 3.4) return "suburb";            // residential ring
  return "midtown";
}

function lotHitsPlot(x0: number, x1: number, z0: number, z1: number): boolean {
  for (const p of FACADE_PLOTS) {
    const px0 = p.cx - p.halfW, px1 = p.cx + p.halfW;
    const pz0 = p.cz - p.halfD, pz1 = p.cz + p.halfD;
    if (x0 < px1 && x1 > px0 && z0 < pz1 && z1 > pz0) return true;
  }
  return false;
}

export function buildCity(): CityData {
  const group = new THREE.Group();
  const colliders: Collider[] = [];
  const lampMats: THREE.MeshStandardMaterial[] = [];
  const windowMats: THREE.MeshStandardMaterial[] = [];
  const billboards: Billboard[] = [];
  const parked: ParkedCar[] = [];
  const marketTowers: MarketTower[] = [];
  let towerCursor = 0;

  // --- ocean (everything sits above it; mainland + island are raised ground) ---
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(6000, 6000),
    new THREE.MeshStandardMaterial({ color: 0x0a2536, roughness: 0.25, metalness: 0.35 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = WATER_Y;
  group.add(water);

  // --- mainland ground (city + outskirts; the strait south of COAST_Z is water) ---
  const groundW = (HALF + 362) * 2;
  const groundZ0 = -(HALF + 362);
  const groundZ1 = COAST_Z;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(groundW, groundZ1 - groundZ0),
    new THREE.MeshStandardMaterial({ color: 0x0c130d, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, (groundZ0 + groundZ1) / 2);
  group.add(ground);

  // --- city base slab ---
  const cityBase = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_SPAN + 60, CITY_SPAN + 60),
    new THREE.MeshStandardMaterial({ color: 0x0c1017, roughness: 1 }),
  );
  cityBase.rotation.x = -Math.PI / 2;
  cityBase.position.y = 0;
  group.add(cityBase);

  // --- beach band along the south coast ---
  const beach = new THREE.Mesh(
    new THREE.PlaneGeometry(groundW, COAST_Z - BEACH_Z0),
    new THREE.MeshStandardMaterial({ color: 0xb89a67, roughness: 1 }),
  );
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(0, 0.04, (BEACH_Z0 + COAST_Z) / 2);
  group.add(beach);

  // --- roads (strips) ---
  const roadTex = roadTexture();
  const roadLen = CITY_SPAN;
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
      group.add(m);
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
        group.add(m);
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

  // --- buildings per block (zoned) ---
  const facades = [facadeTexture(0), facadeTexture(1), facadeTexture(2), facadeTexture(3), facadeTexture(4)];
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x11141a, roughness: 1 });
  let styleFlip = 0;

  for (let bi = 0; bi < BLOCKS; bi++) {
    for (let bj = 0; bj < BLOCKS; bj++) {
      const zone = zoneFor(bi, bj);
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
          // district facade plots stay clear — the districts module builds there
          if (lotHitsPlot(lotX0, lotX1, lotZ0, lotZ1)) continue;
          const cx = (lotX0 + lotX1) / 2;
          const cz = (lotZ0 + lotZ1) / 2;
          const roll = Math.random();
          if (roll < 0.08) {
            addPark(group, colliders, cx, cz, lotX1 - lotX0, lotZ1 - lotZ0, zone);
          } else if (roll < 0.18) {
            addParkingLot(group, parked, cx, cz, lotX1 - lotX0, lotZ1 - lotZ0);
          } else if (zone === "industrial") {
            addWarehouse(group, colliders, windowMats, cx, cz, lotX1 - lotX0, lotZ1 - lotZ0, styleFlip++);
          } else if (zone === "suburb") {
            addHouse(group, colliders, cx, cz, lotX1 - lotX0, lotZ1 - lotZ0, styleFlip++);
          } else if (zone === "financial" && towerCursor < 10 && roll > 0.55) {
            const symbol = TOWER_SYMBOLS[towerCursor % TOWER_SYMBOLS.length];
            towerCursor++;
            addMarketTower(group, colliders, windowMats, marketTowers, facades, cx, cz,
              lotX1 - lotX0, lotZ1 - lotZ0, symbol, styleFlip++ % facades.length);
          } else {
            const distC = Math.hypot(bi - (BLOCKS - 1) / 2, bj - (BLOCKS - 1) / 2);
            const hBase = zone === "financial" ? 42 : zone === "beachfront" ? 22 : 16;
            const hVar = zone === "financial" ? 46 : zone === "beachfront" ? 14 : 30;
            const h = hBase + Math.random() * hVar + Math.max(0, 26 - distC * 7);
            const w = (lotX1 - lotX0) * (0.62 + Math.random() * 0.2);
            const d = (lotZ1 - lotZ0) * (0.62 + Math.random() * 0.2);
            addBuilding(group, colliders, windowMats, facades, roofMat, cx, cz, w, h, d, styleFlip++ % facades.length, zone);
          }
        }
      }
    }
  }

  // --- industrial dressing: cranes + container yards between warehouses ---
  addIndustrialDressing(group, colliders);

  // --- streetlights across the whole grid ---
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2e35, roughness: 0.6, metalness: 0.6 });
  for (let i = 0; i <= BLOCKS; i++) {
    for (let d = -HALF + 20; d < HALF - 10; d += 84) {
      for (const horizontal of [true, false]) {
        const c = streetCoord(i);
        const lampMat = new THREE.MeshStandardMaterial({
          color: 0x444444, emissive: 0xffd9a0, emissiveIntensity: 0, roughness: 0.4,
        });
        lampMats.push(lampMat);
        const g = new THREE.Group();
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 8, 8), poleMat);
        pole.position.y = 4;
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 3.2), poleMat);
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

  // --- traffic signals at every third intersection ---
  addTrafficSignals(group, colliders, poleMat);

  // --- bus stop shelters along the avenues ---
  addBusStops(group, colliders);

  // --- billboards (live market data faces) ---
  const bbSpots: { x: number; z: number; ry: number }[] = [
    { x: streetCoord(2), z: streetCoord(1) - ROAD_W, ry: 0 },
    { x: streetCoord(4) + ROAD_W, z: streetCoord(3), ry: -Math.PI / 2 },
    { x: streetCoord(1) - ROAD_W, z: streetCoord(4), ry: Math.PI / 2 },
    { x: streetCoord(5), z: streetCoord(5) - ROAD_W, ry: 0 },
    { x: streetCoord(6) + ROAD_W, z: streetCoord(6), ry: -Math.PI / 2 },
  ];
  for (const s of bbSpots) {
    const face = billboardFace();
    const frame = new THREE.Group();
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(13, 7, 0.6),
      new THREE.MeshStandardMaterial({ map: face.texture, emissive: 0xffffff, emissiveMap: face.texture, emissiveIntensity: 0.9 }),
    );
    panel.position.y = 11;
    panel.userData.isBuilding = true; // token-scanner raycast target (gadgets module)
    const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 11, 8), poleMat);
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

  // --- outskirts: hills + farm (north), desert (west), forest (east) ---
  addOutskirts(group, colliders);

  // --- beach dressing: umbrellas on the sand ---
  addBeachDressing(group);

  // --- marina: piers + sailboats on the southeast coast ---
  addMarina(group, colliders);

  const spawn = { x: streetCoord(2) + ROAD_W / 2 + SIDEWALK_W / 2, z: streetCoord(2), heading: Math.PI };

  function applyMarketData(quotes: Record<string, MarketQuote>): void {
    for (const t of marketTowers) {
      const q = quotes[t.symbol];
      if (!q || !(q.price > 0)) {
        t.mesh.scale.y = 1;
        t.mesh.position.y = t.baseHeight / 2;
        t.signs.forEach((sg) => { sg.position.y = t.baseHeight - 4; });
        t.windowMat.emissive.setHex(0xffffff);
        continue;
      }
      // height = market cap (log scale; 1M → stubby, 1B → tall, 100B+ → spire)
      let s = 1;
      if (q.marketCap && q.marketCap > 0) {
        s = 0.55 + 0.5 * (Math.log10(q.marketCap) - 6) / 3.5;
        s = Math.min(2.1, Math.max(0.5, s));
      }
      t.mesh.scale.y = s;
      t.mesh.position.y = (t.baseHeight * s) / 2;
      // crown signs ride the tower top
      t.signs.forEach((sg) => { sg.position.y = t.baseHeight * s - 4; });
      // windows = price action (emissive color; intensity is driven by core's day/night)
      const up = q.change24h >= 0;
      t.windowMat.emissive.setHex(up ? 0x2aff7a : 0xff3b5c);
    }
  }

  return { group, colliders, nodes, billboards, lampMats, windowMats, parked, marketTowers, spawn, applyMarketData };
}

/* ------------------------------- buildings -------------------------------- */

function windowSideMaterial(
  facades: { map: THREE.CanvasTexture; emissive: THREE.CanvasTexture }[],
  style: number, w: number, h: number,
): THREE.MeshStandardMaterial {
  const f = facades[style];
  const map = f.map.clone();
  map.needsUpdate = true;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(Math.max(1, Math.round(w / 14)), Math.max(1, Math.round(h / 14)));
  const em = f.emissive.clone();
  em.needsUpdate = true;
  em.wrapS = em.wrapT = THREE.RepeatWrapping;
  em.repeat.copy(map.repeat);
  return new THREE.MeshStandardMaterial({
    map, emissiveMap: em, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.85,
  });
}

function addBuilding(
  group: THREE.Group, colliders: Collider[], windowMats: THREE.MeshStandardMaterial[],
  facades: { map: THREE.CanvasTexture; emissive: THREE.CanvasTexture }[],
  roofMat: THREE.Material,
  cx: number, cz: number, w: number, h: number, d: number, style: number, zone: Zone,
) {
  const side = windowSideMaterial(facades, style, w, h);
  // beachfront hotels read white; financial towers read dark glass
  if (zone === "beachfront") side.color.setHex(0xe8e2d4);
  if (zone === "financial") { side.color.setHex(0x9fb4c8); side.metalness = 0.45; side.roughness = 0.4; }
  windowMats.push(side);
  const mats = [side, side, roofMat, roofMat, side, side];
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
  mesh.position.set(cx, h / 2, cz);
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.userData.isBuilding = true; // token-scanner raycast target (gadgets module)
  group.add(mesh);
  // rooftop box
  const rb = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.3, 3, d * 0.3),
    new THREE.MeshStandardMaterial({ color: 0x1a1e25, roughness: 1 }),
  );
  rb.position.set(cx + w * 0.15, h + 1.5, cz - d * 0.1);
  group.add(rb);
  colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
}

/** Data-driven market tower: glass spire bound to a live token quote. */
function addMarketTower(
  group: THREE.Group, colliders: Collider[], windowMats: THREE.MeshStandardMaterial[],
  marketTowers: MarketTower[],
  facades: { map: THREE.CanvasTexture; emissive: THREE.CanvasTexture }[],
  cx: number, cz: number, w: number, d: number, symbol: string, style: number,
) {
  const h = 52 + Math.random() * 22;
  const side = windowSideMaterial(facades, style, w, h);
  side.color.setHex(0x8fb8d8);
  side.metalness = 0.6;
  side.roughness = 0.3;
  windowMats.push(side);
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x0d1420, roughness: 0.6, metalness: 0.4 });
  const mats = [side, side, roofMat, roofMat, side, side];
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, h, d * 0.8), mats);
  mesh.position.set(cx, h / 2, cz);
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.userData.isBuilding = true;
  mesh.userData.marketSymbol = symbol;
  group.add(mesh);
  // glowing crown sign with the token symbol
  const c = document.createElement("canvas");
  c.width = 512; c.height = 96;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#060a12"; ctx.fillRect(0, 0, 512, 96);
  ctx.fillStyle = "#7fd4ff"; ctx.font = "bold 56px Arial";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("$" + symbol, 256, 52);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(Math.min(w * 0.7, 22), 3.4),
    new THREE.MeshBasicMaterial({ map: tex, transparent: false }),
  );
  sign.position.set(cx, h - 4, cz + (d * 0.8) / 2 + 0.15);
  group.add(sign);
  const sign2 = sign.clone();
  sign2.position.z = cz - (d * 0.8) / 2 - 0.15;
  sign2.rotation.y = Math.PI;
  group.add(sign2);
  marketTowers.push({ mesh, windowMat: side, signs: [sign, sign2], baseHeight: h, symbol });
  colliders.push({ minX: cx - (w * 0.8) / 2, maxX: cx + (w * 0.8) / 2, minZ: cz - (d * 0.8) / 2, maxZ: cz + (d * 0.8) / 2 });
}

/** Low wide warehouse for the industrial/docks strip. */
function addWarehouse(
  group: THREE.Group, colliders: Collider[], windowMats: THREE.MeshStandardMaterial[],
  cx: number, cz: number, w: number, d: number, n: number,
) {
  const h = 10 + Math.random() * 4;
  const tones = [0x5a6068, 0x6b5a48, 0x4a5a6b, 0x5c5248];
  const wallMat = new THREE.MeshStandardMaterial({ color: tones[n % tones.length], roughness: 0.9 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, h, d * 0.9), wallMat);
  mesh.position.set(cx, h / 2, cz);
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.userData.isBuilding = true;
  group.add(mesh);
  // sawtooth-ish roof stripe
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.9, 0.8, 2),
    new THREE.MeshStandardMaterial({ color: 0x2a2e33, roughness: 0.9 }),
  );
  stripe.position.set(cx, h + 0.4, cz);
  group.add(stripe);
  // loading doors (dark insets on the front face)
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x1c1f24, roughness: 1 });
  for (let k = -1; k <= 1; k++) {
    const door = new THREE.Mesh(new THREE.PlaneGeometry(5, 5.5), doorMat);
    door.position.set(cx + k * (w * 0.28), 2.75, cz + (d * 0.9) / 2 + 0.05);
    group.add(door);
  }
  // small lit office windows strip
  const winMat = new THREE.MeshStandardMaterial({
    color: 0x333333, emissive: 0xffd9a0, emissiveIntensity: 0, roughness: 0.4,
  });
  windowMats.push(winMat);
  const wins = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.7, 1.6), winMat);
  wins.position.set(cx, h - 2.2, cz + (d * 0.9) / 2 + 0.05);
  group.add(wins);
  colliders.push({ minX: cx - (w * 0.9) / 2, maxX: cx + (w * 0.9) / 2, minZ: cz - (d * 0.9) / 2, maxZ: cz + (d * 0.9) / 2 });
}

/** Suburban house with a pitched roof. */
function addHouse(
  group: THREE.Group, colliders: Collider[], cx: number, cz: number, w: number, d: number, n: number,
) {
  const hw = Math.min(w * 0.42, 16), hd = Math.min(d * 0.42, 14);
  const h = 5 + Math.random() * 2.5;
  const tones = [0xd8cfc0, 0xc4b8a4, 0xb8c4d8, 0xd4b8b8, 0xc8d4b8];
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(hw, h, hd),
    new THREE.MeshStandardMaterial({ color: tones[n % tones.length], roughness: 0.95 }),
  );
  wall.position.set(cx, h / 2, cz);
  wall.castShadow = wall.receiveShadow = true;
  wall.userData.isBuilding = true;
  group.add(wall);
  // pitched roof (prism via cylinder with 3 radial segments… use a rotated box pair)
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x6b4a3a, roughness: 1 });
  const r1 = new THREE.Mesh(new THREE.BoxGeometry(hw * 0.62, 0.4, hd + 1), roofMat);
  r1.position.set(cx - hw * 0.2, h + 1.4, cz);
  r1.rotation.z = 0.5;
  const r2 = new THREE.Mesh(new THREE.BoxGeometry(hw * 0.62, 0.4, hd + 1), roofMat);
  r2.position.set(cx + hw * 0.2, h + 1.4, cz);
  r2.rotation.z = -0.5;
  r1.castShadow = r2.castShadow = true;
  group.add(r1, r2);
  // warm windows
  const winMat = new THREE.MeshStandardMaterial({ color: 0x443322, emissive: 0xffc873, emissiveIntensity: 0.9 });
  const win = new THREE.Mesh(new THREE.PlaneGeometry(hw * 0.5, 1.4), winMat);
  win.position.set(cx, 2.6, cz + hd / 2 + 0.06);
  group.add(win);
  // front lawn + tree
  const lawn = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 0.9, d * 0.9),
    new THREE.MeshStandardMaterial({ color: 0x1d4a26, roughness: 1 }),
  );
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.set(cx, 0.035, cz);
  group.add(lawn);
  addTree(group, colliders, cx + hw * 0.7, cz + hd * 0.5, 1);
  colliders.push({ minX: cx - hw / 2, maxX: cx + hw / 2, minZ: cz - hd / 2, maxZ: cz + hd / 2 });
}

function addTree(group: THREE.Group, colliders: Collider[], x: number, z: number, s: number) {
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3 * s, 0.42 * s, 2.8 * s, 7),
    new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 1 }),
  );
  trunk.position.set(x, 1.4 * s, z);
  const leaf = new THREE.Mesh(
    new THREE.IcosahedronGeometry(2.1 * s, 1),
    new THREE.MeshStandardMaterial({ color: 0x1f5c2e, roughness: 1 }),
  );
  leaf.position.set(x, 3.9 * s, z);
  leaf.castShadow = true;
  group.add(trunk, leaf);
  colliders.push({ minX: x - 0.5, maxX: x + 0.5, minZ: z - 0.5, maxZ: z + 0.5 });
}

function addPalm(group: THREE.Group, x: number, z: number, s: number) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28 * s, 0.4 * s, 5.5 * s, 7),
    new THREE.MeshStandardMaterial({ color: 0x7a5a38, roughness: 1 }),
  );
  trunk.position.y = 2.75 * s;
  trunk.rotation.z = 0.07;
  trunk.castShadow = true;
  g.add(trunk);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2e7a3a, roughness: 1 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.65 * s, 3 * s, 6), leafMat);
    frond.position.set(Math.cos(a) * 1.3 * s, 5.7 * s, Math.sin(a) * 1.3 * s);
    frond.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1);
    g.add(frond);
  }
  g.position.set(x, 0, z);
  group.add(g);
}

function addPark(group: THREE.Group, colliders: Collider[], cx: number, cz: number, w: number, d: number, zone: Zone) {
  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshStandardMaterial({ color: 0x14331f, roughness: 1 }),
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.set(cx, 0.04, cz);
  group.add(grass);
  const n = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    const tx = cx + (Math.random() - 0.5) * w * 0.7;
    const tz = cz + (Math.random() - 0.5) * d * 0.7;
    if (zone === "beachfront") addPalm(group, tx, tz, 0.9 + Math.random() * 0.4);
    else addTree(group, colliders, tx, tz, 0.9 + Math.random() * 0.5);
  }
  // benches
  const benchMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 1 });
  for (let i = 0; i < 2; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 0.7), benchMat);
    b.position.set(cx + (Math.random() - 0.5) * w * 0.6, 0.45, cz + (Math.random() - 0.5) * d * 0.6);
    group.add(b);
  }
}

function addParkingLot(group: THREE.Group, parked: ParkedCar[], cx: number, cz: number, w: number, d: number) {
  const lot = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshStandardMaterial({ color: 0x14171d, roughness: 1 }),
  );
  lot.rotation.x = -Math.PI / 2;
  lot.position.set(cx, 0.04, cz);
  group.add(lot);
  // painted bays
  const lineMat = new THREE.MeshBasicMaterial({ color: 0x8a8f96 });
  for (let i = 0; i < 6; i++) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.18, d * 0.7), lineMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(cx - w * 0.35 + i * (w * 0.14), 0.05, cz);
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

/* --------------------------------- props ---------------------------------- */

function addIndustrialDressing(group: THREE.Group, colliders: Collider[]) {
  const steel = new THREE.MeshStandardMaterial({ color: 0x8a7a3a, roughness: 0.7, metalness: 0.4 });
  // gantry cranes along the docks strip (bj = BLOCKS-2 → z ≈ streetCoord(7))
  const zc = streetCoord(BLOCKS - 2) + 20;
  for (const xc of [-180, 0, 180]) {
    const crane = new THREE.Group();
    for (const sx of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(1.6, 26, 1.6), steel);
      leg.position.set(sx * 9, 13, 0);
      leg.castShadow = true;
      crane.add(leg);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(24, 2, 2.4), steel);
    beam.position.set(0, 26, 0);
    beam.castShadow = true;
    crane.add(beam);
    const cable = new THREE.Mesh(new THREE.BoxGeometry(0.25, 10, 0.25), steel);
    cable.position.set(5, 20, 0);
    crane.add(cable);
    const hook = new THREE.Mesh(new THREE.BoxGeometry(3, 2.4, 2.6),
      new THREE.MeshStandardMaterial({ color: 0xc23b3b, roughness: 0.8 }));
    hook.position.set(5, 14, 0);
    crane.add(hook);
    crane.position.set(xc, 0, zc);
    group.add(crane);
    colliders.push({ minX: xc - 10, maxX: xc + 10, minZ: zc - 2, maxZ: zc + 2 });
  }
  // container stacks
  const contColors = [0xc23b3b, 0x2a6bc2, 0x2e9e5a, 0xd8a02e, 0x7a3bc2];
  for (let i = 0; i < 16; i++) {
    const x = -260 + Math.random() * 520;
    const z = streetCoord(BLOCKS - 2) - 24 + Math.random() * 20;
    const h = 1 + Math.floor(Math.random() * 3);
    for (let k = 0; k < h; k++) {
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(6, 2.6, 2.6),
        new THREE.MeshStandardMaterial({ color: contColors[Math.floor(Math.random() * contColors.length)], roughness: 0.85 }),
      );
      box.position.set(x, 1.3 + k * 2.7, z);
      box.castShadow = true;
      group.add(box);
    }
    colliders.push({ minX: x - 3.2, maxX: x + 3.2, minZ: z - 1.5, maxZ: z + 1.5 });
  }
  // smokestacks
  for (const [sx, sz] of [[-240, 0], [240, 0]] as [number, number][]) {
    const stack = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 3, 34, 12),
      new THREE.MeshStandardMaterial({ color: 0x6a6f76, roughness: 0.9 }),
    );
    stack.position.set(sx, 17, streetCoord(BLOCKS - 2) + sz);
    stack.castShadow = true;
    group.add(stack);
    colliders.push({ minX: sx - 3, maxX: sx + 3, minZ: streetCoord(BLOCKS - 2) + sz - 3, maxZ: streetCoord(BLOCKS - 2) + sz + 3 });
  }
}

function addTrafficSignals(group: THREE.Group, colliders: Collider[], poleMat: THREE.Material) {
  const headMat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.7 });
  const lampOn = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2222, emissiveIntensity: 1.4 });
  for (let i = 0; i <= BLOCKS; i++) {
    for (let j = 0; j <= BLOCKS; j++) {
      if ((i + j) % 3 !== 0) continue;
      const x = streetCoord(i) + ROAD_W / 2 + 1.2;
      const z = streetCoord(j) + ROAD_W / 2 + 1.2;
      const g = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 6.5, 8), poleMat);
      pole.position.y = 3.25;
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.4, 0.9), headMat);
      head.position.set(0, 6.8, 0);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8), lampOn);
      lamp.position.set(0, 7.4, 0.5);
      g.add(pole, head, lamp);
      g.position.set(x, 0, z);
      group.add(g);
      colliders.push({ minX: x - 0.5, maxX: x + 0.5, minZ: z - 0.5, maxZ: z + 0.5 });
    }
  }
}

function addBusStops(group: THREE.Group, colliders: Collider[]) {
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x2a6bc2, roughness: 0.6, metalness: 0.4 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x9fc4d8, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.4 });
  let placed = 0;
  for (let i = 1; i <= BLOCKS && placed < 8; i += 2) {
    const x = streetCoord(i) + ROAD_W / 2 + SIDEWALK_W / 2;
    const z = streetCoord(3) - 20 - placed * 30;
    if (Math.abs(z) > HALF) continue;
    const g = new THREE.Group();
    const roof = new THREE.Mesh(new THREE.BoxGeometry(5, 0.25, 2.2), frameMat);
    roof.position.y = 2.8;
    const back = new THREE.Mesh(new THREE.PlaneGeometry(5, 2.4), glassMat);
    back.position.set(0, 1.5, -1);
    const bench = new THREE.Mesh(new THREE.BoxGeometry(4, 0.4, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 1 }));
    bench.position.set(0, 0.7, -0.5);
    g.add(roof, back, bench);
    g.position.set(x, 0, z);
    group.add(g);
    colliders.push({ minX: x - 2.5, maxX: x + 2.5, minZ: z - 1.2, maxZ: z + 1.2 });
    placed++;
  }
}

/* -------------------------------- outskirts --------------------------------- */

function addOutskirts(group: THREE.Group, colliders: Collider[]) {
  // north hills — big flattened domes with colliders
  const hillMat = new THREE.MeshStandardMaterial({ color: 0x14331f, roughness: 1 });
  const hills: [number, number, number, number][] = [
    [-420, -560, 70, 22], [-260, -610, 90, 30], [-80, -580, 60, 18],
    [120, -610, 85, 26], [300, -570, 65, 20], [460, -610, 80, 24],
  ];
  for (const [x, z, r, h] of hills) {
    const hill = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), hillMat);
    hill.scale.y = h / r;
    hill.position.set(x, 0, z);
    hill.receiveShadow = true;
    group.add(hill);
    colliders.push({ minX: x - r * 0.75, maxX: x + r * 0.75, minZ: z - r * 0.75, maxZ: z + r * 0.75 });
  }

  // farm (north-west): fields + barn + silo
  const fieldColors = [0x4a6b2a, 0x6b5a2a, 0x3a5a3a];
  fieldColors.forEach((c, i) => {
    const f = new THREE.Mesh(
      new THREE.PlaneGeometry(90, 55),
      new THREE.MeshStandardMaterial({ color: c, roughness: 1 }),
    );
    f.rotation.x = -Math.PI / 2;
    f.position.set(-460 + i * 100, 0.03, -470);
    group.add(f);
  });
  const barnMat = new THREE.MeshStandardMaterial({ color: 0x8a2a2a, roughness: 0.9 });
  const barn = new THREE.Mesh(new THREE.BoxGeometry(22, 10, 16), barnMat);
  barn.position.set(-380, 5, -560);
  barn.castShadow = true;
  group.add(barn);
  const barnRoof = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 9.5, 6, 4, 1),
    new THREE.MeshStandardMaterial({ color: 0x5a5f66, roughness: 0.9 }));
  barnRoof.position.set(-380, 13, -560);
  barnRoof.rotation.y = Math.PI / 4;
  barnRoof.scale.set(1.25, 1, 0.95);
  group.add(barnRoof);
  const silo = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 18, 12),
    new THREE.MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.7, metalness: 0.3 }));
  silo.position.set(-352, 9, -560);
  silo.castShadow = true;
  group.add(silo);
  colliders.push(
    { minX: -391, maxX: -369, minZ: -568, maxZ: -552 },
    { minX: -356, maxX: -348, minZ: -564, maxZ: -556 },
  );

  // west desert: sand patch + cacti + rocks
  const desert = new THREE.Mesh(
    new THREE.PlaneGeometry(190, 620),
    new THREE.MeshStandardMaterial({ color: 0xa8895a, roughness: 1 }),
  );
  desert.rotation.x = -Math.PI / 2;
  desert.position.set(-615, 0.02, 0);
  group.add(desert);
  const cactusMat = new THREE.MeshStandardMaterial({ color: 0x2e6b3a, roughness: 1 });
  for (let i = 0; i < 14; i++) {
    const x = -690 + Math.random() * 150;
    const z = -280 + Math.random() * 560;
    const h = 3.5 + Math.random() * 2.5;
    const cactus = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, h, 8), cactusMat);
    trunk.position.y = h / 2;
    trunk.castShadow = true;
    cactus.add(trunk);
    for (const s of [-1, 1]) {
      if (Math.random() < 0.4) continue;
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.8, 7), cactusMat);
      arm.position.set(s * 0.8, h * 0.6, 0);
      arm.rotation.z = s * 0.5;
      cactus.add(arm);
    }
    cactus.position.set(x, 0, z);
    group.add(cactus);
    colliders.push({ minX: x - 0.8, maxX: x + 0.8, minZ: z - 0.8, maxZ: z + 0.8 });
  }
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x7a6a55, roughness: 1 });
  for (let i = 0; i < 10; i++) {
    const x = -690 + Math.random() * 150;
    const z = -280 + Math.random() * 560;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1 + Math.random() * 2.2), rockMat);
    rock.position.set(x, 0.8, z);
    rock.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    rock.castShadow = true;
    group.add(rock);
  }

  // east forest: dense pines
  const pineTrunk = new THREE.MeshStandardMaterial({ color: 0x5a4028, roughness: 1 });
  const pineLeaf = new THREE.MeshStandardMaterial({ color: 0x1f4a2e, roughness: 1 });
  for (let i = 0; i < 44; i++) {
    const x = 520 + Math.random() * 160;
    const z = -300 + Math.random() * 600;
    const s = 0.9 + Math.random() * 1.1;
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3 * s, 0.4 * s, 2 * s, 6), pineTrunk);
    trunk.position.y = s;
    g.add(trunk);
    for (let k = 0; k < 3; k++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry((2.4 - k * 0.6) * s, 2.6 * s, 8), pineLeaf);
      cone.position.y = (2 + k * 1.6) * s;
      cone.castShadow = true;
      g.add(cone);
    }
    g.position.set(x, 0, z);
    group.add(g);
    if (i % 3 === 0) colliders.push({ minX: x - 0.7, maxX: x + 0.7, minZ: z - 0.7, maxZ: z + 0.7 });
  }
}

function addBeachDressing(group: THREE.Group) {
  // umbrellas scattered on the sand
  const umbColors = [0xc23b3b, 0x2a6bc2, 0xd8a02e, 0x2e9e5a];
  for (let i = 0; i < 12; i++) {
    const x = -440 + Math.random() * 880;
    const z = BEACH_Z0 + 12 + Math.random() * (COAST_Z - BEACH_Z0 - 24);
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 2.6, 6),
      new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.7 }),
    );
    pole.position.set(x, 1.3, z);
    const top = new THREE.Mesh(
      new THREE.ConeGeometry(1.9, 1, 8),
      new THREE.MeshStandardMaterial({ color: umbColors[i % umbColors.length], roughness: 0.9 }),
    );
    top.position.set(x, 2.9, z);
    top.castShadow = true;
    group.add(pole, top);
  }
  // lifeguard tower
  const tower = new THREE.Group();
  const hutMat = new THREE.MeshStandardMaterial({ color: 0xc23b3b, roughness: 0.8 });
  for (const [sx, sz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]] as [number, number][]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.35, 4.5, 0.35), hutMat);
    leg.position.set(sx, 2.25, sz);
    tower.add(leg);
  }
  const hut = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2.4, 4.4), hutMat);
  hut.position.y = 5.7;
  hut.castShadow = true;
  tower.add(hut);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.6, 1.4, 4),
    new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.9 }));
  roof.position.y = 7.6;
  roof.rotation.y = Math.PI / 4;
  tower.add(roof);
  tower.position.set(60, 0, BEACH_Z0 + 30);
  group.add(tower);
}

function addMarina(group: THREE.Group, colliders: Collider[]) {
  const pierMat = new THREE.MeshStandardMaterial({ color: 0x6b5a44, roughness: 0.95 });
  const hullMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.6 });
  const sailMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.9, side: THREE.DoubleSide });
  for (let p = 0; p < 3; p++) {
    const px = 130 + p * 40;
    // pier deck out over the water
    const pier = new THREE.Mesh(new THREE.BoxGeometry(4, 1, 46), pierMat);
    pier.position.set(px, 0.4, COAST_Z + 20);
    pier.castShadow = pier.receiveShadow = true;
    group.add(pier);
    for (let k = 0; k < 4; k++) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2.4, 8), pierMat);
      post.position.set(px + (k % 2 === 0 ? -1.6 : 1.6), -0.2, COAST_Z + 4 + k * 11);
      group.add(post);
    }
    colliders.push({ minX: px - 2, maxX: px + 2, minZ: COAST_Z - 3, maxZ: COAST_Z + 43 });
    // sailboats moored alongside
    for (let b = 0; b < 2; b++) {
      const bx = px + (b === 0 ? -7 : 7);
      const bz = COAST_Z + 14 + b * 16;
      const boat = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 7), hullMat);
      hull.position.y = 0.2;
      boat.add(hull);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 8, 6), pierMat);
      mast.position.y = 4.5;
      boat.add(mast);
      const sail = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 6.4), sailMat);
      sail.position.set(1.75, 4.6, 0);
      boat.add(sail);
      boat.position.set(bx, WATER_Y + 0.35, bz);
      boat.rotation.y = (Math.random() - 0.5) * 0.3;
      group.add(boat);
    }
  }
}
