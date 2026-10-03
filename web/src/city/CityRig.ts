import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { StyleId } from "./cityState";

/**
 * OrbitX City — trader character rig.
 *
 * Bone hierarchy (feet at y=0):
 *   group → hips (y 0.95) → spine (torso, origin WAIST)
 *                            → head (group at neck y+0.55, parts origin NECK)
 *                            → armL/armR (groups at shoulders ±0.33/+0.47, parts origin SHOULDER)
 *                            → legL/legR (groups at hips ±0.11, parts origin HIP)
 *
 * Part GLBs load async from /city/parts/*.glb (shared cache, cloned per rig).
 * The rig renders immediately with procedural fallback meshes and swaps in
 * the real parts as they resolve — a 404 keeps the fallback (assets are
 * being generated in parallel by a sibling agent).
 */

export interface RigBones {
  hips: THREE.Group;
  spine: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
}

export interface CityRig {
  group: THREE.Group;
  bones: RigBones;
  update: (dt: number, speed01: number) => void;
  setEmote: (name: "dance" | "wave" | null) => void;
  dispose: () => void;
}

interface PartSpec {
  head: string;
  torso: string;
  legs: "teal" | "dark";
  chain: boolean;
  phone: boolean;
  scanner: boolean;
}

const STYLE_PARTS: Record<StyleId, PartSpec> = {
  degen:  { head: "head-beanie", torso: "torso-hoodie", legs: "teal", chain: true,  phone: true,  scanner: false },
  sniper: { head: "head-visor",  torso: "torso-hoodie", legs: "dark", chain: false, phone: false, scanner: true  },
  fox:    { head: "head-foxhood", torso: "torso-hoodie", legs: "dark", chain: true,  phone: false, scanner: false },
  visor:  { head: "head-visor",  torso: "torso-bomber", legs: "dark", chain: false, phone: false, scanner: false },
  bomber: { head: "head-beanie", torso: "torso-bomber", legs: "dark", chain: true,  phone: false, scanner: false },
  suit:   { head: "head-beanie", torso: "torso-suit",   legs: "dark", chain: true,  phone: false, scanner: false },
};

/** Style accent for the procedural fallback (board-faithful). */
const STYLE_ACCENT: Record<StyleId, number> = {
  degen: 0x17e6d4, sniper: 0x1fb6ff, fox: 0xe8a93a,
  visor: 0x17e6d4, bomber: 0xb04ae0, suit: 0xe8a93a,
};

const loader = new GLTFLoader();
/** Shared GLB cache: url → scene clone source (null = failed/404 → fallback). */
const glbCache = new Map<string, Promise<THREE.Group | null>>();

function loadPart(name: string): Promise<THREE.Group | null> {
  const url = `/city/parts/${name}.glb`;
  let p = glbCache.get(url);
  if (!p) {
    p = loader
      .loadAsync(url)
      .then((gltf) => {
        const g = gltf.scene;
        g.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh) m.castShadow = true;
        });
        return g;
      })
      .catch(() => null);
    glbCache.set(url, p);
  }
  return p;
}

function std(color: number, rough = 0.75, emissive = 0, ei = 0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, emissive, emissiveIntensity: ei });
}

function box(w: number, h: number, d: number, material: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.castShadow = true;
  return m;
}

