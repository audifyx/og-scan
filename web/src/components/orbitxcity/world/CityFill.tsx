/**
 * OrbitX City — procedural filler city.
 *
 * The hand-authored block only defines landmark venues, which leaves the
 * skyline sparse and the streets empty. This generates a dense surrounding
 * grid of blocky buildings, street furniture and park plots so the district
 * reads as a full city rather than a few slabs on a plane.
 *
 * Everything here is decorative and sits OUTSIDE the playable block's
 * footprint, so it never interferes with collision or interaction zones.
 */
import { useMemo } from "react";
import { hashSeed, mulberry32 } from "@/lib/orbitxcity/collision";
import { BlockBuilding, type BlockKind } from "./BlockBuilding";

export interface CityFillProps {
  /** Half-extent of the protected centre that filler must avoid. */
  innerRadius?: number;
  /** Half-extent of the generated city. */
  outerRadius?: number;
  /** Street grid pitch. */
  lotSize?: number;
  seed?: string;
  /** Skip studs and props when the renderer is in lite mode. */
  lite?: boolean;
}

/** Bright plastic palette — deliberately toy-like, high value, low saturation drift. */
const WALLS = [
  "#d8dde6",
  "#c3ccd9",
  "#e6dcc8",
  "#cbd8c9",
  "#d9c9d2",
  "#c8d4de",
  "#e0d3bd",
  "#bfc9d4",
];
const TRIMS = ["#8f97a4", "#a8b0bd", "#9aa79a", "#b0a08f", "#93a2b0"];
const GLASS = ["#8fdcff", "#ffe08a", "#a8f0d0", "#cbb6ff", "#ffc9a8"];
const ROOF_SIGNS = [
  "DEX",
  "PUMP",
  "HODL",
  "MOON",
  "SOL",
  "BAGS",
  "APE",
  "GM",
  "WAGMI",
  "LFG",
];

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
  park: boolean;
}

/**
 * Lay out a street grid and drop a building into each lot, leaving the centre
 * (the authored playable block) clear.
 */
function planCity(opts: Required<Omit<CityFillProps, "lite">>): Lot[] {
  const { innerRadius, outerRadius, lotSize, seed } = opts;
  const rand = mulberry32(hashSeed(seed));
  const lots: Lot[] = [];
  const road = 9;
  const pitch = lotSize + road;
  const steps = Math.floor(outerRadius / pitch);

  for (let ix = -steps; ix <= steps; ix += 1) {
    for (let iz = -steps; iz <= steps; iz += 1) {
      const cx = ix * pitch;
      const cz = iz * pitch;

      // Keep the authored centre and its approach streets clear.
      if (Math.abs(cx) < innerRadius && Math.abs(cz) < innerRadius) continue;

      const dist = Math.hypot(cx, cz);
      if (dist > outerRadius) continue;

      // Occasional empty lot keeps the grid from looking stamped.
      const roll = rand();
      if (roll < 0.06) continue;

      const park = roll < 0.14;

      // Height falls off toward the edge of the city — downtown core effect.
      const falloff = 1 - Math.min(1, dist / outerRadius);
      const base = 2 + falloff * 9;
      const floors = Math.max(1, Math.round(base + (rand() - 0.5) * 5));

      const w = lotSize * (0.62 + rand() * 0.3);
      const d = lotSize * (0.62 + rand() * 0.3);

      const kind: BlockKind =
        floors >= 9 ? "tower" : floors <= 2 ? "shop" : "midrise";

      lots.push({
        x: cx + (rand() - 0.5) * 2.5,
        z: cz + (rand() - 0.5) * 2.5,
        w,
        d,
        floors,
        kind,
        color: WALLS[Math.floor(rand() * WALLS.length)]!,
        trim: TRIMS[Math.floor(rand() * TRIMS.length)]!,
        glass: GLASS[Math.floor(rand() * GLASS.length)]!,
        rot: (rand() - 0.5) * 0.04,
        sign:
          floors >= 7 && rand() < 0.3
            ? ROOF_SIGNS[Math.floor(rand() * ROOF_SIGNS.length)]
            : undefined,
        park,
      });
    }
  }

  return lots;
}

