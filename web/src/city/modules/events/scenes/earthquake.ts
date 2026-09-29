/**
 * OrbitXCity — Events module: earthquake event.
 *
 * Fires ONLY from real market data — when a watched major token crashes
 * past the configured threshold (see triggers.ts `evaluateMarketTriggers`).
 * The city literally shakes: warning rumble → main shock with a
 * magnitude-shaped camera curve → aftershocks, plus ground dust.
 *
 * Camera shake goes through `host.shakeCamera` — the events module never
 * touches the core camera rig directly.
 */

import * as THREE from "three";
import type {
  CityEffectHandle,
  EarthquakePayload,
  EventsSceneHost,
} from "../types";

interface DustMote {
  mesh: THREE.Mesh;
  vy: number;
  life: number;
}

/**
 * Start the earthquake. Duration is driven by magnitude
 * (main shock ~ magnitude * 4s, plus aftershocks).
 */
export function startEarthquake(
  host: EventsSceneHost,
  payload: EarthquakePayload
): CityEffectHandle {
  const group = new THREE.Group();
  host.scene.add(group);

  const mag = Math.max(1, Math.min(10, payload.magnitude));
  const mainShockDur = 3 + mag * 1.4; // seconds
  const totalDur = mainShockDur + 8; // + aftershock window
  const warningDur = 1.5;

  // dust particle pool
  const motes: DustMote[] = [];
  const dustGeo = new THREE.SphereGeometry(0.5, 6, 6);
  const dustMat = new THREE.MeshBasicMaterial({ color: 0x9a8f7a, transparent: true, opacity: 0.5 });
  const POOL = 120;
  for (let i = 0; i < POOL; i++) {
    const m = new THREE.Mesh(dustGeo, dustMat.clone());
    m.visible = false;
    group.add(m);
    motes.push({ mesh: m, vy: 0, life: 0 });
  }

  // screen-space dust overlay would be core's job; we add a ground haze
  // disc that follows the player for the cheap, wide effect.
  const haze = new THREE.Mesh(
    new THREE.CircleGeometry(60, 24),
    new THREE.MeshBasicMaterial({
      color: 0x8a7d63,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
  );
  haze.rotation.x = -Math.PI / 2;
  haze.position.y = 0.5;
  group.add(haze);

  const playerPos = new THREE.Vector3();
  let elapsed = 0;
  let warned = false;
  let rumblePlayed = false;
  let shakeAccum = 0;

  // magnitude-shaped envelope: attack, sustain, decay
  function envelope(t: number): number {
    if (t < warningDur) return 0.15 * (t / warningDur); // warning rumble
    const s = t - warningDur;
    if (s < 1.2) return 0.2 + (s / 1.2) * 0.8; // attack
    if (s < mainShockDur) return 1.0; // sustain
    const tail = s - mainShockDur;
    const decay = Math.max(0, 1 - tail / (totalDur - mainShockDur - warningDur));
    // aftershock bumps
    const bump = Math.max(0, Math.sin(tail * 2.2)) * 0.35 * decay;
    return decay * 0.7 + bump;
  }

  function kickDust(count: number) {
    host.getPlayerPosition(playerPos);
    let spawned = 0;
    for (const mote of motes) {
      if (mote.life > 0) continue;
      mote.life = 1.5 + Math.random() * 2;
      mote.vy = 2 + Math.random() * 4;
      mote.mesh.visible = true;
      mote.mesh.position.set(
        playerPos.x + (Math.random() - 0.5) * 90,
        0.5,
        playerPos.z + (Math.random() - 0.5) * 90
      );
      mote.mesh.scale.setScalar(1 + Math.random() * 2.5);
      if (++spawned >= count) break;
    }
  }

  function dispose() {
    host.scene.remove(group);
    group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry && mesh.geometry !== dustGeo) mesh.geometry.dispose();
      const mat = mesh.material as THREE.Material | undefined;
      if (mat && mat !== dustMat) mat.dispose();
    });
    dustGeo.dispose();
    dustMat.dispose();
  }

  return {
    update(dt: number): boolean {
      elapsed += dt;
      if (!warned && elapsed >= 0.1) {
        warned = true;
        host.playSound("quake-rumble", 0.4);
      }
      if (!rumblePlayed && elapsed >= warningDur) {
        rumblePlayed = true;
        host.playSound("quake-rumble", 1.0);
      }
      const env = envelope(elapsed);
      // camera shake in small frequent pulses — core owns the rig
      shakeAccum += dt;
      if (shakeAccum >= 0.12 && env > 0.02) {
        shakeAccum = 0;
        host.shakeCamera((0.15 + env * 0.85) * (mag / 10), 140);
      }
      // ground haze + dust scale with the shock
      host.getPlayerPosition(playerPos);
      haze.position.x = playerPos.x;
      haze.position.z = playerPos.z;
      (haze.material as THREE.MeshBasicMaterial).opacity = 0.28 * env;
      if (env > 0.4 && Math.random() < env * 0.5) kickDust(2);

      // update motes
      for (const mote of motes) {
        if (mote.life <= 0) continue;
        mote.life -= dt;
        mote.mesh.position.y += mote.vy * dt;
        mote.vy *= 1 - dt * 0.8;
        const mat = mote.mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.5 * Math.max(0, Math.min(1, mote.life));
        if (mote.life <= 0) mote.mesh.visible = false;
      }
      return elapsed < totalDur;
    },
    dispose,
  };
}

/** Magnitude → human label, for HUD copy. */
export function quakeLabel(magnitude: number): string {
  if (magnitude >= 8) return "Catastrophic";
  if (magnitude >= 6) return "Devastating";
  if (magnitude >= 4.5) return "Major";
  return "Minor";
}
