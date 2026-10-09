/**
 * OrbitX City — blocky operative mesh.
 *
 * Built to true R6 blocky proportions in stud units, then normalised to the
 * world's avatar height so it drops in at the same scale as the previous
 * humanoid. Silhouette is driven by the class `build` recipe.
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  getCharacterClass,
  type CharacterClassId,
} from "@/lib/orbitxcity/characterClasses";

export interface BlockCharacterProps {
  classId?: CharacterClassId | string;
  bodyColor?: string;
  skinColor?: string;
  accentColor?: string;
  /** 0 = idle, 1 = full run. Drives limb swing. */
  moveAmount?: number;
  /** Seconds offset so a crowd doesn't animate in lockstep. */
  phase?: number;
  castShadow?: boolean;
}

/* ── Proportions, in studs (R6 reference) ─────────────────── */
const LEG_H = 2.0;
const LEG_W = 1.0;
const LEG_D = 1.0;
const TORSO_H = 2.0;
const TORSO_W = 2.0;
const TORSO_D = 1.0;
const ARM_H = 2.0;
const ARM_W = 1.0;
const HEAD_H = 1.25;

/** Total stud height, and the world height we normalise to. */
const STUD_H = LEG_H + TORSO_H + HEAD_H;
const TARGET_H = 2.3;
const UNIT = TARGET_H / STUD_H;

const HEAD_SHAPE: Record<string, [number, number, number]> = {
  round: [1.5, 1.25, 1.4],
  block: [1.7, 1.3, 1.45],
  wide: [1.85, 1.15, 1.5],
  tall: [1.35, 1.5, 1.3],
  snout: [1.5, 1.25, 1.6],
};

const TORSO_W_BY_BUILD: Record<string, number> = {
  slim: 1.75,
  regular: 2.0,
  broad: 2.3,
  bulk: 2.55,
};

function flat(color: string, emissive?: string, intensity = 0) {
  return (
    <meshStandardMaterial
      color={color}
      emissive={emissive ?? "#000000"}
      emissiveIntensity={intensity}
      roughness={0.7}
      metalness={0.02}
      flatShading
    />
  );
}

