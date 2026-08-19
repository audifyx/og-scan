/**
 * Readable in-world humanoid — real proportions, clothing, hair, face.
 * Cosmetics (hair / outfit / face / colors) stay in sync with presence.
 */
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { resolveClassId } from "@/lib/orbitxcity/characterClasses";
import type { AvatarAppearance, FaceStyle, HairStyle, OutfitStyle } from "@/lib/orbitxcity/types";
import type { CharacterAnimationState } from "./CryptoMascotMesh";

interface HumanoidMeshProps {
  appearance?: Partial<AvatarAppearance> | null;
  animation?: CharacterAnimationState;
  moving?: boolean;
  dancing?: boolean;
  time?: number;
  walkIntensity?: number;
}

const OUTFIT: Record<OutfitStyle, { top: string; bottom: string; shoe: string; trim: string }> = {
  street: { top: "#5a6a82", bottom: "#3a4656", shoe: "#1c222c", trim: "#00ff9f" },
  suit: { top: "#4a5264", bottom: "#323846", shoe: "#1a1e24", trim: "#c5a26f" },
  sport: { top: "#2e8a6e", bottom: "#2a3a4c", shoe: "#f2f4f6", trim: "#3de7ff" },
  neon: { top: "#1c2a38", bottom: "#162028", shoe: "#00ff9f", trim: "#00ff9f" },
};