export function buildRig(style: StyleId): CityRig {
  const accent = STYLE_ACCENT[style];
  const spec = STYLE_PARTS[style];
  const disposables: { dispose(): void }[] = [];
  const M = <T extends { dispose(): void }>(m: T): T => { disposables.push(m); return m; };

  const group = new THREE.Group();
  const hips = new THREE.Group(); hips.position.y = 0.95; group.add(hips);
  const spine = new THREE.Group(); spine.position.y = 0.10; hips.add(spine);
  const head = new THREE.Group(); head.position.y = 0.55; hips.add(head);
  const armL = new THREE.Group(); armL.position.set(-0.33, 0.47, 0); hips.add(armL);
  const armR = new THREE.Group(); armR.position.set(0.33, 0.47, 0); hips.add(armR);
  const legL = new THREE.Group(); legL.position.set(-0.11, 0, 0); hips.add(legL);
  const legR = new THREE.Group(); legR.position.set(0.11, 0, 0); hips.add(legR);

  // ── procedural fallback meshes (faceted, board-faithful) ──
  const dark = M(std(0x14161c, 0.8));
  const teal = M(std(0x0f8a80, 0.7));
  const legMat = spec.legs === "teal" ? teal : dark;
  const suitMat = M(std(0x0c0d12, 0.65));
  const gold = M(std(0xd9a441, 0.35));
  const eyeMat = M(std(0x061014, 0.4, 0x17e6d4, 2.2));

  // head fallbacks keyed by part name
  const headFallback = new THREE.Group();
  const skull = box(0.30, 0.30, 0.30, dark); skull.position.y = 0.15; headFallback.add(skull);
  const eyeL = box(0.055, 0.045, 0.02, eyeMat); eyeL.position.set(-0.07, 0.17, 0.155); headFallback.add(eyeL);
  const eyeR = eyeL.clone(); eyeR.position.x = 0.07; headFallback.add(eyeR);
  if (spec.head === "head-beanie") {
    const beanie = box(0.34, 0.14, 0.34, M(std(accent, 0.8))); beanie.position.y = 0.33; headFallback.add(beanie);
  } else if (spec.head === "head-visor") {
    const band = box(0.32, 0.09, 0.31, M(std(0x061014, 0.3, accent, 1.8))); band.position.y = 0.19; headFallback.add(band);
  } else {
    // fox hood: faceted gold head + ears
    const snout = box(0.20, 0.16, 0.16, M(std(accent, 0.8))); snout.position.set(0, 0.10, 0.20); headFallback.add(snout);
    const earG = M(new THREE.ConeGeometry(0.07, 0.18, 4));
    const earL = new THREE.Mesh(earG, M(std(accent, 0.8))); earL.position.set(-0.11, 0.38, 0); earL.rotation.y = Math.PI / 4; earL.castShadow = true; headFallback.add(earL);
    const earR = new THREE.Mesh(earG, M(std(accent, 0.8))); earR.position.set(0.11, 0.38, 0); earR.rotation.y = Math.PI / 4; earR.castShadow = true; headFallback.add(earR);
  }

  const torsoFallback = new THREE.Group();
  const torsoMat = spec.torso === "torso-suit" ? suitMat : spec.torso === "torso-bomber" ? dark : M(std(0x0e5f58, 0.75));
  const chest = box(0.52, 0.55, 0.32, torsoMat); chest.position.y = 0.28; torsoFallback.add(chest);
  if (spec.torso === "torso-hoodie") {
    const x1 = box(0.20, 0.05, 0.02, M(std(accent, 0.6))); x1.position.set(-0.05, 0.35, 0.165); x1.rotation.z = 0.6; torsoFallback.add(x1);
    const x2 = x1.clone(); x2.position.x = 0.05; x2.rotation.z = -0.6; torsoFallback.add(x2);
  }
  if (spec.torso === "torso-suit") {
    const tie = box(0.07, 0.34, 0.02, gold); tie.position.set(0, 0.32, 0.165); torsoFallback.add(tie);
  }
  if (spec.torso === "torso-bomber") {
    const trim = box(0.54, 0.06, 0.34, M(std(accent, 0.6))); trim.position.y = 0.06; torsoFallback.add(trim);
  }

  const mkLimbFallback = (len: number, r: number, material: THREE.Material) => {
    const g = new THREE.Group();
    const seg = new THREE.Mesh(M(new THREE.CapsuleGeometry(r, len, 4, 10)), material);
    seg.position.y = -len / 2; seg.castShadow = true; g.add(seg);
    return g;
  };

  const armFallbackL = mkLimbFallback(0.52, 0.075, dark);
  const armFallbackR = mkLimbFallback(0.52, 0.075, dark);
  const legFallbackL = mkLimbFallback(0.78, 0.10, legMat);
  const legFallbackR = mkLimbFallback(0.78, 0.10, legMat);

  // accessories (procedural)
  const accFallbacks: THREE.Group[] = [];
  if (spec.chain) {
    const chainG = new THREE.Group();
    const ring = new THREE.Mesh(M(new THREE.TorusGeometry(0.13, 0.025, 8, 20)), gold);
    ring.position.set(0, 0.32, 0.16); ring.rotation.x = 0.25; ring.castShadow = true; chainG.add(ring);
    const pendant = box(0.09, 0.11, 0.03, gold); pendant.position.set(0, 0.20, 0.19); chainG.add(pendant);
    spine.add(chainG); accFallbacks.push(chainG);
  }
  if (spec.phone) {
    const ph = new THREE.Group();
    const body = box(0.09, 0.16, 0.025, M(std(0x0a0c12, 0.4))); body.castShadow = true; ph.add(body);
    const scr = box(0.07, 0.12, 0.01, M(std(0x061014, 0.3, 0x17e6d4, 1.4))); scr.position.z = 0.015; ph.add(scr);
    ph.position.set(0, -0.62, 0.10); ph.rotation.x = -0.5;
    armR.add(ph); accFallbacks.push(ph);
  }
  if (spec.scanner) {
    const sc = new THREE.Group();
    const body = box(0.11, 0.11, 0.06, M(std(0x101318, 0.5))); body.castShadow = true; sc.add(body);
    const lens = box(0.06, 0.06, 0.02, M(std(0x061014, 0.3, 0x1fb6ff, 2.0))); lens.position.z = 0.04; sc.add(lens);
    sc.position.set(0, -0.60, 0.12);
    armR.add(sc); accFallbacks.push(sc);
  }

  head.add(headFallback);
  spine.add(torsoFallback);
  armL.add(armFallbackL); armR.add(armFallbackR);
  legL.add(legFallbackL); legR.add(legFallbackR);

  let disposed = false;
  /** GLB clone roots — share cached geometry/materials, never dispose them. */
  const glbRoots = new Set<THREE.Object3D>();
  const tagGlb = (root: THREE.Object3D) => {
    root.traverse((o) => { o.userData.oxcGlb = true; });
    glbRoots.add(root);
  };
  /** Swap a procedural fallback for the real GLB part when it loads. */
  const swapIn = (slot: THREE.Group, fallback: THREE.Object3D, name: string) => {
    loadPart(name).then((src) => {
      if (disposed || !src) return;
      const inst = src.clone(true);
      tagGlb(inst);
      slot.remove(fallback);
      slot.add(inst);
    });
  };
  swapIn(head, headFallback, spec.head);
  swapIn(spine, torsoFallback, spec.torso);
  swapIn(armL, armFallbackL, "armL");
  swapIn(armR, armFallbackR, "armR");
  const legName = spec.legs === "teal" ? ["legL-teal", "legR-teal"] : ["legL", "legR"];
  swapIn(legL, legFallbackL, legName[0]);
  swapIn(legR, legFallbackR, legName[1]);
  // accessories swap at their attach groups (chain→spine, phone/scanner→armR)
  let accIdx = 0;
  const accLoads: [string][] = [];
  if (spec.chain) accLoads.push(["chain"]);
  if (spec.phone) accLoads.push(["phone"]);
  if (spec.scanner) accLoads.push(["scanner"]);
  for (const [name] of accLoads) {
    const fb = accFallbacks[accIdx++];
    if (!fb) continue;
    loadPart(name).then((src) => {
      if (disposed || !src) return;
      const parent = fb.parent;
      if (!parent) return;
      const inst = src.clone(true);
      tagGlb(inst);
      inst.position.copy(fb.position);
      inst.rotation.copy(fb.rotation);
      parent.remove(fb);
      parent.add(inst);
    });
  }

  // ── emotes (dance / wave) override the walk cycle ──
  let emote: "dance" | "wave" | null = null;
  let emoteT = 0;
  const setEmote = (name: "dance" | "wave" | null) => {
    emote = name;
    emoteT = name ? 4 : 0;
  };

  // ── walk cycle (ported from Humanoid.ts) ──
  let phase = Math.random() * 10;
  const update = (dt: number, speed01: number) => {
    const moving = speed01 > 0.03;
    // emote playback (cancels on real movement)
    if (emote) {
      emoteT -= dt;
      if (emoteT <= 0 || speed01 > 0.3) {
        emote = null;
        spine.rotation.y = 0;
        head.rotation.z = 0;
      } else {
        const et = performance.now() / 1000;
        if (emote === "dance") {
          hips.position.y = 0.95 - Math.abs(Math.sin(et * 7)) * 0.12;
          armL.rotation.x = -2.6 + Math.sin(et * 7) * 0.55;
          armR.rotation.x = -2.6 - Math.sin(et * 7) * 0.55;
          armL.rotation.z = 0.55;
          armR.rotation.z = -0.55;
          legL.rotation.x = 0;
          legR.rotation.x = 0;
          head.rotation.z = Math.sin(et * 3.5) * 0.16;
          spine.rotation.y = Math.sin(et * 3.5) * 0.22;
        } else {
          armR.rotation.x = -2.5 + Math.sin(et * 6) * 0.28;
          armR.rotation.z = -0.4;
          armL.rotation.x = Math.sin(et * 2) * 0.12;
          armL.rotation.z = 0.12;
          legL.rotation.x = 0;
          legR.rotation.x = 0;
          head.rotation.y = Math.sin(et * 2) * 0.14;
          hips.position.y = 0.95 + Math.sin(et * 2) * 0.012;
        }
        return;
      }
    }
    phase += dt * (4 + speed01 * 9);
    const amp = moving ? 0.25 + speed01 * 0.55 : 0;
    const swing = Math.sin(phase) * amp;
    const swingO = Math.sin(phase + Math.PI) * amp;
    legL.rotation.x = swing;
    legR.rotation.x = swingO;
    armL.rotation.x = swingO * 0.8;
    armR.rotation.x = swing * 0.8;
    armL.rotation.z = 0.12;
    armR.rotation.z = -0.12;
    hips.position.y =
      0.95 +
      (moving
        ? Math.abs(Math.sin(phase)) * 0.05 * speed01
        : Math.sin(performance.now() / 900) * 0.008);
    head.rotation.y = moving ? Math.sin(phase * 0.5) * 0.06 : 0;
  };

  const dispose = () => {
    disposed = true;
    glbRoots.forEach((r) => r.parent?.remove(r));
    group.traverse((o) => {
      if (o.userData.oxcGlb) return; // cached GLB geometry — never dispose
      const m = o as THREE.Mesh;
      if (m.isMesh && m.geometry) m.geometry.dispose();
    });
    disposables.forEach((d) => d.dispose());
    group.clear();
  };

  return { group, bones: { hips, spine, head, armL, armR, legL, legR }, update, setEmote, dispose };
}

/** Also export the parts map so previews/world stay in sync. */
export { STYLE_PARTS };
