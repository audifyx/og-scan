/**
 * OrbitXCity — Events module: fireworks over the bay.
 *
 * Server-wide celebration fired ONLY when ORBITX crosses a real price
 * milestone in live market data (triggers.ts) — or by explicit host
 * override. Barges anchored over the bay launch scripted volleys:
 * rockets streak up, burst into colored shell patterns (peony, ring,
 * willow, strobe), with launch/burst sound cues through the host.
 */

import * as THREE from "three";
import type {
  CityEffectHandle,
  EventsSceneHost,
  FireworksPayload,
} from "../types";

export interface FireworkBarge {
  x: number;
  z: number;
}

export interface FireworksOptions {
  /** Barge positions over the bay (integrator-supplied). */
  barges: FireworkBarge[];
  /** Show length in seconds. Default 100. */
  durationSec?: number;
}

type ShellType = "peony" | "ring" | "willow" | "strobe";

const SHELL_PALETTES: Record<ShellType, number[]> = {
  peony: [0xff4d6d, 0xffd166, 0x4cc9f0, 0xb5179e],
  ring: [0xf4f1de, 0xe07a5f],
  willow: [0xffd700, 0xff9f1c],
  strobe: [0xffffff, 0x80ffdb],
};

interface Rocket {
  group: THREE.Group;
  trail: THREE.Points;
  vel: THREE.Vector3;
  target: THREE.Vector3;
  shell: ShellType;
  alive: boolean;
}

interface Burst {
  points: THREE.Points;
  vel: Float32Array;
  life: number;
  maxLife: number;
  shell: ShellType;
  baseColor: THREE.Color;
}

