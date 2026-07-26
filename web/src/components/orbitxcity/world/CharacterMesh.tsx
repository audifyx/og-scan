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
  };
}

function OutfitDetails({
  outfit,
  bodyColor,
  accentColor,
}: {
  outfit: OutfitStyle;
  bodyColor: string;
  accentColor: string;
}) {
  if (outfit === "suit") {
    return (
      <>
        <mesh position={[-0.16, 1.36, 0.235]} castShadow>
          <boxGeometry args={[0.2, 0.56, 0.04]} />
          <meshStandardMaterial color="#151a24" roughness={0.58} metalness={0.15} />
        </mesh>
        <mesh position={[0.16, 1.36, 0.235]} castShadow>
          <boxGeometry args={[0.2, 0.56, 0.04]} />
          <meshStandardMaterial color="#151a24" roughness={0.58} metalness={0.15} />
        </mesh>
        <mesh position={[0, 1.39, 0.26]} castShadow>
          <boxGeometry args={[0.12, 0.42, 0.035]} />
          <meshStandardMaterial color="#edf3ff" roughness={0.72} />
        </mesh>
        <mesh position={[0, 1.36, 0.295]} castShadow>
          <boxGeometry args={[0.055, 0.34, 0.035]} />
          <meshStandardMaterial color={accentColor} roughness={0.45} metalness={0.2} />
        </mesh>
      </>
    );
  }

  if (outfit === "sport") {
    return (
      <>
        <mesh position={[0, 1.46, 0.255]} castShadow>
          <boxGeometry args={[0.46, 0.1, 0.035]} />
          <meshStandardMaterial color={accentColor} roughness={0.45} metalness={0.15} />
        </mesh>
        <mesh position={[-0.13, 1.25, 0.26]} castShadow>
          <boxGeometry args={[0.045, 0.34, 0.035]} />
          <meshStandardMaterial color="#f5fbff" roughness={0.62} />
        </mesh>
        <mesh position={[0.13, 1.25, 0.26]} castShadow>
          <boxGeometry args={[0.045, 0.34, 0.035]} />
          <meshStandardMaterial color="#f5fbff" roughness={0.62} />
        </mesh>
        <mesh position={[0, 1.28, 0.285]} castShadow>
          <boxGeometry args={[0.16, 0.16, 0.03]} />
          <meshStandardMaterial color={accentColor} roughness={0.52} />
        </mesh>
      </>
    );
  }

  if (outfit === "neon") {
    return (
      <>
        <mesh position={[0, 1.52, 0.27]} castShadow>
          <boxGeometry args={[0.48, 0.045, 0.035]} />
          <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={0.12} roughness={0.55} />
        </mesh>
        <mesh position={[-0.2, 1.25, 0.27]} castShadow>
          <boxGeometry args={[0.045, 0.48, 0.035]} />
          <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={0.12} roughness={0.55} />
        </mesh>
        <mesh position={[0.2, 1.25, 0.27]} castShadow>
          <boxGeometry args={[0.045, 0.48, 0.035]} />
          <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={0.12} roughness={0.55} />
        </mesh>
      </>
    );
  }

  return (
    <>
      <mesh position={[0, 1.55, -0.14]} castShadow>
        <torusGeometry args={[0.25, 0.045, 8, 16]} />
        <meshStandardMaterial color={bodyColor} roughness={0.72} metalness={0.12} />
      </mesh>
      <mesh position={[0, 1.18, 0.27]} castShadow>
        <boxGeometry args={[0.28, 0.11, 0.04]} />
        <meshStandardMaterial color={accentColor} roughness={0.52} metalness={0.18} />
      </mesh>
      <mesh position={[0, 1.33, 0.275]} castShadow>
        <boxGeometry args={[0.06, 0.36, 0.04]} />
        <meshStandardMaterial color={accentColor} roughness={0.52} metalness={0.18} />
      </mesh>
    </>
  );
}

