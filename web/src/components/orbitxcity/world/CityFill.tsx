/**
 * OrbitX City — surrounding district generator.
 *
 * Builds the city around the authored playable block: a real road network with
 * sidewalks and crossings, grass verges, street trees and lamps, and a varied
 * building stock with ground-floor storefronts.
 *
 * Everything here is decorative and sits OUTSIDE the authored block's
 * footprint, so it never affects collision or interaction zones.
 */
import { useMemo } from "react";
import * as THREE from "three";
import { hashSeed, mulberry32 } from "@/lib/orbitxcity/collision";
import { BlockBuilding, type BlockKind } from "./BlockBuilding";

export interface CityFillProps {
  /** Half-extent of the protected centre that filler must avoid. */
  innerRadius?: number;
  /** Half-extent of the generated district. */
  outerRadius?: number;
  /** Buildable lot size between roads. */
  lotSize?: number;
  seed?: string;
  /** Drop the far ring and fine props when the renderer is in lite mode. */
  lite?: boolean;
}

const ROAD_W = 12;
const SIDEWALK_W = 3;

/* Bright plastic palette — toy-like, high value. */
const WALLS = [
  "#dce1ea", "#c6cfdc", "#e8dfcc", "#cedbcd", "#dccdd6",
  "#ccd7e1", "#e3d7c2", "#c3ccd8", "#d6cfc0", "#cfd9df",
];
const TRIMS = ["#949cab", "#adb5c2", "#9fac9f", "#b5a594", "#98a7b5"];
const GLASS = ["#8fdcff", "#ffe08a", "#a8f0d0", "#cbb6ff", "#ffc9a8"];
const AWNINGS = ["#c9463f", "#2f7d5c", "#2b5d99", "#c98a2b", "#7a4a8c"];
const SIGNS = ["DEX", "PUMP", "HODL", "MOON", "SOL", "BAGS", "APE", "GM", "WAGMI", "LFG"];
const SHOPS = ["DELI", "COFFEE", "BARBER", "PIZZA", "LAUNDRY", "BODEGA", "RAMEN", "ARCADE"];

interface Lot {
  x: number;
  z: number;
  w: number;
  d: number;
  floors: number;
  kind: BlockKind;
  color: string;
  trim: string;
  glass: string;
  rot: number;
  sign?: string;
  shop?: string;
  awning: string;
  type: "building" | "park" | "plaza";
}

interface Plan {
  lots: Lot[];
  /** Road centre-lines as [x1, z1, x2, z2]. */
  roads: [number, number, number, number][];
  lamps: [number, number][];
  trees: [number, number, number][];
}