/** Simple park plot: grass pad, a few trees, a bench block. */
function ParkLot({ lot }: { lot: Lot }) {
  const rand = useMemo(
    () => mulberry32(hashSeed(`${lot.x}:${lot.z}:park`)),
    [lot.x, lot.z],
  );
  const trees = useMemo(() => {
    const out: [number, number, number][] = [];
    const n = 2 + Math.floor(rand() * 4);
    for (let i = 0; i < n; i += 1) {
      out.push([
        (rand() - 0.5) * lot.w * 0.8,
        0,
        (rand() - 0.5) * lot.d * 0.8,
      ]);
    }
    return out;
  }, [rand, lot.w, lot.d]);

  return (
    <group position={[lot.x, 0, lot.z]}>
      <mesh position={[0, 0.12, 0]} receiveShadow>
        <boxGeometry args={[lot.w, 0.24, lot.d]} />
        <meshStandardMaterial color="#7fbf6a" roughness={0.95} flatShading />
      </mesh>
      {trees.map((p, i) => (
        <group key={i} position={[p[0], 0.24, p[2]]}>
          <mesh position={[0, 0.9, 0]} castShadow>
            <boxGeometry args={[0.42, 1.8, 0.42]} />
            <meshStandardMaterial color="#7a5638" roughness={0.9} flatShading />
          </mesh>
          <mesh position={[0, 2.5, 0]} castShadow>
            <boxGeometry args={[2.4, 2.2, 2.4]} />
            <meshStandardMaterial color="#4f9e4a" roughness={0.9} flatShading />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Street lamp — a post and an emissive head, repeated along the grid. */
function StreetLamp({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 2.2, 0]} castShadow>
        <boxGeometry args={[0.22, 4.4, 0.22]} />
        <meshStandardMaterial color="#4a5260" roughness={0.85} flatShading />
      </mesh>
      <mesh position={[0, 4.5, 0]}>
        <boxGeometry args={[0.8, 0.24, 0.8]} />
        <meshStandardMaterial
          color="#fff3c4"
          emissive="#ffe9a8"
          emissiveIntensity={0.9}
          flatShading
        />
      </mesh>
    </group>
  );
}

export function CityFill({
  innerRadius = 78,
  outerRadius = 250,
  lotSize = 20,
  seed = "orbitx-nyc",
  lite = false,
}: CityFillProps) {
  const lots = useMemo(
    () => planCity({ innerRadius, outerRadius, lotSize, seed }),
    [innerRadius, outerRadius, lotSize, seed],
  );

  const lamps = useMemo(() => {
    if (lite) return [];
    const out: [number, number, number][] = [];
    const pitch = (lotSize + 9) * 2;
    const steps = Math.floor(outerRadius / pitch);
    for (let ix = -steps; ix <= steps; ix += 1) {
      for (let iz = -steps; iz <= steps; iz += 1) {
        const x = ix * pitch + pitch / 2;
        const z = iz * pitch + pitch / 2;
        if (Math.abs(x) < innerRadius && Math.abs(z) < innerRadius) continue;
        if (Math.hypot(x, z) > outerRadius) continue;
        out.push([x, 0, z]);
      }
    }
    return out;
  }, [lite, lotSize, outerRadius, innerRadius]);

  // In lite mode drop the far ring entirely rather than shrinking every lot.
  const visible = lite
    ? lots.filter((l) => Math.hypot(l.x, l.z) < outerRadius * 0.6)
    : lots;

  return (
    <group name="oxc-city-fill">
      {visible.map((lot, i) =>
        lot.park ? (
          <ParkLot key={i} lot={lot} />
        ) : (
          <BlockBuilding
            key={i}
            position={[lot.x, 0, lot.z]}
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
        ),
      )}
      {lamps.map((p, i) => (
        <StreetLamp key={i} position={p} />
      ))}
    </group>
  );
}
