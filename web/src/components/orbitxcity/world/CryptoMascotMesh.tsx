/**
 * Playable crypto mascots — Pepe, Wojak, Chad, Doge, Anon.
 * Distinct silhouettes, not cloned humanoids.
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { resolveClassId, type CharacterClassId } from "@/lib/orbitxcity/characterClasses";
import type { AvatarAppearance } from "@/lib/orbitxcity/types";

export interface CharacterAnimationState {
  time?: number;
  moving?: boolean;
  dancing?: boolean;
  walkIntensity?: number;
}

interface CryptoMascotMeshProps {
  appearance?: Partial<AvatarAppearance> | null;
  mascotId?: CharacterClassId;
  animation?: CharacterAnimationState;
  moving?: boolean;
  dancing?: boolean;
  time?: number;
  walkIntensity?: number;
}

function useWalk(animation: CharacterAnimationState | undefined, extras?: { moving?: boolean; dancing?: boolean; time?: number; walkIntensity?: number }) {
  const root = useRef<THREE.Group>(null);
  const limbL = useRef<THREE.Group>(null);
  const limbR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = animation?.time ?? extras?.time ?? clock.elapsedTime;
    const moving = animation?.moving ?? extras?.moving ?? false;
    const dancing = animation?.dancing ?? extras?.dancing ?? false;
    const intensity = animation?.walkIntensity ?? extras?.walkIntensity ?? 1;
    const cadence = moving ? 8.2 * (0.85 + intensity * 0.15) : 1.35;
    const stride = moving ? Math.sin(t * cadence) * 0.5 * intensity : Math.sin(t * 1.3) * 0.02;
    const bounce = dancing
      ? Math.abs(Math.sin(t * 9)) * 0.1
      : moving
        ? Math.abs(Math.sin(t * cadence)) * 0.05 * intensity
        : Math.sin(t * 1.4) * 0.01;
    if (root.current) root.current.position.y = bounce;
    if (head.current) head.current.rotation.z = dancing ? Math.sin(t * 8) * 0.12 : Math.sin(t * 1.2) * 0.03;
    if (limbL.current) limbL.current.rotation.x = dancing ? Math.sin(t * 10) * 0.35 : stride;
    if (limbR.current) limbR.current.rotation.x = dancing ? -Math.sin(t * 10) * 0.35 : -stride;
    if (armL.current) armL.current.rotation.x = dancing ? -0.9 + Math.sin(t * 10) * 0.4 : -stride * 0.85;
    if (armR.current) armR.current.rotation.x = dancing ? -0.9 - Math.sin(t * 10) * 0.4 : stride * 0.85;
  });

  return { root, limbL, limbR, armL, armR, head };
}

function Pepe({ animation, extras }: { animation?: CharacterAnimationState; extras?: CryptoMascotMeshProps }) {
  const { root, limbL, limbR, armL, armR, head } = useWalk(animation, extras);
  const green = "#4fa64a";
  const greenDeep = "#347833";
  const belly = "#7ec46a";
  return (
    <group ref={root} name="mascot-pepe">
      <group ref={head} position={[0, 1.22, 0.08]}>
        <mesh castShadow>
          <sphereGeometry args={[0.42, 22, 18]} />
          <meshStandardMaterial color={green} roughness={0.55} />
        </mesh>
        <mesh position={[0, -0.06, 0.28]} scale={[1.05, 0.72, 0.7]} castShadow>
          <sphereGeometry args={[0.28, 18, 14]} />
          <meshStandardMaterial color={belly} roughness={0.6} />
        </mesh>
        <mesh position={[-0.16, 0.14, 0.3]} castShadow>
          <sphereGeometry args={[0.16, 16, 14]} />
          <meshStandardMaterial color="#f7f4ea" roughness={0.35} />
        </mesh>
        <mesh position={[0.16, 0.14, 0.3]} castShadow>
          <sphereGeometry args={[0.16, 16, 14]} />
          <meshStandardMaterial color="#f7f4ea" roughness={0.35} />
        </mesh>
        <mesh position={[-0.16, 0.12, 0.43]}>
          <sphereGeometry args={[0.055, 12, 10]} />
          <meshStandardMaterial color="#14120f" />
        </mesh>
        <mesh position={[0.16, 0.12, 0.43]}>
          <sphereGeometry args={[0.055, 12, 10]} />
          <meshStandardMaterial color="#14120f" />
        </mesh>
        <mesh position={[-0.16, 0.02, 0.36]} scale={[1.1, 0.35, 0.4]}>
          <sphereGeometry args={[0.1, 10, 8]} />
          <meshStandardMaterial color="#c45c5c" roughness={0.7} />
        </mesh>
        <mesh position={[0.16, 0.02, 0.36]} scale={[1.1, 0.35, 0.4]}>
          <sphereGeometry args={[0.1, 10, 8]} />
          <meshStandardMaterial color="#c45c5c" roughness={0.7} />
        </mesh>
        <mesh position={[0, -0.16, 0.38]} rotation={[0.2, 0, 0]}>
          <boxGeometry args={[0.34, 0.035, 0.04]} />
          <meshStandardMaterial color="#2a4a28" />
        </mesh>
      </group>
      <mesh position={[0, 0.78, 0]} castShadow>
        <capsuleGeometry args={[0.28, 0.32, 6, 12]} />
        <meshStandardMaterial color="#8b1e1e" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.62, 0.16]}>
        <boxGeometry args={[0.22, 0.18, 0.08]} />
        <meshStandardMaterial color={greenDeep} roughness={0.65} />
      </mesh>
      <group ref={armL} position={[-0.34, 0.92, 0]}>
        <mesh position={[0, -0.16, 0]} castShadow>
          <capsuleGeometry args={[0.08, 0.22, 4, 8]} />
          <meshStandardMaterial color="#8b1e1e" />
        </mesh>
        <mesh position={[0, -0.34, 0.02]} castShadow>
          <sphereGeometry args={[0.09, 10, 8]} />
          <meshStandardMaterial color={green} />
        </mesh>
      </group>
      <group ref={armR} position={[0.34, 0.92, 0]}>
        <mesh position={[0, -0.16, 0]} castShadow>
          <capsuleGeometry args={[0.08, 0.22, 4, 8]} />
          <meshStandardMaterial color="#8b1e1e" />
        </mesh>
        <mesh position={[0, -0.34, 0.02]} castShadow>
          <sphereGeometry args={[0.09, 10, 8]} />
          <meshStandardMaterial color={green} />
        </mesh>
      </group>
      <group ref={limbL} position={[-0.12, 0.48, 0]}>
        <mesh position={[0, -0.18, 0]} castShadow>
          <capsuleGeometry args={[0.09, 0.22, 4, 8]} />
          <meshStandardMaterial color="#8b1e1e" />
        </mesh>
      </group>
      <group ref={limbR} position={[0.12, 0.48, 0]}>
        <mesh position={[0, -0.18, 0]} castShadow>
          <capsuleGeometry args={[0.09, 0.22, 4, 8]} />
          <meshStandardMaterial color="#8b1e1e" />
        </mesh>
      </group>
    </group>
  );
}

function Wojak({ animation, extras }: { animation?: CharacterAnimationState; extras?: CryptoMascotMeshProps }) {
  const { root, limbL, limbR, armL, armR, head } = useWalk(animation, extras);
  const skin = "#f3d5c0";
  return (
    <group ref={root} name="mascot-wojak">
      <group ref={head} position={[0, 1.42, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.34, 20, 16]} />
          <meshStandardMaterial color={skin} roughness={0.72} />
        </mesh>
        <mesh position={[0, 0.22, -0.04]} scale={[0.95, 0.35, 0.85]} castShadow>
          <sphereGeometry args={[0.22, 12, 10]} />
          <meshStandardMaterial color="#6b5344" roughness={0.85} />
        </mesh>
        <mesh position={[-0.22, 0.08, -0.02]} rotation={[0, 0, 0.4]} castShadow>
          <sphereGeometry args={[0.1, 10, 8]} />
          <meshStandardMaterial color="#6b5344" roughness={0.85} />
        </mesh>
        <mesh position={[0.22, 0.08, -0.02]} rotation={[0, 0, -0.4]} castShadow>
          <sphereGeometry args={[0.1, 10, 8]} />
          <meshStandardMaterial color="#6b5344" roughness={0.85} />
        </mesh>
        <mesh position={[-0.1, 0.04, 0.3]}>
          <sphereGeometry args={[0.035, 8, 8]} />
          <meshStandardMaterial color="#1a1612" />
        </mesh>
        <mesh position={[0.1, 0.04, 0.3]}>
          <sphereGeometry args={[0.035, 8, 8]} />
          <meshStandardMaterial color="#1a1612" />
        </mesh>
        <mesh position={[-0.1, 0.1, 0.29]} rotation={[0, 0, 0.25]}>
          <boxGeometry args={[0.1, 0.012, 0.02]} />
          <meshStandardMaterial color="#3a2a22" />
        </mesh>
        <mesh position={[0.1, 0.1, 0.29]} rotation={[0, 0, -0.25]}>
          <boxGeometry args={[0.1, 0.012, 0.02]} />
          <meshStandardMaterial color="#3a2a22" />
        </mesh>
        <mesh position={[0, -0.12, 0.3]} rotation={[0.15, 0, 0]}>
          <torusGeometry args={[0.07, 0.012, 8, 16, Math.PI]} />
          <meshStandardMaterial color="#b07a7a" />
        </mesh>
      </group>
      <mesh position={[0, 0.86, 0]} castShadow>
        <capsuleGeometry args={[0.22, 0.42, 6, 12]} />
        <meshStandardMaterial color="#6b7280" roughness={0.78} />
      </mesh>
      <mesh position={[0, 1.12, -0.08]} castShadow>
        <sphereGeometry args={[0.16, 10, 8]} />
        <meshStandardMaterial color="#5b6270" roughness={0.8} />
      </mesh>
      <group ref={armL} position={[-0.28, 1.02, 0]} rotation={[0, 0, 0.2]}>
        <mesh position={[0, -0.2, 0]} castShadow>
          <capsuleGeometry args={[0.07, 0.28, 4, 8]} />
          <meshStandardMaterial color="#6b7280" />
        </mesh>
        <mesh position={[0, -0.4, 0]} castShadow>
          <sphereGeometry args={[0.07, 8, 8]} />
          <meshStandardMaterial color={skin} />
        </mesh>
      </group>
      <group ref={armR} position={[0.28, 1.02, 0]} rotation={[0, 0, -0.2]}>
        <mesh position={[0, -0.2, 0]} castShadow>
          <capsuleGeometry args={[0.07, 0.28, 4, 8]} />
          <meshStandardMaterial color="#6b7280" />
        </mesh>
        <mesh position={[0, -0.4, 0]} castShadow>
          <sphereGeometry args={[0.07, 8, 8]} />
          <meshStandardMaterial color={skin} />
        </mesh>
      </group>
      <group ref={limbL} position={[-0.1, 0.52, 0]}>
        <mesh position={[0, -0.2, 0]} castShadow>
          <capsuleGeometry args={[0.08, 0.28, 4, 8]} />
          <meshStandardMaterial color="#4b5563" />
        </mesh>
      </group>
      <group ref={limbR} position={[0.1, 0.52, 0]}>
        <mesh position={[0, -0.2, 0]} castShadow>
          <capsuleGeometry args={[0.08, 0.28, 4, 8]} />
          <meshStandardMaterial color="#4b5563" />
        </mesh>
      </group>
    </group>
  );
}

function Chad({ animation, extras }: { animation?: CharacterAnimationState; extras?: CryptoMascotMeshProps }) {
  const { root, limbL, limbR, armL, armR, head } = useWalk(animation, extras);
  const skin = "#d4a574";
  return (
    <group ref={root} name="mascot-chad">
      <group ref={head} position={[0, 1.72, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.22, 16, 14]} />
          <meshStandardMaterial color={skin} roughness={0.62} />
        </mesh>
        <mesh position={[0, -0.12, 0.04]} castShadow>
          <boxGeometry args={[0.28, 0.22, 0.22]} />
          <meshStandardMaterial color={skin} roughness={0.62} />
        </mesh>
        <mesh position={[0, -0.26, 0.06]} castShadow>
          <boxGeometry args={[0.2, 0.1, 0.16]} />
          <meshStandardMaterial color={skin} roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.16, -0.02]} castShadow>
          <boxGeometry args={[0.28, 0.1, 0.24]} />
          <meshStandardMaterial color="#1a1410" roughness={0.8} />
        </mesh>
        <mesh position={[-0.07, 0.02, 0.2]}>
          <boxGeometry args={[0.07, 0.018, 0.02]} />
          <meshStandardMaterial color="#1a1612" />
        </mesh>
        <mesh position={[0.07, 0.02, 0.2]}>
          <boxGeometry args={[0.07, 0.018, 0.02]} />
          <meshStandardMaterial color="#1a1612" />
        </mesh>
        <mesh position={[0, -0.08, 0.22]}>
          <boxGeometry args={[0.08, 0.02, 0.02]} />
          <meshStandardMaterial color="#8a5a48" />
        </mesh>
      </group>
      <mesh position={[0, 1.46, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.16, 0.22, 12]} />
        <meshStandardMaterial color={skin} roughness={0.62} />
      </mesh>
      <mesh position={[0, 1.12, 0]} castShadow>
        <boxGeometry args={[0.72, 0.48, 0.28]} />
        <meshStandardMaterial color="#1a1c22" roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.78, 0]} castShadow>
        <boxGeometry args={[0.32, 0.22, 0.2]} />
        <meshStandardMaterial color="#d4a017" roughness={0.45} />
      </mesh>
      <group ref={armL} position={[-0.42, 1.22, 0]}>
        <mesh position={[0, -0.16, 0]} castShadow>
          <capsuleGeometry args={[0.12, 0.28, 4, 8]} />
          <meshStandardMaterial color={skin} />
        </mesh>
      </group>
      <group ref={armR} position={[0.42, 1.22, 0]}>
        <mesh position={[0, -0.16, 0]} castShadow>
          <capsuleGeometry args={[0.12, 0.28, 4, 8]} />
          <meshStandardMaterial color={skin} />
        </mesh>
      </group>
      <group ref={limbL} position={[-0.12, 0.58, 0]}>
        <mesh position={[0, -0.22, 0]} castShadow>
          <capsuleGeometry args={[0.1, 0.32, 4, 8]} />
          <meshStandardMaterial color="#141820" />
        </mesh>
      </group>
      <group ref={limbR} position={[0.12, 0.58, 0]}>
        <mesh position={[0, -0.22, 0]} castShadow>
          <capsuleGeometry args={[0.1, 0.32, 4, 8]} />
          <meshStandardMaterial color="#141820" />
        </mesh>
      </group>
    </group>
  );
}

function Doge({ animation, extras }: { animation?: CharacterAnimationState; extras?: CryptoMascotMeshProps }) {
  const { root, limbL, limbR, armL, armR, head } = useWalk(animation, extras);
  const fur = "#e8a54b";
  const cream = "#f5e6c8";
  return (
    <group ref={root} name="mascot-doge">
      <group ref={head} position={[0, 1.18, 0.1]}>
        <mesh castShadow>
          <sphereGeometry args={[0.34, 18, 16]} />
          <meshStandardMaterial color={fur} roughness={0.78} />
        </mesh>
        <mesh position={[0, -0.06, 0.26]} scale={[0.9, 0.7, 0.85]} castShadow>
          <sphereGeometry args={[0.22, 14, 12]} />
          <meshStandardMaterial color={cream} roughness={0.72} />
        </mesh>
        <mesh position={[-0.18, 0.28, 0.02]} rotation={[0.15, 0, 0.35]} castShadow>
          <coneGeometry args={[0.1, 0.28, 8]} />
          <meshStandardMaterial color={fur} roughness={0.78} />
        </mesh>
        <mesh position={[0.2, 0.26, 0.04]} rotation={[0.25, 0, -0.55]} castShadow>
          <coneGeometry args={[0.09, 0.24, 8]} />
          <meshStandardMaterial color={fur} roughness={0.78} />
        </mesh>
        <mesh position={[-0.1, 0.06, 0.34]}>
          <sphereGeometry args={[0.045, 10, 8]} />
          <meshStandardMaterial color="#1a1612" />
        </mesh>
        <mesh position={[0.1, 0.06, 0.34]}>
          <sphereGeometry args={[0.045, 10, 8]} />
          <meshStandardMaterial color="#1a1612" />
        </mesh>
        <mesh position={[0, -0.04, 0.42]}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshStandardMaterial color="#1a1210" />
        </mesh>
      </group>
      <mesh position={[0, 0.7, 0]} castShadow>
        <capsuleGeometry args={[0.26, 0.28, 6, 12]} />
        <meshStandardMaterial color={fur} roughness={0.78} />
      </mesh>
      <mesh position={[0, 0.68, 0.16]} scale={[1, 1.1, 0.6]}>
        <sphereGeometry args={[0.18, 12, 10]} />
        <meshStandardMaterial color={cream} roughness={0.75} />
      </mesh>
      <mesh position={[0, 0.92, 0.2]}>
        <torusGeometry args={[0.14, 0.035, 8, 16]} />
        <meshStandardMaterial color="#c0392b" roughness={0.45} metalness={0.2} />
      </mesh>
      <mesh position={[0.22, 0.62, -0.16]} rotation={[0.6, 0.4, 0.2]}>
        <capsuleGeometry args={[0.05, 0.28, 4, 8]} />
        <meshStandardMaterial color={fur} />
      </mesh>
      <group ref={armL} position={[-0.22, 0.78, 0.08]}>
        <mesh position={[0, -0.16, 0.08]} castShadow>
          <capsuleGeometry args={[0.07, 0.18, 4, 8]} />
          <meshStandardMaterial color={fur} />
        </mesh>
      </group>
      <group ref={armR} position={[0.22, 0.78, 0.08]}>
        <mesh position={[0, -0.16, 0.08]} castShadow>
          <capsuleGeometry args={[0.07, 0.18, 4, 8]} />
          <meshStandardMaterial color={fur} />
        </mesh>
      </group>
      <group ref={limbL} position={[-0.1, 0.42, 0.04]}>
        <mesh position={[0, -0.14, 0]} castShadow>
          <capsuleGeometry args={[0.075, 0.18, 4, 8]} />
          <meshStandardMaterial color={cream} />
        </mesh>
      </group>
      <group ref={limbR} position={[0.1, 0.42, 0.04]}>
        <mesh position={[0, -0.14, 0]} castShadow>
          <capsuleGeometry args={[0.075, 0.18, 4, 8]} />
          <meshStandardMaterial color={cream} />
        </mesh>
      </group>
    </group>
  );
}

function Anon({ animation, extras }: { animation?: CharacterAnimationState; extras?: CryptoMascotMeshProps }) {
  const { root, limbL, limbR, armL, armR, head } = useWalk(animation, extras);
  return (
    <group ref={root} name="mascot-anon">
      <group ref={head} position={[0, 1.58, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.24, 16, 14]} />
          <meshStandardMaterial color="#f4f1ea" roughness={0.35} metalness={0.08} />
        </mesh>
        <mesh position={[-0.08, 0.04, 0.2]}>
          <boxGeometry args={[0.1, 0.03, 0.04]} />
          <meshStandardMaterial color="#ff2a2a" emissive="#ff2a2a" emissiveIntensity={1.4} toneMapped={false} />
        </mesh>
        <mesh position={[0.08, 0.04, 0.2]}>
          <boxGeometry args={[0.1, 0.03, 0.04]} />
          <meshStandardMaterial color="#ff2a2a" emissive="#ff2a2a" emissiveIntensity={1.4} toneMapped={false} />
        </mesh>
        <mesh position={[-0.08, 0.04, 0.42]} scale={[1, 1, 2.4]}>
          <boxGeometry args={[0.035, 0.012, 0.16]} />
          <meshBasicMaterial color="#ff4a4a" transparent opacity={0.55} toneMapped={false} />
        </mesh>
        <mesh position={[0.08, 0.04, 0.42]} scale={[1, 1, 2.4]}>
          <boxGeometry args={[0.035, 0.012, 0.16]} />
          <meshBasicMaterial color="#ff4a4a" transparent opacity={0.55} toneMapped={false} />
        </mesh>
        <mesh position={[0, -0.08, 0.22]}>
          <boxGeometry args={[0.12, 0.015, 0.02]} />
          <meshStandardMaterial color="#1a1814" />
        </mesh>
      </group>
      <mesh position={[0, 1.12, 0]} castShadow>
        <capsuleGeometry args={[0.26, 0.42, 6, 12]} />
        <meshStandardMaterial color="#111318" roughness={0.45} metalness={0.22} />
      </mesh>
      <mesh position={[0, 1.18, 0.2]} castShadow>
        <boxGeometry args={[0.08, 0.36, 0.04]} />
        <meshStandardMaterial color="#f7931a" emissive="#f7931a" emissiveIntensity={0.25} />
      </mesh>
      <mesh position={[0.36, 0.72, 0.08]} rotation={[0, -0.3, 0]} castShadow>
        <boxGeometry args={[0.22, 0.18, 0.08]} />
        <meshStandardMaterial color="#1a1410" metalness={0.35} roughness={0.5} />
      </mesh>
      <group ref={armL} position={[-0.32, 1.22, 0]}>
        <mesh position={[0, -0.2, 0]} castShadow>
          <capsuleGeometry args={[0.075, 0.3, 4, 8]} />
          <meshStandardMaterial color="#111318" />
        </mesh>
      </group>
      <group ref={armR} position={[0.32, 1.22, 0]}>
        <mesh position={[0, -0.2, 0]} castShadow>
          <capsuleGeometry args={[0.075, 0.3, 4, 8]} />
          <meshStandardMaterial color="#111318" />
        </mesh>
      </group>
      <group ref={limbL} position={[-0.1, 0.72, 0]}>
        <mesh position={[0, -0.22, 0]} castShadow>
          <capsuleGeometry args={[0.085, 0.32, 4, 8]} />
          <meshStandardMaterial color="#0c0e12" />
        </mesh>
      </group>
      <group ref={limbR} position={[0.1, 0.72, 0]}>
        <mesh position={[0, -0.22, 0]} castShadow>
          <capsuleGeometry args={[0.085, 0.32, 4, 8]} />
          <meshStandardMaterial color="#0c0e12" />
        </mesh>
      </group>
    </group>
  );
}

export function CryptoMascotMesh(props: CryptoMascotMeshProps) {
  const id = useMemo(
    () => props.mascotId ?? resolveClassId(props.appearance?.classId),
    [props.appearance?.classId, props.mascotId],
  );
  const extras = props;
  if (id === "wojak") return <Wojak animation={props.animation} extras={extras} />;
  if (id === "chad") return <Chad animation={props.animation} extras={extras} />;
  if (id === "doge") return <Doge animation={props.animation} extras={extras} />;
  if (id === "anon") return <Anon animation={props.animation} extras={extras} />;
  return <Pepe animation={props.animation} extras={extras} />;
}
