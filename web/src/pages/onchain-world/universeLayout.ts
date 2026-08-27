import { isOrbitxMint, ORBITX_MINT } from "../../../shared/orbitx-chain-intel.js";
import type { TokenDistrict } from "./api";

/**
 * The universe is a set of concentric orbital rings around the ORBITX core,
 * not a scatter of separate cluster blobs. Every ring is a tier:
 *
 *        core  ·  ORBITX
 *      ring 1  ·  KOL wallets        (the inner circle)
 *      ring 2  ·  majors
 *      ring 3  ·  established
 *      ring 4  ·  trending
 *      ring 5  ·  new pairs
 *      ring 6  ·  long tail
 *
 * Each ring is inclined on its own axis so the system reads as a solar system
 * seen from an angle rather than a flat dartboard.
 */

export type ClusterId =
  | "orbitx"
  | "majors"
  | "established"
  | "trending"
  | "fresh"
  | "outer";

export type UniverseNode = {
  mint: string;
  cluster: ClusterId;
  pos: [number, number, number];
  radius: number;
  rank: "core" | "planet" | "world" | "moon";
  prominence: number;
  /** Angle on its ring, radians. Lets callers draw orbit trails. */
  theta: number;
};

export type RingMeta = {
  label: string;
  /** Orbit radius from the core. */
  orbit: number;
  /** Inclination of the ring plane, radians. */
  tilt: number;
  /** Rotation of the ring's starting angle, so rings don't line up radially. */
  phase: number;
  /** Half-thickness of the band planets scatter within. */
  band: number;
  color: string;
  /** Anchor point for the ring's floating label. */
  center: [number, number, number];
  /** Retained for the 2D map + beacons, derived from the band. */
  spread: number;
};

/** Where a point sits on an inclined ring. */
export function ringPoint(
  orbit: number,
  tilt: number,
  theta: number,
): [number, number, number] {
  const x = Math.cos(theta) * orbit;
  const z0 = Math.sin(theta) * orbit;
  return [x, -z0 * Math.sin(tilt), z0 * Math.cos(tilt)];
}

function meta(
  label: string,
  orbit: number,
  tilt: number,
  phase: number,
  band: number,
  color: string,
): RingMeta {
  return {
    label,
    orbit,
    tilt,
    phase,
    band,
    color,
    center: ringPoint(orbit, tilt, phase),
    spread: band * 2.6,
  };
}

export const CLUSTER_META: Record<ClusterId, RingMeta> = {
  orbitx: { label: "ORBITX CORE", orbit: 0, tilt: 0, phase: 0, band: 6, color: "#e9d5ff", center: [0, 0, 0], spread: 14 },
  majors: meta("MAJORS", 46, 0.10, 0.0, 4.2, "#fbbf24"),
  established: meta("ESTABLISHED", 68, -0.16, 0.9, 5.0, "#67e8f9"),
  trending: meta("TRENDING", 92, 0.22, 1.9, 5.8, "#34d399"),
  fresh: meta("NEW PAIRS", 116, -0.12, 2.8, 6.4, "#a78bfa"),
  outer: meta("LONG TAIL", 142, 0.18, 3.9, 7.6, "#64748b"),
};

/** The KOL ring is wallets, not tokens, so WorldCanvas places it itself. */
export const KOL_RING = { orbit: 28, tilt: -0.20, phase: 0.5, color: "#e879f9", label: "KOL ORBIT" };

export function kolRingPos(index: number, count: number): [number, number, number] {
  const theta = KOL_RING.phase + (index / Math.max(count, 1)) * Math.PI * 2;
  return ringPoint(KOL_RING.orbit, KOL_RING.tilt, theta);
}

/** Inner to outer. Drives draw order and the legend. */
export const CLUSTER_ORDER: ClusterId[] = [
  "orbitx",
  "majors",
  "established",
  "trending",
  "fresh",
  "outer",
];

