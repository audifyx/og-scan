/**
 * Solid game-style avatars — wider torsos, proper limb thickness, distinct class silhouettes.
 * Still pure primitives (AI-buildable), no fantasy GLTFs.
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getCharacterKit, type CharacterAccessory } from "@/lib/orbitxcity/assets/characterKits";
import type { AvatarAppearance, FaceStyle, HairStyle, OutfitStyle } from "@/lib/orbitxcity/types";

export interface CharacterAnimationState {
  time?: number;
  moving?: boolean;
  dancing?: boolean;
  walkIntensity?: number;
}

export interface CharacterMeshProps {
  appearance?: Partial<AvatarAppearance> | null;
  bodyColor?: string;
  accentColor?: string;
  skinColor?: string;
  hairStyle?: HairStyle;
  hairColor?: string;
  outfit?: OutfitStyle;
  faceStyle?: FaceStyle;
  dancing?: boolean;
  moving?: boolean;
  time?: number;
  walkIntensity?: number;
  animation?: CharacterAnimationState;
}

const DEFAULTS = {
  bodyColor: "#1a2438",
  accentColor: "#3de7ff",
  skinColor: "#e8d5c0",
  hairStyle: "short" as HairStyle,
  hairColor: "#151018",
  outfit: "street" as OutfitStyle,
  faceStyle: "cool" as FaceStyle,
};

function resolveCharacterProps({
  appearance,
  bodyColor,
  accentColor,
  skinColor,
  hairStyle,
  hairColor,
  outfit,
  faceStyle,
}: CharacterMeshProps) {
  return {
    bodyColor: bodyColor ?? appearance?.bodyColor ?? DEFAULTS.bodyColor,
    accentColor: accentColor ?? appearance?.accentColor ?? DEFAULTS.accentColor,
    skinColor: skinColor ?? appearance?.skinColor ?? DEFAULTS.skinColor,
    hairStyle: hairStyle ?? appearance?.hairStyle ?? DEFAULTS.hairStyle,
    hairColor: hairColor ?? appearance?.hairColor ?? DEFAULTS.hairColor,
    outfit: outfit ?? appearance?.outfit ?? DEFAULTS.outfit,
    faceStyle: faceStyle ?? appearance?.faceStyle ?? DEFAULTS.faceStyle,
    classId: appearance?.classId,
  };
}

/** Align with characterClasses.ts scales — distinct readable silhouettes. */
function classScale(classId?: string) {
  switch (classId) {
    case "builder":
      return [1.18, 1.05, 1.12] as const;
    case "gamer":
      return [0.92, 0.96, 0.92] as const;
    case "creator":
      return [0.96, 1.02, 0.96] as const;
    case "explorer":
      return [1.02, 1.08, 1.02] as const;
    case "trader":
    default:
      return [1, 1.02, 1] as const;
  }
}

