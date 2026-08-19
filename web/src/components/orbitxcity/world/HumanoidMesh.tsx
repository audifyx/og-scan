/**
 * Readable in-world humanoid — adult proportions, face, hair, beard, clothes.
 * Crypto class identity is cosmetics on this body (never a frog/blob replacement).
 * Character select, PlayerAvatar, RemoteAvatars, and NPCs share this mesh.
 */
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getCharacterClass, resolveClassId } from "@/lib/orbitxcity/characterClasses";
import type { AvatarAppearance, BeardStyle, FaceStyle, HairStyle, OutfitStyle } from "@/lib/orbitxcity/types";
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
  hoodie: { top: "#2a3344", bottom: "#1c222c", shoe: "#111418", trim: "#00ff9f" },
  gold: { top: "#c5a26f", bottom: "#2a2418", shoe: "#1a1610", trim: "#ffd700" },
  royal: { top: "#1a1428", bottom: "#121018", shoe: "#c5a26f", trim: "#e0c48a" },
  pilot: { top: "#3a4a58", bottom: "#2a3038", shoe: "#0e1216", trim: "#3de7ff" },
  legend: { top: "#0c1410", bottom: "#08100c", shoe: "#00ff9f", trim: "#00ff9f" },
};

function classBeard(classId: string): BeardStyle {
  if (classId === "chad") return "full";
  if (classId === "wojak") return "stubble";
  if (classId === "pepe") return "goatee";
  return "none";
}

