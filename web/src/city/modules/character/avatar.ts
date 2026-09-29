/**
 * Procedural character avatar — realistic proportions (capsules/spheres, not
 * blocky), with named part anchors so the module can layer hair styles,
 * facial hair, tattoo decals and clothing extras on top.
 *
 * Intentionally independent of core's `createHumanoid` (which NPCs use): the
 * creator needs precise anchors. If core later exposes a player-mesh
 * appearance hook, `applyToCorePlayer` in MODULE.md describes the swap.
 */
import * as THREE from "three";
import type { Appearance, OutfitSlot, TattooZone } from "./types";
import { clothingById, HAIR_COLORS, SKIN_TONES, tattooById } from "./data";

export interface AvatarHandle {
  group: THREE.Group;
  update: (dt: number, speed01: number) => void;
  dispose: () => void;
}

function mat(color: number, rough = 0.8): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: rough });
}

function skinHex(appearance: Appearance): number {
  return SKIN_TONES.find((s) => s.id === appearance.skinToneId)?.color ?? 0xd9a583;
}

function hairHex(appearance: Appearance): number {
  return HAIR_COLORS.find((h) => h.id === appearance.hairColorId)?.color ?? 0x141210;
}

function slotColor(slot: OutfitSlot, outfit: Partial<Record<OutfitSlot, string>>, fallback: number): number {
  const id = outfit[slot];
  if (id) {
    const item = clothingById(id);
    if (item) return item.color;
  }
  return fallback;
}

