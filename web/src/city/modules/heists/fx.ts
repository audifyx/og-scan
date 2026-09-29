/**
 * Lightweight three.js FX for the heists module — objective beacons, alarm
 * pulses. Additive-only: the integrator passes the scene (core `sceneRef`)
 * and world positions; everything disposes cleanly.
 */
import * as THREE from "three";

export interface FxHandle {
  update(dt: number): void;
  setPosition(x: number, z: number): void;
  dispose(): void;
}

function beaconMaterial(color: string): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false });
}

/**
 * Pulsing objective beacon: a vertical light pillar + expanding ground ring.
 * Height ~30m so it's visible across the block.
 */
export function spawnObjectiveBeacon(
  scene: THREE.Scene,
  x: number,
  z: number,
  color = "#22d3ee",
): FxHandle {
  const group = new THREE.Group();

  const pillarGeo = new THREE.CylinderGeometry(0.7, 1.4, 30, 12, 1, true);
  const pillar = new THREE.Mesh(
    pillarGeo,
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  pillar.position.y = 15;
  group.add(pillar);

  const ringGeo = new THREE.RingGeometry(1.6, 2.1, 40);
  const ring = new THREE.Mesh(ringGeo, beaconMaterial(color));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  group.add(ring);

  group.position.set(x, 0, z);
  scene.add(group);

  let t = Math.random() * 10;
  let disposed = false;
  return {
    update(dt: number) {
      if (disposed) return;
      t += dt;
      const s = 1 + Math.sin(t * 3.2) * 0.18;
      ring.scale.set(s, s, 1);
      (ring.material as THREE.MeshBasicMaterial).opacity = 0.55 + Math.sin(t * 3.2) * 0.3;
      pillar.rotation.y += dt * 0.8;
    },
    setPosition(nx: number, nz: number) {
      group.position.set(nx, 0, nz);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      scene.remove(group);
      pillarGeo.dispose();
      ringGeo.dispose();
      (pillar.material as THREE.Material).dispose();
      (ring.material as THREE.Material).dispose();
    },
  };
}

/** red alarm pulse — expanding rings for vault alarms / busted heat spikes */
export function spawnAlarmPulse(scene: THREE.Scene, x: number, z: number): FxHandle {
  const group = new THREE.Group();
  const rings: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const geo = new THREE.RingGeometry(1, 1.35, 40);
    const mat = new THREE.MeshBasicMaterial({
      color: "#ef4444",
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.2 + i * 0.05;
    group.add(mesh);
    rings.push(mesh);
  }
  group.position.set(x, 0, z);
  scene.add(group);

  let t = 0;
  let disposed = false;
  return {
    update(dt: number) {
      if (disposed) return;
      t += dt;
      rings.forEach((mesh, i) => {
        const phase = (t * 1.4 + i / 3) % 1;
        const s = 2 + phase * 14;
        mesh.scale.set(s, s, 1);
        (mesh.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - phase);
      });
    },
    setPosition(nx: number, nz: number) {
      group.position.set(nx, 0, nz);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      scene.remove(group);
      rings.forEach((mesh) => {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      });
    },
  };
}
