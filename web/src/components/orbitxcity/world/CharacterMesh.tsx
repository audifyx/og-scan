import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
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

function classScale(classId?: string) {
  switch (classId) {
    case "builder":
      return [1.12, 1.05, 1.1] as const;
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
      <mesh position={[0, 2.28, 0]} castShadow>
        <sphereGeometry args={[0.305, 14, 12]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
    );
  }
  if (style === "bun") {
    return (
      <>
        <mesh position={[0, 2.28, -0.02]} castShadow>
          <sphereGeometry args={[0.3, 14, 12]} />
          <meshStandardMaterial color={color} roughness={0.78} />
        </mesh>
        <mesh position={[0, 2.52, -0.06]} castShadow>
          <sphereGeometry args={[0.14, 12, 10]} />
          <meshStandardMaterial color={color} roughness={0.78} />
        </mesh>
      </>
    );
  }
  if (style === "mohawk") {
    return (
      <mesh position={[0, 2.42, 0]} castShadow>
        <boxGeometry args={[0.1, 0.32, 0.34]} />
        <meshStandardMaterial color={color} roughness={0.72} />
      </mesh>
    );
  }
  if (style === "long") {
    return (
      <>
        <mesh position={[0, 2.28, -0.02]} castShadow>
          <sphereGeometry args={[0.32, 14, 12]} />
          <meshStandardMaterial color={color} roughness={0.78} />
        </mesh>
        <mesh position={[0, 1.95, -0.18]} castShadow>
          <capsuleGeometry args={[0.16, 0.45, 4, 10]} />
          <meshStandardMaterial color={color} roughness={0.8} />
        </mesh>
      </>
    );
  }
  return (
    <mesh position={[0, 2.3, -0.01]} castShadow>
      <sphereGeometry args={[0.31, 14, 12]} />
      <meshStandardMaterial color={color} roughness={0.76} />
    </mesh>
  );
}

function Face({ style, accent }: { style: FaceStyle; accent: string }) {
  const eyeY = 2.12;
  return (
    <group>
      <mesh position={[-0.09, eyeY, 0.27]}>
        <sphereGeometry args={[0.035, 8, 8]} />
        <meshStandardMaterial color="#111318" roughness={0.4} />
      </mesh>
      <mesh position={[0.09, eyeY, 0.27]}>
        <sphereGeometry args={[0.035, 8, 8]} />
        <meshStandardMaterial color="#111318" roughness={0.4} />
      </mesh>
      {style === "cool" && (
        <mesh position={[0, 2.12, 0.29]}>
          <boxGeometry args={[0.28, 0.06, 0.04]} />
          <meshStandardMaterial color="#0b0e14" metalness={0.55} roughness={0.25} emissive={accent} emissiveIntensity={0.15} />
        </mesh>
      )}
      {style === "smile" && (
        <mesh position={[0, 1.98, 0.28]} rotation={[0.2, 0, 0]}>
          <torusGeometry args={[0.07, 0.012, 6, 12, Math.PI]} />
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
}: {
  outfit: OutfitStyle;
  bodyColor: string;
  accent: string;
}) {
  if (outfit === "suit") {
    return (
      <>
        <mesh position={[0, 1.38, 0.2]} castShadow>
          <boxGeometry args={[0.42, 0.55, 0.08]} />
          <meshStandardMaterial color="#f4f6fa" roughness={0.7} />
        </mesh>
        <mesh position={[0, 1.55, 0.24]} castShadow>
          <boxGeometry args={[0.08, 0.28, 0.04]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.2} />
        </mesh>
        <mesh position={[-0.22, 1.4, 0.22]} castShadow>
          <boxGeometry args={[0.16, 0.5, 0.05]} />
          <meshStandardMaterial color="#121722" roughness={0.55} metalness={0.2} />
        </mesh>
        <mesh position={[0.22, 1.4, 0.22]} castShadow>
          <boxGeometry args={[0.16, 0.5, 0.05]} />
          <meshStandardMaterial color="#121722" roughness={0.55} metalness={0.2} />
        </mesh>
      </>
    );
  }
  if (outfit === "sport") {
    return (
      <>
        <mesh position={[0, 1.55, 0.22]} castShadow>
          <boxGeometry args={[0.55, 0.12, 0.06]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.35} />
        </mesh>
        <mesh position={[0, 1.15, 0.2]} castShadow>
          <boxGeometry args={[0.5, 0.08, 0.05]} />
          <meshStandardMaterial color="#f5f7fa" roughness={0.65} />
        </mesh>
      </>
    );
  }
  if (outfit === "neon") {
    return (
      <>
        <mesh position={[0, 1.35, 0.22]}>
          <boxGeometry args={[0.52, 0.08, 0.04]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.7} toneMapped={false} />
        </mesh>
        <mesh position={[0, 1.55, 0.22]}>
          <boxGeometry args={[0.4, 0.05, 0.04]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.55} toneMapped={false} />
        </mesh>
      </>
    );
  }
  // street hoodie
  return (
    <>
      <mesh position={[0, 1.72, -0.08]} castShadow>
        <sphereGeometry args={[0.22, 12, 10]} />
        <meshStandardMaterial color={bodyColor} roughness={0.72} />
      </mesh>
      <mesh position={[0, 1.55, 0.22]} castShadow>
        <boxGeometry args={[0.48, 0.35, 0.08]} />
        <meshStandardMaterial color={bodyColor} roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.42, 0.26]}>
        <boxGeometry args={[0.2, 0.08, 0.03]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.25} />
      </mesh>
    </>
  );
}

