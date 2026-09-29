/**
 * 3. CONSTRUCTION SITES — new districts built LIVE as platform features ship.
 *
 * The city grows with OrbitX: every site is a `ConstructionSpec` whose
 * `progress` (0…1) is data-driven. The platform team bumps progress when a
 * feature ships; at 1.0 the scaffold swaps for the finished landmark build.
 * The integrator (or a future cron) calls `setConstructionProgress` — this
 * module never fetches anything itself.
 */
import * as THREE from "three";
import type { ConstructionSpec, Vec3T } from "../types";

/** Initial ship list — progress values are illustrative until wired. */
export const CONSTRUCTION_SITES: ConstructionSpec[] = [
  {
    id: "site:arena",
    name: "OrbitX Arena",
    description: "Tournament colosseum for /play events. Scaffolding up — framing starts when the tournament bracket API ships.",
    position: [120, 0, 80],
    footprint: [50, 50],
    progress: 0.25,
    status: "scaffolding",
    linkedFeature: "play-tournaments",
  },
  {
    id: "site:harbor",
    name: "Harbor Expansion",
    description: "Neon docks + ferry terminal for the second island. Cranes on site.",
    position: [-40, 0, 150],
    footprint: [60, 40],
    progress: 0.55,
    status: "framing",
    linkedFeature: "second-island-ferry",
  },
  {
    id: "site:casino",
    name: "Lucky Block Casino",
    description: "Paper-CITY gaming hall. Concrete poured — interior fit-out gated on the gaming economy review.",
    position: [140, 0, -60],
    footprint: [44, 36],
    progress: 0.7,
    status: "finishing",
    linkedFeature: "paper-city-gaming",
  },
];

/** Bump a site's progress; status derives from progress automatically. */
export function setConstructionProgress(id: string, progress: number): ConstructionSpec | null {
  const site = CONSTRUCTION_SITES.find((s) => s.id === id);
  if (!site) return null;
  site.progress = Math.max(0, Math.min(1, progress));
  site.status = site.progress >= 1 ? "complete"
    : site.progress >= 0.65 ? "finishing"
    : site.progress >= 0.3 ? "framing"
    : "scaffolding";
  return site;
}

export interface ConstructionSiteScene {
  group: THREE.Group;
  /** Call after setConstructionProgress to re-render detail level. */
  refresh(spec: ConstructionSpec): void;
  dispose(): void;
}

/**
 * Builds a fenced site: scaffold tower grid, tower crane, concrete core whose
 * height scales with progress, and a "COMING SOON" billboard naming the
 * linked feature. `onComplete` builders are supplied by the integrator per
 * site (future landmark teams) — until then, finished sites keep a plaza.
 */
