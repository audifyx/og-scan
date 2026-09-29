import * as THREE from "three";

export interface HumanoidOpts {
  skin?: number;
  shirt?: number;
  pants?: number;
  hair?: number;
  scale?: number;
}

export interface Humanoid {
  group: THREE.Group;
  /** Advance the walk cycle. speed01 = 0 idle → 1 full run. */
  update: (dt: number, speed01: number) => void;
  dispose: () => void;
}

function mat(color: number, rough = 0.8): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: rough });
}

/**
 * Procedural realistic-proportioned humanoid (not blocky): capsule torso,
 * sphere head, articulated arms/legs pivoted at shoulders/hips.
 */
export function createHumanoid(opts: HumanoidOpts = {}): Humanoid {
  const skin = opts.skin ?? 0xd9a583;
  const shirt = opts.shirt ?? 0x1f6f5f;
  const pants = opts.pants ?? 0x23262e;
  const hairC = opts.hair ?? 0x1a1410;
  const s = opts.scale ?? 1;

  const group = new THREE.Group();
  const mats: THREE.Material[] = [];

  const M = (m: THREE.Material) => { mats.push(m); return m; };

  // hips root
  const hips = new THREE.Group();
  hips.position.y = 0.98 * s;
  group.add(hips);

  // torso
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.21 * s, 0.42 * s, 6, 12), M(mat(shirt)));
  torso.position.y = 0.36 * s;
  torso.castShadow = true;
  hips.add(torso);
  // jacket collar
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.13 * s, 0.045 * s, 8, 14), M(mat(shirt, 0.7)));
  collar.position.y = 0.62 * s;
  collar.rotation.x = Math.PI / 2;
  hips.add(collar);

  // head
  const neckG = new THREE.Group();
  neckG.position.y = 0.66 * s;
  hips.add(neckG);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.145 * s, 18, 14), M(mat(skin, 0.6)));
  head.position.y = 0.16 * s;
  head.scale.set(0.92, 1.05, 0.98);
  head.castShadow = true;
  neckG.add(head);
  // hair cap
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.15 * s, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), M(mat(hairC, 0.95)));
  hair.position.y = 0.175 * s;
  hair.scale.set(0.95, 1, 1);
  neckG.add(hair);
  // nose hint
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.025 * s, 8, 6), M(mat(skin, 0.6)));
  nose.position.set(0, 0.15 * s, 0.14 * s);
  neckG.add(nose);

  // arms (pivot at shoulder)
  const mkArm = (side: 1 | -1) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(0.27 * s * side, 0.56 * s, 0);
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.07 * s, 0.26 * s, 4, 8), M(mat(shirt)));
    upper.position.y = -0.17 * s;
    upper.castShadow = true;
    shoulder.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -0.32 * s;
    const lower = new THREE.Mesh(new THREE.CapsuleGeometry(0.06 * s, 0.24 * s, 4, 8), M(mat(skin, 0.6)));
    lower.position.y = -0.15 * s;
    lower.castShadow = true;
    elbow.add(lower);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.07 * s, 10, 8), M(mat(skin, 0.6)));
    hand.position.y = -0.3 * s;
    elbow.add(hand);
    shoulder.add(elbow);
    elbow.rotation.x = -0.25;
    hips.add(shoulder);
    return shoulder;
  };
  const armL = mkArm(-1);
  const armR = mkArm(1);

  // legs (pivot at hip)
  const mkLeg = (side: 1 | -1) => {
    const hip = new THREE.Group();
    hip.position.set(0.11 * s * side, 0.02 * s, 0);
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.095 * s, 0.3 * s, 4, 8), M(mat(pants)));
    thigh.position.y = -0.22 * s;
    thigh.castShadow = true;
    hip.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -0.44 * s;
    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.075 * s, 0.3 * s, 4, 8), M(mat(pants, 0.85)));
    shin.position.y = -0.2 * s;
    shin.castShadow = true;
    knee.add(shin);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.13 * s, 0.09 * s, 0.26 * s), M(mat(0x14161a, 0.5)));
    shoe.position.set(0, -0.4 * s, 0.05 * s);
    knee.add(shoe);
    hip.add(knee);
    hips.add(hip);
    return { hip, knee };
  };
  const legL = mkLeg(-1);
  const legR = mkLeg(1);

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
    // bob + breathe
    hips.position.y = 0.98 * s + (moving ? Math.abs(Math.sin(phase)) * 0.05 * s * speed01 : Math.sin(performance.now() / 900) * 0.008 * s);
    neckG.rotation.y = moving ? Math.sin(phase * 0.5) * 0.06 : 0;
  };

  const dispose = () => {
    mats.forEach((m) => m.dispose());
  };

  return { group, update, dispose };
}

export const PED_COLORS: HumanoidOpts[] = [
  { skin: 0xd9a583, shirt: 0x8a2f2f, pants: 0x23262e, hair: 0x1a1410 },
  { skin: 0x8c5a3a, shirt: 0x2f5f8a, pants: 0x3a3f47, hair: 0x0d0b09 },
  { skin: 0xe8b98f, shirt: 0x3f7a4a, pants: 0x1d2026, hair: 0x4a2f18 },
  { skin: 0xc98a5e, shirt: 0x6a3f8a, pants: 0x2c2f36, hair: 0x141210 },
  { skin: 0xa06a42, shirt: 0xb0762a, pants: 0x23262e, hair: 0x0d0b09 },
  { skin: 0xd9a583, shirt: 0x2a2d33, pants: 0x4a3b2a, hair: 0x6a4a2a },
];
