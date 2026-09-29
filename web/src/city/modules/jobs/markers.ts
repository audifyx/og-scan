/**
 * Three.js prop helpers for jobs: beacons, peds, simple vehicles, labels.
 * Everything created here must be disposed via the returned cleanup fn.
 */
import * as THREE from "three";
import { createHumanoid, type Humanoid } from "../../core";

export interface Beacon {
  group: THREE.Group;
  setPos: (x: number, z: number) => void;
  /** call every frame */
  update: (dt: number) => void;
  dispose: () => void;
}

export function makeBeacon(color = 0x00ff9f, radius = 3): Beacon {
  const group = new THREE.Group();
  const ringGeo = new THREE.RingGeometry(radius - 0.35, radius, 40);
  const ringMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.12;
  group.add(ring);

  const beamGeo = new THREE.CylinderGeometry(radius * 0.55, radius * 0.55, 30, 20, 1, true);
  const beamMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.14,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.y = 15;
  group.add(beam);

  let t = Math.random() * 10;
  return {
    group,
    setPos: (x, z) => group.position.set(x, 0, z),
    update: (dt) => {
      t += dt;
      const s = 1 + Math.sin(t * 4) * 0.12;
      ring.scale.set(s, s, 1);
      ringMat.opacity = 0.65 + Math.sin(t * 4) * 0.25;
    },
    dispose: () => {
      ringGeo.dispose();
      ringMat.dispose();
      beamGeo.dispose();
      beamMat.dispose();
    },
  };
}

export interface Ped {
  h: Humanoid;
  pos: THREE.Vector3;
  heading: number;
  dispose: () => void;
}

/** Spawn a wandering-capable NPC ped. Caller animates via ped.h.update(dt, speed01). */
export function spawnPed(
  scene: THREE.Scene,
  x: number,
  z: number,
  opts: { shirt?: number; pants?: number; skin?: number; scale?: number } = {},
): Ped {
  const h = createHumanoid(opts);
  h.group.position.set(x, 0, z);
  scene.add(h.group);
  return {
    h,
    pos: h.group.position,
    heading: Math.random() * Math.PI * 2,
    dispose: () => {
      scene.remove(h.group);
      h.dispose();
    },
  };
}

/** Walk a ped toward a target. Returns true when arrived. */
export function walkPedTo(ped: Ped, tx: number, tz: number, dt: number, speed = 2.2): boolean {
  const dx = tx - ped.pos.x;
  const dz = tz - ped.pos.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.6) {
    ped.h.update(dt, 0);
    return true;
  }
  const vx = (dx / d) * speed;
  const vz = (dz / d) * speed;
  ped.pos.x += vx * dt;
  ped.pos.z += vz * dt;
  ped.heading = Math.atan2(vx, vz);
  ped.h.group.rotation.y = ped.heading;
  ped.h.update(dt, Math.min(1, speed / 5));
  return false;
}

/** Make a ped idle (subtle sway) at its position. */
export function idlePed(ped: Ped, dt: number, t: number): void {
  ped.h.group.rotation.y = ped.heading + Math.sin(t * 0.6) * 0.25;
  ped.h.update(dt, 0);
}

/** Simple box truck prop (food truck / repo tow visual). Not drivable. */
export interface PropTruck {
  group: THREE.Group;
  setPos: (x: number, z: number, heading: number) => void;
  dispose: () => void;
}

export function makePropTruck(color = 0xff7a1a, label = "TACOS"): PropTruck {
  const group = new THREE.Group();
  const mats: THREE.Material[] = [];
  const M = (m: THREE.Material) => {
    mats.push(m);
    return m;
  };
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 2.2, 5.2),
    M(new THREE.MeshStandardMaterial({ color, roughness: 0.5 })),
  );
  body.position.y = 1.7;
  body.castShadow = true;
  group.add(body);
  const cab = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 1.4, 1.6),
    M(new THREE.MeshStandardMaterial({ color: 0x22262e, roughness: 0.4 })),
  );
  cab.position.set(0, 1.1, 3.2);
  group.add(cab);
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(2.45, 0.5, 5.25),
    M(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 })),
  );
  stripe.position.y = 2.35;
  group.add(stripe);
  // serving hatch
  const hatch = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 1.0, 0.08),
    M(new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.7 })),
  );
  hatch.position.set(0, 1.9, 2.62);
  group.add(hatch);
  // wheels
  const wg = new THREE.CylinderGeometry(0.45, 0.45, 0.4, 14);
  const wm = M(new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.9 }));
  [
    [-1.1, 1.9],
    [1.1, 1.9],
    [-1.1, -1.9],
    [1.1, -1.9],
  ].forEach(([x, z]) => {
    const w = new THREE.Mesh(wg, wm);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.45, z);
    group.add(w);
  });
  // roof sign
  const sign = makeTextSprite(label, "#ffffff", "#c22");
  sign.position.set(0, 3.4, 0);
  group.add(sign);
  return {
    group,
    setPos: (x, z, heading) => {
      group.position.set(x, 0, z);
      group.rotation.y = heading;
    },
    dispose: () => {
      group.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) {
          (mesh.geometry as THREE.BufferGeometry)?.dispose?.();
        }
      });
      mats.forEach((m) => m.dispose());
      (sign.material as THREE.Material).dispose();
    },
  };
}

/** Floating text sprite (name tags, price tags). */
export function makeTextSprite(
  text: string,
  fg = "#ffffff",
  bg = "rgba(10,12,16,0.85)",
): THREE.Sprite {
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d")!;
  const font = "bold 44px system-ui, sans-serif";
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 40;
  c.width = w;
  c.height = 72;
  const g = c.getContext("2d")!;
  g.fillStyle = bg;
  g.beginPath();
  g.roundRect(0, 0, w, 72, 18);
  g.fill();
  g.font = font;
  g.fillStyle = fg;
  g.textBaseline = "middle";
  g.fillText(text, 20, 38);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  const scale = 0.022;
  sprite.scale.set(w * scale, 72 * scale, 1);
  return sprite;
}

/** Small floating marker diamond used for photo targets etc. */
export function makeDiamond(color = 0xffd23f): THREE.Mesh {
  const geo = new THREE.OctahedronGeometry(0.5);
  const mat = new THREE.MeshBasicMaterial({ color });
  const m = new THREE.Mesh(geo, mat);
  m.position.y = 2.6;
  return m;
}