function hairMesh(style: HairStyle, color: string) {
  if (style === "buzz") {
    return (
      <mesh position={[0, 0.16, 0]} castShadow>
        <sphereGeometry args={[0.175, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.48]} />
        <meshStandardMaterial color={color} roughness={0.92} />
      </mesh>
    );
  }
  if (style === "mohawk") {
    return (
      <group>
        <mesh position={[0, 0.22, 0]} castShadow>
          <boxGeometry args={[0.08, 0.2, 0.28]} />
          <meshStandardMaterial color={color} roughness={0.78} />
        </mesh>
      </group>
    );
  }
  if (style === "bun") {
    return (
      <group>
        <mesh position={[0, 0.16, -0.02]} castShadow>
          <sphereGeometry args={[0.18, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
          <meshStandardMaterial color={color} roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.28, -0.08]} castShadow>
          <sphereGeometry args={[0.09, 12, 10]} />
          <meshStandardMaterial color={color} roughness={0.78} />
        </mesh>
      </group>
    );
  }
  if (style === "long") {
    return (
      <group>
        <mesh position={[0, 0.14, -0.02]} castShadow>
          <sphereGeometry args={[0.19, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.58]} />
          <meshStandardMaterial color={color} roughness={0.76} />
        </mesh>
        <mesh position={[0, -0.02, -0.16]} castShadow>
          <boxGeometry args={[0.22, 0.32, 0.1]} />
          <meshStandardMaterial color={color} roughness={0.8} />
        </mesh>
      </group>
    );
  }
  return (
    <mesh position={[0, 0.15, -0.01]} castShadow>
      <sphereGeometry args={[0.18, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
      <meshStandardMaterial color={color} roughness={0.78} />
    </mesh>
  );
}

function Face({ style, skin }: { style: FaceStyle; skin: string }) {
  return (
    <group>
      <mesh position={[-0.055, 0.03, 0.155]}>
        <sphereGeometry args={[0.028, 10, 8]} />
        <meshStandardMaterial color="#f7f4ea" roughness={0.35} />
      </mesh>
      <mesh position={[0.055, 0.03, 0.155]}>
        <sphereGeometry args={[0.028, 10, 8]} />
        <meshStandardMaterial color="#f7f4ea" roughness={0.35} />
      </mesh>
      <mesh position={[-0.055, 0.03, 0.178]}>
        <sphereGeometry args={[0.014, 8, 8]} />
        <meshStandardMaterial color="#14120f" />
      </mesh>
      <mesh position={[0.055, 0.03, 0.178]}>
        <sphereGeometry args={[0.014, 8, 8]} />
        <meshStandardMaterial color="#14120f" />
      </mesh>
      {style === "cool" ? (
        <mesh position={[0, 0.035, 0.168]}>
          <boxGeometry args={[0.2, 0.04, 0.04]} />
          <meshStandardMaterial color="#111318" metalness={0.55} roughness={0.28} emissive="#00ff9f" emissiveIntensity={0.12} />
        </mesh>
      ) : (
        <mesh position={[0, -0.055, 0.16]} rotation={[style === "smile" ? 0.35 : 0.12, 0, 0]}>
          <boxGeometry args={[style === "smile" ? 0.08 : 0.06, 0.012, 0.016]} />
          <meshStandardMaterial color={style === "smile" ? "#8a4a48" : "#5a3a32"} />
        </mesh>
      )}
      <mesh position={[0, -0.02, 0.168]}>
        <boxGeometry args={[0.03, 0.04, 0.03]} />
        <meshStandardMaterial color={skin} roughness={0.7} />
      </mesh>
    </group>
  );
}

export function HumanoidMesh({
  appearance,
  animation,
  moving,
  dancing,
  time,
  walkIntensity,
}: HumanoidMeshProps) {
  const root = useRef<THREE.Group>(null);
  const limbL = useRef<THREE.Group>(null);
  const limbR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);

  const skin = appearance?.skinColor ?? "#d4a574";
  const hairColor = appearance?.hairColor ?? "#1a1410";
  const hairStyle = appearance?.hairStyle ?? "short";
  const outfit = appearance?.outfit ?? "street";
  const face = appearance?.faceStyle ?? "cool";
  const accent = appearance?.accentColor ?? "#00ff9f";
  const body = appearance?.bodyColor ?? OUTFIT[outfit].top;
  const clothes = OUTFIT[outfit];
  const classId = resolveClassId(appearance?.classId);

  useFrame(({ clock }) => {
    const t = animation?.time ?? time ?? clock.elapsedTime;
    const isMoving = animation?.moving ?? moving ?? false;
    const isDance = animation?.dancing ?? dancing ?? false;
    const intensity = animation?.walkIntensity ?? walkIntensity ?? 1;
    const cadence = isMoving ? 8.4 * (0.85 + intensity * 0.15) : 1.25;
    const stride = isMoving ? Math.sin(t * cadence) * 0.55 * intensity : Math.sin(t * 1.2) * 0.02;
    const bounce = isDance
      ? Math.abs(Math.sin(t * 9)) * 0.08
      : isMoving
        ? Math.abs(Math.sin(t * cadence)) * 0.045 * intensity
        : Math.sin(t * 1.35) * 0.008;
    if (root.current) root.current.position.y = bounce;
    if (head.current) head.current.rotation.z = isDance ? Math.sin(t * 8) * 0.1 : Math.sin(t * 1.1) * 0.025;
    if (limbL.current) limbL.current.rotation.x = isDance ? Math.sin(t * 10) * 0.4 : stride;
    if (limbR.current) limbR.current.rotation.x = isDance ? -Math.sin(t * 10) * 0.4 : -stride;
    if (armL.current) armL.current.rotation.x = isDance ? -0.85 + Math.sin(t * 10) * 0.45 : -stride * 0.8;
    if (armR.current) armR.current.rotation.x = isDance ? -0.85 - Math.sin(t * 10) * 0.45 : stride * 0.8;
  });

  return (
    <group ref={root} name="humanoid" scale={1.34}>
      {/* Head */}
      <group ref={head} position={[0, 1.58, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.175, 18, 16]} />
          <meshStandardMaterial color={skin} roughness={0.62} metalness={0.04} />
        </mesh>
        {hairMesh(hairStyle, hairColor)}
        <Face style={face} skin={skin} />
        {classId === "anon" && (
          <>
            <mesh position={[-0.055, 0.03, 0.19]}>
              <boxGeometry args={[0.07, 0.018, 0.02]} />
              <meshStandardMaterial color="#ff2a2a" emissive="#ff2a2a" emissiveIntensity={1.2} toneMapped={false} />
            </mesh>
            <mesh position={[0.055, 0.03, 0.19]}>
              <boxGeometry args={[0.07, 0.018, 0.02]} />
              <meshStandardMaterial color="#ff2a2a" emissive="#ff2a2a" emissiveIntensity={1.2} toneMapped={false} />
            </mesh>
          </>
        )}
        {classId === "pepe" && (
          <mesh position={[0, 0.2, 0.02]} rotation={[0.15, 0, 0]} castShadow>
            <cylinderGeometry args={[0.16, 0.17, 0.06, 12]} />
            <meshStandardMaterial color="#3d8a38" roughness={0.55} />
          </mesh>
        )}
      </group>

      {/* Neck */}
      <mesh position={[0, 1.42, 0]} castShadow>
        <cylinderGeometry args={[0.055, 0.065, 0.1, 10]} />
        <meshStandardMaterial color={skin} roughness={0.65} />
      </mesh>

      {/* Torso + shoulders — jacket / class cosmetics sit on a human body */}
      <mesh position={[0, 1.2, 0]} castShadow>
        <boxGeometry args={[0.44, 0.46, 0.24]} />
        <meshStandardMaterial color={body} roughness={0.52} metalness={0.1} />
      </mesh>
      <mesh position={[-0.24, 1.38, 0]} rotation={[0, 0, 0.42]} castShadow>
        <capsuleGeometry args={[0.07, 0.1, 4, 8]} />
        <meshStandardMaterial color={classId === "pepe" ? "#3d7a38" : body} roughness={0.5} />
      </mesh>
      <mesh position={[0.24, 1.38, 0]} rotation={[0, 0, -0.42]} castShadow>
        <capsuleGeometry args={[0.07, 0.1, 4, 8]} />
        <meshStandardMaterial color={classId === "pepe" ? "#3d7a38" : body} roughness={0.5} />
      </mesh>
      {classId === "pepe" && (
        <mesh position={[0, 1.2, 0.02]} castShadow>
          <boxGeometry args={[0.46, 0.48, 0.26]} />
          <meshStandardMaterial color="#3d7a38" roughness={0.55} metalness={0.08} />
        </mesh>
      )}
      {classId === "wojak" && (
        <mesh position={[0, 1.36, -0.08]} rotation={[0.35, 0, 0]} castShadow>
          <boxGeometry args={[0.3, 0.16, 0.16]} />
          <meshStandardMaterial color="#6b7280" roughness={0.78} />
        </mesh>
      )}
      {classId === "doge" && (
        <mesh position={[0, 1.36, 0.08]} rotation={[0.4, 0, 0]}>
          <torusGeometry args={[0.12, 0.028, 8, 18]} />
          <meshStandardMaterial color="#e8a54b" roughness={0.45} emissive="#e8a54b" emissiveIntensity={0.2} />
        </mesh>
      )}
      <mesh position={[0, 1.2, 0.128]}>
        <boxGeometry args={[0.12, 0.28, 0.02]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={outfit === "neon" ? 0.95 : 0.55}
          toneMapped={false}
        />
      </mesh>
      {outfit === "suit" && (
        <mesh position={[0, 1.08, 0.13]}>
          <boxGeometry args={[0.08, 0.22, 0.02]} />
          <meshStandardMaterial color={clothes.trim} emissive={clothes.trim} emissiveIntensity={0.2} />
        </mesh>
      )}
      {classId === "chad" && (
        <mesh position={[0, 1.32, 0.12]} rotation={[0.2, 0, 0]}>
          <torusGeometry args={[0.1, 0.018, 8, 16]} />
          <meshStandardMaterial color="#c5a26f" metalness={0.7} roughness={0.28} emissive="#c5a26f" emissiveIntensity={0.25} />
        </mesh>
      )}

      {/* Hips */}
      <mesh position={[0, 0.9, 0]} castShadow>
        <boxGeometry args={[0.36, 0.16, 0.2]} />
        <meshStandardMaterial color={clothes.bottom} roughness={0.62} />
      </mesh>

      {/* Arms */}
      <group ref={armL} position={[-0.26, 1.32, 0]}>
        <mesh position={[0, -0.18, 0]} castShadow>
          <capsuleGeometry args={[0.055, 0.28, 5, 10]} />
          <meshStandardMaterial color={clothes.top} roughness={0.55} />
        </mesh>
        <mesh position={[0, -0.38, 0]} castShadow>
          <sphereGeometry args={[0.055, 10, 8]} />
          <meshStandardMaterial color={skin} roughness={0.65} />
        </mesh>
      </group>
      <group ref={armR} position={[0.26, 1.32, 0]}>
        <mesh position={[0, -0.18, 0]} castShadow>
          <capsuleGeometry args={[0.055, 0.28, 5, 10]} />
          <meshStandardMaterial color={clothes.top} roughness={0.55} />
        </mesh>
        <mesh position={[0, -0.38, 0]} castShadow>
          <sphereGeometry args={[0.055, 10, 8]} />
          <meshStandardMaterial color={skin} roughness={0.65} />
        </mesh>
      </group>

      {/* Legs + shoes on the ground plane */}
      <group ref={limbL} position={[-0.1, 0.82, 0]}>
        <mesh position={[0, -0.38, 0]} castShadow>
          <capsuleGeometry args={[0.065, 0.5, 5, 10]} />
          <meshStandardMaterial color={clothes.bottom} roughness={0.62} />
        </mesh>
        <mesh position={[0, -0.78, 0.05]} castShadow>
          <boxGeometry args={[0.12, 0.08, 0.22]} />
          <meshStandardMaterial
            color={clothes.shoe}
            roughness={0.45}
            metalness={0.15}
            emissive={outfit === "neon" ? accent : "#000000"}
            emissiveIntensity={outfit === "neon" ? 0.35 : 0}
          />
        </mesh>
      </group>
      <group ref={limbR} position={[0.1, 0.82, 0]}>
        <mesh position={[0, -0.38, 0]} castShadow>
          <capsuleGeometry args={[0.065, 0.5, 5, 10]} />
          <meshStandardMaterial color={clothes.bottom} roughness={0.62} />
        </mesh>
        <mesh position={[0, -0.78, 0.05]} castShadow>
          <boxGeometry args={[0.12, 0.08, 0.22]} />
          <meshStandardMaterial
            color={clothes.shoe}
            roughness={0.45}
            metalness={0.15}
            emissive={outfit === "neon" ? accent : "#000000"}
            emissiveIntensity={outfit === "neon" ? 0.35 : 0}
          />
        </mesh>
      </group>
    </group>
  );
}