function Hair({ style, color }: { style: HairStyle; color: string }) {
  if (style === "buzz") {
    return (
      <mesh position={[0, 1.72, 0]} castShadow>
        <sphereGeometry args={[0.26, 14, 12]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
    );
  }
  if (style === "bun") {
    return (
      <>
        <mesh position={[0, 1.72, -0.02]} castShadow>
          <sphereGeometry args={[0.255, 14, 12]} />
          <meshStandardMaterial color={color} roughness={0.78} />
        </mesh>
        <mesh position={[0, 1.92, -0.05]} castShadow>
          <sphereGeometry args={[0.12, 12, 10]} />
          <meshStandardMaterial color={color} roughness={0.78} />
        </mesh>
      </>
    );
  }
  if (style === "mohawk") {
    return (
      <>
        <mesh position={[0, 1.72, -0.02]} castShadow>
          <sphereGeometry args={[0.24, 12, 10]} />
          <meshStandardMaterial color={color} roughness={0.8} />
        </mesh>
        <mesh position={[0, 1.88, 0]} castShadow>
          <boxGeometry args={[0.1, 0.28, 0.32]} />
          <meshStandardMaterial color={color} roughness={0.72} />
        </mesh>
      </>
    );
  }
  if (style === "long") {
    return (
      <>
        <mesh position={[0, 1.72, -0.02]} castShadow>
          <sphereGeometry args={[0.27, 14, 12]} />
          <meshStandardMaterial color={color} roughness={0.78} />
        </mesh>
        <mesh position={[0, 1.42, -0.16]} castShadow>
          <capsuleGeometry args={[0.14, 0.38, 4, 10]} />
          <meshStandardMaterial color={color} roughness={0.8} />
        </mesh>
      </>
    );
  }
  return (
    <mesh position={[0, 1.74, -0.01]} castShadow>
      <sphereGeometry args={[0.265, 14, 12]} />
      <meshStandardMaterial color={color} roughness={0.76} />
    </mesh>
  );
}

function Face({ style, accent }: { style: FaceStyle; accent: string }) {
  const eyeY = 1.58;
  return (
    <group>
      <mesh position={[-0.08, eyeY, 0.22]}>
        <sphereGeometry args={[0.032, 8, 8]} />
        <meshStandardMaterial color="#111318" roughness={0.4} />
      </mesh>
      <mesh position={[0.08, eyeY, 0.22]}>
        <sphereGeometry args={[0.032, 8, 8]} />
        <meshStandardMaterial color="#111318" roughness={0.4} />
      </mesh>
      {style === "cool" && (
        <mesh position={[0, 1.58, 0.24]}>
          <boxGeometry args={[0.26, 0.055, 0.04]} />
          <meshStandardMaterial
            color="#0b0e14"
            metalness={0.55}
            roughness={0.25}
            emissive={accent}
            emissiveIntensity={0.2}
          />
        </mesh>
      )}
      {style === "smile" && (
        <mesh position={[0, 1.46, 0.23]} rotation={[0.2, 0, 0]}>
          <torusGeometry args={[0.065, 0.012, 6, 12, Math.PI]} />
          <meshStandardMaterial color="#6a3a3a" roughness={0.7} />
        </mesh>
      )}
    </group>
  );
}

function OutfitShell({
  outfit,
  bodyColor,
  accent,
  classId,
}: {
  outfit: OutfitStyle;
  bodyColor: string;
  accent: string;
  classId?: string;
}) {
  if (outfit === "suit") {
    return (
      <>
        {/* Dress shirt + jacket lapels */}
        <mesh position={[0, 1.12, 0.2]} castShadow>
          <boxGeometry args={[0.38, 0.52, 0.08]} />
          <meshStandardMaterial color="#f4f6fa" roughness={0.7} />
        </mesh>
        <mesh position={[0, 1.28, 0.25]} castShadow>
          <boxGeometry args={[0.09, 0.32, 0.04]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.28} />
        </mesh>
        <mesh position={[-0.2, 1.12, 0.22]} castShadow>
          <boxGeometry args={[0.16, 0.5, 0.06]} />
          <meshStandardMaterial color="#121722" roughness={0.5} metalness={0.22} />
        </mesh>
        <mesh position={[0.2, 1.12, 0.22]} castShadow>
          <boxGeometry args={[0.16, 0.5, 0.06]} />
          <meshStandardMaterial color="#121722" roughness={0.5} metalness={0.22} />
        </mesh>
        <mesh position={[0, 0.78, 0.18]} castShadow>
          <boxGeometry args={[0.42, 0.08, 0.06]} />
          <meshStandardMaterial color="#0e1218" roughness={0.55} />
        </mesh>
      </>
    );
  }
  if (outfit === "sport") {
    return (
      <>
        <mesh position={[0, 1.28, 0.22]} castShadow>
          <boxGeometry args={[0.58, 0.14, 0.07]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.45} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.95, 0.2]} castShadow>
          <boxGeometry args={[0.52, 0.1, 0.06]} />
          <meshStandardMaterial color="#f5f7fa" roughness={0.65} />
        </mesh>
        <mesh position={[-0.22, 1.1, 0.2]}>
          <boxGeometry args={[0.08, 0.35, 0.04]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.35} />
        </mesh>
      </>
    );
  }
  if (outfit === "neon") {
    return (
      <>
        <mesh position={[0, 1.1, 0.23]}>
          <boxGeometry args={[0.55, 0.09, 0.05]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.85} toneMapped={false} />
        </mesh>
        <mesh position={[0, 1.28, 0.23]}>
          <boxGeometry args={[0.42, 0.06, 0.05]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.65} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.9, 0.22]}>
          <boxGeometry args={[0.48, 0.05, 0.04]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.5} toneMapped={false} />
        </mesh>
      </>
    );
  }
  // street hoodie (+ builder tool belt / explorer pack accents)
  return (
    <>
      <mesh position={[0, 1.38, -0.06]} castShadow>
        <sphereGeometry args={[0.2, 12, 10]} />
        <meshStandardMaterial color={bodyColor} roughness={0.72} />
      </mesh>
      <mesh position={[0, 1.2, 0.22]} castShadow>
        <boxGeometry args={[0.52, 0.38, 0.1]} />
        <meshStandardMaterial color={bodyColor} roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.05, 0.28]}>
        <boxGeometry args={[0.22, 0.09, 0.04]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.3} />
      </mesh>
      {classId === "builder" && (
        <mesh position={[0, 0.72, 0.2]} castShadow>
          <boxGeometry args={[0.5, 0.1, 0.12]} />
          <meshStandardMaterial color="#2a3344" metalness={0.35} roughness={0.5} />
        </mesh>
      )}
      {classId === "explorer" && (
        <mesh position={[0, 1.05, -0.28]} castShadow>
          <boxGeometry args={[0.36, 0.42, 0.16]} />
          <meshStandardMaterial color="#243028" roughness={0.75} />
        </mesh>
      )}
    </>
  );
}

