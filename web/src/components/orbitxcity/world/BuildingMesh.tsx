/**
 * Realistic building renderer — GTA-style massing, never blocky.
 *
 * Per building:
 * - Tiered massing with cornice / trim detailing
 * - Facades carry REAL instanced window geometry (two InstancedMeshes per
 *   building: dark reflective panes + warm lit panes). Lit-pane emissive is
 *   driven by the day/night cycle (see lib/orbitxcity/dayNight.ts).
 * - Rooftop detail: parapets, AC units, water tanks, antenna masts, penthouses
 * - Street level: retail storefront glass with mullions for walk-in venues,
 *   signage band + marquee for the rest
 * - OSM footprint buildings extrude their real outline and use a painted
 *   window-grid texture (one draw call) instead of geometry windows
 *
 * Collision contract: the south face + doorway slot must keep matching
 * collision.ts (buildingDoorway / inDoorwaySlot). Walk-in buildings keep an
 * open south doorway of buildingDoorWidth().
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text, Billboard } from "@react-three/drei";
import * as THREE from "three";
import type { BuildingDefinition } from "@/lib/orbitxcity/types";
import { hashSeed, mulberry32, isWalkInBuilding, buildingDoorWidth } from "@/lib/orbitxcity/collision";
import { getDayNight } from "@/lib/orbitxcity/dayNight";
import { getBuildingKit, gltfPathForBuilding } from "@/lib/orbitxcity/assets/buildingKits";
import { GltfProp } from "./GltfProp";
import { useCity } from "@/pages/orbitxcity/CityProvider";

/** Facade family from massing + venue role. */
export type FacadeFamily = "brick" | "limestone" | "glass" | "retail";

export function facadeFamily(b: BuildingDefinition): FacadeFamily {
  const { height, width } = b.size;
  if (b.interaction || b.kind === "shop") return "retail";
  if (height >= 20) return "glass";
  if (height >= 11 && width >= 9) return "limestone";
  return "brick";
}

const FAMILY_TRIM: Record<FacadeFamily, string> = {
  brick: "#6a4a3a",
  limestone: "#b9b2a0",
  glass: "#3a4652",
  retail: "#2a3038",
};

const FAMILY_WALL: Record<FacadeFamily, string> = {
  brick: "#8a5344",
  limestone: "#cfc3a8",
  glass: "#26313f",
  retail: "#4a4440",
};

const KIND_SIGN: Partial<Record<BuildingDefinition["kind"] | NonNullable<BuildingDefinition["interaction"]>, string>> = {
  hq: "ORBITX",
  trading_floor: "DEX",
  trading: "DEX",
  launch_arena: "PUMP",
  launch: "PUMP",
  market: "SOL",
  marketplace: "SOL",
  social_hub: "COMMUNITY",
  community: "COMMUNITY",
  shop: "GAMES",
  games: "GAMES",
  ad_tower: "ADS",
};

function buildingSign(b: BuildingDefinition): string {
  return (
    KIND_SIGN[b.kind] ??
    (b.interaction ? KIND_SIGN[b.interaction] : undefined) ??
    (b.label ?? b.name).slice(0, 10).toUpperCase()
  );
}