function Hair({ style, color }: { style: HairStyle; color: string }) {
  if (style === "fade") {
    return (
      <group>
        <mesh position={[0, 0.15, -0.01]} castShadow>
          <sphereGeometry args={[0.188, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.48]} />
          <meshStandardMaterial color={color} roughness={0.82} />
        </mesh>
        <mesh position={[0, 0.08, 0.02]} castShadow>
          <sphereGeometry args={[0.168, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.32]} />
          <meshStandardMaterial color="#2a2218" roughness={0.9} />
        </mesh>
      </group>
    );
  }
  if (style === "twin") {
    return (
      <group>
        <mesh position={[0, 0.16, -0.01]} castShadow>
          <sphereGeometry args={[0.19, 16, 14, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
          <meshStandardMaterial color={color} roughness={0.76} />
        </mesh>
        <mesh position={[-0.13, -0.04, -0.13]} castShadow>
          <capsuleGeometry args={[0.042, 0.26, 4, 8]} />
          <meshStandardMaterial color={color} roughness={0.8} />
        </mesh>
        <mesh position={[0.13, -0.04, -0.13]} castShadow>
          <capsuleGeometry args={[0.042, 0.26, 4, 8]} />
          <meshStandardMaterial color={color} roughness={0.8} />
        </mesh>
      </group>
    );
  }
  if (style === "mohawk") {
    return (
      <group>
        <mesh position={[0, 0.08, -0.02]} castShadow>
          <sphereGeometry args={[0.17, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.4]} />
          <meshStandardMaterial color="#1a1410" roughness={0.88} />
        </mesh>
        <mesh position={[0, 0.24, 0]} castShadow>
          <boxGeometry args={[0.07, 0.22, 0.3]} />
          <meshStandardMaterial color={color} roughness={0.78} />
        </mesh>
      </group>
    );
  }
  if (style === "bun") {
    return (
      <group>
        <mesh position={[0, 0.16, -0.02]} castShadow>
          <sphereGeometry args={[0.19, 16, 14, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
          <meshStandardMaterial color={color} roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.3, -0.08]} castShadow>
          <sphereGeometry args={[0.09, 12, 10]} />
          <meshStandardMaterial color={color} roughness={0.78} />
        </mesh>
      </group>
    );
  }
  if (style === "long") {
    return (
      <group>
        <mesh position={[0, 0.15, -0.02]} castShadow>
          <sphereGeometry args={[0.2, 16, 14, 0, Math.PI * 2, 0, Math.PI * 0.58]} />
          <meshStandardMaterial color={color} roughness={0.76} />
        </mesh>
        <mesh position={[0, -0.04, -0.17]} castShadow>
          <boxGeometry args={[0.24, 0.36, 0.1]} />
          <meshStandardMaterial color={color} roughness={0.8} />
        </mesh>
      </group>
    );
  }
  if (style === "buzz") {
    return (
      <mesh position={[0, 0.14, 0]} castShadow>
        <sphereGeometry args={[0.178, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.46]} />
        <meshStandardMaterial color={color} roughness={0.92} />
      </mesh>
    );
  }
  return (
    <mesh position={[0, 0.16, -0.01]} castShadow>
      <sphereGeometry args={[0.192, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
      <meshStandardMaterial color={color} roughness={0.78} />
    </mesh>
  );
}

function Beard({ style, color }: { style: BeardStyle; color: string }) {
  if (style === "none") return null;
  if (style === "stubble") {
    return (
      <mesh position={[0, -0.07, 0.155]} castShadow>
        <sphereGeometry args={[0.125, 12, 10, 0, Math.PI * 2, Math.PI * 0.42, Math.PI * 0.28]} />
        <meshStandardMaterial color={color} roughness={0.95} transparent opacity={0.72} />
      </mesh>
    );
  }
  if (style === "goatee") {
    return (
      <group>
        <mesh position={[0, -0.1, 0.168]} castShadow>
          <boxGeometry args={[0.06, 0.07, 0.04]} />
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
        <mesh position={[0, -0.055, 0.17]}>
          <boxGeometry args={[0.09, 0.03, 0.03]} />
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
      </group>
    );
  }
  return (
    <group>
      <mesh position={[0, -0.08, 0.12]} castShadow>
        <sphereGeometry args={[0.15, 14, 10, 0, Math.PI * 2, Math.PI * 0.38, Math.PI * 0.32]} />
        <meshStandardMaterial color={color} roughness={0.88} />
      </mesh>
      <mesh position={[0, -0.14, 0.14]} castShadow>
        <sphereGeometry args={[0.1, 12, 8]} />
        <meshStandardMaterial color={color} roughness={0.86} />
      </mesh>
    </group>
  );
}

function Face({
  style,
  skin,
  classId,
}: {
  style: FaceStyle;
  skin: string;
  classId: string;
}) {
  const sad = classId === "wojak" || style === "neutral";
  const browY = sad ? 0.075 : 0.082;
  const browTilt = sad ? 0.28 : classId === "chad" ? -0.08 : 0.06;
  const mouthY = style === "smile" ? -0.072 : sad ? -0.08 : -0.07;
  return (
    <group>
      {/* Ears */}
      <mesh position={[-0.175, 0.0, 0.02]} rotation={[0, 0.2, 0.15]} castShadow>
        <sphereGeometry args={[0.038, 10, 8]} />
        <meshStandardMaterial color={skin} roughness={0.7} />
      </mesh>
      <mesh position={[0.175, 0.0, 0.02]} rotation={[0, -0.2, -0.15]} castShadow>
        <sphereGeometry args={[0.038, 10, 8]} />
        <meshStandardMaterial color={skin} roughness={0.7} />
      </mesh>

      {/* Brow ridge */}
      <mesh position={[0, 0.07, 0.155]}>
        <boxGeometry args={[0.2, 0.028, 0.05]} />
        <meshStandardMaterial color={skin} roughness={0.72} />
      </mesh>
      <mesh position={[-0.055, browY, 0.175]} rotation={[0, 0, browTilt]}>
        <boxGeometry args={[0.07, 0.012, 0.018]} />
        <meshStandardMaterial color="#2a2218" roughness={0.85} />
      </mesh>
      <mesh position={[0.055, browY, 0.175]} rotation={[0, 0, -browTilt]}>
        <boxGeometry args={[0.07, 0.012, 0.018]} />
        <meshStandardMaterial color="#2a2218" roughness={0.85} />
      </mesh>

      {/* Eyes — sclera, iris, pupil, lid */}
      <mesh position={[-0.052, 0.028, 0.162]}>
        <sphereGeometry args={[0.032, 12, 10]} />
        <meshStandardMaterial color="#f4f1ea" roughness={0.28} />
      </mesh>
      <mesh position={[0.052, 0.028, 0.162]}>
        <sphereGeometry args={[0.032, 12, 10]} />
        <meshStandardMaterial color="#f4f1ea" roughness={0.28} />
      </mesh>
      <mesh position={[-0.052, 0.026, 0.186]}>
        <sphereGeometry args={[0.016, 10, 8]} />
        <meshStandardMaterial color={classId === "anon" ? "#3a2018" : "#3d5a3a"} roughness={0.4} />
      </mesh>
      <mesh position={[0.052, 0.026, 0.186]}>
        <sphereGeometry args={[0.016, 10, 8]} />
        <meshStandardMaterial color={classId === "anon" ? "#3a2018" : "#3d5a3a"} roughness={0.4} />
      </mesh>
      <mesh position={[-0.052, 0.026, 0.198]}>
        <sphereGeometry args={[0.008, 8, 8]} />
        <meshStandardMaterial color="#0c0a08" />
      </mesh>
      <mesh position={[0.052, 0.026, 0.198]}>
        <sphereGeometry args={[0.008, 8, 8]} />
        <meshStandardMaterial color="#0c0a08" />
      </mesh>
      <mesh position={[-0.052, 0.048, 0.178]}>
        <boxGeometry args={[0.07, 0.012, 0.03]} />
        <meshStandardMaterial color={skin} roughness={0.7} />
      </mesh>
      <mesh position={[0.052, 0.048, 0.178]}>
        <boxGeometry args={[0.07, 0.012, 0.03]} />
        <meshStandardMaterial color={skin} roughness={0.7} />
      </mesh>

      {style === "cool" && classId !== "anon" ? (
        <mesh position={[0, 0.032, 0.178]}>
          <boxGeometry args={[0.22, 0.038, 0.045]} />
          <meshStandardMaterial color="#111318" metalness={0.62} roughness={0.24} emissive="#00ff9f" emissiveIntensity={0.1} />
        </mesh>
      ) : null}

      {/* Nose */}
      <mesh position={[0, -0.012, 0.188]} rotation={[0.18, 0, 0]}>
        <boxGeometry args={[0.032, 0.055, 0.04]} />
        <meshStandardMaterial color={skin} roughness={0.68} />
      </mesh>
      <mesh position={[0, -0.038, 0.2]}>
        <sphereGeometry args={[0.018, 8, 8]} />
        <meshStandardMaterial color={skin} roughness={0.68} />
      </mesh>

      {/* Mouth */}
      <mesh position={[0, mouthY, 0.175]} rotation={[style === "smile" ? 0.32 : sad ? -0.18 : 0.08, 0, 0]}>
        <boxGeometry args={[style === "smile" ? 0.09 : 0.07, 0.014, 0.018]} />
        <meshStandardMaterial color={style === "smile" ? "#8a4a48" : "#6a4038"} roughness={0.55} />
      </mesh>
      {style === "smile" && (
        <mesh position={[0, mouthY + 0.008, 0.176]}>
          <boxGeometry args={[0.07, 0.008, 0.012]} />
          <meshStandardMaterial color="#f2ece4" roughness={0.4} />
        </mesh>
      )}
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

  const classId = resolveClassId(appearance?.classId);
  const cls = getCharacterClass(classId);
  const skin = appearance?.skinColor ?? cls.skinColor;
  const hairColor = appearance?.hairColor ?? "#1a1410";
  const hairStyle = appearance?.hairStyle ?? "short";
  const outfit = appearance?.outfit ?? "street";
  const face = appearance?.faceStyle ?? "cool";
  const accent = appearance?.accentColor ?? cls.accentColor;
  const body = appearance?.bodyColor ?? OUTFIT[outfit].top;
  const clothes = OUTFIT[outfit];
  const beard = appearance?.beardStyle ?? classBeard(classId);
  const beardColor = hairColor === "#3d7a38" ? "#2a4a28" : hairColor;

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
    <group ref={root} name="humanoid" scale={[1.22 * cls.scale.x, 1.22 * cls.scale.y, 1.22 * cls.scale.z]}>
      <group ref={head} position={[0, 1.58, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.185, 20, 18]} />
          <meshStandardMaterial color={skin} roughness={0.62} metalness={0.04} />
        </mesh>
        {/* Jaw / chin volume so the head is not a toy sphere */}
        <mesh position={[0, -0.08, 0.04]} castShadow>
          <sphereGeometry args={[0.12, 14, 12]} />
          <meshStandardMaterial color={skin} roughness={0.64} />
        </mesh>
        <Hair style={hairStyle} color={hairColor} />
        <Face style={face} skin={skin} classId={classId} />
        <Beard style={beard} color={beardColor} />

        {classId === "anon" && (
          <>
            <mesh position={[0, -0.02, 0.175]} castShadow>
              <boxGeometry args={[0.28, 0.16, 0.08]} />
              <meshStandardMaterial color="#1a1e24" roughness={0.45} metalness={0.35} />
            </mesh>
            <mesh position={[-0.055, 0.03, 0.205]}>
              <boxGeometry args={[0.08, 0.02, 0.02]} />
              <meshStandardMaterial color="#ff2a2a" emissive="#ff2a2a" emissiveIntensity={1.35} toneMapped={false} />
            </mesh>
            <mesh position={[0.055, 0.03, 0.205]}>
              <boxGeometry args={[0.08, 0.02, 0.02]} />
              <meshStandardMaterial color="#ff2a2a" emissive="#ff2a2a" emissiveIntensity={1.35} toneMapped={false} />
            </mesh>
          </>
        )}
        {classId === "pepe" && (
          <group position={[0, 0.16, 0.02]} rotation={[0.18, 0, 0]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.19, 0.2, 0.07, 16]} />
              <meshStandardMaterial color="#3d8a38" roughness={0.55} />
            </mesh>
            <mesh position={[0, 0.02, 0.12]} castShadow>
              <boxGeometry args={[0.22, 0.04, 0.16]} />
              <meshStandardMaterial color="#3d8a38" roughness={0.55} />
            </mesh>
            <mesh position={[0, 0.045, -0.02]}>
              <cylinderGeometry args={[0.07, 0.07, 0.03, 12]} />
              <meshStandardMaterial color="#c23b3b" emissive="#c23b3b" emissiveIntensity={0.25} />
            </mesh>
          </group>
        )}
        {classId === "doge" && (
          <mesh position={[0, 0.18, 0]} castShadow>
            <sphereGeometry args={[0.2, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
            <meshStandardMaterial color="#c47a28" roughness={0.78} />
          </mesh>
        )}
      </group>

      <mesh position={[0, 1.42, 0]} castShadow>
        <cylinderGeometry args={[0.055, 0.068, 0.1, 10]} />
        <meshStandardMaterial color={skin} roughness={0.65} />
      </mesh>

      {/* Torso with collar / placket */}
      <mesh position={[0, 1.18, 0]} castShadow>
        <boxGeometry args={[0.46, 0.5, 0.26]} />
        <meshStandardMaterial color={body} roughness={0.52} metalness={0.1} />
      </mesh>
      <mesh position={[0, 1.4, 0.02]} castShadow>
        <boxGeometry args={[0.42, 0.08, 0.28]} />
        <meshStandardMaterial color={clothes.trim} roughness={0.45} metalness={0.18} />
      </mesh>
      <mesh position={[-0.25, 1.36, 0]} rotation={[0, 0, 0.38]} castShadow>
        <capsuleGeometry args={[0.075, 0.1, 4, 8]} />
        <meshStandardMaterial color={body} roughness={0.5} />
      </mesh>
      <mesh position={[0.25, 1.36, 0]} rotation={[0, 0, -0.38]} castShadow>
        <capsuleGeometry args={[0.075, 0.1, 4, 8]} />
        <meshStandardMaterial color={body} roughness={0.5} />
      </mesh>
      {outfit === "hoodie" && (
        <mesh position={[0, 1.34, -0.1]} rotation={[0.45, 0, 0]} castShadow>
          <boxGeometry args={[0.34, 0.18, 0.2]} />
          <meshStandardMaterial color={clothes.top} roughness={0.78} />
        </mesh>
      )}
      {outfit === "suit" && (
        <>
          <mesh position={[0, 1.08, 0.135]}>
            <boxGeometry args={[0.09, 0.24, 0.02]} />
            <meshStandardMaterial color={clothes.trim} emissive={clothes.trim} emissiveIntensity={0.18} />
          </mesh>
          <mesh position={[0, 1.32, 0.13]}>
            <boxGeometry args={[0.16, 0.04, 0.02]} />
            <meshStandardMaterial color="#f2ece4" roughness={0.55} />
          </mesh>
        </>
      )}
      <mesh position={[0, 1.18, 0.135]}>
        <boxGeometry args={[0.11, 0.26, 0.02]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={outfit === "neon" ? 0.95 : 0.45}
          toneMapped={false}
        />
      </mesh>
      {classId === "doge" && (
        <mesh position={[0, 1.34, 0.1]} rotation={[0.35, 0, 0]}>
          <torusGeometry args={[0.11, 0.026, 8, 18]} />
          <meshStandardMaterial color="#e8a54b" roughness={0.45} emissive="#e8a54b" emissiveIntensity={0.2} />
        </mesh>
      )}
      {classId === "chad" && (
        <mesh position={[0, 1.3, 0.13]} rotation={[0.18, 0, 0]}>
          <torusGeometry args={[0.1, 0.018, 8, 16]} />
          <meshStandardMaterial color="#c5a26f" metalness={0.7} roughness={0.28} emissive="#c5a26f" emissiveIntensity={0.25} />
        </mesh>
      )}

      <mesh position={[0, 0.88, 0]} castShadow>
        <boxGeometry args={[0.38, 0.16, 0.22]} />
        <meshStandardMaterial color={clothes.bottom} roughness={0.62} />
      </mesh>

      <group ref={armL} position={[-0.28, 1.3, 0]}>
        <mesh position={[0, -0.2, 0]} castShadow>
          <capsuleGeometry args={[0.058, 0.32, 5, 10]} />
          <meshStandardMaterial color={clothes.top} roughness={0.55} />
        </mesh>
        <mesh position={[0, -0.42, 0]} castShadow>
          <sphereGeometry args={[0.052, 10, 8]} />
          <meshStandardMaterial color={skin} roughness={0.65} />
        </mesh>
      </group>
      <group ref={armR} position={[0.28, 1.3, 0]}>
        <mesh position={[0, -0.2, 0]} castShadow>
          <capsuleGeometry args={[0.058, 0.32, 5, 10]} />
          <meshStandardMaterial color={clothes.top} roughness={0.55} />
        </mesh>
        <mesh position={[0, -0.42, 0]} castShadow>
          <sphereGeometry args={[0.052, 10, 8]} />
          <meshStandardMaterial color={skin} roughness={0.65} />
        </mesh>
      </group>

      <group ref={limbL} position={[-0.11, 0.8, 0]}>
        <mesh position={[0, -0.38, 0]} castShadow>
          <capsuleGeometry args={[0.068, 0.52, 5, 10]} />
          <meshStandardMaterial color={clothes.bottom} roughness={0.62} />
        </mesh>
        <mesh position={[0, -0.8, 0.05]} castShadow>
          <boxGeometry args={[0.13, 0.08, 0.24]} />
          <meshStandardMaterial
            color={clothes.shoe}
            roughness={0.45}
            metalness={0.15}
            emissive={outfit === "neon" ? accent : "#000000"}
            emissiveIntensity={outfit === "neon" ? 0.35 : 0}
          />
        </mesh>
      </group>
      <group ref={limbR} position={[0.11, 0.8, 0]}>
        <mesh position={[0, -0.38, 0]} castShadow>
          <capsuleGeometry args={[0.068, 0.52, 5, 10]} />
          <meshStandardMaterial color={clothes.bottom} roughness={0.62} />
        </mesh>
        <mesh position={[0, -0.8, 0.05]} castShadow>
          <boxGeometry args={[0.13, 0.08, 0.24]} />
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