function planDistrict(
  innerRadius: number,
  outerRadius: number,
  lotSize: number,
  seed: string,
): Plan {
  const rand = mulberry32(hashSeed(seed));
  const pitch = lotSize + ROAD_W;
  const steps = Math.floor(outerRadius / pitch);
  const span = steps * pitch;

  const lots: Lot[] = [];
  const roads: [number, number, number, number][] = [];
  const lamps: [number, number][] = [];
  const trees: [number, number, number][] = [];

  const inCore = (x: number, z: number) =>
    Math.abs(x) < innerRadius && Math.abs(z) < innerRadius;

  // ── Road network: full grid, skipping the authored core ──
  for (let i = -steps; i <= steps + 1; i += 1) {
    const at = i * pitch - pitch / 2;
    if (Math.abs(at) > outerRadius) continue;
    // Avenues (run along Z) and streets (run along X)
    roads.push([at, -span, at, span]);
    roads.push([-span, at, span, at]);
  }

  // ── Lots ──
  for (let ix = -steps; ix <= steps; ix += 1) {
    for (let iz = -steps; iz <= steps; iz += 1) {
      const cx = ix * pitch;
      const cz = iz * pitch;
      if (inCore(cx, cz)) continue;

      const dist = Math.hypot(cx, cz);
      if (dist > outerRadius) continue;

      const roll = rand();
      if (roll < 0.05) continue; // empty lot

      const type: Lot["type"] =
        roll < 0.13 ? "park" : roll < 0.17 ? "plaza" : "building";

      // Downtown falloff: tall near the core, low at the rim.
      const falloff = 1 - Math.min(1, dist / outerRadius);
      const floors = Math.max(
        1,
        Math.round(2 + falloff * 10 + (rand() - 0.5) * 5),
      );

      const w = lotSize * (0.66 + rand() * 0.26);
      const d = lotSize * (0.66 + rand() * 0.26);

      const kind: BlockKind =
        floors >= 10 ? "tower" : floors <= 2 ? "shop" : "midrise";

      lots.push({
        x: cx + (rand() - 0.5) * 1.8,
        z: cz + (rand() - 0.5) * 1.8,
        w,
        d,
        floors,
        kind,
        color: WALLS[Math.floor(rand() * WALLS.length)]!,
        trim: TRIMS[Math.floor(rand() * TRIMS.length)]!,
        glass: GLASS[Math.floor(rand() * GLASS.length)]!,
        rot: (rand() - 0.5) * 0.03,
        sign: floors >= 8 && rand() < 0.32
          ? SIGNS[Math.floor(rand() * SIGNS.length)]
          : undefined,
        shop: floors <= 4 && rand() < 0.55
          ? SHOPS[Math.floor(rand() * SHOPS.length)]
          : undefined,
        awning: AWNINGS[Math.floor(rand() * AWNINGS.length)]!,
        type,
      });

      // Street furniture along the lot's kerb line.
      const kerb = lotSize / 2 + SIDEWALK_W * 0.6;
      if (rand() < 0.7) lamps.push([cx + kerb, cz - kerb]);
      if (rand() < 0.55) {
        trees.push([cx - kerb, cz + kerb, 0.85 + rand() * 0.5]);
      }
      if (rand() < 0.4) {
        trees.push([cx + kerb, cz + kerb, 0.85 + rand() * 0.5]);
      }
    }
  }

  return { lots, roads, lamps, trees };
}

/* ── Road surface: asphalt slab, centre line, kerbs both sides ── */
function Road({
  line,
}: {
  line: [number, number, number, number];
}) {
  const [x1, z1, x2, z2] = line;
  const dx = x2 - x1;
  const dz = z2 - z1;
  const len = Math.hypot(dx, dz);
  const angle = Math.atan2(dz, dx);

  return (
    <group
      position={[(x1 + x2) / 2, 0, (z1 + z2) / 2]}
      rotation={[0, -angle, 0]}
    >
      {/* Sidewalk slab sits under and slightly proud of the asphalt */}
      <mesh position={[0, 0.06, 0]} receiveShadow>
        <boxGeometry args={[len, 0.12, ROAD_W + SIDEWALK_W * 2]} />
        <meshStandardMaterial color="#b6bcc6" roughness={0.94} flatShading />
      </mesh>
      {/* Asphalt */}
      <mesh position={[0, 0.14, 0]} receiveShadow>
        <boxGeometry args={[len, 0.06, ROAD_W]} />
        <meshStandardMaterial color="#3b3f47" roughness={0.97} />
      </mesh>
      {/* Dashed centre line */}
      <mesh position={[0, 0.18, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[len * 0.97, 0.3]} />
        <meshBasicMaterial color="#e8d98a" toneMapped={false} />
      </mesh>
    </group>
  );
}

/* ── Grass verge that fills the gaps between road and lot ── */
function GrassPad({ lot }: { lot: Lot }) {
  return (
    <mesh position={[lot.x, 0.08, lot.z]} receiveShadow>
      <boxGeometry args={[lot.w + 3, 0.16, lot.d + 3]} />
      <meshStandardMaterial color="#79b664" roughness={0.96} flatShading />
    </mesh>
  );
}

/* ── Chunky low-poly tree ── */
function Tree({
  position,
  scale = 1,
}: {
  position: [number, number, number];
  scale?: number;
}) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 1.0, 0]} castShadow>
        <boxGeometry args={[0.5, 2.0, 0.5]} />
        <meshStandardMaterial color="#7a5638" roughness={0.92} flatShading />
      </mesh>
      <mesh position={[0, 2.5, 0]} castShadow>
        <boxGeometry args={[2.8, 1.8, 2.8]} />
        <meshStandardMaterial color="#4f9e4a" roughness={0.9} flatShading />
      </mesh>
      <mesh position={[0, 3.6, 0]} castShadow>
        <boxGeometry args={[1.9, 1.3, 1.9]} />
        <meshStandardMaterial color="#5cb356" roughness={0.9} flatShading />
      </mesh>
    </group>
  );
}

