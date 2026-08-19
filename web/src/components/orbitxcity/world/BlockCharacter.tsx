/**
 * OrbitX City — blocky operative mesh.
 *
 * Roblox-style proportions: box torso, cylinder-free limbs, oversized head.
 * Silhouette is driven entirely by the class `build` recipe so all six
 * mascots read differently from across the street.
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
  /** Overrides from the character creator. */
  bodyColor?: string;
  skinColor?: string;
  accentColor?: string;
  /** 0 = idle, 1 = full run. Drives limb swing. */
  moveAmount?: number;
  /** Seconds offset so a crowd doesn't animate in lockstep. */
  phase?: number;
  castShadow?: boolean;
}

const HEAD_SHAPE: Record<string, [number, number, number]> = {
  round: [1.05, 1.0, 1.05],
  block: [1.2, 1.05, 1.1],
  wide: [1.35, 0.92, 1.15],
  tall: [0.95, 1.25, 0.95],
  snout: [1.1, 1.0, 1.3],
};

const TORSO_SHAPE: Record<string, [number, number, number]> = {
  slim: [1.15, 1.5, 0.62],
  regular: [1.35, 1.5, 0.72],
  broad: [1.6, 1.5, 0.8],
  bulk: [1.85, 1.55, 0.92],
};

function flat(color: string, emissive?: string, intensity = 0) {
  return (
    <meshStandardMaterial
      color={color}
      emissive={emissive ?? "#000000"}
      emissiveIntensity={intensity}
      roughness={0.68}
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
  const torso = TORSO_SHAPE[build.torso] ?? TORSO_SHAPE.regular!;

  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const root = useRef<THREE.Group>(null);

  const torsoTop = 1.7 + torso[1] / 2;

  useFrame((state) => {
    const t = state.clock.elapsedTime + phase;
    const swing = Math.sin(t * (4 + moveAmount * 5)) * (0.18 + moveAmount * 0.75);
    const bob = Math.sin(t * (8 + moveAmount * 8)) * (0.02 + moveAmount * 0.07);

    if (armL.current) armL.current.rotation.x = swing;
    if (armR.current) armR.current.rotation.x = -swing;
    if (legL.current) legL.current.rotation.x = -swing * 0.9;
    if (legR.current) legR.current.rotation.x = swing * 0.9;
    if (root.current) root.current.position.y = bob;
  });

  const eyeEmissive = useMemo(() => {
    switch (build.eyes) {
      case "laser":
        return { color: "#ff2b2b", intensity: 2.4 };
      case "glow":
        return { color: cls.neon, intensity: 1.5 };
      case "shade":
        return { color: "#0a0c11", intensity: 0 };
      default:
        return { color: "#12151c", intensity: 0 };
    }
  }, [build.eyes, cls.neon]);

  return (
    <group ref={root} scale={[cls.scale.x, cls.scale.y, cls.scale.z]}>
      {/* Torso */}
      <mesh position={[0, 1.7 + torso[1] / 2, 0]} castShadow={castShadow} receiveShadow>
        <boxGeometry args={torso} />
        {flat(body)}
      </mesh>

      {/* Chest accent stripe */}
      <mesh position={[0, 1.7 + torso[1] * 0.62, torso[2] / 2 + 0.02]}>
        <boxGeometry args={[torso[0] * 0.5, 0.26, 0.06]} />
        {flat(accent, accent, 0.35)}
      </mesh>

      {/* Head */}
      <group position={[0, torsoTop + head[1] / 2 + 0.12, 0]}>
        <mesh castShadow={castShadow}>
          <boxGeometry args={head} />
          {flat(skin)}
        </mesh>

        {/* Eyes */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * head[0] * 0.22, head[1] * 0.1, head[2] / 2 + 0.03]}>
            <boxGeometry args={[head[0] * 0.2, head[1] * 0.16, 0.06]} />
            {flat(eyeEmissive.color, eyeEmissive.color, eyeEmissive.intensity)}
          </mesh>
        ))}

        {/* Snout for the canine build */}
        {build.head === "snout" && (
          <mesh position={[0, -head[1] * 0.18, head[2] / 2 + 0.18]} castShadow={castShadow}>
            <boxGeometry args={[head[0] * 0.42, head[1] * 0.34, 0.42]} />
            {flat(trim)}
          </mesh>
        )}

        {/* Headgear */}
        {build.headgear === "cap" && (
          <group position={[0, head[1] / 2 + 0.1, 0]}>
            <mesh castShadow={castShadow}>
              <boxGeometry args={[head[0] * 1.04, 0.24, head[2] * 1.04]} />
              {flat(accent)}
            </mesh>
            <mesh position={[0, -0.02, head[2] * 0.6]} castShadow={castShadow}>
              <boxGeometry args={[head[0] * 0.9, 0.1, 0.5]} />
              {flat(accent)}
            </mesh>
          </group>
        )}

        {build.headgear === "beanie" && (
          <mesh position={[0, head[1] / 2 + 0.14, 0]} castShadow={castShadow}>
            <boxGeometry args={[head[0] * 1.06, 0.4, head[2] * 1.06]} />
            {flat(accent)}
          </mesh>
        )}

        {build.headgear === "hood" && (
          <group>
            <mesh position={[0, head[1] * 0.16, -head[2] * 0.22]} castShadow={castShadow}>
              <boxGeometry args={[head[0] * 1.22, head[1] * 1.15, head[2] * 1.1]} />
              {flat(body)}
            </mesh>
            <mesh position={[0, head[1] * 0.16, head[2] * 0.42]}>
              <boxGeometry args={[head[0] * 1.0, head[1] * 0.94, 0.06]} />
              {flat("#05070a")}
            </mesh>
          </group>
        )}

        {build.headgear === "visor" && (
          <mesh position={[0, head[1] * 0.12, head[2] / 2 + 0.06]} castShadow={castShadow}>
            <boxGeometry args={[head[0] * 1.06, head[1] * 0.3, 0.12]} />
            {flat(cls.neon, cls.neon, 1.2)}
          </mesh>
        )}

        {build.headgear === "crown" && (
          <mesh position={[0, head[1] / 2 + 0.2, 0]} castShadow={castShadow}>
            <boxGeometry args={[head[0] * 0.9, 0.36, head[2] * 0.9]} />
            {flat(cls.gold, cls.gold, 0.5)}
          </mesh>
        )}
      </group>

      {/* Arms */}
      {[-1, 1].map((s) => (
        <group
          key={s}
          ref={s < 0 ? armL : armR}
          position={[s * (torso[0] / 2 + 0.28), torsoTop - 0.06, 0]}
        >
          <mesh position={[0, -0.68, 0]} castShadow={castShadow}>
            <boxGeometry args={[0.44, 1.36, 0.44]} />
            {flat(body)}
          </mesh>
          <mesh position={[0, -1.42, 0]} castShadow={castShadow}>
            <boxGeometry args={[0.46, 0.3, 0.46]} />
            {flat(skin)}
          </mesh>
        </group>
      ))}

      {/* Legs */}
      {[-1, 1].map((s) => (
        <group key={s} ref={s < 0 ? legL : legR} position={[s * 0.34, 1.7, 0]}>
          <mesh position={[0, -0.85, 0]} castShadow={castShadow}>
            <boxGeometry args={[0.52, 1.7, 0.52]} />
            {flat(trim)}
          </mesh>
          <mesh position={[0, -1.78, 0.08]} castShadow={castShadow}>
            <boxGeometry args={[0.56, 0.26, 0.7]} />
            {flat("#1a1d24")}
          </mesh>
        </group>
      ))}

      {/* Trailing accessory */}
      {build.trail === "cape" && (
        <mesh position={[0, torsoTop - 0.5, -torso[2] / 2 - 0.12]} castShadow={castShadow}>
          <boxGeometry args={[torso[0] * 0.96, 1.9, 0.1]} />
          {flat(accent, accent, 0.25)}
        </mesh>
      )}

      {build.trail === "scarf" && (
        <mesh position={[0, torsoTop + 0.08, 0]} castShadow={castShadow}>
          <boxGeometry args={[torso[0] * 0.82, 0.3, torso[2] * 1.3]} />
          {flat(accent)}
        </mesh>
      )}

      {build.trail === "tail" && (
        <mesh
          position={[0, 1.95, -torso[2] / 2 - 0.4]}
          rotation={[0.5, 0, 0]}
          castShadow={castShadow}
        >
          <boxGeometry args={[0.32, 1.1, 0.32]} />
          {flat(trim)}
        </mesh>
      )}
    </group>
  );
}