export function buildConstructionSite(
  spec: ConstructionSpec,
  onComplete?: (spec: ConstructionSpec) => THREE.Group | null
): ConstructionSiteScene {
  const g = new THREE.Group();
  const [W, D] = spec.footprint;
  const completeGroup = { current: null as THREE.Group | null };

  const steel = new THREE.MeshStandardMaterial({ color: 0xc96a1e, roughness: 0.6, metalness: 0.5 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a6b45, roughness: 0.9 });

  function build() {
    // clear previous (keep nothing — rebuild from spec)
    while (g.children.length) {
      const c = g.children.pop()!;
      g.remove(c);
    }
    if (spec.progress >= 1 && onComplete) {
      const finished = onComplete(spec);
      if (finished) { g.add(finished); completeGroup.current = finished; return; }
    }

    // ground pad
    const pad = new THREE.Mesh(new THREE.BoxGeometry(W, 0.4, D), new THREE.MeshStandardMaterial({ color: 0x6b6f75, roughness: 0.95 }));
    pad.position.y = 0.2; pad.receiveShadow = true;
    g.add(pad);

    // fence perimeter
    const fenceMat = new THREE.MeshStandardMaterial({ color: 0xd97b29, roughness: 0.7 });
    const per = 2 * (W + D);
    const posts = Math.floor(per / 4);
    for (let i = 0; i < posts; i++) {
      const t = i / posts;
      const px = t < 0.5 ? -W / 2 + (t * 2) * W : W / 2 - ((t - 0.5) * 2) * W;
      const pz = t < 0.5 ? -D / 2 : D / 2;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.4, 0.25), fenceMat);
      post.position.set(px, 1.2, pz);
      g.add(post);
    }

    // concrete core — grows with progress
    const coreH = 2 + spec.progress * 18;
    const core = new THREE.Mesh(
      new THREE.BoxGeometry(W * 0.35, coreH, D * 0.35),
      new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.95 })
    );
    core.position.y = coreH / 2;
    core.castShadow = true;
    g.add(core);

    // scaffold grid around the core (density scales with progress)
    const levels = Math.max(1, Math.floor(spec.progress * 6));
    for (let l = 0; l < levels; l++) {
      const y = 2 + l * 3;
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3.2, 6), steel);
        pole.position.set(sx * W * 0.3, y, sz * D * 0.3);
        g.add(pole);
      }
      const deck = new THREE.Mesh(new THREE.BoxGeometry(W * 0.75, 0.18, D * 0.75), wood);
      deck.position.y = y + 1.6;
      g.add(deck);
    }

    // tower crane (appears once framing starts)
    if (spec.progress >= 0.3) {
      const crane = new THREE.Group();
      const mastH = 26;
      const mast = new THREE.Mesh(new THREE.BoxGeometry(1.2, mastH, 1.2), steel);
      mast.position.y = mastH / 2;
      crane.add(mast);
      const jib = new THREE.Mesh(new THREE.BoxGeometry(22, 1, 1), steel);
      jib.position.set(7, mastH, 0);
      crane.add(jib);
      const counter = new THREE.Mesh(new THREE.BoxGeometry(6, 1, 1), steel);
      counter.position.set(-6, mastH, 0);
      crane.add(counter);
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 8, 4), steel);
      cable.position.set(14, mastH - 4, 0);
      crane.add(cable);
      const hook = new THREE.Mesh(new THREE.BoxGeometry(2, 1.4, 1.2), wood);
      hook.position.set(14, mastH - 8.5, 0);
      crane.add(hook);
      crane.position.set(W * 0.32, 0, -D * 0.32);
      // warning beacon
      const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xff2222 })
      );
      beacon.position.y = mastH + 0.8;
      beacon.name = "beacon";
      crane.add(beacon);
      g.add(crane);
    }

    // "COMING SOON" billboard
    const c = document.createElement("canvas");
    c.width = 1024; c.height = 256;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#141414"; ctx.fillRect(0, 0, 1024, 256);
    ctx.fillStyle = "#f5c518"; ctx.font = "bold 64px Arial"; ctx.textAlign = "center";
    ctx.fillText("COMING SOON", 512, 100);
    ctx.fillStyle = "#ffffff"; ctx.font = "bold 48px Arial";
    ctx.fillText(spec.name.toUpperCase(), 512, 170);
    ctx.fillStyle = "#9fb0c3"; ctx.font = "32px Arial";
    ctx.fillText(`${Math.round(spec.progress * 100)}% · ${spec.status}`, 512, 220);
    const tex = new THREE.CanvasTexture(c);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(12, 3), new THREE.MeshBasicMaterial({ map: tex }));
    board.position.set(0, 6, D / 2 + 1);
    g.add(board);
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 6, 0.4), steel);
    b1.position.set(-5, 3, D / 2 + 1);
    const b2 = b1.clone(); b2.position.x = 5;
    g.add(b1, b2);

    g.position.set(spec.position[0], spec.position[1], spec.position[2]);
  }

  build();

  return {
    group: g,
    refresh(newSpec: ConstructionSpec) { build(); },
    dispose() {
      g.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); });
    },
  };
}

/** All current sites as door-less map markers for the HUD/minimap. */
export function constructionMarkers(): { id: string; name: string; position: Vec3T; progress: number }[] {
  return CONSTRUCTION_SITES.map((s) => ({ id: s.id, name: s.name, position: s.position, progress: s.progress }));
}
