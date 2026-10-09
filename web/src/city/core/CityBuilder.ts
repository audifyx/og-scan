import * as THREE from "three";
import { facadeTexture, roadTexture, sidewalkTexture, billboardFace, type BillboardFace } from "./textures";

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
}

function streetCoord(i: number): number {
  return -HALF + ROAD_W / 2 + i * PITCH;
}

export function buildCity(): CityData {
  const group = new THREE.Group();
  const colliders: Collider[] = [];
  const lampMats: THREE.MeshStandardMaterial[] = [];
  const windowMats: THREE.MeshStandardMaterial[] = [];
  const billboards: Billboard[] = [];
  const parked: ParkedCar[] = [];

  // --- ground ---
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1400, 1400),
    new THREE.MeshStandardMaterial({ color: 0x070a10, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  group.add(ground);

  const cityBase = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_SPAN + 60, CITY_SPAN + 60),
    new THREE.MeshStandardMaterial({ color: 0x0c1017, roughness: 1 }),
  );
  cityBase.rotation.x = -Math.PI / 2;
  cityBase.position.y = 0;
  group.add(cityBase);

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

  // --- buildings per block ---
  const facades = [facadeTexture(0), facadeTexture(1), facadeTexture(2), facadeTexture(3), facadeTexture(4)];
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x11141a, roughness: 1 });
  let styleFlip = 0;

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
            addPark(group, colliders, cx, cz, lotX1 - lotX0, lotZ1 - lotZ0);
          } else if (roll < 0.3) {
            addParkingLot(group, parked, cx, cz, lotX1 - lotX0, lotZ1 - lotZ0);
          } else {
            const distC = Math.hypot(bi - (BLOCKS - 1) / 2, bj - (BLOCKS - 1) / 2);
            const h = 16 + Math.random() * 30 + Math.max(0, 26 - distC * 9);
            const w = (lotX1 - lotX0) * (0.62 + Math.random() * 0.2);
            const d = (lotZ1 - lotZ0) * (0.62 + Math.random() * 0.2);
            addBuilding(group, colliders, windowMats, facades, roofMat, cx, cz, w, h, d, styleFlip++ % facades.length);
          }
        }
      }
    }
  }

  // --- streetlights ---
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2e35, roughness: 0.6, metalness: 0.6 });
  for (let i = 0; i <= BLOCKS; i++) {
    for (let d = -HALF + 20; d < HALF - 10; d += 42) {
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

  const spawn = { x: streetCoord(2) + ROAD_W / 2 + SIDEWALK_W / 2, z: streetCoord(2), heading: Math.PI };
  return { group, colliders, nodes, billboards, lampMats, windowMats, parked, spawn };
}

function addBuilding(
  group: THREE.Group, colliders: Collider[], windowMats: THREE.MeshStandardMaterial[],
  facades: { map: THREE.CanvasTexture; emissive: THREE.CanvasTexture }[],
  roofMat: THREE.Material,
  cx: number, cz: number, w: number, h: number, d: number, style: number,
) {
  const f = facades[style];
  const map = f.map.clone();
  map.needsUpdate = true;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(Math.max(1, Math.round(w / 14)), Math.max(1, Math.round(h / 14)));
  const em = f.emissive.clone();
  em.needsUpdate = true;
  em.wrapS = em.wrapT = THREE.RepeatWrapping;
  em.repeat.copy(map.repeat);
  const side = new THREE.MeshStandardMaterial({
    map, emissiveMap: em, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.85,
  });
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

function addPark(group: THREE.Group, colliders: Collider[], cx: number, cz: number, w: number, d: number) {
  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshStandardMaterial({ color: 0x14331f, roughness: 1 }),
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.set(cx, 0.04, cz);
  group.add(grass);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x1f5c2e, roughness: 1 });
  const n = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    const tx = cx + (Math.random() - 0.5) * w * 0.7;
    const tz = cz + (Math.random() - 0.5) * d * 0.7;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 3.4, 7), trunkMat);
    trunk.position.set(tx, 1.7, tz);
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(2.4 + Math.random(), 1), leafMat);
    leaf.position.set(tx, 4.6, tz);
    leaf.castShadow = true;
    group.add(trunk, leaf);
    colliders.push({ minX: tx - 0.6, maxX: tx + 0.6, minZ: tz - 0.6, maxZ: tz + 0.6 });
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
  const n = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    parked.push({
      x: cx + (Math.random() - 0.5) * w * 0.6,
      z: cz + (Math.random() - 0.5) * d * 0.6,
      heading: Math.random() < 0.5 ? 0 : Math.PI / 2,
    });
  }
}
