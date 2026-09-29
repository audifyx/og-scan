import * as THREE from "three";
import { BLOCKS, type Collider, type RoadNode } from "./CityBuilder";

export interface CarMesh {
  group: THREE.Group;
  wheels: THREE.Mesh[];
  headlightMat: THREE.MeshStandardMaterial;
  taillightMat: THREE.MeshStandardMaterial;
  dispose: () => void;
}

const BODY_COLORS = [0xc0392b, 0x2980b9, 0xf1c40f, 0x8e44ad, 0x16a085, 0xe67e22, 0xecf0f1, 0x2c3e50];

/** Stylized but realistic-proportioned sedan: sculpted body, cabin, wheels, lights. */
export function createCarMesh(color?: number): CarMesh {
  const c = color ?? BODY_COLORS[Math.floor(Math.random() * BODY_COLORS.length)];
  const group = new THREE.Group();
  const disposables: THREE.Material[] = [];
  const M = <T extends THREE.Material>(m: T): T => { disposables.push(m); return m; };

  const paint = M(new THREE.MeshStandardMaterial({ color: c, roughness: 0.35, metalness: 0.55 }));
  const glass = M(new THREE.MeshStandardMaterial({ color: 0x0e141c, roughness: 0.15, metalness: 0.8 }));
  const trim = M(new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.6 }));

  // lower body
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.62, 4.4), paint);
  body.position.y = 0.62;
  body.castShadow = true;
  // nose taper
  const nose = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.42, 0.9), paint);
  nose.position.set(0, 0.52, 2.5);
  nose.castShadow = true;
  // cabin
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 2.2), glass);
  cabin.position.set(0, 1.18, -0.25);
  cabin.castShadow = true;
  // roof panel
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 1.9), paint);
  roof.position.set(0, 1.48, -0.25);
  group.add(body, nose, cabin, roof);
  // bumpers + grille
  const bumpF = new THREE.Mesh(new THREE.BoxGeometry(2.14, 0.28, 0.3), trim);
  bumpF.position.set(0, 0.38, 2.85);
  const bumpR = bumpF.clone();
  bumpR.position.z = -2.25;
  const grille = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.22, 0.1), trim);
  grille.position.set(0, 0.55, 2.96);
  group.add(bumpF, bumpR, grille);

  // headlights / taillights
  const headlightMat = M(new THREE.MeshStandardMaterial({ color: 0xd8e8ff, emissive: 0xbfe0ff, emissiveIntensity: 0.4 }));
  const taillightMat = M(new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff2222, emissiveIntensity: 0.5 }));
  for (const sx of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.08), headlightMat);
    hl.position.set(0.68 * sx, 0.62, 2.96);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.08), taillightMat);
    tl.position.set(0.68 * sx, 0.66, -2.26);
    group.add(hl, tl);
  }

  // wheels
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 14);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = M(new THREE.MeshStandardMaterial({ color: 0x0c0d0f, roughness: 0.9 }));
  const hubMat = M(new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.3, metalness: 0.8 }));
  const wheels: THREE.Mesh[] = [];
  for (const [sx, sz] of [[-1, 1.45], [1, 1.45], [-1, -1.45], [1, -1.45]] as const) {
    const w = new THREE.Group();
    const tire = new THREE.Mesh(wheelGeo, wheelMat);
    tire.castShadow = true;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.32, 8), hubMat);
    hub.rotation.z = Math.PI / 2;
    w.add(tire, hub);
    w.position.set(1.0 * sx, 0.38, sz);
    group.add(w);
    wheels.push(tire);
  }

  return {
    group, wheels, headlightMat, taillightMat,
    dispose: () => disposables.forEach((m) => m.dispose()),
  };
}

/** Push a circle (x,z,r) out of building AABBs. Returns true if a hit occurred. */
export function resolveCircleColliders(
  pos: THREE.Vector3, radius: number, colliders: Collider[],
): boolean {
  let hit = false;
  for (const c of colliders) {
    const nx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - nx;
    const dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      hit = true;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        pos.x = nx + (dx / d) * radius;
        pos.z = nz + (dz / d) * radius;
      } else {
        // center inside box: push along smallest penetration axis
        const pl = pos.x - c.minX, pr = c.maxX - pos.x, pt = pos.z - c.minZ, pb = c.maxZ - pos.z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) pos.x = c.minX - radius;
        else if (m === pr) pos.x = c.maxX + radius;
        else if (m === pt) pos.z = c.minZ - radius;
        else pos.z = c.maxZ + radius;
      }
    }
  }
  return hit;
}

export interface DriveInput { throttle: number; steer: number; handbrake: boolean }

/** Arcade car physics: velocity along heading with grip. */
export class CarPhysics {
  pos: THREE.Vector3;
  heading: number;
  speed = 0;
  steerVis = 0;

  maxSpeed = 36;
  maxReverse = 12;
  accel = 16;
  brake = 30;

  constructor(x: number, z: number, heading: number) {
    this.pos = new THREE.Vector3(x, 0, z);
    this.heading = heading;
  }