function ClassAccessory({
  accessory,
  accent,
  glow,
}: {
  accessory: CharacterAccessory;
  accent: string;
  glow: number;
}) {
  switch (accessory) {
    case "briefcase":
      return (
        <mesh position={[0.42, 0.72, 0.08]} rotation={[0, -0.35, 0]} castShadow>
          <boxGeometry args={[0.28, 0.22, 0.08]} />
          <meshStandardMaterial color="#1a1410" metalness={0.35} roughness={0.55} />
        </mesh>
      );
    case "hard-hat":
      return (
        <mesh position={[0, 1.82, 0]} castShadow>
          <sphereGeometry args={[0.3, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#f5c542" emissive="#f5c542" emissiveIntensity={glow * 0.4} roughness={0.55} />
        </mesh>
      );
    case "headset":
      return (
        <>
          <mesh position={[-0.24, 1.58, 0]}>
            <torusGeometry args={[0.1, 0.035, 8, 12, Math.PI]} />
            <meshStandardMaterial color="#141820" metalness={0.4} roughness={0.45} />
          </mesh>
          <mesh position={[0.24, 1.58, 0]} rotation={[0, Math.PI, 0]}>
            <torusGeometry args={[0.1, 0.035, 8, 12, Math.PI]} />
            <meshStandardMaterial color="#141820" metalness={0.4} roughness={0.45} />
          </mesh>
          <mesh position={[0, 1.72, -0.02]}>
            <boxGeometry args={[0.48, 0.06, 0.12]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={glow} toneMapped={false} />
          </mesh>
        </>
      );
    case "hand-mic":
      return (
        <group position={[0.38, 1.05, 0.12]} rotation={[0, -0.4, 0.15]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.035, 0.04, 0.22, 8]} />
            <meshStandardMaterial color="#2a2830" metalness={0.5} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.14, 0]}>
            <sphereGeometry args={[0.06, 10, 10]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={glow} toneMapped={false} />
          </mesh>
        </group>
      );
    case "compass":
      return (
        <mesh position={[0, 1.18, 0.28]}>
          <cylinderGeometry args={[0.12, 0.12, 0.05, 16]} />
          <meshStandardMaterial color="#1a2830" metalness={0.55} roughness={0.35} />
        </mesh>
      );
    default:
      return null;
  }
}

/** Modern street avatar — solid game proportions, city outfits. */
export function CharacterMesh(props: CharacterMeshProps) {
  const root = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);

  const character = useMemo(
    () => resolveCharacterProps(props),
    [
      props.accentColor,
      props.appearance,
      props.bodyColor,
      props.faceStyle,
      props.hairColor,
      props.hairStyle,
      props.outfit,
      props.skinColor,
    ],
  );

  const topColor =
    character.outfit === "suit" ? "#151a24" : character.outfit === "neon" ? "#0e121c" : character.bodyColor;
  const pantColor =
    character.outfit === "sport" ? "#1a2436" : character.outfit === "suit" ? "#10141d" : "#141a24";
  const shoeColor = character.outfit === "neon" ? character.accentColor : "#0a0d12";

  // Builder = thicker limbs; Gamer = leaner; Trader = balanced.
  const limbBoost = character.classId === "builder" ? 1.15 : character.classId === "gamer" ? 0.92 : 1;
  const kit = useMemo(() => getCharacterKit(character.classId), [character.classId]);

  useFrame(({ clock }) => {
    const animation = props.animation;
    const t = animation?.time ?? props.time ?? clock.elapsedTime;
    const moving = animation?.moving ?? props.moving ?? false;
    const dancing = animation?.dancing ?? props.dancing ?? false;
    const intensity = animation?.walkIntensity ?? props.walkIntensity ?? 1;
    const walk = moving ? Math.sin(t * 9.2) * 0.48 * intensity : Math.sin(t * 1.5) * 0.03;
    const dance = dancing ? Math.sin(t * 12) * 0.7 : 0;
    const bounce = dancing
      ? Math.abs(Math.sin(t * 9)) * 0.09
      : moving
        ? Math.abs(Math.sin(t * 9.2)) * 0.04
        : Math.sin(t * 1.5) * 0.01;

    if (root.current) root.current.position.y = bounce;
    if (torso.current) {
      torso.current.rotation.z = dancing ? Math.sin(t * 7) * 0.16 : Math.sin(t * 1.4) * 0.02;
      torso.current.rotation.x = moving ? -0.05 : 0;
    }
    if (head.current) head.current.rotation.z = dancing ? Math.sin(t * 9) * 0.12 : Math.sin(t * 1.3) * 0.02;
    if (legL.current) legL.current.rotation.x = dancing ? dance * 0.4 : walk;
    if (legR.current) legR.current.rotation.x = dancing ? -dance * 0.4 : -walk;
    if (armL.current) armL.current.rotation.x = dancing ? -1.0 + dance : -walk * 0.8 - 0.1;
    if (armR.current) armR.current.rotation.x = dancing ? -1.0 - dance : walk * 0.8 - 0.1;
  });

  return (
    <group ref={root} name="characterMesh" scale={classScale(character.classId)}>
      <group ref={torso}>
        {/* Hips / pelvis — wider base */}
        <mesh position={[0, 0.78, 0]} castShadow>
          <capsuleGeometry args={[0.24 * limbBoost, 0.16, 6, 12]} />
          <meshStandardMaterial color={pantColor} roughness={0.62} metalness={0.08} />
        </mesh>
        {/* Chest — solid game torso */}
        <mesh position={[0, 1.18, 0]} castShadow>
          <capsuleGeometry args={[0.32 * limbBoost, 0.38, 6, 14]} />
          <meshStandardMaterial color={topColor} roughness={0.58} metalness={0.12} />
        </mesh>
        {/* Shoulders */}
        <mesh position={[-0.34 * limbBoost, 1.4, 0]} castShadow>
          <sphereGeometry args={[0.12 * limbBoost, 12, 10]} />
          <meshStandardMaterial color={topColor} roughness={0.58} />
        </mesh>
        <mesh position={[0.34 * limbBoost, 1.4, 0]} castShadow>
          <sphereGeometry args={[0.12 * limbBoost, 12, 10]} />
          <meshStandardMaterial color={topColor} roughness={0.58} />
        </mesh>
        {/* Neck */}
        <mesh position={[0, 1.48, 0]} castShadow>
          <capsuleGeometry args={[0.09, 0.08, 4, 10]} />
          <meshStandardMaterial color={character.skinColor} roughness={0.68} />
        </mesh>
        <OutfitShell
          outfit={character.outfit}
          bodyColor={topColor}
          accent={character.accentColor}
          classId={character.classId}
        />
      </group>

      <group ref={head}>
        <mesh position={[0, 1.58, 0]} castShadow>
          <sphereGeometry args={[0.26, 18, 16]} />
          <meshStandardMaterial color={character.skinColor} roughness={0.66} metalness={0.04} />
        </mesh>
        <Hair style={character.hairStyle} color={character.hairColor} />
        <Face style={character.faceStyle} accent={character.accentColor} />
      </group>

      <group ref={armL} position={[-0.42 * limbBoost, 1.38, 0]} rotation={[0, 0, 0.12]}>
        <mesh position={[0, -0.2, 0]} castShadow>
          <capsuleGeometry args={[0.095 * limbBoost, 0.3, 4, 10]} />
          <meshStandardMaterial color={topColor} roughness={0.6} />
        </mesh>
        <mesh position={[0, -0.52, 0]} castShadow>
          <capsuleGeometry args={[0.08 * limbBoost, 0.26, 4, 10]} />
          <meshStandardMaterial color={character.skinColor} roughness={0.66} />
        </mesh>
        <mesh position={[0, -0.74, 0.02]} castShadow>
          <sphereGeometry args={[0.08 * limbBoost, 10, 8]} />
          <meshStandardMaterial color={character.skinColor} roughness={0.66} />
        </mesh>
      </group>

      <group ref={armR} position={[0.42 * limbBoost, 1.38, 0]} rotation={[0, 0, -0.12]}>
        <mesh position={[0, -0.2, 0]} castShadow>
          <capsuleGeometry args={[0.095 * limbBoost, 0.3, 4, 10]} />
          <meshStandardMaterial color={topColor} roughness={0.6} />
        </mesh>
        <mesh position={[0, -0.52, 0]} castShadow>
          <capsuleGeometry args={[0.08 * limbBoost, 0.26, 4, 10]} />
          <meshStandardMaterial color={character.skinColor} roughness={0.66} />
        </mesh>
        <mesh position={[0, -0.74, 0.02]} castShadow>
          <sphereGeometry args={[0.08 * limbBoost, 10, 8]} />
          <meshStandardMaterial color={character.skinColor} roughness={0.66} />
        </mesh>
      </group>

      <group ref={legL} position={[-0.16 * limbBoost, 0.7, 0]}>
        <mesh position={[0, -0.22, 0]} castShadow>
          <capsuleGeometry args={[0.11 * limbBoost, 0.28, 4, 10]} />
          <meshStandardMaterial color={pantColor} roughness={0.6} />
        </mesh>
        <mesh position={[0, -0.52, 0]} castShadow>
          <capsuleGeometry args={[0.095 * limbBoost, 0.22, 4, 10]} />
          <meshStandardMaterial color={pantColor} roughness={0.62} />
        </mesh>
        <mesh position={[0, -0.72, 0.07]} castShadow>
          <boxGeometry args={[0.18 * limbBoost, 0.11, 0.32]} />
          <meshStandardMaterial
            color={shoeColor}
            emissive={character.outfit === "neon" ? character.accentColor : "#000"}
            emissiveIntensity={character.outfit === "neon" ? 0.4 : 0}
            roughness={0.42}
          />
        </mesh>
      </group>

      <group ref={legR} position={[0.16 * limbBoost, 0.7, 0]}>
        <mesh position={[0, -0.22, 0]} castShadow>
          <capsuleGeometry args={[0.11 * limbBoost, 0.28, 4, 10]} />
          <meshStandardMaterial color={pantColor} roughness={0.6} />
        </mesh>
        <mesh position={[0, -0.52, 0]} castShadow>
          <capsuleGeometry args={[0.095 * limbBoost, 0.22, 4, 10]} />
          <meshStandardMaterial color={pantColor} roughness={0.62} />
        </mesh>
        <mesh position={[0, -0.72, 0.07]} castShadow>
          <boxGeometry args={[0.18 * limbBoost, 0.11, 0.32]} />
          <meshStandardMaterial
            color={shoeColor}
            emissive={character.outfit === "neon" ? character.accentColor : "#000"}
            emissiveIntensity={character.outfit === "neon" ? 0.4 : 0}
            roughness={0.42}
          />
        </mesh>
      </group>

      <ClassAccessory accessory={kit.accessory} accent={character.accentColor} glow={kit.glow} />
    </group>
  );
}