export function hashMint(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function classifyToken(token: TokenDistrict): ClusterId {
  if (isOrbitxMint(token.mint)) return "orbitx";
  const cap = token.market_cap || 0;
  const vol = token.volume_24h || 0;
  const chg = Math.abs(token.change_24h || 0);
  const ch1 = Math.abs(token.change_1h || 0);
  if (cap >= 50_000_000 || vol >= 8_000_000) return "majors";
  if (cap >= 1_000_000) return "established";
  // Heavy churn beats newness: a small cap doing real volume is trending, not
  // a fresh pair. This ordering matters — the fresh rule below is broader.
  if (vol >= 250_000) return "trending";
  if (vol >= 80_000 && (ch1 >= 8 || chg >= 25)) return "trending";
  if (vol >= 40_000 && (cap === 0 || cap < 500_000)) return "fresh";
  return "outer";
}

export function planetRadius(token: TokenDistrict, cluster: ClusterId): number {
  if (cluster === "orbitx") return 1.35;
  const cap = token.market_cap || 0;
  const vol = token.volume_24h || 0;
  const score = Math.log10(Math.max(cap, vol, 12));
  // Outer rings sit further from the camera, so their floor is lifted to keep
  // every planet readable instead of shrinking to a speck.
  const floor =
    cluster === "majors" ? 0.95 : cluster === "established" ? 0.74 : cluster === "trending" ? 0.66 : cluster === "fresh" ? 0.62 : 0.58;
  const ceil = cluster === "majors" ? 2.35 : cluster === "established" ? 1.65 : 1.25;
  return Math.min(ceil, floor + score * 0.085);
}

function rankFor(cluster: ClusterId, radius: number): UniverseNode["rank"] {
  if (cluster === "orbitx") return "core";
  if (cluster === "majors" || radius >= 1.5) return "planet";
  if (cluster === "established" || cluster === "trending" || radius >= 0.9) return "world";
  return "moon";
}

function prominenceOf(token: TokenDistrict): number {
  const cap = token.market_cap || token.volume_24h || 12;
  return Math.min(1, Math.log10(Math.max(cap, 12)) / 9);
}

export function layoutUniverse(tokens: TokenDistrict[]): Map<string, UniverseNode> {
  const nodes = new Map<string, UniverseNode>();
  nodes.set(ORBITX_MINT, {
    mint: ORBITX_MINT,
    cluster: "orbitx",
    pos: [0, 0, 0],
    radius: 1.35,
    rank: "core",
    prominence: 1,
    theta: 0,
  });

  const buckets = new Map<ClusterId, TokenDistrict[]>();
  for (const token of tokens) {
    if (!token?.mint || isOrbitxMint(token.mint)) continue;
    const cluster = classifyToken(token);
    const list = buckets.get(cluster) || [];
    list.push(token);
    buckets.set(cluster, list);
  }

  for (const cluster of CLUSTER_ORDER) {
    if (cluster === "orbitx") continue;
    const ring = CLUSTER_META[cluster];
    // Heaviest first, then mint, so the ring order is stable across refreshes
    // and re-ranking never teleports a planet to the far side.
    const list = (buckets.get(cluster) || [])
      .slice()
      .sort((a, b) => prominenceOf(b) - prominenceOf(a) || (a.mint < b.mint ? -1 : 1));
    const count = list.length;

    list.forEach((token, i) => {
      const h = hashMint(token.mint);
      const slot = (i / Math.max(count, 1)) * Math.PI * 2;
      // Jitter under half a slot keeps the circle legible while avoiding the
      // mechanical look of perfectly even spacing.
      const jitter = (((h % 1000) / 1000) - 0.5) * ((Math.PI * 2) / Math.max(count, 1)) * 0.55;
      const theta = ring.phase + slot + jitter;

      const prominence = prominenceOf(token);
      // Bigger names ride slightly inside the band, small caps drift outside.
      const lane = (1 - prominence) * ring.band - ring.band * 0.35;
      const wobble = (((h >>> 9) % 1000) / 1000 - 0.5) * ring.band * 0.7;
      const orbit = ring.orbit + lane + wobble;

      const [x, y, z] = ringPoint(orbit, ring.tilt, theta);
      const lift = (((h >>> 18) % 1000) / 1000 - 0.5) * ring.band * 0.85;
      const size = planetRadius(token, cluster);

      nodes.set(token.mint, {
        mint: token.mint,
        cluster,
        pos: [x, y + lift, z],
        radius: size,
        rank: rankFor(cluster, size),
        prominence,
        theta,
      });
    });
  }
  return nodes;
}

/** Hash-stable fallback used when the district catalog has not loaded yet. */
export function galaxyPos(mint: string, _index = 0, _total = 1): [number, number, number] {
  if (isOrbitxMint(mint)) return [0, 0, 0];
  const h = hashMint(mint);
  const rings = CLUSTER_ORDER.filter((c) => c !== "orbitx");
  const ring = CLUSTER_META[rings[h % rings.length]];
  const theta = ring.phase + (((h >>> 8) % 10_000) / 10_000) * Math.PI * 2;
  const orbit = ring.orbit + (((h >>> 17) % 1000) / 1000 - 0.5) * ring.band * 1.4;
  const [x, y, z] = ringPoint(orbit, ring.tilt, theta);
  return [x, y + (((h >>> 24) % 100) / 100 - 0.5) * ring.band, z];
}

export function layoutBounds(layout: Map<string, UniverseNode>): { cx: number; cz: number; span: number } {
  let minX = -12;
  let maxX = 12;
  let minZ = -12;
  let maxZ = 12;
  for (const node of layout.values()) {
    minX = Math.min(minX, node.pos[0] - node.radius);
    maxX = Math.max(maxX, node.pos[0] + node.radius);
    minZ = Math.min(minZ, node.pos[2] - node.radius);
    maxZ = Math.max(maxZ, node.pos[2] + node.radius);
  }
  // Rings define the outer edge even when a tier is empty, so the 2D map keeps
  // a stable frame instead of snapping as tokens come and go.
  for (const id of CLUSTER_ORDER) {
    const c = CLUSTER_META[id];
    const reach = c.orbit + c.band;
    minX = Math.min(minX, -reach);
    maxX = Math.max(maxX, reach);
    minZ = Math.min(minZ, -reach);
    maxZ = Math.max(maxZ, reach);
  }
  return {
    cx: (minX + maxX) / 2,
    cz: (minZ + maxZ) / 2,
    span: Math.max(maxX - minX, maxZ - minZ, 48),
  };
}

export function projectToMap(
  pos: [number, number, number],
  bounds: { cx: number; cz: number; span: number },
): { x: number; y: number } {
  const span = Math.max(bounds.span, 1);
  return {
    x: 50 + ((pos[0] - bounds.cx) / span) * 84,
    y: 50 + ((pos[2] - bounds.cz) / span) * 84,
  };
}

export function clusterCounts(layout: Map<string, UniverseNode>): Record<ClusterId, number> {
  const out = Object.fromEntries(CLUSTER_ORDER.map((id) => [id, 0])) as Record<ClusterId, number>;
  for (const node of layout.values()) out[node.cluster] += 1;
  return out;
}
