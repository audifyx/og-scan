/**
 * OrbitXCity — Events module: parades.
 *
 * Server-wide celebration fired ONLY when the community's real 24h
 * trading volume crosses a goal tier (triggers.ts
 * `evaluateParadeTrigger` — the volume figure is integrator-supplied real
 * data, never fabricated here). A column of themed floats and marchers
 * rolls along an integrator-supplied waypoint route through downtown.
 */

import * as THREE from "three";
import type {
  CityEffectHandle,
  EventsSceneHost,
  ParadePayload,
} from "../types";

interface Marcher {
  group: THREE.Group;
  phase: number;
}

interface FloatUnit {
  group: THREE.Group;
  wheels: THREE.Mesh[];
  bobPhase: number;
}

export interface ParadeOptions {
  /** Waypoints the column follows (integrator builds from core roads). */
  route: { x: number; z: number }[];
  /** Marchers per float. Default 8. */
  marchersPerFloat?: number;
}

const FLOAT_THEMES = [
  { name: "orbitx", color: 0x7c3aed, label: "ORBITX" },
  { name: "bull", color: 0x16a34a, label: "BULL" },
  { name: "degen", color: 0xf59e0b, label: "DEGEN" },
  { name: "moon", color: 0x38bdf8, label: "MOON" },
];

