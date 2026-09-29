import * as THREE from "three";
import type { ChaosBus, ChaosEvent } from "./chaos";
import type { AmbientAudio } from "./audio";

/**
 * Emergency AI: fire trucks + ambulances dispatched to chaos events.
 * Drives to the scene, flashes light bars, runs the wail siren with
 * distance-based volume, then leaves. Roadblock zones are exposed so the
 * host (core traffic) can slow civilian cars near them — see MODULE.md.
 */

export interface Roadblock {
  id: number;
  x: number;
  z: number;
  radius: number;
  expiresAt: number; // performance.now() ms
}

interface Unit {
  group: THREE.Group;
  kind: "fire" | "ems";
  pos: THREE.Vector3;
  target: THREE.Vector3;
  speed: number;
  state: "enroute" | "scene" | "leaving";
  dwellUntil: number;
  lightA: THREE.Mesh;
  lightB: THREE.Mesh;
  phase: number;
}

let unitSeq = 1;

function vehicleMesh(kind: "fire" | "ems"): { group: THREE.Group; lightA: THREE.Mesh; lightB: THREE.Mesh } {
  const group = new THREE.Group();
  const bodyColor = kind === "fire" ? 0xb32020 : 0xe8e8e8;
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 1.5, 5.6),
    new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.4, metalness: 0.25 }),
  );
  body.position.y = 1.15;
  body.castShadow = false;
  group.add(body);

  const cab = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 1.0, 1.8),
    new THREE.MeshStandardMaterial({ color: 0x1a1d24, roughness: 0.25, metalness: 0.4 }),
  );
  cab.position.set(0, 1.35, 3.2);
  group.add(cab);

  const stripeMat = new THREE.MeshStandardMaterial({
    color: kind === "fire" ? 0xf5c518 : 0xd42a2a,
    roughness: 0.5, emissive: kind === "fire" ? 0x442a00 : 0x440000, emissiveIntensity: 0.4,
  });
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.44, 0.35, 5.64), stripeMat);
  stripe.position.y = 1.0;
  group.add(stripe);

  const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 14);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.9 });
  for (const [x, z] of [[-1.15, 1.8], [1.15, 1.8], [-1.15, -1.8], [1.15, -1.8]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(x, 0.5, z);
    group.add(w);
  }

  // light bar: red + blue alternating
  const mkLight = (color: number, x: number) => {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.28, 0.34),
      new THREE.MeshStandardMaterial({ color: 0x222222, emissive: color, emissiveIntensity: 3 }),
    );
    m.position.set(x, 2.05, 0.4);
    group.add(m);
    return m;
  };
  const lightA = mkLight(0xff2222, -0.45);
  const lightB = mkLight(0x2266ff, 0.45);
  return { group, lightA, lightB };
}

const KIND_FOR: Record<string, "fire" | "ems"> = {
  fire: "fire",
  crash: "ems",
  brawl: "ems",
  blackout: "fire",
  chase: "ems",
};

export class EmergencyManager {
  private scene: THREE.Scene;
  private bus: ChaosBus;
  private audio: AmbientAudio;
  private bounds: number;
  private units: Unit[] = [];
  private roadblocks: Roadblock[] = [];
  private unsub: (() => void) | null = null;
  private getPlayer: () => THREE.Vector3;
  private rbSeq = 1;
  private sirenActive = false;

  constructor(
    scene: THREE.Scene,
    bus: ChaosBus,
    audio: AmbientAudio,
    bounds: number,
    getPlayer: () => THREE.Vector3,
  ) {
    this.scene = scene;
    this.bus = bus;
    this.audio = audio;
    this.bounds = bounds;
    this.getPlayer = getPlayer;
    this.unsub = this.bus.on((e) => this.dispatch(e));
  }

  private spawnPoint(tx: number, tz: number): THREE.Vector3 {
    const b = this.bounds;
    const ang = Math.atan2(tx, tz) + Math.PI;
    return new THREE.Vector3(
      THREE.MathUtils.clamp(tx + Math.sin(ang) * b * 1.2, -b, b), 0,
      THREE.MathUtils.clamp(tz + Math.cos(ang) * b * 1.2, -b, b),
    );
  }

