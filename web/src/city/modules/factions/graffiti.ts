/**
 * ORBITXCITY — Factions module: graffiti crews, walls, buffs, graffiti wars.
 *
 * Crews tag firm logos on walls around the city (paper CITY cost).
 * Holding walls gives the whole faction a buff; graffiti wars are
 * crew-vs-crew tag-offs judged by the city (deterministic scoring,
 * same verdict for every client).
 */
import * as THREE from "three";
import type { FactionId, GraffitiTag, GraffitiWall, GraffitiWar } from "./types";
import { FACTIONS } from "./factions";

export const TAG_COST = 25; // paper CITY per tag
export const OVERPAINT_COST = 40; // paper CITY to steal a wall
export const WALL_BUFF_PCT = 0.02; // +2% paper earnings per wall held
export const MAX_WALL_BUFF = 0.1; // cap at +10%

/**
 * Wall placements across the districts. pos is world meters; rotY faces the
 * wall outward. Integrator mounts a plane mesh per wall via makeWallDecal().
 */
export function buildWalls(): GraffitiWall[] {
  const defs: Array<{
    id: string;
    name: string;
    districtId: string;
    pos: [number, number, number, number];
  }> = [
    { id: "w-fdry-1", name: "Foundry Furnace", districtId: "foundry", pos: [18, 2.2, -96, Math.PI / 2] },
    { id: "w-fdry-2", name: "Iron Mile", districtId: "foundry", pos: [-60, 2.2, -18, 0] },
    { id: "w-dock-1", name: "Container Yard", districtId: "docks", pos: [-118, 2.4, 40, -Math.PI / 2] },
    { id: "w-old-1", name: "Bodega Back", districtId: "old-town", pos: [-118, 2.2, -118, Math.PI] },
    { id: "w-old-2", name: "Laundry Line", districtId: "old-town", pos: [-40, 2.2, -157, 0] },
    { id: "w-sky-1", name: "Rooftop Access", districtId: "skyline", pos: [118, 2.6, -118, Math.PI / 2] },
    { id: "w-sky-2", name: "Garage Level B2", districtId: "skyline", pos: [40, 2.2, -157, 0] },
    { id: "w-mir-1", name: "Casino Service Rd", districtId: "mirage", pos: [118, 2.2, 118, -Math.PI / 2] },
    { id: "w-mir-2", name: "Arcade Alley", districtId: "mirage", pos: [40, 2.2, 157, Math.PI] },
  ];
  return defs.map((d) => ({
    id: d.id,
    name: d.name,
    districtId: d.districtId,
    pos: { x: d.pos[0], y: d.pos[1], z: d.pos[2], rotY: d.pos[3] },
    width: 7,
    height: 3.4,
    heldBy: null,
    tagCount: 0,
    style: 0,
  }));
}

/** Style points a tag adds: base + rep weight. */
export function tagStyle(playerRep: number): number {
  return 10 + Math.floor(Math.min(playerRep, 3000) / 100);
}

export function tagWall(
  wall: GraffitiWall,
  factionId: FactionId,
  painter: string,
  playerRep: number,
  tagId: string
): { wall: GraffitiWall; tag: GraffitiTag; cost: number; stolen: boolean } {
  const stolen = wall.heldBy !== null && wall.heldBy !== factionId;
  const cost = stolen ? OVERPAINT_COST : TAG_COST;
  const style = tagStyle(playerRep);
  const tag: GraffitiTag = {
    id: tagId,
    wallId: wall.id,
    factionId,
    painter,
    createdAt: Date.now(),
    style,
    overpainted: false,
  };
  const w: GraffitiWall = {
    ...wall,
    heldBy: factionId,
    tagCount: wall.tagCount + 1,
    style: (stolen ? 0 : wall.style) + style,
  };
  return { wall: w, tag, cost, stolen };
}

/** Mark older tags on the wall as overpainted when a rival takes it. */
export function overpaintTags(tags: GraffitiTag[], wallId: string, by: FactionId): GraffitiTag[] {
  return tags.map((t) =>
    t.wallId === wallId && t.factionId !== by ? { ...t, overpainted: true } : t
  );
}

/** Faction-wide buff from walls held: +2% paper earnings each, capped +10%. */
export function wallBuffPct(factionId: FactionId, walls: GraffitiWall[]): number {
  const held = walls.filter((w) => w.heldBy === factionId).length;
  return Math.min(held * WALL_BUFF_PCT, MAX_WALL_BUFF);
}

/* ------------------------------ graffiti wars --------------------------- */

/**
 * Challenge a rival crew to a tag-off on a wall. Both crews pay into the
 * pot; battle runs `durationSec` once started; tags land via addWarTag().
 */