  update(dt: number, input: DriveInput, colliders: Collider[]): { crashed: boolean } {
    const { throttle, steer, handbrake } = input;
    // longitudinal
    if (throttle > 0) this.speed += this.accel * throttle * dt * (1 - this.speed / (this.maxSpeed * 1.35));
    else if (throttle < 0) {
      if (this.speed > 0.5) this.speed -= this.brake * dt; // brake
      else this.speed = Math.max(-this.maxReverse, this.speed + this.accel * 0.7 * dt);
    } else {
      // drag
      this.speed -= this.speed * (handbrake ? 4 : 0.6) * dt;
      if (Math.abs(this.speed) < 0.05) this.speed = 0;
    }
    this.speed = Math.max(-this.maxReverse, Math.min(this.maxSpeed, this.speed));
    // steering (less at speed)
    const steerAuthority = 1.9 / (1 + Math.abs(this.speed) * 0.055);
    this.heading -= steer * steerAuthority * dt * Math.sign(this.speed || 1) * Math.min(1, Math.abs(this.speed) / 4 + 0.25);
    this.steerVis += (steer - this.steerVis) * Math.min(1, dt * 8);
    // integrate
    const nx = this.pos.x + Math.sin(this.heading) * this.speed * dt;
    const nz = this.pos.z + Math.cos(this.heading) * this.speed * dt;
    const prev = this.pos.clone();
    this.pos.x = nx;
    this.pos.z = nz;
    const crashed = resolveCircleColliders(this.pos, 2.1, colliders);
    if (crashed) {
      // slide: keep tangential, kill into-wall speed
      const px = this.pos.x - prev.x;
      const pz = this.pos.z - prev.z;
      const moved = Math.hypot(px, pz);
      if (moved > 1e-4) {
        const want = Math.hypot(Math.sin(this.heading) * this.speed * dt, Math.cos(this.heading) * this.speed * dt);
        const keep = Math.min(1, moved / Math.max(want, 1e-4));
        this.speed *= keep * 0.4;
      } else {
        this.speed *= 0.2;
      }
    }
    return { crashed };
  }
}

export interface TrafficCar {
  mesh: CarMesh;
  phys: CarPhysics;
  /** path: node indices */
  ci: number; cj: number; ni: number; nj: number;
  t: number;
  cruise: number;
  lane: number;
}

/** Lane offset to the right of travel direction. */
function laneOffset(fx: number, fz: number, tx: number, tz: number, lane: number): { x: number; z: number } {
  const dx = tx - fx, dz = tz - fz;
  const len = Math.hypot(dx, dz) || 1;
  // right-hand perpendicular
  return { x: (dz / len) * lane, z: (-dx / len) * lane };
}

export function createTrafficCar(nodes: RoadNode[][], ci: number, cj: number, ni: number, nj: number): TrafficCar {
  const mesh = createCarMesh();
  const from = nodes[ci][cj];
  const to = nodes[ni][nj];
  const off = laneOffset(from.x, from.z, to.x, to.z, 3.4);
  const phys = new CarPhysics(from.x + off.x, from.z + off.z, Math.atan2(to.x - from.x, to.z - from.z));
  return { mesh, phys, ci, cj, ni, nj, t: 0, cruise: 10 + Math.random() * 4, lane: 3.4 };
}

export function updateTrafficCar(
  car: TrafficCar, dt: number, nodes: RoadNode[][], others: { pos: THREE.Vector3 }[],
): void {
  const from = nodes[car.ci][car.cj];
  const to = nodes[car.ni][car.nj];
  const dx = to.x - from.x, dz = to.z - from.z;
  const len = Math.hypot(dx, dz);
  // slow for cars ahead
  let target = car.cruise;
  const hx = Math.sin(car.phys.heading), hz = Math.cos(car.phys.heading);
  for (const o of others) {
    if (o === car.phys) continue;
    const ox = o.pos.x - car.phys.pos.x, oz = o.pos.z - car.phys.pos.z;
    const ahead = ox * hx + oz * hz;
    const side = Math.abs(ox * hz - oz * hx);
    if (ahead > 0 && ahead < 9 && side < 3) { target = 0; break; }
    if (ahead > 0 && ahead < 16 && side < 3) target = Math.min(target, 4);
  }
  car.phys.speed += (target - car.phys.speed) * Math.min(1, dt * 2.2);
  const off = laneOffset(from.x, from.z, to.x, to.z, car.lane);
  car.t += (car.phys.speed * dt) / len;
  if (car.t >= 1) {
    // arrive at node: pick next (no U-turn unless dead end)
    const opts: [number, number][] = [];
    if (car.ni + 1 <= BLOCKS) opts.push([car.ni + 1, car.nj]);
    if (car.ni - 1 >= 0) opts.push([car.ni - 1, car.nj]);
    if (car.nj + 1 <= 5) opts.push([car.ni, car.nj + 1]);
    if (car.nj - 1 >= 0) opts.push([car.ni, car.nj - 1]);
    const noU = opts.filter(([a, b]) => !(a === car.ci && b === car.cj));
    const [qi, qj] = (noU.length ? noU : opts)[Math.floor(Math.random() * (noU.length ? noU.length : opts.length))];
    car.ci = car.ni; car.cj = car.nj; car.ni = qi; car.nj = qj; car.t = 0;
  } else {
    const px = from.x + dx * car.t + off.x;
    const pz = from.z + dz * car.t + off.z;
    car.phys.pos.set(px, 0, pz);
    const wantHeading = Math.atan2(dx, dz);
    let dh = wantHeading - car.phys.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    car.phys.heading += dh * Math.min(1, dt * 3);
  }
  // sync mesh
  car.mesh.group.position.copy(car.phys.pos);
  car.mesh.group.rotation.y = car.phys.heading;
  const spin = car.phys.speed * dt * 2.6;
  car.mesh.wheels.forEach((w) => { w.rotation.x += spin; });
}
