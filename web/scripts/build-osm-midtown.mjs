/**
 * Convert OpenStreetMap Midtown building footprints into an OrbitX City block.
 * Source: OpenStreetMap contributors (ODbL).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const osmPath = path.join(root, "src/lib/orbitxcity/worlds/osm/midtown-buildings.json");
const outPath = path.join(root, "src/lib/orbitxcity/worlds/nycOsmBlock.ts");

const ORIGIN_LAT = 40.75825;
const ORIGIN_LON = -73.98525;
const METERS_PER_DEG_LAT = 110540;
const METERS_PER_DEG_LON = 111320 * Math.cos((ORIGIN_LAT * Math.PI) / 180);
/** Scale real meters into playable city units (~1 unit ≈ 3.2 m). */
const WORLD_SCALE = 1 / 3.2;

function project(lat, lon) {
  const x = (lon - ORIGIN_LON) * METERS_PER_DEG_LON * WORLD_SCALE;
  const z = -(lat - ORIGIN_LAT) * METERS_PER_DEG_LAT * WORLD_SCALE;
  return { x, z };
}

function hashHue(id) {
  let h = 2166136261;
  const s = String(id);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function heightFromTags(tags = {}) {
  if (tags["building:levels"]) {
    const levels = Number(tags["building:levels"]);
    if (Number.isFinite(levels) && levels > 0) return Math.min(48, Math.max(6, levels * 3.1));
  }
  if (tags.ele) {
    const ele = Number(tags.ele);
    if (Number.isFinite(ele) && ele > 0) return Math.min(48, Math.max(6, ele * 0.55));
  }
  if (tags.tourism === "hotel") return 22;
  if (tags.building === "commercial" || tags.building === "office") return 18;
  if (tags.building === "retail" || tags.shop) return 9;
  return 12 + (hashHue(tags.name || tags["addr:housenumber"] || "b") % 10);
}

function kindFromTags(tags = {}, name = "") {
  const n = name.toLowerCase();
  if (tags.tourism === "hotel" || n.includes("hotel")) return "generic";
  if (n.includes("theater") || n.includes("theatre") || n.includes("cinema")) return "generic";
  if (tags.amenity === "theatre" || tags.amenity === "cinema") return "generic";
  if (tags.shop || tags.building === "retail") return "shop";
  if (tags.office || tags.building === "office" || tags.building === "commercial") return "trading_floor";
  return "generic";
}

function accentFor(kind, seed) {
  const accents = ["#17ff4d", "#3de7ff", "#f5c542", "#ff4d9a", "#a78bfa", "#c5a26f"];
  if (kind === "hq") return "#17ff4d";
  if (kind === "market" || kind === "shop") return "#ff4d9a";
  if (kind === "trading_floor") return "#3de7ff";
  if (kind === "launch_arena") return "#f5c542";
  return accents[seed % accents.length];
}

function colorFor(seed) {
  const colors = ["#1b2433", "#242b35", "#1f2c38", "#2a2434", "#23302c", "#302820"];
  return colors[seed % colors.length];
}

function simplifyRing(points, maxPts = 24) {
  if (points.length <= maxPts) return points;
  const step = Math.ceil(points.length / maxPts);
  const out = [];
  for (let i = 0; i < points.length; i += step) out.push(points[i]);
  if (out[0] !== out[out.length - 1]) {
    // keep open ring; renderer closes
  }
  // drop closing duplicate if present
  if (
    out.length > 2 &&
    Math.hypot(out[0].x - out[out.length - 1].x, out[0].z - out[out.length - 1].z) < 0.05
  ) {
    out.pop();
  }
  return out;
}

const raw = JSON.parse(fs.readFileSync(osmPath, "utf8"));
const buildings = [];

for (const el of raw.elements || []) {
  if (el.type !== "way" || !el.geometry?.length) continue;
  const tags = el.tags || {};
  const pts = el.geometry.map((g) => project(g.lat, g.lon));
  if (pts.length < 3) continue;

  let minX = Infinity,
    maxX = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
  const width = maxX - minX;
  const depth = maxZ - minZ;
  if (width < 1.2 || depth < 1.2) continue;
  if (width > 80 || depth > 80) continue;

  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const footprint = simplifyRing(
    pts.map((p) => ({ x: +(p.x - cx).toFixed(3), z: +(p.z - cz).toFixed(3) })),
  );
  const name =
    tags.name ||
    tags.alt_name ||
    (tags["addr:housenumber"] && tags["addr:street"]
      ? `${tags["addr:housenumber"]} ${tags["addr:street"]}`
      : `Building ${el.id}`);
  const seed = hashHue(el.id);
  const kind = kindFromTags(tags, name);
  const height = +(heightFromTags(tags) * WORLD_SCALE * 1.15).toFixed(2);

  buildings.push({
    id: `osm-${el.id}`,
    districtId: "midtown",
    kind,
    name,
    position: { x: +cx.toFixed(2), y: 0, z: +cz.toFixed(2) },
    size: {
      width: +Math.max(3.5, width).toFixed(2),
      height: +Math.max(5.5, height).toFixed(2),
      depth: +Math.max(3.5, depth).toFixed(2),
    },
    color: colorFor(seed),
    accent: accentFor(kind, seed),
    label: (tags.name || tags["addr:housenumber"] || "BLDG").toString().slice(0, 18).toUpperCase(),
    footprint,
    osmId: el.id,
    address: [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ") || undefined,
  });
}

// Keep the densest / named landmarks first, then fill with remaining footprint mass.
buildings.sort((a, b) => {
  const an = a.name.startsWith("Building ") ? 0 : 1;
  const bn = b.name.startsWith("Building ") ? 0 : 1;
  if (an !== bn) return bn - an;
  return b.size.width * b.size.depth - a.size.width * a.size.depth;
});
const keep = buildings.slice(0, 48);

// Assign OrbitX venue roles to a few real landmarks so gameplay remains intact.
const venuePlan = [
  { match: /bertelsmann|1540 broadway/i, kind: "hq", interaction: "hq", label: "HQ", accent: "#17ff4d" },
  { match: /edison/i, kind: "generic", interaction: "community", label: "HOTEL", accent: "#3de7ff" },
  { match: /astor|viacom|1515 broadway/i, kind: "trading_floor", interaction: "trading", label: "TRADE", accent: "#3de7ff" },
  { match: /paramount|1501 broadway/i, matchAlt: /paramount/i, kind: "launch_arena", interaction: "launch", label: "LAUNCH", accent: "#f5c542" },
  { match: /palace|theater|theatre|cinema|broadway theatre/i, kind: "generic", interaction: "games", label: "THEATER", accent: "#a78bfa" },
  { match: /bank|chase|citibank/i, kind: "market", interaction: "marketplace", label: "BANK", accent: "#17ff4d" },
];

let assigned = 0;
for (const b of keep) {
  const plan = venuePlan.find((p) => p.match.test(b.name) || (p.matchAlt && p.matchAlt.test(b.name)));
  if (!plan) continue;
  b.kind = plan.kind;
  b.interaction = plan.interaction;
  b.label = plan.label;
  b.accent = plan.accent;
  assigned += 1;
}

// Ensure core gameplay buildings exist even if OSM tags missed them.
const ensureRoles = [
  { kind: "hq", interaction: "hq", label: "HQ", accent: "#17ff4d" },
  { kind: "market", interaction: "marketplace", label: "MARKET", accent: "#ff4d9a" },
  { kind: "launch_arena", interaction: "launch", label: "LAUNCH", accent: "#f5c542" },
  { kind: "trading_floor", interaction: "trading", label: "TRADE", accent: "#3de7ff" },
  { kind: "social_hub", interaction: "community", label: "SOCIAL", accent: "#a78bfa" },
  { kind: "generic", interaction: "voice", label: "CLUB", accent: "#ff4d9a" },
];
for (const role of ensureRoles) {
  if (keep.some((b) => b.interaction === role.interaction)) continue;
  const candidate = keep.find((b) => !b.interaction && b.size.width >= 6 && b.size.depth >= 6);
  if (!candidate) continue;
  Object.assign(candidate, role);
}

const xs = keep.flatMap((b) => [b.position.x - b.size.width / 2, b.position.x + b.size.width / 2]);
const zs = keep.flatMap((b) => [b.position.z - b.size.depth / 2, b.position.z + b.size.depth / 2]);
const pad = 8;
const bounds = {
  minX: Math.floor(Math.min(...xs) - pad),
  maxX: Math.ceil(Math.max(...xs) + pad),
  minZ: Math.floor(Math.min(...zs) - pad),
  maxZ: Math.ceil(Math.max(...zs) + pad),
};

// Midtown street grid in the same projected space (approx Broadway / 7th / cross streets).
const streets = [
  { o: "v", at: project(40.7582, -73.9857).x, from: bounds.minZ + 2, to: bounds.maxZ - 2, w: 7, curbA: "#17ff4d", curbB: "#3de7ff" },
  { o: "v", at: project(40.7582, -73.9844).x, from: bounds.minZ + 2, to: bounds.maxZ - 2, w: 6, curbA: "#f5c542", curbB: "#ff4d9a" },
  { o: "h", at: project(40.7574, -73.9852).z, from: bounds.minX + 2, to: bounds.maxX - 2, w: 6, curbA: "#3de7ff", curbB: "#a78bfa" },
  { o: "h", at: project(40.7582, -73.9852).z, from: bounds.minX + 2, to: bounds.maxX - 2, w: 6, curbA: "#ff4d9a", curbB: "#17ff4d" },
  { o: "h", at: project(40.7590, -73.9852).z, from: bounds.minX + 2, to: bounds.maxX - 2, w: 6, curbA: "#a78bfa", curbB: "#3de7ff" },
].map((s) => ({
  ...s,
  at: +s.at.toFixed(2),
  from: +s.from.toFixed(2),
  to: +s.to.toFixed(2),
}));

function collidesBuilding(x, z, pad = 2.4) {
  for (const b of keep) {
    const minX = b.position.x - b.size.width / 2 - pad;
    const maxX = b.position.x + b.size.width / 2 + pad;
    const minZ = b.position.z - b.size.depth / 2 - pad;
    const maxZ = b.position.z + b.size.depth / 2 + pad;
    if (x > minX && x < maxX && z > minZ && z < maxZ) return b;
  }
  return null;
}

function findClearPoint(preferred, pad = 2.4) {
  if (!collidesBuilding(preferred.x, preferred.z, pad)) {
    return { x: +preferred.x.toFixed(2), y: 0, z: +preferred.z.toFixed(2) };
  }
  for (let r = 3; r <= 55; r += 1.5) {
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
      const x = preferred.x + Math.cos(a) * r;
      const z = preferred.z + Math.sin(a) * r;
      if (!collidesBuilding(x, z, pad)) {
        return { x: +x.toFixed(2), y: 0, z: +z.toFixed(2) };
      }
    }
  }
  return { x: +preferred.x.toFixed(2), y: 0, z: +preferred.z.toFixed(2) };
}

const zones = keep
  .filter((b) => b.interaction)
  .map((b) => {
    const clear = findClearPoint(
      {
        x: b.position.x,
        z: b.position.z + b.size.depth / 2 + 2.2,
      },
      1.2,
    );
    return {
      id: `z-${b.id}`,
      kind: b.interaction,
      label: b.name,
      hint: `Enter ${b.name}`,
      position: {
        x: clear.x,
        y: 0,
        z: clear.z,
      },
      radius: Math.max(3.2, Math.min(5.5, Math.min(b.size.width, b.size.depth) * 0.35)),
      buildingId: b.id,
    };
  });

// Prefer Duffy Square / TKTS triangle (open plaza north of 47th).
const plaza = project(40.7589, -73.9855);
const spawn = findClearPoint({ x: plaza.x, z: plaza.z }, 2.6);

const teleports = [
  {
    id: "times",
    label: "Times Square Core",
    x: spawn.x,
    z: spawn.z,
    accent: "#17ff4d",
  },
  ...keep
    .filter((b) => b.interaction)
    .slice(0, 8)
    .map((b) => {
      const clear = findClearPoint(
        {
          x: b.position.x,
          z: b.position.z + b.size.depth / 2 + 2.5,
        },
        1.5,
      );
      return {
        id: b.id,
        label: b.label || b.name.slice(0, 18),
        x: clear.x,
        z: clear.z,
        accent: b.accent,
      };
    }),
];

function serialize(obj, indent = 2) {
  return JSON.stringify(obj, null, indent)
    .replace(/"([^"]+)":/g, "$1:")
    .replace(/"/g, '"');
}

const ts = `import type { StreetSegment, WorldBlockConfig } from "../types";

/**
 * OrbitX NYC · Real Midtown district.
 * Building footprints projected from OpenStreetMap (© OpenStreetMap contributors, ODbL).
 * Generated by web/scripts/build-osm-midtown.mjs — do not hand-edit footprints.
 */

export const NYC_OSM_STREETS: StreetSegment[] = ${serialize(streets)};

export const NYC_OSM_TELEPORT_POINTS = ${serialize(teleports)} as const;

export const NYC_OSM_BLOCK: WorldBlockConfig = {
  cityId: "nyc",
  name: "OrbitX City · Midtown NYC (OSM)",
  spawn: ${serialize(spawn)},
  bounds: ${serialize(bounds)},
  districts: [
    {
      id: "midtown",
      cityId: "nyc",
      kind: "hq",
      name: "Times Square Midtown",
      description: "Real OpenStreetMap footprints around Broadway / W 47th.",
      center: { x: 0, y: 0, z: 0 },
      size: { width: ${bounds.maxX - bounds.minX}, depth: ${bounds.maxZ - bounds.minZ} },
    },
  ],
  buildings: ${serialize(
    keep.map(({ osmId, address, ...rest }) => rest),
  )},
  billboards: [
    {
      id: "bb-osm-orbitx",
      position: { x: -6, y: 5.2, z: 2 },
      rotationY: 0.35,
      width: 5.8,
      height: 3.1,
      title: "ORBITX",
      subtitle: "Real Midtown · live markets",
      accent: "#17ff4d",
      projectName: "OrbitX",
      website: "https://orbitx.world",
    },
    {
      id: "bb-osm-broadway",
      position: { x: 7, y: 5, z: -3 },
      rotationY: -0.45,
      width: 5.4,
      height: 2.9,
      title: "BROADWAY",
      subtitle: "OSM footprints · walk-in venues",
      accent: "#3de7ff",
      projectName: "Midtown NYC",
    },
  ],
  zones: ${serialize(zones)},
};

export const OSM_ATTRIBUTION =
  "Map data © OpenStreetMap contributors (ODbL). Midtown NYC footprints.";
`;

fs.writeFileSync(outPath, ts, "utf8");
console.log(
  JSON.stringify(
    {
      buildings: keep.length,
      zones: zones.length,
      assignedVenues: keep.filter((b) => b.interaction).length,
      spawn,
      spawnClear: !collidesBuilding(spawn.x, spawn.z, 2.6),
      bounds,
      out: path.relative(root, outPath),
    },
    null,
    2,
  ),
);