/* ------------------------------------------------------------------ */
/* Procedural wall-detail texture (NO painted windows — those are real  */
/* instanced geometry now). Subtle noise, material seams, ground grime. */
/* ------------------------------------------------------------------ */
function makeWallTexture(seed: number, base: string, family: FacadeFamily): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  const r = mulberry32(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);

  // Fine grain noise
  for (let i = 0; i < 1500; i++) {
    const v = r();
    ctx.fillStyle = v > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.07)";
    ctx.fillRect(r() * 256, r() * 256, 1 + r() * 2, 1 + r() * 2);
  }

  if (family === "brick") {
    ctx.strokeStyle = "rgba(30,12,8,0.4)";
    ctx.lineWidth = 1;
    for (let y = 0; y < 256; y += 10) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(256, y);
      ctx.stroke();
      for (let x = ((y / 10) % 2) * 12; x < 256; x += 24) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 10);
        ctx.stroke();
      }
    }
  } else if (family === "limestone") {
    ctx.strokeStyle = "rgba(60,50,35,0.35)";
    ctx.lineWidth = 2;
    for (let y = 0; y <= 256; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(256, y);
      ctx.stroke();
    }
    for (let x = 0; x <= 256; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 256);
      ctx.stroke();
    }
  } else if (family === "glass") {
    // Curtain-wall mullion shading
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    for (let x = 0; x < 256; x += 32) ctx.fillRect(x, 0, 3, 256);
    const sheen = ctx.createLinearGradient(0, 0, 256, 0);
    sheen.addColorStop(0, "rgba(255,255,255,0.10)");
    sheen.addColorStop(0.5, "rgba(255,255,255,0)");
    sheen.addColorStop(1, "rgba(255,255,255,0.06)");
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, 256, 256);
  }

  // Grime gradient near street level (v = 1 is the bottom of the wall)
  const grime = ctx.createLinearGradient(0, 170, 0, 256);
  grime.addColorStop(0, "rgba(5,7,10,0)");
  grime.addColorStop(1, "rgba(5,7,10,0.42)");
  ctx.fillStyle = grime;
  ctx.fillRect(0, 170, 256, 86);

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/* ------------------------------------------------------------------ */
/* Painted window-grid texture for OSM footprint extrusions (one draw   */
/* call). Lit windows live in the emissive map so they glow at night.   */
/* ------------------------------------------------------------------ */
function makeFootprintFacadeTexture(
  seed: number,
  widthUnits: number,
  heightUnits: number,
  baseColor: string,
  accent: string,
  groundFloor: boolean,
): { map: THREE.CanvasTexture; emissiveMap: THREE.CanvasTexture } {
  const cols = Math.max(2, Math.round(widthUnits / 1.35));
  const rows = Math.max(2, Math.round(heightUnits / 1.7));
  const W = Math.min(512, Math.max(128, cols * 30));
  const H = Math.min(1024, Math.max(128, rows * 38));
  const r = mulberry32(seed);

  const mapC = document.createElement("canvas");
  mapC.width = W;
  mapC.height = H;
  const emC = document.createElement("canvas");
  emC.width = W;
  emC.height = H;
  const ctx = mapC.getContext("2d")!;
  const ectx = emC.getContext("2d")!;

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, W, H);
  ectx.fillStyle = "#000000";
  ectx.fillRect(0, 0, W, H);

  const cellW = W / cols;
  const cellH = H / rows;
  const winW = cellW * 0.58;
  const winH = cellH * 0.62;
  const litPalette = ["#f0d7a0", "#ffe9b8", "#e8c99a", "#c8d8e8"];

  const startRow = groundFloor ? 1 : 0;
  for (let row = startRow; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * cellW + (cellW - winW) / 2;
      const y = row * cellH + (cellH - winH) / 2;
      const lit = r() < 0.48;
      const tint = litPalette[Math.floor(r() * litPalette.length)]!;
      // frame
      ctx.fillStyle = "rgba(10,12,16,0.85)";
      ctx.fillRect(x - 2, y - 2, winW + 4, winH + 4);
      if (lit) {
        ctx.fillStyle = tint;
        ctx.fillRect(x, y, winW, winH);
        ectx.fillStyle = tint;
        ectx.fillRect(x, y, winW, winH);
      } else {
        const g = 18 + Math.floor(r() * 14);
        ctx.fillStyle = `rgb(${g},${g + 4},${g + 8})`;
        ctx.fillRect(x, y, winW, winH);
        ectx.fillStyle = "rgba(40,60,90,0.25)";
        ectx.fillRect(x, y, winW, winH);
      }
    }
  }
  if (groundFloor) {
    // Retail band at street level
    ctx.fillStyle = "#0c1016";
    ctx.fillRect(0, 0, W, cellH);
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(0, cellH * 0.42, W, cellH * 0.2);
    ctx.globalAlpha = 1;
    ectx.fillStyle = accent;
    ectx.globalAlpha = 0.55;
    ectx.fillRect(0, cellH * 0.42, W, cellH * 0.2);
    ectx.globalAlpha = 1;
  }

  const map = new THREE.CanvasTexture(mapC);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  const emissiveMap = new THREE.CanvasTexture(emC);
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  return { map, emissiveMap };
}

/* ------------------------------------------------------------------ */
/* Massing tiers                                                      */
/* ------------------------------------------------------------------ */
interface Tier {
  w: number;
  h: number;
  d: number;
  yBase: number;
  ground: boolean;
}

