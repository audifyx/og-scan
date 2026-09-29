import * as THREE from "three";

/**
 * Ambient crowd: procedural pedestrians (realistic-proportioned, built here —
 * no core imports) that wander the sidewalks and FLEE chaos events.
 *
 * Mobile-friendly: pooled meshes, no per-frame allocation, capped count.
 */

const MAX_CROWD = 36;

interface Ped {
  group: THREE.Group;
  parts: { lLeg: THREE.Group; rLeg: THREE.Group; lArm: THREE.Group; rArm: THREE.Group };
  pos: THREE.Vector3;
  dir: number; // heading radians
  speed: number; // m/s
  walkPhase: number;
  fleeUntil: number; // performance.now() ms
  wanderTarget: THREE.Vector3;
  skin: number;
}

function mat(color: number, rough = 0.85): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: rough });
}

function capsule(r: number, len: number, m: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), m);
  mesh.castShadow = false;
  return mesh;
}

function limbPivot(x: number, y: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, 0);
  return g;
}

/** Realistic (non-blocky) humanoid figure — ambient-local builder. */
export function buildFigure(opts: {
  skin?: number; shirt?: number; pants?: number; hair?: number; scale?: number;
} = {}) {
  const skin = opts.skin ?? 0xd9a583;
  const shirt = opts.shirt ?? 0x2a6f5f;
  const pants = opts.pants ?? 0x23262e;
  const hairC = opts.hair ?? 0x1a1410;
  const s = opts.scale ?? 1;
  const group = new THREE.Group();
  const disposables: THREE.BufferGeometry[] = [];

  const mSkin = mat(skin, 0.6), mShirt = mat(shirt), mPants = mat(pants), mHair = mat(hairC, 0.95);

  const hips = new THREE.Group();
  hips.position.y = 0.98 * s;
  group.add(hips);

  const torso = capsule(0.21 * s, 0.42 * s, mShirt);
  torso.position.y = 0.36 * s;
  hips.add(torso);
  disposables.push(torso.geometry);

  const headG = new THREE.Group();
  headG.position.y = 0.72 * s;
  hips.add(headG);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.145 * s, 16, 12), mSkin);
  head.position.y = 0.12 * s;
  head.scale.set(0.92, 1.05, 0.98);
  headG.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.15 * s, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), mHair);
  hair.position.y = 0.13 * s;
  hair.scale.set(0.95, 1, 1);
  headG.add(hair);

  const mkLimb = (side: 1 | -1, top: number, r: number, len: number, m: THREE.Material) => {
    const pivot = limbPivot(0.27 * s * side, top * s);
    const seg = capsule(r * s, len * s, m);
    seg.position.y = -(len / 2 + r) * s;
    pivot.add(seg);
    hips.add(pivot);
    return pivot;
  };

  const lArm = mkLimb(1, 0.56, 0.07, 0.3, mShirt);
  const rArm = mkLimb(-1, 0.56, 0.07, 0.3, mShirt);
  const lLeg = mkLimb(1, 0.02, 0.09, 0.42, mPants);
  const rLeg = mkLimb(-1, 0.02, 0.09, 0.42, mPants);

  let phase = 0;
  const update = (dt: number, speed01: number) => {
    phase += dt * (4 + speed01 * 9);
    lLeg.rotation.x = Math.sin(phase) * 0.65 * speed01;
    rLeg.rotation.x = Math.sin(phase + Math.PI) * 0.65 * speed01;
    lArm.rotation.x = Math.sin(phase + Math.PI) * 0.5 * speed01;
    rArm.rotation.x = Math.sin(phase) * 0.5 * speed01;
    hips.position.y = 0.98 * s + Math.abs(Math.sin(phase)) * 0.035 * s * speed01;
  };

  const dispose = () => {
    group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry?.dispose?.();
        const mm = mesh.material as THREE.Material | THREE.Material[];
        (Array.isArray(mm) ? mm : [mm]).forEach((x) => x.dispose());
      }
    });
  };

  return { group, update, dispose, parts: { lLeg, rLeg, lArm, rArm } };
}