export function startFireworks(
  host: EventsSceneHost,
  payload: FireworksPayload,
  opts: FireworksOptions
): CityEffectHandle {
  const group = new THREE.Group();
  host.scene.add(group);

  const barges: FireworkBarge[] =
    opts.barges.length > 0
      ? opts.barges
      : [{ x: -140, z: 260 }, { x: 0, z: 280 }, { x: 140, z: 260 }]; // bay fallback
  const duration = opts.durationSec ?? 100;

  // --- barges: dark hulls with deck lights ---
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x1c2330, roughness: 0.7 });
  for (const b of barges) {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(22, 3, 10), hullMat);
    hull.position.set(b.x, 0.5, b.z);
    group.add(hull);
    for (let i = -2; i <= 2; i++) {
      const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffc300 })
      );
      lamp.position.set(b.x + i * 4, 2.6, b.z);
      group.add(lamp);
    }
  }

  const rockets: Rocket[] = [];
  const bursts: Burst[] = [];
  let elapsed = 0;
  let launchTimer = 0;
  let grandFinale = false;

  // headline sky text? no — keep it light-based. Big finale text via strobes.
  host.playSound("crowd-cheer", 0.5);

  function makeRocket(barge: FireworkBarge, shell: ShellType): Rocket {
    const g = new THREE.Group();
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xfff3b0 })
    );
    g.add(head);
    const flash = new THREE.PointLight(0xffd166, 40, 40);
    g.add(flash);
    g.position.set(barge.x + (Math.random() - 0.5) * 8, 2, barge.z + (Math.random() - 0.5) * 4);

    const trailGeo = new THREE.BufferGeometry();
    const trailPos = new Float32Array(40 * 3);
    trailGeo.setAttribute("position", new THREE.BufferAttribute(trailPos, 3));
    const trail = new THREE.Points(
      trailGeo,
      new THREE.PointsMaterial({ color: 0xffd166, size: 1.6, transparent: true, opacity: 0.9 })
    );
    group.add(trail);

    const target = new THREE.Vector3(
      barge.x + (Math.random() - 0.5) * 60,
      70 + Math.random() * 45,
      barge.z + (Math.random() - 0.5) * 30
    );
    group.add(g);
    const rocket: Rocket = {
      group: g,
      trail,
      vel: new THREE.Vector3(),
      target,
      shell,
      alive: true,
    };
    rockets.push(rocket);
    host.playSound("firework-launch", 0.35);
    return rocket;
  }

  function burstAt(pos: THREE.Vector3, shell: ShellType) {
    const count = shell === "ring" ? 60 : 110;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y;
      positions[i * 3 + 2] = pos.z;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      let speed = 18 + Math.random() * 14;
      if (shell === "ring") speed = 26; // uniform ring
      if (shell === "willow") speed = 10 + Math.random() * 8;
      vel[i * 3] = Math.sin(phi) * Math.cos(theta) * speed;
      vel[i * 3 + 1] = Math.cos(phi) * speed;
      vel[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * speed;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const palette = SHELL_PALETTES[shell];
    const color = new THREE.Color(palette[Math.floor(Math.random() * palette.length)]);
    const points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color,
        size: shell === "strobe" ? 2.6 : 2.0,
        transparent: true,
        opacity: 1,
        depthWrite: false,
      })
    );
    group.add(points);
    const flash = new THREE.PointLight(color, 120, 160);
    flash.position.copy(pos);
    group.add(flash);
    bursts.push({
      points,
      vel,
      life: shell === "willow" ? 3.2 : 2.2,
      maxLife: shell === "willow" ? 3.2 : 2.2,
      shell,
      baseColor: color,
    });
    // keep the light around briefly via the points group
    (points as unknown as { userData: { flash: THREE.PointLight } }).userData = { flash };
    host.playSound("firework-burst", 0.5);
    // gentle camera pulse so the whole city feels it
    host.shakeCamera(0.08, 200);
  }

  function dispose() {
    host.scene.remove(group);
    group.traverse((o) => {
      const mesh = o as THREE.Mesh | THREE.Points;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = (mesh as THREE.Mesh).material as THREE.Material | undefined;
      if (mat) mat.dispose();
    });
  }

  const SHELLS: ShellType[] = ["peony", "peony", "ring", "willow", "strobe", "peony"];

  return {
    update(dt: number): boolean {
      elapsed += dt;
      launchTimer -= dt;
      const inFinale = elapsed > duration - 15;
      if (inFinale && !grandFinale) {
        grandFinale = true;
        host.playSound("crowd-cheer", 1.0);
      }
      const rate = inFinale ? 0.12 : 0.55;
      if (launchTimer <= 0 && elapsed < duration - 6) {
        launchTimer = rate * (0.7 + Math.random() * 0.6);
        const barge = barges[Math.floor(Math.random() * barges.length)];
        const shell = SHELLS[Math.floor(Math.random() * SHELLS.length)];
        makeRocket(barge, shell);
        if (inFinale && Math.random() < 0.6) {
          const b2 = barges[Math.floor(Math.random() * barges.length)];
          makeRocket(b2, SHELLS[Math.floor(Math.random() * SHELLS.length)]);
        }
      }

      // rockets rise; pop at target
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        const dir = r.target.clone().sub(r.group.position);
        const dist = dir.length();
        if (dist < 4 || !r.alive) {
          burstAt(r.group.position.clone(), r.shell);
          group.remove(r.group);
          group.remove(r.trail);
          r.trail.geometry.dispose();
          (r.trail.material as THREE.Material).dispose();
          rockets.splice(i, 1);
          continue;
        }
        dir.normalize();
        r.vel.lerp(dir.multiplyScalar(65), 1 - Math.exp(-dt * 3));
        r.group.position.addScaledVector(r.vel, dt);
        // trail update: shift buffer, push head
        const attr = r.trail.geometry.getAttribute("position") as THREE.BufferAttribute;
        const arr = attr.array as Float32Array;
        for (let k = 39; k > 0; k--) {
          arr[k * 3] = arr[(k - 1) * 3];
          arr[k * 3 + 1] = arr[(k - 1) * 3 + 1];
          arr[k * 3 + 2] = arr[(k - 1) * 3 + 2];
        }
        arr[0] = r.group.position.x;
        arr[1] = r.group.position.y;
        arr[2] = r.group.position.z;
        attr.needsUpdate = true;
      }

      // bursts expand, fade, fall
      for (let i = bursts.length - 1; i >= 0; i--) {
        const b = bursts[i];
        b.life -= dt;
        const attr = b.points.geometry.getAttribute("position") as THREE.BufferAttribute;
        const arr = attr.array as Float32Array;
        const drag = b.shell === "willow" ? 0.985 : 0.96;
        for (let k = 0; k < arr.length; k += 3) {
          b.vel[k] *= drag;
          b.vel[k + 1] = b.vel[k + 1] * drag - dt * (b.shell === "willow" ? 9 : 4);
          b.vel[k + 2] *= drag;
          arr[k] += b.vel[k] * dt;
          arr[k + 1] += b.vel[k + 1] * dt;
          arr[k + 2] += b.vel[k + 2] * dt;
        }
        attr.needsUpdate = true;
        const mat = b.points.material as THREE.PointsMaterial;
        const f = Math.max(0, b.life / b.maxLife);
        mat.opacity = b.shell === "strobe" ? (Math.sin(b.life * 30) > 0 ? f : f * 0.2) : f;
        const ud = (b.points as unknown as { userData?: { flash?: THREE.PointLight } }).userData;
        if (ud?.flash) {
          ud.flash.intensity = 120 * f;
          if (f <= 0.02) {
            group.remove(ud.flash);
          }
        }
        if (b.life <= 0) {
          if (ud?.flash) group.remove(ud.flash);
          group.remove(b.points);
          b.points.geometry.dispose();
          (b.points.material as THREE.Material).dispose();
          bursts.splice(i, 1);
        }
      }

      return elapsed < duration + 6;
    },
    dispose,
  };
}

/** Human copy for the milestone that fired. */
export function fireworksCopy(payload: FireworksPayload): string {
  return `${payload.milestoneLabel} — ORBITX at $${payload.price.toFixed(4)}`;
}
