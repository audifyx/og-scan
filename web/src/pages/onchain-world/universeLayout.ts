import { isOrbitxMint, ORBITX_MINT } from "../../../shared/orbitx-chain-intel.js";
import type { TokenDistrict } from "./api";

export type ClusterId =
  | "orbitx"
  | "big_dawgs"
  | "high_cap"
  | "mid_cap"
  | "low_cap"
  | "mini_dawgs"
  | "trending"
  | "active"
  | "dormant";

export type UniverseNode = {
  mint: string;
  cluster: ClusterId;
  pos: [number, number, number];
  radius: number;
  rank: "core" | "planet" | "world" | "moon";
  prominence: number;
};

export const CLUSTER_META: Record<
  ClusterId,
  { label: string; center: [number, number, number]; spread: number; color: string }
> = {
  orbitx: { label: "ORBITX CORE", center: [0, 0, 0], spread: 8, color: "#e9d5ff" },
  big_dawgs: { label: "BIG DAWGS", center: [118, 10, 28], spread: 28, color: "#fbbf24" },
  high_cap: { label: "HIGH CAP", center: [42, 16, 112], spread: 32, color: "#67e8f9" },
  mid_cap: { label: "MID CAP", center: [-98, 8, 64], spread: 34, color: "#a78bfa" },
  low_cap: { label: "LOW CAP", center: [-52, -8, -118], spread: 38, color: "#818cf8" },
  mini_dawgs: { label: "MINI DAWGS", center: [96, -10, -88], spread: 24, color: "#fb7185" },
  trending: { label: "NEW / TRENDING", center: [8, 22, -132], spread: 30, color: "#34d399" },
  active: { label: "HIGHLY ACTIVE", center: [142, 4, 86], spread: 26, color: "#22d3ee" },
  dormant: { label: "DORMANT", center: [-138, -6, 18], spread: 36, color: "#64748b" },
};

export const CLUSTER_ORDER: ClusterId[] = [
  "orbitx",
  "big_dawgs",
  "high_cap",
  "mid_cap",
  "mini_dawgs",
  "active",
  "trending",
  "low_cap",
  "dormant",
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
  if (cap >= 50_000_000 || vol >= 8_000_000) return "big_dawgs";
  if (cap >= 10_000_000) return "high_cap";
  if (cap >= 1_000_000) return "mid_cap";
  if (cap > 0 && cap < 1_000_000 && vol >= 250_000) return "mini_dawgs";
  if (vol >= 80_000 && (ch1 >= 8 || chg >= 25)) return "active";
  if (vol >= 40_000 && (cap === 0 || cap < 500_000)) return "trending";
  if (vol > 0 && vol < 15_000) return "dormant";
  return "low_cap";
}

export function planetRadius(token: TokenDistrict, cluster: ClusterId): number {
  if (cluster === "orbitx") return 1.22;
  const cap = token.market_cap || 0;
  const vol = token.volume_24h || 0;
  const score = Math.log10(Math.max(cap, vol, 12));
  const floor =
    cluster === "big_dawgs" ? 0.62 : cluster === "high_cap" ? 0.48 : cluster === "mid_cap" ? 0.28 : 0.12;
  const ceil = cluster === "big_dawgs" || cluster === "high_cap" ? 2.05 : cluster === "mid_cap" ? 0.85 : 0.42;
  return Math.min(ceil, floor + score * 0.09);
}

function rankFor(cluster: ClusterId, radius: number): UniverseNode["rank"] {
  if (cluster === "orbitx") return "core";
  if (cluster === "big_dawgs" || radius >= 0.85) return "planet";
  if (cluster === "high_cap" || cluster === "mid_cap" || radius >= 0.32) return "world";
  return "moon";
}

export function layoutUniverse(tokens: TokenDistrict[]): Map<string, UniverseNode> {
  const nodes = new Map<string, UniverseNode>();
  nodes.set(ORBITX_MINT, {
    mint: ORBITX_MINT,
    cluster: "orbitx",
    pos: [0, 0, 0],
    radius: 1.22,
    rank: "core",
    prominence: 1,
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
    const list = buckets.get(cluster) || [];
    const meta = CLUSTER_META[cluster];
    list.forEach((token) => {
      const h = hashMint(token.mint);
      const radius = planetRadius(token, cluster);
      const cap = token.market_cap || token.volume_24h || 12;
      const prominence = Math.min(1, Math.log10(Math.max(cap, 12)) / 9);
      const a = ((h % 10_000) / 10_000) * Math.PI * 2;
      const ring = 0.22 + ((h >>> 8) % 10_000) / 10_000 * 0.78;
      const pull = 1 - prominence * 0.55;
      const r = meta.spread * ring * pull;
      const y = meta.center[1] + ((h % 21) - 10) * 0.55;
      nodes.set(token.mint, {
        mint: token.mint,
        cluster,
        pos: [meta.center[0] + Math.cos(a) * r, y, meta.center[2] + Math.sin(a) * r],
        radius,
        rank: rankFor(cluster, radius),
        prominence,
      });
    });
  }
  return nodes;
}

/** Hash-stable fallback used when the district catalog has not loaded yet. */
export function galaxyPos(mint: string, _index = 0, _total = 1): [number, number, number] {
  if (isOrbitxMint(mint)) return [0, 0, 0];
  const h = hashMint(mint);
  const arm = h % 8;
  const t = ((h >>> 8) % 10_000) / 10_000;
  const spiral = t * Math.PI * 4.2 + arm * (Math.PI / 4);
  const r = 18 + t * 96 + ((h >> 4) % 28);
  const y = ((h % 21) - 10) * 1.1;
  return [Math.cos(spiral) * r, y, Math.sin(spiral) * r];
}

export function clusterCounts(layout: Map<string, UniverseNode>): Record<ClusterId, number> {
  const out = Object.fromEntries(CLUSTER_ORDER.map((id) => [id, 0])) as Record<ClusterId, number>;
  for (const node of layout.values()) out[node.cluster] += 1;
  return out;
}