const SHIRTS = [0x2a6f5f, 0x7a3b3b, 0x3b5a7a, 0x6b6b3a, 0x4a4a52, 0x8a5a2a, 0x5a2a6b];
const PANTS = [0x23262e, 0x2e3540, 0x3a2f28, 0x1f2230];
const SKIN = [0xd9a583, 0xb07a4f, 0x8a5a34, 0xe8b98a, 0x6b4226];

export class CrowdManager {
  private peds: Ped[] = [];
  private scene: THREE.Scene;
  private bounds: number;

  constructor(scene: THREE.Scene, bounds: number, count = 28) {
    this.scene = scene;
    this.bounds = bounds;
    const n = Math.min(MAX_CROWD, count);
    for (let i = 0; i < n; i++) this.spawn();
  }

  private randPos(): THREE.Vector3 {
    return new THREE.Vector3(
      (Math.random() * 2 - 1) * this.bounds,
      0,
      (Math.random() * 2 - 1) * this.bounds,
    );
  }

  private spawn() {
    const skin = SKIN[(Math.random() * SKIN.length) | 0];
    const fig = buildFigure({
      skin,
      shirt: SHIRTS[(Math.random() * SHIRTS.length) | 0],
      pants: PANTS[(Math.random() * PANTS.length) | 0],
      scale: 0.92 + Math.random() * 0.16,
    });
    const pos = this.randPos();
    const ped: Ped = {
      group: fig.group,
      parts: fig.parts,
      pos,
      dir: Math.random() * Math.PI * 2,
      speed: 0.9 + Math.random() * 0.7,
      walkPhase: Math.random() * 10,
      fleeUntil: 0,
      wanderTarget: this.randPos(),
      skin: skin,
    };
    fig.group.position.copy(pos);
    (fig.group as any).__fig = fig;
    this.scene.add(fig.group);
    this.peds.push(ped);
  }

  /** Chaos nearby → pedestrians run away from (x, z). */
  flee(x: number, z: number, radius: number, nowMs: number) {
    const r2 = radius * radius;
    for (const p of this.peds) {
      const dx = p.pos.x - x, dz = p.pos.z - z;
      if (dx * dx + dz * dz < r2) {
        p.fleeUntil = nowMs + 5000 + Math.random() * 3000;
        p.dir = Math.atan2(dx, dz);
      }
    }
  }

  update(dt: number, nowMs: number) {
    for (const p of this.peds) {
      const fleeing = nowMs < p.fleeUntil;
      const speed = fleeing ? 4.2 : p.speed;
      if (!fleeing) {
        const dx = p.wanderTarget.x - p.pos.x;
        const dz = p.wanderTarget.z - p.pos.z;
        if (dx * dx + dz * dz < 4) p.wanderTarget = this.randPos();
        else {
          const want = Math.atan2(dx, dz);
          let d = want - p.dir;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          p.dir += THREE.MathUtils.clamp(d, -2 * dt, 2 * dt);
        }
      }
      p.pos.x += Math.sin(p.dir) * speed * dt;
      p.pos.z += Math.cos(p.dir) * speed * dt;
      const b = this.bounds;
      if (p.pos.x > b) p.pos.x = b; else if (p.pos.x < -b) p.pos.x = -b;
      if (p.pos.z > b) p.pos.z = b; else if (p.pos.z < -b) p.pos.z = -b;
      p.group.position.copy(p.pos);
      p.group.rotation.y = p.dir;
      const fig = (p.group as any).__fig as ReturnType<typeof buildFigure>;
      fig.update(dt, THREE.MathUtils.clamp(speed / 4.2, 0.05, 1));
    }
  }

  get count() { return this.peds.length; }

  dispose() {
    for (const p of this.peds) {
      this.scene.remove(p.group);
      ((p.group as any).__fig as ReturnType<typeof buildFigure>)?.dispose();
    }
    this.peds = [];
  }
}