function buildTiers(b: BuildingDefinition, rand: () => number): Tier[] {
  const { width: w, height: h, depth: d } = b.size;
  if (h < 8) return [{ w, h, d, yBase: 0, ground: true }];
  if (h < 14) {
    const h0 = h * (0.52 + rand() * 0.12);
    return [
      { w, h: h0, d, yBase: 0, ground: true },
      { w: w * (0.7 + rand() * 0.08), h: h - h0, d: d * (0.7 + rand() * 0.08), yBase: h0, ground: false },
    ];
  }
  if (h < 22) {
    const h0 = h * 0.42;
    const h1 = h * 0.3;
    return [
      { w, h: h0, d, yBase: 0, ground: true },
      { w: w * 0.82, h: h1, d: d * 0.82, yBase: h0, ground: false },
      { w: w * 0.58, h: h - h0 - h1, d: d * 0.58, yBase: h0 + h1, ground: false },
    ];
  }
  const h0 = h * 0.36;
  const h1 = h * 0.26;
  const h2 = h * 0.22;
  return [
    { w, h: h0, d, yBase: 0, ground: true },
    { w: w * 0.86, h: h1, d: d * 0.86, yBase: h0, ground: false },
    { w: w * 0.68, h: h2, d: d * 0.68, yBase: h0 + h1, ground: false },
    { w: w * 0.48, h: h - h0 - h1 - h2, d: d * 0.48, yBase: h0 + h1 + h2, ground: false },
  ];
}

/* ------------------------------------------------------------------ */
/* Instanced window grids — one dark-pane mesh + one lit-pane mesh per  */
/* building. Lit material emissive is driven by the day/night cycle.    */
/* ------------------------------------------------------------------ */
interface WindowField {
  dark: THREE.InstancedMesh;
  lit: THREE.InstancedMesh;
  litMaterial: THREE.MeshStandardMaterial;
}

function buildWindowField(
  building: BuildingDefinition,
  tiers: Tier[],
  family: FacadeFamily,
): WindowField {
  const rand = mulberry32(hashSeed(`win-${building.id}`));
  const walkIn = isWalkInBuilding(building);
  const glassTower = family === "glass";

  const darkXf: THREE.Matrix4[] = [];
  const litXf: THREE.Matrix4[] = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();

  tiers.forEach((t, ti) => {
    const faces = [
      { fw: t.w, off: t.d / 2 + 0.05, rotY: 0, front: true }, // +z (street face)
      { fw: t.w, off: t.d / 2 + 0.05, rotY: Math.PI, front: false }, // -z
      { fw: t.d, off: t.w / 2 + 0.05, rotY: Math.PI / 2, front: false }, // +x
      { fw: t.d, off: t.w / 2 + 0.05, rotY: -Math.PI / 2, front: false }, // -x
    ];
    for (const f of faces) {
      const margin = 1.1;
      const cols = Math.max(2, Math.floor((f.fw - margin * 2) / (glassTower ? 1.35 : 1.65)));
      const rows = Math.max(1, Math.floor((t.h - 2.1) / (glassTower ? 1.75 : 2.0)));
      if (cols <= 0 || rows <= 0) continue;
      const cellW = f.fw / cols;
      const cellH = (t.h - 1.5) / rows;
      const winW = Math.min(cellW * (glassTower ? 0.78 : 0.62), 1.5);
      const winH = Math.min(cellH * 0.62, 1.35);
      for (let ci = 0; ci < cols; ci++) {
        for (let ri = 0; ri < rows; ri++) {
          const y = t.yBase + 1.35 + ri * cellH + cellH / 2 - 0.35;
          if (y > t.yBase + t.h - 0.7) continue;
          // Keep the storefront zone clear on the walk-in street face
          if (walkIn && ti === 0 && f.front && y < 3.6) continue;
          const along = -f.fw / 2 + cellW * (ci + 0.5);
          const lit = rand() < (glassTower ? 0.55 : 0.5);
          e.set(0, f.rotY, 0);
          q.setFromEuler(e);
          const px = f.rotY === 0 || f.rotY === Math.PI ? along : Math.sin(f.rotY) * f.off;
          const pz = f.rotY === 0 || f.rotY === Math.PI ? Math.cos(f.rotY) * f.off : along;
          m.compose(new THREE.Vector3(px, y, pz), q, new THREE.Vector3(winW, winH, 1));
          (lit ? litXf : darkXf).push(m.clone());
        }
      }
    }
  });

  const geo = new THREE.BoxGeometry(1, 1, 0.1);
  const darkMat = new THREE.MeshStandardMaterial({
    color: "#0e141d",
    metalness: 0.85,
    roughness: 0.16,
  });
  const litMat = new THREE.MeshStandardMaterial({
    color: "#2c2114",
    emissive: "#ffca7a",
    emissiveIntensity: 0.25,
    metalness: 0.2,
    roughness: 0.4,
  });

  const dark = new THREE.InstancedMesh(geo, darkMat, Math.max(1, darkXf.length));
  darkXf.forEach((xf, i) => dark.setMatrixAt(i, xf));
  dark.count = darkXf.length;
  dark.instanceMatrix.needsUpdate = true;

  const lit = new THREE.InstancedMesh(geo, litMat, Math.max(1, litXf.length));
  litXf.forEach((xf, i) => lit.setMatrixAt(i, xf));
  lit.count = litXf.length;
  lit.instanceMatrix.needsUpdate = true;

  return { dark, lit, litMaterial: litMat };
}