/** Procedural tattoo decal texture (drawn, not loaded — offline safe). */
function tattooTexture(designId: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 128; c.height = 128;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, 128, 128);
  g.strokeStyle = "#101418";
  g.fillStyle = "#101418";
  g.lineWidth = 5;
  g.lineCap = "round";
  switch (designId) {
    case "ink-orbit":
      g.beginPath(); g.arc(64, 64, 34, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.ellipse(64, 64, 56, 18, -0.5, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.arc(64, 64, 8, 0, Math.PI * 2); g.fill();
      break;
    case "ink-skull":
      g.beginPath(); g.arc(64, 52, 30, 0, Math.PI * 2); g.fill();
      g.fillRect(44, 74, 40, 22);
      g.fillStyle = "#ffffff";
      g.beginPath(); g.arc(52, 48, 8, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(76, 48, 8, 0, Math.PI * 2); g.fill();
      break;
    case "ink-flames":
      for (let i = 0; i < 5; i++) {
        const x = 20 + i * 22;
        g.beginPath();
        g.moveTo(x, 120);
        g.quadraticCurveTo(x - 12, 70, x, 30);
        g.quadraticCurveTo(x + 12, 70, x, 120);
        g.fill();
      }
      break;
    case "ink-tribal":
      g.lineWidth = 9;
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.moveTo(10, 40 + i * 24);
        g.bezierCurveTo(44, 20 + i * 24, 84, 60 + i * 24, 118, 40 + i * 24);
        g.stroke();
      }
      break;
    case "ink-bolt":
      g.beginPath();
      g.moveTo(74, 8); g.lineTo(44, 72); g.lineTo(64, 72);
      g.lineTo(54, 120); g.lineTo(92, 52); g.lineTo(70, 52);
      g.closePath(); g.fill();
      break;
    case "ink-rose":
      g.beginPath(); g.arc(64, 64, 26, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.arc(64, 64, 12, 0, Math.PI * 2); g.stroke();
      g.lineWidth = 8;
      g.beginPath(); g.moveTo(30, 100); g.lineTo(98, 28); g.stroke();
      break;
    case "ink-code":
      let x = 18;
      while (x < 110) {
        const w = 3 + Math.floor(Math.random() * 8);
        g.fillRect(x, 30, w, 68);
        x += w + 4;
      }
      break;
    default: // ink-wave — concentric arcs
      g.lineWidth = 7;
      for (let r = 14; r < 70; r += 14) {
        g.beginPath(); g.arc(64, 110, r, Math.PI, Math.PI * 2); g.stroke();
      }
      break;
  }
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

const ZONE_ANCHOR: Record<TattooZone, { pos: [number, number, number]; rotY: number; scale: number }> = {
  armL: { pos: [-0.36, 0.32, 0.06], rotY: -0.5, scale: 0.16 },
  armR: { pos: [0.36, 0.32, 0.06], rotY: 0.5, scale: 0.16 },
  chest: { pos: [0, 0.42, 0.2], rotY: 0, scale: 0.24 },
  back: { pos: [0, 0.42, -0.2], rotY: Math.PI, scale: 0.3 },
  neck: { pos: [0, 0.78, 0.1], rotY: 0, scale: 0.1 },
};

export function buildAvatar(
  appearance: Appearance,
  outfit: Partial<Record<OutfitSlot, string>>,
  tattooIds: string[],
): AvatarHandle {
  const skin = skinHex(appearance);
  const hairC = hairHex(appearance);
  const top = slotColor("top", outfit, 0x1f6f5f);
  const bottom = slotColor("bottom", outfit, 0x23262e);
  const headItem = outfit.head ? clothingById(outfit.head) : undefined;
  const outerOn = !!outfit.outer;
  const shoeC = slotColor("shoes", outfit, 0x14161a);
  const s = 1;

  const group = new THREE.Group();
  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(d: T): T => { disposables.push(d); return d; };

  const hips = new THREE.Group();
  hips.position.y = 0.98 * s;
  group.add(hips);

  // torso (outer jacket = slightly larger shell)
  const torsoC = outerOn ? slotColor("outer", outfit, 0x101418) : top;
  const torso = new THREE.Mesh(track(new THREE.CapsuleGeometry((outerOn ? 0.235 : 0.21) * s, 0.42 * s, 6, 12)), mat(torsoC));
  torso.position.y = 0.36 * s;
  torso.castShadow = true;
  hips.add(torso);

  const neckG = new THREE.Group();
  neckG.position.y = 0.66 * s;
  hips.add(neckG);
  const head = new THREE.Mesh(track(new THREE.SphereGeometry(0.145 * s, 20, 16)), mat(skin, 0.55));
  head.position.y = 0.16 * s;
  head.scale.set(0.92, 1.05, 0.98);
  head.castShadow = true;
  neckG.add(head);
  const nose = new THREE.Mesh(track(new THREE.SphereGeometry(0.025 * s, 8, 6)), mat(skin, 0.6));
  nose.position.set(0, 0.15 * s, 0.14 * s);
  neckG.add(nose);

  // ---- hair styles ----
  const hairM = mat(hairC, 0.95);
  const addHair = (mesh: THREE.Mesh) => neckG.add(mesh);
  switch (appearance.hairStyleId) {
    case "bald": break;
    case "buzz": {
      const cap = new THREE.Mesh(track(new THREE.SphereGeometry(0.148 * s, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.45)), hairM);
      cap.position.y = 0.175 * s; addHair(cap); break;
    }
    case "slick": {
      const cap = new THREE.Mesh(track(new THREE.SphereGeometry(0.15 * s, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5)), hairM);
      cap.position.y = 0.175 * s; cap.scale.set(0.95, 0.85, 1); addHair(cap); break;
    }
    case "fade": {
      const cap = new THREE.Mesh(track(new THREE.SphereGeometry(0.15 * s, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55)), hairM);
      cap.position.y = 0.175 * s; addHair(cap); break;
    }
    case "curls": {
      for (let i = 0; i < 9; i++) {
        const curl = new THREE.Mesh(track(new THREE.SphereGeometry(0.05 * s, 10, 8)), hairM);
        const a = (i / 9) * Math.PI * 2;
        curl.position.set(Math.cos(a) * 0.1 * s, 0.28 * s + (i % 3) * 0.02, Math.sin(a) * 0.1 * s);
        addHair(curl);
      }
      break;
    }
    case "ponytail": {
      const cap = new THREE.Mesh(track(new THREE.SphereGeometry(0.15 * s, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5)), hairM);
      cap.position.y = 0.175 * s; addHair(cap);
      const tail = new THREE.Mesh(track(new THREE.CapsuleGeometry(0.035 * s, 0.22 * s, 4, 8)), hairM);
      tail.position.set(0, 0.05 * s, -0.16 * s); tail.rotation.x = 0.35; addHair(tail);
      break;
    }
    case "mohawk": {
      const strip = new THREE.Mesh(track(new THREE.BoxGeometry(0.05 * s, 0.16 * s, 0.24 * s)), hairM);
      strip.position.set(0, 0.3 * s, 0); addHair(strip); break;
    }
    case "dreads": {
      const cap = new THREE.Mesh(track(new THREE.SphereGeometry(0.15 * s, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5)), hairM);
      cap.position.y = 0.175 * s; addHair(cap);
      for (let i = 0; i < 7; i++) {
        const d = new THREE.Mesh(track(new THREE.CapsuleGeometry(0.022 * s, 0.2 * s, 4, 6)), hairM);
        const a = (i / 7) * Math.PI * 2;
        d.position.set(Math.cos(a) * 0.13 * s, 0.02 * s, Math.sin(a) * 0.13 * s);
        addHair(d);
      }
      break;
    }
  }

  // ---- facial hair ----
  const beardM = mat(hairC, 0.95);
  switch (appearance.facialHairId) {
    case "stubble": {
      const j = new THREE.Mesh(track(new THREE.SphereGeometry(0.1 * s, 12, 8, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.4)), beardM);
      j.position.y = 0.15 * s; j.scale.set(0.95, 0.9, 1); neckG.add(j); break;
    }
    case "goatee": {
      const go = new THREE.Mesh(track(new THREE.BoxGeometry(0.07 * s, 0.09 * s, 0.05 * s)), beardM);
      go.position.set(0, 0.05 * s, 0.13 * s); neckG.add(go); break;
    }
    case "beard": {
      const b = new THREE.Mesh(track(new THREE.SphereGeometry(0.115 * s, 14, 10, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.5)), beardM);
      b.position.y = 0.14 * s; b.scale.set(0.95, 1.05, 1); neckG.add(b); break;
    }
    case "mustache": {
      const mu = new THREE.Mesh(track(new THREE.BoxGeometry(0.09 * s, 0.025 * s, 0.03 * s)), beardM);
      mu.position.set(0, 0.1 * s, 0.135 * s); neckG.add(mu); break;
    }
    case "none": break;
  }

  // ---- headwear ----
  if (headItem?.id === "cap-orbitx") {
    const crown = new THREE.Mesh(track(new THREE.SphereGeometry(0.155 * s, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5)), mat(headItem.color, 0.7));
    crown.position.y = 0.2 * s; neckG.add(crown);
    const brim = new THREE.Mesh(track(new THREE.CylinderGeometry(0.16 * s, 0.16 * s, 0.02 * s, 16, 1, false, 0, Math.PI)), mat(headItem.color, 0.7));
    brim.position.set(0, 0.2 * s, 0.12 * s); brim.rotation.x = 0.1; brim.scale.z = 1.4; neckG.add(brim);
  } else if (headItem?.id === "beanie-neon") {
    const bn = new THREE.Mesh(track(new THREE.SphereGeometry(0.16 * s, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.62)), mat(headItem.color, 0.9));
    bn.position.y = 0.185 * s; bn.scale.y = 1.15; neckG.add(bn);
  } else if (headItem?.id === "hat-fedora") {
    const brimF = new THREE.Mesh(track(new THREE.CylinderGeometry(0.22 * s, 0.22 * s, 0.02 * s, 20)), mat(headItem.color, 0.6));
    brimF.position.y = 0.26 * s; neckG.add(brimF);
    const crownF = new THREE.Mesh(track(new THREE.CylinderGeometry(0.11 * s, 0.12 * s, 0.14 * s, 16)), mat(headItem.color, 0.6));
    crownF.position.y = 0.33 * s; neckG.add(crownF);
  }

  // ---- arms ----
  const mkArm = (side: 1 | -1) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(0.27 * s * side, 0.56 * s, 0);
    const upper = new THREE.Mesh(track(new THREE.CapsuleGeometry(0.07 * s, 0.26 * s, 4, 8)), mat(top));
    upper.position.y = -0.17 * s; upper.castShadow = true; shoulder.add(upper);
    const elbow = new THREE.Group(); elbow.position.y = -0.32 * s;
    const lower = new THREE.Mesh(track(new THREE.CapsuleGeometry(0.06 * s, 0.24 * s, 4, 8)), mat(skin, 0.6));
    lower.position.y = -0.15 * s; lower.castShadow = true; elbow.add(lower);
    const hand = new THREE.Mesh(track(new THREE.SphereGeometry(0.07 * s, 10, 8)), mat(skin, 0.6));
    hand.position.y = -0.3 * s; elbow.add(hand);
    shoulder.add(elbow); elbow.rotation.x = -0.25;
    hips.add(shoulder);
    return shoulder;
  };
  const armL = mkArm(-1);
  const armR = mkArm(1);

  // ---- legs ----
  const mkLeg = (side: 1 | -1) => {
    const hip = new THREE.Group();
    hip.position.set(0.11 * s * side, 0.02 * s, 0);
    const thigh = new THREE.Mesh(track(new THREE.CapsuleGeometry(0.095 * s, 0.3 * s, 4, 8)), mat(bottom));
    thigh.position.y = -0.22 * s; thigh.castShadow = true; hip.add(thigh);
    const knee = new THREE.Group(); knee.position.y = -0.44 * s;
    const shin = new THREE.Mesh(track(new THREE.CapsuleGeometry(0.075 * s, 0.3 * s, 4, 8)), mat(bottom, 0.85));
    shin.position.y = -0.2 * s; shin.castShadow = true; knee.add(shin);
    const shoe = new THREE.Mesh(track(new THREE.BoxGeometry(0.13 * s, 0.09 * s, 0.26 * s)), mat(shoeC, 0.5));
    shoe.position.set(0, -0.4 * s, 0.05 * s); knee.add(shoe);
    hip.add(knee); hips.add(hip);
    return { hip, knee };
  };
  const legL = mkLeg(-1);
  const legR = mkLeg(1);

  // ---- tattoos (decal planes on the torso/arms group) ----
  for (const tid of tattooIds) {
    const design = tattooById(tid);
    if (!design) continue;
    const anchor = ZONE_ANCHOR[design.zone];
    const tex = track(tattooTexture(design.id));
    const decal = new THREE.Mesh(
      track(new THREE.PlaneGeometry(anchor.scale * 2, anchor.scale * 2)),
      track(new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.92, polygonOffset: true, polygonOffsetFactor: -2 })),
    );
    decal.position.set(anchor.pos[0] * s, anchor.pos[1] * s, anchor.pos[2] * s);
    decal.rotation.y = anchor.rotY;
    hips.add(decal);
  }

  // ---- walk cycle (mirrors core humanoid feel) ----
  let phase = Math.random() * 10;
  const update = (dt: number, speed01: number) => {
    const moving = speed01 > 0.03;
    phase += dt * (4 + speed01 * 9);
    const amp = moving ? 0.25 + speed01 * 0.55 : 0;
    const swing = Math.sin(phase) * amp;
    const swingO = Math.sin(phase + Math.PI) * amp;
    legL.hip.rotation.x = swing;
    legR.hip.rotation.x = swingO;
    legL.knee.rotation.x = Math.max(0, -swingO) * 1.2;
    legR.knee.rotation.x = Math.max(0, -swing) * 1.2;
    armL.rotation.x = swingO * 0.8;
    armR.rotation.x = swing * 0.8;
    armL.rotation.z = 0.12;
    armR.rotation.z = -0.12;
    hips.position.y = 0.98 * s + (moving
      ? Math.abs(Math.sin(phase)) * 0.05 * s * speed01
      : Math.sin(performance.now() / 900) * 0.008 * s);
    neckG.rotation.y = moving ? Math.sin(phase * 0.5) * 0.06 : 0;
  };

  const dispose = () => {
    group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        const g = m.geometry as THREE.BufferGeometry | undefined;
        g?.dispose();
      }
    });
    disposables.forEach((d) => d.dispose());
  };

  return { group, update, dispose };
}