export function challengeCrew(
  wall: GraffitiWall,
  crewA: FactionId,
  crewB: FactionId,
  pot: number,
  id: string,
  durationSec = 60
): GraffitiWar {
  return {
    id,
    wallId: wall.id,
    crewA,
    crewB,
    pot: Math.max(0, Math.floor(pot)),
    durationSec,
    startedAt: null,
    status: "challenge",
    tagsA: 0,
    tagsB: 0,
  };
}

export function startWar(war: GraffitiWar): GraffitiWar {
  if (war.status !== "challenge") return war;
  return { ...war, status: "live", startedAt: Date.now() };
}

/** Register tags during a live war. styleAvg: crew's average style/10. */
export function addWarTag(
  war: GraffitiWar,
  crew: FactionId,
  stylePoints: number
): GraffitiWar {
  if (war.status !== "live") return war;
  const w = { ...war };
  if (crew === war.crewA) w.tagsA += stylePoints;
  else if (crew === war.crewB) w.tagsB += stylePoints;
  // auto-close when the clock runs out
  if (war.startedAt && Date.now() - war.startedAt >= war.durationSec * 1000) {
    return judgeWar(w);
  }
  return w;
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * The city judges: deterministic score from tags + a seeded style bonus.
 * Same inputs → same verdict on every client. Winner takes the wall + pot.
 */
export function judgeWar(war: GraffitiWar): GraffitiWar {
  if (war.status === "judged") return war;
  const seed = hashStr(war.id);
  const bonusA = (seed % 100) / 100; // 0..0.99 style bonus
  const bonusB = ((seed >> 8) % 100) / 100;
  const scoreA = war.tagsA * (1 + bonusA);
  const scoreB = war.tagsB * (1 + bonusB);
  const winner = scoreA === scoreB ? null : scoreA > scoreB ? war.crewA : war.crewB;
  return {
    ...war,
    status: "judged",
    winner: winner ?? undefined,
    judgeNote: winner
      ? `The city felt ${winner}'s piece harder — ${scoreA.toFixed(1)} vs ${scoreB.toFixed(1)} style.`
      : `Dead heat at ${scoreA.toFixed(1)} style each. The wall stays neutral.`,
  };
}

/* ------------------------------ 3D helpers ------------------------------ */

/**
 * Build a graffiti tag decal mesh for a faction logo on a wall.
 * Self-contained: uses three directly, places nothing in the world —
 * the integrator adds the returned mesh to core's scene at wall.pos.
 */
export function makeTagDecal(
  factionId: FactionId,
  opts: { width?: number; height?: number; opacity?: number } = {}
): THREE.Mesh {
  const f = FACTIONS[factionId];
  const w = opts.width ?? 7;
  const h = opts.height ?? 3.4;
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  // spray-paint background wash
  const grad = ctx.createLinearGradient(0, 0, 512, 256);
  grad.addColorStop(0, f.color);
  grad.addColorStop(1, f.accent);
  ctx.fillStyle = "rgba(10,10,14,0.72)";
  ctx.fillRect(0, 0, 512, 256);
  ctx.globalAlpha = 0.9;
  // drips
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 256;
    ctx.fillStyle = Math.random() > 0.5 ? f.color : f.accent;
    ctx.beginPath();
    ctx.arc(x, y, 2 + Math.random() * 6, 0, Math.PI * 2);
    ctx.fill();
  }
  // logo mark
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#fff";
  ctx.font = "bold 120px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(f.short, 256, 108);
  ctx.font = "bold 28px sans-serif";
  ctx.fillText(f.name.toUpperCase(), 256, 196);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: opts.opacity ?? 0.95,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  mesh.renderOrder = 2;
  return mesh;
}

/** Blank-slate decal (wall returned to neutral). */
export function makeBlankDecal(opts: { width?: number; height?: number } = {}): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(opts.width ?? 7, opts.height ?? 3.4),
    new THREE.MeshBasicMaterial({ color: 0x1a1a22, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
  );
  mesh.renderOrder = 1;
  return mesh;
}

/**
 * Positioned wall decal for a wall record: faction logo when held,
 * blank concrete when neutral. Integrator usage:
 *
 *   import { placeWallDecal } from "@/city/modules/factions";
 *   const decal = placeWallDecal(wall);
 *   scene.add(decal);                       // position + rotation applied
 *   // on state change: remove old, add new, dispose geometry/material
 *
 * Additive scene work only — never touched by the core game loop.
 */
export function placeWallDecal(wall: GraffitiWall): THREE.Mesh {
  const mesh = wall.heldBy
    ? makeTagDecal(wall.heldBy, { width: wall.width, height: wall.height })
    : makeBlankDecal({ width: wall.width, height: wall.height });
  mesh.position.set(wall.pos.x, wall.pos.y, wall.pos.z);
  mesh.rotation.y = wall.pos.rotY;
  mesh.userData.factionWallId = wall.id;
  return mesh;
}
