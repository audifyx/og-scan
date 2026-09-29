/**
 * ORBITXCITY sports — venue geometry builders.
 *
 * Every sport builds its venue from these primitives at coordinates
 * documented here. Integrator: snap `VENUE_POSITIONS` to real city
 * geometry via {@link VenueAnchors} (see types.ts) if the procedural
 * layout drifts from these defaults.
 */
import * as THREE from "three";
import type { VenueAnchors } from "./types";

export interface VenuePositions {
  skatePlaza: THREE.Vector3;
  gymArena: THREE.Vector3;
  dojoHall: THREE.Vector3;
  surfBeach: THREE.Vector3;
  pier: THREE.Vector3;
  golfCourse: THREE.Vector3;
  towerTop: THREE.Vector3;
  towerBase: THREE.Vector3;
  parkourStart: THREE.Vector3[];
}

export const VENUE_POSITIONS: VenuePositions = {
  skatePlaza: new THREE.Vector3(120, 0, -140),
  gymArena: new THREE.Vector3(200, 0, 60),
  dojoHall: new THREE.Vector3(212, 0, 96),
  surfBeach: new THREE.Vector3(-190, 0, 40),
  pier: new THREE.Vector3(-196, 0, 20),
  golfCourse: new THREE.Vector3(-60, 0, 220),
  towerTop: new THREE.Vector3(40, 118, -40),
  towerBase: new THREE.Vector3(40, 0, -40),
  parkourStart: [
    new THREE.Vector3(-40, 24, -60),
    new THREE.Vector3(80, 30, 40),
    new THREE.Vector3(-120, 36, 120),
  ],
};

/** Apply integrator overrides onto a copy of the defaults. */
export function resolveVenues(anchors?: VenueAnchors): VenuePositions {
  const v: VenuePositions = {
    ...VENUE_POSITIONS,
    skatePlaza: VENUE_POSITIONS.skatePlaza.clone(),
    gymArena: VENUE_POSITIONS.gymArena.clone(),
    dojoHall: VENUE_POSITIONS.dojoHall.clone(),
    surfBeach: VENUE_POSITIONS.surfBeach.clone(),
    pier: VENUE_POSITIONS.pier.clone(),
    golfCourse: VENUE_POSITIONS.golfCourse.clone(),
    towerTop: VENUE_POSITIONS.towerTop.clone(),
    towerBase: VENUE_POSITIONS.towerBase.clone(),
    parkourStart: VENUE_POSITIONS.parkourStart.map((p) => p.clone()),
  };
  if (!anchors) return v;
  if (anchors.towerTop) {
    v.towerTop.copy(anchors.towerTop);
    v.towerBase.set(anchors.towerTop.x, 0, anchors.towerTop.z);
  }
  if (anchors.shorelineX !== undefined) {
    v.surfBeach.x = anchors.shorelineX + 6;
    v.pier.x = anchors.shorelineX - 4;
  }
  if (anchors.skatePlaza) v.skatePlaza.copy(anchors.skatePlaza);
  if (anchors.rooftops && anchors.rooftops.length >= 3) {
    v.parkourStart = anchors.rooftops.slice(0, 3).map((p) => p.clone());
  }
  return v;
}

// ---------------------------------------------------------------- helpers

export function mat(color: number, opts: { rough?: number; metal?: number; emissive?: number } = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.rough ?? 0.85,
    metalness: opts.metal ?? 0.05,
    emissive: opts.emissive ?? 0x000000,
  });
}

export function box(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

export function ramp(width: number, height: number, depth: number, color: number): THREE.Mesh {
  // wedge via extruded triangle
  const shape = new THREE.Shape();
  shape.moveTo(0, 0); shape.lineTo(depth, 0); shape.lineTo(depth, height); shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
  geo.rotateY(-Math.PI / 2);
  const m = new THREE.Mesh(geo, mat(color));
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

export function rail(length: number, color = 0xb8c0cc): THREE.Group {
  const g = new THREE.Group();
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, length, 10), mat(color, { metal: 0.9, rough: 0.3 }));
  bar.rotation.z = Math.PI / 2;
  bar.position.y = 0.9;
  g.add(bar);
  for (const x of [-length / 2 + 0.3, length / 2 - 0.3]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 8), mat(0x555c66, { metal: 0.7 }));
    leg.position.set(x, 0.45, 0);
    g.add(leg);
  }
  return g;
}

export function ringMesh(radius: number, color = 0x22d3ee): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.22, 10, 40),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 })
  );
  return m;
}

export function labelSprite(text: string, opts: { size?: number; color?: string } = {}): THREE.Sprite {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "rgba(8,10,16,0.72)";
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = opts.color ?? "#22d3ee";
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, 504, 120);
  ctx.fillStyle = opts.color ?? "#ffffff";
  ctx.font = "bold 52px system-ui, sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 66);
  const tex = new THREE.CanvasTexture(c);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  spr.scale.set(opts.size ?? 10, (opts.size ?? 10) / 4, 1);
  return spr;
}

/** Simple low-poly "token tower" prop (also the base-jump/wingsuit launch). */
export function buildTokenTower(top: THREE.Vector3, base: THREE.Vector3): THREE.Group {
  const g = new THREE.Group();
  const h = Math.max(10, top.y - base.y);
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(10, h, 10), mat(0x1b2432));
  shaft.position.set(base.x, base.y + h / 2, base.z);
  g.add(shaft);
  // glowing edge strips
  for (const [sx, sz] of [[-5.1, -5.1], [5.1, -5.1], [-5.1, 5.1], [5.1, 5.1]] as const) {
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, h, 0.35),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee })
    );
    strip.position.set(base.x + sx, base.y + h / 2, base.z + sz);
    g.add(strip);
  }
  // launch deck
  const deck = box(16, 1.2, 16, 0x2a3446, base.x, base.y + h + 0.6, base.z);
  g.add(deck);
  const railH = 1.1;
  for (const [w, d, x, z] of [[16, 0.2, 0, -7.9], [16, 0.2, 0, 7.9], [0.2, 16, -7.9, 0], [0.2, 16, 7.9, 0]] as const) {
    g.add(box(w, railH, d, 0x22d3ee, base.x + x, base.y + h + 1.2 + railH / 2, base.z + z));
  }
  const label = labelSprite("ORBITX TOWER", { size: 14 });
  label.position.set(base.x, base.y + h + 6, base.z);
  g.add(label);
  return g;
}

/** Flat marker disc for landing zones / spawn points. */
export function zoneDisc(radius: number, color: number): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 40),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
  );
  m.rotation.x = -Math.PI / 2;
  return m;
}
