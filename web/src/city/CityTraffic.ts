import * as THREE from "three";
import type { GameAudio } from "./core/audio";

/**
 * OrbitX City — ambient traffic.
 *
 * 5 low-poly procedural cars on 2 verified-clear rectangular loops
 * (loop1 south block, loop2 north block — segments checked against every
 * building footprint). Headlight glow sprites, brake taillights when the
 * player is ahead, distance-faded engine hum via GameAudio.
 *
 * Phone-safe: 5 cars × ~10 meshes, 4 sprites each, no shadows.
 */

interface Car {
  group: THREE.Group;
  tailMat: THREE.MeshBasicMaterial;
  loop: THREE.Vector3[];
  seg: number;
  t: number; // 0..1 along current segment
  speed: number;
  targetSpeed: number;
  color: number;
}

const LOOP1 = [
  new THREE.Vector3(8, 0, -8),
  new THREE.Vector3(8, 0, 22),
  new THREE.Vector3(-6, 0, 22),
  new THREE.Vector3(-6, 0, -8),
];
const LOOP2 = [
  new THREE.Vector3(10, 0, -8),
  new THREE.Vector3(10, 0, -30),
  new THREE.Vector3(-32, 0, -30),
  new THREE.Vector3(-32, 0, -8),
];

const CAR_COLORS = [0x17e6d4, 0xc23b4e, 0x23262e, 0xd9a441, 0x7a4ae0];
const CRUISE = 7;

function glowSprite(color: number, scale: number, opacity: number): THREE.Sprite {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.4, "rgba(255,255,255,0.35)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  sp.scale.set(scale, scale, 1);
  return sp;
}

export class CityTraffic {
  private scene: THREE.Scene;
  private cars: Car[] = [];
  private disposed = false;
  private humOn = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    const defs: { loop: THREE.Vector3[]; offset: number; color: number }[] = [
      { loop: LOOP1, offset: 0.0, color: CAR_COLORS[0] },
      { loop: LOOP1, offset: 0.38, color: CAR_COLORS[1] },
      { loop: LOOP1, offset: 0.72, color: CAR_COLORS[2] },
      { loop: LOOP2, offset: 0.15, color: CAR_COLORS[3] },
      { loop: LOOP2, offset: 0.62, color: CAR_COLORS[4] },
    ];
    for (const d of defs) this.cars.push(this.makeCar(d.loop, d.offset, d.color));
  }

  private makeCar(loop: THREE.Vector3[], offset: number, color: number): Car {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.35 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x0a0c12, roughness: 0.6 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 4.1), bodyMat);
    body.position.y = 0.62;
    g.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.5, 2.0), darkMat);
    cabin.position.set(0, 1.12, -0.2);
    g.add(cabin);

    const wheelG = new THREE.CylinderGeometry(0.34, 0.34, 0.28, 10);
    wheelG.rotateZ(Math.PI / 2);
    for (const [x, z] of [[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35]] as const) {
      const w = new THREE.Mesh(wheelG, darkMat);
      w.position.set(x, 0.34, z);
      g.add(w);
    }

    // headlights (front = +z)
    for (const x of [-0.6, 0.6]) {
      const hl = glowSprite(0xfff2c8, 1.1, 0.85);
      hl.position.set(x, 0.62, 2.08);
      g.add(hl);
    }
    // taillights
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
    for (const x of [-0.6, 0.6]) {
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.06), tailMat);
      tl.position.set(x, 0.66, -2.06);
      g.add(tl);
      const tg = glowSprite(0xff2a2a, 0.8, 0.25);
      tg.position.set(x, 0.66, -2.12);
      tg.userData.isTailGlow = true;
      g.add(tg);
    }

    // place at offset along loop
    const total = this.loopLength(loop);
    let dist = offset * total;
    let seg = 0;
    while (seg < loop.length) {
      const a = loop[seg];
      const b = loop[(seg + 1) % loop.length];
      const L = a.distanceTo(b);
      if (dist <= L) break;
      dist -= L;
      seg++;
    }
    const car: Car = { group: g, tailMat, loop, seg, t: 0, speed: CRUISE, targetSpeed: CRUISE, color };
    const a = loop[seg];
    const b = loop[(seg + 1) % loop.length];
    car.t = dist / Math.max(0.001, a.distanceTo(b));
    this.scene.add(g);
    return car;
  }

  private loopLength(loop: THREE.Vector3[]): number {
    let L = 0;
    for (let i = 0; i < loop.length; i++) L += loop[i].distanceTo(loop[(i + 1) % loop.length]);
    return L;
  }

  update(dt: number, playerPos: THREE.Vector3, audio: GameAudio | null): void {
    if (this.disposed) return;
    let nearest = Infinity;

    for (const car of this.cars) {
      const a = car.loop[car.seg];
      const b = car.loop[(car.seg + 1) % car.loop.length];
      const segLen = Math.max(0.001, a.distanceTo(b));
      const dir = new THREE.Vector3().subVectors(b, a).normalize();

      // player ahead? → brake
      const toPlayer = new THREE.Vector3().subVectors(playerPos, car.group.position);
      const ahead = toPlayer.dot(dir);
      const lateral = Math.abs(toPlayer.x * dir.z - toPlayer.z * dir.x);
      const braking = ahead > 0 && ahead < 6 && lateral < 2.2;
      car.targetSpeed = braking ? 0 : CRUISE;
      const accel = braking ? 14 : 5;
      car.speed += Math.sign(car.targetSpeed - car.speed) * Math.min(Math.abs(car.targetSpeed - car.speed), accel * dt);

      car.t += (car.speed * dt) / segLen;
      if (car.t >= 1) {
        car.t = 0;
        car.seg = (car.seg + 1) % car.loop.length;
      }
      const na = car.loop[car.seg];
      const nb = car.loop[(car.seg + 1) % car.loop.length];
      car.group.position.lerpVectors(na, nb, car.t);
      car.group.position.y = 0;
      const nd = new THREE.Vector3().subVectors(nb, na).normalize();
      car.group.rotation.y = Math.atan2(nd.x, nd.z);

      // brake lights
      const brakeK = car.speed < CRUISE * 0.5 ? 1 : 0;
      car.tailMat.color.setHex(brakeK ? 0xff5555 : 0xff2a2a);
      car.group.traverse((o) => {
        const sp = o as THREE.Sprite;
        if (sp.isSprite && sp.userData.isTailGlow) {
          (sp.material as THREE.SpriteMaterial).opacity = brakeK ? 0.9 : 0.25;
        }
      });

      const d = car.group.position.distanceTo(playerPos);
      if (d < nearest) nearest = d;
    }

    // distance-faded engine hum
    if (audio) {
      const level = nearest < 26 ? Math.max(0, 1 - nearest / 26) : 0;
      if (level > 0.02) {
        if (!this.humOn) { audio.trafficStart(); this.humOn = true; }
        audio.trafficLevel(level);
      } else if (this.humOn) {
        audio.trafficStop();
        this.humOn = false;
      }
    }
  }

  dispose(): void {
    this.disposed = true;
    for (const car of this.cars) {
      this.scene.remove(car.group);
      car.group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) m.geometry.dispose();
      });
    }
    this.cars = [];
  }
}