/* ------------------------------------------------------------------ */
/* Small pieces                                                       */
/* ------------------------------------------------------------------ */
function Cornice({ w, d, y, color }: { w: number; d: number; y: number; color: string }) {
  return (
    <group position={[0, y, 0]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[w + 0.55, 0.42, d + 0.55]} />
        <meshStandardMaterial color={color} metalness={0.14} roughness={0.82} />
      </mesh>
      <mesh position={[0, -0.32, 0]}>
        <boxGeometry args={[w + 0.26, 0.22, d + 0.26]} />
        <meshStandardMaterial color={color} metalness={0.1} roughness={0.86} />
      </mesh>
    </group>
  );
}

function Awning({ w, z, accent }: { w: number; z: number; accent: string }) {
  return (
    <group position={[0, 2.85, z + 0.6]}>
      <mesh rotation={[-0.32, 0, 0]} castShadow>
        <boxGeometry args={[w, 0.09, 1.25]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.14} metalness={0.2} roughness={0.6} />
      </mesh>
      <mesh position={[0, -0.26, 0.05]}>
        <boxGeometry args={[w, 0.2, 0.05]} />
        <meshStandardMaterial color="#0a1016" emissive={accent} emissiveIntensity={0.3} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Rooftop clutter: parapet, AC units, water tank, antenna + beacon, penthouse. */
function RoofProps({
  roofY,
  topW,
  topD,
  accent,
  seed,
  showBeacon,
}: {
  roofY: number;
  topW: number;
  topD: number;
  accent: string;
  seed: number;
  showBeacon: boolean;
}) {
  const props = useMemo(() => {
    const rr = mulberry32(seed ^ 0x5bd1);
    const items: Array<{ x: number; z: number }> = [];
    const n = Math.min(3, Math.max(1, Math.floor((topW * topD) / 28)));
    for (let i = 0; i < n; i++) {
      items.push({ x: (rr() - 0.5) * topW * 0.55, z: (rr() - 0.5) * topD * 0.55 });
    }
    return {
      ac: items,
      tank: rr() > 0.35,
      tankX: (rr() - 0.5) * topW * 0.4,
      tankZ: (rr() - 0.5) * topD * 0.4,
      mast: rr() > 0.3,
      mastX: (rr() - 0.5) * topW * 0.3,
      mastZ: (rr() - 0.5) * topD * 0.3,
      mastH: 2.5 + rr() * 3,
      pent: rr() > 0.45,
      pentX: (rr() - 0.5) * topW * 0.35,
      pentZ: (rr() - 0.5) * topD * 0.35,
    };
  }, [seed, topW, topD]);

  const beaconMat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (!beaconMat.current) return;
    const dn = getDayNight();
    // Beacon only matters at night; blink red.
    beaconMat.current.opacity = dn.night > 0.25 ? 0.35 + Math.abs(Math.sin(clock.elapsedTime * 2.4)) * 0.65 : 0.12;
  });

  return (
    <group>
      {/* Roof slab */}
      <mesh position={[0, roofY + 0.1, 0]} receiveShadow>
        <boxGeometry args={[topW * 0.96, 0.22, topD * 0.96]} />
        <meshStandardMaterial color="#43484e" metalness={0.22} roughness={0.78} />
      </mesh>
      {/* Parapet */}
      {[
        { x: 0, z: topD * 0.47, w: topW * 0.96, d: 0.18 },
        { x: 0, z: -topD * 0.47, w: topW * 0.96, d: 0.18 },
        { x: topW * 0.47, z: 0, w: 0.18, d: topD * 0.96 },
        { x: -topW * 0.47, z: 0, w: 0.18, d: topD * 0.96 },
      ].map((p, i) => (
        <mesh key={i} position={[p.x, roofY + 0.48, p.z]} castShadow>
          <boxGeometry args={[p.w, 0.62, p.d]} />
          <meshStandardMaterial color="#4e545b" metalness={0.18} roughness={0.8} />
        </mesh>
      ))}
      {/* AC units */}
      {props.ac.map((a, i) => (
        <group key={i} position={[a.x, roofY + 0.21, a.z]}>
          <mesh position={[0, 0.36, 0]} castShadow>
            <boxGeometry args={[1.15, 0.72, 0.9]} />
            <meshStandardMaterial color="#232c3a" metalness={0.5} roughness={0.55} />
          </mesh>
          <mesh position={[0, 0.74, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.3, 0.3, 0.06, 12]} />
            <meshStandardMaterial color="#141a24" metalness={0.6} roughness={0.4} />
          </mesh>
        </group>
      ))}
      {/* Water tank */}
      {props.tank && (
        <group position={[props.tankX, roofY + 0.21, props.tankZ]}>
          {[
            [-0.4, -0.4],
            [0.4, -0.4],
            [-0.4, 0.4],
            [0.4, 0.4],
          ].map(([lx, lz], i) => (
            <mesh key={i} position={[lx, 0.3, lz]}>
              <boxGeometry args={[0.09, 0.6, 0.09]} />
              <meshStandardMaterial color="#3a2f26" roughness={0.8} />
            </mesh>
          ))}
          <mesh position={[0, 1.25, 0]} castShadow>
            <cylinderGeometry args={[0.62, 0.68, 1.35, 12]} />
            <meshStandardMaterial color="#5a4632" roughness={0.72} metalness={0.08} />
          </mesh>
          <mesh position={[0, 2.1, 0]} castShadow>
            <coneGeometry args={[0.72, 0.5, 12]} />
            <meshStandardMaterial color="#4a3a2a" roughness={0.75} />
          </mesh>
        </group>
      )}
      {/* Elevator penthouse */}
      {props.pent && (
        <group position={[props.pentX, roofY + 0.21, props.pentZ]}>
          <mesh position={[0, 0.85, 0]} castShadow>
            <boxGeometry args={[2.1, 1.7, 1.8]} />
            <meshStandardMaterial color="#4a5058" metalness={0.2} roughness={0.75} />
          </mesh>
          <mesh position={[0, 0.85, 0.92]}>
            <planeGeometry args={[0.8, 1.3]} />
            <meshStandardMaterial color="#141a22" metalness={0.5} roughness={0.5} />
          </mesh>
        </group>
      )}
      {/* Antenna mast */}
      {props.mast && (
        <group position={[props.mastX, roofY + 0.21, props.mastZ]}>
          <mesh position={[0, props.mastH / 2, 0]} castShadow>
            <cylinderGeometry args={[0.05, 0.09, props.mastH, 6]} />
            <meshStandardMaterial color="#1a2232" metalness={0.7} roughness={0.35} />
          </mesh>
          <mesh position={[0, props.mastH * 0.72, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.025, 0.025, 1.1, 6]} />
            <meshStandardMaterial color="#1a2232" metalness={0.7} roughness={0.35} />
          </mesh>
          {showBeacon && (
            <mesh position={[0, props.mastH + 0.12, 0]}>
              <sphereGeometry args={[0.13, 10, 10]} />
              <meshBasicMaterial ref={beaconMat} color="#ff2b2b" transparent opacity={0.5} toneMapped={false} />
            </mesh>
          )}
        </group>
      )}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* One massing tier: wall box + corner pilasters                       */
/* ------------------------------------------------------------------ */
function FacadeTier({
  tier,
  building,
  index,
  family,
}: {
  tier: Tier;
  building: BuildingDefinition;
  index: number;
  family: FacadeFamily;
}) {
  const wallMat = useMemo(() => {
    const tex = makeWallTexture(hashSeed(`${building.id}-wall-${index}`), FAMILY_WALL[family], family);
    tex.repeat.set(Math.max(1, Math.round(tier.w / 7)), Math.max(1, Math.round(tier.h / 7)));
    return new THREE.MeshStandardMaterial({
      map: tex,
      metalness: family === "glass" ? 0.55 : 0.16,
      roughness: family === "glass" ? 0.32 : 0.78,
    });
  }, [building.id, family, tier.w, tier.h, index]);

  return (
    <group>
      <mesh position={[0, tier.yBase + tier.h / 2, 0]} castShadow receiveShadow material={wallMat}>
        <boxGeometry args={[tier.w, tier.h, tier.d]} />
      </mesh>
      {/* Corner pilasters on the ground tier */}
      {tier.ground &&
        ([
          [-tier.w / 2, -tier.d / 2],
          [tier.w / 2, -tier.d / 2],
          [-tier.w / 2, tier.d / 2],
          [tier.w / 2, tier.d / 2],
        ] as const).map(([cx, cz], i) => (
          <mesh key={i} position={[cx, tier.h / 2, cz]} castShadow>
            <boxGeometry args={[0.22, tier.h, 0.22]} />
            <meshStandardMaterial color={FAMILY_TRIM[family]} metalness={0.2} roughness={0.7} />
          </mesh>
        ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* OSM footprint extrusion shell (painted window texture)              */
/* ------------------------------------------------------------------ */
function FootprintShell({ building, family }: { building: BuildingDefinition; family: FacadeFamily }) {
  const footprint = building.footprint!;
  const height = building.size.height;

  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    footprint.forEach((p, i) => {
      if (i === 0) shape.moveTo(p.x, p.z);
      else shape.lineTo(p.x, p.z);
    });
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: height,
      bevelEnabled: false,
      curveSegments: 1,
      steps: 1,
    });
    geo.rotateX(-Math.PI / 2);
    geo.computeVertexNormals();
    return geo;
  }, [footprint, height]);

  const materialRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const material = useMemo(() => {
    const { map, emissiveMap } = makeFootprintFacadeTexture(
      hashSeed(`${building.id}-fp`),
      Math.max(building.size.width, building.size.depth),
      height,
      FAMILY_WALL[family],
      building.accent,
      true,
    );
    const mat = new THREE.MeshStandardMaterial({
      map,
      emissiveMap,
      emissive: new THREE.Color("#ffffff"),
      emissiveIntensity: 0.25,
      metalness: family === "glass" ? 0.45 : 0.18,
      roughness: family === "glass" ? 0.35 : 0.72,
    });
    materialRef.current = mat;
    return mat;
  }, [building, family, height]);

  useFrame(() => {
    const mat = materialRef.current;
    if (!mat) return;
    mat.emissiveIntensity = 0.12 + getDayNight().windowLevel * 1.35;
  });

  return (
    <>
      <mesh geometry={geometry} material={material} castShadow receiveShadow />
      {/* Roof cap */}
      <mesh position={[0, height + 0.1, 0]} receiveShadow>
        <boxGeometry args={[building.size.width * 0.9, 0.2, building.size.depth * 0.9]} />
        <meshStandardMaterial color="#43484e" metalness={0.22} roughness={0.78} />
      </mesh>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Storefront for walk-in venues: retail glass, mullions, marquee      */
/* ------------------------------------------------------------------ */
function Storefront({
  building,
  family,
  accent,
  isHq,
}: {
  building: BuildingDefinition;
  family: FacadeFamily;
  accent: string;
  isHq: boolean;
}) {
  const { openVenue } = useCity();
  const { size, label, name } = building;
  const doorW = buildingDoorWidth(building);
  const faceZ = size.depth / 2;
  const glowMat = useRef<THREE.MeshStandardMaterial>(null);
  const marqueeMat = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(() => {
    const dn = getDayNight();
    if (glowMat.current) glowMat.current.emissiveIntensity = 0.25 + dn.windowLevel * 1.1;
    if (marqueeMat.current) marqueeMat.current.emissiveIntensity = 0.55 + dn.lampLevel * 0.75;
  });

  const totalW = Math.min(size.width * 0.92, size.width - 0.4);
  const openW = doorW + 0.9;

  return (
    <group>
      {/* Retail glass + mullions, split around the open doorway */}
      {([-1, 1] as const).map((s) => {
        const segW = Math.max(0, (totalW - openW) / 2);
        if (segW <= 0.1) return null;
        const cx = s * (openW / 2 + segW / 2);
        const mullions = Math.max(1, Math.floor(segW / 1.4));
        return (
          <group key={`store-${s}`}>
            {/* glass */}
            <mesh position={[cx, 1.6, faceZ + 0.04]}>
              <planeGeometry args={[segW, 2.9]} />
              <meshStandardMaterial
                ref={s === -1 ? glowMat : undefined}
                color="#0d1622"
                emissive={accent}
                emissiveIntensity={0.3}
                metalness={0.65}
                roughness={0.18}
                transparent
                opacity={0.94}
              />
            </mesh>
            {/* mullion frames */}
            {Array.from({ length: mullions + 1 }, (_, i) => (
              <mesh key={i} position={[cx - segW / 2 + (segW / mullions) * i, 1.6, faceZ + 0.07]}>
                <boxGeometry args={[0.09, 2.9, 0.09]} />
                <meshStandardMaterial color="#161c24" metalness={0.55} roughness={0.45} />
              </mesh>
            ))}
            <mesh position={[cx, 3.02, faceZ + 0.07]}>
              <boxGeometry args={[segW, 0.12, 0.1]} />
              <meshStandardMaterial color="#161c24" metalness={0.55} roughness={0.45} />
            </mesh>
            {/* bulkhead below glass */}
            <mesh position={[cx, 0.35, faceZ + 0.02]} castShadow>
              <boxGeometry args={[segW, 0.7, 0.12]} />
              <meshStandardMaterial color={FAMILY_WALL[family]} metalness={0.25} roughness={0.6} />
            </mesh>
          </group>
        );
      })}

      <Awning w={Math.min(doorW + 1.8, size.width - 0.6)} z={faceZ} accent={accent} />

      {/* Marquee sign */}
      <mesh position={[0, 3.55, faceZ + 0.22]} castShadow>
        <boxGeometry args={[Math.min(size.width * 0.78, isHq ? 7.6 : 6.6), isHq ? 0.72 : 0.5, 0.32]} />
        <meshStandardMaterial ref={marqueeMat} color={accent} emissive={accent} emissiveIntensity={0.7} toneMapped={false} />
      </mesh>
      <Text
        position={[0, 3.55, faceZ + 0.4]}
        fontSize={isHq ? 0.3 : 0.22}
        color="#061018"
        anchorX="center"
        anchorY="middle"
        maxWidth={Math.min(size.width * 0.7, 6)}
      >
        {isHq ? "ORBITX HQ" : (label ?? name).toUpperCase()}
      </Text>

      {/* Blade sign */}
      <mesh position={[size.width / 2 + 0.14, 2.5, faceZ - 0.4]} castShadow>
        <boxGeometry args={[0.14, 1.9, 0.6]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.7} toneMapped={false} />
      </mesh>

      {/* Open doorway — collision doorway slot lives here */}
      <mesh position={[-doorW / 2 - 0.14, 1.2, faceZ + 0.1]} castShadow>
        <boxGeometry args={[0.24, 2.6, 0.24]} />
        <meshStandardMaterial color="#1a1e22" metalness={0.3} roughness={0.55} />
      </mesh>
      <mesh position={[doorW / 2 + 0.14, 1.2, faceZ + 0.1]} castShadow>
        <boxGeometry args={[0.24, 2.6, 0.24]} />
        <meshStandardMaterial color="#1a1e22" metalness={0.3} roughness={0.55} />
      </mesh>
      <mesh position={[0, 2.55, faceZ + 0.12]} castShadow>
        <boxGeometry args={[doorW + 0.6, 0.2, 0.3]} />
        <meshStandardMaterial color="#2a3036" metalness={0.25} roughness={0.65} />
      </mesh>
      {/* Dark interior seen through the doorway */}
      <mesh position={[0, 1.15, faceZ - 0.06]}>
        <planeGeometry args={[doorW * 0.94, 2.2]} />
        <meshStandardMaterial color="#070a0e" roughness={1} />
      </mesh>
      <Text
        position={[0, 2.95, faceZ + 0.44]}
        fontSize={0.2}
        color="#e8fff4"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.018}
        outlineColor="#05080c"
        onClick={(e) => {
          e.stopPropagation();
          openVenue(building.id);
        }}
      >
        {`WALK IN · ${(label ?? name).toUpperCase()}`}
      </Text>
      {/* Porch slab */}
      <mesh position={[0, 0.03, faceZ + 1.2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[doorW + 2.8, 2.5]} />
        <meshStandardMaterial color="#6a7178" roughness={0.9} metalness={0.06} />
      </mesh>

      <Billboard position={[0, building.size.height + 1.8, 0]}>
        <Text
          fontSize={0.42}
          color="#e8eef2"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.025}
          outlineColor="#12161a"
          maxWidth={8}
        >
          {label ?? name}
        </Text>
      </Billboard>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Non-walk-in buildings: signage band                                */
/* ------------------------------------------------------------------ */
function SignBand({ building, accent }: { building: BuildingDefinition; accent: string }) {
  const { size } = building;
  const bandMat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    if (!bandMat.current) return;
    bandMat.current.emissiveIntensity = 0.45 + getDayNight().lampLevel * 0.65;
  });
  if (size.height < 6) return null;
  const y = Math.min(size.height * 0.42, 5.4);
  return (
    <group>
      <mesh position={[0, y, size.depth / 2 + 0.1]} castShadow>
        <boxGeometry args={[Math.min(size.width * 0.72, 5.8), 0.6, 0.18]} />
        <meshStandardMaterial ref={bandMat} color={accent} emissive={accent} emissiveIntensity={0.6} toneMapped={false} />
      </mesh>
      <Text
        position={[0, y, size.depth / 2 + 0.22]}
        fontSize={0.24}
        color="#061018"
        anchorX="center"
        anchorY="middle"
        maxWidth={Math.min(size.width * 0.68, 5.4)}
      >
        {buildingSign(building)}
      </Text>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Building root                                                      */
/* ------------------------------------------------------------------ */
export function BuildingMesh({ building }: { building: BuildingDefinition }) {
  const { quality } = useCity();
  const high = quality === "high";
  const { position, size, accent } = building;
  const family = facadeFamily(building);
  const rand = useMemo(() => mulberry32(hashSeed(`bld-${building.id}`)), [building.id]);
  const kit = useMemo(() => getBuildingKit(building.kind), [building.kind]);
  const modelPath = useMemo(() => gltfPathForBuilding(building.id, building.kind), [building.id, building.kind]);
  const hasFootprint = Boolean(building.footprint && building.footprint.length >= 3);
  const useAssetShell = !hasFootprint && high && Boolean(modelPath) && kit.isOrbitx;
  const tiers = useMemo(() => buildTiers(building, rand), [building, rand]);
  const top = tiers[tiers.length - 1]!;
  const roofY = hasFootprint ? size.height : top.yBase + top.h;
  const walkIn = isWalkInBuilding(building);
  const isHq = building.kind === "hq" || building.interaction === "hq";
  const showCornice = high && (family === "brick" || family === "limestone");

  const windows = useMemo(
    () => (!hasFootprint && !useAssetShell ? buildWindowField(building, tiers, family) : null),
    [building, tiers, family, hasFootprint, useAssetShell],
  );
  const litWinMat = windows?.litMaterial ?? null;
  useFrame(() => {
    if (!litWinMat) return;
    const dn = getDayNight();
    litWinMat.emissiveIntensity = 0.12 + dn.windowLevel * 1.75;
  });

  return (
    <group position={[position.x, 0, position.z]}>
      {hasFootprint ? (
        <FootprintShell building={building} family={family} />
      ) : useAssetShell && modelPath ? (
        <GltfProp
          path={modelPath}
          scale={[size.width / 2, size.height / 1.65, size.depth / 2]}
          castShadow
          receiveShadow
        />
      ) : (
        <>
          {tiers.map((t, i) => (
            <FacadeTier key={i} tier={t} building={building} index={i} family={family} />
          ))}
          {showCornice && (
            <Cornice
              w={top.w}
              d={top.d}
              y={roofY}
              color={FAMILY_TRIM[family]}
            />
          )}
          {windows && (
            <group>
              <primitive object={windows.dark} />
              <primitive object={windows.lit} />
            </group>
          )}
        </>
      )}

      <RoofProps
        roofY={roofY}
        topW={hasFootprint ? size.width * 0.55 : top.w}
        topD={hasFootprint ? size.depth * 0.55 : top.d}
        accent={accent}
        seed={hashSeed(`roof-${building.id}`)}
        showBeacon={size.height >= 8 && kit.beacon}
      />

      {walkIn ? (
        <Storefront building={building} family={family} accent={accent} isHq={isHq} />
      ) : (
        <SignBand building={building} accent={accent} />
      )}
    </group>
  );
}