export function BlockCharacter({
  classId,
  bodyColor,
  skinColor,
  accentColor,
  moveAmount = 0,
  phase = 0,
  castShadow = true,
}: BlockCharacterProps) {
  const cls = getCharacterClass(classId);
  const build = cls.build;

  const body = bodyColor ?? cls.bodyColor;
  const skin = skinColor ?? cls.skinColor;
  const accent = accentColor ?? cls.accentColor;
  const trim = cls.trimColor;

  const head = HEAD_SHAPE[build.head] ?? HEAD_SHAPE.round!;
  const torsoW = TORSO_W_BY_BUILD[build.torso] ?? TORSO_W;

  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const root = useRef<THREE.Group>(null);

  /* Key Y positions, in studs, measured from the feet. */
  const hipY = LEG_H;
  const shoulderY = LEG_H + TORSO_H;
  const headY = shoulderY + head[1] / 2;

  useFrame((state) => {
    const t = state.clock.elapsedTime + phase;
    const amt = Math.min(1, Math.max(0, moveAmount));
    const swing = Math.sin(t * (3.2 + amt * 5.5)) * (0.1 + amt * 0.72);
    const bob = Math.sin(t * (6.4 + amt * 9)) * (0.012 + amt * 0.05);

    if (armL.current) armL.current.rotation.x = swing;
    if (armR.current) armR.current.rotation.x = -swing;
    if (legL.current) legL.current.rotation.x = -swing * 0.85;
    if (legR.current) legR.current.rotation.x = swing * 0.85;
    if (root.current) root.current.position.y = bob;
  });

  const eye = useMemo(() => {
    switch (build.eyes) {
      case "laser":
        return { color: "#ff2b2b", intensity: 2.2 };
      case "glow":
        return { color: cls.neon, intensity: 1.4 };
      case "shade":
        return { color: "#0a0c11", intensity: 0 };
      default:
        return { color: "#14171f", intensity: 0 };
    }
  }, [build.eyes, cls.neon]);

  return (
    <group scale={[UNIT * cls.scale.x, UNIT * cls.scale.y, UNIT * cls.scale.z]}>
      <group ref={root}>
        {/* ── Torso ─────────────────────────────────────── */}
        <mesh position={[0, hipY + TORSO_H / 2, 0]} castShadow={castShadow} receiveShadow>
          <boxGeometry args={[torsoW, TORSO_H, TORSO_D]} />
          {flat(body)}
        </mesh>

        {/* Chest accent */}
        <mesh position={[0, hipY + TORSO_H * 0.66, TORSO_D / 2 + 0.02]}>
          <boxGeometry args={[torsoW * 0.46, 0.34, 0.05]} />
          {flat(accent, accent, 0.3)}
        </mesh>

        {/* Belt */}
        <mesh position={[0, hipY + 0.16, 0]} castShadow={castShadow}>
          <boxGeometry args={[torsoW + 0.04, 0.3, TORSO_D + 0.04]} />
          {flat(trim)}
        </mesh>

        {/* ── Head ──────────────────────────────────────── */}
        <group position={[0, headY, 0]}>
          <mesh castShadow={castShadow}>
            <boxGeometry args={head} />
            {flat(skin)}
          </mesh>

          {[-1, 1].map((s) => (
            <mesh
              key={s}
              position={[s * head[0] * 0.23, head[1] * 0.12, head[2] / 2 + 0.02]}
            >
              <boxGeometry args={[head[0] * 0.19, head[1] * 0.17, 0.05]} />
              {flat(eye.color, eye.color, eye.intensity)}
            </mesh>
          ))}

          {/* Mouth line keeps the face readable at distance */}
          <mesh position={[0, -head[1] * 0.22, head[2] / 2 + 0.02]}>
            <boxGeometry args={[head[0] * 0.34, 0.06, 0.04]} />
            {flat("#1b1f28")}
          </mesh>

          {build.head === "snout" && (
            <mesh
              position={[0, -head[1] * 0.16, head[2] / 2 + 0.22]}
              castShadow={castShadow}
            >
              <boxGeometry args={[head[0] * 0.44, head[1] * 0.36, 0.46]} />
              {flat(trim)}
            </mesh>
          )}

          {/* Ears for the canine build */}
          {build.head === "snout" &&
            [-1, 1].map((s) => (
              <mesh
                key={s}
                position={[s * head[0] * 0.32, head[1] * 0.62, 0]}
                castShadow={castShadow}
              >
                <boxGeometry args={[0.28, 0.42, 0.16]} />
                {flat(trim)}
              </mesh>
            ))}

          {build.headgear === "cap" && (
            <group position={[0, head[1] / 2 + 0.12, 0]}>
              <mesh castShadow={castShadow}>
                <boxGeometry args={[head[0] * 1.03, 0.26, head[2] * 1.03]} />
                {flat(accent)}
              </mesh>
              <mesh position={[0, -0.02, head[2] * 0.62]} castShadow={castShadow}>
                <boxGeometry args={[head[0] * 0.86, 0.1, 0.46]} />
                {flat(accent)}
              </mesh>
            </group>
          )}

          {build.headgear === "beanie" && (
            <mesh position={[0, head[1] / 2 + 0.16, 0]} castShadow={castShadow}>
              <boxGeometry args={[head[0] * 1.05, 0.44, head[2] * 1.05]} />
              {flat(accent)}
            </mesh>
          )}

          {build.headgear === "hood" && (
            <>
              <mesh
                position={[0, head[1] * 0.1, -head[2] * 0.2]}
                castShadow={castShadow}
              >
                <boxGeometry args={[head[0] * 1.18, head[1] * 1.12, head[2] * 1.12]} />
                {flat(body)}
              </mesh>
              <mesh position={[0, head[1] * 0.08, head[2] * 0.44]}>
                <boxGeometry args={[head[0] * 0.94, head[1] * 0.88, 0.05]} />
                {flat("#05070a")}
              </mesh>
            </>
          )}

          {build.headgear === "visor" && (
            <mesh
              position={[0, head[1] * 0.12, head[2] / 2 + 0.04]}
              castShadow={castShadow}
            >
              <boxGeometry args={[head[0] * 1.04, head[1] * 0.28, 0.1]} />
              {flat(cls.neon, cls.neon, 1.1)}
            </mesh>
          )}

          {build.headgear === "crown" && (
            <mesh position={[0, head[1] / 2 + 0.2, 0]} castShadow={castShadow}>
              <boxGeometry args={[head[0] * 0.88, 0.34, head[2] * 0.88]} />
              {flat(cls.gold, cls.gold, 0.45)}
            </mesh>
          )}
        </group>

        {/* ── Arms — pivot at the shoulder ──────────────── */}
        {[-1, 1].map((s) => (
          <group
            key={s}
            ref={s < 0 ? armL : armR}
            position={[s * (torsoW / 2 + ARM_W / 2), shoulderY, 0]}
          >
            <mesh position={[0, -ARM_H / 2, 0]} castShadow={castShadow}>
              <boxGeometry args={[ARM_W, ARM_H, TORSO_D]} />
              {flat(body)}
            </mesh>
            {/* Hand */}
            <mesh position={[0, -ARM_H + 0.14, 0]} castShadow={castShadow}>
              <boxGeometry args={[ARM_W + 0.02, 0.32, TORSO_D + 0.02]} />
              {flat(skin)}
            </mesh>
          </group>
        ))}

        {/* ── Legs — pivot at the hip ───────────────────── */}
        {[-1, 1].map((s) => (
          <group key={s} ref={s < 0 ? legL : legR} position={[s * (LEG_W / 2), hipY, 0]}>
            <mesh position={[0, -LEG_H / 2, 0]} castShadow={castShadow}>
              <boxGeometry args={[LEG_W, LEG_H, LEG_D]} />
              {flat(trim)}
            </mesh>
            {/* Shoe sits flush with the ground plane */}
            <mesh position={[0, -LEG_H + 0.13, 0.08]} castShadow={castShadow}>
              <boxGeometry args={[LEG_W + 0.04, 0.26, LEG_D + 0.16]} />
              {flat("#1a1d24")}
            </mesh>
          </group>
        ))}

        {/* ── Trailing accessory ────────────────────────── */}
        {build.trail === "cape" && (
          <mesh
            position={[0, hipY + TORSO_H * 0.55, -TORSO_D / 2 - 0.09]}
            castShadow={castShadow}
          >
            <boxGeometry args={[torsoW * 0.92, TORSO_H * 1.15, 0.08]} />
            {flat(accent, accent, 0.2)}
          </mesh>
        )}

        {build.trail === "scarf" && (
          <mesh position={[0, shoulderY - 0.1, 0]} castShadow={castShadow}>
            <boxGeometry args={[torsoW * 0.8, 0.32, TORSO_D * 1.35]} />
            {flat(accent)}
          </mesh>
        )}

        {build.trail === "tail" && (
          <mesh
            position={[0, hipY + 0.35, -TORSO_D / 2 - 0.3]}
            rotation={[0.6, 0, 0]}
            castShadow={castShadow}
          >
            <boxGeometry args={[0.34, 1.2, 0.34]} />
            {flat(trim)}
          </mesh>
        )}
      </group>
    </group>
  );
}