export function startParade(
  host: EventsSceneHost,
  payload: ParadePayload,
  opts: ParadeOptions
): CityEffectHandle {
  const group = new THREE.Group();
  host.scene.add(group);

  const route = opts.route.length >= 2 ? opts.route : defaultRoute(host.worldHalfSpan);
  const marchersPerFloat = opts.marchersPerFloat ?? 8;

  const floats: FloatUnit[] = [];
  const marchers: Marcher[] = [];

  // --- build floats ---
  const floatBodies: THREE.Material[] = [];
  FLOAT_THEMES.forEach((theme, fi) => {
    const f = new THREE.Group();
    // platform
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(7, 0.8, 3.4),
      new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.6 })
    );
    deck.position.y = 1.6;
    f.add(deck);
    // neon skirting
    const skirtMat = new THREE.MeshStandardMaterial({
      color: theme.color,
      emissive: theme.color,
      emissiveIntensity: 1.4,
    });
    floatBodies.push(skirtMat);
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.9, 3.6), skirtMat);
    skirt.position.y = 1.0;
    f.add(skirt);
    // wheels
    const wheels: THREE.Mesh[] = [];
    const wheelGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.5, 14);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
    for (const [wx, wz] of [[-2.4, 1.6], [2.4, 1.6], [-2.4, -1.6], [2.4, -1.6]] as const) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.x = Math.PI / 2;
      w.position.set(wx, 0.7, wz);
      f.add(w);
      wheels.push(w);
    }
    // centerpiece: big glowing token coin
    const coin = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.6, 0.35, 24),
      new THREE.MeshStandardMaterial({
        color: theme.color,
        emissive: theme.color,
        emissiveIntensity: 1.0,
        metalness: 0.8,
        roughness: 0.25,
      })
    );
    coin.rotation.x = Math.PI / 2;
    coin.position.y = 4.2;
    f.add(coin);
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 2.6, 8),
      new THREE.MeshStandardMaterial({ color: 0x888888 })
    );
    pole.position.y = 2.9;
    f.add(pole);
    // underglow light
    const glow = new THREE.PointLight(theme.color, 40, 25);
    glow.position.y = 3;
    f.add(glow);
    // dancers on deck (simple animated figures)
    for (let d = 0; d < 4; d++) {
      const dancer = makeFigure(theme.color);
      dancer.position.set(-2.4 + d * 1.6, 2.0, (d % 2 === 0 ? 0.9 : -0.9));
      f.add(dancer);
      marchers.push({ group: dancer, phase: Math.random() * Math.PI * 2 });
    }
    group.add(f);
    floats.push({ group: f, wheels, bobPhase: fi * 1.3 });
  });

  // --- street marchers flanking the floats ---
  for (let i = 0; i < floats.length * marchersPerFloat; i++) {
    const fig = makeFigure([0xef4444, 0x3b82f6, 0xfbbf24, 0x22c55e][i % 4]);
    group.add(fig);
    marchers.push({ group: fig, phase: Math.random() * Math.PI * 2 });
  }

  host.playSound("crowd-cheer", 0.7);

  // route progress per float (staggered)
  const routeLen = route.length;
  const spacing = 0.06; // fraction of route between floats
  const speed = 0.022; // route fraction per second (~ parade pace)
  let progress = 0;

  function pointAt(t: number): { pos: THREE.Vector3; dir: THREE.Vector3 } {
    const clamped = Math.max(0, Math.min(0.9999, t));
    const seg = Math.floor(clamped * (routeLen - 1));
    const f = clamped * (routeLen - 1) - seg;
    const a = route[seg];
    const b = route[Math.min(seg + 1, routeLen - 1)];
    const pos = new THREE.Vector3(a.x + (b.x - a.x) * f, 0, a.z + (b.z - a.z) * f);
    const dir = new THREE.Vector3(b.x - a.x, 0, b.z - a.z).normalize();
    return { pos, dir };
  }

  let elapsed = 0;
  const totalDur = 1.4 / speed; // run the full route plus stagger

  function dispose() {
    host.scene.remove(group);
    group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else if (mat) mat.dispose();
    });
  }

  return {
    update(dt: number): boolean {
      elapsed += dt;
      progress = Math.min(1.4, progress + speed * dt);

      floats.forEach((fl, i) => {
        const t = progress - i * spacing;
        if (t < 0 || t > 1.05) {
          fl.group.visible = false;
          return;
        }
        fl.group.visible = true;
        const { pos, dir } = pointAt(Math.min(t, 1));
        fl.group.position.copy(pos);
        fl.group.rotation.y = Math.atan2(dir.x, dir.z);
        fl.group.position.y = Math.sin(elapsed * 2 + fl.bobPhase) * 0.15;
        for (const w of fl.wheels) w.rotation.z -= dt * 4;
      });

      // marchers: two columns flanking each visible float + dancers bounce
      let mi = floats.length * 4; // skip dancers
      const t = elapsed * 6;
      marchers.forEach((m, idx) => {
        if (idx < floats.length * 4) {
          // dancers on decks: bounce in place
          m.group.position.y = 2.0 + Math.abs(Math.sin(t * 0.5 + m.phase)) * 0.5;
          m.group.rotation.y += dt * 1.5;
          return;
        }
        const fi = Math.floor((idx - floats.length * 4) / marchersPerFloat);
        const ft = progress - fi * spacing;
        if (ft < 0 || ft > 1.02) {
          m.group.visible = false;
          return;
        }
        m.group.visible = true;
        const { pos, dir } = pointAt(Math.min(ft, 1));
        const side = (idx % 2 === 0 ? 1 : -1) * (4.5 + (idx % 3));
        const back = ((idx % marchersPerFloat) / marchersPerFloat) * 10;
        m.group.position.set(
          pos.x + -dir.z * side - dir.x * back,
          Math.abs(Math.sin(t + m.phase)) * 0.25,
          pos.z + dir.x * side - dir.z * back
        );
        m.group.rotation.y = Math.atan2(dir.x, dir.z);
        void mi;
      });

      return elapsed < totalDur;
    },
    dispose,
  };
}

/** Simple stylized-but-smooth human figure (not blocky). */
function makeFigure(color: number): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xd9a066, roughness: 0.8 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.7, 4, 10), mat);
  torso.position.y = 1.15;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 12), skin);
  head.position.y = 1.95;
  g.add(head);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.55, 4, 8), mat);
    leg.position.set(s * 0.16, 0.45, 0);
    g.add(leg);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.5, 4, 8), mat);
    arm.position.set(s * 0.48, 1.25, 0);
    arm.rotation.z = s * -0.25;
    g.add(arm);
  }
  return g;
}

function defaultRoute(span: number): { x: number; z: number }[] {
  const s = span * 0.5;
  return [
    { x: -s, z: -s * 0.6 },
    { x: -s * 0.3, z: -s * 0.6 },
    { x: s * 0.3, z: -s * 0.4 },
    { x: s * 0.6, z: 0 },
    { x: s * 0.3, z: s * 0.5 },
    { x: -s * 0.3, z: s * 0.6 },
    { x: -s, z: s * 0.4 },
  ];
}

/** HUD copy for the parade that fired. */
export function paradeCopy(payload: ParadePayload): string {
  return `${payload.title} — ${payload.goalLabel}`;
}