  private dispatch(e: ChaosEvent) {
    if (this.units.length >= 4) return; // mobile cap
    const kind = KIND_FOR[e.kind] ?? "ems";
    const { group, lightA, lightB } = vehicleMesh(kind);
    const target = new THREE.Vector3(e.x + (Math.random() * 10 - 5), 0, e.z + (Math.random() * 10 - 5));
    const pos = this.spawnPoint(e.x, e.z);
    group.position.copy(pos);
    this.scene.add(group);
    this.units.push({
      group, kind, pos, target,
      speed: 13 + e.severity * 2,
      state: "enroute", dwellUntil: 0, lightA, lightB, phase: Math.random() * 10,
    });

    // Severity 2+ → roadblocks around the scene (traffic hook consumes these).
    if (e.severity >= 2) {
      const now = performance.now();
      for (let i = 0; i < 2; i++) {
        const a = (i / 2) * Math.PI * 2 + Math.random();
        const bx = e.x + Math.cos(a) * 10, bz = e.z + Math.sin(a) * 10;
        const bar = new THREE.Mesh(
          new THREE.BoxGeometry(3.2, 0.9, 0.35),
          new THREE.MeshStandardMaterial({ color: 0xf5c518, roughness: 0.6 }),
        );
        bar.position.set(bx, 0.45, bz);
        bar.rotation.y = -a;
        bar.castShadow = false;
        const coneGeo = new THREE.ConeGeometry(0.28, 0.7, 10);
        const coneMat = new THREE.MeshStandardMaterial({ color: 0xe0662a, roughness: 0.7 });
        for (let c = 0; c < 2; c++) {
          const cone = new THREE.Mesh(coneGeo, coneMat);
          cone.position.set(bx + Math.cos(a) * (c * 2.2 - 1.1), 0.35, bz + Math.sin(a) * (c * 2.2 - 1.1));
          this.scene.add(cone);
          (bar as any).__cones = ((bar as any).__cones ?? []).concat(cone);
        }
        this.scene.add(bar);
        this.roadblocks.push({ id: this.rbSeq++, x: bx, z: bz, radius: 8, expiresAt: now + 45000, });
        (this.roadblocks[this.roadblocks.length - 1] as any).__mesh = bar;
      }
    }
    void unitSeq++;
  }

  /** Slow-zones for core traffic. Host polls this; core decelerates cars inside. */
  getSlowZones(): { x: number; z: number; radius: number }[] {
    const now = performance.now();
    return this.roadblocks
      .filter((r) => r.expiresAt > now)
      .map((r) => ({ x: r.x, z: r.z, radius: r.radius }));
  }

  update(dt: number) {
    const now = performance.now();
    const player = this.getPlayer();
    let nearestDist = Infinity;

    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];
      u.phase += dt * 6;
      const on = Math.sin(u.phase) > 0;
      (u.lightA.material as THREE.MeshStandardMaterial).emissiveIntensity = on ? 4 : 0.15;
      (u.lightB.material as THREE.MeshStandardMaterial).emissiveIntensity = on ? 0.15 : 4;

      if (u.state === "enroute") {
        const dx = u.target.x - u.pos.x, dz = u.target.z - u.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 2.5) {
          u.state = "scene";
          u.dwellUntil = now + 14000 + Math.random() * 8000;
        } else {
          u.pos.x += (dx / d) * u.speed * dt;
          u.pos.z += (dz / d) * u.speed * dt;
          u.group.rotation.y = Math.atan2(dx, dz);
        }
      } else if (u.state === "scene") {
        if (now > u.dwellUntil) {
          u.state = "leaving";
          const a = Math.random() * Math.PI * 2;
          u.target.set(u.pos.x + Math.sin(a) * this.bounds * 1.4, 0, u.pos.z + Math.cos(a) * this.bounds * 1.4);
        }
      } else {
        const dx = u.target.x - u.pos.x, dz = u.target.z - u.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 4) {
          this.scene.remove(u.group);
          this.units.splice(i, 1);
          continue;
        }
        u.pos.x += (dx / d) * u.speed * dt;
        u.pos.z += (dz / d) * u.speed * dt;
        u.group.rotation.y = Math.atan2(dx, dz);
      }
      u.group.position.copy(u.pos);
      nearestDist = Math.min(nearestDist, u.pos.distanceTo(player));
    }

    // Siren: wail on while any unit is active; volume by distance.
    if (this.units.length > 0) {
      if (!this.sirenActive) { this.audio.sirenOn(); this.sirenActive = true; }
      this.audio.sirenLevel(THREE.MathUtils.clamp(1 - nearestDist / 90, 0, 1));
    } else if (this.sirenActive) {
      this.audio.sirenOff();
      this.sirenActive = false;
    }

    // Expire roadblocks
    for (let i = this.roadblocks.length - 1; i >= 0; i--) {
      const r = this.roadblocks[i];
      if (r.expiresAt <= now) {
        const bar = (r as any).__mesh as THREE.Mesh | undefined;
        if (bar) {
          ((bar as any).__cones as THREE.Mesh[] | undefined)?.forEach((c) => this.scene.remove(c));
          this.scene.remove(bar);
          bar.geometry.dispose();
        }
        this.roadblocks.splice(i, 1);
      }
    }
  }

  dispose() {
    this.unsub?.();
    for (const u of this.units) this.scene.remove(u.group);
    this.units = [];
    this.audio.sirenOff();
    this.sirenActive = false;
  }
}