/** Modern street avatar — rounded proportions, city outfits (not fantasy/dungeon). */
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
        {/* hips */}
        <mesh position={[0, 0.95, 0]} castShadow>
          <capsuleGeometry args={[0.2, 0.18, 6, 12]} />
          <meshStandardMaterial color={pantColor} roughness={0.62} metalness={0.08} />
        </mesh>
        {/* torso */}
        <mesh position={[0, 1.38, 0]} castShadow>
          <capsuleGeometry args={[0.26, 0.42, 6, 14]} />
          <meshStandardMaterial color={topColor} roughness={0.6} metalness={0.12} />
        </mesh>
        <mesh position={[0, 1.78, 0]} castShadow>
          <capsuleGeometry args={[0.1, 0.08, 4, 10]} />
          <meshStandardMaterial color={character.skinColor} roughness={0.68} />
        </mesh>
        <OutfitShell outfit={character.outfit} bodyColor={topColor} accent={character.accentColor} />
      </group>

      <group ref={head}>
        <mesh position={[0, 2.08, 0]} castShadow>
          <sphereGeometry args={[0.3, 18, 16]} />
          <meshStandardMaterial color={character.skinColor} roughness={0.66} metalness={0.04} />
        </mesh>
        <Hair style={character.hairStyle} color={character.hairColor} />
        <Face style={character.faceStyle} accent={character.accentColor} />
      </group>

      <group ref={armL} position={[-0.38, 1.58, 0]} rotation={[0, 0, 0.14]}>
        <mesh position={[0, -0.22, 0]} castShadow>
          <capsuleGeometry args={[0.07, 0.32, 4, 10]} />
          <meshStandardMaterial color={topColor} roughness={0.6} />
        </mesh>
        <mesh position={[0, -0.55, 0]} castShadow>
          <capsuleGeometry args={[0.06, 0.28, 4, 10]} />
          <meshStandardMaterial color={character.skinColor} roughness={0.66} />
        </mesh>
        <mesh position={[0, -0.78, 0.02]} castShadow>
          <sphereGeometry args={[0.07, 10, 8]} />
          <meshStandardMaterial color={character.skinColor} roughness={0.66} />
        </mesh>
      </group>

      <group ref={armR} position={[0.38, 1.58, 0]} rotation={[0, 0, -0.14]}>
        <mesh position={[0, -0.22, 0]} castShadow>
          <capsuleGeometry args={[0.07, 0.32, 4, 10]} />
          <meshStandardMaterial color={topColor} roughness={0.6} />
        </mesh>
        <mesh position={[0, -0.55, 0]} castShadow>
          <capsuleGeometry args={[0.06, 0.28, 4, 10]} />
          <meshStandardMaterial color={character.skinColor} roughness={0.66} />
        </mesh>
        <mesh position={[0, -0.78, 0.02]} castShadow>
          <sphereGeometry args={[0.07, 10, 8]} />
          <meshStandardMaterial color={character.skinColor} roughness={0.66} />
        </mesh>
      </group>

      <group ref={legL} position={[-0.14, 0.82, 0]}>
        <mesh position={[0, -0.28, 0]} castShadow>
          <capsuleGeometry args={[0.085, 0.42, 4, 10]} />
          <meshStandardMaterial color={pantColor} roughness={0.6} />
        </mesh>
        <mesh position={[0, -0.72, 0.06]} castShadow>
          <boxGeometry args={[0.16, 0.1, 0.28]} />
          <meshStandardMaterial
            color={shoeColor}
            emissive={character.outfit === "neon" ? character.accentColor : "#000"}
            emissiveIntensity={character.outfit === "neon" ? 0.35 : 0}
            roughness={0.45}
          />
        </mesh>
      </group>

      <group ref={legR} position={[0.14, 0.82, 0]}>
        <mesh position={[0, -0.28, 0]} castShadow>
          <capsuleGeometry args={[0.085, 0.42, 4, 10]} />
          <meshStandardMaterial color={pantColor} roughness={0.6} />
        </mesh>
        <mesh position={[0, -0.72, 0.06]} castShadow>
          <boxGeometry args={[0.16, 0.1, 0.28]} />
          <meshStandardMaterial
            color={shoeColor}
            emissive={character.outfit === "neon" ? character.accentColor : "#000"}
            emissiveIntensity={character.outfit === "neon" ? 0.35 : 0}
            roughness={0.45}
          />
        </mesh>
      </group>
    </group>
  );
}