function StreetLamp({ position }: { position: [number, number] }) {
  return (
    <group position={[position[0], 0, position[1]]}>
      <mesh position={[0, 2.4, 0]} castShadow>
        <boxGeometry args={[0.24, 4.8, 0.24]} />
        <meshStandardMaterial color="#4a5260" roughness={0.85} flatShading />
      </mesh>
      <mesh position={[0, 4.9, 0]}>
        <boxGeometry args={[0.9, 0.26, 0.9]} />
        <meshStandardMaterial
          color="#fff3c4"
          emissive="#ffe9a8"
          emissiveIntensity={1.0}
          flatShading
        />
      </mesh>
    </group>
  );
}

/* ── Park lot: grass, trees, path, bench ── */
function ParkLot({ lot }: { lot: Lot }) {
  const rand = useMemo(
    () => mulberry32(hashSeed(`${lot.x}:${lot.z}:park`)),
    [lot.x, lot.z],
  );
  const trees = useMemo(() => {
    const out: [number, number, number][] = [];
    const n = 3 + Math.floor(rand() * 4);
    for (let i = 0; i < n; i += 1) {
      out.push([
        (rand() - 0.5) * lot.w * 0.78,
        0,
        (rand() - 0.5) * lot.d * 0.78,
      ]);
    }
    return out;
  }, [rand, lot.w, lot.d]);

  return (
    <group position={[lot.x, 0, lot.z]}>
      <mesh position={[0, 0.14, 0]} receiveShadow>
        <boxGeometry args={[lot.w + 2, 0.28, lot.d + 2]} />
        <meshStandardMaterial color="#79b664" roughness={0.96} flatShading />
      </mesh>
      {/* Crossing path */}
      <mesh position={[0, 0.3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[lot.w + 2, 2.2]} />
        <meshStandardMaterial color="#cfc4a8" roughness={0.95} />
      </mesh>
      {trees.map((p, i) => (
        <Tree key={i} position={[p[0], 0.28, p[2]]} />
      ))}
      {/* Bench */}
      <mesh position={[lot.w * 0.22, 0.62, lot.d * 0.2]} castShadow>
        <boxGeometry args={[2.4, 0.24, 0.8]} />
        <meshStandardMaterial color="#8a6644" roughness={0.9} flatShading />
      </mesh>
    </group>
  );
}

/* ── Plaza lot: paved square with a planter ── */
function PlazaLot({ lot }: { lot: Lot }) {
  return (
    <group position={[lot.x, 0, lot.z]}>
      <mesh position={[0, 0.14, 0]} receiveShadow>
        <boxGeometry args={[lot.w + 2, 0.28, lot.d + 2]} />
        <meshStandardMaterial color="#c2c7cf" roughness={0.93} flatShading />
      </mesh>
      <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
        <boxGeometry args={[lot.w * 0.34, 0.8, lot.d * 0.34]} />
        <meshStandardMaterial color="#9aa2ae" roughness={0.9} flatShading />
      </mesh>
      <Tree position={[0, 0.95, 0]} scale={1.1} />
    </group>
  );
}

/* ── Ground-floor storefront band with an awning and a door ── */
function Storefront({ lot }: { lot: Lot }) {
  const sign = useMemo(() => {
    if (!lot.shop || typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 64;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#12151b";
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = "#f2e7cf";
    ctx.font = "bold 34px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(lot.shop, 128, 34);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [lot.shop]);

  const front = lot.d / 2;

  return (
    <group position={[lot.x, 0, lot.z]} rotation={[0, lot.rot, 0]}>
      {/* Shop window */}
      <mesh position={[0, 1.5, front + 0.08]}>
        <boxGeometry args={[lot.w * 0.76, 2.2, 0.12]} />
        <meshStandardMaterial
          color={lot.glass}
          emissive={lot.glass}
          emissiveIntensity={0.5}
          roughness={0.3}
          flatShading
        />
      </mesh>
      {/* Awning */}
      <mesh
        position={[0, 3.0, front + 0.75]}
        rotation={[-0.35, 0, 0]}
        castShadow
      >
        <boxGeometry args={[lot.w * 0.86, 0.16, 1.7]} />
        <meshStandardMaterial color={lot.awning} roughness={0.85} flatShading />
      </mesh>
      {/* Door */}
      <mesh position={[lot.w * 0.3, 1.35, front + 0.1]}>
        <boxGeometry args={[1.3, 2.7, 0.16]} />
        <meshStandardMaterial color="#1d222b" roughness={0.85} flatShading />
      </mesh>
      {sign && (
        <mesh position={[0, 3.9, front + 0.1]}>
          <planeGeometry args={[lot.w * 0.66, lot.w * 0.17]} />
          <meshBasicMaterial map={sign} toneMapped={false} transparent />
        </mesh>
      )}
    </group>
  );
}

export function CityFill({
  innerRadius = 78,
  outerRadius = 250,
  lotSize = 22,
  seed = "orbitx-nyc",
  lite = false,
}: CityFillProps) {
  const plan = useMemo(
    () => planDistrict(innerRadius, outerRadius, lotSize, seed),
    [innerRadius, outerRadius, lotSize, seed],
  );

  // Lite mode: keep the near ring only, and drop fine props.
  const ring = lite ? outerRadius * 0.62 : outerRadius;
  const lots = plan.lots.filter((l) => Math.hypot(l.x, l.z) <= ring);
  const roads = plan.roads.filter(
    (r) => Math.abs(r[0]) <= ring + 30 && Math.abs(r[1]) <= ring + 30,
  );
  const lamps = lite
    ? []
    : plan.lamps.filter((p) => Math.hypot(p[0], p[1]) <= ring);
  const trees = lite
    ? plan.trees.filter((p) => Math.hypot(p[0], p[1]) <= ring * 0.6)
    : plan.trees.filter((p) => Math.hypot(p[0], p[1]) <= ring);

  return (
    <group name="oxc-city-fill">
      {roads.map((r, i) => (
        <Road key={`r${i}`} line={r} />
      ))}

      {lots.map((lot, i) => {
        if (lot.type === "park") return <ParkLot key={`l${i}`} lot={lot} />;
        if (lot.type === "plaza") return <PlazaLot key={`l${i}`} lot={lot} />;
        return (
          <group key={`l${i}`}>
            <GrassPad lot={lot} />
            <BlockBuilding
              position={[lot.x, 0.16, lot.z]}
              width={lot.w}
              depth={lot.d}
              floors={lot.floors}
              kind={lot.kind}
              color={lot.color}
              trim={lot.trim}
              glass={lot.glass}
              rotationY={lot.rot}
              studs={!lite && lot.floors <= 6}
              sign={lot.sign}
            />
            {!lite && lot.shop && <Storefront lot={lot} />}
          </group>
        );
      })}

      {trees.map((p, i) => (
        <Tree key={`t${i}`} position={[p[0], 0.16, p[1]]} scale={p[2]} />
      ))}
      {lamps.map((p, i) => (
        <StreetLamp key={`m${i}`} position={p} />
      ))}
    </group>
  );
}