function Hair({ style, color }: { style: HairStyle; color: string }) {
  if (style === "buzz") {
    return (
      <mesh position={[0, 2.23, 0]} scale={[1, 0.22, 1]} castShadow>
        <sphereGeometry args={[0.34, 12, 8]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
    );
  }

  if (style === "long") {
    return (
      <>
        <mesh position={[0, 2.24, -0.03]} scale={[1, 0.38, 1]} castShadow>
          <sphereGeometry args={[0.36, 12, 10]} />
          <meshStandardMaterial color={color} roughness={0.68} />
        </mesh>
        <mesh position={[0, 1.92, -0.21]} castShadow>
          <capsuleGeometry args={[0.22, 0.48, 5, 8]} />
          <meshStandardMaterial color={color} roughness={0.68} />
        </mesh>
        <mesh position={[-0.28, 2.03, 0.03]} castShadow>
          <capsuleGeometry args={[0.06, 0.3, 4, 8]} />
          <meshStandardMaterial color={color} roughness={0.68} />
        </mesh>
        <mesh position={[0.28, 2.03, 0.03]} castShadow>
          <capsuleGeometry args={[0.06, 0.3, 4, 8]} />
          <meshStandardMaterial color={color} roughness={0.68} />
        </mesh>
      </>
    );
  }

  if (style === "bun") {
    return (
      <>
        <mesh position={[0, 2.23, -0.02]} scale={[1, 0.32, 1]} castShadow>
          <sphereGeometry args={[0.35, 12, 8]} />
          <meshStandardMaterial color={color} roughness={0.68} />
        </mesh>
        <mesh position={[0, 2.26, -0.34]} castShadow>
          <sphereGeometry args={[0.16, 10, 8]} />
          <meshStandardMaterial color={color} roughness={0.68} />
        </mesh>
      </>
    );
  }

  if (style === "mohawk") {
    return (
      <>
        {[-0.16, 0, 0.16].map((z, i) => (
          <mesh key={z} position={[0, 2.4 - Math.abs(i - 1) * 0.04, z]} castShadow>
            <boxGeometry args={[0.1, 0.3, 0.1]} />
            <meshStandardMaterial color={color} roughness={0.62} />
          </mesh>
        ))}
        <mesh position={[0, 2.22, -0.02]} scale={[0.72, 0.2, 0.95]} castShadow>
          <sphereGeometry args={[0.34, 10, 8]} />
          <meshStandardMaterial color={color} roughness={0.68} />
        </mesh>
      </>
    );
  }

  return (
    <>
      <mesh position={[0, 2.24, -0.01]} scale={[1, 0.32, 1]} castShadow>
        <sphereGeometry args={[0.35, 12, 8]} />
        <meshStandardMaterial color={color} roughness={0.68} />
      </mesh>
      <mesh position={[0.08, 2.17, 0.28]} rotation={[0.18, 0, -0.22]} castShadow>
        <boxGeometry args={[0.22, 0.08, 0.08]} />
        <meshStandardMaterial color={color} roughness={0.68} />
      </mesh>
    </>
  );
}

function Face({ style, accentColor }: { style: FaceStyle; accentColor: string }) {
  if (style === "cool") {
    return (
      <>
        <mesh position={[-0.095, 2.1, 0.315]} castShadow>
          <boxGeometry args={[0.12, 0.07, 0.025]} />
          <meshStandardMaterial color="#05070b" roughness={0.36} metalness={0.45} />
        </mesh>
        <mesh position={[0.095, 2.1, 0.315]} castShadow>
          <boxGeometry args={[0.12, 0.07, 0.025]} />
          <meshStandardMaterial color="#05070b" roughness={0.36} metalness={0.45} />
        </mesh>
        <mesh position={[0, 2.1, 0.325]} castShadow>
          <boxGeometry args={[0.08, 0.025, 0.02]} />
          <meshStandardMaterial color="#05070b" roughness={0.36} metalness={0.45} />
        </mesh>
        <mesh position={[0, 1.99, 0.322]} castShadow>
          <boxGeometry args={[0.17, 0.025, 0.02]} />
          <meshStandardMaterial color={accentColor} roughness={0.4} metalness={0.3} />
        </mesh>
      </>
    );
  }

  return (
    <>
      <mesh position={[-0.1, 2.1, 0.315]} castShadow>
        <sphereGeometry args={[0.035, 8, 6]} />
        <meshStandardMaterial color="#161a20" roughness={0.45} />
      </mesh>
      <mesh position={[0.1, 2.1, 0.315]} castShadow>
        <sphereGeometry args={[0.035, 8, 6]} />
        <meshStandardMaterial color="#161a20" roughness={0.45} />
      </mesh>
      {style === "smile" ? (
        <>
          <mesh position={[-0.055, 1.99, 0.322]} rotation={[0, 0, -0.28]} castShadow>
            <boxGeometry args={[0.12, 0.025, 0.02]} />
            <meshStandardMaterial color="#3a1f24" roughness={0.5} />
          </mesh>
          <mesh position={[0.055, 1.99, 0.322]} rotation={[0, 0, 0.28]} castShadow>
            <boxGeometry args={[0.12, 0.025, 0.02]} />
            <meshStandardMaterial color="#3a1f24" roughness={0.5} />
          </mesh>
        </>
      ) : (
        <mesh position={[0, 1.99, 0.322]} castShadow>
          <boxGeometry args={[0.15, 0.02, 0.02]} />
          <meshStandardMaterial color="#3a1f24" roughness={0.5} />
        </mesh>
      )}
    </>
  );
}

export function CharacterMesh(props: CharacterMeshProps) {
  const root = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const forearmL = useRef<THREE.Group>(null);
  const forearmR = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const shinL = useRef<THREE.Group>(null);
  const shinR = useRef<THREE.Group>(null);

  const character = useMemo(() => resolveCharacterProps(props), [
    props.accentColor,
    props.appearance,
    props.bodyColor,
    props.faceStyle,
    props.hairColor,
    props.hairStyle,
    props.outfit,
    props.skinColor,
  ]);

  const outfitBase = character.outfit === "neon" ? "#111827" : character.bodyColor;
  const sleeveColor = character.outfit === "suit" ? "#151a24" : outfitBase;
  const pantColor = character.outfit === "sport" ? "#182132" : character.outfit === "suit" ? "#10141d" : "#111827";
  const shoeColor = character.outfit === "neon" ? character.accentColor : "#0b0f16";

  useFrame(({ clock }) => {
    const animation = props.animation;
    const t = animation?.time ?? props.time ?? clock.elapsedTime;
    const moving = animation?.moving ?? props.moving ?? false;
    const dancing = animation?.dancing ?? props.dancing ?? false;
    const intensity = animation?.walkIntensity ?? props.walkIntensity ?? 1;
    const walk = moving ? Math.sin(t * 8.8) * 0.42 * intensity : Math.sin(t * 1.6) * 0.035;
    const dance = dancing ? Math.sin(t * 13) * 0.72 : 0;
    const bounce = dancing ? Math.abs(Math.sin(t * 9)) * 0.08 : moving ? Math.abs(Math.sin(t * 8.8)) * 0.035 : Math.sin(t * 1.6) * 0.012;

    if (root.current) root.current.position.y = bounce;
    if (torso.current) {
      torso.current.rotation.z = dancing ? Math.sin(t * 7) * 0.18 : Math.sin(t * 1.5) * 0.025;
      torso.current.rotation.x = moving ? -0.04 : 0;
    }
    if (head.current) {
      head.current.rotation.z = dancing ? Math.sin(t * 10) * 0.16 : Math.sin(t * 1.4) * 0.025;
      head.current.rotation.x = dancing ? Math.sin(t * 8) * 0.1 : 0;
    }
    if (legL.current) legL.current.rotation.x = dancing ? dance * 0.45 : walk;
    if (legR.current) legR.current.rotation.x = dancing ? -dance * 0.45 : -walk;
    if (shinL.current) shinL.current.rotation.x = moving ? Math.max(0, -walk) * 0.55 : 0;
    if (shinR.current) shinR.current.rotation.x = moving ? Math.max(0, walk) * 0.55 : 0;
    if (armL.current) armL.current.rotation.x = dancing ? -1.05 + dance : -walk * 0.75 - 0.08;
    if (armR.current) armR.current.rotation.x = dancing ? -1.05 - dance : walk * 0.75 - 0.08;
    if (forearmL.current) forearmL.current.rotation.x = dancing ? -0.48 + Math.sin(t * 11) * 0.28 : -0.18;
    if (forearmR.current) forearmR.current.rotation.x = dancing ? -0.48 - Math.sin(t * 11) * 0.28 : -0.18;
  });

  return (
    <group ref={root} name="characterMesh">
      <group ref={torso} name="torso">
        <mesh name="hips" position={[0, 0.9, 0]} castShadow>
          <boxGeometry args={[0.5, 0.26, 0.34]} />
          <meshStandardMaterial color={pantColor} roughness={0.58} metalness={0.12} />
        </mesh>
        <mesh position={[0, 1.31, 0]} castShadow>
          <boxGeometry args={[0.6, 0.7, 0.38]} />
          <meshStandardMaterial color={outfitBase} roughness={0.58} metalness={0.18} />
        </mesh>
        <mesh name="neck" position={[0, 1.76, 0]} castShadow>
          <cylinderGeometry args={[0.12, 0.14, 0.18, 10]} />
          <meshStandardMaterial color={character.skinColor} roughness={0.66} metalness={0.04} />
        </mesh>
        <OutfitDetails outfit={character.outfit} bodyColor={outfitBase} accentColor={character.accentColor} />
      </group>

      <group ref={head} name="head">
        <mesh position={[0, 2.08, 0]} castShadow>
          <sphereGeometry args={[0.32, 14, 12]} />
          <meshStandardMaterial color={character.skinColor} roughness={0.67} metalness={0.04} />
        </mesh>
        <Hair style={character.hairStyle} color={character.hairColor} />
        <Face style={character.faceStyle} accentColor={character.accentColor} />
      </group>

      <group ref={armL} name="armL" position={[-0.42, 1.56, 0]} rotation={[0, 0, -0.12]}>
        <mesh position={[0, -0.22, 0]} castShadow>
          <capsuleGeometry args={[0.075, 0.34, 4, 8]} />
          <meshStandardMaterial color={sleeveColor} roughness={0.6} metalness={0.12} />
        </mesh>
        <group ref={forearmL} name="forearmL" position={[0, -0.44, 0]}>
          <mesh position={[0, -0.18, 0]} castShadow>
            <capsuleGeometry args={[0.065, 0.3, 4, 8]} />
            <meshStandardMaterial color={character.skinColor} roughness={0.66} metalness={0.04} />
          </mesh>
          <mesh position={[0, -0.38, 0.02]} castShadow>
            <sphereGeometry args={[0.075, 8, 6]} />
            <meshStandardMaterial color={character.skinColor} roughness={0.66} metalness={0.04} />
          </mesh>
        </group>
      </group>

      <group ref={armR} name="armR" position={[0.42, 1.56, 0]} rotation={[0, 0, 0.12]}>
        <mesh position={[0, -0.22, 0]} castShadow>
          <capsuleGeometry args={[0.075, 0.34, 4, 8]} />
          <meshStandardMaterial color={sleeveColor} roughness={0.6} metalness={0.12} />
        </mesh>
        <group ref={forearmR} name="forearmR" position={[0, -0.44, 0]}>
          <mesh position={[0, -0.18, 0]} castShadow>
            <capsuleGeometry args={[0.065, 0.3, 4, 8]} />
            <meshStandardMaterial color={character.skinColor} roughness={0.66} metalness={0.04} />
          </mesh>
          <mesh position={[0, -0.38, 0.02]} castShadow>
            <sphereGeometry args={[0.075, 8, 6]} />
            <meshStandardMaterial color={character.skinColor} roughness={0.66} metalness={0.04} />
          </mesh>
        </group>
      </group>

      <group ref={legL} name="legL" position={[-0.15, 0.78, 0]}>
        <mesh position={[0, -0.22, 0]} castShadow>
          <capsuleGeometry args={[0.09, 0.35, 4, 8]} />
          <meshStandardMaterial color={pantColor} roughness={0.58} metalness={0.1} />
        </mesh>
        <group ref={shinL} name="shinL" position={[0, -0.46, 0]}>
          <mesh position={[0, -0.21, 0]} castShadow>
            <capsuleGeometry args={[0.08, 0.36, 4, 8]} />
            <meshStandardMaterial color={pantColor} roughness={0.58} metalness={0.1} />
          </mesh>
          <mesh name="shoeL" position={[0, -0.45, 0.07]} castShadow>
            <boxGeometry args={[0.18, 0.1, 0.3]} />
            <meshStandardMaterial color={shoeColor} emissive={character.outfit === "neon" ? character.accentColor : "#000000"} emissiveIntensity={character.outfit === "neon" ? 0.25 : 0} roughness={0.5} />
          </mesh>
        </group>
      </group>

      <group ref={legR} name="legR" position={[0.15, 0.78, 0]}>
        <mesh position={[0, -0.22, 0]} castShadow>
          <capsuleGeometry args={[0.09, 0.35, 4, 8]} />
          <meshStandardMaterial color={pantColor} roughness={0.58} metalness={0.1} />
        </mesh>
        <group ref={shinR} name="shinR" position={[0, -0.46, 0]}>
          <mesh position={[0, -0.21, 0]} castShadow>
            <capsuleGeometry args={[0.08, 0.36, 4, 8]} />
            <meshStandardMaterial color={pantColor} roughness={0.58} metalness={0.1} />
          </mesh>
          <mesh name="shoeR" position={[0, -0.45, 0.07]} castShadow>
            <boxGeometry args={[0.18, 0.1, 0.3]} />
            <meshStandardMaterial color={shoeColor} emissive={character.outfit === "neon" ? character.accentColor : "#000000"} emissiveIntensity={character.outfit === "neon" ? 0.25 : 0} roughness={0.5} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
