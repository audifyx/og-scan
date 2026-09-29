/**
 * ORBITXCITY — companion trade-bot (3D follower drone).
 *
 * A little hovering drone that trails the player around the city. Built with
 * raw Three.js meshes so it needs nothing from core — the integrator wires it
 * by passing the scene + a player-snapshot callback (see MODULE.md for the
 * one-line wiring using `api.getWorld()`).
 *
 * No core imports here: `CompanionPlayer` mirrors the fields of
 * `world.getPlayerState()` without depending on the class.
 */
import * as THREE from "three";
import type { CompanionHandle } from "../types";

export interface CompanionPlayer {
  pos: THREE.Vector3;
  heading: number;
  onFoot: boolean;
}

export interface CompanionBot extends CompanionHandle {
  /** Advance hover/follow physics. Call every frame while mounted. */
  update: (dt: number, player: CompanionPlayer) => void;
  setEnabled: (on: boolean) => void;
}

const tmp = new THREE.Vector3();
const target = new THREE.Vector3();

export function createCompanionBot(opts: {
  scene: THREE.Scene;
  color?: number;
  name?: string;
}): CompanionBot {
  const color = opts.color ?? 0x14c8b4;
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x1a1e24, metalness: 0.75, roughness: 0.35,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity: 1.6, roughness: 0.4,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x0a0e14, metalness: 0.9, roughness: 0.15,
  });

  // body — squashed sphere
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 14), bodyMat);
  body.scale.set(1, 0.82, 1);
  body.castShadow = true;
  group.add(body);

  // visor — glowing "face" toward +z
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.105, 16, 12), glassMat);
  visor.position.set(0, 0.02, 0.1);
  visor.scale.set(1.1, 0.62, 0.7);
  group.add(visor);

  // eye — single glowing dot on the visor (trade-bot stare)
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), accentMat);
  eye.position.set(0, 0.03, 0.185);
  group.add(eye);

  // orbit ring — spins, gives the GTA-hologram feel
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.018, 8, 32), accentMat);
  ring.rotation.x = Math.PI / 2.4;
  group.add(ring);

  // antenna + blinking tip
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 6), bodyMat);
  antenna.position.set(0.08, 0.2, 0);
  group.add(antenna);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), accentMat.clone());
  tip.position.set(0.08, 0.29, 0);
  group.add(tip);

  // under-glow light (cheap, single point)
  const glow = new THREE.PointLight(color, 2.2, 3.5, 1.8);
  glow.position.y = -0.2;
  group.add(glow);

  group.position.set(0, 1.5, 0);
  opts.scene.add(group);

  let name = opts.name ?? "Orbit";
  let enabled = true;
  let time = 0;

  const update = (dt: number, player: CompanionPlayer) => {
    group.visible = enabled;
    if (!enabled) return;
    time += dt;

    // hover anchor: behind-left of the player, rotated by heading
    const back = 1.35, side = -0.85, hoverY = 1.45;
    const hx = Math.cos(player.heading), hz = Math.sin(player.heading);
    target.set(
      player.pos.x - hx * back - hz * side,
      hoverY + Math.sin(time * 2.2) * 0.12,
      player.pos.z - hz * back + hx * side,
    );

    // smooth pursuit — eases in when far, settles when close
    const k = 1 - Math.exp(-dt * 3.2);
    group.position.lerp(target, k);

    // face the player
    tmp.copy(player.pos).sub(group.position);
    tmp.y = 0;
    if (tmp.lengthSq() > 0.0001) {
      const yaw = Math.atan2(tmp.x, tmp.z);
      group.rotation.y += (((yaw - group.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 6);
    }

    // idle life: ring spin, antenna blink, eye pulse, banking into turns
    ring.rotation.z += dt * 2.4;
    const blink = (Math.sin(time * 5.5) + 1) / 2;
    (tip.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.4 + blink * 2.2;
    (eye.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.2 + Math.sin(time * 3.1) * 0.5;
    const dist = group.position.distanceTo(target);
    group.rotation.z = THREE.MathUtils.clamp((target.x - group.position.x) * -0.12, -0.35, 0.35) * Math.min(1, dist);
    group.rotation.x = THREE.MathUtils.clamp((target.z - group.position.z) * 0.1, -0.3, 0.3) * Math.min(1, dist);
  };

  const setName = (n: string) => { name = n.slice(0, 18) || "Orbit"; };
  const setColor = (hex: number) => {
    accentMat.color.setHex(hex);
    accentMat.emissive.setHex(hex);
    (tip.material as THREE.MeshStandardMaterial).color.setHex(hex);
    (tip.material as THREE.MeshStandardMaterial).emissive.setHex(hex);
    glow.color.setHex(hex);
  };
  const setEnabled = (on: boolean) => {
    enabled = on;
    group.visible = on;
  };
  const dispose = () => {
    opts.scene.remove(group);
    group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry.dispose();
        const mt = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mt)) mt.forEach((x) => x.dispose());
        else mt?.dispose();
      }
      const l = o as THREE.PointLight;
      if (l.isPointLight) l.dispose?.();
    });
  };

  return { update, setName, setColor, setEnabled, dispose };
}

/** Default accent palette for the companion picker. */
export const COMPANION_COLORS: { name: string; hex: number }[] = [
  { name: "Neon Teal", hex: 0x14c8b4 },
  { name: "OrbitX Green", hex: 0x1fd66b },
  { name: "Amber", hex: 0xffb02e },
  { name: "Crimson", hex: 0xff3b5c },
  { name: "Violet", hex: 0x9a5cff },
  { name: "Ice Blue", hex: 0x4fc3ff },
  { name: "Magenta", hex: 0xff4fd8 },
];
